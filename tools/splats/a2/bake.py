# /// script
# requires-python = ">=3.11"
# dependencies = ["numpy"]
# ///
"""A2 — LLM-written Python splat bake.

Signed-distance shapes (boxes / rounded boxes / wire outlines) are sampled on a
jittered grid; shell points (|d| < eps) are projected onto the zero level set
with the SDF gradient, points that fall inside another shape are dropped, and
flat Gaussians are oriented tangent to the surface (minor axis = normal).
Colour is a cheap bake: lambert from one fixed light + a weak fill + a 2-tap
ambient-occlusion approximation measured against the union field. Output is a
3DGS binary .ply, centred on the origin, y-up, largest extent ~4 units.

    uv run tools/splats/a2/bake.py --asset gpu --out public/splats/a2/gpu.ply

Everything is illustrative primitive geometry: no measured hardware dimensions,
no real model or benchmark data.
"""

from __future__ import annotations

import argparse
import math
import resource
import time
from dataclasses import dataclass

import numpy as np

SH_C0 = 0.28209479177387814
NORM_EXTENT = 4.0  # largest extent of the finished asset, in world units


# --------------------------------------------------------------------------- #
# primitives
# --------------------------------------------------------------------------- #
@dataclass
class Prim:
    kind: str  # 'box' | 'rbox' (rounded box) | 'edges' (wire outline)
    center: tuple
    half: tuple
    lum: float  # base surface luminance 0..1 (the renderer keeps luminance only)
    radius: float = 0.0
    rim: float = 0.0  # dark border band width on the wide faces (boxes)
    rim_lum: float = 0.15
    tag: str = ""

    def bbox(self):
        c = np.asarray(self.center, np.float32)
        b = np.asarray(self.half, np.float32)
        pad = b + max(self.radius, 0.0)
        return c - pad, c + pad


def sd_box(p, c, b):
    q = np.abs(p - c) - b
    mq = np.maximum(q, 0.0)
    return np.sqrt(np.einsum("ij,ij->i", mq, mq, dtype=np.float32)) + np.minimum(q.max(-1), 0.0)


def sd_prim(p, pr: Prim):
    c = np.asarray(pr.center, np.float32)
    b = np.asarray(pr.half, np.float32)
    if pr.kind == "rbox":
        return sd_box(p, c, np.maximum(b - np.float32(pr.radius), 1e-4)) - np.float32(pr.radius)
    return sd_box(p, c, b)


def sd_union(p, prims):
    d = None
    for pr in prims:
        di = sd_prim(p, pr)
        d = di if d is None else np.minimum(d, di)
    return d if d is not None else np.zeros(len(p), np.float32)


def near_prims(prims, lo, hi):
    """Prims whose bbox overlaps the region [lo, hi] (keeps union scans small)."""
    out = []
    for pr in prims:
        a, b = pr.bbox()
        if np.any(a > hi) or np.any(b < lo):
            continue
        out.append(pr)
    return out


def unit(v):
    n = np.linalg.norm(v, axis=-1, keepdims=True)
    return v / np.where(n < 1e-9, 1.0, n)


def grad_unit(p, prims, e):
    """Central-difference gradient of the union field, unit length."""
    comps = []
    for k in range(3):
        step = np.zeros(3, np.float32)
        step[k] = e
        comps.append(sd_union(p + step, prims) - sd_union(p - step, prims))
    return unit(np.stack(comps, -1).astype(np.float32))


