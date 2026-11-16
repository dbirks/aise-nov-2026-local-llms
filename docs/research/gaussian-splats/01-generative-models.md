# Generative models that output 3D Gaussian splats directly

Research date: 2026-11-16. Question: which models/products turn a text prompt, a single image, or a few
photos **directly into 3D Gaussian splats (3DGS)** — no photogrammetry capture, no per-scene optimisation.

**Landscape.** Three families work today. (1) *Cloud world models*: World Labs Marble and its successor
Atlas produce navigable scenes as ~0.5–2 M-splat SPZ/PLY files behind a paid app/API
([export docs](https://docs.worldlabs.ai/marble/export/gaussian-splat),
[Atlas blog](https://worldlabs.ai/blog/atlas)). (2) *Open-weights generators* that are almost all
diffusion/flow transformers with a Gaussian decoder — TRELLIS (MIT, ≥16 GB), DiffSplat, LGM, FlashWorld,
Tencent HY-World 2.0 — emitting a `.ply`/`.spz` in seconds on one NVIDIA GPU. (3) *Feed-forward splat
predictors* (AnySplat, ZipSplat, YoNoSplat, GRM, WorldMirror) that map a few unposed images to Gaussians in
one forward pass. Truly **autoregressive, LLM-style generators of Gaussians exist but are research-only**
([GaussianGPT, ECCV 2026](https://github.com/nicolasvonluetzow/GaussianGPT)), and no frontier multimodal LLM
emits splats natively — in practice an LLM *directs* a splat model
([image-blaster](https://github.com/neilsonnn/image-blaster)). For our deck the locally runnable options are
TRELLIS, DiffSplat, LGM and (non-commercial weights) FlashWorld; the cheapest splat needs no neural net at
all — [SyntaxSplat](https://github.com/iamvillain/SyntaxSplat) writes scenes as code and exports `.ply`
through a pixel-art palette pass, the same aesthetic as our dither post-process.

## Options

### World Labs Marble (closed, cloud)
- **What / input → output:** generative world model; text prompt, single image or 360 pano → navigable
  world; exports `.spz`/`.ply` splats (~2 M splats, or ~500 k low-res), pano PNG, collider mesh, optional HQ
  textured mesh ([export docs](https://docs.worldlabs.ai/marble/export/gaussian-splat),
  [file specs](https://docs.worldlabs.ai/marble/export/specs)).
- **How it works:** proprietary; API model ids `marble-1.0` / `marble-1.1` / `marble-1.1-plus`
  ([API pricing](https://docs.worldlabs.ai/api/pricing)). Architecture unpublished (unverified).
- **Open / license:** closed; commercial rights only on Pro
  ([billing](https://docs.worldlabs.ai/marble/support/account-billing)). **Local?** no — export needs a paid
  plan (Free generates but cannot export).
- **Status:** docs release notes run 20 Nov 2025 → 2 Apr 2026 and name Marble 1.0/1.1/1.1 Plus
  ([release notes](https://docs.worldlabs.ai/marble/release-notes)); launch date not stated there (unverified).
- **Output size (measured):** `curl -I` on World Labs' own sample-export links, 2026-11-16: 2 M SPZ
  30.3 MB · 500 k SPZ 7.6 MB · 2 M PLY 136 MB · 500 k PLY 34 MB.
- **Cost:** Standard **$20/mo** (20 000 credits, 12 worlds), Pro **$35/mo** (25), Max (75); API $1.00 per
  1 250 credits, world generation 1 500 credits (≈$1.20), draft 150; app and API credits are separate.
- **Fit for our deck:** best quality-per-minute here and scriptable
  (`POST /marble/v1/worlds/{id}:export`, [API ref](https://docs.worldlabs.ai/api/reference/worlds/export));
  one paid world is enough for a slide — apply the documented OpenCV→OpenGL flip (Y, Z × −1).

### World Labs Atlas (closed, cloud)
- **What / input → output:** "omni world model" (announced 2026-09-01): one → 100+ images or video →
  explicit 3D outputs, "worlds as point clouds or **3D Gaussian splats**… the same representation used in
  Marble"; text → images/360 panoramas, so text→3D goes via an image
  ([blog](https://worldlabs.ai/blog/atlas), [product](https://worldlabs.ai/atlas)).
- **How it works:** "**multimodal autoregressive diffusion transformer**", all inputs in one shared *spatial
  context* where every image is grounded at a 3D position; natively operates on 2D frames **and 3D depth
  maps**; up to 1 min of 1440p video with pixel-perfect camera control ([blog](https://worldlabs.ai/blog/atlas)).
  Closest thing to "an LLM that generates space".
- **Open / license / local:** closed, proprietary, cloud-only.
- **Status:** product page fetched 2026-11-16 lists public **Viewfinder**, Chisel, splats→mesh, Blender and
  an API quickstart (`docs.atlas.worldlabs.ai/quickstart`). Cost not published on those pages (unverified).
- **Fit for our deck:** talking point (one model, text+image+video+3D, splat output) more than an asset
  pipeline; live browser demo only if the venue network is solid.

### Tencent HY-World 2.0 / WorldMirror 2.0 (open weights)
- **What / input → output:** "accepts … text, single-view images, multi-view images, and videos, and
  produces 3D world representations (meshes / Gaussian Splattings)"; multi-view/video → 3DGS + points +
  depth/normals/cameras ([repo](https://github.com/Tencent-Hunyuan/HY-World-2.0)).
- **How it works:** **not one feed-forward net** — HY-Pano 2.0 (text/image → 360 pano, ~80 B) → WorldNav
  (VLM trajectories) → WorldStereo 2.0 (~17 B) keyframe expansion → WorldMirror 2.0 (~1.2 B feed-forward)
  **+ a 3DGS training stage** (`world_gs_trainer.py`) that exports the splat world
  ([worldgen README](https://github.com/Tencent-Hunyuan/HY-World-2.0/blob/main/hyworld2/worldgen/README.md)).
  WorldMirror alone *is* single-pass 3DGS.
- **Open / license:** weights + code released; *Tencent HY-World 2.0 Community License* — royalty-free but
  non-OSI and its territory **excludes the EU, UK and South Korea**
  ([License.txt](https://github.com/Tencent-Hunyuan/HY-World-2.0/blob/main/License.txt)).
- **Local?** yes with server hardware: CUDA 12.8, Python 3.11, FlashAttention, multi-GPU `torchrun`; the 80 B
  and 17 B stages rule out a laptop. **Status:** released 2026-04-15 (license), code/weights opened
  Apr–Jul 2026. **Cost:** free locally; hosted product pricing unverified.
- **Fit for our deck:** the headline *open* world model, but too heavy for our own assets — use its
  published samples plus the video-vs-3D-asset comparison in its README.

### Microsoft TRELLIS (open weights, MIT)
- **What / input → output:** "takes in text or image prompts and generates high-quality 3D assets in various
  formats, such as Radiance Fields, 3D Gaussians, and meshes"; `outputs['gaussian'][0].save_ply(...)` →
  `.ply` (+ `.glb`) ([repo](https://github.com/microsoft/TRELLIS),
  [example.py](https://github.com/microsoft/TRELLIS/blob/main/example.py)).
- **How it works:** unified **SLAT** (sparse 3D grid + dense multiview features) with specialised decoders;
  backbone is a **rectified-flow / flow-matching transformer**, not an LLM. Zoo: image-large 1.2 B,
  text-base 342 M, text-large 1.1 B, text-xlarge 2.0 B.
- **Open / license:** MIT code **and** weights ([HF card](https://huggingface.co/microsoft/TRELLIS-image-large)).
- **Local?** "An NVIDIA GPU with at least 16GB of memory is necessary… verified on NVIDIA A100 and A6000"
  (README); MIT ComfyUI nodes ([ComfyUI-IF_Trellis](https://github.com/if-ai/ComfyUI-IF_Trellis),
  [ComfTrellis](https://github.com/scaryplasmon/comftrellis)); unofficial Apple-Silicon/MPS port of the
  original model incl. the Gaussian renderer ([trellis-mac-mps](https://github.com/vinayapathak/trellis-mac-mps)).
- **Status:** created 2024-12, last push 2026-10-27 (GitHub API). **Cost:** free.
- **Fit for our deck:** the most self-contained licensed splat asset we can make ourselves on a 24 GB card —
  a few lines of Python, no capture, no fitting.

### Microsoft TRELLIS.2 (contrast: 3D-native went to meshes)
- **What / input → output:** 4 B image-to-3D model on "native and compact structured latents" with a
  field-free **O-Voxel** structure → **PBR-textured mesh/GLB** (up to 1536³); no Gaussian output
  ([project page](https://microsoft.github.io/TRELLIS.2/), [repo](https://github.com/microsoft/TRELLIS.2),
  MIT, [arXiv 2512.14692](https://arxiv.org/html/2512.14692v1)).
- **Local?** ported to Apple Silicon: "Generates 400K+ vertex meshes with baked PBR textures from a single
  image in **~5 min 13 s on M4 Pro** (24 GB)" ([trellis-mac](https://github.com/shivampkumar/trellis-mac), MIT).
- **Fit for our deck:** the counter-example — a 2026 SOTA 3D-native latent produced meshes, so
  "3D-native generation" ≠ "splat generation".

### FlashWorld (open weights; scene-level, seconds)
- **What / input → output:** "produces 3D scenes from a single image or text prompt in seconds,
  10–100× faster than previous works" — ICLR 2026 **oral**
  ([arXiv 2510.13678](https://arxiv.org/abs/2510.13678), [repo](https://github.com/imlixinyang/flashworld)).
  `python cli.py --input_dir … --output_dir … --video --spz --ply` → SPZ **and** PLY splats.
- **How it works:** "3D-oriented" multi-view **video diffusion** (Wan-style transformer + VAE) that emits
  Gaussian representations during generation instead of images for later reconstruction; dual-mode
  pretraining + cross-mode distillation.
- **Open / license:** code **Apache-2.0** (LICENSE in repo); **weights CC-BY-NC-SA-4.0** → non-commercial
  ([HF](https://huggingface.co/imlixinyang/FlashWorld)).
- **Local?** official A800 table: 8.5 s / 51 GB · 16.6 s / 30 GB · **20 s / 24 GB**
  (`--offload_t5 --offload_transformer_during_vae`) · 10 min / **9 GB** (`--offload_vae`); headline "7 s on
  1× A100/A800, 4 s on 1× H100/H800".
- **Status:** paper+code 2025-10-16; ICLR 2026 oral 2026-02-06; last push 2026-03-24. **Cost:** free (NC).
- **Fit for our deck:** strongest "one GPU, seconds, whole scene" demo — a ~20 s live scene on 24 GB; mind
  the NC licence if we distribute the asset.

### DiffSplat (open weights, MIT; objects)
- **What / input → output:** "synthesize 3D Gaussian Splats from text prompts & single-view images in
  1~2 seconds … fine-tuned directly from a pretrained text-to-image diffusion model"; `--save_ply` writes a
  `.ply` (with `--opacity_threshold_ply` to shrink it)
  ([repo](https://github.com/chenguolin/DiffSplat), [arXiv 2501.16764](https://arxiv.org/abs/2501.16764), ICLR 2025).
- **How it works:** latent diffusion **inside Gaussian space**: GS-VAE (84 M, initialised from SD/SDXL/SD3
  VAEs) + a per-pixel 3DGS reconstructor (GSRecon, 42 M) trained on ~265 k Objaverse objects; generator
  0.86 B (SD1.5) / 0.61 B (PixArt-Sigma) / SD3.5-medium.
- **Open / license:** MIT code, MIT weights ([HF card](https://huggingface.co/chenguolin/DiffSplat)).
- **Local?** yes, single Linux/CUDA GPU; `--half_precision` BF16 "will reduce the memory usage" (README).
  Published VRAM floor: none (unverified).
- **Status:** code+weights 2025-01-29; last push 2026-03-19. **Cost:** free.
- **Fit for our deck:** very good — MIT, sub-second, object-scale props, and a crisp "diffusion in a 3DGS
  latent" story to animate.

### LGM — Large Multi-View Gaussian Model (MIT; 2024)
- **What / input → output:** ECCV 2024 oral, text or single image → `.ply` splats (+ mesh via `convert.py`);
  4 views × 128² = **65 536 Gaussians** per object
  ([repo](https://github.com/3DTopia/LGM), [paper HTML](https://arxiv.org/html/2402.05054)).
- **How it works:** multi-view **diffusion** (MVDream for text, ImageDream for image) → feed-forward
  asymmetric U-Net (~0.4 B) predicts the Gaussian field; no per-scene optimisation.
- **Open / license / local:** MIT; "Inference takes about 10GB GPU memory (loading all imagedream, mvdream,
  and our LGM)" — README; needs `diff-gaussian-rasterization` + `nvdiffrast` CUDA builds.
- **Status:** paper Feb 2024; rotation-normalisation bug fixed + finetuned 2024-04-03; last push 2024-08-20
  (dormant). **Cost:** free.
- **Fit for our deck:** cheap, permissive, 10 GB baseline for the "multiview diffusion → splat" architecture.

### GRM — Large Gaussian Reconstruction Model (2024)
- **What / input → output:** "a large-scale reconstructor capable of recovering a 3D asset from sparse-view
  images in around 0.1s… a feed-forward transformer-based model"; 4 views (or multiview renders) →
  Gaussians; project page reports ~0.1 s reconstruction, <8 s generation
  ([project page](https://justimyhxu.github.io/projects/grm/), [arXiv 2403.14621](https://arxiv.org/abs/2403.14621), ECCV 2024).
- **How it works:** pixel-aligned Gaussians from a ViT-style transformer, unprojected into a dense 3D
  Gaussian set — an early "transformer instead of diffusion" generator.
- **Open / license / local:** open code+weights ([repo](https://github.com/justimyhxu/GRM)) but **no license
  detected** via GitHub API → research-only until confirmed; 2024-era GPU, VRAM not stated (unverified).
- **Status:** Mar 2024, last push 2024-04-04; superseded by AnySplat/YoNoSplat/ZipSplat.
- **Fit for our deck:** cite as the origin of "feed-forward transformer → splats"; don't build assets with it.

### Few unposed photos → splats: AnySplat · ZipSplat · YoNoSplat
- **What they are:** single-forward-pass models mapping uncalibrated, unposed images to 3DGS — reconstruction
  engines, but they answer "few images → splat with no capture pipeline", and generators build on them
  (VIST3A stitches AnySplat onto a video model).
- **AnySplat:** arbitrary view counts → Gaussians + predicted cameras; **code and models MIT**, SIGGRAPH
  Asia 2025 / ACM TOG ([HF card](https://huggingface.co/lhjiang/anysplat),
  [repo](https://github.com/InternRobotics/AnySplat), 970★, last push 2025-12-22).
- **ZipSplat:** "unposed images into 3D Gaussians in seconds, with… a Gaussian budget you choose at
  inference" ([repo](https://github.com/cvg/ZipSplat), Apache-2.0, created 2026-06-03;
  **weights CC-BY-NC-4.0** [HF](https://huggingface.co/veichta/zipsplat);
  [arXiv 2606.05102](https://arxiv.org/abs/2606.05102)).
- **YoNoSplat:** "reconstructs 3D Gaussian splats directly from unposed and uncalibrated images, while
  flexibly leveraging ground-truth camera poses or intrinsics when available" — ICLR 2026, MIT code,
  224×224 checkpoints ([repo](https://github.com/cvg/YoNoSplat),
  [HF botaoye/YoNoSplat](https://huggingface.co/botaoye/YoNoSplat)).
- **Local?** these are the small feed-forward family, the realistic consumer-GPU route; per-model VRAM is
  not published in the READMEs I opened (unverified).
- **Fit for our deck:** easiest legally clean splats if we photograph a prop (YoNoSplat = MIT code); they
  show the mechanism, not prompt-to-content generation.

### Text-to-3DGS via a video prior: VIST3A / VideoRFSplat (open weights)
- **What / input → output:** "VIST3A: Text-to-3D by Stitching a Multi-view Reconstruction Network to a Video
  Generator" (ICLR 2026 oral) — text → 3D-consistent splat scenes; VideoRFSplat is the same group's
  "direct text-to-3D model leveraging a video generation model to generate realistic 3DGS for unbounded
  real-world scenes" ([repo](https://github.com/gohyojun15/VIST3A),
  [project page](https://gohyojun15.github.io/VideoRFSplat/)).
- **How it works:** Wan 2.1 (1.3 B / 14 B) + released **LoRA adapters** stitched to a stitched AnySplat
  reconstruction net — artifacts `vist3a_1.3b_lora_ema`, `vist3a_14b_lora_ema`, `anysplat_stitched*.pth`
  ([HF HJGO/VIST3A](https://huggingface.co/HJGO/VIST3A)).
- **Open / license / local:** open code+weights but **no license file on the repo or HF card** (unverified →
  ask before shipping); needs a 1.3–14 B video model, VRAM unstated.
- **Status:** repo 2025-10-12 → last push 2026-05-20.
- **Fit for our deck:** research narrative gold (the *video prior* is what makes text→scene work), poor as an
  asset source for us.

### GaussianGPT — the autoregressive ("LLM-style") branch
- **What / input → output:** "we instead explore a fully autoregressive alternative and introduce
  GaussianGPT, a transformer-based model that directly generates 3D Gaussians via next-token prediction";
  input is a Gaussian scene/object context → generation, **completion, outpainting, tiling**, temperature
  control ([arXiv 2603.26661](https://arxiv.org/abs/2603.26661), ECCV 2026 oral;
  [repo](https://github.com/nicolasvonluetzow/GaussianGPT), MIT, 444★). Not a text-prompt model (text
  conditioning not evidenced in the paper abstract or README — unverified).
- **How it works:** sparse 3D-conv **VQ-VAE** compresses per-voxel Gaussians to discrete tokens → causal
  transformer with **3D rotary embeddings** predicts tokens → frozen VQ-VAE decodes back to Gaussians:
  `Gaussians → tokens → GPT → tokens → Gaussians → render`.
- **Open / license / local:** MIT code+checkpoints (scene VQ-VAE+GPT 2026-07-01, object-level PhotoShape
  2026-07-12); CUDA 12, built for Ampere (`TORCH_CUDA_ARCH_LIST="8.6;8.0"` — 3090/A6000/A100).
- **Fit for our deck:** the best slide-parable for "LLM-style tokens over 3D primitives"; use its figures,
  not outputs (no prompt→splat demo).

### NVIDIA Lyra / Lyra 2.0 (open code, research model licence)
- **What / input → output:** ICLR 2026: "distill[s] the implicit 3D knowledge in the video diffusion models
  into an explicit 3D Gaussian Splatting (3DGS) representation… At inference time, our model can synthesize
  3D scenes from either a text prompt or a single image for real-time rendering"
  ([project page](https://research.nvidia.com/labs/toronto-ai/lyra/),
  [arXiv 2509.19296](https://arxiv.org/abs/2509.19296)); Lyra 2 outputs `reconstructed_scene.ply`.
- **How it works:** camera-controlled video diffusion (GEN3C) synthesises training data; a **3DGS decoder**
  is aligned to the RGB decoder, then used alone at inference (no ground-truth 3DGS, no capture). Lyra 2.0
  lifts video to 3DGS with VIPE pose + DA3 depth — a reconstruction step, not a pure splat head.
- **Open / license:** code **Apache-2.0** ([repo](https://github.com/nv-tlabs/lyra), "Project Lyra: Open
  Generative 3D World Models", 2 881★); Lyra 2.0 models under the *NVIDIA Internal Scientific Research and
  Development Model License* (research only).
- **Local?** datacentre GPUs: "We have tested Lyra only on H100 and A100 GPUs… maximum observed memory
  during inference with full offloading: ~43GB"; Lyra 2.0 "**~9 min per 80 frames** on 1× H100 80GB
  (~35 s with `--use_dmd`)" + ~1 min for the 3DGS step.
- **Fit for our deck:** cite for "distil a video model into a splat generator" and as the honest hardware
  contrast to 16 GB TRELLIS; not a local demo.

### 404-GEN / three-gen (decentralised text→3DGS)
- **What / input → output:** "a decentralised, AI-powered toolset engineered to generate production-ready 3D
  Meshes and 3D Gaussian Splats (3DGS)" ([guide](https://guide.404.xyz/)) on Bittensor Subnet 17
  ([repo](https://github.com/404-Repo/three-gen-subnet), MIT, last push 2025-11-17); text or image prompt in
  the web app ("generating models can take up to 1 minute") → splat asset; the MIT
  [Unity add-on](https://github.com/404-Repo/404-gen-unity-plugin) generates 3DGS "from text or image
  prompts" and reads/writes `.ply`; [Blender add-on](https://github.com/404-Repo/404-gen-blender-add-on) GPL-3.0.
- **Open / local:** infra and plugins open; generation runs on subnet miners, and the generator
  architecture is not documented on the pages I opened (unverified). Pricing not verified.
- **Fit for our deck:** footnote — a 2024-vintage decentralised text→3DGS service with thin technical docs.

### LLM as director, not generator: image-blaster, Wordsmith, sparkjs-skill
- **What it is:** agent pipelines where a coding LLM plans the scene and calls real generators.
  `image-blaster` "Creates 3D environments, SFX, and meshes from a single image using Claude skills, World
  Labs, and FAL", producing a "Gaussian splat (`.spz`) of the *static* environment" with `marble-1.1`
  ([repo](https://github.com/neilsonnn/image-blaster), MIT, 12 549★, created 2026-04-21).
- **Also:** `Wordsmith` — "An LLM analyzes your prompt and decomposes the scene into a strongly-typed
  contract (`WorldSpec`)… **World Labs (Marble):** Generates the environment and terrain in 3D Gaussian
  Splatting (`.spz`)" ([repo](https://github.com/DavidBuenoCarmona/Wordsmith), MIT); `sparkjs-skill` gives
  Claude Code the whole Spark API so it can write splat renderers
  ([repo](https://github.com/shi3z/sparkjs-skill)).
- **Open / local:** MIT code; the splats come from closed cloud models, so the *code* runs locally, the
  generation does not.
- **Fit for our deck:** the honest answer to "does a multimodal LLM make splats?" — no, it *drives* one; also
  a template for producing our own scene assets.

### SyntaxSplat (code → splats, no network) + Spark (the renderer)
- **What / input → output:** "A browser tool that builds scenes procedurally out of Gaussian splats, with no
  meshes or textures… Each scene is written as code: signed distance field (SDF) shapes grouped into rigid
  parts… bakes the lighting into them, and draws them with an **optional pixel-art palette pass**";
  **Export .ply** "in its current pose as a standard 3D Gaussian Splatting file"
  ([repo](https://github.com/iamvillain/SyntaxSplat), MIT, created **2026-11-15**).
- **How it works:** SDF surface sampling → one brush-stroke splat per sample → hemisphere + SDF-AO + sun
  shadow bake in module workers; ES modules + WebGL2, three.js 0.160; first bake ~2–20 s, cached after.
  No VRAM, no model weights.
- **Renderer:** [Spark](https://github.com/sparkjsdev/spark) — "An advanced 3D Gaussian Splatting renderer
  for THREE.js", MIT, **v2.4.0**, WebGL2, formats ply/sogs/spz/splat/ksplat, peer dep `three >=0.180.0`
  (registry API, 2026-11-16), docs at [sparkjs.dev](https://sparkjs.dev/docs/). Our `package.json` pins
  `three ^0.187.0`, so Spark is compatible in principle — adding a dependency needs the owner's OK.
- **Fit for our deck:** the lowest-risk way to put a splat *in* the deck: bake a small palette-quantised
  `.ply` locally, or port the SDF→splat idea straight into `pixel-viz.js` and run it through our existing
  sage-palette + Bayer-dither pass. Nothing to download on talk day.

## Comparison table

| Option | Input | Local? | Open? | Output | Maturity (2026-11) | Fit |
|---|---|---|---|---|---|---|
| Marble | text/image/pano | no | no | SPZ, PLY (0.5–2 M splats) | product + API, 1.0/1.1/1.1 Plus | high quality, ≈$1.20/world |
| Atlas | images/video (text→img) | no | no | splats, point clouds | Sep 2026 model, public Nov 2026 | best omni-model story |
| HY-World 2.0 | text/image/views/video | server GPUs | Tencent community lic. | 3DGS, mesh, points | Apr–Jul 2026 | samples + architecture |
| TRELLIS | text/single image | ≥16 GB NVIDIA (MPS port) | MIT | PLY, GLB, radiance field | Dec 2024 → Oct 2026 | **best DIY asset path** |
| TRELLIS.2 | single image | M4 Pro ~5 min | MIT | PBR mesh/GLB only | 4 B, Dec 2025 | contrast slide |
| FlashWorld | text/single image | 24 GB ~20 s; 9 GB ~10 min | Apache code, NC weights | SPZ, PLY | ICLR 2026 oral | live scene demo |
| DiffSplat | text/single image | single GPU (floor unstated) | MIT | PLY | ICLR 2025 | clean object demo |
| LGM | text/single image | ~10 GB | MIT | PLY, GLB | ECCV 2024, dormant | cheap baseline |
| GRM | 4 sparse views | 2024 GPU | code, **no licence** | 3DGS | 2024 | history only |
| AnySplat/ZipSplat/YoNoSplat | few unposed photos | yes (small feed-forward) | MIT / Apache+NC / MIT | 3DGS (+ cameras) | 2025 → 2026-06 | our prop → splats |
| VIST3A / VideoRFSplat | text | needs 1.3–14 B video model | code+weights, **no licence** | 3DGS scene | ICLR 2026 oral | research narrative |
| GaussianGPT | Gaussian token stream | Ampere+ | MIT | voxel-GS scenes | ECCV 2026 oral | "LLM over 3D" slide |
| Lyra 1 / 2 | text/image/video | H100/A100, ~43–80 GB | Apache code, NVIDIA research weights | 3DGS, PLY | ICLR 2026 / 2026 | hardware contrast |
| 404-GEN | text/image | no (miners) | MIT plugins | PLY 3DGS, mesh | 2024 → 2025-11 | footnote |
| image-blaster / Wordsmith | image + prompt | code yes, model no | MIT code | SPZ env + GLB props | 2026 | answers the LLM question |
| SyntaxSplat + Spark | scene written as code | **yes, no VRAM** | MIT | PLY, in-browser splats | new (2026-11-15) | **cheapest splat for a slide** |

## Gaps and unverified claims

- **Marble internals/dates:** no published architecture for marble-1.x (World Labs' only architecture
  statement is about Atlas). No launch date on the docs pages I could fetch (release notes reach back only
  to 2025-11-20) — don't put one on a slide.
- **Atlas file formats per plan:** third-party coverage says the Atlas developer API outputs SPZ
  ([Radiance Fields, 2026-11-13](https://radiancefields.com/world-labs-opens-atlas-world-model-to-everyone));
  the World Labs pages I opened say only "point clouds or 3D Gaussian splats". Verify export rights before
  promising a live export.
- **Missing licences** (resolve before shipping assets): GRM repo, VIST3A repo + `HJGO/VIST3A`,
  YoNoSplat checkpoints, HunyuanWorld-Mirror (`NOASSERTION`), and Marble/Atlas commercial terms beyond the
  billing FAQ.
- **Non-commercial weights** matter if we distribute assets: FlashWorld (CC-BY-NC-SA-4.0), ZipSplat
  (CC-BY-NC-4.0), Lyra 2.0 models (NVIDIA research licence).
- **VRAM figures** for AnySplat/ZipSplat/YoNoSplat/DiffSplat/VIST3A/GaussianGPT are not published in the
  READMEs I opened; measure on our hardware before quoting anything in the talk.
- **TRELLIS `.ply` size:** community docs mention ~50 MB per file
  ([DeepWiki quick start](https://deepwiki.com/microsoft/TRELLIS/2.2-quick-start-examples), secondary) — not
  in the official README; re-measure. TRELLIS.2's "unlike Gaussian Splatting" framing also comes from that
  secondary wiki ([core concepts](https://deepwiki.com/microsoft/TRELLIS.2/3-core-concepts)).
- **Luma is no longer an option:** Luma's own assistant-facing page says the models are "Luma Ray" and
  "Luma UNI" and that Dream Machine is deprecated
  ([llm-info](https://lumalabs.ai/llm-info), [Dream Machine → Luma Agents](https://lumalabs.ai/models/luma-dream-machine-evolved-into-luma-agents));
  the Genie 3D generator's retirement rests on an app-store note reported by
  [prompttoprop](https://prompttoprop.com/reviews/luma-genie/) — no formal Luma announcement page found.
  Luma's splatting was always capture-based, not generative.
- **Capture ≠ generation** (keep separate on stage): KIRI Engine's 3DGS scan
  ([feature page](https://www.kiriengine.app/features/3d-gaussian-splatting)), Apple-Silicon *trainers* like
  [RadianceKit](https://github.com/bkindler/radiancekit) and [msplat](https://github.com/rayanht/msplat)
  ("~70 s training, ~350 FPS render on an M4 Max"), and [EasyEnv](https://github.com/TimChen1383/EasyEnv)
  (Blender add-on, single image → 3DGS environment, ~10 GB of files, "Leverage the technique of ml-sharp
  (from Apple) and 3DGS Render (from Kiri Engine)") — the last two need photos, and EasyEnv composes other
  models rather than generating from a prompt.
- **Speaker facts still needed:** venue GPU(s), whether the deck may add an npm dependency (Spark), whether
  generated assets get redistributed (licence choice), and whether a paid Marble/Atlas generation is
  acceptable for the talk.
