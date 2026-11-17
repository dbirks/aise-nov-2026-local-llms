"""Vendored from kiui 0.3.5 `kiui/cam.py` (Apache License 2.0, Copyright (c) 2023
Kiui-Jiaxiang Tang, https://github.com/3DTopia/kiui). Docstrings trimmed, behaviour unchanged.

`look_at`/`orbit_camera` are load-bearing here: LGM feeds `orbit_camera` poses into the
Plücker-ray embedding that conditions its U-Net, and into the multi-view camera embedding of
the diffusion UNet, so the camera convention has to match the checkpoint. kiui 0.2.3 and 0.3.5
agree on both functions (`opengl=True` is the default in both), which is what LGM relies on.
"""

import numpy as np

from .op import safe_normalize


def look_at(campos, target, opengl=True):
    """construct pose rotation matrix by look-at (opengl: forward is target --> camera)."""
    if not opengl:
        # forward is camera --> target
        forward_vector = safe_normalize(target - campos)
        up_vector = np.array([0, 1, 0], dtype=np.float32)
        right_vector = safe_normalize(np.cross(forward_vector, up_vector))
        up_vector = safe_normalize(np.cross(right_vector, forward_vector))
    else:
        # forward is target --> camera
        forward_vector = safe_normalize(campos - target)
        up_vector = np.array([0, 1, 0], dtype=np.float32)
        right_vector = safe_normalize(np.cross(up_vector, forward_vector))
        up_vector = safe_normalize(np.cross(forward_vector, right_vector))
    R = np.stack([right_vector, up_vector, forward_vector], axis=1)
    return R


def orbit_camera(elevation, azimuth, radius=1, is_degree=True, target=None, opengl=True):
    """construct a camera pose matrix orbiting a target; returns float [4, 4]."""
    if is_degree:
        elevation = np.deg2rad(elevation)
        azimuth = np.deg2rad(azimuth)
    x = radius * np.cos(elevation) * np.sin(azimuth)
    y = - radius * np.sin(elevation)
    z = radius * np.cos(elevation) * np.cos(azimuth)
    if target is None:
        target = np.zeros([3], dtype=np.float32)
    campos = np.array([x, y, z]) + target  # [3]
    T = np.eye(4, dtype=np.float32)
    T[:3, :3] = look_at(campos, target, opengl)
    T[:3, 3] = campos
    return T
