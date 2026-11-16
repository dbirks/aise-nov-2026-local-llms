# Handoff: "Beyond 'It Runs'" slides — style guide + 3D scene examples

> Imported from the Claude Design project "SNES-Style Quantization Slides" (`design_handoff_local_llm_slides/`) on 2026-11-16.
> The deck in `src/` implements this. The render pipeline lives in `src/scenes/pixel-viz.js` (same code, `three` from npm).

## Overview
Visual direction for the AISE (Nov 2026) talk on engineering local LLM inference. The talk is visualization-heavy: concepts like quantization, KV cache, MoE routing and speculative decoding are explained with live, orbitable 3D scenes rendered with a pixel/SNES-inspired post-process in a sage monochrome.

This bundle contains:
- an initial **style guide** (this file),
- `style-reference.html`: four slide types at 1920×1080 in the chosen style, one with a live 3D scene,
- `pixel-scenes/NOTES.md`: the render pipeline and six example scenes (2a–2c, 3a–3c).

## About the design files
Everything here is a **design reference built in HTML**: prototypes that show the intended look and behaviour, not production code. `pixel-viz.js` is a reasonable starting point for the render pipeline; the six scenes are **examples for inspiration**, not the final scene list. New scenes should follow the conventions below and the accuracy rules in AGENTS.md.

## Fidelity
- **Colours, typeface, slide layout:** high fidelity. Use the exact values below.
- **3D scenes:** medium fidelity. Keep the pipeline, palette mapping, camera conventions and interaction model. Scene content and geometry are exploratory.

## Design tokens

### Colour (monochrome sage)
| token | hex | use |
|---|---|---|
| `bg` | `#DCE3D2` | slide background, caption cards, 3D scene "white" |
| `ink` | `#2E3A2B` | all text, rules, borders, inverted highlights |
| `ink-2` | `#4F5E46` | inactive menu items / secondary text (large sizes only) |
| `rule-soft` | `#A7B499` | thin dividers between list rows |
| `hatch` | `#CFD8C4` | placeholder hatch for 3D areas: `repeating-linear-gradient(135deg,#CFD8C4 0 8px,#DCE3D2 8px 24px)` |
| `page` | `#C7D0BB` | area around slides (not inside slides) |

3D tone ramp (dark → light), applied by the post shader:
`#1C2419 #34412E #56684B #83957A #B3C1A5 #DCE3D2`

No other hues. Emphasis comes from inversion (ink background with `bg` text), weight of rules, and size.

### Typography
**Jersey 15** (Google Fonts, single weight 400) for **all** text: titles, body, labels, numbers and commands.

Jersey 15 has a small x-height and is condensed, so sizes run larger than usual. Scale at 1920×1080:
| role | size | line-height |
|---|---|---|
| title headline | 250px | 0.92, letter-spacing −0.01em |
| section number | 520px | 0.75 |
| section title | 160px | 0.9 |
| slide title | 110px | 0.95 |
| caption-card title | 90px | 1.0 |
| command / code lines | 56px | 1.5 |
| scene chip (top-left label) | 50px | — |
| body / list | 42px | 1.35–1.4 |
| running header / footer | 38px | — |
| interaction hint | 34px | — |

Minimum on-slide text is 34px.

Open question: monospaced code. Jersey 15 is proportional, so command alignment uses `&nbsp;` indents. If true mono becomes necessary, **Kode Mono** was the preferred alternative; **Handjet** and **Workbench** were runners-up for display.

### Spacing and lines
- Slide padding: 112px top/bottom, 128px left/right (96px for floating elements on full-bleed scene slides).
- Top rule: 4px solid `ink`, 28px above the running-header text.
- List dividers: 3px solid `rule-soft`, 14px padding-bottom, 18px gap.
- Caption card: `bg` fill, 6px `ink` top border, padding 48px 52px, width 900px, gap 24px.
- No border radius anywhere. No shadows inside slides. No gradients except the placeholder hatch.

## Slide types (see style-reference.html)
**A · Title.** 2-column grid (`1fr 540px`, gap 96px). Running header across both columns (talk name left, event/date right) under the top rule. Bottom-aligned: headline left, numbered chapter list right (01–05: Choose a model / Make it fit / Make it fast / Serve it / Connect it).

**B · Section divider.** Running header (talk title / `NN / 05`). Bottom row: huge chapter number, then chapter title and a one-sentence framing.

**C · Scene.** The 3D canvas fills the slide. Floating on top: a chapter chip top-left (`NN — Chapter`), a caption card bottom-left (title + 1–2 sentences), and an interaction hint bottom-right. Overlays use solid `bg` so text keeps full contrast over the dithered scene.

**D · Command.** A real `vllm serve` / `llama-server` command on the left, with the flag under discussion inverted (ink background, `bg` text, bleeding 20px past the text on each side). Concept title and short explanation bottom-right. This is the "config as map" narrative from the research notes: each flag cluster opens a scene, then the talk returns to the command.

## 3D scenes
Full detail in `pixel-scenes/NOTES.md`. Summary:
- Author geometry in **greyscale** with Lambert materials; colour comes only from the post shader.
- Pipeline: low-res render target (4× MSAA, nearest) → luminance → optional 4×4 Bayer dither → quantize to N tones → sage ramp → upscale with `image-rendering: pixelated`.
- **Presenter options** (keep exposed, don't bake in): `pixel` 1–8 device px (default **1.5**; 3 was too pixelated), `tones` 4 / 6 / 8 / 16 / 32 / smooth (default **16**; 6 gives strong SNES banding), `dither` on/off (default on).
- Camera: **orthographic, fixed three-quarter angle**, close to isometric but not exact. **No auto-rotate.** Drag to orbit, wheel to zoom, a reset-view action.
- Each scene exposes play/pause/step plus 2–4 concept controls, and a one-line live readout (on slides, in the caption card).
- Mark every simulated or illustrative quantity as such in the UI.

Feedback that set the direction: the isometric memory-budget piece was the favourite, along with a motion piece; 3a–3c showed non-block forms (terrain, tubes, splat particles) work just as well under the same post-process.

| id | scene | concept |
|---|---|---|
| 2a | Expert routing | MoE: top-k experts active per token, all experts resident |
| 2b | Draft & verify | Speculative decoding, linear draft, accept prefix, +1 target token |
| 2c | Split model | `-ngl` partial offload across system RAM / GPU |
| 3a | Landscape | Temperature reshapes probability terrain; top-p = water level |
| 3b | Attention arcs | Full vs sliding-window vs hybrid attention layers |
| 3c | Memory stream | Decode streams all weights per token: bandwidth × weight size, batching |

## Interactions
- Slide navigation: arrow keys. Inside a scene slide, ← → step the animation when it's paused. Rule: ← → step until the scene ends, then advance.
- Pointer drag on the canvas orbits (theta, with phi clamped 0.12–1.5 rad); the wheel zooms the ortho camera (0.4–4×).
- Scene state changes ease with exponential smoothing (`k = min(1, dt × 5–9)`); appear/disappear by scaling instances to 0.001.

## Assets
No images. Font: Jersey 15 (Google Fonts, OFL). three.js from npm.
