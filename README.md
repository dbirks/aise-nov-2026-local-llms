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


## Focused research added 2026-11-16: speculators, precision, PLE, and cache

These notes are **topic candidates and source-grounded research**, not approved slide order or presenter notes. They follow a deeper read of the speaker's [dbirks/home-k8s](https://github.com/dbirks/home-k8s) issues and live/past manifests. Be careful: an issue can be a **plan**, a **historical observation**, or a **revised conclusion**. Prefer the most recent evaluation to an older optimistic runbook. The implementation agent should use the underlying links, not invent measured data.

### Speculative decoding: a family of algorithms, not synonymous with one draft model

**Mechanism:** ordinary autoregressive decoding requires a target forward pass per next token. In speculative decoding a cheaper *drafting mechanism* proposes candidate future tokens, and the target model evaluates those positions in parallel in a verification pass. Only a valid prefix is committed in linear verification; rejected descendants were conditioned on the wrong prefix. Under the properly implemented rejection-sampling algorithm, stochastic speculative sampling preserves the target distribution (up to numerical implementation differences). Good draft acceptance saves sequential target invocations; useful **end-to-end throughput** also depends on draft overhead, batch size, verification kernels and workload.

- **Terminology correction:** a *draft model / speculator* is one possible drafting mechanism; speculative decoding is the entire draft-and-verify **algorithm**. Native MTP heads may be part of the target model, and n-gram lookup heuristics can also draft without a separately trained LLM. "Speculative decoders are drafter models" is an oversimplification.
- **MTP / NEXTN:** show target features feeding one or more learned future-token prediction modules. Native to some model families. Never imply that every MTP architecture produces all future positions independently in one zero-cost operation. Its parameters are not the same as the PLE **n-gram embedding table** below.
- **EAGLE-3:** feature-conditioned, learned autoregressive lightweight drafter; visually a growing chain/tree needing repeated small draft steps.
- **DFlash:** learned, target-feature-conditioned parallel block drafter; multiple masked slots filled in one draft pass. This is a contrast with EAGLE-3 sequential drafting.
- **DSpark:** builds on DFlash with a lightweight **Markov head** to improve dependence between proposed tokens and a **confidence head** that can support adaptive verification scheduling *when the serving runtime implements that scheduler*. The trained confidence head does **not** automatically mean every vLLM build uses adaptive scheduling.
- **DFlash2:** parallel main draft computation with local mixing/conditional candidate selection. Compare with DFlash and DSpark side-by-side; verify exact kernels and serving integration against the current implementation before claiming speedups.
- **Other research worth naming selectively:** DFlare (distinct feature conditioning), PCTree (conditional tree proposals), XPress, ForeSpark. Don't pretend all are equally mature or available for the audience's GPUs.

**Suggested high-speed visualization sequence:** one shared target model + prompt; switch the *drafter* from MTP, EAGLE-3, DFlash, DSpark, DFlash2; maintain the same token-position axis and target verifier so differences are visually obvious. Each scene gets ~15–30 seconds; an optional branch expands the verification tree and correct prefix attention mask. Display **accepted length, target passes, proposal cost, GPU time, and aggregate throughput** as different quantities.

