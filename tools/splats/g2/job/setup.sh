#!/usr/bin/env bash
# splat-lab g2 · Job environment preparation (DiffSplat / SD1.5 variant on a Pascal GTX 1070).
#
# Everything expensive is cached on the splat-lab-data PVC under /data/cache/g2 so a re-run of
# the Job costs model-load + inference, not download + compile:
#   /data/cache/venv-g2            venv (--system-site-packages: torch/torchvision/cuDNN from
#                                  the pytorch image; our pins layered on top)
#   /data/cache/repo/DiffSplat     pinned checkout, patched
#   /data/cache/repo/RaDe-GS       source of the 3DGS rasterizer fork DiffSplat uses
#   /data/cache/g2/wheels          the diff_gaussian_rasterization wheel built for sm_61
#   /data/cache/ckpt/DiffSplat     HF weights (DiffSplat SD1.5 UNet-EMA + GSVAE)
#   /data/cache/hf                 HF hub cache (SD1.5 text encoder/VAE/tokenizer/scheduler, taesd)
#   /data/cache/pip                pip wheel cache
#
# Not run locally on purpose: this box has no GPU. See tools/splats/g2/README.md.
set -uo pipefail

: "${OUT:=/data/out/diffsplat-1}"
CACHE=/data/cache
VENV=$CACHE/venv-g2
REPO=$CACHE/repo/DiffSplat
RADEGS=$CACHE/repo/RaDe-GS
G2=$CACHE/g2
WHEELS=$G2/wheels
CKPT=$CACHE/ckpt/DiffSplat
STUB=$G2/stub

DIFFSPLAT_COMMIT=a99d75707541009283bc5c073f1a07b5add41d00   # main, 2026-03-19 ("minor")
RADEGS_COMMIT=d72f20792005ae1d6555a82aa2d15345f247604e      # main, RaDe-GS (rasterizer fork)
# (the same pins live in job/fetch_sources.py, which does the fetching)

mkdir -p "$OUT" "$G2" "$WHEELS" "$STUB" "$CACHE/repo" "$CKPT" "$CACHE/hf" "$CACHE/pip"
exec > >(tee -a "$OUT/setup.log") 2>&1
say() { echo "[setup $(date +%H:%M:%S)] $*"; }

say "=== 0. node / image ==============================================="
date -u
python -V
nvcc --version | tail -2 || echo "no nvcc (runtime image?)"
nvidia-smi --query-gpu=name,memory.total,driver_version --format=csv || say "nvidia-smi failed"
python - <<'PY'
import torch
print("torch", torch.__version__, "cuda", torch.version.cuda, "avail", torch.cuda.is_available())
print("arch list", torch.cuda.get_arch_list())
print("capability", torch.cuda.get_device_capability(0), "name", torch.cuda.get_device_name(0))
print("bf16 supported", torch.cuda.is_bf16_supported())
PY

