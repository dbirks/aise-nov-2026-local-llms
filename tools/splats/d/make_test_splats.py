# /// script
# dependencies = ["numpy", "plyfile"]
# ///
"""Orientation probe for splat-transform's image output.

A grey slab at y=0, a RED blob at y=+1, a BLUE blob at y=-1. Render with
--camera-up 0,1,0: whichever colour is on top tells us the PNG row order.
"""
import numpy as np
from plyfile import PlyData, PlyElement

rng = np.random.default_rng(7)
pos, col = [], []

def blob(center, color, n, spread):
    pos.append(rng.normal(0, spread, (n, 3)) + np.array(center, np.float32))
    col.append(np.full((n, 3), color, np.float32))

blob((0, 0, 0), (0.6, 0.6, 0.6), 4000, (0.8, 0.03, 0.8))   # grey slab at y=0
blob((0, 1.0, 0), (0.95, 0.08, 0.08), 1500, (0.2, 0.2, 0.2))  # RED above
blob((0, -1.0, 0), (0.08, 0.2, 0.95), 1500, (0.2, 0.2, 0.2))  # BLUE below
P = np.vstack(pos).astype(np.float32)
C = np.vstack(col).astype(np.float32)

dt = [('x','f4'),('y','f4'),('z','f4'),('nx','f4'),('ny','f4'),('nz','f4')]
dt += [(f'f_dc_{i}','f4') for i in range(3)]
dt += [('opacity','f4'),('scale_0','f4'),('scale_1','f4'),('scale_2','f4'),
       ('rot_0','f4'),('rot_1','f4'),('rot_2','f4'),('rot_3','f4')]
a = np.zeros(len(P), dtype=dt)
a['x'], a['y'], a['z'] = P[:,0], P[:,1], P[:,2]
for i in range(3):
    a[f'f_dc_{i}'] = ((C[:,i] - 0.5) / 0.28209479).astype(np.float32)
a['opacity'] = np.log(0.99 / 0.01)
for s in ('scale_0','scale_1','scale_2'):
    a[s] = np.where(np.abs(a['y']) > 0.5, -4.0, -3.0).astype(np.float32)
a['rot_0'] = 1.0
PlyData([PlyElement.describe(a, 'vertex')]).write('raw/orient.ply')
print('wrote raw/orient.ply', len(P))
