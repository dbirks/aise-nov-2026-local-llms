# LLMs creating Gaussian splats via code, tools and agents

Researched 2026-11-16 for the local-LLM meetup deck. Classification used throughout: **(a)** LLM directly authors gaussian parameters, **(b)** LLM writes code that generates the splats, **(c)** LLM orchestrates a separate generative/reconstruction model through tools, **(d)** a dedicated 3D model that is not an LLM. The landscape in late 2026 is tool-shaped: nobody credible has an LLM type millions of gaussian primitives directly — a splat file is a fixed binary schema of positions, scales, quaternions, opacities and spherical-harmonics for hundreds of thousands to millions of ellipsoids, so LLMs instead *write code* (three.js/Spark constructors in JavaScript, numpy writers in Python) or *drive tools* (MCP servers wired to editors, splat trainers, or closed world-model APIs like World Labs Marble). The most striking new pattern is "agent operates the splat editor": Claude Code or Codex connecting over MCP to editors (EVOVA, SplatAgent, the jaccen 34-tool MCP server) that let the agent look at the scene, select splats and edit them like a human operator. Splat *generation* itself is still dominated by class-(d) models — per-scene trainers (nerfstudio/gsplat/Brush), feed-forward transformers (AnySplat), and video/world diffusion (Marble, HunyuanWorld-Voyager) — with LLMs acting as planners or wrappers, not authors. Several of these are genuinely local-friendly: Brush trains via WebGPU on macOS/consumer GPUs/browsers, SplatAgent explicitly supports vLLM/Ollama backends, and splatmaker-mcp wraps Nerfstudio on an RTX 4090 at zero marginal cost. For our deck, class (b) via Spark is the natural live demo because Spark is a three.js library — the same stack the deck runs on.

## Options

### 1. LLM writes Spark "procedural splats" code — class (b)

