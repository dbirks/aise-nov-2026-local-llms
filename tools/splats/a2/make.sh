#!/usr/bin/env bash
# A2 / A2b — rebuild every splat asset in public/splats/a2/ from source.
# Run from the repo root. Requires: uv (for the Python baker), pnpx (for splat-transform).
# The bake itself is CPU-only; ~10 s total for all five assets on an 8-core box.
set -euo pipefail
TMP=${TMP:-/tmp/a2-bake}
ST="pnpx -s @playcanvas/splat-transform@3.11.2"
mkdir -p "$TMP" public/splats/a2

# A2 · LLM-written Python bake — SDF shell sampling -> 3DGS .ply -> .spz
for a in gpu layers kv-blocks tokens; do
    uv run tools/splats/a2/bake.py --asset "$a" --out "$TMP/$a.ply"
    $ST -w "$TMP/$a.ply" "public/splats/a2/$a.spz"
done

# A2b · LLM-written .mjs generator — splat-transform runs the script directly.
# -s 0.15479 normalises the 25.84-unit tile field to a 4-unit largest extent.
$ST -w tools/splats/a2/attn-mask.mjs -p n=26,sample=0.075 -s 0.15479 -t 0,0.0139,0 \
    public/splats/a2/attn-mask.spz

# inspect: $ST public/splats/a2/<name>.spz --stats null
ls -l public/splats/a2/
