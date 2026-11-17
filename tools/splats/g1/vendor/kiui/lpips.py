"""``kiui.lpips`` stand-in.

``core/models.py`` does ``from kiui.lpips import LPIPS`` at import time but only *builds* the
loss module when ``Options.lambda_lpips > 0``. Inference never trains, so ``run.sh`` sets
``lambda_lpips=0`` and this class is never instantiated — it exists so the import succeeds
without dragging in the real LPIPS module (which needs torchvision VGG weights at build time).
"""

import torch.nn as nn


class LPIPS(nn.Module):
    def __init__(self, *args, **kwargs):
        raise NotImplementedError(
            "kiui.lpips.LPIPS is vendored as a stub: inference must run with "
            "Options(lambda_lpips=0) so the loss module is never built."
        )
