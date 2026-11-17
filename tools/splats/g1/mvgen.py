#!/usr/bin/env python3
"""splat-lab g1 · stage 1 — one picture in, LGM's four multi-view images out.

Runs the first half of the upstream LGM inference path (LGM, ECCV 2024, MIT,
https://github.com/3DTopia/LGM, pinned commit fe8d12cff8c827df7bb77a3c8e8b37408cb6fe4c):

    image -> rembg cut-out -> kiui recenter (border_ratio=0.2) -> white background
          -> ImageDream "ipmv" multi-view diffusion (guidance 5.0, 30 steps, elevation 0, seed 42)
          -> mv_0.png .. mv_3.png  (+ mv_grid.png, the 2x2 view LGM's U-Net consumes)

Exactly as in LGM's `infer.py` / `app.py` image branch (`guidance_scale=5.0,
num_inference_steps=30, elevation=0`, view order re-ordered `[1, 2, 3, 0]`), but as a separate
process from the U-Net so the diffusion's ~3.8 GB of fp16 weights are gone before LGM loads —
HAMi caps this container at 5000 MiB (~4.9 GiB) on the GTX 1070.

Memory tricks used, in order of importance:
  * all components loaded fp16;
  * the CLIP-ViT-H/14 image encoder (1.2 GB fp16) is pushed back to CPU the moment its
    embeddings exist (monkey-patch of `encode_image`), so the 30-step loop runs with
    unet + vae + text encoder resident (~2.6 GB) instead of all four;
  * `--keep-image-encoder-on-gpu` to disable that if it ever misbehaves.

Writes metrics.json next to the images: wall time, peak cuda allocation/reservation, the
image hash, and the diffusers loading report (missing/unexpected keys) — the deck's caption
and `compute` fields quote these numbers.

Run inside the splat-lab-lgm Job (`bash /scripts/run.sh mvgen`); needs $LGM_DIR and
$G1_VENDOR on sys.path plus the venv from requirements.txt.
"""

import argparse
import datetime
import hashlib
import json
import os
import sys
import time

VENDOR = os.environ.get("G1_VENDOR", "/work/vendor")
LGM_DIR = os.environ.get("LGM_DIR", "/work/LGM")
for p in (LGM_DIR, VENDOR):
    if p not in sys.path:
        sys.path.insert(0, p)

import numpy as np  # noqa: E402
import torch  # noqa: E402
from PIL import Image  # noqa: E402

REPO_ID = "ashawkey/imagedream-ipmv-diffusers"
MEANING = {
    "mv_0.png": "azimuth 0",
    "mv_1.png": "azimuth 90",
    "mv_2.png": "azimuth 180",
    "mv_3.png": "azimuth 270",
    "mv_extra.png": "the extra (conditioning) view the ipmv UNet denoises alongside the 4 outputs",
}


def log(msg: str) -> None:
    print(f"[mvgen {datetime.datetime.utcnow():%H:%M:%S}] {msg}", flush=True)


def sha256_file(path: str) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def load_source(path: str, crop) -> np.ndarray:
    img = Image.open(path).convert("RGB")
    if crop:
        x0, y0, x1, y1 = crop
        img = img.crop((x0, y0, x1, y1))
    log(f"source {path} -> {img.size[0]}x{img.size[1]}")
    return np.array(img)