- **What it is:** [Spark's procedural-splats API](https://sparkjs.dev/docs/procedural-splats/) lets any author create gaussian collections in JavaScript: `PackedSplats.pushSplat(center, scales, quaternion, opacity, color)`, plus constructors `constructGrid`, `constructAxes`, `constructSpherePoints`, `textSplats` (rasterized text made of splats) and `imageSplats` (an image turned into splats). A coding agent writes the loop; the splats are computed at runtime — no file, no trainer. The same page documents "code inspiration" generators (`staticBox`, `snowBox`) for animated particle-style effects driven by a stateless `dyno` GPU computation graph.
- **Input → output:** natural-language intent → JS code → live `SplatMesh` in a three.js/WebGL2 scene (desktop, mobile, WebXR).
- **How it works:** general LLM (Claude/GPT/local) emits JS against the Spark API; each splat packs its parameters into 16 bytes.
- **Open or closed:** Spark is MIT, copyright World Labs Technologies ([LICENSE](https://raw.githubusercontent.com/sparkjsdev/spark/main/LICENSE)).
- **Runs locally?** The *demo* does — rendering is client-side WebGL2; the LLM is whatever you choose. There's even a community Claude Code skill teaching the Spark API (shi3z/sparkjs-skill — repo seen only in search results, not opened; unverified).
- **Status/date:** live docs; Spark 2.x current as of 2026.
- **Output format / size:** in-memory splats (can be exported via other tooling); splat counts of thousands–millions are practical.
- **Cost:** free.
- **Fit for our deck:** the strongest option — an agent (even local Qwen) could write a Spark `constructSplats` scene that renders *inside our own three.js deck*, and `textSplats`/`imageSplats` fit the pixel/dither aesthetic. Easy.
- **Sources:** [Procedural Splats docs](https://sparkjs.dev/docs/procedural-splats/) · [Spark LICENSE](https://raw.githubusercontent.com/sparkjsdev/spark/main/LICENSE)

### 2. LLM writes Python that emits .ply splat files — class (b)

- **What it is:** instead of runtime JS, the agent writes a Python script that computes positions/scales/quats/opacities/SH and serializes a 3DGS-format PLY. Writer libraries make this one function call: gsply's [`plywrite("output.ply", means, scales, quats, opacities, sh0, shN)`](https://gsply.readthedocs.io/en/latest/api/writer.html) (also writes PlayCanvas `.compressed.ply`, 3.8–14.5× smaller).
- **Input → output:** text prompt → agent-written numpy script → standard 3DGS `.ply` loadable in any viewer (SuperSplat, Spark, Blender…).
- **How it works:** LLM authors the generator; all "intelligence" about the splat schema is delegated to the library. Realistic only for *procedural* content (grids, glyphs, point-cloud effects) — an LLM cannot sensibly hand-author photo-real content; that's a reconstruction problem.
- **Open or closed / license:** gsply docs are public; package license not checked (unverified).
- **Runs locally?** Yes — pure CPU numpy; no GPU needed to write files.
- **Status/date:** current docs, accessed 2026-11-16.
- **Output format / size:** uncompressed or compressed PLY; gsply quotes 7–17M Gaussians/sec write speed.
- **Cost:** free.
- **Fit for our deck:** a fun live demo: "here's a local LLM writing a 20-line script that emits a splat artifact our slide then loads." Easy, with an offline artifact to show.
- **Sources:** [gsply writer docs](https://gsply.readthedocs.io/en/latest/api/writer.html)

### 3. EVOVA — Claude Code / Codex drive a splat editor over MCP — classes (a)+(b)

- **What it is:** the EVOVA browser splat editor's "AI Edit Mode" has an MCP tab: you run `claude mcp add --transport http evova https://app.evova.ai/api/mcp` (or the Codex equivalent) and your *own subscribed* Claude Code/Codex operates the editor — "looks at the scene, draws splats like brush strokes, or draws surfaces and solids from its own script… read[s] and change[s] existing points one part at a time", compares against reference images, runs editor tools, and iterates.
- **Input → output:** conversation → splat scene in the editor (formats incl. PLY, compressed PLY, .splat, .ksplat, SOG, SPZ and EVOVA's own msplat, per [Getting Started](https://app.evova.ai/en/help/editor/getting-started)); closest thing to class (a) found: the agent manipulates gaussian primitives directly through editor tools.
- **How it works:** MCP tool loop (capture view → move camera → draw/edit splats → re-check), LLM entirely external.
- **Open or closed / license:** proprietary hosted editor; usage costs EvoCredit (1 EvoCredit = 100 KRW) for server-side features; MCP-driven work bills against your own Claude/Codex subscription.
- **Runs locally?** No — the editor/MCP endpoint is their cloud (app.evova.ai), though the agent client can be local Claude Code.
- **Status/date:** live product docs, accessed 2026-11-16.
- **Cost:** EvoCredit pricing tiers unverified.
- **Fit for our deck:** good *screenshot/demo-video* material for "agent-in-the-editor"; not reproducible offline.
- **Sources:** [EVOVA AI Edit Mode](https://app.evova.ai/en/help/editor/ai-mode) · [Getting Started](https://app.evova.ai/en/help/editor/getting-started)

### 4. SplatAgent (GeoSplat Inspector) — open-source local splat editor with an agent, incl. local vLLM/Ollama — class (b)

- **What it is:** a local browser editor where "an AI agent works the same visible tools a human does — it flies the camera, selects splats, proposes edits, and answers questions about the scene." SparkJS renders; a CPU-only FastAPI Python backend owns splat data and the agent loop; vision-model frames are the agent's eyes.
- **Input → output:** existing `.ply/.splat/.spz/.ksplat` capture → cleaned/understood scene + agent narration; agents do cleanup (cut floaters) and analysis, not generation.
- **How it works:** tool-using agent loop; **model-agnostic: Gemini by default, any OpenAI-compatible API, or a fully local vLLM/Ollama model** (dedicated docs/self-hosted-vllm.md) — the standout local-open-weights datapoint.
- **Open or closed:** MIT ([repo](https://github.com/rbh227/geosplat-inspector)).
- **Runs locally?** Yes — no CUDA anywhere in the app; heavy lifting is browser rendering + CPU backend. Its drone-capture scenes were trained separately with COLMAP + gsplat MCMC (~45 min/building on one L40S); a 12,375-gaussian, 2.9 MB per-building splat at PSNR 21.7 is quoted ("small enough that the in-app agent can reason about every splat in it").
- **Status/date:** active; demo materials dated 2026-06–2026-08 in repo docs.
- **Cost:** free.
- **Fit for our deck:** excellent live-demo candidate: local Qwen via Ollama cleaning up a small splat, mirroring our serving story. Moderate effort (clone, run backend + browser).
- **Sources:** [rbh227/geosplat-inspector](https://github.com/rbh227/geosplat-inspector)

### 5. Awesome-Gaussian-Skills — 3DGS agent-skills + 34-tool MCP server — class (b)

- **What it is:** a catalog repo (1085 methods, 26 categories) that ships 18 Claude Code/Cursor agent skills *plus* an MCP server exposing **34 tools (21 core + 13 experimental): `import_scene`, `set_camera`, `modify_gaussians`, `render_frame`, `sculpt_pipeline`, SLAT latent editing**, with PLY exporters — i.e. an agent that can sculpt and render splats programmatically.
- **Input → output:** agent commands → gaussian edits on loaded scenes → renders/exports; also "voice-sculpt" demos in `mcp-server/examples/`.
- **How it works:** stdio MCP server (Node), plus knowledge-base skills so the agent picks right 3DGS methods; primarily a developer/research assistant.
- **Open or closed:** Apache-2.0 ([repo](https://github.com/jaccen/Awesome-Gaussian-Skills)).
- **Runs locally?** Server is local Node; renderer bridge details not fully verified (unverified).
- **Status/date:** actively churned — changelog files run through 2026-11-06.
- **Cost:** free.
- **Fit for our deck:** evidence that "MCP for splatting" is a real ecosystem; could pilot `modify_gaussians` offline. Medium effort.
- **Sources:** [jaccen/Awesome-Gaussian-Skills](https://github.com/jaccen/Awesome-Gaussian-Skills)

### 6. SuperSplat "Vibe Code Splat Apps" — what "the LLM made this splat app" usually means — class (b)

- **What it is:** PlayCanvas' July 2026 SuperSplat update: every downloadable splat ships a one-click Vite + PlayCanvas + TypeScript starter project, deliberately minimal and "the perfect thing to hand to your AI coding assistant — Cursor, Claude Code, whatever you like" (their snow-globe demo from a Le Mont Saint-Michel splat has [source on GitHub](https://github.com/willeastcott/snowglobe)). Same post: splat-transform 3.0 streams 100M+ gaussian scenes on standard hardware; SPZ export (~10× smaller than PLY).
- **Input → output:** existing splat + prompt → interactive web app. The LLM makes the *app*, not the splat — a useful honesty anchor for the talk.
- **Open or closed:** SuperSplat, splat-transform and the PlayCanvas engine are MIT.
- **Runs locally?** Yes (Node 22+ for splat-transform; browser for the app).
- **Status/date:** [blog post](https://blog.playcanvas.com/new-in-supersplat-vibe-code-splat-apps/) dated 2026-07-09; Editor 2.29.0.
- **Fit for our deck:** directly analogous to us: LLM-writes-three.js-code-around-a-splat. Trivial to reproduce.
- **Sources:** [PlayCanvas blog](https://blog.playcanvas.com/new-in-supersplat-vibe-code-splat-apps/)

### 7. Vauss — "built for you and your agent" splat trainer — class (c)

- **What it is:** Voyager/Nullframe's Rust GPU splat trainer (derived from Brush, Apache-2.0 components per its NOTICE), claimed 5.4× faster than gsplat-MCMC at ~half the GPU memory. Agents drive the whole video→splat pipeline: an installed Codex/Claude Code can run `vauss run room.mp4 --driver codex`, and `vauss serve` launches a stdio MCP server.
- **Input → output:** phone/360/fisheye video → trained splat (SPZ/PLY) + viewer, Blender pack, voxel game, collision mesh; 3–6 min training per scene on one GPU; "a good starting point" is 8 GB GPU / 16 GB RAM (their words).
- **How it works:** classical per-scene optimization (frame selection, camera solving, training, eval, export); the LLM only orchestrates CLI steps.
- **Open or closed:** *source-available* Vauss Preview License — free to use during research preview including commercially, "not open source"; © 2026 Nullframe.
- **Runs locally?** Linux x64 / macOS arm64 / Windows; CUDA path implied — Apple-Silicon support not stated (unverified).
- **Cost:** free preview; optional paid fal.ai hosted generation for `vauss ad`.
- **Fit for our deck:** the "agent at the shell" story with a real benchmark number; needs a CUDA GPU to demo. Medium-hard.
- **Sources:** [voyager-so/vauss](https://github.com/voyager-so/vauss)

### 8. Claude Code skills / MCP servers that run a nerfstudio trainer — class (c)

- **What it is:** two open examples of an LLM operating a *reconstruction* pipeline end-to-end. (i) [lichtpfad/gaussian-splat-skill](https://github.com/lichtpfad/gaussian-splat-skill): a Claude Code skill — "create a gaussian splat from my drone video" → env install, frame extraction, COLMAP, `splatfacto-big` training, `.ply` export, even a DC-only-PLY fix for TouchDesigner SH fringing; tested RTX 4080 16 GB, 35K iterations ≈ 9 min, Windows 11. (ii) [splatmaker-mcp](https://github.com/sandraschi/splatmaker-mcp) v0.4.0 (MIT): pitches itself as "the FOSS alternative to worldlabs-mcp's Marble API — point it at a video or a set of images, get a navigable 3D Gaussian-splat world back, run entirely on local hardware (RTX 4090)", wrapping Nerfstudio/Splatfacto as MCP tools; its README candidly notes a full end-to-end training run against real capture data was still pending as of 2026-11-01. splatmaker's own comparison table (sourced from its README, benchmark quality not independently verified) puts nerfstudio at ~10 min and ~6 GB VRAM on an RTX 4090.
- **Input → output:** video/images → trained `.ply`; the LLM never touches gaussian values, it runs `ns-process-data`/`ns-train`/`ns-export`.
- **Runs locally?** Yes — that's the point. (lichtpfad skill has no LICENSE file in the repo tree — treat as all-rights-reserved.)
- **Fit for our deck:** "your laptop + a local agent can already do photogrammetry-style capture→splat" — good talk material; demoing needs footage and hours of setup. Medium-hard.
- **Sources:** [lichtpfad/gaussian-splat-skill](https://github.com/lichtpfad/gaussian-splat-skill) · [splatmaker-mcp](https://github.com/sandraschi/splatmaker-mcp)

### 9. worldlabs-mcp + World Labs Marble — agent orchestrates a closed world model — class (c) over (d)

- **What it is:** [worldlabs-mcp](https://github.com/sandraschi/worldlabs-mcp) (MIT, v0.5.1, FastMCP) exposes the **Marble API as 21 MCP tools**: "generate navigable 3D worlds from text, images, panoramas, multi-view sets, or video; view them with a streaming Gaussian-splat renderer (Spark 2.0, LoD splat tree, .RAD paging); ground a voice agent in scene coordinates," plus Blender/Unity/Resonite export pipelines. This is the concrete shape of "an LLM made me a splat world": the LLM composes prompts and calls, Marble's model does the generation.
- **Marble itself (class d):** text/image/360 → explorable splat world. Closed. Per [billing docs](https://docs.worldlabs.ai/marble/support/account-billing.md): credit-based tiers Free (4 generations, no export) / Standard (12; editing + exports) / Pro (25; mesh export, commercial rights) / Max (75); example: a basic single-image generation costs 1,580 credits. Exports are [SPZ and PLY splats](https://docs.worldlabs.ai/marble/export/gaussian-splat) (SPZ→PLY converter linked); SparkJS is World Labs' recommended web renderer for Marble assets ([tools & examples](https://docs.worldlabs.ai/api/examples)). Dollar prices on the [pricing page](https://marble.worldlabs.ai/pricing) were not opened (unverified).
- **Runs locally?** No — hosted model; API key from platform.worldlabs.ai.
- **Status/date:** Marble launched 2025 (older than preferred); docs current 2026.
- **Fit for our deck:** the "gateway pattern" — same story as our local serving config, but the model is someone else's GPU. Easy to show a screenshot; requires an account + credits.
- **Sources:** [worldlabs-mcp](https://github.com/sandraschi/worldlabs-mcp) · [Marble export docs](https://docs.worldlabs.ai/marble/export/gaussian-splat) · [billing docs](https://docs.worldlabs.ai/marble/support/account-billing.md)

### 10. Research: LLM/VLM agents that plan layouts, then generative models emit the splats — class (c)

- **PhiP-G** ([arXiv:2502.00708](https://arxiv.org/abs/2502.00708), Feb 2025): "Leveraging LLM-based agents, PhiP-G analyzes the complex scene description to generate a scene graph, and integrat[es] a multimodal 2D generation agent and a **3D Gaussian generation method** for targeted assets creation", plus a physics-pool layout stage with a visual-supervision agent; reports SOTA CLIP scores and 24× efficiency vs prior compositional pipelines.
- **Agentic 3D Scene Generation with Spatially Contextualized VLMs** ([arXiv:2505.20129](https://arxiv.org/abs/2505.20129), May–Jul 2025): VLM reads/updates a working memory (scene portrait + labeled point cloud + scene hypergraph) to iteratively generate, understand and *edit* 3D environments with asset generation and automatic verification.
- **WorldCraft** ([arXiv:2502.15601](https://arxiv.org/abs/2502.15601), Feb 2025): coordinator + ForgeIt/ArrangeIt LLM agents create indoor/outdoor scenes via **procedural generation** with natural-language object control; abstract does not mention splats (mesh/asset pipeline), so count it as code-gen pattern evidence, not splat generation (output representation unverified).
- **SceneCraft** (ICML 2024, [arXiv:2403.01248](https://arxiv.org/abs/2403.01248) — 2024, older): the archetype — an LLM agent converting text to Blender-executable Python for scenes of up to ~100 assets (abstract quoted from search results; arXiv page not opened). Pre-dates splats in this line of work.
- **SceneAgent** ([Harvard Comput. Robotics project page](https://computationalrobotics.seas.harvard.edu/SceneAgent/), 2026 preprint): agentic pipeline that converts 3DGS/photogrammetry/LiDAR/AI-generated-3DGS captures into *simulation* environments (segmentation, physics estimation, articulation), using simulator-based visual inspection and repair — agent downstream of splats rather than generating them.
- **Open/closed:** research code, mixed; not packaged for consumers. **Locally?** These pipelines are GPU-heavy research scaffolding; hardware needs unstated (unverified).
- **Fit for our deck:** the intellectual frame for an "LLM as art director, 3DGS as painter" slide; cite-only, don't demo.
- **Sources:** links above; also DecompDreamer (VLM-guided multi-object 3DGS training, [arXiv:2503.11981](https://arxiv.org/html/2503.11981v1) — abstract via search results only) and MiDSummer ([ICCV 2025 paper page](https://openaccess.thecvf.com/content/ICCV2025/html/Hu_MiDSummer_Multi-Guidance_Diffusion_for_Controllable_Zero-Shot_Immersive_Gaussian_Splatting_Scene_ICCV_2025_paper.html), diffusion-guided immersive splat scenes — abstract via search results only).

### 11. Research: language-guided splat *editing* — mostly diffusion, not LLM authors — class (d) with a text interface

- **GaussianEditor: Editing 3D Gaussians Delicately with Text Instructions** ([CVPR 2024 project page](https://gaussianeditor.github.io/)): text instruction → localized edits (object move/remove/integrate, appearance) on an existing 3DGS scene via 2D-diffusion guidance + Gaussian semantic tracing. **GaussCtrl** ([arXiv:2403.08733](https://arxiv.org/abs/2403.08733), 2024): renders the 3DGS to images, edits them with ControlNet, then optimizes the 3D model — key claim is *multi-view consistent* batch editing.
- These are 2024 (older): "text" here means a CLIP/diffusion condition, **not a chat LLM issuing tool calls** — the accuracy distinction to keep on-slide. The agentic variant arrives in **AGE: Agentic Gaussian Editing in 3D Scenarios** ([Springer chapter](https://link.springer.com/chapter/10.1007/978-3-032-37553-7_13)), which argues prior editing "assume[s] static user intent and rely[s] on fixed execution pipelines" (its references include Qwen3-VL, 2025, so it's 2025/2026 work; exact venue/year unverified).
- **Locally?** 2024 methods need a consumer GPU + per-scene optimization (GSEdit's abstract claims "minutes on consumer hardware" — seen via search results, not opened).
- **Fit for our deck:** grounds a "text can already edit splats — the diffusion did the work, the LLM only plans" claim. Cite-only.
- **Sources:** links above.

### 12. Class-(d) baselines an LLM merely orchestrates: Brush, AnySplat, Voyager, TripoSplat

- **Brush** ([Apache-2.0 repo](https://github.com/ArthurBrussee/brush)): 3DGS training engine in Rust/Burn over WebGPU — "works on macOS/windows/linux, AMD/Nvidia/Intel cards, Android, and in a browser… dependency-free binaries"; takes COLMAP or nerfstudio-format datasets; is the upstream Vauss derived training from. The best "splat training on Apple Silicon / no CUDA" datapoint we found.
- **AnySplat** ([MIT repo](https://github.com/InternRobotics/AnySplat), [arXiv:2505.23716](https://arxiv.org/abs/2505.23716), code released 2025-06-30): transformer that predicts gaussian parameters (μ, σ, r, s, c) + depth + poses from **uncalibrated images in one forward pass** — no per-scene optimization; Gradio demo on Hugging Face.
- **HunyuanWorld-Voyager** ([Tencent repo](https://github.com/Tencent-Hunyuan/HunyuanWorld-Voyager)): video-diffusion framework generating world-consistent 3D point-cloud sequences from one image + camera path, jointly producing aligned RGBD for direct reconstruction; weights under the `tencent-hunyuanworld-voyager-community` license ([HF page seen via search results — license terms not opened, unverified](https://huggingface.co/tencent/HunyuanWorld-Voyager/tree/main)).
- **TripoSplat** (Tripo): single image → 3DGS asset, day-0 [ComfyUI support blogged](https://blog.comfy.org/p/bringing-native-support-for-3d-gaussian) as "an open-source model" (license terms not opened, unverified).
- **Why they belong in this file:** every agent story above ultimately calls one of these; none of them is an LLM. VRAM figures not opened per model (unverified).
- **Fit for our deck:** a Brush-in-the-browser or AnySplat-forward-pass visual makes "the hard part is still the 3D model, not the text model" concrete. Medium effort to demo.

## Comparison table

| option | class | input | local? | open? | output format | maturity | fit for us |
|---|---|---|---|---|---|---|---|
| Spark procedural JS | b | prompt → agent code | yes (browser) | MIT | live splats in three.js | production lib | ★ best |
| Python PLY writer (gsply) | b | prompt → agent script | yes (CPU) | docs free; pkg license unchecked | .ply / .compressed.ply | usable | ★ easy offline artifact |
| EVOVA MCP | a/b | chat in browser editor | no (cloud editor) | closed | ply/splat/ksplat/sog/spz/msplat | live product | demo video only |
| SplatAgent | b | .ply + chat | yes; vLLM/Ollama backends | MIT | edited .ply | active, demo-grade | ★ best local-LLM story |
| Awesome-Gaussian-Skills MCP | b | agent tools | yes (Node) | Apache-2.0 | ply exports | new, churns | pilot test |
| SuperSplat vibe-code apps | b | splat + prompt | yes | MIT | web app | production (2026-07) | trivial to show |
| Vauss | c | video | yes (CUDA GPU ≥8 GB) | source-available preview | spz/ply/mesh/voxel | research preview | needs CUDA rig |
| nerfstudio skills/MCP (lichtpfad, splatmaker) | c | drone/photo/video | yes (RTX 4080/4090 class) | MIT / no license | .ply | working / partial | capture demo |
| worldlabs-mcp → Marble | c→d | text/img/video | no (hosted API) | server MIT; model closed | spz/ply/glb | commercial | "gateway pattern" slide |
| PhiP-G / VLM-agentic scene gen | c | text → scene graph → 3DGS | research GPU | papers, mixed code | 3DGS scenes | research (2025) | cite |
| Text-3DGS editing (GaussianEditor, GaussCtrl, AGE) | d(+c) | text on existing splat | consumer GPU | papers | edited 3DGS | 2024 research | cite |
| Brush / AnySplat / Voyager / TripoSplat | d | images/video | Brush: incl. Apple Silicon & browser; others GPU | Apache/MIT/mixed licenses | ply/safetensors | strong | baseline visuals |

## Gaps and unverified claims

- **Class (a) is essentially empty.** No source found of an LLM emitting raw gaussian arrays at scale into a .ply. Where posts claim "the LLM made this splat" the reality checked out as: LLM wrote generator/viewer code (Spark/SuperSplat pattern), drove an editor/trainer via tools, or called a dedicated world model. (E.g. the "VR rhythm game vibe-coded in Claude" YouTube demo describes the *code* being vibe-coded around an existing splat-template — page only seen in search results, unverified.)
- **Marble dollar pricing and API rate limits** not checked (pricing page not opened; plan/credit structure is from World Labs docs). The Marble *model architecture* is undisclosed; World Labs' RTFM is explicitly **not** splat-based ("an autoregressive diffusion transformer… without needing explicit geometric representations" per [radiancefields.com](https://radiancefields.com/world-labs-announces-realtime-frame-model-(rtfm)), page opened via search snippet only) — do not conflate RTFM with Marble exports.
- **mcp-for-blender's Marble integration** (agent imports Marble worlds into Blender as splats) seen only in search results ([page](https://www.mcp-for-blender.com/docs/integrations/world-labs)) — not opened; likewise shi3z/sparkjs-skill, generato.io's "text→PLY in a minute", PrintedForFun/ply-to-splat, and the Facebook "experiment I made in Claude" post.
- **Benchmarks inherit vendor claims:** Vauss "5.4×/half memory" and the splatmaker table's VRAM/time figures are self-reported; SplatAgent's PSNR-21.7 building file is the author's own pipeline summary. GSEdit "minutes on consumer hardware" via abstract snippet.
- **AGE (Springer chapter)**: venue/volume/year not confirmed beyond the DOI page; AGE abstract body not fully read.
- **Licenses not opened:** gsply package license, TripoSplat model license, HunyuanWorld-Voyager community terms, lichtpfad skill (no LICENSE file observed in tree).
- **AnySplat/Voyager consumer-GPU feasibility** (VRAM for the feed-forward and video-diffusion paths) not stated in the pages opened — confirm before any local live demo.
