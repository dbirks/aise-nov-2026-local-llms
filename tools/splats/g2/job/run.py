#!/usr/bin/env python3
# /// splat-lab g2 · DiffSplat (SD1.5) text -> 3D Gaussian splats on a Pascal GTX 1070
#
# Upstream: DiffSplat, ICLR 2025, MIT, https://github.com/chenguolin/DiffSplat
# (commit pinned in setup.sh). This is our own lean runner for the *text-conditioned SD1.5*
# path, not a copy of `src/infer_gsdiff_sd.py`: it imports the same upstream classes
# (`GSAutoencoderKL`, `UNetMV2DConditionModel`, `StableMVDiffusionPipeline`, `geo_util`) and
# calls them the same way, but drops everything the deck does not need (videos, metrics,
# controlnets, GSRecon weights) and replaces the precision strategy, because the upstream
# defaults do not run inside the 5000 MiB HAMi slice on sm_61:
#
#   * upstream runs the denoiser in fp32 (`torch.autocast("cuda", torch.float32)`) and offers
#     `--half_precision` = **bf16**; PyTorch raises on bf16 autocast where
#     `torch.cuda.is_bf16_supported()` is false, i.e. on Pascal. Here every generation-side
#     module (CLIP text encoder, SD1.5 VAE, the 0.86 B multi-view UNet) is loaded in **fp16**
#     and the loop runs under `torch.autocast("cuda", torch.float16)`, which keeps fp32
#     accumulate in cuBLAS/cuDNN and fp32 for the autocast "fp32 cast policy" ops
#     (softmax, layer-norm, reductions).
#   * the GSVAE decoder and the Gaussian-parameter unprojection run *outside* autocast in
#     fp32 (~0.34 GB, cheap) - the exported splats come from here.
#   * GSRecon's 42 M weights are never loaded: per the upstream README only its *rendering*
#     function is used at inference. We redo the same pre-rasterisation math ourselves
#     (`gs_renderer.render` lines 48-71), so writing the .ply does not touch the CUDA
#     rasterizer at all. The rasterizer is only used for the optional verification sheet, and
#     a stub stands in when the sm_61 build is unavailable.
#
# Outputs under --out:
#   raw/<slug>.ply            exported splats (upstream `compatible=True` column semantics)
#   raw/<slug>.json           per-asset stats (splat count, bounds, opacity, timings, VRAM)
#   preview-<slug>.png        verification contact sheet (only with a working rasterizer)
#   metrics.json              everything above in one file + environment record
import argparse
import json
import os
import re
import subprocess
import sys
import threading
import time
import traceback
from typing import Any, Dict, List, Optional


