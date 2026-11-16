# /// script
# dependencies = ["numpy"]
# ///
"""Centring + scaling helper for the splat-lab assets.

The PlayCanvas `splat-transform` CLI reports `--stats` bounds in the asset's FILE frame (which
is what the deck renders, +y up), but applies `-t/-s/-r/-B` in its own world frame, rotated
180° about z relative to the file frame: a translate of (tx,ty,tz) moves the content by
(-tx,-ty,+tz) in file coordinates. So: to centre on the origin, translate by
(cx, cy, -cz) — negated z only. (Measured, see tools/splats/d/README notes.)

Usage: uv run bounds_cli.py <file with --stats output> [target extent = 4]
Prints shell assignments for CLI-frame translate/scale plus the file-frame diagnostics.
"""
import re
import sys

TARGET = float(sys.argv[2]) if len(sys.argv) > 2 else 4.0
rows = {}
for line in open(sys.argv[1]):
    m = re.match(r"^\|\s*([xyz])\s*\|\s*(-?[\d.e+-]+)\s*\|\s*(-?[\d.e+-]+)\s*\|", line)
    if m:
        rows[m.group(1)] = (float(m.group(2)), float(m.group(3)))
if len(rows) != 3:
    sys.exit('no |x| |y| |z| bound rows in input')
lo = [rows['x'][0], rows['y'][0], rows['z'][0]]
hi = [rows['x'][1], rows['y'][1], rows['z'][1]]
c = [(a + b) / 2 for a, b in zip(lo, hi)]
e = [b - a for a, b in zip(lo, hi)]
s = TARGET / max(e)
print(f"file_centre {c[0]:.4f} {c[1]:.4f} {c[2]:.4f}")
print(f"file_extent {e[0]:.4f} {e[1]:.4f} {e[2]:.4f}")
print(f"CLI_T {c[0]:.4f},{c[1]:.4f},{-c[2]:.4f}")
print(f"CLI_S {s:.6f}")
