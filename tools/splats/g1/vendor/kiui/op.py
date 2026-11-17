"""Vendored from kiui 0.3.5 `kiui/op.py` (Apache License 2.0, Copyright (c) 2023
Kiui-Jiaxiang Tang, https://github.com/3DTopia/kiui). Docstrings trimmed, behaviour unchanged.
Only the four helpers LGM's inference path needs are kept.
"""

from typing import Union

import cv2
import numpy as np
import torch
from numpy import ndarray
from torch import Tensor


def dot(x: Union[Tensor, ndarray], y: Union[Tensor, ndarray]) -> Union[Tensor, ndarray]:
    """dot product (along the last dim)."""
    return (x * y).sum(-1, keepdims=True)


def length(x: Union[Tensor, ndarray], eps: float = 1e-20) -> Union[Tensor, ndarray]:
    """length of an array (along the last dim)."""
    if isinstance(x, np.ndarray):
        return np.sqrt(np.maximum(np.sum(x * x, axis=-1, keepdims=True), eps))
    else:
        return torch.sqrt(torch.clamp(dot(x, x), min=eps))


def safe_normalize(x: Union[Tensor, ndarray], eps: float = 1e-20) -> Union[Tensor, ndarray]:
    """normalize an array (along the last dim)."""
    return x / length(x, eps)


def inverse_sigmoid(x: Tensor, eps: float = 1e-6) -> Tensor:
    """inversion of sigmoid function: log(x / (1 - x))."""
    x = x.clamp(eps, 1 - eps)
    return torch.log(x / (1 - x))


def recenter(image: ndarray, mask: ndarray, border_ratio: float = 0.2) -> ndarray:
    """recenter an image to leave some empty space at the image border."""
    return_int = False
    if image.dtype == np.uint8:
        image = image.astype(np.float32) / 255
        return_int = True

    H, W, C = image.shape
    size = max(H, W)

    # default to white bg if rgb, but use 0 if rgba
    if C == 3:
        result = np.ones((size, size, C), dtype=np.float32)
    else:
        result = np.zeros((size, size, C), dtype=np.float32)

    coords = np.nonzero(mask)
    x_min, x_max = coords[0].min(), coords[0].max()
    y_min, y_max = coords[1].min(), coords[1].max()
    h = x_max - x_min
    w = y_max - y_min
    desired_size = int(size * (1 - border_ratio))
    scale = desired_size / max(h, w)
    h2 = int(h * scale)
    w2 = int(w * scale)
    x2_min = (size - h2) // 2
    x2_max = x2_min + h2
    y2_min = (size - w2) // 2
    y2_max = y2_min + w2
    result[x2_min:x2_max, y2_min:y2_max] = cv2.resize(
        image[x_min:x_max, y_min:y_max], (w2, h2), interpolation=cv2.INTER_AREA
    )

    if return_int:
        result = (result * 255).astype(np.uint8)

    return result
