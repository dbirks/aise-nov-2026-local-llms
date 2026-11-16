# /// script
# requires-python = ">=3.11"
# dependencies = ["numpy"]
# ///
"""Offline preview for A2 bakes (dev-only helper): orthographically project a
3DGS .ply point set into a PPM, luminance-quantised to a 6-tone ramp, so the
geometry can be eyeballed before the deck renderer exists.

    uv run tools/splats/a2/preview.py in.ply out.ppm --theta 0.6 --phi 1.1
    convert out.ppm out.png
"""
import argparse
import math

import numpy as np

SH_C0 = 0.28209479177387814
BG = np.array([0xDC, 0xE3, 0xD2], np.float32)
INK = np.array([0x1C, 0x24, 0x19], np.float32)  # darkest tone of the 6-step sage ramp


def read_ply(path):
    with open(path, "rb") as f:
        buf = f.read()
    head, data = buf.split(b"end_header\n", 1)
    lines = head.decode().splitlines()
    n = int(next(l.split()[-1] for l in lines if l.startswith("element vertex")))
    props = [l.split()[-1] for l in lines if l.startswith("property ")]
    return np.frombuffer(data[: n * np.dtype([(p, "<f4") for p in props]).itemsize],
                         np.dtype([(p, "<f4") for p in props]))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("ply")
    ap.add_argument("out")
    ap.add_argument("--theta", type=float, default=0.6, help="azimuth, rad")
    ap.add_argument("--phi", type=float, default=1.1, help="polar from +y, rad")
    ap.add_argument("--size", type=float, default=2.2, help="ortho half-height")
    ap.add_argument("--w", type=int, default=900)
    ap.add_argument("--tones", type=int, default=6)
    ap.add_argument("--gain", type=float, default=2.5, help="splat radius multiplier for a solid preview")
    a = ap.parse_args()

    v = read_ply(a.ply)
    p = np.stack([v["x"], v["y"], v["z"]], -1).astype(np.float32)
    lum = np.clip(np.stack([v["f_dc_0"], v["f_dc_1"], v["f_dc_2"]], -1) * SH_C0 + 0.5, 0, 1).mean(-1)
    sig = np.exp(np.stack([v["scale_0"], v["scale_1"], v["scale_2"]], -1)).max(-1)

    dirv = np.array([math.sin(a.phi) * math.sin(a.theta), math.cos(a.phi),
                     math.sin(a.phi) * math.cos(a.theta)], np.float32)
    z = dirv / np.linalg.norm(dirv)
    x = np.cross(np.array([0, 1, 0], np.float32), z)
    x /= np.linalg.norm(x)
    y = np.cross(z, x)
    q = (p - p.mean(0)) @ np.stack([x, y, z], -1)

    scale = a.w / (2 * a.size)
    px = np.round(q[:, 0] * scale + a.w / 2).astype(np.int64)
    py = np.round(-q[:, 1] * scale + a.w / 2).astype(np.int64)
    rad = np.clip(np.round(sig * scale * a.gain).astype(np.int64), 1, 8)

    buf = np.full(a.w * a.w, -1.0, np.float32)
    order = np.argsort(q[:, 2])  # far to near: nearer splats paint over
    offs = [(dx, dy) for dx in range(-8, 9) for dy in range(-8, 9)
            if math.hypot(dx, dy) <= 8.5]
    for r in range(int(rad.max()) + 1):
        for dx, dy in offs:
            if math.hypot(dx, dy) > r + 0.4 or math.hypot(dx, dy) < r - 0.6:
                continue
            sel = order[rad[order] >= r]
            cx, cy = px[sel] + dx, py[sel] + dy
            ok = (cx >= 0) & (cx < a.w) & (cy >= 0) & (cy < a.w)
            buf[cy[ok] * a.w + cx[ok]] = lum[sel][ok]
    buf = buf.reshape(a.w, a.w)

    tones = np.linspace(0, 1, a.tones + 2)[1:-1]  # levels, dark -> light
    idx = np.clip(np.digitize(buf, tones), 0, a.tones - 1)
    canvas = np.zeros((a.w, a.w, 3), np.float32)
    mask = buf >= 0
    for t in range(a.tones):
        col = INK + (BG - INK) * tones[t]
        canvas[mask & (idx == t)] = col
    canvas[~mask] = BG
    with open(a.out, "wb") as f:
        f.write(f"P6\n{a.w} {a.w}\n255\n".encode())
        f.write(np.clip(canvas, 0, 255).astype(np.uint8).tobytes())
    print(f"{a.ply}: {len(p)} splats, max radius {rad.max()} px -> {a.out}")


if __name__ == "__main__":
    main()
