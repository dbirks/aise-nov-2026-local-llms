# Splat lab — method B · photo + CPU depth → splats

Real photographs lifted into Gaussian splats by a monocular depth model running on
CPU. No training, no multi-view capture: one image in, one 2.5D relief out, baked once.

```
photo → Depth Anything V2 Small (CPU, ~2 s) → pinhole unprojection → 3DGS .ply → .spz
```

**Honest limits (say these out loud if asked):**

- Depth Anything V2 Small outputs **relative** depth (disparity-like: larger value = closer),
  **not metric depth**. The ordering of surfaces is real; the distances are chosen by us
  (`z = near + (1 − d_norm) · depth_range`, near = 2.2, range 0.85–1.2 before normalisation).
- Each splat disc is **fronto-parallel to the camera** (identity quaternion): no surface
  normals are estimated, so grazing surfaces are thickened/tilted inaccurately.
- **2.5D lift from a single photo** — anything hidden behind the object does not exist in
  the asset. Orbiting past ~±60° opens the relief like a cardboard shell.
- Depth is estimated at 518×518 internally and resampled to the working image; geometry at
  silhouette edges is smeared (2×2 block averaging).
- The renderer throws away hue (luminance → 6-tone sage ramp), so these were picked for
  light/dark contrast, not colour.

## Model

