# /// script
# requires-python = ">=3.10"
# dependencies = ["numpy", "plyfile", "pillow"]
# ///
"""Look at a 3DGS .ply without a renderer: stats + an orthographic contact sheet.

Three painter's-algorithm projections, left to right: looking down the -Y axis (top view),
along -Z (front) and along +X (side). Colour = the DC spherical-harmonic term converted to RGB,
alpha = sigmoid(opacity). Only luminance matters for the deck (the post shader throws hue away),
which is exactly what this sheet shows — it is a *check* image for orientation + cropping, not
a render of the deck's pipeline.

    uv run tools/splats/g3/probe.py scene.ply --out /tmp/probe.png [--flipx]
`--flipx` previews the 180°-about-X transform (COLMAP +y-down -> deck +y-up) before packing.
"""
from __future__ import annotations

import argparse
from pathlib import Path

import numpy as np
from plyfile import PlyData

SH_C0 = 0.28209479177387814
VIEWS = [("top  (-Y)", 0, 1, 2), ("front (-Z)", 0, 2, 1), ("side (+X)", 2, 1, 0)]


def main() -> int:
    from PIL import Image, ImageDraw

    ap = argparse.ArgumentParser()
    ap.add_argument("ply")
    ap.add_argument("--out", default="/tmp/probe.png")
    ap.add_argument("--size", type=int, default=420)
    ap.add_argument("--flipx", action="store_true", help="preview a 180 deg rotation about X")
    ap.add_argument("--centre", default=None, help="only draw splats within --radius of this x,y,z")
    ap.add_argument("--radius", type=float, default=None)
    args = ap.parse_args()

    ply = PlyData.read(args.ply)
    v = ply["vertex"]
    p = np.stack([v["x"], v["y"], v["z"]], axis=1).astype(np.float64)
    if args.flipx:
        p = p * np.array([1.0, -1.0, -1.0])
    op = 1.0 / (1.0 + np.exp(-np.asarray(v["opacity"], dtype=np.float64)))
    rgb = np.clip(np.stack([v["f_dc_0"], v["f_dc_1"], v["f_dc_2"]], axis=1) * SH_C0 + 0.5, 0, 1)

    lum = rgb @ np.array([0.2126, 0.7152, 0.0722])
    keep = op > 0.05
    sub = np.ones(len(p), bool)
    if args.centre:
        c = np.array([float(x) for x in args.centre.split(",")])
        sub = np.linalg.norm(p - c, axis=1) <= (args.radius or 3.0)
        print(f"window: |p - {np.round(c, 2).tolist()}| <= {args.radius or 3.0} -> {int(sub.sum())} splats")
    print(f"{args.ply}: {len(p)} splats, {int(keep.sum())} with opacity>0.05")
    for name, sel in (("all", sub), ("kept", keep & sub)):
        q = p[sel]
        if not len(q):
            continue
        ext = q.max(0) - q.min(0)
        print(f"  {name}: centre={np.round(q.mean(0), 3).tolist()} "
              f"extent={np.round(ext, 3).tolist()} "
              f"lum p5/p50/p95={np.percentile(lum[sel], [5, 50, 95]).round(2).tolist()} "
              f"opacity p50/p95={np.percentile(op[sel], [50, 95]).round(2).tolist()}")
    if "f_rest_0" in v.data.dtype.names:
        print("  NOTE: file carries f_rest (SH>0)")

    W = H = args.size
    tile = W * 3
    canvas = np.ones((H, tile, 3), np.uint8) * 40
    col8 = (rgb * 255).astype(np.uint8)
    for i, (label, a, b, d) in enumerate(VIEWS):
        pts = p[keep & sub]
        if not len(pts):
            continue
        lo, hi = pts.min(0), pts.max(0)
        span = max(hi[a] - lo[a], hi[b] - lo[b], 1e-9)
        u = ((pts[:, a] - lo[a]) / span * (W - 1)).astype(int)
        vv = ((pts[:, b] - lo[b]) / span * (H - 1)).astype(int)
        order = np.argsort(-pts[:, d])  # far first
        img = np.zeros((H, W, 3), np.uint8)
        img[vv[order], u[order]] = col8[keep & sub][order]
        canvas[:, i * W:(i + 1) * W] = img
    im = Image.fromarray(canvas)
    draw = ImageDraw.Draw(im)
    for i, (label, _, _, _) in enumerate(VIEWS):
        draw.text((i * W + 6, 6), label, fill=(255, 255, 0))
    Path(args.out).parent.mkdir(parents=True, exist_ok=True)
    im.save(args.out)
    print("wrote", args.out)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
