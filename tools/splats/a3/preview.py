# /// script
# requires-python = ">=3.11"
# dependencies = ["numpy"]
# ///
"""Dev-only preview for A3 exports (the deck renderer is not mine to look at yet).

Orthographically projects a 3DGS .ply point set into a PPM with the deck's own tone
mapping — luminance quantised to N steps, stretched between the darkest and lightest
sage tone — so geometry and baked light can be eyeballed offline.

Rewritten here (tools/splats/a2/preview.py is not my file to edit) because the
SyntaxSplat export has no nx/ny/nz columns and I want the luminance histogram.

    uv run tools/splats/a3/preview.py in.ply out.ppm --theta 0.6 --phi 1.05 --hist
    convert out.ppm out.png
"""
import argparse
import math

import numpy as np

SH_C0 = 0.28209479177387814
BG = np.array([0xDC, 0xE3, 0xD2], np.float32)   # lightest tone == the slide page colour
INK = np.array([0x1C, 0x24, 0x19], np.float32)  # darkest tone of the 6-step sage ramp


def read_ply(path):
    with open(path, "rb") as f:
        head, data = f.read().split(b"end_header\n", 1)
    lines = head.decode().splitlines()
    n = int(next(l.split()[-1] for l in lines if l.startswith("element vertex")))
    dt = np.dtype([(l.split()[-1], "<f4") for l in lines if l.startswith("property ")])
    return np.frombuffer(data[: n * dt.itemsize], dt)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("ply")
    ap.add_argument("out")
    ap.add_argument("--theta", type=float, default=0.6, help="azimuth, rad")
    ap.add_argument("--phi", type=float, default=1.05, help="polar from +y, rad")
    ap.add_argument("--size", type=float, default=2.2, help="ortho half-height, world units")
    ap.add_argument("--w", type=int, default=960)
    ap.add_argument("--h", type=int, default=600)
    ap.add_argument("--tones", type=int, default=6)
    ap.add_argument("--gain", type=float, default=3.0, help="splat radius multiplier")
    ap.add_argument("--hist", action="store_true", help="print splat count, extent, luminance percentiles")
    a = ap.parse_args()

    v = read_ply(a.ply)
    p = np.stack([v["x"], v["y"], v["z"]], -1).astype(np.float32)
    rgb = np.clip(np.stack([v["f_dc_0"], v["f_dc_1"], v["f_dc_2"]], -1) * SH_C0 + 0.5, 0, 1)
    lum = rgb @ np.array([0.299, 0.587, 0.114], np.float32)
    sig = np.exp(np.stack([v["scale_0"], v["scale_1"], v["scale_2"]], -1)).max(-1)

    if a.hist:
        q = np.percentile(lum, [1, 5, 25, 50, 75, 95, 99])
        print(f"splats={len(v)}  extent={np.ptp(p, 0).round(3)}  centre={p.mean(0).round(3)}  "
              f"median sigma={np.median(sig):.4f}  lum pct(1,5,25,50,75,95,99)={q.round(3)}")

    dirv = np.array([math.sin(a.phi) * math.sin(a.theta), math.cos(a.phi), math.sin(a.phi) * np.cos(a.theta)], np.float32)
    z = dirv / np.linalg.norm(dirv)
    x = np.cross(np.array([0, 1, 0], np.float32), z)
    x /= np.linalg.norm(x)
    y = np.cross(z, x)
    q = (p - p.mean(0)) @ np.stack([x, y, z], -1)

    scale = a.w / (2 * a.size)
    scale_y = a.h / (2 * a.size)
    px = np.round(q[:, 0] * scale + a.w / 2).astype(np.int64)
    py = np.round(-q[:, 1] * scale_y + a.h / 2).astype(np.int64)
    dep = q[:, 2]

    img = np.zeros((a.h, a.w), np.float32)
    depth = np.full((a.h, a.w), -1e9, np.float32)
    r = np.clip(sig * a.gain * min(scale, scale_y), 1, 14).astype(np.int64)
    m = (px >= 0) & (px < a.w) & (py >= 0) & (py < a.h)
    px, py, dep, lum, r = px[m], py[m], dep[m], lum[m], r[m]
    order = np.argsort(dep)
    px, py, dep, lum, r = px[order], py[order], dep[order], lum[order], r[order]
    for i in range(len(px)):                     # painter's algorithm, box per splat
        x0, x1 = max(0, px[i] - r[i]), min(a.w, px[i] + r[i] + 1)
        y0, y1 = max(0, py[i] - r[i]), min(a.h, py[i] + r[i] + 1)
        blk = depth[y0:y1, x0:x1] <= dep[i]
        img[y0:y1, x0:x1][blk] = lum[i]
        depth[y0:y1, x0:x1][blk] = dep[i]
    seen = depth > -1e9

    t = np.clip(img, 0, 1) ** (1 / 2.2)            # the deck's post shader gamma-encodes first
    if a.tones > 1:
        t = np.floor(t * (a.tones - 1) + 0.5) / (a.tones - 1)
    out = INK + (BG - INK) * t[:, :, None]
    out[~seen] = [10, 12, 40]                   # void: dark blue, never a scene colour
    with open(a.out, "wb") as f:
        f.write(f"P6\n{a.w} {a.h}\n255\n".encode())
        f.write(np.clip(out, 0, 255).astype(np.uint8).tobytes())
    print("wrote", a.out)


if __name__ == "__main__":
    main()
