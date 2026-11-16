# Splat lab · method A2 / A2b — LLM-written generator, baked once on CPU

Everything in this folder is **illustrative geometry**: primitives I (the agent writing this)
invented to stand in for talk subjects. No measured hardware dimensions, no real model,
no measured throughput or memory numbers are encoded in these assets.

Rebuild all five assets with `bash tools/splats/a2/make.sh` (needs `uv` + `pnpx`; ~13 s of
compute plus tool start-up on an 8-core CPU box, no GPU).

## Pipeline

**A2 · LLM-written Python bake** — `tools/splats/a2/bake.py` (run with `uv run`, inline
`# /// script` dependency on numpy only):

1. A scene is a list of signed-distance primitives (boxes, rounded boxes, wire outlines).
2. Each primitive is sampled on a jittered grid inside its bounds; grid points with
   `|SDF| < 0.46·spacing` are kept and projected onto the zero level set with the
   central-difference SDF gradient.
3. Samples that land inside another primitive are dropped, so no hidden internal shells.
4. One flat Gaussian per sample: `scale ≈ [s, s, 0.1·s]` with `s = 0.86·spacing`, rotated so
   the minor axis is the surface normal (quaternion written as `rot_0..3 = w,x,y,z`).
5. Colour is baked, not lit at runtime: lambert from one fixed key light (≈ the deck's default
   camera direction, `[0.45, 0.62, 0.65]`) + a weak back-left fill + a two-tap ambient-occlusion
   approximation measured against the union SDF (`sd(p + n·t)/t` at `t = 2.5·s` and `6.5·s`),
   times the primitive's base luminance, plus ±2 % luminance noise. Only luminance is designed
   for — the deck's post shader throws hue away.
6. The scene is centred on the origin and scaled so the largest extent = 4.0 world units,
   written as a binary-little-endian 3DGS `.ply` (float32, SH band 0 only) in a temp dir, then
   packed to SPZ.

**A2b · LLM-written `.mjs` generator** — `tools/splats/a2/attn-mask.mjs`: the same idea, but
splat-transform executes the script and consumes `getRow(index, row)` while it writes, so there
is no intermediate file and no Python. Gaussians are flat discs on the six axis-aligned tile
faces; colour is a flat baked luminance per tile (no lighting model in this variant).

### Convention notes found while calibrating (splat-transform 3.11.2, `.mjs` input — Beta API)

Worth knowing before writing another generator; measured, not documented:

* Emitted positions come out **mirrored in x and y** (`x_out = -x_in`, `y_out = -y_in`,
  `z_out = z_in`), so `-t` translations are mirrored the same way. `emit()` in the script
  pre-compensates.
* The generator's `rot_0..rot_3` columns map onto the standard PLY quaternion `(w,x,y,z)` as
  `w = rot_3, x = rot_2, y = -rot_1, z = -rot_0`. The `NORMALS`/`QUATS` table in the script is
  the inverse of that map, so normals can be written in the final world frame.
* `scale_i` columns are **not** permuted on the way out, so `scale_2` stays the minor axis of
  the emitted ellipse. Identity in `generators/gen-grid.mjs` is `rot = (0,0,0,1)`.
* Verified after conversion: for every asset the disc minor axis reconstructed from the written
  `.spz` matches the intended surface normal (max component error ≈ 0.003, i.e. 8-bit packing).

## Assets

| file | slide | what it shows | splats | size | measured time (CPU, this box) |
|---|---|---|---|---|---|
| `gpu.spz` | `gs-a2-gpu` | GPU card: PCB slab, cooler contact plate + 12 fins + shroud, row of 8 VRAM chips, PCIe edge-connector fingers (with key notch), backplate, power connector | 270,030 | 2.09 MB | bake 2.97 s + pack 1.31 s |
| `layers.spz` | `gs-a2-layers` | stack of 12 thin layer plates, gapped and drifting in x/z, light faces with dark rims | 150,456 | 1.29 MB | bake 0.59 s + pack 0.60 s |
| `kv-blocks.spz` | `gs-a2-kv-blocks` | 16 × 6 × 4 lattice of paged KV blocks, 224 of 384 blocks filled (58 %; mid/dark, random per block), the rest light wire outlines | 126,591 | 1.18 MB | bake 5.90 s + pack 0.52 s |
| `tokens.spz` | `gs-a2-tokens` | 12 rounded token tiles on a dark rail, each with one raised bar of a different height | 67,461 | 0.59 MB | bake 0.54 s + pack 0.41 s |
| `attn-mask.spz` | `gs-a2b-attn-mask` | 26 × 26 causal attention mask tile field: attended pairs solid, future pairs ghost outlines, last query row lifted + brightened | 114,686 | 0.31 MB | 0.50 s (generate + pack, one pass) |

