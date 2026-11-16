# Beyond "It Runs": Engineering Local LLM Inference

Research and planning repository for a **30-minute, 201-level AI/software engineering meetup talk** (November 2026).

## Premise

Assume the audience has already run a model with **Ollama or LM Studio**. The interesting next question is how to **choose, fit, accelerate, serve, and connect** local language models on real hardware. This is not an installation walkthrough or a taxonomy of LLM trivia.

The talk is intended to be a **rapid, interactive tour through detailed 3D visualizations**. The presenter may spend 15 seconds on one scene and dive into another. Graphics must represent real mechanisms faithfully—not metaphors or decorative 3D.

## Working presentation structure

1. **Choose** — recent local model capabilities; dense vs. MoE; architecture and quality tradeoffs.
2. **Fit** — weight quantization, GPU/CPU residency, context, KV cache and hybrid-model state.
3. **Accelerate** — prefill/decode, throughput/latency, speculative decoding (MTP, EAGLE-3, DFlash, DFlash2, DSpark, and research extensions).
4. **Serve** — compare decisions in vLLM, llama.cpp, and Ollama; concurrency, scheduling and resource budgets.
5. **Connect** — show an actual API gateway connecting separately hosted models (the speaker's *LLM Collective*). Do not assume distributed GPU memory or cross-machine model execution.

**Narrative device:** start from a real serving configuration, open a 3D explanation for the engineering decisions behind individual flags, then return to the configuration. Use the same concepts to compare different inference engines. Do *not* force a line-by-line tour or claim illustrative config values are production defaults.

## Living talk inventory: the speaker's actual experiences and ideas

**This README is the primary running inventory for the talk.** The speaker does **not** plan to use presenter/speaker notes. Preserve detail here for planning and for a future coding agent; the audience-facing visuals can be concise. This is not a final script, a set slide order, or a mandate to include everything. In particular, **the current slides in \`src/slides.ts\` are visual experiments**, not an approved talk plan. Brainstormed chronology is approximate, and the speaker says the real process involved going back and forth rather than following one linear route.

### What makes the talk different from an "install Ollama" tutorial

- Assume attendees have already installed Ollama or LM Studio, downloaded models, and experimented.
- The value proposition is what the speaker actually learned over months of trying to make local models useful and dependable for work and personal tasks.
- Prefer technically faithful, interactive/rotatable 3D explanations. A scene might take 15 seconds; the deck should allow quick, nonlinear navigation and optional deeper exploration.
- A configuration might be the organizing spine: show a real vLLM or llama.cpp launch config, select a flag or engineering decision, dive into a mechanically accurate 3D visualization, and return. Avoid a tedious flag-by-flag reference lecture.
- A real workflow or failure story should lead into a technical explanation whenever possible, rather than a parade of disconnected concepts.
- No invented hardware specs, measurements, model results, troubleshooting logs, or confident assertions about causation. Keep unresolved things explicitly unresolved.

### Motivation / the "why"

- **Personal turning point:** Qwen3.6-27B was the first local model that *felt reliably helpful* to the speaker—not simply able to make tool calls, but consistently choosing sensible actions in multi-step workflows. Examples: web searching, investigating Kubernetes issues, and remembering procedural details such as committing before pushing without repeated reminders. The speaker felt able to **trust it as a workhorse**, rather than constantly babysitting it.
- Possible explanation: effective post-training / instruction-following / agent behavior. This is the speaker's interpretation, not yet an established causal comparison; prompts, tool harness, decoding, context, and settings also matter.
- Briefly tried **Muse Glimmer**; don't imply a substantive evaluation.
- Then **Qwen3.8-27B** became another heavily used, trusted work model. Verify official names/release dates and distinguish the speaker's adoption history from the full model-release timeline.
- Local inference is enjoyable and technically interesting *even before* cost or data-control advantages.
- The speaker uses cloud AI subscriptions too, and appreciates currently inexpensive, highly capable hosted inference. This is not an anti-cloud argument.
- **Economic concern, explicitly speculative:** current provider usage/subscription economics might tighten as agent activity expands; the speaker has wondered about an AI industry correction. No assertion that a crash is inevitable, or that all tokens are currently sold below cost. A defensible takeaway is that knowing how to run models locally creates optionality if prices, quotas, availability, or demand change.
- One personal hybrid workflow mentioned: Claude subscription / **Opus 5.5** with **pi** agent harness and a local model. Exact orchestration (which component routes to which) needs confirmation before drawing an architecture.

### Approximate journey: from getting one model right to serving many requests

These are **memories of problems tackled**, not yet a chronology of exact releases or a formally designed performance study.

1. **Get even one instance running well.** Find a model/backend/hardware combination that produces useful decisions, tool behavior, acceptable stability and speed. A "model works" benchmark is not the same as dependable autonomous work.
2. **Fit more useful context / cache.** Try to make room for the desired KV-cache capacity and context while fitting model weights and other runtime allocations. Investigate quantization, attention architecture, KV-cache precision, GPU memory, CPU offload and other memory consumers. The speaker used the phrase "full KV cache"; confirm whether that meant the entire desired context in VRAM, a particular cache precision, or something else. Do not assume every runtime allocates the full context in advance.
3. **Run multiple things at the same time.** The speaker wanted parallel conversations/jobs, then *more and more replicas* or concurrent model workloads. Distinguish three separate mechanisms before the talk uses terms interchangeably: (a) multiple simultaneous sequences inside one model-serving process, (b) multiple independently loaded model instances/replicas on one machine, and (c) multiple independent servers/hosts. These have different weight-memory duplication and scheduler behavior.
4. **Discover llama.cpp fitting better at one stage.** Speaker observed that llama.cpp seemed to have less overhead or fit a configuration better than alternatives for that particular experiment. Capture the actual GPU, quantization, context, concurrency, overhead and measurement before explaining *why*. This is a conditional firsthand result, not a universal comparison.
5. **Move toward vLLM as concurrency grows.** Speaker increasingly tried vLLM when seeking to handle more active work or replicas, while still **switching back and forth with llama.cpp** rather than replacing it permanently. Explore continuous batching, memory scheduling, throughput/latency tradeoffs and possible reuse of loaded weights, but distinguish explanation from what was actually observed.
6. **Experiment with faster decoding.** Try multiple speculative decoding strategies/drafters and evaluate usefulness in real agent work, not merely synthetic text generation. Include MTP, EAGLE-3, DFlash, DFlash2, DSpark and newer proposals in research, but only feature approaches grounded in actual implementations and suitable model/hardware combinations.
7. **Attempt training a DSpark-style speculative drafter.** Speaker made an early attempt to train/build a DSpark draft model. An important practical lesson was the need to produce **a lot of representative on-policy data**—trajectories/examples resembling the actual agent work where speculative drafting should succeed. They experimented with **Deep SWE-bench-style software engineering tasks across multiple languages** to collect or generate this kind of data. Do not turn this into a claim that all DSpark training *necessarily* requires one particular dataset or number of traces until the paper and experiment are reviewed. Collect training procedure, target model, draft model, trace format, task mix, acceptance rate and resulting performance later.
8. **Discover engine specialization matters.** Don't discount small or specialized inference engines/forks designed for certain GPUs, kernels, architectures or workloads; their constrained scope can yield strong results on matching hardware while limiting portability, model support or maintainability.

### Current and recent inference-engine exploration

- **llama.cpp:** useful in at least one memory-footprint/fit situation; investigate actual launch commands, GGUF quantization, cache K/V types, context, \`-ngl\` / GPU offload, parallel slots, batching and flash attention.
- **vLLM:** interesting for serving many concurrent requests, batching, scheduling, KV-cache management, memory budgets and speculative-decoding integration. Candidate for walking through one complete *real* startup config, zooming into only consequential flags.
- **NInfer:** hardware/model-specialized inference, including RTX 5090 experimentation. Confirm precise name, version and measured speed/feature support.
- **Radiance:** speaker reports a coworker getting very good results from a Radiance/vLLM-derived runtime on an **AMD Radeon AI PRO R9700**. There was a change in project/fork naming/lineage; verify before claiming a specific fork genealogy. Capture actual comparisons rather than quoting general speed rankings.
- **Pennyroyal:** speaker reports very good results with a customized **SGLang-derived** runtime; the exact supported hardware/model/version and workload must be established.
- **Ollama and LM Studio:** useful accessible entry points, and reference points for what a 201-level audience has already tried.
- Potential presentation message: **"The best inference engine depends on your model, GPU, batch/concurrency pattern, kernel support and operational constraints."** Never infer that specialized engines are automatically superior.

### An especially good quick anecdote: memory and WSL

- The speaker used WSL while experimenting with local inference. Model-loading / file-cache behavior caused host-visible WSL VM memory usage to grow unexpectedly; the speaker reports a sudden WSL termination.
- **Direct-I/O or cache-avoidance flags were helpful in that setup.** Record the precise loader, flag, model checkpoint format, OS/WSL settings, memory readings and circumstances of the termination before recommending any command.
- A useful visual breakdown: **GPU weights / KV cache / runtime buffers**, separate from **Linux file page cache**, separate from **WSL2 VM memory usage seen by Windows**. Do not depict these as interchangeable or claim Linux cached memory is intrinsically unreclaimable. Direct I/O can avoid the Linux page cache in particular loading paths; it is not a universal "disable all caching" flag.
- This can make an excellent 15–30-second side trip when the config walkthrough reaches model loading and memory.

### Concepts / detailed visualizations worth having available

- **Model internals:** parameters vs embedding width vs vocabulary, real residual-stream vectors, contextual vs static embeddings, and the limitations of 3D projections of high-dimensional spaces.
- **Architecture:** dense vs mixture-of-experts routing, total vs active parameters, hybrid attention and model-specific recurrent state.
- **Fit:** what occupies VRAM/RAM, parameter weight storage, weight vs cache quantization, quantization error, context limits vs allocations, attention/KV state, GPU offload, host↔GPU transfer costs.
- **Performance:** prefill vs decode, memory bandwidth vs capacity vs compute, requests/second vs tokens/second vs latency, attention kernels, continuous batching, scheduler decisions.
- **Speculation:** linear drafting and prefix verification; greedy vs distribution-preserving stochastic acceptance; tree attention; MTP, EAGLE-3, DFlash, DFlash2, DSpark and research extensions. Show why acceptance alone does not equal throughput.
- **Behavior modification (optional excursion):** abliteration/refusal-direction changes, activation steering and the danger of disturbing post-trained behavior. Verify the cited Qwen "evil mode" result before presenting it.
- **Infrastructure:** independently hosted machines under **LLM Collective**, one API gateway / model routing entry point. This is **not** proof of pooled VRAM or distributed inference on one model; verify actual router architecture before animating.
- **Specialization:** an actual support matrix mapping a target model and specific GPU to compatible inference engines and kernels, optionally paired with speaker-measured results.
- Every 3D scene should identify what its geometry and motion mean in the real computation. Avoid metaphor-only visuals and fabricated benchmarks.

### Open narrative choices (do not decide by editing the slide examples)

- **Opening A — trust:** start with the moment Qwen3.6-27B became a helpful, fairly dependable local workhorse, then ask what it took to host it well.
- **Opening B — the current rig:** show the speaker's genuine serving setup and use the configuration as a clickable map of why choices were made. Risk: opening on flags before the audience cares.
- **Opening C — a failure:** demonstrate the unexpected WSL host-memory issue, then unpack local model memory management. Risk: too narrow for an introduction.
- Likely hybrid, **still provisional**: quick personal motivation → real setup/config with rapid interactive detours → what changed as concurrency and speculation became interesting → specialized engines and/or the LLM Collective as payoff.
- Avoid making the talk simply a list of definitions; each explanation should answer a real engineering problem the speaker faced. But don't force the exact chronology into a false linear story.

### Details to capture when the speaker supplies them

- Model IDs and release timing; which actual models were used at what stages.
- Exact hardware (especially RTX 5090 and AMD R9700), VRAM/RAM, model quantizations and load formats.
- Real command lines, config files and the most unexpectedly useful flags for **vLLM, llama.cpp, NInfer**.
- What "full KV cache" meant in the speaker's optimization journey.
- Whether "parallel" means concurrent sequences, processes/replicas, or separate hosts in each anecdote.
- Measurements: TTFT, tokens/sec per request, aggregate throughput, memory load, utilization and real failure patterns.
- How the DSpark draft experiment was structured, which **Deep SWE-bench** variant/languages were used, amount and format of on-policy data, and whether a working drafter emerged.
- Actual Radiance/Pennyroyal fork lineage, hardware, serving versions and comparative results.
- LLM Collective's true topology and the precise role of the Claude/pi/local workflow.

**Maintenance:** Keep adding/correcting brainstorming here as the speaker thinks aloud; do not mistake it for speaker notes or a promised list of final slides. The earlier \`docs/speaker-brainstorm.md\` remains background history, while **this README section is the consolidated and current inventory**.


## Slides (the deck)

The deck is a Vite + React + TypeScript app in `src/`, built with **pnpm**. Visual direction comes from the Claude Design handoff in [`design/handoff/`](design/handoff/README.md): Jersey 15, sage monochrome, live three.js scenes with a pixel post-process.

```sh
pnpm install
pnpm dev          # http://localhost:5173
pnpm build        # type-check + production build into dist/
```

- **Content:** `src/slides.ts` is the whole deck as data. Slide types are `title`, `section`, `scene`, `command` and `list` (see `src/deck/types.ts`). Set `example: true` on placeholder slides; they show an EXAMPLE tag.
- **Layouts:** `src/layouts/` has one component per slide type, authored at 1920×1080 and scaled to fit.
- **3D scenes:** `src/scenes/pixel-viz.js` (render pipeline and six example scenes).
- **Keys:** ← → step a paused scene or change slide · ↑ ↓ / Space change slide · `.` play/pause · `r` reset view · `O` overview · `P` presenter panel (pixel size, tones, dither, notes) · `F` fullscreen. Each slide has its own URL hash (`#/moe`).
- **Deploy:** `.github/workflows/deploy.yml` builds and publishes to GitHub Pages on every push to `main`.

## Research & agent handoff

- [Living research notes and detailed 3D scene briefs](docs/local-llm-talk-research-notes.md)
- [Instructions for an implementation agent](AGENTS.md)

The notes include storyboards, camera/interaction ideas, technical accuracy guardrails, references, and unresolved research questions. They are **working research**, not a validated final script or ready-to-run configs.

## Proposed abstract

> You've tried Ollama or LM Studio and run a model on your own machine. Now what? This fast-moving, visual 201-level walkthrough explores the practical decisions behind hosting local models well: choosing architectures, quantizing weights, managing KV cache and GPU memory, speeding up generation, and configuring inference engines like vLLM and llama.cpp. We'll connect those ideas to lessons from real deployments and a shared gateway for independently hosted models.

## To gather from the speaker

- Actual hardware, model IDs and quantizations, serving versions and measured performance.
- Practical lessons: unexpected bottlenecks, tuning decisions, and failed experiments.
- Verified LLM Collective topology: routing, health, authorization, fallbacks, capabilities.
- Which configurations and speculative decoding methods work *today* for the selected models/hardware.

**Research notes updated:** November 16, 2026.
