#!/usr/bin/env python3
"""splat-lab g1 self-test: does the vendored shim layer + LGM's code actually run?

Runs with **random weights** on whichever device is available (the CPU on the workstation, the
1070 inside the Job — `run.sh setup` calls it after installing the venv) and checks the plumbing
around LGM, not model quality:

 1. the fake ``xformers`` agrees with an explicit softmax(QKᵀ/√d)V, in fp32 and fp16;
 2. ``kiui`` (vendored) reproduces LGM's camera/normalisation helpers;
 3. ``core.models.LGM`` imports with ``diff_gaussian_rasterization`` stubbed, builds, and
    ``prepare_default_rays`` + ``forward_gaussians`` + ``gs.save_ply`` produce a readable 3DGS
    .ply with the expected attribute list and 4·splat_size² Gaussians;
 4. the ``big`` U-Net channel plan agrees with the splat_size it claims (LGM reshapes the U-Net
    output with that number, so a wrong config fails here rather than in a 20-minute GPU run).

A tiny config at a low resolution keeps this under a few seconds and ~400 MB; the real run uses
`big` with the downloaded checkpoint (tools/splats/g1/lgm2ply.py).

    python3 tools/splats/g1/selftest.py            # CPU
    G1_VENDOR=... LGM_DIR=... python3 tools/splats/g1/selftest.py --device cuda
"""

import argparse
import os
import sys
import time

VENDOR = os.environ.get("G1_VENDOR", os.path.join(os.path.dirname(os.path.abspath(__file__)), "vendor"))
LGM_DIR = os.environ.get("LGM_DIR", "/tmp/LGM")
for p in (VENDOR, LGM_DIR):
    if p not in sys.path:
        sys.path.insert(0, p)

import numpy as np  # noqa: E402
import torch  # noqa: E402
import torch.nn.functional as F  # noqa: E402


def check(label: str, ok: bool, detail: str = "") -> bool:
    print(f"[selftest] {'ok  ' if ok else 'FAIL'} {label} {detail}")
    return ok


def test_xformers_shim() -> bool:
    import xformers  # vendored
    import xformers.ops as xops

    print(f"[selftest] xformers resolved to {os.path.dirname(xformers.__file__)} "
          f"({xformers.__version__})")
    ok = True
    torch.manual_seed(0)
    for dtype in (torch.float32, torch.float16):
        for shape in ((2, 6, 5, 8), (2, 3, 4, 5, 8)):  # 4-D [B,H,M,K] and 3-D [B,M,K]
            q, k, v = (torch.randn(*shape, dtype=dtype) * s for s in (1, 1, 1))
            out = xops.memory_efficient_attention(q, k, v, attn_bias=None)
            if q.dim() == 3:
                q4, k4, v4 = (t.unsqueeze(1) for t in (q, k, v))
            else:
                q4, k4, v4 = q, k, v
            ref = F.scaled_dot_product_attention(q4.float(), k4.float(), v4.float()).squeeze(1) \
                if q.dim() == 3 else F.scaled_dot_product_attention(q4.float(), k4.float(), v4.float())
            err = (out.float() - ref.float()).abs().max().item()
            ok &= check(f"memory_efficient_attention {dtype} {tuple(shape)}",
                        bool(torch.isfinite(out.float()).all()) and err < 3e-2, f"max|Δ|={err:.2e}")
    # explicit reference, independent of SDPA
    B, H, M, K = 2, 3, 7, 8
    q, k, v = (torch.randn(B, H, M, K, dtype=torch.float32) for _ in range(3))
    ref = torch.softmax(q @ k.transpose(-1, -2) / K ** 0.5, dim=-1) @ v
    out = xops.memory_efficient_attention(q, k, v)
    ok &= check("matches softmax(QKᵀ/√d)V", (out - ref).abs().max().item() < 1e-4,
                f"max|Δ|={(out - ref).abs().max().item():.2e}")
    # LGM's MemEffAttention reshapes to [B, N, 3, H, Dh] and unbinds dim 2 (no permute), so the
    # xformers call sees [B, N, H, Dh]. torch.unbind (and xformers.ops.unbind) give exactly that;
    # SDPA/xformers then interpret the dims positionally — matched by this shim, deliberately.
    qkv = torch.randn(B, M, 3, H, K)
    ok &= check("unbind(qkv, 2) -> 3 x [B, N, H, Dh]",
                all(t.shape == (B, M, H, K) for t in xops.unbind(qkv, 2)))
    return bool(ok)


