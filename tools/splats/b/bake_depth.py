# /// script
# requires-python = ">=3.11"
# dependencies = ["torch", "transformers", "pillow", "numpy", "plyfile"]
# ///
"""Method B — photo → monocular relative depth (CPU) → 3D Gaussian splats.

Depth Anything V2 Small (Apache-2.0) estimates per-pixel *relative* depth on CPU;
each pixel is unprojected through a pinhole camera into a 3D Gaussian (a 2.5D
relief: one viewpoint, no hidden surfaces). Output is a standard 3DGS binary .ply.

Run (uv only):
  uv run --index https://download.pytorch.org/whl/cpu \
         --extra-index-url https://pypi.org/simple \
         tools/splats/b/bake_depth.py --in tools/splats/b/inputs/gpu.jpg \
         --out /tmp/gpu.ply --metrics /tmp/gpu.json

Timings and peak RSS are measured, not estimated.
"""
from __future__ import annotations

import argparse
import json
import math
import resource
import time
from pathlib import Path

import numpy as np


def peak_rss_mb() -> float:
    # ru_maxRSS is KiB on Linux.
    return resource.getrusage(resource.RUSAGE_SELF).ru_maxrss / 1024.0


def write_ply(path: str, arr: np.ndarray) -> None:
    from plyfile import PlyData, PlyElement

    names = ["x", "y", "z", "nx", "ny", "nz", "f_dc_0", "f_dc_1", "f_dc_2",
             "opacity", "scale_0", "scale_1", "scale_2", "rot_0", "rot_1", "rot_2", "rot_3"]
    el = np.empty(len(arr), dtype=[(n, "f4") for n in names])
    for i, n in enumerate(names):
        el[n] = arr[:, i].astype(np.float32)
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    PlyData([PlyElement.describe(el, "vertex")], text=False).write(path)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--in", dest="inp", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--model", default="depth-anything/Depth-Anything-V2-Small-hf")
    ap.add_argument("--max-side", type=int, default=768, help="resize longest side to this (<=768 px)")
    ap.add_argument("--stride", type=int, default=2, help="1 splat per stride x stride pixel block")
    ap.add_argument("--fov", type=float, default=50.0, help="FOV in degrees across the long image side")
    ap.add_argument("--near", type=float, default=2.0, help="camera distance of the nearest pixel")
    ap.add_argument("--depth-range", dest="drange", type=float, default=1.5)
    ap.add_argument("--drop-far", type=float, default=0.05, help="fraction of farthest pixels dropped")
    ap.add_argument("--extent", type=float, default=4.0, help="normalised largest extent in world units")
    ap.add_argument("--flip", choices=["no", "yes", "auto"], default="no",
                    help="invert the relative map (default no: Depth Anything is disparity-like)")
    ap.add_argument("--threads", type=int, default=4)
    ap.add_argument("--metrics", default=None)
    ap.add_argument("--depth-png", default=None, help="optional debug: save the normalised depth map")
    args = ap.parse_args()

    import torch
    torch.set_num_threads(max(1, args.threads))

    from PIL import Image

    t = {}

    img = Image.open(args.inp).convert("RGB")
    src_size = img.size
    scale = min(1.0, args.max_side / max(img.size))
    if scale < 1.0:
        img = img.resize((round(img.width * scale), round(img.height * scale)), Image.LANCZOS)
    W, H = img.size

    t0 = time.perf_counter()
    from transformers import pipeline
    pipe = pipeline(task="depth-estimation", model=args.model)
    t["model_load_s"] = time.perf_counter() - t0

    t0 = time.perf_counter()
    out = pipe(img)
    raw = out["predicted_depth"] if "predicted_depth" in out else out["depth"]
    dep = np.asarray(raw.detach().cpu().numpy() if hasattr(raw, "detach") else raw, dtype=np.float32)
    t["depth_s"] = time.perf_counter() - t0
    if dep.shape != (H, W):  # the HF processor may return its native grid
        u8 = np.clip(255.0 * (dep - dep.min()) / max(1e-6, float(np.ptp(dep))), 0, 255).astype(np.uint8)
        dep = np.asarray(Image.fromarray(u8).resize((W, H), Image.BILINEAR), dtype=np.float32) / 255.0

    # --- orient the relative map so that "closeness" is large near the camera ---
    # Depth Anything V2's relative output is disparity-like (larger value = closer to
    # the camera); the HF model card states this convention. Polarity is therefore NOT
    # inferred from the frame border by default -- a corridor/aisle photo has *near*
    # objects in the border, so a "border = background" heuristic mis-fires. Use
    # --flip yes only if a specific image needs the opposite mapping.
    m = max(2, min(W, H) // 25)
    ring = float(np.mean(np.concatenate([dep[:m].ravel(), dep[-m:].ravel(),
                                         dep[:, :m].ravel(), dep[:, -m:].ravel()])))
    ch, cw = H // 3, W // 3
    core = float(np.mean(dep[H // 2 - ch // 2: H // 2 + ch // 2,
                             W // 2 - cw // 2: W // 2 + cw // 2]))
    flipped = args.flip == "yes" or (args.flip == "auto" and core < ring)
    close = -dep if flipped else dep
    close = (close - close.min()) / max(1e-6, float(np.ptp(close)))   # d_norm, 1 = closest

    # --- camera distance, then pinhole unprojection (z = near + (1-d_norm)*range) ---
    z = args.near + (1.0 - close) * args.drange
    f = 0.5 * max(W, H) / math.tan(math.radians(args.fov) / 2.0)      # focal, px
    cx, cy = (W - 1) / 2.0, (H - 1) / 2.0
    s = max(1, args.stride)

    t0 = time.perf_counter()
    rgb = np.asarray(img, dtype=np.float32) / 255.0

    hs, ws = H // s, W // s
    r_ = rgb[:hs * s, :ws * s].reshape(hs, s, ws, s, 3).mean(axis=(1, 3))
    c_ = close[:hs * s, :ws * s].reshape(hs, s, ws, s).mean(axis=(1, 3))
    z_ = args.near + (1.0 - c_) * args.drange

    vv, uu = np.mgrid[0:hs, 0:ws]
    v = (vv * s + (s - 1) / 2.0 - cy)
    u = (uu * s + (s - 1) / 2.0 - cx)
    xw = u * z_ / f                # right
    yw = -v * z_ / f               # image y is down -> world y is up
    zw = -z_                       # camera looks along -Z in a y-up right-handed frame

    keep = z_ <= np.quantile(z_, 1.0 - args.drop_far)          # drop the farthest slice
    keep &= z_ > 0
    P = np.stack([xw[keep], yw[keep], zw[keep]], axis=1).astype(np.float32)
    C = r_[keep]
    n_all = hs * ws
    n_kept = int(keep.sum())

    # normalise: centre on the origin, y-up, largest extent == args.extent
    lo, hi = P.min(axis=0), P.max(axis=0)
    mid = (lo + hi) / 2.0
    ext = hi - lo
    k = args.extent / float(ext.max())
    P = (P - mid) * k
    ext_n = ext * k

    # Gaussian size ~ the pixel footprint of one source block at that depth.
    step = (z_[keep] / f) * s * k
    sig_xy = step * 0.70
    sig_z = step * 0.20
    logit = math.log(0.9 / 0.1)
    shc = (C - 0.5) / 0.28209479
    rot = np.zeros((n_kept, 4), dtype=np.float32)
    rot[:, 0] = 1.0                     # identity: discs face the lift camera

    arr = np.concatenate([
        P,
        np.zeros((n_kept, 3), dtype=np.float32),
        shc,
        np.full((n_kept, 1), logit, dtype=np.float32),
        np.stack([np.log(np.maximum(sig_xy, 1e-6)), np.log(np.maximum(sig_xy, 1e-6)),
                  np.log(np.maximum(sig_z, 1e-6))], axis=1),
        rot,
    ], axis=1).astype(np.float32)

    write_ply(args.out, arr)
    t["bake_s"] = time.perf_counter() - t0
    t["peak_rss_mb"] = round(peak_rss_mb(), 1)

    if args.depth_png:
        Image.fromarray((255 * close).astype(np.uint8)).save(args.depth_png)

    m = {
        "input": args.inp, "source_px": list(src_size), "lift_px": [W, H],
        "model": args.model, "stride": s, "fov_deg": args.fov,
        "near": args.near, "depth_range": args.drange,
        "depth_polarity_flipped": bool(flipped), "core": round(core, 4), "ring": round(ring, 4),
        "splats_total": n_all, "splats_kept": n_kept,
        "dropped_far_pct": round(100 * (1 - n_kept / n_all), 2),
        "extent_units": [round(float(e), 3) for e in ext_n],
        "out": args.out,
        "ply_bytes": Path(args.out).stat().st_size,
        "times_s": {k2: round(v2, 2) for k2, v2 in t.items()},
        "torch_threads": args.threads,
    }
    print(json.dumps(m, indent=2))
    if args.metrics:
        Path(args.metrics).parent.mkdir(parents=True, exist_ok=True)
        Path(args.metrics).write_text(json.dumps(m, indent=2) + "\n")


if __name__ == "__main__":
    main()
