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
