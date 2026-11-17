"""Fake ``xformers`` package: a thin adapter onto ``torch.nn.functional.scaled_dot_product_attention``.

Why: LGM and the ImageDream/MVDream UNet call ``xformers.ops.memory_efficient_attention``, but
the real wheel ships FA2/Cutlass-FMHA kernels that need SM70+. Our GPU is a GTX 1070 (Pascal,
sm_61), where xformers raises "no kernel found". PyTorch's own SDPA *does* have a path for
Pascal (math / mem-efficient backend), so this shim keeps the numerics at fp16 while dropping the
SM70 requirement. Only the pieces LGM imports are provided.
"""

__version__ = "0.0.0+splatlab-sdpa"
__author__ = "splat-lab g1"
