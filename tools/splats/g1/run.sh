#!/usr/bin/env bash
# splat-lab g1 — LGM (Large Multi-View Gaussian Model) on the cluster GTX 1070.
#
# Job entrypoint. Stages (idempotent; each one skips work that is already on the PVC):
#   preflight  GPU/torch check, print what the container actually sees
#   setup      /data/cache/venv-lgm + pinned wheels + pinned LGM source checkout
#   inputs     download + hash the CC0/PD source pictures into /data/in/g1
#   mvgen      image -> cut-out -> ImageDream multi-view (GPU, process 1)
#   lgm        four views -> LGM U-Net -> .ply (GPU, process 2)
#   report     merge metrics into $OUT/RESULTS.json + a summary table
#   all        everything in that order
#
# The two GPU stages are deliberately *separate processes*: ImageDream's fp16 weights are
# ~3.8 GB and LGM's are ~0.8 GB, and HAMi caps this container at 5000 MiB (~4.9 GiB), so they
# must not be resident at the same time.
#
# Overridable: SUBJECTS STEPS GUIDANCE ELEVATION SEED MATTE CONFIG CKPT INPUT_SIZE LGM_EXTRA
# VIEWS_BASE FORCE LGM_REV. Usage: bash /scripts/run.sh [stage]
set -euo pipefail

: "${OUT:?OUT must be set, e.g. /data/out/g1-1}"
SCRIPTS=${SCRIPTS:-/scripts}
WORK=${WORK:-/work}
DATA=${DATA:-/data}
CACHE=$DATA/cache
VENV=$CACHE/venv-lgm
PY=$VENV/bin/python
PIP=$VENV/bin/pip
LGM_REV=${LGM_REV:-fe8d12cff8c827df7bb77a3c8e8b37408cb6fe4c}
export LGM_DIR=${LGM_DIR:-$CACHE/repos/LGM-$LGM_REV}
export G1_VENDOR=$WORK/vendor
export HF_HOME=${HF_HOME:-$CACHE/hf}
export HUGGINGFACE_HUB_CACHE=${HUGGINGFACE_HUB_CACHE:-$HF_HOME/hub}
export PIP_CACHE_DIR=${PIP_CACHE_DIR:-$CACHE/pip}
export U2NET_HOME=${U2NET_HOME:-$CACHE/u2net}
export TORCH_HOME=${TORCH_HOME:-$CACHE/torch}
export PYTHONUNBUFFERED=1
export HF_HUB_ENABLE_HF_TRANSFER=0

SUBJECTS=${SUBJECTS:-gtx1070 minipc}
STEPS=${STEPS:-30}
GUIDANCE=${GUIDANCE:-5.0}
ELEVATION=${ELEVATION:-0}
SEED=${SEED:-42}
MATTE=${MATTE:-rembg}
CONFIG=${CONFIG:-big}
CKPT=${CKPT:-model_fp16_fixrot.safetensors}
INPUT_SIZE=${INPUT_SIZE:-}            # empty = the config's own 256
LGM_EXTRA=${LGM_EXTRA:-}              # e.g. "--fp32"
VIEWS_BASE=${VIEWS_BASE:-$OUT}        # where mv_*.png live (defaults to $OUT)
FORCE=${FORCE:-0}
STAGE=${1:-all}

mkdir -p "$OUT" "$WORK" "$CACHE/pip" "$CACHE/repos" "$CACHE/torch" "$U2NET_HOME" "$HF_HOME" "$DATA/in/g1"
START_TS=$(date +%s)
LOG=$OUT/run-$STAGE.log
exec > >(tee -a "$LOG") 2>&1

log() { echo "[g1 $(date -u +%H:%M:%S)] $*"; }

# The ConfigMap's keys are flat (`vendor-kiui-cam.py`), because kubelet does not materialise
# ConfigMap volume items whose path contains a directory — splat-lab-lgm-1 got an empty
# /work/vendor/kiui and died on `import kiui`. Rebuild the package tree here instead.
VENDOR_FILES="kiui/__init__.py kiui/cam.py kiui/op.py kiui/lpips.py xformers/__init__.py
              xformers/ops/__init__.py diff_gaussian_rasterization/__init__.py"
