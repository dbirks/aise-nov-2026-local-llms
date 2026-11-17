#!/usr/bin/env bash
# splat-lab g2 · local post-processing (run on this workstation, not in the Job).
#
# Takes the .ply files the DiffSplat Job wrote on the cluster, normalises them to the deck's
# asset convention, renders offline previews (the deck's renderer did not exist yet) and packs
# SPZ. Copy the Job output out first:
#
#   POD=$(kubectl get pod -l app=splat-lab-files -o name | cut -d/ -f2)
#   kubectl cp default/$POD:/data/out/diffsplat-1 /tmp/g2-out
#   bash tools/splats/g2/make.sh /tmp/g2-out
#
# Args: $1 = directory containing raw/<slug>.ply (default /tmp/g2-out), $2 = slugs to process.
set -euo pipefail
SRC=${1:-/tmp/g2-out}
SLUGS=${2:-"gpu-cooler server-tower books"}
OUT=public/splats/g2
WORK=${WORK:-/tmp/g2-work}
ST=3.11.2

mkdir -p "$OUT" "$WORK"
for slug in $SLUGS; do
  raw="$SRC/raw/$slug.ply"
  [[ -f $raw ]] || { echo "skip $slug (no $raw)"; continue; }
  norm="$WORK/$slug.norm.ply"

  echo "=== $slug: normalise"
  uv run tools/splats/g2/normalize.py "$raw" "$norm" --report "$WORK/$slug.norm.json"

  echo "=== $slug: offline previews (luminance -> 6-tone sage, deck post-shader look)"
  uv run tools/splats/g2/preview.py "$norm" "$WORK/$slug-prev-a.png" --theta 0.6 --phi 1.15 --stride 4 &
  uv run tools/splats/g2/preview.py "$norm" "$WORK/$slug-prev-b.png" --theta 2.4 --phi 1.35 --stride 4 &
  wait

  echo "=== $slug: ply -> spz"
  pnpx @playcanvas/splat-transform@$ST -w "$norm" "$OUT/$slug.spz"
  # NB: splat-transform 3.11.2 needs an output target, so `null` discards the re-write and the
  # run only prints the stats. Plain `in.spz --stats` just prints the usage text.
  pnpx @playcanvas/splat-transform@$ST "$OUT/$slug.spz" --stats null | tee "$WORK/$slug.stats.txt"
  ls -l "$OUT/$slug.spz"
done
echo "=== sizes"
du -sh "$OUT" && du -h "$OUT"/*.spz
