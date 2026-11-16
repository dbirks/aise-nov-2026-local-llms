# Pixel scenes: examples 2a–2c, 3a–3c

> Imported from the Claude Design handoff on 2026-11-16. Code: `src/scenes/pixel-viz.js`.

Reference implementations for the talk's visual style: live three.js scenes that read like SNES-era art in a sage monochrome, but remain orbitable 3D. Use these as inspiration and as a starting pipeline; the specific scenes are not final.

## Look
- Background `#DCE3D2` (light sage), ink `#2E3A2B` (dark sage). Page outside slides `#C7D0BB`.
- Scene geometry is authored in **greyscale only**. Color comes entirely from the post-process (below), so every scene matches automatically.

## Render pipeline (`mount()` in pixel-viz.js)
1. Render the scene into a low-resolution `WebGLRenderTarget` (nearest filtering, 4× MSAA so edges stay clean at low res).
2. Full-screen post shader:
   - luminance → gamma (1/2.2)
   - optional 4×4 Bayer ordered dither, amplitude = one tone step
   - quantize to N tones (skipped when tones = `smooth`)
   - map through a 6-stop sage ramp: `#1C2419 #34412E #56684B #83957A #B3C1A5 #DCE3D2`
3. Draw to the canvas, upscaled with `image-rendering: pixelated`.

### Options (`mount(el, kind, opts, onState)` / `handle.setOpts(opts)`)
| option | values | meaning |
|---|---|---|
| `pixel` | 1–8 (default 1.5) | size of one render pixel in **device** pixels. Render size = `layoutSize (clientWidth/Height) × min(2, devicePixelRatio) / pixel`; layout size ignores CSS transforms, so inside a scaled 1920×1080 slide `pixel` is measured in slide pixels. |
| `tones` | `4` `6` `8` `16` `32` `smooth` (default `16`) | number of luminance steps along the sage ramp. 4–6 = strong SNES banding, 16 = subtle, `smooth` = continuous gradient. |
| `dither` | bool (default true) | Bayer 4×4 dither before quantizing. Most visible at 4–8 tones. |

Feedback so far: pixel 3 / 6 tones was "far too pixelated" in a small viewport; 1.5–2 px with 6–16 tones felt right. Keep these exposed as presenter controls. On a 4K projector `pixel` may need to go up.

## Camera conventions
- Orthographic camera at a fixed three-quarter angle. Each builder returns `view: { target, radius, theta, phi, size }`; `size` present ⇒ ortho, `size` = half-height in world units.
- **No auto-rotate.** Drag orbits, wheel zooms, `action('view')` resets.
- Lighting: ambient 1.15 + one directional from (4, 8, 5). `MeshLambertMaterial`; flat shading on faceted objects reads well under quantization.

## Scene API
Each builder `buildX(scene, emit)` returns `{ view, update(dt), action(name, arg), resize?(W, H) }` and calls `emit(state)` only when its state changes. `mount()` returns `{ setOpts, action, dispose }`; `action('view')` and `action('rotate', ±1)` are handled by the orbit.

| id | kind | concept | actions |
|---|---|---|---|
| 2a | `moe` | MoE: router picks top-k experts per layer; all experts stay resident | `play` `step` `k` `usage` |
| 2b | `spec` | Speculative decoding, linear draft → one target pass → accept prefix, reject tail, +1 target token | `play` `step` `restart` `K` `p` |
| 2c | `offload` | `-ngl` split across system RAM / GPU, activations cross bus once | `play` `ngl` |
| 3a | `sample` | Temperature reshapes terrain; top-p = water level; ball = sample | `play` `sample` `T` `topP` |
| 3b | `attn` | Attention arcs: full vs sliding window vs hybrid | `play` `step` `mode` `W` |
| 3c | `flow` | Decode streams all weights per step: bandwidth (pipe) × weight size (pool), batch reuses the stream | `play` `bw` `wt` `B` |

## Accuracy notes (keep these when extending)
- All numbers are simulated or illustrative; scenes say so in UI copy.
- 2a routing is random; real routers are learned and per-layer.
- 2b uses a fixed per-token acceptance rate; it does not model exact speculative sampling (min(1, p/q) + residual), tree drafts, or method differences (MTP / EAGLE-3 / DFlash). On rejection the first rejected token and all descendants are discarded, then the target supplies one token; if all K accept, the target supplies a bonus token.
- 2c: CPU layers are slower mainly due to system-memory bandwidth; timing ratios are made up. VRAM cap (9 of 12 layers) is arbitrary.
- 3a: top-p is shown as a probability threshold, equivalent to "smallest set of highest-probability tokens whose cumulative mass ≥ p". Map positions are arbitrary (not an embedding space).
- 3b attention weights are synthetic (recency + first-token sink + a few key tokens).
- 3c ignores compute limits and KV-cache reads; it's the bandwidth-bound decode intuition only.
