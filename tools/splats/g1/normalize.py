# /// script
# requires-python = ">=3.11"
# dependencies = ["plyfile", "numpy"]
# ///
"""splat-lab g1 — normalise LGM's raw .ply into the deck's asset convention.

LGM emits Gaussians in its own unit-ish training volume (positions clamped to [-1, 1], OpenGL
y-up, camera radius 1.5 — see core/options.py of the pinned commit), so every asset is rescaled
before shipping: drop near-transparent splats, centre on the bounding-box middle, keep y-up, and
scale so the largest extent is ~4 units (the deck's default ortho view size is 2.2).

Writes the plain float32 3DGS schema (x y z, nx ny nz, f_dc_*, opacity logit,
scale_* ln-sigma, rot_0..3 quaternion w,x,y,z) — no f_rest, luminance is all the
deck's post shader keeps anyway.

Same math as tools/splats/c/normalize.py (kept as a local copy so g1's provenance is one folder).

  uv run tools/splats/g1/normalize.py in.ply out.ply [--extent 4] [--min-alpha 0.05]
                                                    [--rot x,y,z] [deg] [--flip y] [--info]
"""
from __future__ import annotations

import argparse
import sys

import numpy as np
from plyfile import PlyData, PlyElement

PROPS = ["x", "y", "z", "nx", "ny", "nz", "f_dc_0", "f_dc_1", "f_dc_2", "opacity",
         "scale_0", "scale_1", "scale_2", "rot_0", "rot_1", "rot_2", "rot_3"]


def rot_matrix(euler_deg: tuple[float, float, float]) -> np.ndarray:
    rx, ry, rz = (np.deg2rad(a) for a in euler_deg)

    def r(a: float, axis: int) -> np.ndarray:
        c, s = np.cos(a), np.sin(a)
        m = np.eye(3)
        i, j = [k for k in range(3) if k != axis]
        m[axis, axis] = 1
        m[i, i] = c
        m[i, j] = -s if axis == 2 else s
        m[j, i] = s if axis == 2 else -s
        m[j, j] = c
        return m

    return r(rz, 2) @ r(ry, 1) @ r(rx, 0)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("src")
    ap.add_argument("dst")
    ap.add_argument("--extent", type=float, default=4.0, help="target largest side length")
    ap.add_argument("--min-alpha", type=float, default=0.05)
    ap.add_argument("--rot", default="0,0,0", help="euler degrees applied as x then y then z")
    ap.add_argument("--flip", default="", help="axes to negate, e.g. 'y' or 'xy'")
    ap.add_argument("--info", action="store_true", help="print bounds only, write nothing")
    a = ap.parse_args()

    d = PlyData.read(a.src).elements[0].data
    n = len(d)
    xyz = np.stack([d["x"], d["y"], d["z"]], 1).astype(np.float64)
    alpha = 1.0 / (1.0 + np.exp(-np.asarray(d["opacity"], dtype=np.float64)))
    sigma = np.exp(np.stack([d[k] for k in ("scale_0", "scale_1", "scale_2")], 1).astype(np.float64))
    print(f"read {n} splats from {a.src}")

    keep = alpha >= a.min_alpha
    # splat centres + their own footprint must fit; keep it simple: centre on bbox of kept centres
    if a.flip:
        for ax in "xyz":
            if ax in a.flip:
                xyz[:, "xyz".index(ax)] *= -1
    R = np.eye(3)
    if a.rot != "0,0,0":
        R = rot_matrix(tuple(float(v) for v in a.rot.split(",")))
        xyz = xyz @ R.T
    # source quaternions are (w,x,y,z); rotate them too: q' = q_R * q
    q = np.stack([np.asarray(d[k], dtype=np.float64) for k in
                  ("rot_0", "rot_1", "rot_2", "rot_3")], 1)
    q = q / np.maximum(np.linalg.norm(q, axis=1, keepdims=True), 1e-9)
    if not np.allclose(R, np.eye(3)):
        tr = np.trace(R)
        if tr > 0:
            s = np.sqrt(tr + 1.0) * 2
            qR = np.array([0.25 * s, (R[2, 1] - R[1, 2]) / s,
                           (R[0, 2] - R[2, 0]) / s, (R[1, 0] - R[0, 1]) / s])
        else:
            i = int(np.argmax(np.diag(R)))
            j, k = (i + 1) % 3, (i + 2) % 3
            s = np.sqrt(1.0 + R[i, i] - R[j, j] - R[k, k]) * 2
            v = [0.0, 0.0, 0.0, 0.0]
            v[0] = (R[k, j] - R[j, k]) / s
            v[i + 1] = 0.25 * s
            v[j + 1] = (R[j, i] + R[i, j]) / s
            v[k + 1] = (R[k, i] + R[i, k]) / s
            qR = np.array(v)
        w1, x1, y1, z1 = qR
        w2, x2, y2, z2 = q[:, 0], q[:, 1], q[:, 2], q[:, 3]
        q = np.stack([w1 * w2 - x1 * x2 - y1 * y2 - z1 * z2,
                      w1 * x2 + x1 * w2 + y1 * z2 - z1 * y2,
                      w1 * y2 - x1 * z2 + y1 * w2 + z1 * x2,
                      w1 * z2 + x1 * y2 - y1 * x2 + z1 * w2], 1)
    x0, x1 = xyz.min(0), xyz.max(0)
    centre = (x0 + x1) / 2
    extent = x1 - x0
    print(f"kept {keep.sum()} of {n} (alpha>={a.min_alpha}); centre={centre.round(3)} extent={extent.round(3)}")
    if a.info:
        return 0

    f = a.extent / extent.max()
    xyz = (xyz - centre) * f
    sigma = sigma * f
    print(f"scale x{f:.3f} -> largest extent {a.extent}; sigma max {sigma.max():.4f}")

    out = np.zeros(int(keep.sum()), dtype=[(p, "f4") for p in PROPS])
    for i, p in enumerate(("x", "y", "z")):
        out[p] = xyz[keep][:, i].astype(np.float32)
    for i, p in enumerate(("f_dc_0", "f_dc_1", "f_dc_2")):
        out[p] = np.asarray(d[p], dtype=np.float32)[keep]
    out["opacity"] = np.asarray(d["opacity"], dtype=np.float32)[keep]
    for i, p in enumerate(("scale_0", "scale_1", "scale_2")):
        out[p] = np.log(np.maximum(sigma[keep][:, i], 1e-9)).astype(np.float32)
    for i, p in enumerate(("rot_0", "rot_1", "rot_2", "rot_3")):
        out[p] = q[keep][:, i].astype(np.float32)
    PlyData([PlyElement.describe(out, "vertex")]).write(a.dst)
    print(f"wrote {a.dst} ({__import__('os').path.getsize(a.dst)} bytes)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