stage_vendor() {
  local rel key src n=0
  rm -rf "$G1_VENDOR"; mkdir -p "$G1_VENDOR"
  for rel in $VENDOR_FILES; do
    key="vendor-${rel//\//-}"
    if [ -f "$SCRIPTS/$key" ]; then src="$SCRIPTS/$key"
    elif [ -f "$SCRIPTS/vendor/$rel" ]; then src="$SCRIPTS/vendor/$rel"   # in case a mount ever nests
    else log "MISSING vendored module $rel (looked for $SCRIPTS/$key)"; exit 3; fi
    mkdir -p "$G1_VENDOR/$(dirname "$rel")"
    cp "$src" "$G1_VENDOR/$rel"
    n=$((n + 1))
  done
  log "vendor tree staged: $n/$VENDOR_COUNT modules -> $G1_VENDOR"
  find "$G1_VENDOR" -name '*.py' | sort | sed 's|^|[g1]   |'
}
VENDOR_COUNT=$(echo $VENDOR_FILES | wc -w)
stage_vendor

# nvidia-smi sampler: HAMi's view of the vGPU, every 5 s, while this script runs.
(
  while true; do
    sleep 5
    nvidia-smi --query-gpu=memory.used,memory.total,utilization.gpu --format=csv,noheader \
      | sed "s/^/[$(date -u +%H:%M:%S)] nvidia-smi /" || true
  done
) &
SMI_PID=$!
trap 'kill $SMI_PID 2>/dev/null || true' EXIT

log "stage=$STAGE out=$OUT work=$WORK lgm=$LGM_DIR"
log "subjects='$SUBJECTS' steps=$STEPS guidance=$GUIDANCE elevation=$ELEVATION seed=$SEED matte=$MATTE"
log "config=$CONFIG ckpt=$CKPT input_size=${INPUT_SIZE:-config default} extra='$LGM_EXTRA' views=$VIEWS_BASE"

st_preflight() {
  log "--- preflight ---"
  (command -v nvidia-smi >/dev/null && nvidia-smi --query-gpu=name,memory.total,driver_version --format=csv,noheader) || true
  python - <<'PY'
import torch
print("system python torch", torch.__version__, "cuda", torch.version.cuda)
print("arch list", torch.cuda.get_arch_list(), "available", torch.cuda.is_available())
if torch.cuda.is_available():
    print("device", torch.cuda.get_device_name(0), torch.cuda.get_device_capability(0))
    free, total = torch.cuda.mem_get_info()
    print(f"visible vram free {free/2**30:.2f} / {total/2**30:.2f} GiB")
    a = torch.randn(2048, 2048, device="cuda", dtype=torch.float16)
    print("fp16 matmul ok", float((a @ a).float().abs().mean()))
PY
  nproc || true
  free -g 2>/dev/null | head -2 || true
  df -h /data 2>/dev/null | tail -1 || true
}

st_setup() {
  log "--- setup ---"
  find "$SCRIPTS" -type f | sort | sed 's|^|[g1] scripts: |'
  if [ ! -x "$PY" ]; then
    python -m venv --system-site-packages "$VENV"
    "$PIP" install -q --upgrade pip
  fi
  # pinned set (see requirements.txt for why these versions and what is *not* installed).
  # Full pip output stays on the PVC; only the tail goes to the pod log.
  if ! "$PIP" install --upgrade-strategy only-if-needed -r "$SCRIPTS/requirements.txt" \
        >"$OUT/pip-install.log" 2>&1; then
    log "pip install FAILED — last 40 lines:"
    tail -40 "$OUT/pip-install.log"
    return 1
  fi
  tail -3 "$OUT/pip-install.log"
  "$PIP" freeze | sort > "$OUT/pip-freeze.txt"
  log "pip freeze -> $OUT/pip-freeze.txt ($(wc -l < "$OUT/pip-freeze.txt") pkgs)"
  if [ ! -d "$LGM_DIR" ]; then
    # no git and no curl in pytorch/pytorch:*-runtime (see splat-lab-train-1) -> urllib + tarfile
    log "fetching LGM source at $LGM_REV over HTTPS"
    python - "$LGM_REV" "$CACHE/repos" <<'PY'
import sys, tarfile, urllib.request
rev, dest = sys.argv[1], sys.argv[2]
url = f"https://github.com/3DTopia/LGM/archive/{rev}.tar.gz"
req = urllib.request.Request(url, headers={"User-Agent": "splat-lgm-lab/1.0 (deck experiment)"})
with urllib.request.urlopen(req, timeout=600) as r, open(f"{dest}/lgm.tgz", "wb") as fh:
    fh.write(r.read())
with tarfile.open(f"{dest}/lgm.tgz") as tf:
    tf.extractall(dest, filter="data")
import os; os.remove(f"{dest}/lgm.tgz")
print(f"extracted {url} -> {dest}")
PY
  fi
  ls "$LGM_DIR" | head
  "$PY" - <<'PY'
import os, sys, torch, torchvision, numpy, PIL, cv2, plyfile, roma, diffusers, transformers, accelerate, rembg, tyro
print("venv torch", torch.__version__, "torchvision", torchvision.__version__, "numpy", numpy.__version__,
      "diffusers", diffusers.__version__, "transformers", transformers.__version__)
sys.path.insert(0, os.environ["G1_VENDOR"]); sys.path.insert(0, os.environ["LGM_DIR"])
import kiui, xformers, diff_gaussian_rasterization   # vendored shims
print("kiui", kiui.__version__, "| xformers shim", xformers.__version__)
from core.options import config_defaults
from core.models import LGM
print("LGM importable; big config:", config_defaults["big"].splat_size, config_defaults["big"].up_channels)
from mvdream.pipeline_mvdream import MVDreamPipeline
import inspect
print("MVDreamPipeline.__call__ has elevation arg:", "elevation" in inspect.signature(MVDreamPipeline.__call__).parameters)
PY
  "$PY" "$SCRIPTS/selftest.py" --device cpu --input-size 64
}

