"""Small stand-in for the parts of ``kiui`` that LGM's inference path touches.

LGM (MIT, https://github.com/3DTopia/LGM) imports ``kiui`` (Apache-2.0,
https://github.com/3DTopia/kiui) from four places:

* ``mvdream/mv_unet.py``  -> ``from kiui.cam import orbit_camera`` (camera conditioning of the
  multi-view diffusion),
* ``core/models.py``      -> ``import kiui`` + ``from kiui.lpips import LPIPS`` (the LPIPS loss is
  imported unconditionally but only *built* when ``Options.lambda_lpips > 0``; inference sets it
  to 0, so ``LPIPS`` stays a stub and no VGG weights are downloaded),
* ``core/gs.py``          -> ``kiui.op.inverse_sigmoid`` inside ``save_ply``,
* ``core/utils.py``       -> ``from kiui.op import safe_normalize`` inside ``get_rays``.

The real distribution needs lazy_loader + trimesh + pymeshlab + opencv + imageio + viser + ...
(most of it for mesh/vis work we never call), so this package vendors exactly those helpers.
``length``/``safe_normalize``/``inverse_sigmoid``/``recenter``/``look_at``/``orbit_camera`` are
copied from kiui 0.3.5 (Apache License 2.0, Copyright (c) 2023 Kiui-Jiaxiang Tang) with the
docstrings trimmed and the type aliases inlined; the maths is unchanged.
"""

from . import cam, lpips, op  # noqa: F401  (keeps `kiui.op...` attribute access working)
from .cam import look_at, orbit_camera  # noqa: F401
from .op import inverse_sigmoid, length, recenter, safe_normalize  # noqa: F401

import os
import random

import numpy as np


def seed_everything(seed: int = 42, verbose: bool = False, strict: bool = False) -> None:
    """Set random/numpy/torch seeds (same effect as kiui.utils.seed_everything)."""
    import torch

    os.environ["PYTHONHASHSEED"] = str(seed)
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)
    torch.cuda.manual_seed_all(seed)
    if strict:
        torch.use_deterministic_algorithms(True)
        torch.backends.cudnn.deterministic = True
    if verbose:
        print(f"[INFO] seed_everything({seed}, strict={strict})")


__version__ = "0.3.5+splatlab-vendored"