| | |
|---|---|
| Checkpoint | [`depth-anything/Depth-Anything-V2-Small-hf`](https://huggingface.co/depth-anything/Depth-Anything-V2-Small-hf) |
| Paper | Yang et al., *Depth Anything V2*, NeurIPS 2024 (arXiv:2406.09414) |
| Params / size | 24.8 M · model.safetensors 99.2 MB |
| Licence | **Apache-2.0** (declared on the model card; the Small checkpoint is the Apache one — Base/Large/Giant are CC-BY-NC-4.0) |
| Task | HF `pipeline("depth-estimation")`, CPU only, `torch 2.15.0+cpu`, 4 threads |
| Peak RAM | **731–788 MB** (measured `ru_maxrss`, per asset) — well under the 3 GB budget |

## Generator

```bash
tools/splats/b/fetch.sh     # download the three Commons photos (curl, UA set)
tools/splats/b/run-all.sh   # depth + lift + ply→spz + --stats for all three
# equivalent single run:
uv run --index https://download.pytorch.org/whl/cpu \
       --extra-index-url https://pypi.org/simple \
       tools/splats/b/bake_depth.py \
         --in tools/splats/b/inputs/gpu.jpg --out /tmp/gpu.ply \
         --metrics /tmp/gpu.json --max-side 768 --stride 2 --fov 50 \
         --near 2.2 --depth-range 1.2 --drop-far 0.05 --threads 4
pnpx @playcanvas/splat-transform@3.11.2 -w /tmp/gpu.ply public/splats/b/gpu.spz
```

Per-pixel recipe: resize to ≤ 768 px long side (LANCZOS) → relative depth → normalise to
`d_norm` (1 = closest) → `z = near + (1 − d_norm) · depth_range` → pinhole `x = u·z/f`,
`y = −v·z/f` with `f = 0.5·longside/tan(25°)` (≈50° across the long side) → drop the farthest
5 % of pixels → one Gaussian per 2×2 block: σ_xy = 0.70 · block footprint at that depth,
σ_z = 0.20 · footprint, opacity 0.9, colour = block-average sRGB → centre on origin, y-up,
largest extent = 4.0 units.

Measured twice on an 8-core box shared with other workers (torch CPU, 4 threads);
`depth_s` is model inference only, `bake_s` is unprojection + .ply write. Model load
(offline, cached weights) adds ~3 s per invocation.

---

## `gpu.spz` — Sapphire Radeon HD 5570 graphics card

- **Asset:** `splats/b/gpu.spz` · 552 352 B · 93 388 splats · slide `gs-b-gpu`
- **Bounds (spz-transform `--stats`):** x ±2.000 · y ±1.201 · z ±0.753 · no NaN/Inf · fill ratio 2.36
- **Extent after normalisation:** 4.000 × 2.403 × 1.506 units
- **Time:** depth 2.07 s (1.88 s second run) · bake 0.09 s · peak RSS 753 MB
- **Input:** `tools/splats/b/inputs/gpu.jpg`, 1280×853 downloaded → lifted at 768×512
- **Source photo:** *Sapphire-Radeon-HD-5570-Video-Card.jpg* by **Evan-Amos** —
  **Public domain** (attribution not required, given anyway).
  Page: <https://commons.wikimedia.org/wiki/File:Sapphire-Radeon-HD-5570-Video-Card.jpg>
  File: <https://upload.wikimedia.org/wikipedia/commons/f/f3/Sapphire-Radeon-HD-5570-Video-Card.jpg>
  Fetched as the 1280 px thumbnail: <https://upload.wikimedia.org/wikipedia/commons/thumb/f/f3/Sapphire-Radeon-HD-5570-Video-Card.jpg/1280px-Sapphire-Radeon-HD-5570-Video-Card.jpg>
- **Command:** `run-all.sh` → `bake gpu 2.2 1.2` (near 2.2, depth range 1.2)
- Studio product shot on a white sweep: the strongest depth/contrast case of the three.
  The white background is a *lit surface*, not free space — it survives the 5 % far cut as a
  shallow curved veil behind the card.

## `rack.spz` — server room aisle, The National Archives

- **Asset:** `splats/b/rack.spz` · 606 303 B · 81 715 splats · slide `gs-b-rack`
- **Bounds:** x ±2.000 · y ±1.364 · z ±0.728 · no NaN/Inf · fill ratio 2.77
- **Extent after normalisation:** 4.000 × 2.728 × 1.456 units
- **Time:** depth 1.77 s (2.15 s second run) · bake 0.07 s · peak RSS 787 MB
- **Input:** `tools/splats/b/inputs/rack.jpg`, 1280×747 downloaded → lifted at 768×448
- **Source photo:** *A view of the server room at The National Archives.jpg* by
  **The National Archives (UK)** — **CC BY 3.0** (attribution **required**).
  Licence: <https://creativecommons.org/licenses/by/3.0>
  Page: <https://commons.wikimedia.org/wiki/File:A_view_of_the_server_room_at_The_National_Archives.jpg>
  Fetched as the 1280 px thumbnail: <https://upload.wikimedia.org/wikipedia/commons/thumb/e/e0/A_view_of_the_server_room_at_The_National_Archives.jpg/1280px-A_view_of_the_server_room_at_The_National_Archives.jpg>
- **Command:** `run-all.sh` → `bake rack 2.2 0.85` — depth range tightened to 0.85 so the
  corridor stays ≈1.5 units deep after normalisation.
- Relative depth is disparity-like, so the near rack fronts (bright in the photo's own
  LED lights) come forward and the far end of the aisle collapses into the far plane; the
  farthest 5 % cut removes the vanishing point. Note: this is a *room*, so the asset is the
  inside of a box, not an object — orbit will show that immediately.

## `desktop.spz` — home workstation, side panel off

- **Asset:** `splats/b/desktop.spz` · 764 378 B · 105 062 splats · slide `gs-b-desktop`
- **Bounds:** x ±1.498 · y ±2.000 · z ±0.716 · no NaN/Inf · fill ratio 2.07
- **Extent after normalisation:** 2.996 × 4.000 × 1.431 units (portrait source)
- **Time:** depth 1.58 s (1.34 s second run) · bake 0.10 s · peak RSS 731 MB
- **Input:** `tools/splats/b/inputs/desktop.jpg`, 1280×1707 downloaded → lifted at 576×768
- **Source photo:** *Inside a desktop computer with MSI graphics card.jpg* by
  **Kurt Kaiser** — **CC0** (public domain dedication).
  Licence: <https://creativecommons.org/publicdomain/zero/1.0/>
  Page: <https://commons.wikimedia.org/wiki/File:Inside_a_desktop_computer_with_MSI_graphics_card.jpg>
  Fetched as the 1280 px thumbnail: <https://upload.wikimedia.org/wikipedia/commons/thumb/6/6e/Inside_a_desktop_computer_with_MSI_graphics_card.jpg/1280px-Inside_a_desktop_computer_with_MSI_graphics_card.jpg>
- **Command:** `run-all.sh` → `bake desktop 2.2 1.2`
- The lifted "local LLM box": motherboard plane, tower cooler, and the GPU held above the
  board all separate in depth. The red GPU shroud reads mid-dark once hue is discarded.

---

## Licence bookkeeping

The splat assets are derivatives of the photos above: gpu (PD), desktop (CC0) are
unencumbered; **rack.spz is a CC BY 3.0 derivative** — keep the National Archives credit in
any deck credit slide or exported material. Depth Anything V2 Small is Apache-2.0, so the
inference weights do not infect the output geometry.
