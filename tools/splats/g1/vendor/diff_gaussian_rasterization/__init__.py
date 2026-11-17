"""``diff_gaussian_rasterization`` stub.

LGM's ``core/gs.py`` imports the CUDA rasteriser at module scope, and ``core/models.py`` imports
``gs`` for ``GaussianRenderer``. We only ever call ``model.gs.save_ply`` (which needs no
rendering), so instead of compiling ``ashawkey/diff-gaussian-rasterization`` for sm_61 — which
needs a -devel CUDA image, nvcc and a compiler toolchain — this stub satisfies the import and
raises if anything tries to render.

That keeps the whole Job inside the ``-runtime`` PyTorch image and off the Pascal compile path.
"""


class GaussianRasterizationSettings:  # pragma: no cover - API shape only
    def __init__(self, *args, **kwargs):
        raise NotImplementedError(
            "diff_gaussian_rasterization is stubbed in splat-lab g1: the pipeline saves the "
            ".ply directly and never renders a preview (see tools/splats/g1/README.md)"
        )


class GaussianRasterizer:  # pragma: no cover - API shape only
    def __init__(self, *args, **kwargs):
        raise NotImplementedError(
            "diff_gaussian_rasterization is stubbed in splat-lab g1: the pipeline saves the "
            ".ply directly and never renders a preview (see tools/splats/g1/README.md)"
        )


def __getattr__(name):  # pragma: no cover - any other symbol fails loudly
    raise AttributeError(f"stub module diff_gaussian_rasterization has no attribute {name!r}")