def test_kiui() -> bool:
    import kiui
    from kiui.cam import orbit_camera
    from kiui.op import inverse_sigmoid, recenter, safe_normalize

    print(f"[selftest] kiui resolved to {os.path.dirname(kiui.__file__)} ({kiui.__version__})")
    ok = check("kiui importable as a package", hasattr(kiui, "op") and hasattr(kiui, "cam"))
    T = orbit_camera(0, 90, radius=1.5)
    ok &= check("orbit_camera(0,90).translation ≈ (+1.5, 0, 0)",
                bool(np.allclose(T[:3, 3], [1.5, 0.0, 0.0], atol=1e-5)), f"{T[:3, 3]}")
    ok &= check("orbit_camera rotation is orthonormal",
                bool(np.allclose(T[:3, :3].T @ T[:3, :3], np.eye(3), atol=1e-5)))
    T270 = orbit_camera(0, 270, radius=1.5)
    ok &= check("orbit_camera(0,270).translation ≈ (-1.5, 0, 0)",
                bool(np.allclose(T270[:3, 3], [-1.5, 0.0, 0.0], atol=1e-5)), f"{T270[:3, 3]}")
    a = np.array([[3.0, 4.0]], dtype=np.float32)
    ok &= check("safe_normalize (numpy)", bool(np.allclose(safe_normalize(a), [[0.6, 0.8]], atol=1e-6)))
    x = torch.tensor([[0.25, 0.5, 0.9]])
    ok &= check("inverse_sigmoid round-trips sigmoid",
                bool(torch.allclose(torch.sigmoid(inverse_sigmoid(x)), x, atol=1e-5)))
    img = np.zeros((64, 64, 4), np.float32)
    img[20:30, 40:50] = 1.0
    mask = img[..., 3] > 0
    out = recenter(img, mask, border_ratio=0.2)
    coords = np.nonzero(out[..., 3] > 0)
    h = coords[0].max() - coords[0].min()
    ok &= check("recenter keeps aspect and adds border", out.shape == (64, 64, 4) and h < 64 * 0.85,
                f"shape={out.shape} bbox_h={h}")
    return bool(ok)


def expected_splat_size(opt) -> int:
    """LGM reshapes the U-Net output to opt.splat_size; the ratio comes from the level counts."""
    downs = len(opt.down_channels) - 1
    ups = len(opt.up_channels) - 1
    return opt.input_size // 2 ** (downs - ups)


def _cpu_renderer_init_fallback():
    """`core.gs.GaussianRenderer.__init__` hard-codes device='cuda' for a 3-element constant.

    Only for the CPU self-test (this workstation has no GPU); inside the Job the upstream
    version runs untouched. The body below is the same 8 lines with the device taken from torch's
    default — nothing that affects save_ply is changed.
    """
    import core.gs as gs

    original = gs.GaussianRenderer.__init__

    def init(self, opt):
        try:
            original(self, opt)
            return
        except RuntimeError as e:  # no driver on this box
            print(f"[selftest] GaussianRenderer.__init__ needs CUDA ({e}); CPU stand-in only")
        self.opt = opt
        self.bg_color = torch.tensor([1, 1, 1], dtype=torch.float32)
        self.tan_half_fov = np.tan(0.5 * np.deg2rad(opt.fovy))
        self.proj_matrix = torch.zeros(4, 4, dtype=torch.float32)
        self.proj_matrix[0, 0] = 1 / self.tan_half_fov
        self.proj_matrix[1, 1] = 1 / self.tan_half_fov
        self.proj_matrix[2, 2] = (opt.zfar + opt.znear) / (opt.zfar - opt.znear)
        self.proj_matrix[3, 2] = -(opt.zfar * opt.znear) / (opt.zfar - opt.znear)
        self.proj_matrix[2, 3] = 1

    gs.GaussianRenderer.__init__ = init