def threshold_matte(rgb: np.ndarray, tol: int = 24) -> np.ndarray:
    """Fallback cut-out for clean studio shots: flood-fill the background from the border.

    Only used if rembg/onnxruntime is unavailable. Approximate by construction — no alpha
    matting — so the README says which one produced an asset.
    """
    import cv2

    h, w = rgb.shape[:2]
    mask = np.zeros((h + 2, w + 2), np.uint8)
    for sx in (0, w - 1):
        for sy in (0, h - 1):
            cv2.floodFill(
                rgb.copy(), mask, (sx, sy), 255, (tol, tol, tol), (tol, tol, tol),
                cv2.FLOODFILL_MASK_ONLY | cv2.FLOODFILL_FIXED_RANGE | (255 << 8),
            )
    bg = mask[1:-1, 1:-1].astype(bool)
    alpha = np.where(bg, 0, 255).astype(np.uint8)
    alpha = cv2.morphologyEx(alpha, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
    log("matte=floodfill (approximate; no alpha matting)")
    return np.dstack([rgb, alpha])


def cutout_and_recenter(rgb: np.ndarray, matte: str, session) -> np.ndarray:
    """-> float32 [S, S, 3] in [0, 1] on white, the tensor LGM's pipeline expects."""
    from kiui.op import recenter

    if matte == "rembg":
        import rembg

        carved = rembg.remove(rgb, session=session)  # [H, W, 4] uint8
    else:
        carved = threshold_matte(rgb)
    mask = carved[..., -1] > 0
    if not mask.any():
        raise RuntimeError("empty foreground mask")
    log(f"foreground {int(mask.sum())} px of {mask.size}")

    image = recenter(carved, mask, border_ratio=0.2)  # RGBA, square
    image = image.astype(np.float32) / 255.0
    image = image[..., :3] * image[..., 3:4] + (1 - image[..., 3:4])  # rgba -> rgb on white
    return np.ascontiguousarray(image[..., :3])


def build_pipeline(dtype, offload_image_encoder: bool):
    """Load the ipmv pipeline from the LGM repo's own classes (they carry the `elevation`
    argument that the copy inside the HF repo lost) with components read from the snapshot."""
    from diffusers import AutoencoderKL, DDIMScheduler
    from huggingface_hub import snapshot_download
    from mvdream.mv_unet import MultiViewUNetModel
    from mvdream.pipeline_mvdream import MVDreamPipeline
    from transformers import (
        CLIPImageProcessor,
        CLIPTextModel,
        CLIPTokenizer,
        CLIPVisionModel,
    )

    t0 = time.perf_counter()
    repo = snapshot_download(REPO_ID)
    log(f"snapshot {REPO_ID} at {repo}")

    loading = {}

    def note(name, obj, info):
        loading[name] = {
            "missing": len(info.get("missing_keys", [])),
            "unexpected": len(info.get("unexpected_keys", [])),
            "mismatched": len(info.get("mismatched_keys", [])),
        }

    vae, info = AutoencoderKL.from_pretrained(repo, subfolder="vae", torch_dtype=dtype, output_loading_info=True)
    note("vae", vae, info)
    text_encoder, info = CLIPTextModel.from_pretrained(repo, subfolder="text_encoder", torch_dtype=dtype, output_loading_info=True)
    note("text_encoder", text_encoder, info)
    image_encoder, info = CLIPVisionModel.from_pretrained(repo, subfolder="image_encoder", torch_dtype=dtype, output_loading_info=True)
    note("image_encoder", image_encoder, info)
    unet, info = MultiViewUNetModel.from_pretrained(repo, subfolder="unet", torch_dtype=dtype, output_loading_info=True)
    note("unet", unet, info)
    tokenizer = CLIPTokenizer.from_pretrained(repo, subfolder="tokenizer")
    feature_extractor = CLIPImageProcessor.from_pretrained(repo, subfolder="feature_extractor")
    scheduler = DDIMScheduler.from_pretrained(repo, subfolder="scheduler")

    pipe = MVDreamPipeline(
        vae=vae,
        unet=unet,
        tokenizer=tokenizer,
        text_encoder=text_encoder,
        scheduler=scheduler,
        feature_extractor=feature_extractor,
        image_encoder=image_encoder,
    )
    log(f"pipeline built in {time.perf_counter() - t0:.1f}s; weight load report {json.dumps(loading)}")

    if offload_image_encoder:
        # __call__ pulls every component onto the GPU first; put the 1.2 GB CLIP-ViT-H back to
        # CPU as soon as its embeddings exist so the denoising loop has room.
        orig = MVDreamPipeline.encode_image

        def encode_image_release(self, image, device, num_images_per_prompt):
            out = orig(self, image, device, num_images_per_prompt)
            self.image_encoder = self.image_encoder.to("cpu")
            torch.cuda.empty_cache()
            log("image_encoder released to CPU (peak-VRAM guard)")
            return out

        MVDreamPipeline.encode_image = encode_image_release
    return pipe, loading


def save_png(arr: np.ndarray, path: str) -> None:
    Image.fromarray((np.clip(arr, 0, 1) * 255 + 0.5).astype(np.uint8)).save(path)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--input", required=True, help="source image file (already downloaded)")
    ap.add_argument("--out", required=True, help="output folder")
    ap.add_argument("--crop", default=None, help="x0,y0,x1,y1 in source pixels")
    ap.add_argument("--matte", default="rembg", choices=["rembg", "floodfill"])
    ap.add_argument("--steps", type=int, default=30)
    ap.add_argument("--guidance", type=float, default=5.0)
    ap.add_argument("--elevation", type=float, default=0.0)
    ap.add_argument("--seed", type=int, default=42)
    ap.add_argument("--prompt", default="", help="optional text prompt (LGM allows prompt+image)")
    ap.add_argument("--keep-image-encoder-on-gpu", action="store_true")
    args = ap.parse_args()

    os.makedirs(args.out, exist_ok=True)
    metrics = {
        "stage": "mvgen",
        "input": os.path.basename(args.input),
        "input_sha256": sha256_file(args.input),
        "crop": [int(v) for v in args.crop.split(",")] if args.crop else None,
        "matte": args.matte,
        "repo": REPO_ID,
        "steps": args.steps,
        "guidance_scale": args.guidance,
        "elevation": args.elevation,
        "seed": args.seed,
        "prompt": args.prompt,
        "torch": torch.__version__,
        "cuda": torch.version.cuda,
        "device": torch.cuda.get_device_name(0),
    }
    t_start = time.perf_counter()

    torch.manual_seed(args.seed)
    np.random.seed(args.seed)

    crop = [int(v) for v in args.crop.split(",")] if args.crop else None
    rgb = load_source(args.input, crop)
    save_png(rgb.astype(np.float32) / 255.0, os.path.join(args.out, "00_source.png"))

    session = None
    if args.matte == "rembg":
        import rembg

        t0 = time.perf_counter()
        session = rembg.new_session()  # u2net, $U2NET_HOME cache
        log(f"rembg session ready in {time.perf_counter() - t0:.1f}s")
    t0 = time.perf_counter()
    cond = cutout_and_recenter(rgb, args.matte, session)
    metrics["cutout_s"] = round(time.perf_counter() - t0, 2)
    log(f"cut-out + recenter {cond.shape} in {metrics['cutout_s']}s")
    Image.fromarray((cond * 255 + 0.5).astype(np.uint8)).save(os.path.join(args.out, "01_cutout.png"))

    dtype = torch.float16
    pipe, loading = build_pipeline(dtype, not args.keep_image_encoder_on_gpu)
    metrics["weight_load"] = loading

    torch.cuda.reset_peak_memory_stats()
    dev = torch.device("cuda:0")
    t0 = time.perf_counter()
    with torch.inference_mode():
        mv = pipe(
            args.prompt,
            cond,
            num_inference_steps=args.steps,
            guidance_scale=args.guidance,
            elevation=args.elevation,
            device=dev,
            output_type="numpy",
        )
    metrics["diffusion_s"] = round(time.perf_counter() - t0, 2)
    mv = np.asarray(mv)
    log(f"diffusion produced {mv.shape} in {metrics['diffusion_s']}s")

    assert mv.ndim == 4 and mv.shape[-1] == 3, f"unexpected output shape {mv.shape}"
    names = ["mv_0.png", "mv_1.png", "mv_2.png", "mv_3.png"]
    for i, name in enumerate(names[: mv.shape[0]]):
        save_png(mv[i], os.path.join(args.out, name))
    if mv.shape[0] > 4:  # ipmv denoises one extra conditioning view; keep it for reference
        save_png(mv[4], os.path.join(args.out, "mv_extra.png"))

    # The 2x2 grid LGM's U-Net actually consumes: [1,2 ; 3,0] (its infer.py order is [1,2,3,0]).
    lgm_order = np.stack([mv[1], mv[2], mv[3], mv[0]], axis=0)
    grid = np.concatenate(
        [np.concatenate([lgm_order[0], lgm_order[1]], axis=1),
         np.concatenate([lgm_order[2], lgm_order[3]], axis=1)],
        axis=0,
    )
    save_png(grid, os.path.join(args.out, "mv_grid.png"))
    metrics["lgm_view_order"] = [1, 2, 3, 0]
    metrics["views"] = names
    metrics["view_meaning"] = MEANING

    metrics["peak_cuda_alloc_mib"] = round(torch.cuda.max_memory_allocated() / 2**20, 1)
    metrics["peak_cuda_reserved_mib"] = round(torch.cuda.max_memory_reserved() / 2**20, 1)
    metrics["wall_s"] = round(time.perf_counter() - t_start, 1)
    with open(os.path.join(args.out, "metrics_mvgen.json"), "w") as f:
        json.dump(metrics, f, indent=2, sort_keys=True)
    log(f"done in {metrics['wall_s']}s; peak cuda alloc {metrics['peak_cuda_alloc_mib']} MiB "
        f"(reserved {metrics['peak_cuda_reserved_mib']} MiB) -> {args.out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
