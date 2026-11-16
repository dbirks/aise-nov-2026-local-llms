# /// script
# dependencies = ["numpy", "pillow"]
# ///
"""Preview a render through the deck's post pipeline: keep luminance only, quantise to the
6-tone sage ramp, Floyd–Steinberg dither. Approximates src/scenes/pixel-viz.js well enough to
judge silhouettes and contrast on a projected slide; the orchestrator checks the real render.

Usage: uv run sage_preview.py <in.png|webp> <out.png> [tones=6]
"""
import sys
import numpy as np
from PIL import Image

# tokens.css: --bg #EFF2E8, --hatch light #DCE3D2, --ink-2 #556155, --rule-soft #BBC5B0,
# --ink #1F241F — the deck's ramp runs light paper -> ink, darkest first is inverted here.
RAMP = [(31, 36, 31), (85, 97, 85), (137, 148, 132), (187, 197, 176), (220, 227, 210), (239, 242, 232)]

src, dst = sys.argv[1], sys.argv[2]
tones = int(sys.argv[3]) if len(sys.argv) > 3 else 6
ramp = np.array(RAMP[:tones] if tones <= 6 else RAMP, dtype=np.float64)
im = Image.open(src).convert('RGB')
a = np.asarray(im, dtype=np.float64) / 255.0
lum = 0.2126 * a[..., 0] + 0.7152 * a[..., 1] + 0.0722 * a[..., 2]   # Rec.709 luma, sRGB-encoded
idx = np.clip(np.round(lum * (tones - 1)), 0, tones - 1)

# Floyd–Steinberg on the tone index, then map through the ramp.
out = np.zeros(lum.shape, dtype=np.int64)
for y in range(lum.shape[0]):
    for x in range(lum.shape[1]):
        old = lum[y, x]
        new = min(max(int(round(old * (tones - 1))), 0), tones - 1)
        out[y, x] = new
        err = old - new / (tones - 1)
        for dx, dy, w in ((1, 0, 7 / 16), (-1, 1, 3 / 16), (0, 1, 5 / 16), (1, 1, 1 / 16)):
            nx, ny = x + dx, y + dy
            if 0 <= nx < lum.shape[1] and 0 <= ny < lum.shape[0]:
                lum[ny, nx] += err * w
img = Image.fromarray(ramp[out].astype(np.uint8))
img.save(dst)
print(f'{src} -> {dst}: {img.size}, {tones} tones')
