#!/usr/bin/env bash
# Method B, end to end: photo -> Depth Anything V2 Small (CPU) -> 2.5D splat lift
# -> .ply -> .spz in public/splats/b/. Deterministic; run from the repo root.
#
# uv resolves torch from the CPU-only wheel index so the build stays ~200 MB and
# peak RSS stays well under 1 GB (measured: ~790 MB).
set -euo pipefail
cd "$(dirname "$0")/../../.."        # repo root
IN=tools/splats/b/inputs
OUT=/tmp/splats-b
mkdir -p "$OUT" tools/splats/b/metrics

for n in gpu rack desktop; do
  [ -s "$IN/$n.jpg" ] || { echo "missing $IN/$n.jpg — run tools/splats/b/fetch.sh first"; exit 1; }
done

bake() { # <name> <near> <depth-range> [extra args…]
  local n=$1 near=$2 dr=$3; shift 3
  uv run --index https://download.pytorch.org/whl/cpu \
         --extra-index-url https://pypi.org/simple --no-progress \
         tools/splats/b/bake_depth.py \
           --in "$IN/$n.jpg" --out "$OUT/$n.ply" \
           --metrics "tools/splats/b/metrics/$n.json" \
           --max-side 768 --stride 2 --fov 50 --drop-far 0.05 \
           --threads 4 --near "$near" --depth-range "$dr" "$@" >"$OUT/$n.log" 2>&1
  pnpx @playcanvas/splat-transform@3.11.2 -w "$OUT/$n.ply" "public/splats/b/$n.spz" >>"$OUT/$n.log" 2>&1
  echo "$n -> $(du -h "public/splats/b/$n.spz" | cut -f1)  $(grep -o '"depth_s": [0-9.]*' "$OUT/$n.log"), $(grep -o '"bake_s": [0-9.]*' "$OUT/$n.log")"
}

bake gpu     2.2 1.2
bake rack    2.2 0.85
bake desktop 2.2 1.2

for n in gpu rack desktop; do
  pnpx @playcanvas/splat-transform@3.11.2 "public/splats/b/$n.spz" --stats null \
    | sed -n '1,6p;/| x /,/| z /p;/fill ratio/p'
done
