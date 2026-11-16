#!/usr/bin/env bash
# Deck-frame preview of a splat asset.
#
# splat-transform renders in a world frame that is the asset's file frame rotated 180° about z
# (+y there is file -y), so its image is the deck's view turned upside down. Take the normal
# render and rotate it 180°. The camera is given in FILE-frame coordinates (x right, y up,
# z back = three.js) and mapped into the tool's world frame the same way: (-x, -y, +z).
#
# Usage: preview.sh <asset.spz> <outPrefix> [camX,camY,camZ] [targetX,targetY,targetZ] [res]
set -euo pipefail
here=$(cd "$(dirname "$0")" && pwd)
ST=(pnpx @playcanvas/splat-transform@3.11.2)
asset=$1 pre=$2
cam=${3:-3,2,-3}; tgt=${4:-0,0,0}; res=${5:-560x420}
neg() { awk -F, '{printf "%.5f,%.5f,%s", $1*-1, $2*-1, $3}' <<<"$1"; }
"${ST[@]}" "$asset" \
  --camera-pos "$(neg "$cam")" --camera-target "$(neg "$tgt")" \
  --camera-near 0.05 --resolution "$res" -w "$pre.raw.webp" >/dev/null
magick "$pre.raw.webp" -rotate 180 "$pre.deck.png"
uv run "$here/sage_preview.py" "$pre.deck.png" "$pre.sage.png" 6 >/dev/null
echo "$pre.deck.png + $pre.sage.png"
