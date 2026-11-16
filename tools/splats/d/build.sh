#!/usr/bin/env bash
# Build the method-D assets: public CC-BY real-world captures -> normalised .spz for the deck.
#
# Three steps per asset:
#   1. pose + crop + strip SH  -> work/<name>.mid.spz        (the pose the deck should show)
#   2. --stats on that midpoint                             (bounds in the asset's file frame)
#   3. the SAME command again, plus -t/-s computed from (2) -> public/splats/d/<name>.spz
#      so the shipped file always comes from one reproducible command line (README.md).
#
# Frame note: splat-transform prints --stats/CSV in the asset's FILE frame (the one the deck
# renders, +y up, three.js/SPZ convention), but applies -r/-t/-s/-B in its own world frame,
# which is that file frame rotated 180° about z: -t (tx,ty,tz) moves content by (-tx,-ty,+tz)
# in file coordinates and a -B box has to be mirrored the same way. bounds.py does the maths.
#
# SPZ v3 (gzip) rather than the v4 default, for the widest loader support.
set -euo pipefail
here=$(cd "$(dirname "$0")" && pwd)
raw=$here/raw
out=$here/../../../public/splats/d
ST=(pnpx @playcanvas/splat-transform@3.11.2)
mkdir -p "$out" "$here/work"

build() {                          # build <name> <input> <pose/crop args in the tool frame...>
  local name=$1 input=$2; shift 2
  local t0 t1
  t0=$(date +%s%N)
  "${ST[@]}" -w "$raw/$input" "$@" -H 0 --spz-version 3 "$here/work/$name.mid.spz" >/dev/null
  "${ST[@]}" "$here/work/$name.mid.spz" --stats null >"$here/work/$name.stats" 2>&1
  eval "$(uv run "$here/bounds.py" "$here/work/$name.stats" 4 |
         sed -n 's/^CLI_T \(.*\)/T=\1/p; s/^CLI_S \(.*\)/S=\1/p')"
  "${ST[@]}" -w "$raw/$input" "$@" -H 0 --spz-version 3 -t "$T" -s "$S" "$out/$name.spz" >/dev/null
  t1=$(date +%s%N)
  "${ST[@]}" "$out/$name.spz" --stats null >"$here/work/$name.final.stats" 2>&1
  echo "=== $name   (transform -t $T -s $S)"
  grep -E "gaussians:|^\\| [xyz]" "$here/work/$name.final.stats" | sed 's/^/    /'
  printf '    %s  %dms convert\n' "$(du -h "$out/$name.spz" | cut -f1)" $(( (t1 - t0) / 1000000 ))
}

# 1 · millipede specimen — macro photogrammetry of a real arthropod. Long axis onto x with the
#     legs (the arc's concave side) pointing down: fitted with pose.py + fitrot.py.
build millipede millipede.splat -r 90,0,0 -r 0,90,0

# 2 · lion head — stored upside down; three.js's own example shows it after rotating the mesh by
#     Euler(PI,0,0), so bake the same rotation into the data.
build lion lion.v3.spz -r 180,0,0

# 3 · two heirloom tomatoes on a DIY turntable rig — crop to the fruit plus the patch of plate
#     directly under it (file-frame box x[-2.2,3.4] y[0.02,4.85] z[-1.6,2.6], mirrored for the
#     tool), then drop the soft halo: -V opacity,gt,0.12 (445,409 -> 11,454 splats). Without the
#     halo filter the capture renders as a fuzzy red cloud at slide scale.
build tomatoes tomatoes.v4.spz -B -3.4,-4.85,-1.6,2.2,-0.02,2.6 -V opacity,gt,0.12

echo "=== totals"
du -h "$out"/*.spz "$out"
