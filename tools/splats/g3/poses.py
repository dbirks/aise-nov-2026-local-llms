# /// script
# requires-python = ">=3.10"
# dependencies = ["numpy"]
# ///
"""Inspect a COLMAP sparse model (cameras/images/points3D .bin) without COLMAP installed.

Used by splat-lab method G3 to (a) sanity-check the Tanks and Temples 'truck' camera model the
training Job loads, (b) estimate the gravity/up direction of the capture from the camera poses, and
(c) get the 3D-point bounds that the splat crop is based on.

    uv run tools/splats/g3/poses.py <dir-with-sparse/0> [--json out.json]
"""
from __future__ import annotations

import argparse
import json
import struct
import sys
from pathlib import Path

import numpy as np


def read_cameras(path: Path):
    out = {}
    with path.open("rb") as f:
        n = struct.unpack("<Q", f.read(8))[0]
        for _ in range(n):
            cid, model, w, h = struct.unpack("<iiQQ", f.read(24))
            npar = {0: 3, 1: 4, 2: 4, 3: 5, 4: 5, 5: 4, 6: 4, 7: 6, 8: 5}[model]
            params = struct.unpack("<" + "d" * npar, f.read(8 * npar))
            out[cid] = dict(model=model, width=w, height=h, params=list(params))
    return out


def read_images(path: Path):
    """image_id -> (qvec w,x,y,z, tvec, camera_id, name). Skips the 2D-point blobs by seeking."""
    out = {}
    with path.open("rb") as f:
        n = struct.unpack("<Q", f.read(8))[0]
        for _ in range(n):
            iid = struct.unpack("<i", f.read(4))[0]
            q = struct.unpack("<4d", f.read(32))
            t = struct.unpack("<3d", f.read(24))
            cam = struct.unpack("<i", f.read(4))[0]
            name = b""
            while True:
                ch = f.read(1)
                if ch == b"\x00":
                    break
                name += ch
            n2d = struct.unpack("<Q", f.read(8))[0]
            f.seek(n2d * 24, 1)  # x,y (2x f64) + point3D_id (i64)
            out[iid] = (q, t, cam, name.decode())
    return out


def read_points(path: Path, max_points: int | None = None):
    xyz = []
    with path.open("rb") as f:
        n = struct.unpack("<Q", f.read(8))[0]
        for _ in range(n):
            f.read(8)  # point3D_id
            xyz.append(struct.unpack("<3d", f.read(24)))
            f.read(3)  # rgb
            f.read(8)  # error
            tlen = struct.unpack("<Q", f.read(8))[0]
            f.seek(tlen * 8, 1)
            if max_points and len(xyz) >= max_points:
                break
    return np.asarray(xyz, dtype=np.float64)


def quat_to_rot(q) -> np.ndarray:
    """COLMAP world->camera rotation from a (w,x,y,z) quaternion."""
    w, x, y, z = q
    return np.array([
        [1 - 2 * (y * y + z * z), 2 * (x * y - w * z), 2 * (x * z + w * y)],
        [2 * (x * y + w * z), 1 - 2 * (x * x + z * z), 2 * (y * z - w * x)],
        [2 * (x * z - w * y), 2 * (y * z + w * x), 1 - 2 * (x * x + y * y)],
    ])


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("dir", help="dataset dir containing sparse/0")
    ap.add_argument("--json", default=None)
    args = ap.parse_args()

    root = Path(args.dir)
    sp = root / "sparse" / "0"
    cams = read_cameras(sp / "cameras.bin")
    imgs = read_images(sp / "images.bin")
    pts = read_points(sp / "points3D.bin")

    # Camera centre C = R^T t (world), image-down axis in world = row 1 of R (world->camera).
    centres, downs, rights, forwards = [], [], [], []
    for q, t, _cam, _name in imgs.values():
        R = quat_to_rot(q)
        centres.append(R.T @ -np.array(t))
        downs.append(R[1])
        rights.append(R[0])
        forwards.append(R[2])
    centres = np.asarray(centres)
    downs = np.asarray(downs)
    up_est = -downs.mean(axis=0)
    up_est /= np.linalg.norm(up_est)

    summary = {
        "images": len(imgs),
        "cameras": {str(k): v for k, v in cams.items()},
        "image_names_sample": sorted(v[3] for v in imgs.values())[:3],
        "sparse_points": int(len(pts)),
        "point_bounds_min": pts.min(axis=0).round(3).tolist(),
        "point_bounds_max": pts.max(axis=0).round(3).tolist(),
        "point_centre": np.median(pts, axis=0).round(3).tolist(),
        "camera_centre_bounds_min": centres.min(axis=0).round(3).tolist(),
        "camera_centre_bounds_max": centres.max(axis=0).round(3).tolist(),
        "mean_camera_to_pointcloud_dist": float(np.linalg.norm(
            centres - pts.mean(axis=0), axis=1).mean()),
        # "up" in the COLMAP world frame, i.e. the direction the cameras point their image-top towards.
        "up_estimate": up_est.round(4).tolist(),
        "up_axis_dominant": "xyz"[int(np.argmax(np.abs(up_est)))],
        "up_axis_sign": int(np.sign(up_est[int(np.argmax(np.abs(up_est)))])),
        "per_image_up_dot_mean_up": float(((-downs) @ up_est).mean()),
    }
    print(json.dumps(summary, indent=2))
    if args.json:
        Path(args.json).write_text(json.dumps(summary, indent=2) + "\n")
        print("wrote", args.json)
    print("\nNOTE: a COLMAP/3DGS world usually has +y pointing DOWN (image row 0 is the top).",
          file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