st_inputs() {
  log "--- inputs ---"
  "$PY" "$SCRIPTS/fetch_inputs.py" --tsv > "$OUT/inputs.tsv"
  cat "$OUT/inputs.tsv"
  # no awk in this image: fetch_inputs.py also writes shell assignments for the later stages
  if [ ! -f "$OUT/inputs.env" ]; then echo "fetch_inputs.py wrote no $OUT/inputs.env"; exit 2; fi
}

st_mvgen() {
  log "--- mvgen (diffusion stage) ---"
  set -a; . "$OUT/inputs.env"; set +a
  for name in $SUBJECTS; do
    pvar="IN_$name"; cvar="CROP_$name"
    path="${!pvar:-}"; crop="${!cvar:-}"
    if [ ! -f "$path" ]; then echo "no input for $name ($path) — run the inputs stage"; exit 2; fi
    if [ -f "$OUT/$name/mv_3.png" ] && [ "$FORCE" != 1 ]; then
      log "$name: views already in $OUT/$name, skipping (FORCE=1 to redo)"; continue
    fi
    args=(--input "$path" --out "$OUT/$name" --matte "$MATTE" --steps "$STEPS"
          --guidance "$GUIDANCE" --elevation "$ELEVATION" --seed "$SEED")
    [ -n "$crop" ] && args+=(--crop "$crop")
    log "$name: ImageDream ipmv -> 4 views (${args[*]})"
    "$PY" "$SCRIPTS/mvgen.py" "${args[@]}"
  done
}

st_lgm() {
  log "--- lgm (U-Net -> .ply stage) ---"
  for name in $SUBJECTS; do
    if [ -f "$OUT/$name.ply" ] && [ "$FORCE" != 1 ]; then
      log "$name: $OUT/$name.ply exists, skipping (FORCE=1 to redo)"; continue
    fi
    args=(--views "$VIEWS_BASE/$name" --out "$OUT/$name.ply" --config "$CONFIG" --ckpt "$CKPT"
          --elevation "$ELEVATION" --seed "$SEED" --metrics-dir "$OUT/$name")
    [ -n "$INPUT_SIZE" ] && args+=(--input-size "$INPUT_SIZE")
    # shellcheck disable=SC2206
    [ -n "$LGM_EXTRA" ] && args+=($LGM_EXTRA)
    log "$name: LGM $CONFIG -> $OUT/$name.ply (${args[*]})"
    "$PY" "$SCRIPTS/lgm2ply.py" "${args[@]}"
  done
}

st_report() {
  log "--- report ---"
  "$PY" "$SCRIPTS/report.py" --out "$OUT" --scripts "$SCRIPTS" --start-ts "$START_TS" --stage "$STAGE"
}

case "$STAGE" in
  preflight) st_preflight ;;
  setup)     st_setup ;;
  inputs)    st_inputs ;;
  mvgen)     st_mvgen ;;
  lgm)       st_lgm ;;
  report)    st_report ;;
  all)       st_preflight; st_setup; st_inputs; st_mvgen; st_lgm; st_report ;;
  *) echo "unknown stage '$STAGE'"; exit 2 ;;
esac

log "stage $STAGE finished in $(( $(date +%s) - START_TS ))s; wall time so far is in $LOG"
