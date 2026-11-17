#!/usr/bin/env python3
"""splat-lab g1 · stage 2 — LGM's feed-forward U-Net turns the four views into a Gaussian .ply.

Second half of upstream LGM inference (`infer.py`), same pinned commit as mvgen.py:

    mv_1,mv_2,mv_3,mv_0 -> bilinear to opt.input_size -> ImageNet normalise
                        -> concat 6-channel Plücker ray embeddings (prepare_default_rays)
                        -> UNet + 1x1 conv -> activations -> [1, N, 14]
                        -> model.gs.save_ply(...)   # N = 4 * splat_size^2 = 65,536 for `big`

Differences from upstream `infer.py`, all memory-related or bookkeeping:
  * `lambda_lpips = 0`, so `core.models` never builds the LPIPS/VGG module (the import of
    `kiui.lpips` is satisfied by the vendored stub);
  * `diff_gaussian_rasterization` is a stub (vendor/), so no CUDA extension is compiled and the
    360-frame preview video is skipped — the deliverable is the .ply, so rendering buys nothing
    here (README of the LGM repo lists the renderer as a preview-only dependency);
  * no rembg / diffusion in this process: the ~3.8 GB of ImageDream weights from stage 1 are
    gone before LGM loads its own ~0.8 GB fp16 checkpoint, which is what makes the 4.9 GiB
    HAMi slice work at all;
  * every statistic the provenance README needs is written to metrics_lgm2ply.json (counts
    before/after the opacity>=0.005 prune inside save_ply, bounds, opacity/scale/colour stats,
    peak CUDA memory, wall time), plus `--stats-ply` re-reads the file with plyfile to confirm
    what actually landed on disk.

Run inside the splat-lab-lgm Job (`bash /scripts/run.sh lgm`).
"""

import argparse
import datetime
import json
import os
import sys
import time

VENDOR = os.environ.get("G1_VENDOR", "/work/vendor")
LGM_DIR = os.environ.get("LGM_DIR", "/work/LGM")
for p in (VENDOR, LGM_DIR):
    if p not in sys.path:
        sys.path.insert(0, p)

import numpy as np  # noqa: E402
import torch  # noqa: E402
import torch.nn.functional as F  # noqa: E402
import torchvision.transforms.functional as TF  # noqa: E402
from PIL import Image  # noqa: E402
from safetensors.torch import load_file  # noqa: E402

IMAGENET_DEFAULT_MEAN = (0.485, 0.456, 0.406)
IMAGENET_DEFAULT_STD = (0.229, 0.224, 0.225)
LGM_VIEW_ORDER = [1, 2, 3, 0]  # upstream infer.py / app.py re-ordering
PRUNE_OPACITY = 0.005  # save_ply's own threshold