**Quick "how you actually use it" micro-slide:** show the relevant part of a real launch command and the matched target/drafter, not a generic universal recipe. The historical home-k8s [vLLM manifest](https://github.com/dbirks/home-k8s/blob/main/apps/vllm.yaml) ran the Qwen3.6 target with:

~~~bash
--speculative-config '{"method":"dspark","model":"dbirks/Qwen3.6-27b-DSpark","num_speculative_tokens":3}'
~~~

For a compatible model with built-in MTP, current vLLM recipes show, for example:

~~~bash
--speculative-config '{"method":"mtp","num_speculative_tokens":3}'
~~~

These are **illustrations, not a promise that this syntax works on every model/version/engine**. Check the installed vLLM's CLI and method availability. Show the cost/benefit: extra draft weights/state may reduce the memory available for KV and cached prefixes.

Sources: [home-k8s #51](https://github.com/dbirks/home-k8s/issues/51), [#59](https://github.com/dbirks/home-k8s/issues/59), [#80](https://github.com/dbirks/home-k8s/issues/80), [vLLM Qwen3.8-Flash-Next recipe](https://github.com/vllm-project/recipes/blob/main/models/Qwen/Qwen3.8-Flash-Next.yaml), and the existing [speculative-decoding research notes](docs/local-llm-talk-research-notes.md).

### The real DSpark training attempt — better than a synthetic success story

Actual issue chain, with chronology and corrections:

1. [#50](https://github.com/dbirks/home-k8s/issues/50) / [#51](https://github.com/dbirks/home-k8s/issues/51): initial plan to train a DSpark drafter for **Qwen3.6-27B** served with vLLM and NVFP4 target weights; experimented with vLLM/speculators hidden-state extraction and block drafting. A DFlash baseline existed.
2. [#56](https://github.com/dbirks/home-k8s/issues/56): investigated **DeepSWE (datacurve.ai)** tasks to diversify software-engineering trajectories across **TypeScript, Go, Python, JavaScript, and Rust**. Important name collision: DeepSWE here means the datacurve benchmark/harness, not the separate *DeepSWE-Preview* model.
3. [#59](https://github.com/dbirks/home-k8s/issues/59): documented a two-phase pipeline: generate target-model data and extract verifier hidden states; train drafter with loss against verifier distributions and confidence labels; save/convert checkpoints; then serve and measure acceptance. Describes earlier warm-start runs and a concrete **RoPE partial_rotary_factor mismatch** that greatly harmed train/serve compatibility, plus GPU kernel/SM120 attention-backward issues.
4. [#60](https://github.com/dbirks/home-k8s/issues/60): **methodology correction**. Earlier ~1.3–1.5 accepted-length comparisons were too weak and some comparisons invalid: sampling temperatures, tiny eval sets, train/serve distributions and speculation lengths differed. The revised plan emphasized rotary/layer correctness, strong baselines, held-out examples, matching training and serving behavior, and a fixed evaluation protocol. This supersedes optimistic parts of #51/#59.
5. [#69](https://github.com/dbirks/home-k8s/issues/69): proposed/reorganized target-generated, **on-policy** reasoning and tool-use data, plus broad coding, to match actual coding-agent traffic. "On-policy" in this context means samples generated by the frozen target under the relevant prompts/settings, **not** that the model's weights are continually being updated in RL. If the verifier is frozen, previously extracted target hidden states don't automatically become stale.
6. [#72](https://github.com/dbirks/home-k8s/issues/72): a large-corpus one-epoch training run was completed on **~546k rows over ~2 days 16 hours**, but the raw checkpoint could not initially load into vLLM without format/config conversion. Reported teacher-forced train/accept_len around **2.0**; this is **not** measured production speedup.
7. [#80](https://github.com/dbirks/home-k8s/issues/80): clean **from-scratch** A/B on a 215k-row agentic/coding corpus. Coding-only baseline reported roughly **1.66** served accept_len; agentic-data run **1.617** on comparable prompts and ~**1.51** on the targeted agentic workload. **More agentic data alone did not improve this from-scratch drafter in that test.** A separate warm-started DFlash-derived drafter reportedly reached substantially higher accept_len (~3.9–5.4), but its training/baseline differed. The issue describes a large **teacher-forced vs free-running exposure gap**: training saw valid previous tokens; the live drafter must condition on its own fallible guesses. This is a powerful technical visualization opportunity.

**Speaker takeaway (carefully worded):** "I tried training a DSpark drafter. Generating realistic agent traces is a substantial job; then you discover that data volume is not enough. If the drafter's train-time behavior, rotary geometry, initialization, checkpoint format, or eval setup is wrong, you can spend days training something that still accepts almost no tokens in actual serving."

**Slide concepts:** (a) K8s pipeline from polyglot SWE tasks → target rollouts → hidden-state/soft-logit supervision → drafter training → checkpoint conversion → online verifier; (b) two identical draft-token paths, one **teacher-forced** and one **free-running**, diverging after a wrong early token; (c) held-out acceptance versus training loss; (d) tiny checklist of lessons, not an extended training tutorial.

**Separate toolchain confusion:** [Intel AutoRound](https://github.com/intel/auto-round) was the primary tool used for **model weight quantization**, including W4A16 and NVFP4 experiments in [home-k8s](https://github.com/dbirks/home-k8s); it is **not** the DSpark drafter trainer. The drafter training library was **vllm-project/speculators** (with versioned/patched fork behavior). Some AutoRound jobs call \`quantize_and_save(..., format="llm_compressor")\`; that is an **output compatibility format**, not evidence that LLM Compressor trained the drafter. [home-k8s #109](https://github.com/dbirks/home-k8s/issues/109) lists LLM Compressor, NVIDIA ModelOpt and GPTQModel as alternative quant toolchains. Also, another [Muse drafter quant job](https://github.com/dbirks/home-k8s/blob/main/apps/muse-drafter-quant.yaml.hold) *did* explore LLM Compressor: don't claim the speaker never used it for anything.

### Dense vs MoE vs n-gram **embedding tables**: different scaling axes

Avoid drawing n-gram embeddings as "a third kind of MoE."

- **Dense model**: most feed-forward weights in each layer participate for each token. Approximate computation and resident weight count rise together. Attentional/hybrid modules still vary by architecture.
- **MoE model**: router directs each token through only selected expert MLPs in MoE layers, reducing active compute relative to total stored experts. The remaining experts still require some accessible storage or an offloading strategy; "3B active" does not mean 3B total resident parameters.
- **N-gram embedding (PLE/Engram family)**: hash local sequences of token IDs, typically token bigrams/trigrams, to rows of a *learned lookup table*. Selected rows are read and injected into the network as learned features. This can expand model capacity by many parameters with relatively few operations per token; the giant table is a **model-weight table**, **not** a KV cache, **not** a speculative n-gram matcher, and **not** a routed MLP expert.
- Qwen's [Qwen3.8-Flash-Next card](https://huggingface.co/Qwen/Qwen3.8-Flash-Next) describes ~**51B n-gram embedding parameters** alongside its MoE/other architecture. Its PLE uses local token n-gram lookup. The NVIDIA [implementation docs](https://docs.nvidia.com/nemo/automodel/nemo-automodel/nemo_automodel/components/models/qwen3_8_flash_next/engram) explicitly connect "PLE" to raw-token N-gram embeddings.
- **Visual idea:** hold a sample token sequence fixed and switch between (1) all dense FFN blocks active, (2) a router opening 2-of-N expert FFN blocks, (3) hash heads selecting a handful of rows across a giant lookup table. Keep **parameter storage**, **active computations**, and **bytes fetched** as three separate gauges.

**Actual Pennyroyal NVMe implementation, not just theoretical:** [home-k8s #135](https://github.com/dbirks/home-k8s/issues/135), [the live manifest](https://github.com/dbirks/home-k8s/blob/main/apps/pennyroyal-flashnext.yaml) and [staging job](https://github.com/dbirks/home-k8s/blob/main/apps/pennyroyal-stage-model.yaml.hold) configure Qwen3.8-Flash-Next with an FP8 **~47.68 GiB PLE n-gram embedding table** on NVMe, rather than pinning it all in the node's ~46GB RAM:

~~~yaml
- { name: PENNY_PLE_BACKEND, value: nvme }
- { name: PENNY_PLE_NVME_MODEL, value: /models/flash-next-ple }
~~~

The one-off preparer writes an NVMe overlay and index (about 51.2 billion bytes for the FP8 rows). Pennyroyal looks up selected rows through bounded staging / a small page pool and reclaimable page cache. **This is not moving an entire transformer layer to NVMe every generated token.** Distinguish this offloaded **immutable weight table** from the independent **HiCache GPU/host prefix cache**. In this deployment disk persistence for **prompt-derived prefix/KV contents** was explicitly disabled; local NVMe PLE weights are unrelated to that decision.

Additional contrast: stock vLLM's [Flash-Next recipe](https://github.com/vllm-project/recipes/blob/main/models/Qwen/Qwen3.8-Flash-Next.yaml) describes PLE \`--engram-config '{"cpu_offload":true}'\`, which uses **host memory**, not Pennyroyal's particular NVMe backend.

**CPU and storage offloading:** compare llama.cpp \`--n-gpu-layers\`, MoE \`--cpu-moe\` / tensor overrides (verify version), vLLM host-memory weight offload, and Pennyroyal's specific NVMe n-gram row reads. Different tensors and execution patterns lead to different transfer frequency and performance. An SSD is not "extra VRAM"; latency, read granularity, hit rates and staging paths matter.

### Quantization: don't conflate weight bits, activation bits and KV bits

**Terminology correction:** typical notation is **W4A16** (4-bit weights, approximately 16-bit activations), not **W16A4**, which would mean 16-bit weights and 4-bit activations. Confirm what was intended before putting "W16A4" on a slide.

- **W4A16 / weight-only INT4:** quantize eligible weight matrices to 4-bit integers, while activations usually remain FP16/BF16. Group scales/zeros and selectively unquantized layers mean actual storage is not *exactly* 4 bits for every original parameter.
- **W4A4 / NVFP4:** selected weight/activation operations use Nvidia's microscaled 4-bit floating-point format on supported Blackwell hardware; block scales/metadata and BF16/FP8 bypass layers still count. Native support depends on SM and kernels. Not every "NVFP4 model" applies W4A4 to every tensor.
- **FP8:** another numeric format that can be used for weights, activations, or KV. **"FP8 is the only viable cache precision" is not universal**: current [vLLM cache config](https://docs.vllm.ai/en/latest/api/vllm/config/cache/) lists FP8, NVFP4 and other formats. Their accuracy and speed depend on attention kernel, scaling, context, model architecture and hardware.
- **KV-cache quantization is independent** of weight quantization. Hybrid Gated DeltaNet / Mamba-like state may have **separate** memory and dtype constraints. Scale calibration matters for FP8 and accuracy; see [vLLM Quantized KV Cache docs](https://docs.vllm.ai/en/latest/features/quantization/quantized_kvcache/).
- The speaker's [AutoRound Qwen3.8 model-card recipe](https://github.com/dbirks/home-k8s/blob/main/apps/qwen38-upload.yaml.hold) excluded sensitive recurrence-control projections, vision tower and MTP head from NVFP4 quantization; an instructive example of **selective quantization**, not one blanket "make everything 4-bit" conversion.
- **Visualization:** one original weight matrix → scaled/rounded INT4 reconstruction versus microscaled NVFP4 reconstructed tensor; show activation tensors and K/V state as independent movable volumes with their own dtypes. Display **memory budget**, **reconstruction error**, **kernel availability**, and **observed speed** separately.

### Prefix caching and quantized KV: why this matters in agent workloads

- **KV cache:** keys/values retained from previously processed tokens at attention layers so they are not recomputed on each new token. Its storage/format competes with model weights, graph buffers and hybrid recurrent state; different layer types may use different state.
- **Prefix caching:** when a new request shares a compatible exact prefix with a cached previous request, reuse earlier computed token state rather than reprefilling it. Real cache hit requires matching tokens/config/context; incompatible prefixes or eviction lose the benefit. Agent workflows repeatedly resend long histories and schemas, so *retained reusable prefixes* can matter more than single-stream peak decode tok/s.
- **Eviction and scheduling:** multiple concurrent agents can evict each other's prefixes when the cache pool is full, causing TTFT to explode even though raw decode tok/s looks good. Show 3 agents alternating long conversations, with a cache occupancy bar and an LRU-like eviction; do not claim any one engine uses a particular eviction algorithm without verifying.
- Real dated observation: [home-k8s Qwen3.8 vLLM operating notes](https://github.com/dbirks/home-k8s/blob/main/.agents/skills/qwen38-27b-vllm/SKILL.md) report an **FP8 KV pool of 741,032 tokens** under a particular GPU memory slice and **NVFP4 KV pool of 1,225,765 tokens** (about **1.65×** as many) after changing KV precision, helping relieve repeated-prefix cache churn. Those numbers are configuration-specific (not a universal NVFP4 scaling factor), and should be validated with a matched-quality test.
- Pennyroyal's [operating notes](https://github.com/dbirks/home-k8s/blob/main/.agents/skills/pennyroyal-flashnext/SKILL.md) separately document the tradeoff among GPU KV tokens, host HiCache prefix space, hybrid Mamba state slots, effective request admission and long-prefix eviction. They also show that *adding concurrent slots can consume more fixed state and reduce cache room*.
- **Viz idea:** three requests, an expandable block/page pool in VRAM, a matched prefix as a glowing shared subtree, and a slider from BF16 → FP8 → NVFP4 (enabled only if specific hardware/backend supports each). Track **cache capacity**, **hit rate**, **eviction**, and **time to first token** without conflating them with token-generation throughput.
- Another 15-second topic: the *cache is not just "how much context fits once."* The engineering goal is to retain the **working set of contexts across concurrent turns**.

### Proposed topical navigation (alternative, not fixed structure)

1. **Why I cared:** model reliability crossed a threshold for the speaker and agent work began to feel practical.
2. **What kind of model?** dense vs MoE vs n-gram embedding expansion, active parameters and hardware fit.
3. **What occupies memory?** quantization, offload, CPU/GPU/NVMe boundaries and real WSL/host-RAM anecdotes.
4. **How do conversations stay fast?** KV cache, quantized KV, prefix caching, request scheduling and repeated-prefix churn.
5. **How can decoding go faster?** prefill/decode, MTP and trained drafter families, verification, DSpark training story.
6. **What should I actually run?** 1–2 concrete examples from vLLM / llama.cpp / NInfer / Pennyroyal / Radiance, plus GPU-specialization caveat.
7. **How does this become infrastructure?** shared gateway/LLM Collective, real concurrency and routing.

This is **one possible content map**, not the plan. Keep the config-file-as-map approach available as a navigation pattern inside a topic. The current code and example slides remain aesthetic/interaction prototypes.


## Research addendum — companion draft releases and MoE terminology (2026-11-16)

This is **living talk content**, not a slide specification or speaker notes. The existing deck remains experimental. This pass specifically distinguishes producer-supplied companion drafters, native MTP, offloaded experts, and Pennyroyal's PLE table.

### Model releases increasingly include a matched drafter

Concrete upstream examples (not hypothetical third-party pairings):

| Main model | Released companion | How it drafts | Availability / caveat |
| --- | --- | --- | --- |
| [Meta Muse Glimmer **30B**](https://huggingface.co/meta-models/Muse-Glimmer-30B) | [\`meta-models/Muse-Glimmer-30B-assistant\`](https://huggingface.co/meta-models/Muse-Glimmer-30B-assistant) | DFlash block drafter; an official small companion model; official GGUF release also has quantized drafts | Confirmed in [Meta's announcement](https://research.meta.ai/blog/introducing-muse-glimmer-open-agentic-model) and [official model collection](https://huggingface.co/collections/meta-models/muse-glimmer). **Not** a \`Muse Glimmer S\` or \`XS\` release; the verified name is **Muse Glimmer 30B**. |
| [Poolside Laguna **S 2.1**](https://huggingface.co/poolside/Laguna-S-2.1) | [\`poolside/Laguna-S-2.1-DFlash\`](https://huggingface.co/poolside/Laguna-S-2.1-DFlash) | DFlash companion, 6 sliding-attention layers and 16-position draft blocks | The official base card documents integration with vLLM and a Poolside llama.cpp fork; specific runtime support varies by version. |
| [Poolside Laguna **XS 2.1**](https://huggingface.co/poolside/Laguna-XS-2.1) | [\`poolside/Laguna-XS-2.1-DFlash\`](https://huggingface.co/poolside/Laguna-XS-2.1-DFlash) | DFlash companion, 5-layer drafter, up to 15 proposals per block | The official drafter card warns that some upstream serving integrations had not landed at the time of publication. Check before using a live demo. |

**Narrative:** model releases are evolving from "just the large model weights" toward a **serving bundle**: target weights, tokenizer/chat template, possibly native MTP heads, and an optional *separately downloaded, specifically trained* drafter. The drafter often is not physically embedded in the target checkpoint, and it is not universally compatible with every quantization, loader or runtime. It still consumes memory and compute. A companion drafter is a way for the creator to optimize inference for the **actual target distribution** instead of expecting everyone to find/train a generic draft model.

**Quick show-and-tell visual:** a model-release box expands into separately labeled artifacts (target, tokenizer/template, native MTP if present, optional companion DFlash draft). The loader connects the matched target + drafter to one verifier. Switch official examples; show one **real** vLLM / llama.cpp invocation. Do not imply third-party drafting is impossible, that all models provide drafts, or that DFlash and MTP are the same thing.

A concrete vLLM example from Laguna's official card (verify current engine/model revision before using):

~~~bash
vllm serve poolside/Laguna-S-2.1 \
  --speculative-config '{"model":"poolside/Laguna-S-2.1-DFlash","num_speculative_tokens":7,"method":"dflash"}'
~~~

Muse's official Hugging Face write-up demonstrates llama.cpp with a DFlash setting on the GGUF release; the appropriate draft artifact can be discovered or passed as a separate model. These are two actual, vendor-originated examples for a 10–20-second "you can just use one" demonstration, not a promise of speedup for every workload.

### What **Qwen3.6-35B-A3B** actually means

Verified against the [official Qwen3.6-35B-A3B model card](https://huggingface.co/Qwen/Qwen3.6-35B-A3B):

- **35B** is the approximate **total number of learned parameters** in the model—not GPU VRAM consumed, not the number of floating-point operations, and not the number of tokens it can read.
- **A3B** means approximately **3 billion parameters activated per token** in the declared accounting for inference. It does **not** mean the other 32B weights disappear, are stored at zero cost, or can all be ignored when loading.
- This particular model has **256 routed experts in each MoE layer, with 8 selected per token plus one shared expert**. The router makes token-/layer-dependent expert choices; *another token or request can choose other experts*.
- It has **40 layers** with a repeating **Gated DeltaNet + MoE** and **Gated Attention + MoE** pattern. The simplified MoE cartoon should not suggest every layer is a classic dense self-attention transformer.
- **3B active is not a separate 3B checkpoint**; shared attention/embeddings/other always-on calculations and selected experts make up active work. Actual latency also reflects memory traffic, kernels, context and batching. Compare dense 27B to 35B-A3B without claiming the MoE is inherently better, faster, or cheaper in *all* contexts.

**Suggested visual:** a 35B wall of weight blocks; on each token, highlight a much smaller active subset (**~3B parameter-equivalent**), leaving the other stored expert blocks dimmed but still represented. The next token lights up different experts. A split display keeps *total storage* (35B), *active per-token compute* (~3B), and *actual memory transferred/available bandwidth* separate. A side-by-side dense FFN scene makes the distinction legible in seconds. Do not use "3B VRAM" for A3B.

### Important offloading distinction: MoE experts versus PLE n-gram tables

For a **Qwen3.6-35B-A3B-type MoE model**, the expert-bank weights can be **kept in CPU RAM** to reduce VRAM use when the engine supports it. For example, current [llama.cpp server docs](https://github.com/ggml-org/llama.cpp/blob/master/tools/server/README.md) expose:

~~~bash
# Conceptual flags; version and model format compatibility still need checking.
--cpu-moe                  # keep MoE expert weights on CPU
--n-cpu-moe N              # keep MoE weights of the first N layers on CPU
--moe-cache-mib N          # optional GPU hot cache of CPU-hosted experts
-ot '...=CPU'              # tensor-placement overrides (exact tensor patterns vary)
~~~

Other choices include partial layer offload via \`-ngl\` and engine-specific host-memory weight offload. **Offloading changes where weights reside, not the network's routing mathematics.** A routed expert selected at runtime must either be computed where its weights are resident or have its weights transferred/staged. This can make a previously unfit model run, but CPU RAM bandwidth, PCIe traffic and caching policy can become the bottleneck. Do not promise GPU-like throughput when keeping a large expert bank in host RAM.

**This is different from Pennyroyal's NVMe PLE setup:** that installation stores a **learned n-gram embedding lookup table** on an NVMe SSD and selectively fetches rows, not MoE MLP matrices. The PLE table is neither a KV cache nor a DFlash drafter. Show separate memory paths in the visual:

- MoE: token hidden state → learned expert router → selected MLP expert weights (GPU and/or CPU, potentially cached).
- PLE: token IDs / local n-gram hash → selected lookup rows (NVMe/host staging) → embedding features in the network.
- KV/prefix cache: stored *request-dependent inference states*, not model weights.

Potential 15-second sequence: choose "dense," "MoE fully GPU-resident," "MoE expert CPU offload," then "n-gram lookup on NVMe." Keep all arrows labeled with **bytes read, compute location, and purpose** rather than making "offloading" one generic concept.

**Open technical checks:** which Qwen3.6 MoE quant+llama.cpp build supports \`--moe-cache-mib\` correctly; workload-specific PCIe/CPU speed tradeoffs; whether a particular released companion drafter runs unmodified in the version of vLLM/llama.cpp available at presentation time.


## Deep-dive research — model passes, roofline, drafter VRAM, and Engram (2026-11-16)

> **Working content inventory and 3D implementation briefs; not speaker notes, final slide order, or final benchmark data.** This follows the speaker's latest questions: What actually moves on each forward pass? When is memory bandwidth the limiting factor? How is prefill different from decode? How much VRAM does a speculative drafter cost? Where did DeepSeek's Engram originate, and which released model used it? This section is an extended technical research brief, intended to give a coding agent enough conceptual detail to build real, accurate interactive scenes.

### 1. "All the weights go through the GPU every token" — useful intuition, but needs precision

**First separate three places:**

1. **Persistent storage**: model checkpoint on SSD/HDD, normally used at loading time, not reread for each token in a fully resident setup.
2. **Working memory**: model tensors held in GPU **HBM/VRAM** (or CPU DRAM for offloaded tensors), together with KV cache, activations, runtime workspace and optional drafter.
3. **Execution units**: GPU SMs / tensor cores, registers, shared memory and on-chip caches. Kernels pull tiles/segments of resident weights from HBM via the memory hierarchy, perform computations, write results, and advance to the next layer. **We don't physically copy the entire model out of VRAM and back into VRAM each token.** Most dense layers *use* almost every parameter each step; this typically entails substantial HBM-to-compute-unit traffic, but HBM caching, fusion, architecture and batching matter.

**Illustrative, non-hybrid, decoder-only dense-model inference path:**

\`token IDs → token embedding lookup → residual stream → [attention norm → Q/K/V projections → attend to past K/V → output projection → residual addition → FFN norm → up/gate/down projections → residual addition] × L layers → final norm → output vocabulary logits → sampling/selection → next token\`.

- The embedding is a **row lookup**, not a multiplication against the full vocabulary embedding matrix.
- Attention projection/FFN weights are matrix operations performed in each relevant layer, usually by resident GPU kernels.
- **KV cache** stores attention **states derived from earlier tokens**, avoiding recalculating earlier layer activations every time. Standard full attention *reads* the previously cached K/V when computing a new token; sliding-window/sparse/MLA/hybrid architectures read and store different amounts or different forms of state.
- Logit projection across the vocabulary may access an output head; some implementations tie embeddings or fuse operations.
- Layers generally have **sequential data dependencies**: each layer produces the hidden states the next consumes. Within a layer, large groups of multiply-adds execute massively in parallel; separate GPUs can use tensor/pipeline parallelism, but don't depict all layers simultaneously processing one token in ordinary single-GPU inference.
- **Dense vs MoE difference:** in a dense FFN, most FFN parameters are used for each token. In an MoE FFN, a router chooses a subset of expert matrices per token/layer (plus any shared expert). Only chosen experts are computed for that token; at large batches more distinct experts may be accessed across the batch. All expert weights still need accessible storage or an offloading plan.
- **Engram / PLE difference:** look up **a small number of learned n-gram embedding rows** instead of running a big matrix multiply over all table entries.
- **Speculative decoding difference:** target *verifies multiple candidate positions in one pass*, while a separate drafter may run its own computation; accepted output cannot be inferred from "target read once" alone.

**What "one forward pass" means:** a run of model layers on the currently scheduled token positions. During **prefill**, this can mean hundreds/thousands of positions at once, with attention masks and key/value writes. During **decode**, without speculative decoding, it is typically **one new position per active sequence** in that iteration, using saved past state. A packed batch of 16 active requests processes 16 token positions (not one). A draft-verification pass can process K candidate positions per request.

**15-second narration draft:** "The model usually stays in VRAM. The expensive part at batch one is repeatedly pulling its active weight matrices from GPU memory into the compute units to predict just one more token. Prefill can reuse those weights across thousands of prompt positions."

**Accuracy traps:** do **not** draw checkpoint files reloading from SSD every generated token in the resident case; don't claim every *stored* MoE expert weight is multiplied every token; don't equate KV cache with model parameters; don't imply FFN and attention execute sequentially at the individual multiply-add level.

Primary performance sources: [vLLM, Anatomy of an Inference System](https://vllm.ai/blog/2025-09-05-anatomy-of-vllm); [NVIDIA, co-design attention for long contexts](https://developer.nvidia.com/blog/?p=120729); [vLLM optimization guide](https://docs.vllm.ai/en/stable/configuration/optimization/).

### 2. Prefill versus decode — why hardware's compute cores and memory bandwidth matter differently

**Prefill**: ingest the uncached input prompt (or new uncached prefix). Many prompt token positions pass through the model concurrently. Matrix **multiplications** are large, so a weight tile loaded from HBM can be reused while processing many token vectors. This increases **arithmetic intensity** (FLOPs per byte of traffic), often pushing prefill toward compute-bound. For standard attention, processing a long prompt also requires attention math and working-memory traffic, so long-context cost is not exclusively FFN compute. Time-to-first-token (**TTFT**) includes queueing, tokenization, prefill, and often first decode/sampling.

**Decode**: append tokens autoregressively; for each step, each active sequence supplies a small amount of new token data, while the engine must apply the target's active weights again. Small matrix-vector / small-batch matrix operations have relatively little arithmetic per weight byte. For a single stream, decode is therefore **often HBM-bandwidth-bound**; with long contexts, cached K/V *reads* and attention kernels become additional important bottlenecks. Inter-token latency (**ITL**) and output tokens/second matter here.

**Not absolute rules**:

- A **short prefill** after a very long cached prefix may be memory-bound and look more like decode.
- A **large decode batch**, a wide speculative verification pass, or an unusual architecture/kernel can raise arithmetic intensity enough to become **compute-bound**.
- At high concurrency, the relevant limit may be KV capacity, scheduling, GPU memory allocation, PCIe/offload, kernel launches, or attention rather than bandwidth alone.
- Model weight quantization reduces weight bytes fetched and VRAM residency, but it also changes kernel choice, dequantization overhead and mathematical throughput. Inference latency never follows "bits" perfectly.
- GPUs provide both **compute capability** (FP/BF16/FP8/FP4 tensor core ops/sec) and **HBM bandwidth** (bytes/sec); one does not imply the other. PCIe, CPU DRAM and NVMe are further distinct tiers.
- **Hybrid architectures** (Gated DeltaNet, Mamba, sliding attention, compressed/sparse attention, CED) can reduce or move some cache/compute costs. Don't use a standard quadratic attention animation to claim it models Qwen3.8-Flash-Next or DeepSeek-V4.1 exactly.

**Roofline relationship (model, not universal benchmark):**

\`Arithmetic intensity I = useful operations / bytes moved\`.

\`Attainable performance <= min(peak hardware FLOP/s, effective bandwidth × I)\`.

An illustrative BF16 matrix \`W\` with \`M × N\` elements, applied to \`B\` token vectors, costs about \`2MNB\` multiply-add FLOPs and at least \`2MN\` bytes just to fetch the BF16 weights; **ignoring other traffic**, its weight-only intensity is approximately **B FLOP/byte**. At \`B=1\` it is low; at \`B=128\` it can be much higher. This is an **idealized** example: KV traffic, activations, output writes, quantization scales, padding, cache reuses and actual kernel efficiency modify the roofline.

**Memory-bandwidth floor example (explicitly hypothetical):** if a dense model's active weight footprint is 20 GB and the effective weight-sustaining bandwidth were 1 TB/s, a full scan of those weight bytes alone would take 20 ms, before KV reads, compute, dispatch, transfers and overhead. Real engines do not achieve a guaranteed 50 tokens/sec from this quotient; it's a **lower-bound intuition**, not a measured prediction.

**Why batching helps:** one set of weight tiles can help compute many current positions from different requests; total tokens/sec often rises, while each user's latency can also change. Larger batches consume more KV/state, and at saturation can raise queue time. This is why **single-request tokens/sec** and **aggregate tokens/sec** should never be used interchangeably. vLLM's chunked-prefill scheduling intentionally combines compute-heavy prefill work with decode requests when possible.

Sources: [NVIDIA 2026 prefill/decode roofline explanation](https://developer.nvidia.com/blog/?p=120729), [NVIDIA hardware co-design](https://developer.nvidia.com/blog/ai-model-co-design-hardware-friendly-llm-design/), [vLLM optimization](https://docs.vllm.ai/en/stable/configuration/optimization/), [vLLM Anatomy](https://vllm.ai/blog/2025-09-05-anatomy-of-vllm).

### 3. The drafter also needs memory; speculative decoding trades memory for computation

**Don't say "speculation is free speed."** At runtime the machine must hold resources for:

- target model weights (perhaps quantized);
- target-model KV cache and hybrid recurrent attention/state;
- the drafter's **own weights** if it is a separate learned network, plus its possible draft KV/feature state;
- intermediate draft candidates, logits, acceptance buffers, draft/verify workspaces, graph capture buffers and other runtime costs;
- any native MTP heads / added target checkpoint components, where applicable.

The memory profile is **method-dependent**: an n-gram prompt lookup heuristic can require very little extra model memory; native MTP may add a few prediction layers/heads; EAGLE-style external drafters and DFlash-family drafters have separate weights/feature buffers, with cache/state costs differing by method. Do not assume every drafter requires its own full independent KV cache in exactly the same form: inspect the engine's implementation. Quantizing the drafter changes resource tradeoffs and may affect candidate quality/acceptance.

For a **fixed VRAM capacity**, every extra GiB spent on draft weights and workspace is a GiB not available to other model instances, cache capacity, or concurrency. Extra drafter computation may also reduce throughput at high batch even when acceptance rises.

**Actual decision to visualize:** target-only is more memory-efficient but may need a separate target pass per token. Enabling a drafter can reduce target passes per emitted token **if the accepted prefix is long enough to outweigh drafting/verification overhead**. The same extra GPU reservation could instead fund more KV-cache blocks and retain expensive agent prefixes. These are competing uses of a limited resource.

**15-second narration draft:** "A drafter is another occupant of your VRAM, not magic. It can reduce the number of expensive target passes, but the memory it uses comes directly out of your budget for context, cached prefixes, and concurrent agents."

Primary sources: [NVIDIA NIM speculative-decoding memory comparison](https://docs.nvidia.com/nim/large-language-models/2.0.13/advanced-use-cases/speculative-decoding.html), [vLLM speculative configuration](https://docs.vllm.ai/en/latest/api/vllm/config/speculative/), [home-k8s #80: real drafter acceptance experiment](https://github.com/dbirks/home-k8s/issues/80).

### 4. Engram: DeepSeek's **conditional memory** as another capacity axis

**Spelling:** **Engram**, not "Ingram". In DeepSeek's research this is a learned, addressable *conditional memory* module—distinct from the request's KV cache and distinct from external retrieval/RAG, document memory, or prompt-n-gram speculative drafting.

#### Origins / exact chronology — don't misattribute the first use

- **2026-01-12:** DeepSeek researchers published [*Conditional Memory via Scalable Lookup: A New Axis of Sparsity for Large Language Models*](https://arxiv.org/abs/2601.07372). This introduced the **Engram architecture** and reported an experimental **Engram-27B** model compared against an equal-parameter/equal-compute MoE baseline. The paper is the **first research demonstration** in this timeline, not a DeepSeek V4 product announcement.
- **2026-04-24:** [DeepSeek V4 Preview](https://deepseek.com/en/news/v4-preview/) launched **DeepSeek-V4-Pro** and **DeepSeek-V4-Flash**, describing compressed attention + mHC and MoE. The publicly described architecture does **not** identify Engram as a shipped component; don't assert "Engram debuted in V4."
- **2026-08-26:** [Qwen3.8-Flash-Next released](https://github.com/QwenLM/Qwen3.8-Flash-Next/blob/main/README.md) with its related **PLE** n-gram embedding table (about **51B** learned parameters). This is a separate Qwen implementation. It appeared publicly **before** DeepSeek's named V4.1 release, so do not say DeepSeek-V4.1 was the first *industry* production model to use n-gram lookup weights.
- **2026-09-10:** [DeepSeek-V4.1-Flash announcement](https://www.deepseek.com/en/news/deepseek-v4-1-flash/) and [official model card](https://huggingface.co/deepseek-ai/DeepSeek-V4.1-Flash) explicitly name **196B Engram conditional-memory parameters**. This is the **first released DeepSeek model verified here using Engram**, as opposed to the January experimental Engram-27B. Its [technical report](https://arxiv.org/abs/2609.19969) appeared September 17.
- The production version **does not have to be identical to the January research demo**. If the visualization shows a short convolution or original gate, mark it "paper/demo" unless confirmed for the selected deployed version.

**Strong 10-second talk line:** "DeepSeek published Engram in January. A few months later, Qwen's Flash-Next put a related giant n-gram table into an actual model. By September, DeepSeek's V4.1-Flash shipped with **196 billion lookup-memory parameters**. Huge stored capacity, without computing with every entry for every token."

#### How an Engram lookup actually works (from official code)

1. Start with recent **token IDs**—e.g. the current token and up to a few predecessors. DeepSeek's implementation maps IDs to a **compressed normalized token space**, so some superficial token distinctions collapse before hashing. This is a deterministic token-ID transformation, not a search over embedding cosine similarities.
2. Form **local n-grams** ending at the current position (for DeepSeek-V4.1-Flash, **2-, 3-, and 4-grams**) and compute hash addresses with multiple hash heads. Hash collisions are possible and handled statistically, not eliminated by having "unique semantic slots."
3. Use the addresses to **gather only selected rows** from very large learned embedding tables. No giant matrix multiplication over all stored rows and no need to run a selected MoE MLP just to fetch an entry. The learned rows are immutable model parameters during inference.
4. Transform/merge the gathered vectors and combine with the evolving network hidden state, including **context-sensitive fusion/gating** as appropriate for the implementation. The raw hash has no contextual understanding; the network decides how to use the retrieved signal.
5. Continue normal model computation. Because the lookup addresses follow known token IDs, the system can often **prefetch** needed rows from host memory before the layer needs them, hiding some transport latency. But slower host RAM/SSD can still be a bottleneck, especially on long prefill with many random accesses; prefetch effectiveness and cache locality are measurable properties, not guarantees.

**Concrete DeepSeek V4.1 implementation detail:** the official [inference/engram.py](https://huggingface.co/deepseek-ai/DeepSeek-V4.1-Flash/blob/main/inference/engram.py) declares Engram layers at model indices **1 and 14** (zero-based), **8 hash heads for each of 2-, 3-, and 4-grams**, hence **24 selected table rows per Engram layer per token** and **48 row selections across those two layers**, subject to masking/padding and implementation details. The full table is **196B learned parameters**; this is not equivalent to 196B active neural compute at each token.

For the **original research demo**, [DeepSeek's public engram_demo_v1.py](https://github.com/deepseek-ai/Engram/blob/main/engram_demo_v1.py) additionally illustrates a contextual gate and a short causal convolution. It explicitly mocks conventional attention/MoE layers; do not portray that demo as a complete production transformer.

**Important architectural side-note:** DeepSeek-V4.1-Flash is *also* an unusual **40-layer causal encoder/decoder** model (20+20). Its official model card says **8B active parameters per token during prefill versus 16B during decode** for that architecture. That is not because all LLMs use half their layers for prefill. It is a deliberate V4.1 design; if visualizing V4.1 directly, do not reuse a vanilla decoder-only "every layer for prefill" storyboard without adapting the graph.

Sources: [Jan Engram paper](https://arxiv.org/abs/2601.07372); [official DeepSeek Engram repo](https://github.com/deepseek-ai/Engram); [V4.1 model card](https://huggingface.co/deepseek-ai/DeepSeek-V4.1-Flash); [V4.1 inference Engram source](https://huggingface.co/deepseek-ai/DeepSeek-V4.1-Flash/blob/main/inference/engram.py).

#### Compare DeepSeek Engram to the speaker's real Pennyroyal PLE setup

**DeepSeek V4.1:** two Engram lookup modules, huge 196B parameters, layer-dependent hash addresses, learned fusion. Its offload path may be host memory, other serving stacks may use different placements. Do not claim that the speaker personally ran this enormous model on their one GPU; [home-k8s #127](https://github.com/dbirks/home-k8s/issues/127) is an **investigation/plan** for large-model NVMe Engram/expert streaming, not proof it worked.

**Qwen3.8-Flash-Next / Pennyroyal:** about **51B PLE/n-gram weights**, selected rows fetched from a dedicated NVMe-backed table in the speaker's configured runtime. Actual settings in [home-k8s Pennyroyal manifest](https://github.com/dbirks/home-k8s/blob/main/apps/pennyroyal-flashnext.yaml): \`PENNY_PLE_BACKEND=nvme\` and \`PENNY_PLE_NVME_MODEL=/models/flash-next-ple\`; [issue #135](https://github.com/dbirks/home-k8s/issues/135) documents the reason (host RAM too small for the conventional PLE+HiCache setup). This is not generic "MoE offload," and the *model-weight* PLE table is not prompt data stored as a persistent disk cache.

**Excellent practical comparison:** Qwen's table is still part of the model; if it's not permanently resident in VRAM, that leaves VRAM for the actual compute layers, KV cache and multiple agents. The tradeoff is **latency and throughput of targeted memory lookups** from the slower tier. Different tables/models have different n-gram orders, hash heads, dimensionality, gating and prefetch.

#### What Engram is **not**

- **Not** a traditional external database/RAG retrieval call: the addresses and contents are learned inside the model architecture.
- **Not** speculative decoding's heuristic **n-gram matching**: that method finds repeats in existing prompts/output without huge trained memory tables.
- **Not** the KV or prefix cache: those are request-dependent, computed states; Engram tables are static trained parameters.
- **Not** MoE expert computation: a hash indexes stored embedding vectors, whereas a router chooses FFN expert computation.
- **Not** a guarantee that SSD offloading is free: access pattern, random I/O overhead, prefetch schedule, SSD throughput, filesystem/page-cache use and host staging all matter.
- **Not** a property of every Qwen3.6-35B-A3B model: MoE and n-gram memory are independent design choices.

### Detailed 3D scene briefs for a later coding agent

These are *new candidate scenes*, not a request to implement them immediately. Build as a navigable library; show some in 15 seconds and allow optional drill-down.

**Scene F — One decode pass, from HBM to token**

- World layout: physical-looking GPU card with an HBM slab along back, a row of SM/tensor-core clusters near front, and a transparent left-to-right tower of model layers above. Show an input token column, current residual vector, the active layer plane, attention KV blocks, per-layer FFN matrices, and final logits.
- Animation: select token → embedding lookup → layer 0 tile stream from HBM to SMs → Q/K/V and attention read from **already cached** K/V → FFN → residual → repeat to layer L → final logits/sampling → append token and update cache/state. No SSD traffic per token unless an explicitly enabled offload path.
- Interaction: scrub layers, toggle dense/MoE, show all stored experts as dim blocks but only selected experts stream, toggle early-stop after layer 2, show dynamic lookup rows for Engram separately, hover over K/V state vs weight blocks. Graph legend includes **stored bytes, active weights touched, KV bytes read, total bytes moved**.
- Correctness: **not** a literal per-transistor GPU simulator; memory hierarchy is representative. Do not show one huge instantaneous transfer of the whole model or movement of weight files into VRAM each decode. Describe only active tensors.

**Scene G — Prefill/decode split across exactly the same model and GPU**

- Two parallel mirrored stages, shared same schematic GPU and model weights. Left: 2,048-position prompt, many token columns flowing through layer matrix operations together; load each weight tile and reuse across columns; K/V gradually filled. Right: one new position and a long bank of existing K/V; repeat the weight read for each generated token.
- A synchronized counter tracks **prompt tokens consumed**, **output tokens emitted**, **forward passes**, **FLOPs**, **weight bytes fetched**, **KV bytes accessed**, and **measured-or-simulated wall time**. Distinguish per-position model mathematics from actual kernel launches and scheduler steps.
- Controls: prompt length, active batch size, context length, model weight precision, bandwidth, tensor compute; simulated performance labeled prominently. Toggle a **short cached-prefix prefill** to show why the slogan "prefill always compute-bound" is not universally true.
- Camera: start from one model cross-section, fork into side-by-side scenes, then zoom into the GPU's separate bandwidth and compute meters.

**Scene H — Roofline: compute versus bandwidth**

- Use 3D only where spatial depth carries a meaning. Set X=arithmetic intensity (FLOPs/byte), Y=attainable compute throughput (FLOP/s); Z may be batch size *only if* clearly identified, otherwise keep a 2D roofline floating inside an orbitable 3D GPU housing. The limiting envelope is \`min(P_peak, BW × intensity)\`; beneath ramp=memory-bound; above plateau=compute-bound.
- Prefill and decode markers *move with workload controls* rather than existing at fixed universal positions. Render weight traffic as flow to cores; more batch means greater tile reuse; 4-bit weight format changes both bytes and available kernels. Highlight that lowering cache precision may buy more concurrent sequences but introduces accuracy/attention-kernel tradeoffs.
- Explain why "GPU is 100% busy" or "CUDA cores are fast" is insufficient to infer compute bound. Hardware meters should be based on sourced specs or explicitly labeled illustrative.

**Scene I — Drafter VRAM budget and what you give up**

- Exploded VRAM slab with regions for target weights, cache blocks, hybrid state, workspaces, CUDA graphs, then optional drafter weights and state. Toggle \`target-only\`, \`MTP\`, \`EAGLE-3\`, \`DFlash\`, \`DSpark\`. Resize memory allocations per selected real model/config or make all values explicitly simulated.
- Above VRAM, show target forward-pass timeline. Target-only requires one target step per output token; speculative mode proposes and verifies blocks. A good drafter can reduce sequential target passes, but some KV blocks vanish to make room for draft weights. Show **TTFT/ITL, accepted length, end-to-end tokens/sec, cached-prefix retention, max active sequences** as independent metrics, not a single "faster" indicator.
- Add an **"agent workload"** mode with 8 competing long-prefix requests: sometimes extra KV capacity is more valuable than draft speed. A mode with bad acceptance lets drafter overhead make things worse.
- Accessibility: present two explanatory states (with/without drafter) that can be switched in <15 seconds without complex interaction.

**Scene J — Engram from token IDs to sparse lookup**

- Geometry: token IDs as a recent-context ribbon; compressed-normalized IDs drop below; 2-/3-/4-gram windows overlap along X; hash heads fan into a **vast, mostly inactive** learned-memory table rendered as a 3D city of rows; only selected rows light up. Connect selected vectors into a fusion gate beside a transformer layer residual-state tube.
- Distinguish **addresses computed from token IDs** (deterministic) from **relevance/suppression** (learned context-dependent fusion). Show hash collisions by deliberately mapping two different n-grams to same bucket in a *toy* table; label toy dimensions.
- Controls: N-gram length, hash heads, table capacity (toy), active layer, original-paper prototype vs DeepSeek-V4.1 product profile (different architectural details), Qwen PLE comparison. Keep actual selected row count/positions tied to a particular model config; don't invent token-weight vectors.

**Scene K — Engram offloading / storage hierarchy**

- Show a huge model-parameter library split among **GPU VRAM**, **CPU RAM**, **NVMe**. A thin lookup stream extracts a few rows each token into staging buffers while GPU attention/MoE layers run. Three moving gauges: **capacity**, **fetch bandwidth/latency**, **memory available for KV and drafter**.
- Compare DeepSeek V4.1 host-RAM/offload design (architecture concept) and the speaker's measured/configured Pennyroyal NVMe-PLE path. Never mix Engram table storage with host HiCache, KV cache, or CPU MoE expert bank.
- Toggle 3 bad cases: random read latency dominates, prefetch too late, page cache blows up system RAM. Show a positive case where addressing early and small row reads hides enough of the transfer. These are scenarios, not claims of measured performance.

**Scene L — Engram history timeline**

- Four independent dated cards: January 12 DeepSeek Engram-27B research → April 24 DeepSeek V4 without documented Engram → August 26 Qwen3.8-Flash-Next with PLE → September 10 DeepSeek V4.1-Flash with 196B Engram. Short transitions between paper model and actual released architecture; don't imply direct lineage of Qwen's code or that original V4 used Engram.
- Keep research-model, shipped-model and separate vendor implementation visually different. A fifth optional inset shows the **DeepSeek V4.1 CED-specific** asymmetry of prefill/decode, explicitly not typical of all LLMs.

### Research questions to answer later with real speaker data

- Which GPU should anchor the bandwidth/compute numbers (RTX 5090 eGPU, RTX PRO 6000 Blackwell, AMD R9700)? Confirm bandwidth/compute **and** actual inference engine benchmarks rather than substituting marketing peak figures for measured performance.
- Which real target/drafter pair is best for the VRAM demonstration? Capture model/draft quantization, extra GPU allocation at boot, KV capacity before/after speculation, concurrency and acceptance distribution on representative agent tasks.
- Which exact Qwen3.8-Flash-Next and Pennyroyal revisions/PLE quantizations are demonstrated? Distinguish NVMe PLE, in-memory HiCache, hybrid Mamba state, prefix caching, optional native NEXTN/MTP.
- Can we retrieve an actual Nsight or engine trace to show weight-matrix HBM traffic, attention KV traffic and kernel occupancy? If not, explicitly label the GPU animation **schematic**.
- If using the *first DeepSeek Engram model* claim, prefer "first confirmed released DeepSeek model incorporating Engram: V4.1-Flash" rather than "first model in the world," and distinguish January research prototype from September product.


## Measured memory bandwidth and the capacity–bandwidth–cache trade-off (2026-11-16)

> **Speaker's developing thesis:** "Local inference isn't just about choosing the biggest model your card can hold. You're trading *capacity*, *bandwidth*, *precision*, *latency*, *concurrency*, and *cache retention*. You can place some data in CPU RAM or on an NVMe SSD, but that changes what the GPU waits on. And every GiB you give weights or a drafter is a GiB not available for KV cache and active requests." **This is a working conceptual narrative, not a final talk order.** Current slide content is still experimental and should not be treated as speaker-approved.

### Fundamental distinction: size versus speed versus access pattern

- **Capacity (GB/GiB):** what can remain resident in a memory tier. The model's *total* weights, including any selected/all MoE experts or n-gram tables, plus separate drafter weights, KV cache, hybrid recurrent state, activations, CUDA graphs, workspaces and reservations must fit somewhere.
- **Sustained bandwidth (GB/s):** how fast large streams of data are transferred under an actual benchmark. This is more informative for low-batch, weight-streaming decode than a raw compute TFLOPS figure, but not a perfect predictor.
- **Latency, IOPS and transfer granularity:** essential for SSD-backed n-gram/Engram row lookups, sparse expert fetching, or any small/random access. Sequential bandwidth marketing figures can be spectacular while single-thread tiny random reads are slow.
- **Where work executes:** CPU and GPU memory are not interchangeable; accessing an offloaded tensor may mean CPU computation and/or a transfer over PCIe or a host staging buffer. An NVMe disk is a cold backing store, not an extension of directly-addressable, HBM-speed VRAM.
- **Useful throughput:** a bigger aggregate model, or even higher raw decode tok/s, isn't automatically a better coding-agent server if parallel active conversations evict each other's prefixes.

### Actual observed bandwidth numbers, with benchmark labels (not hardware marketing peaks)

The observations below come from **different** real-world benchmarks and platforms. They are useful **order-of-magnitude** examples, **not** a controlled side-by-side hardware shootout. Prefix exact units: GB/s = decimal 10^9 bytes/s; some sources report MB/s and some MiB/s. Different test methods (CPU read vs GPU streaming vs SSD Q-depth) also access data differently.

| Tier / specimen | Measured transfer rate | What was actually measured | Source / qualification |
| --- | ---: | --- | --- |
| DDR3-1600, 2 channels | **20.5 GB/s read** | Public \`moc-memory-stream-v4\` test, 20,527 MB/s. Small sample; platform-specific; not STREAM Triad. | [Malekal DDR3 dual channel](https://stresstest.malekal.com/en/benchmark/ram/ddr3-1600-mt-s-2-canaux) |
| DDR4-3200, 2 channels | **41.5 GB/s read** | Same versioned \`moc-memory-stream-v4\` read test, 41,474 MB/s, 129 result group in sampled page. | [Malekal DDR4 dual channel](https://stresstest.malekal.com/en/benchmark/ram/ddr4-3200-mt-s-2-canaux) |
| DDR5-5600, 2 channels | **78.0 GB/s read** | Same versioned \`moc-memory-stream-v4\` read test, 78,005 MB/s, 6 result group. Versioned observations; not universal for every DDR5 platform. | [Malekal DDR5 dual channel](https://stresstest.malekal.com/en/benchmark/ram/ddr5-5600-mt-s-2-canaux) |
| RTX 5090 D, GDDR7 | **1,340.8 GB/s GPU memory streaming** | Independent author's CUDA GPU streaming throughput; same post reports **1,528.8 GB/s device-to-device memcpy** (different workload). GPU labeled "RTX 5090 D" specifically, not a demonstrated 5090 eGPU. | [gpu-bench reproducible project](https://github.com/binbinsh/gpu-bench) |
| RTX PRO 6000 Blackwell, GDDR7 96 GB | **1,466.75 GB/s GPU copy** | Boston Limited's measured on-device copy bandwidth on RTX PRO 6000; **not** GPU↔CPU transfer. | [Boston RTX PRO 6000 test](https://boston.co.uk/content-hub/nvidia-rtx-pro-6000-blackwell-workstation-edition/) |
| Crucial P510 NVMe SSD, 1 TB, PCIe 5 x4 | **10.97 GB/s sequential read Q8T1**, **6.15 GB/s sequential read Q1T1**, **0.0748 GB/s random 4 KiB Q1T1** | A hardware review's CrystalDiskMark results: SEQ1M Q8T1 = 10,973.9 MB/s, Q1T1 = 6,154.5 MB/s; RND4K Q1T1 = 74.75 MB/s. **These are radically different access patterns.** This is a 1 TB review unit, not a measurement of the speaker's particular SSD. | [ssd-tester.com P510 review](https://ssd-tester.com/crucial_p510_1tb.html) |

**Do not put AMD R9700's 640 GB/s into a "measured" column yet**: [AMD's R9700 specification](https://www.amd.com/en/products/graphics/workstations/radeon-ai-pro/ai-9000-series/amd-radeon-ai-pro-r9700.html) is **peak rated GPU bandwidth**, not a measured bandwidth microbenchmark. It has 32 GB GDDR6; [Puget Systems' local-LLM tests](https://www.pugetsystems.com/labs/articles/amd-radeon-ai-pro-r9700-dual-gpu-ai-inference-performance/) report actual **tok/s by model and concurrency**, which is more relevant to runtime comparisons than pretending the 640 GB/s spec is a directly measured value. Likewise NVIDIA [RTX 5090](https://www.nvidia.com/en-us/geforce/graphics-cards/50-series/rtx-5090/) and [RTX PRO 6000](https://www.nvidia.com/en-us/products/workstations/professional-desktop-gpus/rtx-pro-6000/) advertise **1,792 GB/s** *peak*, not observed serving bandwidth. If including advertised peaks, use a separate clearly labeled column.

**Important caveat about the CPU examples:** all three rows above have **two channels**, but they are from differing CPUs, memory controllers and timing regimes. Many servers have **8 or 12 memory channels** and reach hundreds of GB/s. For a measured example, [Boston's EPYC 9575F tests](https://boston.co.uk/content-hub/amd-epyc-and-intel-xeon-memory-bandwidth/) report **332.3 GB/s STREAM Triad** with eight DDR5-6400 channels and **500.1 GB/s Triad-like** with twelve. Do not claim "DDR5 is always 78 GB/s"; channel count and CPU design are decisive. Also **integrated/unified memory** can have another bandwidth/compute relationship. Separately, an **eGPU link** may become the bottleneck on host↔GPU transfers even if local VRAM is fast.

**Data integrity / publication note:** the Malekal table uses its reported \`moc-memory-stream-v4\` observed read figures; this is not a controlled STREAM Triad report nor the model's own LLM effective bandwidth. The NVIDIA rows are **different GPU microbenchmarks**, SSD values vary by I/O queue depth, and high-cache-hit workloads may not draw all their traffic from the highest-latency tier. Do not render precise interpolated tok/s as if measured. For a rigorous apples-to-apples slide, run a standardized **CPU STREAM**, **GPU STREAM / bandwidthTest**, **fio with 4K random + 1M sequential at recorded QD**, and the **same llama.cpp/vLLM model workload** on the chosen machines, capturing hardware, power, clocks and engine versions.

### A physically accurate mental model

A typical hierarchy, with data placement choices:

\`\`\`text
                        GPU compute units / local caches
                               ↕ on-device reads
         VRAM / GDDR7    [target hot weights] [active KV + prefix] [workspace] [drafter]
              ↑    ↑
              │    └── PCIe / interconnect staging (host ↔ device, if needed)
              │
       CPU DRAM DDR4/DDR5    [offloaded model weights / selected MoE experts]
              ↑
       NVMe SSD              [cold checkpoint / Pennyroyal PLE n-gram weight table]
\`\`\`

**Resident dense model, low-batch decode:** active weight matrices must be used repeatedly at each generated token, so the GPU streams/accesses their weight tiles out of its VRAM. A 4-bit quant reduces footprint/traffic but may need different compute kernels; "smaller model" and "faster model" are not synonyms. Prefill is often more compute-intensive because a loaded weight tile is reused over many token positions; decode with batch 1 is often more bandwidth-sensitive.

**MoE with CPU-offloaded experts:** the GPU may keep dense attention/router/shared components resident and only selected experts execute; an engine may execute CPU experts locally or transfer selected weights into GPU staging. The advantage is more accessible **capacity**, at the expense of a **slower memory tier and possible PCIe traffic**. Different engines, kernels, caching policies and batch mixes can make or break performance. Don't imply you can access CPU DRAM at GDDR7's 1.3–1.5 TB/s.

**N-gram PLE on NVMe (speaker's Pennyroyal):** a huge fixed table on disk is not scanned in full for each token. Hashes select **specific rows**, copied to bounded staging buffers, while the main model layers remain GPU resident. Thus the SSD's **random read/latency/queue-depth/prefetch behavior** matters more than dividing 47.68 GiB by an advertised sequential speed. Keep this **independent** of MoE expert offloading and of the *request-dependent* prefix cache.

**Long-context multi-agent server:** even if the model just fits VRAM, you can have poor usability with minimal KV headroom. With many agents repeatedly sending long shared prefixes, cache pages are evicted and costly prefills recur. A stronger question than "Can I load it?" is **"How much of the active context working set can I retain while serving all my agents?"**

### A configuration choice as a constrained optimization problem

Use a runtime memory budget, not just a model-card size:

\`VRAM_cap >= resident_target_weights + optional_drafter_weights + active_KV + hybrid_state + temporary_activations + CUDA_graphs + other_runtime_overhead + safety_margin\`.

The accounting may include allocator fragmentation, reserve policies, aliases/sharing, offload staging, and backend-specific buffers. **KV reservation is not always a fixed length × active sequences slab**: paged/block allocators grow and evict, while recurrent/hybrid state needs different accounting. An advertised context length does **not** guarantee every concurrent request can maintain that many cached tokens.

Trade-off controls and possible outcomes:

- **Weight quantization:** lower target weight bytes ↔ possible accuracy, kernel/dequantization and feature tradeoffs; reclaimed VRAM can become KV/prefix headroom.
- **KV-cache dtype (e.g. BF16, FP8, NVFP4 on supported kernels):** lower cache bytes per token ↔ accuracy/long-context numerical behavior; maybe preserve larger working set and avoid eviction/preemption.
- **Drafter/speculation:** allocate more draft weights/state and compute ↔ potentially fewer expensive target sequential passes, but reduce cache room.
- **MoE expert CPU offload:** expand model parameter capacity in host RAM ↔ bandwidth and synchronization costs, extra CPU load.
- **PLE/Engram NVMe placement:** large learned lookup table can live on disk ↔ random read latency / prefetch/cache locality penalties; doesn't mean full dense weights can be streamed from SSD at good tok/s.
- **Batch size / concurrency:** better weight reuse and aggregate throughput ↔ more active KV/state, queues and possibly worse per-agent latency.
- **Prefix caching:** higher cache retention ↔ more VRAM/DRAM consumed by long-lived context; matching prefixes avoids repeated prefill.
- **Different runtime/kernels:** trade support breadth, acceleration and compatibility; a specialized runtime can outperform broadly on a particular model/GPU, but cannot be assumed without testing.

#### Real example from the speaker's home-k8s issue history

The [Qwen3.8 vLLM operating document](https://github.com/dbirks/home-k8s/blob/main/.agents/skills/qwen38-27b-vllm/SKILL.md) reports changing **FP8 KV → NVFP4 KV**, increasing *available cache pool* from about **741,032 to 1,225,765 tokens (~1.65x)** for that setup, helping with prefix eviction under concurrent agent load. This is precisely the sort of **counterintuitive trade** to demonstrate: the best use of Blackwell 4-bit support may be freeing **KV-cache capacity** rather than just compressing weights or maximizing tokens/sec at batch 1. Those figures are one documented setup, not a general benchmark or a guarantee of identical output quality.

The [Pennyroyal manifest](https://github.com/dbirks/home-k8s/blob/main/apps/pennyroyal-flashnext.yaml) and [issue #135](https://github.com/dbirks/home-k8s/issues/135) show **NVMe-backed PLE** was chosen because host RAM couldn't hold a roughly **47.68 GiB PLE table plus the default HiCache allocation**. They also describe a separate **trade-off between GPU KV tokens, host HiCache, hybrid Mamba state slots, and effective request concurrency**. Again, this is not MoE expert offload.

### Scene M — measured memory tiers, scale and latency

**Goal:** in 15 seconds show why GPU-resident weights are fast, CPU RAM has much more potentially affordable capacity but lower bandwidth, and NVMe only works well if the architecture performs **sparse, prefetchable reads** rather than a full weight scan each token.

- Geometry: three tiered translucent memory shelves, from on-device **GDDR7** to **DDR3/DDR4/DDR5** to **NVMe**. Height = **capacity** for a selected hardware configuration (must be real/sourced or explicitly synthetic); pipe width = **measured test-specific bandwidth**; packet spacing / delays represent **access-pattern dependent latency**, not a common physical clock.
- Default table: exact observed values above, with a **benchmark type** label that never disappears when the chart is zoomed.
- Controls: **CPU generation** DDR3/4/5, **memory channels** and GPU/card dropdown, **memory access** (stream/read vs random small-row lookup), **model execution** dense scanning vs MoE selected experts vs PLE hashed sparse rows.
- Guardrails: don't multiply dual-channel observed results to infer a 12-channel system, don't convert disk random IOPS to "GPU tok/s", don't represent 2× separate GPUs as pooled VRAM with one shared bus.
- Camera storyboard: one memory pipe → zoom out to three tiers → toggle DDR3/4/5 → reveal GPU bandwidth is a different order of magnitude → switch to small-random-lookup NVMe to show why SSD bandwidth marketing is not the relevant metric.

### Scene N — "fit the model" versus "keep the agents fast"

**Goal:** teach why you cannot consume VRAM with model weights until almost nothing remains for KV and expect healthy concurrent serving.

- One selected hardware profile with a fixed **VRAM budget**. Partition into target weights, drafter weights, active KV, reusable prefix KV, hybrid state and runtime overhead. Display exact accounting where engine logs exist, otherwise **illustrative**.
- Simulate/animate 1, 4, 8, 24 agents alternating long tool-using conversations. Prefix reuse makes requests fast; when the cache working set exceeds capacity, evictions drive **time to first token** up on later turns even if decode remains fast.
- Let the presenter toggle model choice, weight precision, KV precision, speculative decoding, number of active sequences and host offload. The end state is not the "largest model", it is a **Pareto frontier** across model capability, concurrency, p95 TTFT, throughput and memory reserve.
- A split test compares a **fast single-user mode with drafter + smaller cache** against a **no-drafter mode with larger cache**. Both are valid, depending on the actual workload; never hardcode a winner.
- Two 15-second views: A) *model fits, cache doesn't* and B) *smaller model/quant or KV dtype frees just enough context to prevent churn*. The presenter's personal reported KV issue is an ideal source of real numbers.

### Scene O — SSD lookup access pattern: why M.2 offloading isn't interchangeable with RAM

- Show one SSD tier with two paths: (1) sequential streaming of a large weight tensor and (2) small random indexed PLE row fetches with prefetch. These have **very different measured bandwidth/latency**.
- Use sourced P510 test data: ~10.97 GB/s for deep-queue sequential reading vs **~74.75 MB/s** for single-queue 4K random reads on the same review unit. Do not claim the actual Pennyroyal PLE workload yields these exact values: it may batch, coalesce, use OS caching and prefetch.
- Controls: page size, queue depth, cache hit ratio, prefetch lead time and number of n-gram lookups. Show a stylized request queue and PCIe transfer; no pretend direct SSD↔SM hardware bypass.
- Compare "wrong use" (try to reread *all* dense weights from NVMe every decode step) with "appropriate use" (sparse, predictable token-ID-indexed embedding rows). Mark performance as a **scenario**, not a measured benchmark.
- End shot: target hot weights + KV in GDDR7, optional experts in CPU DRAM, massive PLE learned table on NVMe with only a trickle of selected row reads.

### Source quality and next data to capture

1. The **speaker's own** \`STREAM\` CPU RAM test on DDR4/DDR5 machines, \`gpu-stream\` / CUDA \`bandwidthTest\` on RTX 5090 and RTX PRO 6000, and \`fio\` on the actual P510 (record direct I/O, block size, queue depth, random/sequential, read/write).
2. For engine comparisons, keep **fixed the model revision, quantization, context length, prompt distribution, concurrency, sampling and hardware**, or state explicitly when exact equivalence isn't possible.
3. A paired GPU VRAM allocation from engine logs **with and without speculation**, and memory available to KV. If no paired run, use a conceptual resized slab with simulated values and no speedup claims.
4. A matched **cold versus warm prefix** multi-turn agent benchmark, measuring TTFT, preemptions/evictions and per-request plus aggregate throughput.
5. AMD R9700: retrieve independent **measured GPU memory throughput** and pair it with the coworker's actual Radiance results before displaying a comparable bandwidth row. Use the **640 GB/s rated** figure only if prominently flagged manufacturer peak, not as a measured result.


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
