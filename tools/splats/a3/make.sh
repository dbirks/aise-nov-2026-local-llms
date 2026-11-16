#!/usr/bin/env bash
# Splat lab A3 · SyntaxSplat — rebuild every asset in public/splats/a3/ from source.
# Run from the repo root:  bash tools/splats/a3/make.sh
#
# Needs: git, python3, node + pnpx, uv, and a Playwright chromium (all already cached on
# this box). No GPU: the bake is CPU surface sampling in browser workers; the page is only
# driven to run the tool's own "Export .ply" path.
#
# Steps:
#   1. clone SyntaxSplat (once) and drop the three scene files into scenes/, registering
#      their ids in scenes/index.json — the manifest is the only source of scene ids.
#   2. serve the clone on :9371 and drive it with playwright-cli: load each scene, wait
#      for the bake, click Export .ply, save the download.
#   3. pack.py: centre + scale to a 4-unit largest extent, and (for one asset) reproduce
#      the pixel-art palette pass on the splat colours.
#   4. splat-transform -> .spz, then --stats on every output.
set -euo pipefail

HERE=tools/splats/a3
REPO=$HERE/repo
TMP=${TMP:-/tmp/a3-build}
OUT=public/splats/a3
PORT=${PORT:-9371}
ST="pnpx -s @playcanvas/splat-transform@3.11.2"
SESSION="a3$$"
SCENES=(a3-gpu a3-layers a3-server)
PALLETSNAP=a3-gpu           # the scene that gets a second, palette-snapped asset

mkdir -p "$TMP" "$OUT"
[ -d "$REPO" ] || git clone --depth 1 https://github.com/iamvillain/SyntaxSplat "$REPO"

# 1 · scenes into the clone + manifest
cp "$HERE"/scenes/*.js "$REPO/scenes/"
python3 - "$REPO/scenes/index.json" "${SCENES[@]}" <<'PY'
import json, sys
path, ids = sys.argv[1], sys.argv[2:]
m = json.load(open(path)); have = {s["id"] for s in m}
titles = {"a3-gpu": "A3 GPU card", "a3-layers": "A3 layer stack", "a3-server": "A3 home server"}
for i in ids:
    if i not in have:
        m.append({"id": i, "title": titles[i]})
json.dump(m, open(path, "w"), indent=2)
PY

# 2 · serve the tool (on the first free port from $PORT upwards)
busy() { python3 -c "import socket,sys; s=socket.socket(); sys.exit(0 if s.connect_ex(('127.0.0.1',int(sys.argv[1])))==0 else 1)" "$1"; }
while busy "$PORT"; do PORT=$((PORT+1)); done; echo "serving on :$PORT"
(cd "$REPO" && python3 -m http.server "$PORT" --bind 127.0.0.1 >/tmp/a3-http.log 2>&1) &
SRV=$!
trap 'kill $SRV 2>/dev/null || true; pnpx -s @playwright/cli -s=$SESSION close >/dev/null 2>&1 || true' EXIT
sleep 1

cat > "$TMP/drive.js" <<'JS'
async page => {
  const scene = '__SCENE__';
  const logs = [];
  page.on('console', m => logs.push(m.text()));
  page.on('pageerror', e => logs.push('PAGEERROR ' + e.message));
  await page.goto(`http://127.0.0.1:__PORT__/?scene=${scene}&ui=0`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForFunction(() => !document.getElementById('load'), null, { timeout: 900000 });
  const hud = await page.evaluate(() => document.getElementById('hud').textContent.split('\n')[1] || '');
  const dl = page.waitForEvent('download', { timeout: 240000 });
  await page.evaluate(() => document.getElementById('exportPly').click());   // the tool's own export
  const d = await dl;
  await d.saveAs('__TMP__/' + scene + '.ply');
  return `${scene}: ${hud} :: ${logs.filter(l => /built |PAGEERROR|error/i.test(l)).join(' | ')}`;
}
JS

pnpx -s @playwright/cli -s=$SESSION open --browser=chromium "http://127.0.0.1:$PORT/" >/dev/null
for s in "${SCENES[@]}"; do
  sed -e "s/__SCENE__/$s/" -e "s/__PORT__/$PORT/" -e "s|__TMP__|$TMP|" "$TMP/drive.js" > "$TMP/drive-$s.js"
  pnpx -s @playwright/cli -s=$SESSION run-code "$(cat "$TMP/drive-$s.js")" --raw
done
pnpx -s @playwright/cli -s=$SESSION close >/dev/null
kill $SRV 2>/dev/null || true

# 3 · normalise (+ palette pass on the one scene that demonstrates it)
for s in "${SCENES[@]}"; do
  uv run --quiet "$HERE/pack.py" "$TMP/$s.ply" "$TMP/$s.norm.ply"
done
uv run --quiet "$HERE/pack.py" "$TMP/$PALLETSNAP.ply" "$TMP/$PALLETSNAP.pal.ply" \
    --palette-snap "$REPO/scenes/$PALLETSNAP.js"

# 4 · pack to SPZ and inspect. Slide-facing names drop the a3- prefix.
pack() { $ST -w "$1" "$OUT/$2.spz" && $ST "$OUT/$2.spz" --stats null | grep -E "gaussians|^bound|done|fill ratio"; }
pack "$TMP/a3-gpu.norm.ply"      gpu
pack "$TMP/a3-gpu.pal.ply"       gpu-palette
pack "$TMP/a3-layers.norm.ply"   layers
pack "$TMP/a3-server.norm.ply"   server

ls -l "$OUT"
