#!/usr/bin/env bash
# splat-lab G3 — turn the .ply checkpoints exported by the training Job (home-k8s
# apps/splat-lab-train.yaml) into the deck's assets. Nothing here needs a GPU; the training
# already happened on the 1070.
#
#   tools/splats/g3/pack.sh <dir with the Job's truck_*.ply>        # GROW_ITER=2500 by default
#
# Crop box / opacity floor are measured, not guessed: poses.py gives the capture's scale (cameras
# within ~±5 units, "up" = -y because COLMAP's y axis points down) and probe.py shows where the
# subject sits. The box keeps the toy pickup plus a lip of the table it stands on and drops the
# background wall and the distant floaters the COLMAP points carried. `-r 180,0,0` is the COLMAP
# +y-down -> deck +y-up flip: a proper rotation, so it also flips z and leaves the scene unmirrored.
set -euo pipefail
IN=${1:?"usage: pack.sh <dir containing the Job's truck_*.ply>"}
ROOT=$(cd "$(dirname "$0")/../../.." && pwd)
OUT=$ROOT/public/splats/g3
TMP=${TMP:-$HOME/scratch/g3-pack}
ST="pnpx -s @playcanvas/splat-transform@3.11.2"
BOX="-2.2,-0.7,-1.7,2.2,1.62,1.7"
MIN_OPACITY=0.10
EXTENT=4.0
GROW_ITER=${GROW_ITER:-2500}

mkdir -p "$OUT" "$TMP"
# highest iteration = the final model (checkpoint files grow, then plateau once growth stops)
final=$(ls "$IN"/truck_*.ply | sort | tail -1)
grow="$IN/$(printf 'truck_%05d.ply' "$GROW_ITER")"
echo "final ply : $final ($(stat -c%s "$final") bytes)"
[ -f "$grow" ] && echo "grow  ply : $grow ($(stat -c%s "$grow") bytes)"

# 1. final subject -----------------------------------------------------------------------------
t0=$(date +%s%3N)
uv run "$ROOT/tools/splats/g3/crop.py" "$final" --out "$TMP/truck.ply" "--box=$BOX" \
    --min-opacity "$MIN_OPACITY" --extent "$EXTENT" --stats-out "$TMP/truck.json"
t1=$(date +%s%3N)
$ST -w "$TMP/truck.ply" -r 180,0,0 "$OUT/truck.spz"
t2=$(date +%s%3N)

# 2. the same scene mid-refinement, with the FINAL crop transform so the pair overlays ---------
t3=$t2; t4=$t2
if [ -f "$grow" ]; then
  read -r shift scale < <(python3 -c "
import json; d = json.load(open('$TMP/truck.json'))
print(','.join(str(v) for v in d['shift']), d['scale'])")
  uv run "$ROOT/tools/splats/g3/crop.py" "$grow" --out "$TMP/truck-grow.ply" "--box=$BOX" \
      --min-opacity "$MIN_OPACITY" "--shift=$shift" "--scale=$scale" \
      --stats-out "$TMP/truck-grow.json"
  t3=$(date +%s%3N)
  $ST -w "$TMP/truck-grow.ply" -r 180,0,0 "$OUT/truck-grow.spz"
  t4=$(date +%s%3N)
fi

# 3. verify ------------------------------------------------------------------------------------
for f in "$OUT/truck.spz" "$OUT/truck-grow.spz"; do
  [ -e "$f" ] || continue
  echo "--- $f ($(stat -c%s "$f") bytes) ---"
  $ST "$f" --stats null | grep -E "^\| (x|y|z|opacity) |gaussians" || true
done
echo "timings ms: crop-final=$((t1 - t0)) pack-final=$((t2 - t1)) crop-grow=$((t3 - t2)) pack-grow=$((t4 - t3))"
du -sh "$OUT"