say "=== 1. venv (cached) ==============================================="
REQ_HASH=$(sha256sum /scripts/requirements.txt | cut -c1-12)
PYV=$(python -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")')
MARK=$G2/venv-$REQ_HASH-py$PYV.ok
if [[ ! -f $MARK ]]; then
  say "creating venv (requirements hash $REQ_HASH, python $PYV)"
  rm -rf "$VENV"
  python -m venv --system-site-packages "$VENV"
  "$VENV/bin/python" -m pip install -q --upgrade pip
  PIP_CACHE_DIR=$CACHE/pip "$VENV/bin/python" -m pip install -q -r /scripts/requirements.txt
  touch "$MARK"
else
  say "venv cache hit ($MARK)"
  PIP_CACHE_DIR=$CACHE/pip "$VENV/bin/python" -m pip install -q -r /scripts/requirements.txt
fi
"$VENV/bin/python" -m pip freeze | sort > "$OUT/pip-freeze.txt"
say "venv python: $VENV/bin/python ($($VENV/bin/python -V 2>&1))"
head -1 "$OUT/pip-freeze.txt" >/dev/null && say "pip freeze -> $OUT/pip-freeze.txt"

say "=== 2. sources (pinned, no git in this image) ===================="
# The pytorch devel image ships no `git`, so the pinned trees come from GitHub's codeload
# archives via job/fetch_sources.py (urllib + tarfile, cached under /data/cache/g2/dl).
"$VENV/bin/python" /scripts/fetch_sources.py || say "source fetch reported failures (continuing; the run step will fail loudly if DiffSplat is missing)"
RASTER_SRC=$RADEGS/submodules/diff-gaussian-rasterization
say "DiffSplat commit: $(cat "$REPO/.source-sha" 2>/dev/null || echo MISSING)"
say "rasterizer source: $(ls "$RASTER_SRC" 2>/dev/null | tr '\n' ' ' || echo MISSING)"
if [[ -d "$RASTER_SRC/third_party/glm/glm" ]]; then
  say "glm headers: $(find "$RASTER_SRC/third_party/glm" -name '*.hpp' | wc -l) .hpp + $(find "$RASTER_SRC/third_party/glm" -name '*.inl' | wc -l) .inl files"
else
  say "glm headers MISSING (rasterizer build will fail)"
fi

say "=== 3. patches ====================================================="
G2_STUB_DIR=$STUB "$VENV/bin/python" /scripts/apply_patches.py "$REPO"

say "=== 4. rasterizer for sm_61 ========================================="
export TORCH_CUDA_ARCH_LIST="6.1"
RASTER_STATUS=$G2/rasterizer.txt
existing=$(ls "$WHEELS"/diff_gaussian_rasterization-*.whl 2>/dev/null | head -1)
if [[ -z $existing ]]; then
  say "building diff_gaussian_rasterization for TORCH_CUDA_ARCH_LIST=$TORCH_CUDA_ARCH_LIST (slow step, capped at 30 min)"
  build_log=$G2/rasterizer-build.log
  # --no-build-isolation: pip's default isolated build env does not see torch (the extension's
  # setup.py imports torch at parse time -> ModuleNotFoundError: No module named 'torch').
  "$VENV/bin/python" -m pip install -q --upgrade setuptools wheel >/dev/null 2>&1 || true
  if TMPDIR=$G2 PIP_CACHE_DIR=$CACHE/pip MAX_JOBS=4 timeout 1800 \
       "$VENV/bin/python" -m pip wheel --no-deps --no-build-isolation -w "$WHEELS" "$RASTER_SRC" > "$build_log" 2>&1; then
    say "build ok"
  else
    say "build FAILED/TIMED OUT - last 40 lines of $build_log:"
    tail -40 "$build_log"
    rm -f "$WHEELS"/diff_gaussian_rasterization-*.whl
  fi
  existing=$(ls "$WHEELS"/diff_gaussian_rasterization-*.whl 2>/dev/null | head -1)
fi
if [[ -n $existing ]]; then
  say "installing $existing"
  "$VENV/bin/python" -m pip install -q --no-deps --force-reinstall "$existing" || true
fi
# Does the *compiled* extension import (it must also load on sm_61, not just exist)?
# The stub lives outside site-packages, so it is only ever visible through PYTHONPATH -
# never add it unconditionally, it would shadow the real build.
if "$VENV/bin/python" -c 'import sys, diff_gaussian_rasterization as d; sys.exit(0 if hasattr(d, "_C") else 1)' 2>/dev/null; then
  echo real > "$RASTER_STATUS"
  "$VENV/bin/python" -c 'import torch, diff_gaussian_rasterization as d; print("rasterizer loaded from", d.__file__)' || true
else
  echo stub > "$RASTER_STATUS"
fi
say "rasterizer status: $(cat "$RASTER_STATUS" 2>/dev/null || echo unknown)"
cat > $G2/run.env <<EOF
export G2_VENV=$VENV
export G2_PYTHON=$VENV/bin/python
export DIFFSPLAT_REPO=$REPO
export DIFFSPLAT_CKPT=$CKPT
EOF
if [[ $(cat "$RASTER_STATUS") == stub ]]; then
  echo "export PYTHONPATH=$STUB" >> $G2/run.env
  say "stub rasterizer will be on PYTHONPATH (no preview sheets)"
fi

say "=== 5. weights (cached) ============================================"
# DiffSplat SD1.5 text-conditioned UNet-EMA (3.28 GB fp32) + GSVAE (SD) (324 MB).
# GSRecon (160 MB) is deliberately NOT downloaded: the upstream README says only its rendering
# function is used at inference, and run.py calls that math itself.
HF_HOME=$CACHE/hf "$VENV/bin/python" - <<'PY'
import os, time
from huggingface_hub import snapshot_download
t = time.time()
for pat in ["gsdiff_gobj83k_sd15__render/*", "gsvae_gobj265k_sd/*"]:
    p = snapshot_download(repo_id="chenguolin/DiffSplat", local_dir="/data/cache/ckpt/DiffSplat",
                         allow_patterns=[pat])
    print("cached", pat, "->", p)
print(f"weights ready in {time.time()-t:.1f}s")
PY
du -sh "$CKPT" "$CACHE/hf" 2>/dev/null

say "=== 6. import check ================================================"
. $G2/run.env
"$G2_PYTHON" - <<'PY'
import sys
sys.path.insert(0, "/data/cache/repo/DiffSplat")
import torch
from src.options import opt_dict
from src.models.gsvae import GSAutoencoderKL
from src.utils import plucker_ray, unproject_depth, patchify, IMAGENET_MEAN
from extensions.diffusers_diffsplat import UNetMV2DConditionModel, StableMVDiffusionPipeline
try:
    import diff_gaussian_rasterization as d
    print("rasterizer:", "real" if hasattr(d, "_C") else "stub", d.__file__)
except Exception as e:
    print("rasterizer: unavailable", type(e).__name__, e)
print("imports ok; opt_type gsdiff_sd15 ->", opt_dict["gsdiff_sd15"].pretrained_model_name_or_path)
PY
say "setup done in $(date -u +%H:%M:%S)"
