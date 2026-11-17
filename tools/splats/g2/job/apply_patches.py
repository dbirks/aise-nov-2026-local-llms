#!/usr/bin/env python3
"""splat-lab g2 · compatibility patches for the DiffSplat checkout (idempotent).

Only three edits, all import-graph surgery so the SD1.5 text-to-splat path can be imported
without the training/evaluation stack. Nothing here changes numerics.

1. `src/utils/__init__.py`  - upstream re-exports `metrics` (needs the `image-reward` +
   `kiui.lpips` packages) and `vis_util` (needs `wandb`). The modules we import need exactly
   `plucker_ray`/`unproject_depth` (geo_util), `patchify`/`unpatchify` (op_util) and
   `IMAGENET_MEAN`/`IMAGENET_STD` (defined in vis_util; copied verbatim here instead).
2. `extensions/diffusers_diffsplat/{__init__,models/__init__,pipelines/__init__}.py` - keep the
   SD1.5 UNet + pipeline only, so the SDXL / PixArt / SD3 / ControlNet variants (and their
   T5/GPT/extra-diffusers imports) are never touched.
3. `diff_gaussian_rasterization` stub - the CUDA rasterizer is only used for preview renders;
   the .ply export does not need it. A stub module keeps `src/models/gs_render/gs_util.py`'s
   top-level import satisfiable when the sm_61 build is not available. If the real extension is
   importable, nothing is written.

Every replaced file is kept once as `<file>.upstream` for diffing.
"""
from __future__ import annotations

import os
import sys

UTILS_INIT = '''# patched by tools/splats/g2/job/apply_patches.py (splat-lab g2): inference-only subset.
# Upstream also re-exports metrics (image-reward), vis_util (wandb) and util (omegaconf);
# none of them are on the text->splat path, see the module docstring of the patch script.
from src.utils.geo_util import *  # noqa: F401,F403  (orbit_camera, plucker_ray, unproject_depth, ...)
from src.utils.op_util import patchify, unpatchify

# copied verbatim from src/utils/vis_util.py
IMAGENET_MEAN = [0.485, 0.456, 0.406]
IMAGENET_STD = [0.229, 0.224, 0.225]
'''

EXT_INIT = '''# patched by tools/splats/g2/job/apply_patches.py (splat-lab g2): SD1.5 subset only.
from .models.unets import UNetMV2DConditionModel  # noqa: F401
from .pipelines.pipeline_mv_stable_diffusion import StableMVDiffusionPipeline  # noqa: F401
'''

MODELS_INIT = '''# patched by tools/splats/g2/job/apply_patches.py (splat-lab g2): SD1.5 subset only.
from .unets import UNetMV2DConditionModel  # noqa: F401
'''

PIPELINES_INIT = '''# patched by tools/splats/g2/job/apply_patches.py (splat-lab g2): SD1.5 subset only.
from .pipeline_mv_stable_diffusion import StableMVDiffusionPipeline  # noqa: F401
'''

STUB = '''"""splat-lab g2 stub of the 3DGS CUDA rasterizer (RaDe-GS fork).

Written by tools/splats/g2/job/apply_patches.py when the sm_61 build of
diff-gaussian-rasterization is unavailable. It satisfies the import in
src/models/gs_render/gs_util.py so that Gaussian *export* works; calling it raises, so the
optional verification contact sheet is skipped and recorded as such in metrics.json.
"""
from typing import NamedTuple


class GaussianRasterizationSettings(NamedTuple):
    image_height: int = 0
    image_width: int = 0
    tanfovx: float = 0.0
    tanfovy: float = 0.0
    kernel_size: float = 0.0
    bg: object = None
    scale_modifier: float = 1.0
    viewmatrix: object = None
    projmatrix: object = None
    sh_degree: int = 0
    campos: object = None
    prefiltered: bool = False
    debug: bool = False
    require_depth: bool = False
    require_coord: bool = False


class GaussianRasterizer:
    def __init__(self, raster_settings=None):
        self.raster_settings = raster_settings

    def __call__(self, *args, **kwargs):
        raise NotImplementedError(
            "diff_gaussian_rasterization is a stub in this Job: the sm_61 build of the RaDe-GS "
            "fork was not available. Splat export does not need it; only preview renders do."
        )

    def sample(self, *args, **kwargs):
        raise NotImplementedError("stub rasterizer: sample() is training-only")
'''


def write(path: str, content: str, root: str) -> bool:
    """Write `content` to `path` unless it already matches; keep the original once."""
    full = os.path.join(root, path)
    if not os.path.isdir(os.path.dirname(full)):
        print(f"  ! missing directory for {path}")
        return False
    original = os.path.join(root, path + ".upstream")
    if os.path.exists(full) and not os.path.exists(original):
        with open(full, "rb") as fh:
            data = fh.read()
        with open(original, "wb") as fh:
            fh.write(data)
    if os.path.exists(full):
        with open(full, "r", encoding="utf-8") as fh:
            if fh.read() == content:
                print(f"  = {path} (already patched)")
                return False
    with open(full, "w", encoding="utf-8") as fh:
        fh.write(content)
    print(f"  + {path}")
    return True


def main() -> int:
    repo = sys.argv[1] if len(sys.argv) > 1 else "/data/cache/repo/DiffSplat"
    print(f"patching {repo}")
    changed = 0
    for path, content in {
        "src/utils/__init__.py": UTILS_INIT,
        "extensions/diffusers_diffsplat/__init__.py": EXT_INIT,
        "extensions/diffusers_diffsplat/models/__init__.py": MODELS_INIT,
        "extensions/diffusers_diffsplat/pipelines/__init__.py": PIPELINES_INIT,
    }.items():
        changed += int(write(path, content, repo))

    # stub rasterizer, only if the real extension is not importable and not already installed
    try:
        import diff_gaussian_rasterization  # noqa: F401
        print("  - diff_gaussian_rasterization importable: no stub")
    except Exception:
        stub_dir = os.environ.get("G2_STUB_DIR", "/data/cache/g2/stub")
        pkg = os.path.join(stub_dir, "diff_gaussian_rasterization")
        os.makedirs(pkg, exist_ok=True)
        with open(os.path.join(pkg, "__init__.py"), "w", encoding="utf-8") as fh:
            fh.write(STUB)
        print(f"  + stub diff_gaussian_rasterization -> {pkg}")
    print(f"patches applied: {changed}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
