# /// script
# dependencies = ["numpy", "pandas"]
# ///
"""Print alpha-weighted PCA axes + the 'legs vs back' direction of a splat CSV.
Usage: uv run pose.py <file.csv> [min_y_filter]"""
import sys, numpy as np, pandas as pd
cols = ['x','y','z','opacity','f_dc_0','f_dc_1','f_dc_2']
p = pd.read_csv(sys.argv[1], usecols=cols).to_numpy(np.float64)
x,y,z,op,c0,c1,c2 = (p[:,i] for i in range(7))
a = 1/(1+np.exp(-np.clip(op,-30,30))) if np.abs(op).max() > 2 else np.clip(op,0,1)
rgb = np.stack([c0,c1,c2],-1)*0.28209479+0.5
lum = np.clip(0.2126*rgb[:,0]+0.7152*rgb[:,1]+0.0722*rgb[:,2],0,1)
P = np.stack([x,y,z],-1)
w = np.clip(a,0,1); w = w/w.sum()
c = (P*w[:,None]).sum(0)
Q = P - c
cov = (Q*w[:,None]).T @ Q
ev, evec = np.linalg.eigh(cov)
order = ev.argsort()[::-1]
print("centre", c.round(4), " (opacity-weighted)")
for i in range(3):
    print(f"axis{i} var={ev[order[i]]:.4f} dir={evec[:,order[i]].round(3)}")
for name, mask in (('bright', lum > np.percentile(lum, 80)), ('dark', lum < np.percentile(lum, 20))):
    m = mask & (a > 0.3)
    if m.sum() > 50:
        off = ((P[m]*a[m,None]).sum(0)/a[m].sum()) - c
        print(f"{name} subset (n={m.sum()}) offset from centre: {off.round(4)}  |off|={np.linalg.norm(off):.4f}")
print("bounds", P.min(0).round(4), P.max(0).round(4))
print("extent", (P.max(0)-P.min(0)).round(4))
