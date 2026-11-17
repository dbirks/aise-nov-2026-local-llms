#!/usr/bin/env bash
# splat-lab g1 — turn LGM's raw .ply files (out of the k8s Job) into the deck's assets.
# Runs on the workstation: no GPU, no torch, ~2 GB peak, a few seconds. The GPU work is in
# apps/splat-lab-lgm.yaml (home-k8s) + run.sh; this is only stage "pack".
#
#   kubectl cp default/<splat-lab-files pod>:/data/out/g1-2 /tmp/g1-out
#   RAW=/tmp/g1-out bash tools/splats/g1/pack.sh
#
# Every number quoted in public/splats/g1/README.md and the slides comes from what this prints.
set -euo pipefail

RAW=${RAW:-/tmp/g1-out}
DEST=${DEST:-public/splats/g1}
MIN_ALPHA=${MIN_ALPHA:-0.05}
EXTENT=${EXTENT:-4}
ST=${ST:-3.11.2}

cd "$(dirname "$0")/../../.."
mkdir -p "$DEST"

for pair in "gtx1070 gpu" "minipc server"; do
  set -- $pair
  src="$1" out="$2"
  echo "=== $src.ply -> $DEST/$out.spz"
  [ -f "$RAW/$src.ply" ] || { echo "missing $RAW/$src.ply (kubectl cp the Job's /data/out/g1-2 first)"; exit 1; }
  uv run --quiet tools/splats/g1/normalize.py "$RAW/$src.ply" "$RAW/$src.norm.ply" \
      --extent "$EXTENT" --min-alpha "$MIN_ALPHA"
  pnpx "@playcanvas/splat-transform@$ST" -w "$RAW/$src.norm.ply" "$DEST/$out.spz"
  # -w overwrite; decimate with `-d 50%` here if a file ever passes the 8 MB cap.
  ls -l "$DEST/$out.spz"
  pnpx "@playcanvas/splat-transform@$ST" "$DEST/$out.spz" --stats text null | sed -n '1,12p;/Column/,+6p'
done
