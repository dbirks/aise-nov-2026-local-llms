"""``xformers.ops`` shim — see the package docstring in ``..__init__``.

Provides ``memory_efficient_attention`` (SDPA-backed) and ``unbind``. Accepts xformers' 3-D
``[B, M, K]`` (single head) and 4-D ``[B, H, M, K]`` layouts, fp16/bf16/fp32, and applies the
same default softmax scale as xformers (1/sqrt(K)) — that matters, because LGM's fallback
``Attention`` pre-scales q itself while ``MemEffAttention`` relies on the kernel to do it.
"""

from typing import Optional

import torch
import torch.nn.functional as F


def unbind(tensor: torch.Tensor, dim: int = 0):
    """xformers.ops.unbind: split a tensor along `dim` into a tuple."""
    return torch.unbind(tensor, dim=dim)


def _sdpa(q, k, v, dropout_p: float, scale: Optional[float]):
    squeeze_head = q.dim() == 3
    if squeeze_head:
        q, k, v = (t.unsqueeze(1) for t in (q, k, v))  # [B, M, K] -> [B, 1, M, K]
    out = F.scaled_dot_product_attention(
        q, k, v, dropout_p=dropout_p, scale=scale
    )  # scale=None -> 1/sqrt(K), same default as xformers
    if squeeze_head:
        out = out.squeeze(1)
    return out


def memory_efficient_attention(
    query: torch.Tensor,
    key: torch.Tensor,
    value: torch.Tensor,
    attn_bias: Optional[object] = None,
    compute_log_sumexp: bool = False,
    dropout_p: float = 0.0,
    bias: Optional[torch.Tensor] = None,
    scale: Optional[float] = None,
    op=None,
):
    """Drop-in for xformers' cutlass FMHA, computed with torch SDPA (works on Pascal sm_61)."""
    if attn_bias is not None:
        raise NotImplementedError(
            "the xformers SDPA shim only supports attn_bias=None (LGM passes None; "
            "nested-tensor/BlockDiagonal biases are not used by the inference path)"
        )
    if bias is not None:
        # additive float bias -> SDPA's attn_mask
        squeeze_head = query.dim() == 3
        q = query.unsqueeze(1) if squeeze_head else query
        k = key.unsqueeze(1) if squeeze_head else key
        v = value.unsqueeze(1) if squeeze_head else value
        out = F.scaled_dot_product_attention(
            q, k, v, attn_mask=bias.to(q.dtype), dropout_p=dropout_p, scale=scale
        )
        return out.squeeze(1) if squeeze_head else out
    return _sdpa(query, key, value, dropout_p, scale)


# a couple of names exist only so that `hasattr`/import probes behave
def set_library_options(*args, **kwargs):  # pragma: no cover - no-op
    return None


class _Noop:
    """Placeholder for xformers.ops.fmha options objects."""

    def __init__(self, *args, **kwargs):
        pass

    def __call__(self, *args, **kwargs):
        return memory_efficient_attention(*args, **kwargs)


class fmha:
    LowerTriangularMask = _Noop
    AttentionBias = _Noop
