# Splat lab — method C: real generative 3D on hosted GPUs (Hugging Face Spaces)

Genuine 3D Gaussian-splat models produced by **someone else's GPU**: a public
Hugging Face Space that runs a text/image → 3D-Gaussian model. Nothing is baked on
this laptop (it has no GPU); this folder only holds the client, the normaliser and
the provenance below. Generator: [`../../tools/splats/c/hf_generate.py`](../../tools/splats/c/hf_generate.py).

## Spaces probed (2026-11-16, `GET https://huggingface.co/api/spaces/<id>`)

| Space | Status | Hardware | Output | License (space) |
|---|---|---|---|---|
| [`dylanebert/LGM-mini`](https://huggingface.co/spaces/dylanebert/LGM-mini) | RUNNING | ZeroGPU A10G | Gaussian `.ply` | MIT |
| [`trellis-community/TRELLIS`](https://huggingface.co/spaces/trellis-community/TRELLIS) | RUNNING | ZeroGPU A10G | GLB **+ Gaussian `.ply`** (`/extract_gaussian`) | MIT |
| [`ashawkey/LGM`](https://huggingface.co/spaces/ashawkey/LGM) | RUNNING | ZeroGPU A10G | Gaussian `.ply`, accepts a **text prompt** with no input image | MIT |
| [`microsoft/TRELLIS.2`](https://huggingface.co/spaces/microsoft/TRELLIS.2) | RUNNING | ZeroGPU A10G | GLB mesh only → not usable here | MIT |
| [`prithivMLmods/TRELLIS.2-Text-to-3D`](https://huggingface.co/spaces/prithivMLmods/TRELLIS.2-Text-to-3D) | RUNNING | ZeroGPU A10G | text → image → GLB only | Apache-2.0 |
| [`CaiYuanhao/DiffusionGS-Object`](https://huggingface.co/spaces/CaiYuanhao/DiffusionGS-Object) | RUNNING | ZeroGPU A10G | Gaussians (DiffusionGS) | not stated |
| [`paulpanwang/Diffsplat`](https://huggingface.co/spaces/paulpanwang/Diffsplat) | CONFIG_ERROR | — | — | — |
| [`microsoft/TRELLIS`](https://huggingface.co/spaces/microsoft/TRELLIS) | CONFIG_ERROR | — | original demo, gone | — |

Every splat-output Space found runs on **ZeroGPU**, i.e. the free GPU quota of the
calling account (see "Quota" below). A sweep of ~220 3D/splat Spaces for any running
on owned (non-ZeroGPU) GPUs found only CPU demos.

## Asset: `lgm-gpu.spz` — LGM-mini on a hosted GPU

| | |
|---|---|
| Model | LGM (Large Multi-View Gaussian Model), "mini" Diffusers pipeline [`dylanebert/LGM`](https://huggingface.co/dylanebert/LGM) + `dylanebert/multi-view-diffusion` |
| Space | https://huggingface.co/spaces/dylanebert/LGM-mini (gradio 5.49.1, ZeroGPU A10G) |
| Input | photo of a Gigabyte GV-NX66T128VP graphics card, **public domain** — [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Gigabyte_GV-NX66T128VP.jpg), author Evan-Amos; local copy `tools/splats/c/inputs/gpu-gigabyte.jpg` (resized to 1024 px, no other edits) |
| Call | `POST /run(input_image, seed=42)` via gradio_client |
| Wall time incl. queue | **4.7 s** (measured 2026-11-16 20:51 UTC; a second identical call took 5.2 s) |
| Raw output | 39,646 Gaussians, 2,220,537 B `.ply` (14 properties, SH band 0) |
| After normalising | 33,372 Gaussians kept (opacity ≥ 0.05), centred, y-up, largest extent 4.00 × 3.64 × 3.48 |
| Final file | `lgm-gpu.spz`, 524,709 B (512 KB) |

```bash
# 1. generate on the hosted GPU (needs the anonymous ZeroGPU quota, see below)
uv run tools/splats/c/hf_generate.py --job lgmmini_gpu
#    -> /tmp/splat-c/lgmmini_gpu.raw.ply   (raw .ply path is in manifest.json)

# 2. centre / y-up / scale to 4 units, drop transparent splats
uv run tools/splats/c/normalize.py /tmp/splat-c/lgmmini_gpu.raw.ply /tmp/splat-c/lgmmini_gpu.norm.ply

# 3. convert (decimate with `-d 50%` if it ever exceeds 8 MB)
pnpx @playcanvas/splat-transform@3.11.2 /tmp/splat-c/lgmmini_gpu.norm.ply public/splats/c/lgm-gpu.spz
pnpx @playcanvas/splat-transform@3.11.2 public/splats/c/lgm-gpu.spz --stats text null
```

Coordinate convention: the Space gives no metadata, so the asset is taken **as-is**
(LGM renders an OpenGL-style orbit, i.e. +Y up, +Z towards the viewer). Nothing was
flipped; if the deck shows it lying down, `--rot`/`--flip` in `normalize.py` fixes it
without re-running the model.

### Verification of the shipped file

```
$ pnpx @playcanvas/splat-transform@3.11.2 public/splats/c/lgm-gpu.spz --stats text null
format: spz   gaussian: yes   gaussians: 33372   lods: 1   sh bands: 0
x  min -1.988  max  2.000      y  min -1.830  max  1.815     z  min -1.740  max  1.740
opacity min 0.051 max 1.000    (524,709 B on disk, cap 8 MB)
```

Luminance of the splats (`0.2126R+0.7152G+0.0722B` of the decoded SH0 colour,
opacity-weighted): mean 0.46, p5 0.19, p50 0.47, p95 0.76 — a 0.56 range, which is what
the deck's 6-tone ramp needs, since the post shader throws hue away.

## Quota — the real limit of this method (verbatim errors)

Anonymous ZeroGPU gives a small daily GPU budget, and a single TRELLIS job asks for
60 s of it. `uv run tools/splats/c/hf_generate.py --job trellis_gpu`, 2026-11-16 20:52 UTC:

```
attempt 1 failed: ReadTimeout: The read operation timed out
attempt 2 failed: ReadTimeout: The read operation timed out
attempt 3 failed: AppError: The upstream Gradio app has raised an exception but has
                  not enabled verbose error reporting. To enable, set show_error=True
                  in launch().
```

and afterwards every GPU endpoint of every ZeroGPU Space answers immediately
(`--job lgmmini_rack`, 20:56 and 20:57 UTC — this one is reported by the app itself):

```
AppError: You have exceeded your ZeroGPU quota (60s requested vs. 0s left).
          Try again in 0:00:00. Authenticate with a Hugging Face token for more
          quota - https://huggingface.co/settings/tokens
```

A second sweep (311 Spaces, same day) for **any** Running 3D/splat Space not on
ZeroGPU returned only `cpu-basic` demos — including [`innoai/TRELLIS`](https://huggingface.co/spaces/innoai/TRELLIS),
whose served `/config` has zero `dependencies` (dead UI, nothing callable), and
[`ostapient/mast3r-3dgs`](https://huggingface.co/spaces/ostapient/mast3r-3dgs) (photo
reconstruction, not generation). So there is no quota-free hosted route to a splat here:
method C is gated on the caller's GPU budget, and a second model needs either an HF token
or the next quota window.

Two traps worth recording:

1. **Client version.** With `gradio_client` 2.7.2 (built for gradio 6) *every* image
   endpoint of these gradio 5.x Spaces fails with the masked `AppError` above, because
   the upload API changed; number-only endpoints (`/get_seed`) still work, so it looks
   like a dead Space or an exhausted quota. `gradio_client==1.14.0` works — pinned in
   the script header.
2. **`ReadTimeout` is not a crash.** The first two TRELLIS attempts kept running
   server-side and were still paying for GPU seconds; three attempts burned the whole
   day's budget. `client_for()` now sets an 1800 s httpx timeout, and the retry policy
   in `call_with_retry` (3 tries, linear back-off) is the ceiling the brief asks for.

**To finish the set** (once the quota resets, or with `HF_TOKEN` exported and
`token=` passed to `Client`): `--job trellis_gpu` (TRELLIS → Gaussians, one different
model), `--job lgmmini_rack` (LGM on a CC0 server-rack photo) and
`--job lgm_text_robot` (ashawkey/LGM driven by a **text prompt only**: "a cute robot
reading a book, studio photo"). Each writes `/tmp/splat-c/<job>.raw.ply` plus timings
into `tools/splats/c/manifest.json`; steps 2 and 3 above are per-asset. Budget: LGM-mini
≈ 5 GPU-s per asset, TRELLIS ≈ 60 GPU-s per asset.

## Inputs on disk

`inputs/` holds only freely licensed photos, fetched 2026-11-16 from Wikimedia Commons:

| File | Subject | License |
|---|---|---|
| `gpu-gigabyte.jpg` | Gigabyte GV-NX66T128VP card, white backdrop | Public domain (Evan-Amos) |
| `gpu-7900.jpg` | Nvidia 7900GS card | Public domain (Evan-Amos) |
| `server-rack.jpg` | Legrand S.A. server rack | CC0 1.0 (OboeBlanket) |

No personal data, names or private images were sent to any third-party service.

## Claims this asset must not support

It is a *single stochastic generation* of one photo at ~33k Gaussians: no quality
comparison against other models, no "this is what vLLM/llama.cpp host" implication, and
no measured inference numbers for the LLM talk. The 4.7 s figure is one queued call on
a shared free A10G, not a benchmark.
