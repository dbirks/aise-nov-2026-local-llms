# /// script
# requires-python = ">=3.10"
# dependencies = ["numpy", "plyfile"]
# ///
"""Crop a trained 3DGS .ply to its subject and normalise it for the deck.

Trained scenes come with a shell of low-opacity "fog" and distant floaters (COLMAP background
points that became splats). This drops them, then centres what is left on the origin and scales it
so the largest extent is `--extent` world units — the deck's default ortho view (size 2.2) then
frames it. Positions only: the splat ellipses/quaternions are untouched (centring + uniform scale
commute with them; rotation is left to `splat-transform -r` so it can rotate SH coefficients too).

    uv run tools/splats/g3/crop.py in.ply --out out.ply [--centre x,y,z --radius R | --auto] \
        [--min-opacity 0.10] [--extent 4.0] [--stats-out crop.json]
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

import numpy as np
from plyfile import PlyData, PlyElement

SH_C0 = 0.28209479177387814


def sigmoid(x: np.ndarray) -> np.ndarray:
    return 1.0 / (1.0 + np.exp(-x))


def robust_centre(p: np.ndarray, w: np.ndarray, rounds: int = 4, mult: float = 2.0):
    """Iteratively shrink to the dense core of the cloud (opacity-weighted).

    Returns (centre, radius) where radius is 1.25x the 90th-percentile distance from the centre
    inside the final core — enough to keep the subject and drop the distant floaters/fog shell.
    """
    c = np.average(p, axis=0, weights=np.clip(w, 1e-4, None))
    r = float(np.percentile(np.linalg.norm(p - c, axis=1), 90))
    for _ in range(rounds):
        d = np.linalg.norm(p - c, axis=1)
        r = float(np.percentile(d, 90))
        keep = d <= max(r * mult, 1e-6)
        if keep.sum() < 200:
            break
        c = np.average(p[keep], axis=0, weights=np.clip(w[keep], 1e-4, None))
    d = np.linalg.norm(p - c, axis=1)
    return c, float(np.percentile(d[d <= max(r * mult, 1e-6)], 90) * 1.25)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("ply")
    ap.add_argument("--out", required=True)
    ap.add_argument("--centre", default=None, help="x,y,z crop centre (default: --auto)")
    ap.add_argument("--radius", type=float, default=None, help="crop radius (default: auto)")
    ap.add_argument("--box", default=None,
                    help="axis-aligned crop box xmin,ymin,zmin,xmax,ymax,zmax (input frame) instead of a sphere")
    ap.add_argument("--auto", action="store_true", help="estimate centre+radius from splat density")
    ap.add_argument("--min-opacity", type=float, default=0.10, help="drop splats below this alpha")
    ap.add_argument("--extent", type=float, default=4.0, help="target largest extent, world units")
    ap.add_argument("--shift", default=None,
                    help="override the centring shift x,y,z (use the final asset's, so a checkpoint lines up)")
    ap.add_argument("--scale", type=float, default=None, help="override the normalising scale")
    ap.add_argument("--stats-out", default=None)
    args = ap.parse_args()

    ply = PlyData.read(args.ply)
    v = ply["vertex"]
    names = v.data.dtype.names
    p = np.stack([v["x"], v["y"], v["z"]], axis=1).astype(np.float64)
    a = sigmoid(np.asarray(v["opacity"], dtype=np.float64))

    if args.centre:
        centre = np.array([float(x) for x in args.centre.split(",")])
        auto_r = None
    else:
        centre, auto_r = robust_centre(p, a)
    d = np.linalg.norm(p - centre, axis=1)
    if args.box:
        b = np.array([float(x) for x in args.box.split(",")]).reshape(2, 3)
        inside = np.all((p >= b[0]) & (p <= b[1]), axis=1)
        print(f"crop: box {b[0].round(3).tolist()} .. {b[1].round(3).tolist()} "
              f"min_opacity={args.min_opacity}")
        keep = (a >= args.min_opacity) & inside
        n_out = int((~inside).sum())
        radius = None
    else:
        radius = args.radius if args.radius is not None else auto_r
        if radius is None:
            raise SystemExit("--centre given without --radius: pass both")
        print(f"crop: centre={np.round(centre, 3).tolist()} radius={radius:.3f} "
              f"min_opacity={args.min_opacity}")
        keep = (a >= args.min_opacity) & (d <= radius)
        n_out = int((d > radius).sum())

    if not keep.any():
        raise SystemExit("empty crop: nothing kept — loosen --box/--radius / --min-opacity")
    print(f"  {len(p)} -> {int(keep.sum())} splats kept "
          f"({int((a < args.min_opacity).sum())} faded, {n_out} outside the crop)")

    p2 = p[keep]
    lo, hi = p2.min(axis=0), p2.max(axis=0)
    mid = (lo + hi) / 2.0
    span = float((hi - lo).max())
    scale = args.extent / span if span > 0 else 1.0
    if args.shift:
        mid = -np.array([float(x) for x in args.shift.split(",")])   # shift is the applied translation (= -mid)
    if args.scale:
        scale = args.scale
    p2 = (p2 - mid) * scale
    print(f"  centred by {np.round(-mid, 3).tolist()}, scaled {scale:.5f} "
          f"(extent {span:.3f} -> {args.extent} units)")

    out = v.data[keep]
    for i, col in enumerate(("x", "y", "z")):
        out[col] = p2[:, i].astype(out[col].dtype)
    Path(args.out).parent.mkdir(parents=True, exist_ok=True)
    PlyData([PlyElement.describe(out, "vertex")]).write(args.out)
    q = np.clip(np.stack([v["f_dc_0"], v["f_dc_1"], v["f_dc_2"]], axis=1)[keep] * SH_C0 + 0.5, 0, 1)
    lum = q @ np.array([0.2126, 0.7152, 0.0722])
    stats = {
        "input": str(args.ply),
        "out": str(args.out),
        "splats_in": int(len(p)),
        "splats_out": int(keep.sum()),
        "centre": centre.round(4).tolist(),
        "box": [round(float(x), 4) for x in args.box.split(",")] if args.box else None,
        "radius": None if args.box else round(radius, 4),
        "min_opacity": args.min_opacity,
        "shift": (-mid).round(4).tolist(),
        "scale": round(scale, 6),
        "extent_units": args.extent,
        "kept_lum_p5_p50_p95": [round(float(x), 3) for x in np.percentile(lum, [5, 50, 95])],
        "has_f_rest": bool("f_rest_0" in names),
    }
    print(f"  kept luminance p5/p50/p95 = {stats['kept_lum_p5_p50_p95']}"
          + ("  [WARNING: f_rest present -> SH coefficients are dropped by SPZ/rotation]"
             if stats["has_f_rest"] else ""))
    if args.stats_out:
        Path(args.stats_out).write_text(json.dumps(stats, indent=2) + "\n")
        print("wrote", args.stats_out)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