def log(msg: str) -> None:
    print(f"[g2 {time.strftime('%H:%M:%S')}] {msg}", flush=True)


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(
        description="DiffSplat (SD1.5) text->3DGS runner for the splat-lab GTX 1070 Job",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    p.add_argument("--repo", default="/data/cache/repo/DiffSplat", help="DiffSplat checkout")
    p.add_argument("--ckpt", default="/data/cache/ckpt/DiffSplat", help="downloaded DiffSplat weights")
    p.add_argument("--out", default="/data/out/diffsplat-1")
    p.add_argument("--prompts", default="/scripts/prompts.tsv", help="lines: <slug>\\t<prompt>")
    p.add_argument("--sd-model", default="stable-diffusion-v1-5/stable-diffusion-v1-5")
    p.add_argument("--tag", default="gsdiff_gobj83k_sd15__render", help="DiffSplat (SD1.5) text-cond ckpt dir name")
    p.add_argument("--gsvae-tag", default="gsvae_gobj265k_sd", help="GSVAE (SD) ckpt dir name")
    p.add_argument("--seed", type=int, default=0)
    p.add_argument("--steps", type=int, default=20, help="upstream --num_inference_steps default")
    p.add_argument("--guidance-scale", type=float, default=7.5, help="upstream text-cond default")
    p.add_argument("--negative-prompt", default="", help="upstream text-cond default (empty)")
    p.add_argument("--scheduler-type", default="sde-dpmsolver++", help="upstream --scheduler_type default")
    p.add_argument("--eta", type=float, default=1.0, help="only used by ddim; passed as upstream does")
    p.add_argument("--elevation", type=float, default=10.0, help="upstream default for text-cond")
    p.add_argument("--distance", type=float, default=1.4, help="camera radius (GObjaverse norm)")
    p.add_argument("--res", type=int, default=256, help="opt.input_res (latent 32x32 per view)")
    p.add_argument("--num-views", type=int, default=4, help="opt.num_input_views (hard-coded azimuths 0/90/180/270)")
    p.add_argument(
        "--rescale-betas-zero-snr-at-init",
        action="store_true",
        help="build the scheduler with rescale_betas_zero_snr=True. Off by default: upstream sets "
             "that flag on `scheduler.config` *after* construction, where diffusers 0.32 ignores it "
             "(betas are fixed in __init__), so the off state is what upstream actually runs.",
    )
    p.add_argument("--precision", choices=["fp16", "bf16"], default="fp16",
                   help="generation-side weight + autocast dtype. fp16 is what the brief asks for "
                        "(Pascal has no bf16 tensor cores); bf16 is available because torch 2.7 "
                        "reports is_bf16_supported()=True on this card, kept as an escape hatch.")
    p.add_argument("--no-render", action="store_true", help="skip the verification contact sheet")
    p.add_argument("--render-res", type=int, default=256)
    p.add_argument("--orbit-frames", type=int, default=12)
    p.add_argument("--report-opacity", type=float, default=0.05, help="threshold for the reported splat count only")
    p.add_argument("--limit", type=int, default=0, help="stop after N prompts (debug)")
    return p.parse_args()


class GpuMemSampler(threading.Thread):
    """Poll `nvidia-smi` so the log also carries the device-wide peak, next to the
    per-process `torch.cuda.max_memory_allocated()` (HAMi accounts ~5000 MiB to this
    container; nvidia-smi reports the whole 8 GiB card, including qwen3-asr's Vulkan
    allocations - so the two numbers answer different questions and both are recorded)."""

    def __init__(self, interval: float = 1.0):
        super().__init__(daemon=True)
        self.interval = interval
        self.peak_mib = 0
        self.samples: List[int] = []
        self._stop = threading.Event()

    def run(self) -> None:
        while not self._stop.is_set():
            try:
                out = subprocess.run(
                    ["nvidia-smi", "--query-gpu=memory.used", "--format=csv,noheader,nounits"],
                    capture_output=True, text=True, timeout=10,
                ).stdout.strip().splitlines()[0]
                mib = int(float(out))
                self.samples.append(mib)
                self.peak_mib = max(self.peak_mib, mib)
            except Exception:
                pass
            self._stop.wait(self.interval)

    def stop(self) -> None:
        self._stop.set()


def latest_ckpt_dir(root: str) -> str:
    iters = sorted(d for d in os.listdir(root) if re.fullmatch(r"\d{6}", d))
    if not iters:
        raise RuntimeError(f"no 6-digit checkpoint dirs under {root}: {os.listdir(root)}")
    return os.path.join(root, iters[-1])


def main() -> int:
    args = parse_args()
    os.makedirs(args.out, exist_ok=True)
    os.makedirs(os.path.join(args.out, "raw"), exist_ok=True)
    sys.path.insert(0, args.repo)
    os.chdir(args.repo)  # upstream code resolves a few paths relative to cwd

    import numpy as np
    import torch
    from einops import rearrange
    from plyfile import PlyElement, PlyData
    from transformers import CLIPTokenizer, CLIPTextModel
    from diffusers import AutoencoderKL, DPMSolverMultistepScheduler
    from accelerate import load_checkpoint_and_dispatch

    from src.options import opt_dict
    from src.models.gsvae import GSAutoencoderKL
    from src.utils.geo_util import orbit_camera, plucker_ray, unproject_depth
    from extensions.diffusers_diffsplat import StableMVDiffusionPipeline, UNetMV2DConditionModel

    SH_C0 = 0.28209479177387814
    gen_dtype = torch.bfloat16 if args.precision == "bf16" else torch.float16
    t_start = time.time()
    dev = torch.device("cuda:0")
    sampler = GpuMemSampler()
    sampler.start()

    env: Dict[str, Any] = {
        "torch": torch.__version__,
        "cuda": torch.version.cuda,
        "arch_list": torch.cuda.get_arch_list(),
        "device": torch.cuda.get_device_name(0),
        "capability": list(torch.cuda.get_device_capability(0)),
        "bf16_supported": bool(torch.cuda.is_bf16_supported()),
        "fp16_supported": bool(torch.cuda.get_device_properties(0).major >= 5),
        "mem_total_gib": round(torch.cuda.get_device_properties(0).total_memory / 2**30, 3),
        "diffusers": __import__("diffusers").__version__,
        "transformers": __import__("transformers").__version__,
        "numpy": np.__version__,
        "precision": f"{args.precision} weights + torch.autocast(cuda, {str(gen_dtype).split('.')[-1]}) "
                     "for the UNet; fp32 GSVAE decode",
    }
    free, total = torch.cuda.mem_get_info()
    env["mem_free_gib_at_start"] = round(free / 2**30, 3)
    env["mem_visible_gib"] = round(total / 2**30, 3)  # HAMi slice, not the physical 8 GiB
    log(f"env torch={env['torch']} cuda={env['cuda']} device={env['device']} "
        f"sm_{env['capability'][0]}{env['capability'][1]} bf16={env['bf16_supported']} "
        f"slice={env['mem_visible_gib']} GiB free={env['mem_free_gib_at_start']} GiB")

    # ---------------------------------------------------------------- models
    opt = opt_dict["gsdiff_sd15"]
    opt.num_input_views = args.num_views
    opt.input_res = args.res
    log(f"opt: input_res={opt.input_res} views={opt.num_input_views} "
        f"plucker={opt.input_concat_plucker} binary_mask={opt.input_concat_binary_mask} "
        f"view_concat={opt.view_concat_condition} fxfy={opt.fxfy:.4f} common_tricks={opt.common_tricks}")

    tok = CLIPTokenizer.from_pretrained(args.sd_model, subfolder="tokenizer")
    text_encoder = CLIPTextModel.from_pretrained(
        args.sd_model, subfolder="text_encoder", variant="fp16", torch_dtype=gen_dtype
    ).to(dev).eval()

    # The plain SD1.5 VAE is only touched by the pipeline for *image* latents (single-view
    # conditioning); the text-conditioned path never encodes/decodes with it. Load it in fp16
    # anyway because the pipeline requires the attribute, and it costs 160 MB.
    vae = AutoencoderKL.from_pretrained(
        args.sd_model, subfolder="vae", variant="fp16", torch_dtype=gen_dtype
    ).to(dev).eval()

    gsvae = GSAutoencoderKL(opt).eval()
    gsvae_ckpt = latest_ckpt_dir(os.path.join(args.ckpt, args.gsvae_tag, "checkpoints"))
    log(f"GSVAE checkpoint: {gsvae_ckpt}")
    load_checkpoint_and_dispatch(gsvae, gsvae_ckpt, strict=True)  # same call as upstream util.load_ckpt
    gsvae = gsvae.to(dev)  # fp32: the decoder is what produces the exported Gaussians
    log(f"gsvae scaling_factor={gsvae.scaling_factor} shift_factor={gsvae.shift_factor} "
        f"dtype={next(gsvae.parameters()).dtype}")

    scheduler = DPMSolverMultistepScheduler.from_pretrained(args.sd_model, subfolder="scheduler")
    # Upstream mutates `scheduler.config` after construction (src/infer_gsdiff_sd.py). diffusers
    # 0.32.2 reads `self.config.algorithm_type` / `self.config.timestep_spacing` dynamically, so
    # those two do take effect; `rescale_betas_zero_snr` is consumed in __init__ only, so the
    # upstream mutation is a silent no-op there. We reproduce that exactly by default.
    scheduler.config.algorithm_type = args.scheduler_type
    if opt.common_tricks:
        scheduler.config.timestep_spacing = "trailing"
        scheduler.config.rescale_betas_zero_snr = True
    if opt.prediction_type is not None:
        scheduler.config.prediction_type = opt.prediction_type
    if opt.beta_schedule is not None:
        scheduler.config.beta_schedule = opt.beta_schedule
    if args.rescale_betas_zero_snr_at_init:
        scheduler = DPMSolverMultistepScheduler.from_config(
            dict(scheduler.config), rescale_betas_zero_snr=True
        )
        scheduler.config.algorithm_type = args.scheduler_type
        scheduler.config.timestep_spacing = "trailing"
    env["scheduler"] = {
        "class": type(scheduler).__name__,
        "config.algorithm_type": scheduler.config.algorithm_type,
        "config.timestep_spacing": scheduler.config.timestep_spacing,
        "config.prediction_type": str(scheduler.config.prediction_type),
        "config.beta_schedule": scheduler.config.beta_schedule,
        "betas_rescaled_zero_snr": bool(args.rescale_betas_zero_snr_at_init),
    }
    log(f"scheduler {env['scheduler']}")

    unet_dir = latest_ckpt_dir(os.path.join(args.ckpt, args.tag, "checkpoints"))
    in_channels = 4 + (6 if opt.input_concat_plucker else 0) + (1 if opt.input_concat_binary_mask else 0)
    log(f"UNet: {unet_dir}/unet_ema in_channels={in_channels} sample_size={args.res // 8} ({args.precision}, "
        f"low_cpu_mem_usage=False)")
    unet, loading_info = UNetMV2DConditionModel.from_pretrained_new(
        unet_dir, subfolder="unet_ema",
        sample_size=args.res // 8,
        in_channels=in_channels,
        zero_init_conv_in=opt.zero_init_conv_in,
        view_concat_condition=opt.view_concat_condition,
        input_concat_plucker=opt.input_concat_plucker,
        input_concat_binary_mask=opt.input_concat_binary_mask,
        torch_dtype=gen_dtype,
        # Upstream value, and the only one that works: the fork binds `state_dict_original`
        # only in the low_cpu_mem_usage=False branch (unet_mv2d_condition.py:1634 vs :1661), so
        # `low_cpu_mem_usage=True` dies with UnboundLocalError there. Measured cost of staying
        # faithful: ~10 GB CPU peak while the 3.28 GB fp32 state dict is loaded and deep-copied,
        # inside a 24 Gi container limit. It also gives us a real loading_info to check.
        low_cpu_mem_usage=False,
        output_loading_info=True,
    )
    env["unet_loading_info"] = {k: list(v) for k, v in loading_info.items()}
    log(f"UNet loading_info (counts): { {k: len(v) for k, v in loading_info.items()} }")
    for key in ("missing_keys", "unexpected_keys", "mismatched_keys"):
        if len(loading_info[key]) > 0:
            raise RuntimeError(f"UNet checkpoint did not load cleanly: {key} = {loading_info[key][:8]}")
    unet = unet.to(dev).eval()
    n_params = sum(p.numel() for p in unet.parameters())
    env["unet_params_millions"] = round(n_params / 1e6, 1)
    log(f"UNet loaded: {env['unet_params_millions']} M params, dtype={next(unet.parameters()).dtype}, "
        f"cuda alloc after load = {torch.cuda.memory_allocated() / 2**30:.2f} GiB")

    pipeline = StableMVDiffusionPipeline(
        text_encoder=text_encoder, tokenizer=tok, vae=vae, unet=unet, scheduler=scheduler
    )
    pipeline.set_progress_bar_config(disable=False)

    # ---------------------------------------------------------------- cameras
    # Exactly src/infer_gsdiff_sd.py: 4 orbit views at azimuth 0/90/180/270, elevation
    # `--elevation`, radius 1.4, normalised intrinsics (cx=cy=0.5), OpenGL world -> OpenCV C2W.
    fxfycxcy = torch.tensor([opt.fxfy, opt.fxfy, 0.5, 0.5], device=dev).float()
    elevations = torch.tensor([-args.elevation] * args.num_views, device=dev).deg2rad().float()
    azimuths = torch.tensor([0.0, 90.0, 180.0, 270.0], device=dev).deg2rad().float()
    radius = torch.tensor([args.distance] * args.num_views, device=dev).float()
    input_C2W = orbit_camera(elevations, azimuths, radius, is_degree=False)
    input_C2W[:, :3, 1:3] *= -1  # OpenGL -> OpenCV
    input_fxfycxcy = fxfycxcy.unsqueeze(0).repeat(args.num_views, 1)
    plucker, _ = plucker_ray(args.res, args.res, input_C2W.unsqueeze(0), input_fxfycxcy.unsqueeze(0))
    plucker = plucker.squeeze(0)  # (V, 6, H, W)
    if opt.view_concat_condition:
        plucker = torch.cat([plucker[0:1, ...], plucker], dim=0)
    env["camera"] = {
        "views": args.num_views, "azimuth_deg": [0, 90, 180, 270], "elevation_deg": args.elevation,
        "radius": args.distance, "fx_fy_normalized": round(opt.fxfy, 4), "cx_cy": [0.5, 0.5],
        "world_convention": "OpenGL (x right, y up, z back); C2W flipped to OpenCV for geometry",
    }

    # Optional verification renders. `diff_gaussian_rasterization` is the RaDe-GS fork of the
    # 3DGS CUDA extension compiled for sm_61; if setup.sh could not build it, the stub raises
    # and we simply record that no sheet was made.
    rasterizer = "not requested" if args.no_render else "stub"
    render_fn = None
    GaussianModel = None
    if not args.no_render:
        try:
            import diff_gaussian_rasterization as dgr
            if hasattr(dgr, "_C"):  # the compiled sm_61 extension
                from src.models.gs_render.gs_util import GaussianModel as _GM, render as _render
                GaussianModel, render_fn = _GM, _render
                rasterizer = "real"
            else:
                rasterizer = "stub (pure-python placeholder; no verification sheet)"
        except Exception as exc:  # pragma: no cover
            rasterizer = f"unavailable: {type(exc).__name__}: {exc}"
    env["rasterizer"] = rasterizer
    log(f"rasterizer: {rasterizer}")

    # ---------------------------------------------------------------- helpers
    def gaussians_from_image_format(outs: Dict[str, torch.Tensor]):
        """The pre-rasterisation half of src/models/gs_render/gs_renderer.py::render
        (`in_image_format=True`, `input_normalized=True`), returned as flat arrays."""
        rgb, scale, rotation, opacity, depth = (
            outs["rgb"], outs["scale"], outs["rotation"], outs["opacity"], outs["depth"])
        cam_d = torch.linalg.norm(input_C2W[:, :3, 3], ord=2, dim=1)   # (V,) camera distance
        depth = depth + cam_d.view(1, -1, 1, 1, 1)                     # (1,V,1,H,W)
        xyz = unproject_depth(depth.squeeze(2), input_C2W.unsqueeze(0), input_fxfycxcy.unsqueeze(0))
        xyz = xyz + outs.get("offset", torch.zeros_like(xyz))
        flat = lambda t: rearrange(t, "b v c h w -> b (v h w) c")  # noqa: E731
        xyz, rgb = flat(xyz), flat(rgb) * 0.5 + 0.5
        s = flat(scale) * 0.5 + 0.5
        scale = opt.scale_min * s + opt.scale_max * (1.0 - s)          # upstream scale_activation
        opacity = flat(opacity) * 0.5 + 0.5
        rotation = flat(rotation)
        rotation = rotation / rotation.norm(dim=-1, keepdim=True).clamp_min(1e-8)  # see README
        return {k: v[0].detach().float().cpu().numpy() for k, v in
                dict(xyz=xyz, rgb=rgb, scale=scale, rotation=rotation, opacity=opacity).items()}

    def write_ply(path: str, g: Dict[str, np.ndarray]) -> None:
        """Column layout and `compatible=True` activations copied from upstream
        GaussianModel.save_ply: f_dc = (rgb-0.5)/SH_C0, opacity -> logit (eps 1e-6, as
        kiui.op.inverse_sigmoid), scale -> ln(scale + 1e-8), rot_0..3 = (w,x,y,z), plus the
        redundant red/green/blue uint8 columns."""
        xyz, rgb = g["xyz"], g["rgb"]
        f_dc = (rgb - 0.5) / SH_C0
        op = np.clip(g["opacity"], 1e-6, 1 - 1e-6)
        opacity = np.log(op / (1 - op))
        scale = np.log(g["scale"] + 1e-8)
        rot = g["rotation"]
        rgb8 = (rgb * 255.0).clip(0, 255).astype(np.uint8)
        dtype = [(a, "f4") for a in
                 ["x", "y", "z", "f_dc_0", "f_dc_1", "f_dc_2", "opacity",
                  "scale_0", "scale_1", "scale_2", "rot_0", "rot_1", "rot_2", "rot_3"]]
        dtype += [("red", "u1"), ("green", "u1"), ("blue", "u1")]
        elements = np.empty(xyz.shape[0], dtype=dtype)
        elements[:] = list(map(tuple, np.concatenate((xyz, f_dc, opacity, scale, rot, rgb8), axis=1)))
        os.makedirs(os.path.dirname(path), exist_ok=True)
        PlyData([PlyElement.describe(elements, "vertex")]).write(path)

    def contact_sheet(g: Dict[str, np.ndarray], path: str) -> bool:
        if render_fn is None or GaussianModel is None:
            return False
        from PIL import Image
        pc = GaussianModel().set_data(
            torch.from_numpy(g["xyz"]).to(dev), torch.from_numpy(g["rgb"]).to(dev),
            torch.from_numpy(g["scale"]).to(dev), torch.from_numpy(g["rotation"]).to(dev),
            torch.from_numpy(g["opacity"]).to(dev))
        cams = [input_C2W[v] for v in range(args.num_views)]
        azis = np.linspace(0.0, 360.0, args.orbit_frames, endpoint=False)
        e = torch.full((len(azis),), -args.elevation, device=dev).deg2rad().float()
        a = torch.from_numpy(azis.astype("float32")).to(dev).deg2rad()
        r = torch.full((len(azis),), args.distance, device=dev).float()
        orb = orbit_camera(e, a, r, is_degree=False)
        orb[:, :3, 1:3] *= -1
        cams += list(orb)
        tiles = []
        for c2w in cams:
            img = render_fn(pc, args.render_res, args.render_res, c2w, fxfycxcy,
                            opt.znear, opt.zfar, (1.0, 1.0, 1.0), 1.0)["image"]
            arr = (img.clamp(0, 1) * 255).byte().permute(1, 2, 0).cpu().numpy()
            tiles.append(Image.fromarray(arr).convert("RGB"))
        cols = args.num_views
        rows = (len(tiles) + cols - 1) // cols
        sheet = Image.new("RGB", (cols * args.render_res, rows * args.render_res), (255, 255, 255))
        for i, t in enumerate(tiles):
            sheet.paste(t, ((i % cols) * args.render_res, (i // cols) * args.render_res))
        sheet.save(path)
        return True

    # ---------------------------------------------------------------- generate
    rows: List[List[str]] = []
    with open(args.prompts) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#"):
                slug, prompt = line.split("\t", 1)
                rows.append([slug.strip(), prompt.strip()])
    if args.limit:
        rows = rows[: args.limit]
    log(f"prompts: {[r[0] for r in rows]}")

    assets: Dict[str, Any] = {}
    failures: Dict[str, str] = {}
    for slug, prompt in rows:
        torch.cuda.reset_peak_memory_stats()
        t0 = time.time()
        try:
            generator = torch.Generator(device=dev).manual_seed(args.seed)
            with torch.no_grad(), torch.autocast("cuda", gen_dtype):
                latents = pipeline(
                    None, prompt=prompt, negative_prompt=args.negative_prompt,
                    num_inference_steps=args.steps, guidance_scale=args.guidance_scale,
                    triangle_cfg_scaling=False, min_guidance_scale=1.0,
                    max_guidance_scale=args.guidance_scale,
                    output_type="latent", eta=args.eta, generator=generator,
                    plucker=plucker, num_views=args.num_views,
                    init_std=0.0, init_noise_strength=0.98, init_bg=0.0,
                ).images
                latents = latents.float() / gsvae.scaling_factor + gsvae.shift_factor
                outs = gsvae.decode_gslatents(latents)  # chunked (opt.chunk_size = 1)
            g = {k: v for k, v in gaussians_from_image_format(outs).items()}
            if not np.isfinite(g["xyz"]).all() or not np.isfinite(g["rgb"]).all():
                raise RuntimeError("non-finite Gaussian parameters (fp16 overflow?)")
            ply = os.path.join(args.out, "raw", f"{slug}.ply")
            write_ply(ply, g)
            dur = time.time() - t0
            b = g["xyz"]
            keep = g["opacity"] > args.report_opacity
            peak_alloc = torch.cuda.max_memory_allocated()
            peak_resv = torch.cuda.max_memory_reserved()
            rec = {
                "prompt": prompt,
                "seconds": round(dur, 2),
                "splat_count": int(g["xyz"].shape[0]),
                "splat_count_above_report_opacity": int(keep.sum()),
                "report_opacity": args.report_opacity,
                "bounds_min": [round(float(v), 4) for v in b.min(0)],
                "bounds_max": [round(float(v), 4) for v in b.max(0)],
                "extent": [round(float(v), 4) for v in b.max(0) - b.min(0)],
                "opacity_mean": round(float(g["opacity"].mean()), 4),
                "scale_mean_world_units": [round(float(v), 6) for v in g["scale"].mean(0)],
                "ply_bytes": os.path.getsize(ply),
                "vram_peak_allocated_gib": round(peak_alloc / 2**30, 3),
                "vram_peak_reserved_gib": round(peak_resv / 2**30, 3),
                "preview": None,
            }
            sheet = os.path.join(args.out, f"preview-{slug}.png")
            try:
                if contact_sheet(g, sheet):
                    rec["preview"] = os.path.basename(sheet)
            except Exception as exc:
                rec["preview_error"] = f"{type(exc).__name__}: {exc}"
                log(f"  preview failed for {slug}: {rec['preview_error']}")
            assets[slug] = rec
            with open(os.path.join(args.out, "raw", f"{slug}.json"), "w") as fh:
                json.dump(rec, fh, indent=2)
            log(f"{slug}: {dur:.1f}s  {rec['splat_count']} splats  "
                f"extent={rec['extent']}  peak {rec['vram_peak_allocated_gib']} GiB alloc / "
                f"{rec['vram_peak_reserved_gib']} reserved  preview={rec['preview']}")
        except Exception as exc:
            failures[slug] = f"{type(exc).__name__}: {exc}"
            log(f"{slug}: FAILED {failures[slug]}")
            traceback.print_exc()

    sampler.stop()
    summary = {
        "env": env,
        "args": {k: v for k, v in vars(args).items()},
        "assets": assets,
        "failures": failures,
        "vram_peak_allocated_gib_overall": round(torch.cuda.max_memory_allocated() / 2**30, 3),
        "vram_peak_reserved_gib_overall": round(torch.cuda.max_memory_reserved() / 2**30, 3),
        "nvidia_smi_device_wide_peak_mib": sampler.peak_mib,
        "nvidia_smi_samples": len(sampler.samples),
        "total_seconds": round(time.time() - t_start, 1),
    }
    with open(os.path.join(args.out, "metrics.json"), "w") as fh:
        json.dump(summary, fh, indent=2)
    log(f"wrote {os.path.join(args.out, 'metrics.json')}: {len(assets)} assets, "
        f"{len(failures)} failures, total {summary['total_seconds']}s, "
        f"peak {summary['vram_peak_allocated_gib_overall']} GiB allocated "
        f"(device-wide nvidia-smi peak {summary['nvidia_smi_device_wide_peak_mib']} MiB)")
    return 0 if assets and not failures else (1 if not assets else 2)


if __name__ == "__main__":
    sys.exit(main())