def test_lgm_forward(device: torch.device, input_size: int) -> bool:
    from core.models import LGM
    from core.options import config_defaults

    if device.type == "cpu":
        _cpu_renderer_init_fallback()

    ok = True
    opt = config_defaults["tiny"]  # smallest channel plan: same code path, ~1 s on CPU
    opt.lambda_lpips = 0.0         # must be 0: kiui.lpips is a stub in this environment
    opt.input_size = input_size
    opt.splat_size = expected_splat_size(opt)
    print(f"[selftest] tiny config: input_size={opt.input_size} splat_size={opt.splat_size} "
          f"(down {opt.down_channels} / up {opt.up_channels})")

    t0 = time.perf_counter()
    model = LGM(opt).to(device).eval()
    n_params = sum(p.numel() for p in model.parameters())
    print(f"[selftest] LGM built in {time.perf_counter() - t0:.1f}s, {n_params / 1e6:.1f}M params "
          f"(random weights)")

    # LGM's checkpoint shape must match: check the big config's declared splat_size too.
    big = config_defaults["big"]
    ok &= check("big config splat_size agrees with its level counts",
                big.splat_size == big.input_size // 2 ** (len(big.down_channels) - 1
                                                          - (len(big.up_channels) - 1)),
                f"splat_size={big.splat_size} input={big.input_size}")

    rays = model.prepare_default_rays(device, elevation=0)
    ok &= check("prepare_default_rays shape [4, 6, H, W]",
                tuple(rays.shape) == (4, 6, opt.input_size, opt.input_size), f"{tuple(rays.shape)}")
    rays_hw = rays[:, 3:6].permute(0, 2, 3, 1).reshape(-1, 3)
    ok &= check("ray directions are unit length",
                bool((rays_hw.norm(dim=-1) - 1).abs().max() < 1e-3),
                f"max|‖d‖-1|={float((rays_hw.norm(dim=-1) - 1).abs().max()):.2e}")
    ok &= check("rays are finite", bool(torch.isfinite(rays).all()))

    x = torch.rand(4, 3, opt.input_size, opt.input_size, device=device)
    x = torch.cat([x, rays.to(device).to(x.dtype)], dim=1).unsqueeze(0)  # [1, 4, 9, H, W]
    t0 = time.perf_counter()
    with torch.no_grad():
        g = model.forward_gaussians(x)
    n_expected = 4 * opt.splat_size * opt.splat_size
    ok &= check("forward_gaussians -> [1, 4·splat_size², 14]",
                tuple(g.shape) == (1, n_expected, 14),
                f"{tuple(g.shape)} in {time.perf_counter() - t0:.1f}s")
    rgb_ok = bool((g[..., 11:14] >= 0).all() and (g[..., 11:14] <= 1).all())
    ok &= check("activations in range (pos ±1, opacity/scale/rgb > 0)",
                bool(g[..., 0:3].abs().max() <= 1.0 and g[..., 3:4].min() > 0
                     and g[..., 4:7].min() > 0 and rgb_ok),
                f"pos_max={float(g[..., 0:3].abs().max()):.3f} scale_min={float(g[..., 4:7].min()):.2e}")
    qn = g[..., 7:11].norm(dim=-1)
    ok &= check("quaternions normalised (the bug fixed in fe8d12c)",
                bool((qn - 1).abs().max() < 1e-4), f"max|‖q‖-1|={float((qn - 1).abs().max()):.2e}")

    out = "/tmp/g1-selftest.ply"
    model.gs.save_ply(g, out)  # exercises the kiui.op.inverse_sigmoid path + plyfile writer
    from plyfile import PlyData

    el = PlyData.read(out)["vertex"]
    need = ["x", "y", "z", "f_dc_0", "f_dc_1", "f_dc_2", "opacity",
            "scale_0", "scale_1", "scale_2", "rot_0", "rot_1", "rot_2", "rot_3"]
    have = [p.name for p in el.properties]
    ok &= check("ply has the 3DGS attribute set", all(n in have for n in need), f"{have}")
    ok &= check("ply count ≤ forward count (opacity ≥ 0.005 prune)",
                0 < el.count <= n_expected, f"{el.count} of {n_expected} kept, {os.path.getsize(out)} bytes")
    os.remove(out)
    return bool(ok)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--device", default="auto", choices=["auto", "cpu", "cuda"])
    ap.add_argument("--input-size", type=int, default=64)
    args = ap.parse_args()
    device = torch.device("cuda" if (args.device in ("auto", "cuda") and torch.cuda.is_available()) else "cpu")
    print(f"[selftest] torch {torch.__version__} device {device}")

    results = [("xformers shim", test_xformers_shim()),
               ("kiui helpers", test_kiui()),
               (f"LGM forward on {device.type}", test_lgm_forward(device, args.input_size))]
    bad = [name for name, ok in results if not ok]
    for name, ok in results:
        print(f"[selftest] {'PASS' if ok else 'FAIL'} {name}")
    if bad:
        print(f"[selftest] FAILED: {bad}")
        return 1
    print("[selftest] all checks passed")
    return 0


if __name__ == "__main__":
    sys.exit(main())