def log(msg: str) -> None:
    print(f"[lgm2ply {datetime.datetime.utcnow():%H:%M:%S}] {msg}", flush=True)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--views", required=True, help="folder written by mvgen.py")
    ap.add_argument("--out", required=True, help="output .ply")
    ap.add_argument("--metrics-dir", default=None, help="default: alongside --out")
    ap.add_argument("--config", default="big", choices=["lrm", "small", "big", "tiny"])
    ap.add_argument("--repo", default="ashawkey/LGM")
    ap.add_argument("--ckpt", default="model_fp16_fixrot.safetensors",
                    help="file inside --repo (fixrot = post rotation-normalisation-fix weights)")
    ap.add_argument("--input-size", type=int, default=None,
                    help="override opt.input_size (smaller = less VRAM, fewer Gaussians)")
    ap.add_argument("--elevation", type=float, default=0.0, help="must match mvgen --elevation")
    ap.add_argument("--seed", type=int, default=42)
    ap.add_argument("--fp32", action="store_true", help="keep weights fp32 (accuracy check)")
    args = ap.parse_args()

    torch.manual_seed(args.seed)
    np.random.seed(args.seed)

    metrics = {
        "stage": "lgm2ply",
        "views_dir": os.path.basename(os.path.normpath(args.views)),
        "repo": args.repo,
        "ckpt": args.ckpt,
        "config": args.config,
        "elevation": args.elevation,
        "seed": args.seed,
        "torch": torch.__version__,
        "cuda": torch.version.cuda,
        "device": torch.cuda.get_device_name(0),
    }
    t_start = time.perf_counter()

    from core.models import LGM  # noqa: E402  (after sys.path + vendor stubs)
    from core.options import config_defaults  # noqa: E402

    opt = config_defaults[args.config]
    opt.lambda_lpips = 0.0  # skip the LPIPS/VGG module: inference never uses the loss
    if args.input_size:
        log(f"overriding input_size {opt.input_size} -> {args.input_size}")
        opt.input_size = args.input_size
    metrics["input_size"] = opt.input_size
    metrics["splat_size"] = opt.splat_size
    log(f"config {args.config}: input_size={opt.input_size} splat_size={opt.splat_size} "
        f"up_channels={opt.up_channels} fovy={opt.fovy} cam_radius={opt.cam_radius}")

    # ---- weights -------------------------------------------------------------
    t0 = time.perf_counter()
    from huggingface_hub import snapshot_download

    path = args.ckpt
    if not os.path.exists(path):
        repo_dir = snapshot_download(args.repo, allow_patterns=[args.ckpt])
        path = os.path.join(repo_dir, args.ckpt)
    ckpt = load_file(path, device="cpu")
    log(f"checkpoint {path}: {len(ckpt)} tensors, "
        f"{sum(v.numel() * v.element_size() for v in ckpt.values()) / 2**20:.0f} MiB")

    model = LGM(opt)
    res = model.load_state_dict(ckpt, strict=False)  # upstream uses strict=False
    metrics["state_dict"] = {
        "missing_keys": list(res.missing_keys),
        "unexpected_keys": list(res.unexpected_keys),
        "loaded": len(ckpt) - len(res.unexpected_keys),
    }
    if res.missing_keys or res.unexpected_keys:
        log(f"WARN state_dict mismatch: missing={len(res.missing_keys)} "
            f"unexpected={len(res.unexpected_keys)}")
        log(f"  first missing: {res.missing_keys[:5]}")
        log(f"  first unexpected: {res.unexpected_keys[:5]}")
    else:
        log(f"state_dict loaded clean ({metrics['state_dict']['loaded']} tensors)")
    del ckpt

    dtype = torch.float32 if args.fp32 else torch.float16
    model = model.to(dtype=dtype).to("cuda").eval()
    metrics["weights_mib"] = round(
        sum(p.numel() * p.element_size() for p in model.parameters()) / 2**20, 1)
    metrics["load_s"] = round(time.perf_counter() - t0, 1)
    log(f"model on cuda in {metrics['load_s']}s ({metrics['weights_mib']} MiB of params, {dtype})")

    # ---- input features ------------------------------------------------------
    dev = torch.device("cuda")
    rays = model.prepare_default_rays(dev, elevation=args.elevation)  # [4, 6, H, W]
    views = []
    for idx in LGM_VIEW_ORDER:
        p = os.path.join(args.views, f"mv_{idx}.png")
        arr = np.asarray(Image.open(p).convert("RGB"), dtype=np.float32) / 255.0
        views.append(arr)
        log(f"view {p} {arr.shape[:2]}")
    mv = np.stack(views, axis=0)  # [4, H, W, 3] in LGM's order
    x = torch.from_numpy(mv).permute(0, 3, 1, 2).float().to(dev)
    x = F.interpolate(x, size=(opt.input_size, opt.input_size), mode="bilinear", align_corners=False)
    x = TF.normalize(x, IMAGENET_DEFAULT_MEAN, IMAGENET_DEFAULT_STD)
    x = torch.cat([x, rays], dim=1).unsqueeze(0)  # [1, 4, 9, H, W]
    metrics["view_order"] = LGM_VIEW_ORDER

    # ---- forward -------------------------------------------------------------
    torch.cuda.reset_peak_memory_stats()
    t0 = time.perf_counter()
    with torch.no_grad():
        with torch.autocast(device_type="cuda", dtype=torch.float16):
            g = model.forward_gaussians(x)  # [1, N, 14]
    torch.cuda.synchronize()
    metrics["forward_s"] = round(time.perf_counter() - t0, 2)
    log(f"forward_gaussians -> {tuple(g.shape)} in {metrics['forward_s']}s")

    gg = g[0].float()
    pos, opacity, scale, rot, rgb = (gg[:, 0:3], gg[:, 3:4], gg[:, 4:7], gg[:, 7:11], gg[:, 11:14])
    keep = opacity[:, 0] >= PRUNE_OPACITY
    metrics["gaussians"] = {
        "total": int(gg.shape[0]),
        "kept_after_opacity_prune": int(keep.sum()),
        "prune_opacity": PRUNE_OPACITY,
        "expected_4_x_splat_size_sq": 4 * opt.splat_size * opt.splat_size,
    }

    def stats(t, mask=None):
        tt = t[mask] if mask is not None else t
        if tt.numel() == 0:
            return None
        return {
            "min": round(float(tt.min()), 5),
            "max": round(float(tt.max()), 5),
            "mean": round(float(tt.mean()), 5),
        }

    metrics["stats"] = {
        "pos_xyz": [stats(pos[:, i], keep) for i in range(3)],
        "opacity": stats(opacity[:, 0], keep),
        "scale": [stats(scale[:, i], keep) for i in range(3)],
        "rotation_quat_norm": {"min": round(float(rot.norm(dim=-1)[keep].min()), 5),
                               "max": round(float(rot.norm(dim=-1)[keep].max()), 5)},
        "rgb": [stats(rgb[:, i], keep) for i in range(3)],
    }
    metrics["peak_cuda_alloc_mib"] = round(torch.cuda.max_memory_allocated() / 2**20, 1)
    metrics["peak_cuda_reserved_mib"] = round(torch.cuda.max_memory_reserved() / 2**20, 1)

    os.makedirs(os.path.dirname(os.path.abspath(args.out)), exist_ok=True)
    t0 = time.perf_counter()
    model.gs.save_ply(g, args.out)  # includes the same opacity prune + inverse activations
    metrics["save_ply_s"] = round(time.perf_counter() - t0, 2)
    log(f"wrote {args.out} ({os.path.getsize(args.out) / 2**20:.1f} MiB) in {metrics['save_ply_s']}s")

    # confirm what landed on disk
    from plyfile import PlyData

    el = PlyData.read(args.out)["vertex"]
    props = [p.name for p in el.properties]
    xyz = np.stack([el["x"], el["y"], el["z"]], axis=1)
    metrics["ply"] = {
        "count": int(el.count),
        "properties": props,
        "bytes": os.path.getsize(args.out),
        "bounds_min": [round(float(v), 4) for v in xyz.min(0)],
        "bounds_max": [round(float(v), 4) for v in xyz.max(0)],
        "centre": [round(float(v), 4) for v in (xyz.min(0) + xyz.max(0)) / 2],
        "extent": [round(float(v), 4) for v in xyz.max(0) - xyz.min(0)],
        "opacity_logit": {"min": round(float(np.min(el["opacity"])), 3),
                          "max": round(float(np.max(el["opacity"])), 3)},
        "f_dc_mean": [round(float(np.mean(el[f"f_dc_{i}"])), 3) for i in range(3)],
    }
    metrics["wall_s"] = round(time.perf_counter() - t_start, 1)

    md = args.metrics_dir or os.path.dirname(os.path.abspath(args.out))
    os.makedirs(md, exist_ok=True)
    with open(os.path.join(md, "metrics_lgm2ply.json"), "w") as f:
        json.dump(metrics, f, indent=2, sort_keys=True)
    log(f"done in {metrics['wall_s']}s; peak cuda alloc {metrics['peak_cuda_alloc_mib']} MiB; "
        f"{metrics['gaussians']['kept_after_opacity_prune']} of {metrics['gaussians']['total']} "
        f"Gaussians kept")
    return 0


if __name__ == "__main__":
    sys.exit(main())
