#!/usr/bin/env bash
# Method B input acquisition: three Wikimedia Commons photos with clear licenses.
# Downloads the 1280px thumbnail (Wikimedia only serves listed thumb sizes to
# scripts; the API reported 1280 for iiurlwidth=1024), then the bake script
# resizes to <= 768 px on the long side with LANCZOS.
#
# Licenses / attribution are recorded in public/splats/b/README.md.
set -euo pipefail
cd "$(dirname "$0")/inputs"
UA="pi-splat-lab/1.0 (research, depth-lift demo; no-reply)"

dl() { # <file> <url>
  local f="$1" u="$2"
  if [[ -s "$f" ]]; then echo "have $f"; return; fi
  curl -sfL -A "$UA" --max-time 120 -o "$f" "$u"
  echo "got  $f"
}

# 1 · graphics card — Public domain (Evan-Amos)
dl gpu.jpg 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f3/Sapphire-Radeon-HD-5570-Video-Card.jpg/1280px-Sapphire-Radeon-HD-5570-Video-Card.jpg'

# 2 · data centre aisle — CC BY 3.0 (The National Archives, UK)
dl rack.jpg 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e0/A_view_of_the_server_room_at_The_National_Archives.jpg/1280px-A_view_of_the_server_room_at_The_National_Archives.jpg'

# 3 · home desktop / workstation with the side panel off — CC0 (Kurt Kaiser)
dl desktop.jpg 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6e/Inside_a_desktop_computer_with_MSI_graphics_card.jpg/1280px-Inside_a_desktop_computer_with_MSI_graphics_card.jpg'

for f in gpu.jpg rack.jpg desktop.jpg; do
  printf '%s  ' "$f"; identify -format '%wx%h\n' "$f" 2>/dev/null || stat -c%s "$f"
done
