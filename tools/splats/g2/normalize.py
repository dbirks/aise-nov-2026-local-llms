# /// script
# requires-python = ">=3.11"
# dependencies = ["numpy", "plyfile"]
# ///
"""splat-lab g2 · normalise a DiffSplat export to the deck's asset convention.

The deck expects every splat asset centred on the origin, y-up, largest extent ~= 4 world units
(default ortho view half-height 2.2). A raw DiffSplat .ply is *already* y-up (the project works
in an OpenGL world: x right, y up, z toward the viewer, camera orbiting the origin at radius
1.4), but it is only ~0.7 units across and carries the usual feed-forward floaters, so we:

  1. drop splats with opacity <= --min-opacity (logit column, inverse-sigmoid'd back to [0,1]);
  2. take a robust bounding box (percentiles 0.5/99.5 per axis, then grown by --margin of the
     per-axis extent) and drop everything outside it, so a few far floaters cannot shrink the
     whole object when it is rescaled;
  3. re-centre on the box centre and scale so the largest extent = --extent (default 4.0);
  4. scale the three sigma columns by the same factor (positions scale, so sizes must too);
  5. re-normalise the quaternions (unit norm is part of the 3DGS definition; the decoder output
     is only approximately unit) and clip opacity to (0,1) before writing its logit back.

Rotation and handedness are untouched: no mirroring, no axis swap.

    uv run tools/splats/g2/normalize.py raw.ply out.ply --report report.json
"""
from __future__ import annotations

import argparse
import json
import os
import sys

import numpy as np
from plyfile import PlyData, PlyElement

SH_C0 = 0.28209479177387814
COLUMNS = ["x", "y", "z", "f_dc_0", "f_dc_1", "f_dc_2", "opacity",
           "scale_0", "scale_1", "scale_2", "rot_0", "rot_1", "rot_2", "rot_3"]


def cols(d: np.ndarray, names: list[str]) -> np.ndarray:
    """Structured array -> float64 (N, len(names)); d[names] would stay void-typed."""
    return np.stack([np.asarray(d[n], dtype=np.float64) for n in names], axis=1)


def load(path: str) -> np.ndarray:
    ply = PlyData.read(path)
    v = ply.elements[0]
    need = COLUMNS + ["red", "green", "blue"]
    missing = [c for c in need if c not in v.data.dtype.names]
    if missing:
        sys.exit(f"{path}: missing columns {missing} (expected a DiffSplat/3DGS ply)")
    return np.asarray(v.data).copy()


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("src")
    ap.add_argument("dst")
    ap.add_argument("--extent", type=float, default=4.0, help="target largest extent, world units")
    ap.add_argument("--min-opacity", type=float, default=0.02, help="drop splats below this opacity")
    ap.add_argument("--percentile", type=float, default=0.5, help="robust box percentile, percent")
    ap.add_argument("--margin", type=float, default=0.15, help="grow the robust box by this fraction per axis")
    ap.add_argument("--report", default=None, help="write the before/after stats as json")
    args = ap.parse_args()

    d = load(args.src)
    n0 = d.shape[0]
    xyz = cols(d, ["x", "y", "z"])
    rgb = cols(d, ["f_dc_0", "f_dc_1", "f_dc_2"]) * SH_C0 + 0.5
    opacity = 1.0 / (1.0 + np.exp(-np.asarray(d["opacity"], dtype=np.float64)))   # logit -> p
    sigma = np.exp(cols(d, ["scale_0", "scale_1", "scale_2"]))                     # log -> world units
    quat = cols(d, ["rot_0", "rot_1", "rot_2", "rot_3"])

    keep = opacity > args.min_opacity
    xyz_k, rgb_k, op_k, sig_k, q_k = (t[keep] for t in (xyz, rgb, opacity, sigma, quat))
    p = args.percentile
    lo = np.percentile(xyz_k, p, axis=0)
    hi = np.percentile(xyz_k, 100.0 - p, axis=0)
    span = np.maximum(hi - lo, 1e-6)
    lo -= args.margin * span
    hi += args.margin * span
    inside = np.all((xyz_k >= lo) & (xyz_k <= hi), axis=1)
    xyz_k, rgb_k, op_k, sig_k, q_k = (t[inside] for t in (xyz_k, rgb_k, op_k, sig_k, q_k))

    centre = 0.5 * (xyz_k.min(axis=0) + xyz_k.max(axis=0))
    extent = (xyz_k.max(axis=0) - xyz_k.min(axis=0)).max()
    factor = args.extent / float(extent)

    xyz_k = (xyz_k - centre) * factor
    sig_k = sig_k * factor
    q_k = q_k / np.linalg.norm(q_k, axis=1, keepdims=True).clip(min=1e-9)
    op_k = np.clip(op_k, 1e-6, 1 - 1e-6)
    rgb_k = np.clip(rgb_k, 0.0, 1.0)

    n = xyz_k.shape[0]
    out_dtype = [(c, "f4") for c in COLUMNS] + [("red", "u1"), ("green", "u1"), ("blue", "u1")]
    elements = np.empty(n, dtype=out_dtype)
    f_dc = (rgb_k - 0.5) / SH_C0
    logit = np.log(op_k / (1 - op_k))
    log_sigma = np.log(sig_k)
    rgb8 = (rgb_k * 255.0).clip(0, 255).astype(np.uint8)
    columns = np.concatenate((
        xyz_k.astype(np.float32), f_dc.astype(np.float32), logit.astype(np.float32)[:, None],
        log_sigma.astype(np.float32), q_k.astype(np.float32), rgb8), axis=1)
    elements[:] = list(map(tuple, columns))
    if os.path.dirname(args.dst):
        os.makedirs(os.path.dirname(args.dst), exist_ok=True)
    PlyData([PlyElement.describe(elements, "vertex")]).write(args.dst)

    rep = {
        "src": args.src, "dst": args.dst,
        "splats_in": int(n0),
        "dropped_low_opacity": int(n0 - keep.sum()),
        "dropped_outside_robust_box": int(int(keep.sum()) - n),
        "splats_out": int(n),
        "min_opacity": args.min_opacity, "percentile": args.percentile, "margin": args.margin,
        "raw_extent": [float(v) for v in (xyz.max(0) - xyz.min(0))],
        "robust_extent": [float(v) for v in span],
        "scale_factor": factor,
        "final_extent": [float(v) for v in (xyz_k.max(0) - xyz_k.min(0))],
        "opacity_mean": float(op_k.mean()), "opacity_p50": float(np.percentile(op_k, 50)),
        "sigma_mean_world": [float(v) for v in sig_k.mean(0)],
        "luminance_mean": float((0.2126 * rgb_k[:, 0] + 0.7152 * rgb_k[:, 1] + 0.0722 * rgb_k[:, 2]).mean()),
        "y_up": True, "handedness": "x right, y up, z toward viewer (unchanged from DiffSplat)",
    }
    print(json.dumps(rep, indent=2))
    if args.report:
        with open(args.report, "w") as fh:
            json.dump(rep, fh, indent=2)
    return 0


if __name__ == "__main__":
    sys.exit(main())
