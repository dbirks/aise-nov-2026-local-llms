# /// script
# requires-python = ">=3.11"
# dependencies = ["numpy"]
# ///
"""Post-process a SyntaxSplat `.ply` export for the splat lab.

Two jobs, both deterministic and both measured:

1. `--palette-snap <scene.js>` — reproduce the tool's pixel-art palette pass on the
   *splat colours*. SyntaxSplat's `buildPly()` writes the baked lighting as-is: the
   palette pass is a screen-space post shader (`main.js`), so the pixel-art toggle
   changes the render but never the export. To get an asset that carries the pass, the
   same maths is applied per splat here: ordered dither of amplitude 0.07, then the
   nearest palette entry under the shader's `dot(d*d, vec3(0.3, 0.59, 0.11))` metric.
   The 4x4 Bayer value is taken from the splat index (`i % 16`) instead of the screen
   pixel — the same 16 offsets, no screen grid, because a splat file has none.
   Palette entries are parsed straight out of the scene file's `export const palette`.

2. Normalise to the deck's convention: centre the bounding box on the origin, scale so
   the largest extent is `--extent` (default 4.0 world units, fits the default ortho
   view size 2.2). Gaussian sigmas scale with the geometry (`ln f` added to the stored
   log-sigmas); colours, opacities and rotations are untouched.

Writes the contract's 3DGS schema (`nx ny nz` zeros, `f_dc` = (rgb-0.5)/SH_C0, `opacity`
logit, `scale_*` ln sigma, `rot_*` = normalised w,x,y,z quaternion) as binary_little_endian.

    uv run tools/splats/a3/pack.py in.ply out.ply [--palette-snap scenes/a3-gpu.js]
"""
import argparse
import math
import os
import re
import resource
import time

import numpy as np

SH_C0 = 0.28209479177387814
# main.js post shader: bayer() table, uDither default 0.07, palette weights 0.3/0.59/0.11.
BAYER16 = np.array([0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5], np.float32) / 16.0
DITHER = 0.07
WEIGHTS = np.array([0.3, 0.59, 0.11], np.float32)
IN_PROPS = ["x", "y", "z", "f_dc_0", "f_dc_1", "f_dc_2", "opacity",
            "scale_0", "scale_1", "scale_2", "rot_0", "rot_1", "rot_2", "rot_3"]
OUT_PROPS = ["x", "y", "z", "nx", "ny", "nz", "f_dc_0", "f_dc_1", "f_dc_2", "opacity",
             "scale_0", "scale_1", "scale_2", "rot_0", "rot_1", "rot_2", "rot_3"]


def read_ply(path):
    with open(path, "rb") as f:
        head, data = f.read().split(b"end_header\n", 1)
    lines = head.decode().splitlines()
    n = int(next(l.split()[-1] for l in lines if l.startswith("element vertex")))
    dt = np.dtype([(l.split()[-1], "<f4") for l in lines if l.startswith("property ")])
    v = np.frombuffer(data[: n * dt.itemsize], dt)
    assert set(IN_PROPS).issubset(v.dtype.names), f"missing columns in {path}: {v.dtype.names}"
    return v


def palette_from_scene(path):
    """Parse `export const palette = [0x…, 0x…];` out of a SyntaxSplat scene file."""
    src = open(path).read()
    m = re.search(r"export const palette = \[(.*?)\]", src, re.S)
    if not m:
        raise SystemExit(f"{path}: no `export const palette = [...]` found")
    hexes = [int(h, 16) for h in re.findall(r"0x([0-9a-fA-F]{6})", m.group(1))]
    if not 1 <= len(hexes) <= 64:
        raise SystemExit(f"{path}: palette has {len(hexes)} entries, the pass supports 1..64")
    return np.array([[((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255] for h in hexes], np.float32)


def write_ply(path, cols):
    n = len(cols[IN_PROPS[0]])
    head = ("ply\nformat binary_little_endian 1.0\nelement vertex %d\n" % n
            + "".join(f"property float {p}\n" for p in OUT_PROPS) + "end_header\n")
    arr = np.empty(n, np.dtype([(p, "<f4") for p in OUT_PROPS]))
    for p, v in cols.items():
        arr[p] = v
    os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
    with open(path, "wb") as f:
        f.write(head.encode())
        f.write(arr.tobytes())
    return n


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("src")
    ap.add_argument("dst")
    ap.add_argument("--palette-snap", metavar="SCENE_JS", help="apply the scene's palette pass to the splat colours")
    ap.add_argument("--extent", type=float, default=4.0, help="target largest extent, world units")
    ap.add_argument("--keep-pose", action="store_true", help="skip centring/scaling")
    a = ap.parse_args()

    t0 = time.perf_counter()
    v = read_ply(a.src)
    n = len(v)
    p = np.stack([v["x"], v["y"], v["z"]], -1).astype(np.float32)
    rgb = np.clip(np.stack([v["f_dc_0"], v["f_dc_1"], v["f_dc_2"]], -1) * SH_C0 + 0.5, 0.0, 1.0)

    snapped = 0
    if a.palette_snap:
        pal = palette_from_scene(a.palette_snap)
        d = rgb + (BAYER16[np.arange(n) % 16][:, None] - 0.5) * DITHER      # ordered dither
        dd = ((d[:, None, :] - pal[None, :, :]) ** 2 * WEIGHTS).sum(-1)      # shader metric
        rgb = pal[np.argmin(dd, 1)]
        snapped = len(pal)

    f = 1.0
    if not a.keep_pose:
        lo, hi = p.min(0), p.max(0)
        p = p - (lo + hi) / 2
        f = a.extent / float(np.ptp(p).max()) if np.ptp(p).max() > 0 else 1.0
        p = p * f

    cols = {"x": p[:, 0], "y": p[:, 1], "z": p[:, 2],
            "nx": np.zeros(n, np.float32), "ny": np.zeros(n, np.float32), "nz": np.zeros(n, np.float32),
            "f_dc_0": (rgb[:, 0] - 0.5) / SH_C0, "f_dc_1": (rgb[:, 1] - 0.5) / SH_C0, "f_dc_2": (rgb[:, 2] - 0.5) / SH_C0,
            "opacity": v["opacity"],
            "scale_0": v["scale_0"] + np.log(f), "scale_1": v["scale_1"] + np.log(f), "scale_2": v["scale_2"] + np.log(f),
            "rot_0": v["rot_0"], "rot_1": v["rot_1"], "rot_2": v["rot_2"], "rot_3": v["rot_3"]}
    wrote = write_ply(a.dst, cols)
    secs = time.perf_counter() - t0

    lum = rgb @ np.array([0.299, 0.587, 0.114], np.float32)
    q = np.percentile(lum, [5, 50, 95])
    rss = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss / 1024
    print(f"{os.path.basename(a.src)} -> {os.path.basename(a.dst)}: {wrote} splats, "
          f"extent={np.ptp(p, 0).max():.3f}, scale={f:.5f}, lum p5/50/95={q.round(3)}, "
          f"palette_snap={'off' if not snapped else f'{snapped} entries'}, "
          f"{secs:.2f} s, peak RSS {rss:.0f} MB")


if __name__ == "__main__":
    main()
