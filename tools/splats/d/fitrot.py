# /// script
# dependencies = ["numpy", "pandas"]
# ///
"""Search splat-transform Euler rotations for a pose that is upright in the DECK frame.

The PlayCanvas CLI reports `--stats` / CSV columns in the asset's file frame, but applies
--rotate/--translate/--filter-box in a world frame with the y axis negated, and the deck
(three.js + Spark, SPZ stored RUB) renders the file frame with +y up. So the pose has to be
checked in the file frame: write a candidate, export it to CSV, measure.

Prints one line per candidate: long axis, vertical extent, and the arc's concave direction
(where the legs of a curled subject point). `axis=<X|Y|Z>` tells which world axis the longest
dimension ended up on; `concave` should be ~[0,-1,0] for a subject lying on its belly.

Usage: uv run fitrot.py <input> "<euler>[+<euler>];..." [scratch_dir]
"""
import re
import subprocess
import sys
import tempfile
from pathlib import Path

import numpy as np
import pandas as pd

ST = ['pnpx', '@playcanvas/splat-transform@3.11.2']


def stats_bounds(src):
    out = subprocess.run(ST + [src, '--stats', 'null'], capture_output=True, text=True).stdout
    rows = {}
    for line in out.splitlines():
        m = re.match(r"^\|\s*([xyz])\s*\|\s*(-?[\d.e+-]+)\s*\|\s*(-?[\d.e+-]+)\s*\|", line)
        if m:
            rows[m.group(1)] = (float(m.group(2)), float(m.group(3)))
    return rows


def pose(csv_path):
    d = pd.read_csv(csv_path, usecols=['x', 'y', 'z', 'opacity'])
    P = d.to_numpy(np.float64)[:, :3]
    op = pd.read_csv(csv_path, usecols=['opacity'])['opacity'].to_numpy(np.float64)
    a = 1 / (1 + np.exp(-np.clip(op, -30, 30))) if np.abs(op).max() > 2 else np.clip(op, 0, 1)
    m = a > 0.3
    w = a[m] / a[m].sum()
    Q = P[m]
    cen = (Q * w[:, None]).sum(0)
    Q = Q - cen
    cov = (Q * w[:, None]).T @ Q
    ev, evec = np.linalg.eigh(cov)
    o = ev.argsort()[::-1]
    a0, a1 = evec[:, o[0]], evec[:, o[1]]
    u, v = Q @ a0, Q @ a1
    A = np.stack([u, v, np.ones_like(u)], -1)
    b = u ** 2 + v ** 2
    sw = np.sqrt(w / w.sum())
    coef = np.linalg.lstsq(A * sw[:, None], b * sw, rcond=None)[0]
    cc = np.array([coef[0] / 2, coef[1] / 2])
    mid = np.array([np.average(u, weights=a[m]), np.average(v, weights=a[m])])
    dvec = cc - mid
    concave = np.zeros(3)
    if np.linalg.norm(dvec) > 1e-9:
        dvec /= np.linalg.norm(dvec)
        concave = a0 * dvec[0] + a1 * dvec[1]
    ext = P.max(0) - P.min(0)
    return a0, ext, np.round(concave, 3)


src = sys.argv[1]
cands = sys.argv[2].split(';')
work = Path(sys.argv[3] if len(sys.argv) > 3 else tempfile.mkdtemp())
for eul in cands:
    steps = []
    for e in eul.split('+'):
        steps += ['-r', e]
    tag = re.sub(r'[^0-9a-z]+', '_', eul).strip('_')
    mid = work / f'c_{tag}.spz'
    r = subprocess.run(ST + ['-w', src, *steps, str(mid)], capture_output=True, text=True)
    if not mid.exists():
        print(f"-r {eul}: convert failed: {r.stdout[-200:]}{r.stderr[-200:]}")
        continue
    csv = work / mid.with_suffix('.csv').name
    subprocess.run(ST + ['-w', str(mid), str(csv)], capture_output=True, text=True)
    a0, ext, concave = pose(str(csv))
    k = int(np.argmax(np.abs(ext)))
    print(f"-r {eul:>16}  long->{a0.round(2)}  extent={ext.round(3)} "
          f"max={'xyz'[k]}  concave={concave}")
