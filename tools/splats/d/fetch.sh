#!/usr/bin/env bash
# Fetch the three public, CC-BY-licensed real-world 3DGS captures used by method D.
# Every file is downloaded from its upstream repo into tools/splats/d/raw/ (not committed).
# Licenses are the .license.txt files that ship next to the assets.
set -euo pipefail
mkdir -p "$(dirname "$0")/raw"
cd "$(dirname "$0")/raw"

base=https://raw.githubusercontent.com/mrdoob/three.js/dev/examples
for f in models/splat/millipede.splat models/splat/millipede.license.txt \
         models/spz/lion.v3.spz       models/spz/lion.license.txt \
         models/spz/tomatoes.v4.spz    models/spz/tomatoes.license.txt; do
  [ -s "${f##*/}" ] || curl -sSfL -o "${f##*/}" "$base/$f"   # raw/ is gitignored; licences are copied to tools/splats/d/licenses/
done
ls -l millipede.splat lion.v3.spz tomatoes.v4.spz *.license.txt
lic=$(cd "$(dirname "$0")/../licenses" && pwd)
for l in millipede lion tomatoes; do cp -n "$l.license.txt" "$lic/" 2>/dev/null || true; done