# --------------------------------------------------------------------------- #
# sampling
# --------------------------------------------------------------------------- #
def grid_slabs(lo, hi, h, rng, slab_voxels=250_000):
    """Yield jittered grid points in [lo, hi] at spacing ~h, one x-slab at a time."""
    lo = np.asarray(lo, np.float32)
    hi = np.asarray(hi, np.float32)
    n = np.maximum(1, np.ceil((hi - lo) / h).astype(np.int64))
    span = (hi - lo) / n
    axes = []
    for k in range(3):
        jitter = rng.uniform(-0.34, 0.34, int(n[k])).astype(np.float32) * span[k]
        axes.append(lo[k] + (np.arange(int(n[k]), dtype=np.float32) + 0.5) * span[k] + jitter)
    per_row = int(n[1]) * int(n[2])
    rows = max(1, int(slab_voxels // max(1, per_row)))
    for i0 in range(0, int(n[0]), rows):
        i1 = min(int(n[0]), i0 + rows)
        gy, gz = np.meshgrid(axes[1], axes[2], indexing="ij")
        shape = (i1 - i0, gy.shape[0], gy.shape[1])  # x is the slow axis
        gx = np.broadcast_to(axes[0][i0:i1][:, None, None], shape)
        yield np.stack([gx.ravel(), np.broadcast_to(gy, shape).ravel(),
                        np.broadcast_to(gz, shape).ravel()], axis=-1).astype(np.float32, copy=False)


def rim_lum(p, n, pr: Prim, c, b):
    """Base luminance; wide faces get a dark band near the perimeter, sides are dark."""
    l = np.full(len(p), pr.lum, np.float32)
    if pr.rim <= 0 or pr.kind != "box":
        return l
    thin = int(np.argmin(b))
    wide = np.abs(n[:, thin]) > 0.7
    q = np.abs(p - c) - b
    other = [k for k in range(3) if k != thin]
    edge = np.maximum(q[:, other[0]], q[:, other[1]])  # <0 inside the footprint
    band = wide & (edge > -pr.rim)
    l = np.where(band, np.float32(pr.rim_lum), l)
    l = np.where(~wide, np.float32(min(pr.lum, pr.rim_lum)), l)
    return l.astype(np.float32)


def sample_solid(pr: Prim, prims, h, rng, chunk=200_000):
    """Shell-sample one solid prim; project onto the surface; drop hidden points."""
    eps = np.float32(0.46 * h)
    pad = eps + np.float32(pr.radius)
    c = np.asarray(pr.center, np.float32)
    b = np.asarray(pr.half, np.float32)
    lo, hi = c - b - pad, c + b + pad
    e = np.float32(max(1e-4, 0.18 * h))
    out_p, out_n, out_l = [], [], []

    for pts in grid_slabs(lo, hi, h, rng):
        for s0 in range(0, len(pts), chunk):
            p = pts[s0 : s0 + chunk]
            d = sd_prim(p, pr)
            keep = np.abs(d) < eps
            if not keep.any():
                continue
            p, d = p[keep], d[keep]
            # hide points that lie inside another solid
            klo, khi = p.min(0) - eps, p.max(0) + eps
            others = [q for q in near_prims(prims, klo, khi) if q is not pr]
            if others:
                inside = sd_union(p, others) < -eps * 0.75
                if inside.any():
                    p, d = p[~inside], d[~inside]
                    if len(p) == 0:
                        continue
            n = grad_unit(p, [pr], e).astype(np.float32)
            p = (p - d[:, None] * n).astype(np.float32)
            out_p.append(p)
            out_n.append(n)
            out_l.append(rim_lum(p, n, pr, c, b))
    if not out_p:
        return (np.zeros((0, 3), np.float32), np.zeros((0, 3), np.float32), np.zeros(0, np.float32))
    return np.concatenate(out_p), np.concatenate(out_n), np.concatenate(out_l)


def sample_edges(pr: Prim, h, rng):
    """Wire outline: points along the 12 box edges, normal = outward bisector."""
    c = np.asarray(pr.center, np.float32)
    b = np.asarray(pr.half, np.float32)
    ps, ns = [], []
    for ax in range(3):
        o = [k for k in range(3) if k != ax]
        for sa in (-1.0, 1.0):
            for sb in (-1.0, 1.0):
                n = np.zeros(3, np.float32)
                n[o[0]], n[o[1]] = sa / b[o[0]], sb / b[o[1]]
                n = unit(n[None])[0]
                cnt = max(2, int(round(2 * float(b[ax]) / h)))
                step = 2 * float(b[ax]) / cnt
                t = np.linspace(-float(b[ax]), float(b[ax]), cnt, endpoint=False, dtype=np.float32)
                t = t + rng.uniform(-0.5, 0.5, cnt).astype(np.float32) * step
                p = np.zeros((cnt, 3), np.float32)
                p[:, ax] = t
                p[:, o[0]] = sa * b[o[0]]
                p[:, o[1]] = sb * b[o[1]]
                ps.append(p + c)
                ns.append(np.repeat(n[None], cnt, axis=0))
    return np.concatenate(ps), np.concatenate(ns)


# --------------------------------------------------------------------------- #
# shading + gaussian assembly
# --------------------------------------------------------------------------- #
# Key light roughly along the deck's default camera direction (theta 0.6 / phi 1.1),
# so anything the audience can see is lit; weak fill from behind-left.
LIGHT = np.array([0.45, 0.62, 0.65], np.float32)
FILL = np.array([-0.6, 0.28, -0.42], np.float32)
LIGHT /= np.linalg.norm(LIGHT)
FILL /= np.linalg.norm(FILL)


def shade(p, n, lum, prims, h, rng, chunk=20_000):
    lam = np.maximum(0.0, n @ LIGHT)
    fill = np.maximum(0.0, n @ FILL)
    rgb = np.empty((len(p), 3), np.float32)
    for s0 in range(0, len(p), chunk):
        sl = slice(s0, min(s0 + chunk, len(p)))
        klo, khi = p[sl].min(0) - 8 * h, p[sl].max(0) + 8 * h
        near = near_prims(prims, klo, khi) or prims
        taps = []
        for mult in (2.5, 6.5):
            t = np.float32(mult * h)
            taps.append(np.clip(sd_union(p[sl] + n[sl] * t, near) / t, 0.0, 1.0))
        ao = 0.34 + 0.66 * (taps[0] * 0.45 + taps[1] * 0.55)
        f = np.clip(0.3 + 0.7 * lam[sl] + 0.22 * fill[sl], 0.0, 1.3) * ao
        rgb[sl] = lum[sl, None] * f[:, None]
    rgb *= 1.0 + rng.uniform(-0.02, 0.02, (len(p), 1)).astype(np.float32)
    return np.clip(rgb, 0.0, 1.0).astype(np.float32)


def quat_align_z(n, rng):
    """Quaternion (w,x,y,z) whose local +z is n, with random roll about n."""
    ref = np.where(np.abs(n[:, 2:3]) < 0.9,
                   np.array([0.0, 0.0, 1.0], np.float32), np.array([1.0, 0.0, 0.0], np.float32))
    u = unit(np.cross(ref, n))
    v = np.cross(n, u)
    a = rng.uniform(0, 2 * math.pi, len(n)).astype(np.float32)
    ca, sa = np.cos(a)[:, None], np.sin(a)[:, None]
    t1 = u * ca + v * sa
    t2 = np.cross(n, t1)
    m00, m01, m02 = t1[:, 0], t2[:, 0], n[:, 0]
    m10, m11, m12 = t1[:, 1], t2[:, 1], n[:, 1]
    m20, m21, m22 = t1[:, 2], t2[:, 2], n[:, 2]
    w = np.empty(len(n), np.float32)
    x = np.empty(len(n), np.float32)
    y = np.empty(len(n), np.float32)
    z = np.empty(len(n), np.float32)
    pos = (m00 + m11 + m22) > 0  # trace-positive branch
    s = np.sqrt(np.maximum((m00 + m11 + m22)[pos], 1e-9) + 1.0) * 2
    w[pos] = 0.25 * s
    x[pos] = (m21 - m12)[pos] / s
    y[pos] = (m02 - m20)[pos] / s
    z[pos] = (m10 - m01)[pos] / s
    i0 = (~pos) & (m00 >= m11) & (m00 >= m22)
    s = np.sqrt(np.maximum(1.0 + (m00 - m11 - m22)[i0], 1e-9)) * 2
    w[i0] = (m21 - m12)[i0] / s
    x[i0] = 0.25 * s
    y[i0] = (m01 + m10)[i0] / s
    z[i0] = (m02 + m20)[i0] / s
    i1 = (~pos) & (~i0) & (m11 >= m22)
    s = np.sqrt(np.maximum(1.0 + (m11 - m00 - m22)[i1], 1e-9)) * 2
    w[i1] = (m02 - m20)[i1] / s
    x[i1] = (m01 + m10)[i1] / s
    y[i1] = 0.25 * s
    z[i1] = (m12 + m21)[i1] / s
    i2 = (~pos) & (~i0) & (~i1)
    s = np.sqrt(np.maximum(1.0 + (m22 - m00 - m11)[i2], 1e-9)) * 2
    w[i2] = (m10 - m01)[i2] / s
    x[i2] = (m02 + m20)[i2] / s
    y[i2] = (m12 + m21)[i2] / s
    z[i2] = 0.25 * s
    q = np.stack([w, x, y, z], -1)
    return unit(q).astype(np.float32)


# --------------------------------------------------------------------------- #
# the four assets (all illustrative)
# --------------------------------------------------------------------------- #
def asset_gpu(rng):
    """Card lies in the x-y plane (x = length, y = height); +z is the component face."""
    PCB_T = 0.075
    prims = []
    prims.append(Prim("box", (0, 0, 0), (2.0, 0.55, PCB_T), 0.27, tag="pcb"))
    prims.append(Prim("box", (0, 0, -0.092), (1.94, 0.5, 0.014), 0.36, tag="backplate"))
    for i in range(18):  # PCIe edge connector: fingers under the bottom edge
        x = -1.9 + 0.118 * i
        if -0.86 < x < -0.62:  # key notch
            continue
        prims.append(Prim("box", (x, -0.615, 0), (0.036, 0.062, PCB_T), 0.55, tag="finger"))
    for i in range(8):  # row of 8 VRAM chips, mid, on the bare board
        prims.append(Prim("box", (-1.83 + 0.182 * i, 0.0, PCB_T + 0.024), (0.068, 0.072, 0.024), 0.55, tag="vram"))
    # cooler: dark-ish contact plate, light fin stack, light shroud
    prims.append(Prim("box", (0.83, 0.02, PCB_T + 0.02), (1.15, 0.32, 0.02), 0.42, tag="coldplate"))
    fins = 12
    for i in range(fins):  # fins are plates stacked along the card length
        prims.append(Prim("box", (-0.28 + (2.22 / (fins - 1)) * i, 0.02, 0.2),
                          (0.016, 0.31, 0.085), 0.92, tag="fin"))
    prims.append(Prim("box", (0.83, 0.35, 0.2), (1.16, 0.022, 0.1), 0.82, tag="shroud-top"))
    prims.append(Prim("box", (0.83, -0.31, 0.2), (1.16, 0.022, 0.1), 0.64, tag="shroud-bottom"))
    prims.append(Prim("box", (-0.31, 0.02, 0.2), (0.028, 0.35, 0.1), 0.7, tag="shroud"))
    prims.append(Prim("box", (1.99, 0.02, 0.2), (0.028, 0.35, 0.1), 0.7, tag="shroud"))
    prims.append(Prim("box", (1.34, 0.6, 0.13), (0.3, 0.07, 0.09), 0.4, tag="power"))
    return prims, 0.0105, 0.86


def asset_layers(rng):
    prims = []
    for i in range(12):  # 12 thin layer plates, gapped and slightly offset
        prims.append(Prim("box", (0.07 * i, -1.925 + 0.35 * i, -0.045 * i),
                          (1.05, 0.02, 0.68), 1.0, rim=0.1, rim_lum=0.16, tag=f"layer{i:02d}"))
    return prims, 0.022, 0.85


def asset_kv(rng):
    prims = []
    nx, ny, nz, pitch = 16, 6, 4, 1.12
    for k in range(nz):
        for j in range(ny):
            for i in range(nx):
                c = ((i - (nx - 1) / 2) * pitch, (j - (ny - 1) / 2) * pitch, (k - (nz - 1) / 2) * pitch)
                if rng.random() < 0.6:  # ~60% of the paged blocks are allocated
                    prims.append(Prim("box", c, (0.36,) * 3, 0.24 + 0.5 * rng.random(), tag="fill"))
                else:
                    prims.append(Prim("edges", c, (0.36,) * 3, 0.95, tag="empty"))
    return prims, 0.08, 0.85


def asset_tokens(rng):
    prims = []
    heights = [0.08, 0.13, 0.22, 0.35, 0.52, 0.40, 0.28, 0.21, 0.62, 0.46, 0.33, 0.15]
    prims.append(Prim("box", (0, 0, 0), (2.74, 0.042, 0.16), 0.2, tag="rail"))
    for i, h in enumerate(heights):
        x = -2.42 + 0.44 * i
        prims.append(Prim("rbox", (x, 0.1, 0), (0.17, 0.058, 0.2), 0.56, radius=0.05, tag="tile"))
        prims.append(Prim("box", (x, 0.158 + h / 2, 0), (0.048, h / 2, 0.048), 0.9, tag="glyph"))
    return prims, 0.0125, 0.85


ASSETS = {"gpu": asset_gpu, "layers": asset_layers, "kv-blocks": asset_kv, "tokens": asset_tokens}


# --------------------------------------------------------------------------- #
# output
# --------------------------------------------------------------------------- #
def write_ply(path, pos, rgb, alpha, sigma, quat):
    n = len(pos)
    props = ["x", "y", "z", "nx", "ny", "nz", "f_dc_0", "f_dc_1", "f_dc_2", "opacity",
             "scale_0", "scale_1", "scale_2", "rot_0", "rot_1", "rot_2", "rot_3"]
    hdr = ("ply\nformat binary_little_endian 1.0\n"
           "comment A2 LLM-written Python bake (SDF shell sampling)\n"
           f"element vertex {n}\n" + "".join(f"property float {p}\n" for p in props) + "end_header\n")
    fdc = ((rgb - 0.5) / SH_C0).astype("<f4")
    logit = np.log(alpha / (1.0 - alpha)).astype("<f4")
    data = np.concatenate([pos.astype("<f4"), np.zeros((n, 3), "<f4"), fdc,
                           logit[:, None], np.log(sigma).astype("<f4"), quat.astype("<f4")], axis=1)
    with open(path, "wb") as f:
        f.write(hdr.encode("ascii"))
        f.write(np.ascontiguousarray(data).tobytes())


def bake(name, out, seed=7, scale_gain=1.0):
    t0 = time.time()
    rng = np.random.default_rng(seed)
    prims, h, s_over_h = ASSETS[name](rng)
    h = float(h)
    solid = [p for p in prims if p.kind != "edges"]
    wire = [p for p in prims if p.kind == "edges"]

    pos, nor, lum = [], [], []
    for pr in solid:
        p, n, l = sample_solid(pr, solid, h, rng)
        if len(p):
            pos.append(p)
            nor.append(n)
            lum.append(l)
    for pr in wire:
        p, n = sample_edges(pr, h, rng)
        pos.append(p)
        nor.append(n)
        lum.append(np.full(len(p), pr.lum, np.float32))
    pos = np.concatenate(pos)
    nor = unit(np.concatenate(nor).astype(np.float32))
    lum = np.concatenate(lum).astype(np.float32)
    order = rng.permutation(len(pos))  # break the prim-draw order
    pos, nor, lum = pos[order], nor[order], lum[order]
    t_sample = time.time()

    rgb = shade(pos, nor, lum, solid, h, rng)
    s = np.float32(s_over_h * h)
    sigma = np.repeat(np.array([[s * 0.82, s * 0.82, s * 0.1]], np.float32), len(pos), axis=0)
    quat = quat_align_z(nor, rng)
    alpha = np.full(len(pos), 0.96, np.float32)
    t_shade = time.time()

    lo, hi = pos.min(0), pos.max(0)  # normalise: centre on origin, largest extent -> 4
    ext = float((hi - lo).max())
    k = np.float32(NORM_EXTENT / ext * scale_gain)
    pos = ((pos - (lo + hi) / 2) * k).astype(np.float32)
    sigma = (sigma * k).astype(np.float32)
    write_ply(out, pos, rgb, alpha, sigma, quat)
    return {
        "asset": name,
        "splats": int(len(pos)),
        "prims": len(prims),
        "spacing": round(h, 4),
        "splat_sigma": round(float(s * k), 4),
        "extents": [round(float(v), 3) for v in (hi - lo) * k],
        "lum_range": [round(float(rgb.min()), 3), round(float(rgb.max()), 3)],
        "t_sample": round(t_sample - t0, 2),
        "t_shade": round(t_shade - t_sample, 2),
        "t_total": round(time.time() - t0, 2),
        "peak_rss_mb": round(resource.getrusage(resource.RUSAGE_SELF).ru_maxrss / 1024, 1),
    }


def main():
    ap = argparse.ArgumentParser(description="A2 splat bake")
    ap.add_argument("--asset", required=True, choices=sorted(ASSETS))
    ap.add_argument("--out", required=True)
    ap.add_argument("--seed", type=int, default=7)
    ap.add_argument("--scale", type=float, default=1.0, help="extra scale multiplier")
    a = ap.parse_args()
    print(bake(a.asset, a.out, a.seed, a.scale))


if __name__ == "__main__":
    main()