Total for the method: 5.5 MB (cap 25 MB; every file under the 8 MB per-file cap).
Y-up, centred on the origin, largest extent 4.0 units for the four A2 assets and for
`attn-mask` after the `-t 0,0.0139,0` centring step.

Exact commands (also in `tools/splats/a2/make.sh`; `$ST` = `pnpx -s @playcanvas/splat-transform@3.11.2`):

```sh
uv run tools/splats/a2/bake.py --asset gpu       --out /tmp/a2-bake/gpu.ply       # 270030 splats, 2.97 s
uv run tools/splats/a2/bake.py --asset layers    --out /tmp/a2-bake/layers.ply    # 150456 splats, 0.59 s
uv run tools/splats/a2/bake.py --asset kv-blocks --out /tmp/a2-bake/kv-blocks.ply # 126591 splats, 5.90 s
uv run tools/splats/a2/bake.py --asset tokens    --out /tmp/a2-bake/tokens.ply    #  67461 splats, 0.54 s
$ST -w /tmp/a2-bake/<name>.ply public/splats/a2/<name>.spz
$ST -w tools/splats/a2/attn-mask.mjs -p n=26,sample=0.075 -s 0.15479 -t 0,0.0139,0 public/splats/a2/attn-mask.spz
$ST public/splats/a2/<name>.spz --stats null    # counts, bounds, per-column stats
```

Peak RSS of the bakes, measured with `resource.getrusage`: 55–127 MB (cap ~3 GB).
Times are the tools' own in-process numbers from a clean `bash tools/splats/a2/make.sh` run
(Nov 2026); `uv`/`pnpx` process start-up adds roughly another 0.2–1.0 s per command. The machine
was shared with other workers, so treat the seconds as typical rather than tight.
Scripts are deterministic (`--seed`, default 7): the same command reproduces the same splat count.

## Inputs, licences

* No external 3D assets, textures, scans or datasets were used. Geometry, luminance design and
  shading are original to these scripts (this agent, November 2026).
* 3D Gaussian Splatting `.ply` attribute schema (`x y z`, `f_dc_*` as `(rgb-0.5)/SH_C0` with
  `SH_C0 = 0.28209479177387814`, `opacity` as logit, `scale_*` as ln σ, `rot_*` as a
  normalised `w,x,y,z` quaternion): [3D Gaussian Splatting](https://repo-sam.inria.fr/fungraph/3d-gaussian-splatting/)
  (Huang et al., SIGGRAPH 2023) and the [PLY format guide](https://developer.playcanvas.com/user-manual/gaussian-splatting/formats/ply/).
* Converter / SPZ writer / generator API: [playcanvas/splat-transform](https://github.com/playcanvas/splat-transform)
  v3.11.2, MIT licence; `.mjs` generator shape copied from
  [`generators/gen-grid.mjs`](https://github.com/playcanvas/splat-transform/blob/main/generators/gen-grid.mjs).
  SPZ container: [nianticlabs/spz](https://github.com/nianticlabs/spz).
* [`uv`](https://docs.astral.sh/uv/) (Apache-2.0) runs the script; [`numpy`](https://numpy.org/) (BSD-3) is the only import.
* Ideas the shapes stand for (not data sources): paged KV cache block tables —
  [PagedAttention, arXiv:2309.06180](https://arxiv.org/abs/2309.06180); causal masking —
  [Attention Is All You Need, arXiv:1706.03762](https://arxiv.org/abs/1706.03762).

## Flagged / unknown

* Nothing here encodes a real card's dimensions, a real block size (vLLM's default
  `block_size` is 16 tokens per block — the lattice is 16 × 6 × 4 for looks, not because that is
  a configured cache), or real attention weights. Bar heights on the token tiles are decorative.
* Confirm against the speaker's actual hardware/topology before using any of these as a picture
  of *their* rig; the labels on the slides say "illustrative" for a reason.
* `attn-mask`'s y range is 0.043 units after `-t 0,0.0139,0` (the lifted query row makes the
  field asymmetric in y), so the mask plane sits just below the origin.
* `--spz-version` was left at the default (4). If the renderer in the deck ever refuses to load
  these, re-pack with `--spz-version 3`.
* The 6-tone ramp used by `src/scenes/pixel-viz.js` tops out at the slide background colour
  (`#DCE3D2`), so anything baked at luminance ≈ 1.0 vanishes into the page. Baked luminance is
  capped near 0.9 here; the "empty" outlines are deliberately faint.
