# /// script
# requires-python = ">=3.11"
# dependencies = ["numpy", "plyfile", "pillow"]
# ///
"""splat-lab g2 · offline preview of a 3DGS .ply (dev helper, not part of the deck).

The deck's splat renderer did not exist while these assets were generated, so this is how the
geometry was eyeballed: an orthographic painter's-algorithm pass that stamps every Gaussian as
an isotropic 2-D blob (radius = mean of its three sigmas), sorted far-to-near, then maps the
result through the deck's post shader look — luminance only, 6-tone sage ramp, Floyd–Steinberg
dither (same ramp as tools/splats/d/sage_preview.py).

It is a *preview*, not the deck's renderer: anisotropy and the exact 3DGS EWA footprint are
ignored, so it reads softer/blobbier than the real render.

    uv run tools/splats/g2/preview.py in.ply out.png --theta 0.6 --phi 1.15
"""
from __future__ import annotations

import argparse
import sys

import numpy as np
from plyfile import PlyData
from PIL import Image

SH_C0 = 0.28209479177387814
RAMP = [(31, 36, 31), (85, 97, 85), (137, 148, 132), (187, 197, 176), (220, 227, 210), (239, 242, 232)]


def sage_quantise(lum: np.ndarray, tones: int) -> np.ndarray:
    """Floyd–Steinberg on luminance in [0,1], then map through the ramp (dark index 0 = ink)."""
    err = lum.copy()
    h, w = err.shape
    out = np.zeros((h, w), dtype=np.int64)
    scale = tones - 1
    for y in range(h):
        row = err[y]
        for x in range(w):
            old = row[x]
            new = min(max(int(round(old * scale)), 0), scale)
            out[y, x] = new
            e = old - new / scale
            if x + 1 < w:
                row[x + 1] += e * 7 / 16
            if y + 1 < h:
                if x > 0:
                    err[y + 1, x - 1] += e * 3 / 16
                err[y + 1, x] += e * 5 / 16
                if x + 1 < w:
                    err[y + 1, x + 1] += e / 16
    return out


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("src")
    ap.add_argument("dst")
    ap.add_argument("--raw", default=None, help="also write the un-quantised RGB render here")
    ap.add_argument("--size", type=int, default=512)
    ap.add_argument("--view", type=float, default=2.2, help="ortho half-height in world units")
    ap.add_argument("--theta", type=float, default=0.6, help="azimuth, radians (three.js spherical)")
    ap.add_argument("--phi", type=float, default=1.15, help="polar angle from +y, radians")
    ap.add_argument("--radius", type=float, default=8.0)
    ap.add_argument("--stride", type=int, default=2, help="use every Nth splat (speed)")
    ap.add_argument("--tones", type=int, default=6)
    ap.add_argument("--bg", type=float, default=1.0)
    args = ap.parse_args()

    v = PlyData.read(args.src).elements[0]
    g = lambda name: np.asarray(v[name], dtype=np.float64)                    # noqa: E731
    pts = np.stack([g("x"), g("y"), g("z")], axis=1)[:: args.stride]
    f_dc = np.stack([g("f_dc_0"), g("f_dc_1"), g("f_dc_2")], axis=1)[:: args.stride]
    op = 1.0 / (1.0 + np.exp(-g("opacity")))[:: args.stride]
    sig = np.exp(np.stack([g("scale_0"), g("scale_1"), g("scale_2")], axis=1))[:: args.stride]
    rgb = (f_dc * SH_C0 + 0.5).clip(0, 1)

    # camera position from spherical angles (three.js convention), OpenGL basis, look-at origin
    sp, cp = np.sin(args.phi), np.cos(args.phi)
    pos = args.radius * np.array([sp * np.sin(args.theta), cp, sp * np.cos(args.theta)])
    zc = pos / np.linalg.norm(pos)
    up = np.array([0.0, 1.0, 0.0])
    if abs(float(np.dot(zc, up))) > 0.999:
        up = np.array([0.0, 0.0, 1.0])
    xc = np.cross(up, zc)
    xc /= np.linalg.norm(xc)
    yc = np.cross(zc, xc)

    N = pts.shape[0]
    rel = pts - pos
    # OpenGL basis: the camera looks along -z_cam, so view depth is -(rel . z_cam).
    cam = np.stack([rel @ xc, rel @ yc, -(rel @ zc)], axis=1)             # (N,3) camera coords
    depth = cam[:, 2]
    px_per_unit = args.size / (2 * args.view)
    u = args.size / 2 + cam[:, 0] * px_per_unit
    vv = args.size / 2 - cam[:, 1] * px_per_unit
    r = sig.mean(axis=1) * px_per_unit

    img = np.full((args.size, args.size, 3), args.bg, dtype=np.float64)
    order = np.argsort(-depth)                                       # far -> near
    lim = max(1, int(0.25 * args.size))
    for i in order:
        if depth[i] <= 1e-4 or op[i] <= 0.004:
            continue
        rad = min(max(r[i], 0.6), lim)
        n = int(np.ceil(2.4 * rad))
        cx, cy = int(round(u[i])), int(round(vv[i]))
        x0, x1 = max(cx - n, 0), min(cx + n + 1, args.size)
        y0, y1 = max(cy - n, 0), min(cy + n + 1, args.size)
        if x0 >= x1 or y0 >= y1:
            continue
        gy, gx = np.mgrid[y0:y1, x0:x1]
        d2 = (gx - u[i]) ** 2 + (gy - vv[i]) ** 2
        a = (op[i] * np.exp(-0.5 * d2 / (rad * rad)))[..., None]
        img[y0:y1, x0:x1] = rgb[i] * a + img[y0:y1, x0:x1] * (1 - a)

    lum = 0.2126 * img[..., 0] + 0.7152 * img[..., 1] + 0.0722 * img[..., 2]
    if args.raw:
        Image.fromarray((img.clip(0, 1) * 255).astype(np.uint8)).save(args.raw)
    idx = sage_quantise(lum.clip(0, 1), args.tones)
    ramp = np.array(RAMP[: args.tones], dtype=np.uint8)
    Image.fromarray(ramp[idx]).save(args.dst)
    print(f"{args.src} -> {args.dst}: {N} splats drawn, {args.size}px, theta={args.theta} phi={args.phi}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
