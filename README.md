# Beyond "It Runs": Engineering Local LLM Inference

Research and planning repository for a **30-minute, 201-level AI/software engineering meetup talk** (November 2026).

> **Current working handoff:** [Full presentation production brief](docs/presentation-production-handoff.md) — the prioritized narrative, fact-checking rules, per-scene technical/3D specifications, source pack, and **V1 → V2 → V3** iteration workflow for implementation agents. This takes precedence over the historical brainstorm/old five-stage outline below. **Existing slides are design experiments, not speaker-approved plans.** The speaker will **not** use speaker notes. The title at the top of this README is provisional.

## Premise

Assume the audience has already run a model with **Ollama or LM Studio**. The interesting next question is how to **choose, fit, accelerate, serve, and connect** local language models on real hardware. This is not an installation walkthrough or a taxonomy of LLM trivia.

The talk is intended to be a **rapid, interactive tour through detailed 3D visualizations**. The presenter may spend 15 seconds on one scene and dive into another. Graphics must represent real mechanisms faithfully—not metaphors or decorative 3D.

## Preferred presentation direction — learn by making local models useful (2026-11-17)

> **Current strongest candidate: a loosely autobiographical engineering journey, not a chronological documentary or a grab bag of terms.** This reflects the speaker's explicit preference after reviewing four outline concepts. The existing title *Beyond "It Runs"* is **just a placeholder**; speaker is not attached to it. This is a 30-minute, visually driven 201-level meetup talk. The *current \`src/slides.ts\` pages are mostly visual/style experiments and do not determine the talk plan*. The speaker **will not use speaker notes**: retain detailed planning/reference information here, and put memorable concise copy and accurate 3D visualizations in the presentation itself.

### The framing

The speaker was initially satisfied experimenting with Ollama, but then encountered models that made agent work feel dependable enough to use regularly. They began asking, in roughly this order: *What can I fit? How much VRAM do I need? Can I squeeze in a better quant and more context? Can I run multiple agents? What really makes inference faster? Which backend should I use?* This progression **wasn't actually linear**; the story can revisit earlier topics as necessary.

**A plausible opening in the speaker's own voice (editable, not a literal script):**

> "I've spent the last several months playing with local models and gradually turning them into something I can depend on. I ended up with a collection of configurations, mistakes, tricks and rabbit holes. Rather than just showing flags, I'm going to walk through those roughly in the order I encountered them—and try to visualize what the machine is actually doing."

The speaker's trust threshold with Qwen3.6-27B / later Qwen3.8, reliable tool decisions, Kubernetes investigations and remembered Git operations is a useful motivation. The speaker also uses hosted AI services; running locally is partly about fun, control/independence and having alternatives, not asserting a market crash as fact. Do not claim local inference always wins on cost or autonomy.

### Loose story arc (a navigation aid, **not** a required slide list)

1. **It became worth doing:** a model finally made trustworthy decisions in real workflows; why local inference matters to the speaker. Personal use of hosted services remains part of the story.
2. **What will fit on my card?** Speaker decided they needed roughly a **32 GB VRAM card** for the workload they wanted (ask which model/hardware led to that conclusion). Start with \`llama.cpp\`, settings learned from community configs, and the difference between fitting weights and leaving context/workspace headroom. Explain **dense vs MoE**, the meaning of **35B-A3B**, selective **MoE CPU offload**, GPU residency, and choosing a quantization. **Engram/PLE on NVMe is a later "new developments" subsection**, not the main explanation of MoE offloading.
3. **Can I give it more context?** KV cache, context limits, KV precision (FP8/NVFP4), what cache entries actually store, and why reducing weight or KV bytes can allow longer or more concurrent contexts. Use one genuine before/after configuration when possible.
4. **Can I run multiple agents?** Serial versus parallel sequences, separate replicas, prefills versus decodes, GPU compute and bandwidth, long system/tool prefixes, vLLM hashed shared blocks versus SGLang radix tree versus llama.cpp prompt/slot reuse. Real prefix eviction/TTFT problems are better than invented measurements. An early \`llama.cpp\` memory-fit win and later \`vLLM\` scheduling/concurrency win do not imply a universal winner.
5. **Can I speed up generation?** Show what passes through the model on each new token and why low-batch decode is often weight-bandwidth-limited. Then show MTP, EAGLE-3, DFlash, DSpark, DFlash2 (only as much technical detail as fits). A drafter consumes **additional VRAM**, sometimes reducing valuable KV capacity. Model creators increasingly ship purpose-matched drafters. Speaker's **DSpark training** experience is a first-person digression, including data generation, rotary/serve mismatches, held-out evaluation and the conclusion that more agentic data alone did not rescue the tested from-scratch run.
6. **What else can we do now?** Recent design patterns: DeepSeek Engram and Qwen PLE n-gram tables, Pennyroyal's specific NVMe row lookups; specialized runtimes NInfer, Radiance, Pennyroyal on appropriate GPUs and workloads. Distinguish CPU-offloaded **MoE expert computation** from SSD-backed **learned embedding-row lookup**. The **LLM Collective** can be a short optional endcap: independently hosted model endpoints connected to a gateway, often via **outbound-initiated connections** when inbound VPN access is unavailable; verify the actual implementation before drawing protocol/network architecture. It is not pooled VRAM or distributed inference.

**Organizing rule:** each section starts with a *real engineering question*, not a glossary heading. Show the actual configuration/measurement that prompted the question → explain the underlying mechanism in a precise short visual → return to its practical consequences. A config can appear inside the relevant topic, but **don't lead with a comprehensive YAML flag-by-flag lecture**. Only two or three mechanisms should receive true multi-minute deep dives; others can be 15–30 second scenes. If a scene does not help answer a genuine question, cut it.

**Repeated through-line:** "Every choice buys something by spending something else: VRAM capacity, memory bandwidth, compute, latency, cache retention, quality, flexibility or engineering effort." This is a **unifying lens**, not necessarily the title or the presentation order.

### Teaching style contract: ordinary words first, precise term second, literal mechanism third

Speaker's explicit preference:

- Avoid a sudden avalanche of unexplained specialist terms and acronym lists.
- Avoid **misleading fruit/store or other distant allegories**. Everyday wording is welcome, but the diagram should represent actual weights, tensor operations, caches, routing or storage paths rather than a unrelated metaphor.
- **Name the thing in plain language**, then introduce the proper term, then render the calculation/data movement, then state why the audience should care. Example: "We keep the earlier attention results so we don't have to calculate them again. Those are the *keys and values*, and this is the *KV cache*."
- Favor **high-fidelity 3D visual explanations** that the presenter can point into, step, rotate and revisit. Mathematical accuracy matters more than decorative geometry. Label axes, units and what each vertex/object represents. A helpful scene may show an actual high-dimensional process **projected** into 3D; label the projection as such.
- The speaker is openly still learning about kernels/SMs and detailed inference math. Acknowledge that accurately without implying all kernels behave alike; separate well-verified mechanics from measured behavior and from personal hypotheses.
- **Tie abstractions back to coding-agent workloads**, including multi-turn tool use, large tool/system prefixes, SWE tasks and cache eviction. Avoid claims that a particular 3D "semantic direction" means one same thing across all layers or models.

#### Exact example: how to teach **quantization** without subtly teaching the wrong thing

**Plain-language sentence:** "The model is mostly learned tables of numbers. We can represent many of those numbers using fewer bits, trading some numerical accuracy for smaller model weights and possibly faster memory transfers. That's *weight quantization*."

1. **Show real structure:** token ID selects a learned initial embedding vector; hidden-state vectors are repeatedly transformed by learned **weight matrices** in attention and feed-forward networks. It is usually the **numbers inside those matrices** that are quantized in weight-only schemes—**not** an entire semantic embedding-space vector being directly rounded at the last moment.
2. **Show real representation error:** a high-precision weight number \`w\` maps to one of a finite set of representable levels, often after applying a per-group scale/zero point; \`w_hat = scale * (round(w/scale) - zero_point)\` is a schematic symmetric/asymmetric INT-style example. **Four-bit INT** has only 16 code values per scaled group; **NVFP4** is a *different microscaled floating-point* representation, not "four decimal places" and not interchangeable with INT4. The model's computed outputs can shift because the matrix product uses slightly different weights.
3. **Visualize the consequence, not a fiction:** choose a small explicitly *illustrative* matrix \`W\` and hidden-state input \`h\`, show \`W·h\` before quantization and \`W_q·h\` after. Their output arrows point slightly different ways in the 3D projected view. Annotate "toy 3D projection of derived activations; actual model lives in thousands of dimensions." This is more rigorous than saying quantization "blurs king towards queen".
4. **Context matters:** the token ID's **initial embedding** is not the same as its **contextual hidden state** after attention/layer processing. A causal decoder attends to the current and prior positions (not future positions). The famous king/man/woman/queen word-vector arithmetic is a historical illustration, not an exact law for contextual representations or a valid model-performance benchmark. A phrase's "meaning" is not a single guaranteed 3D point.
5. **What preserves quality?** There are multiple approaches. Simple rounding with scaled groups; more sophisticated **post-training quantization (PTQ)** uses calibration examples/activations to choose scales or rounding that better preserve layer outputs; **AutoRound** optimizes rounding/clipping against block reconstruction errors. **Mixed precision** deliberately leaves sensitive layers, heads, experts or projections at higher precision rather than randomly quantizing weights. **Evaluation** after quantization measures coding, tool-use, long-context or other real-task quality. Calibration and evaluation are different: using a representative calibration set is not the same as "run a coding benchmark and automatically undo the bits that failed".
6. **Tie to user's deployment:** **W4A16** is 4-bit weights with 16-bit activations on relevant operations. **NVFP4/W4A4** uses a low-precision weight-and-activation path on supported Blackwell kernels. Your Qwen3.8 AutoRound experiments intentionally excluded sensitive recurrent-control projections, vision tower and MTP head; these illustrate **selective precision**, not indiscriminate compression. Reducing model-weight memory may create extra room for **KV cache / longer contexts / more agents**, which is the story's immediate payoff.

Research anchors to preserve in the implementation: [Hugging Face quantization concepts](https://huggingface.co/docs/transformers/quantization/concept_guide), [Intel AutoRound docs](https://github.com/intel/auto-round/blob/main/docs/step_by_step.md), [AutoRound/LLM Compressor algorithm explanation](https://docs.vllm.ai/projects/llm-compressor/en/stable/examples/autoround/), [speaker's actual Qwen3.8 AutoRound model-card recipe](https://github.com/dbirks/home-k8s/blob/main/apps/qwen38-upload.yaml.hold), and the already collected notes about KV cache, mixed format, prompt sharing and hybrid attention.

#### One possible **30-second quantization scene**, not an already-approved slide

- Frame 0: a **matrix** of high-precision weights and a thin hidden-state vector, with computed output direction in a labeled *toy 3D* projection.
- Frame 1: choose 4-bit INT/group scales; the matrix entries snap to nearby representable levels and a second output arrow shifts. Difference vector = reconstruction effect. **Do not animate "king/queen semantic points" as though they are the literal quantized weights**.
- Frame 2: use a few calibration inputs; optimize per-group rounding/scale; output error shrinks for those inputs. Then test on a separate held-out coding/tool-use workload; changing calibration does not guarantee accuracy on every task.
- Frame 3: lock a sensitive projection at BF16 while other matrices stay low-bit; display bytes saved and changed output error. Reveal the reclaimed GPU-memory region labeled **KV cache headroom**.
- Controls: input vector, precision/scheme (BF16 / INT4 W4A16 / NVFP4 W4A4 only with explicitly supported GPU), group scale, layer selected, mixed-precision exclusion. The 3D projection is illustrative, not a claim that a hidden state always has an interpretable semantic axis.

### Unanswered questions with the greatest planning leverage

1. **First 32 GB memory decision:** which specific model, quantization/context target and machine made the speaker conclude they needed **32 GB**? The answer could anchor the entire opening hardware memory-budget scene.
2. **Concrete good/bad quantization example:** which model did the speaker compare in two actual quantizations with noticeably different coding-agent behavior? Source a real before/after rather than invent a semantic degradation story.
3. **Narrative ending:** should the talk close with specialized serving-engine discoveries, a "what's new" Engram montage, or the LLM Collective as a brief independent-host networking idea? All are plausible; none is mandated yet.
4. **Technical depth:** how many optional deep dives can fit in 30 minutes? Keep navigation nonlinear and audience-facing text sparse.


## CURRENT WORKING OUTLINE — a guided tour of how I learned local inference (2026-11-17)

**This is now the highest-priority outline to refine through the speaker's narrated walkthrough.** It is not a final script, slide order, or requirement to cover every bullet. The speaker prefers the **loosely autobiographical learning journey** over a broad "trade-offs taxonomy," but the trade-off lens remains useful. The title *Beyond "It Runs"* is **not** locked. All existing demo pages are visual-style experiments, not approved presentation content. **No speaker notes will be used**; keep the detailed content inventory in the README and later make the displayed scenes self-explanatory. **Goal: 30 minutes, 201 level, software engineer meetup, already familiar with Ollama/LM Studio.**

### Overall narrative and delivery rules

- Open with a concrete lived problem, not a terminology index: "I heard local models were finally useful enough, bought a GPU, then spent months figuring out how to make them fit, keep context, handle more agents and go faster."
- Every section follows: **(a) the problem I was trying to solve → (b) the actual thing happening inside the machine → (c) the name engineers use for it → (d) the setting / test / practical consequence**. Prefer ordinary but technically precise words before terms.
- **Visual intent:** an animated object must *correspond to a real tensor, data dependency, cache allocation, model weight, route or transfer*. Not decorative 3D and not an unrelated apple/store analogy. A stylized 3D projection is fine if explicitly labeled as projection/toy model. The speaker can pause or rotate the explanation and move on in ~15–30 sec.
- Build a **library of scenes** and choose a subset for the 30-minute live talk. Some optional deep dives can be bypassed based on time and audience.
- **Admit uncertainty:** there are still CUDA, Tensor Core kernel, Mac/MLX and real benchmarking details the speaker is learning. That is an honest part of the presentation, not a flaw to conceal.
- Optional audience interaction: "Who runs local models with Ollama or LM Studio?" at the opening, and "Anyone using Apple Silicon/MLX/oMLX? What serving settings have worked for you?" near the end. **Don't turn the presentation into a Mac performance tutorial; the speaker has only tried a Mac model about once.**

### 0. Why I started — "These models were becoming useful" (about 2 minutes)

**Story beats / subpoints**

- Heard other people say local models were finally good enough to be useful for real tasks, not just chat demonstrations. Bought a GPU and tried running them myself.
- Initial Ollama/LM Studio experiments were accessible, but the breakthrough was **Qwen3.6-27B**: subjectively reliable choices in coding-agent workflows, tool calls, web research, Kubernetes troubleshooting, and little procedural habits such as remembering to commit before pushing. Later Qwen3.8-27B was another personal workhorse. Verify exact timeline/model identities before publication.
- Why local? **Because it's fun**; personal control and independence; an additional option if hosted subscription economics, quotas or availability change; practical experience running your own tools. The speaker also **uses and appreciates hosted frontier models**; don't frame it as anti-cloud or make unsupported claims of inevitable AI-market collapse.
- The talk is a **collection of things learned in roughly the order the problems arose**, not an exhaustive benchmark or a pure flag walkthrough.

**Possible visuals:** 10-second real agent workflow excerpt (sanitized) or simple "one request to model" diagram. Save elaborate architecture for later. **Speaker follow-up:** what was the first workflow that made the local model feel dependable?

### 1. How much GPU do I need, and which model can I actually fit? (about 5 minutes)

**Story beats / subpoints**

- Real purchase decision: 24 GB felt too restrictive for the models/context the speaker wanted, so they deliberately paid for **32 GB** rather than gamble on barely fitting. Personal judgment; not a universal minimum for local LLMs.
- Considered **NVIDIA DGX Spark**, which offers **128 GB unified LPDDR5x** at **273 GB/s manufacturer-rated bandwidth**, versus the **RTX 5090's 32 GB GDDR7** and **1,792 GB/s manufacturer-rated on-device memory bandwidth**. **These are advertised peaks, not measured LLM tokens/sec**; the 5090's rated bandwidth is ~6.56× the Spark's on-device shared-memory figure, but actual model throughput depends on kernel compute, precision, model support, batch size and, especially for eGPU configurations, the host↔GPU link. **Spark can hold models that do not fit within 32 GB**, and its larger capacity is a genuine advantage for other workloads.
  - Official sources: [DGX Spark spec](https://docs.nvidia.com/dgx/dgx-spark/hardware.html), [RTX 5090 spec](https://www.nvidia.com/en-us/geforce/graphics-cards/50-series/rtx-5090/).
- The **decisive integration requirement**: run the model directly from a **Windows work laptop under WSL2**, not on a separate standalone box reached over a network. An **external RTX 5090 (eGPU)** can attach to that laptop as its inference accelerator; transfers across the eGPU connection can have much lower bandwidth than local GDDR7. The same preference applies despite DGX Spark's larger available memory. The speaker also had WSL VM memory/file-cache crashes; see [home-k8s issue #48](https://github.com/dbirks/home-k8s/issues/48) and specific loading flag anecdotes elsewhere in this README; don't infer the exact root cause from one observation.
- **VRAM is a budget, not an on/off switch:** weights **plus** KV cache **plus** runtime workspace **plus** optional drafter and hybrid recurrent state. A model that barely loads with no usable context is not a satisfying fit.
- **Dense versus MoE:** for a dense model, most FFN weights participate in each token; for **Qwen3.6-35B-A3B**, ~35B total learned parameters and ~3B activated per token, *not* 3B bytes of VRAM. Router selects experts; active-compute and total-storage are separate. Quantization changes the storage size; CPU offloading selected experts is another capacity/transfer trade-off.
- First experiments in **llama.cpp**: model choice, quantization, GPU layer residency, \`--cpu-moe\` and tensor/CPU offload where supported. Reddit/community launch configs inspired useful flags; show **one real example**, then explain the mechanism, rather than telling attendees to copy a random preset.
- **Don't introduce NVMe PLE here** as ordinary expert CPU offload. Save DeepSeek Engram/Qwen PLE for the later developments section.

**Candidate visual:** physically partitioned 32 GB VRAM slab; slide 24 → 32 → 128 GB; a *separate* bandwidth pipe for each tier and a separate CPU/eGPU interconnect. Add dense/MoE router, and expert weights partly moved to CPU RAM. No invented fps/tok/s from bandwidth alone.

**Speaker follow-up:** which specific first model/quant/context did the 24-vs-32 GB decision target, and which community llama.cpp flag was the first win?

### 2. I got the weights to fit; now how do I fit a useful conversation? (about 5 minutes)

**Story beats / subpoints**

- First distinguish **static learned weights**, **dynamic attention KV cache**, **recurrent/hybrid state**, and **temporary buffers**.
- **Weight quantization in plain words:** take large learned numerical weight matrices and represent selected numbers with fewer possible values using scales/grouping, keeping most of the computation useful while shrinking storage. **This is not chopping off decimal places, not directly blurring a "king" embedding, and not the same as reducing model parameter count.**
- Start with a real matrix \`W\` and input vector \`h\`; show how a different quantized matrix \`W_q\` changes the output \`W_q h\`. Only *then* use a clearly labeled 3D projection to show an output direction shift. Initial token embeddings and context-dependent residual/hidden-state vectors are distinct. If using "king/queen" analogies, state their limitations or drop them in favor of coding-token examples.
- **INT4 / W4A16** (weights compressed, activations 16-bit for eligible operations), **NVFP4 / W4A4** on Blackwell supported kernels, and other precision choices. Quantization uses group scaling, selective layers and often calibration. **AutoRound** tunes quantization/rounding against representative calibration inputs; mixed precision selectively preserves sensitive projections. **Calibration is not the same thing as held-out evaluation**. Use the speaker's Qwen3.8 AutoRound exclusions/quality tests as genuine examples.
- What the **KV cache** really contains: intermediate **key/value vectors at attention layers for processed token positions**, *not raw token IDs*. Without it, earlier token positions' work is repeatedly recomputed; this is **polynomial, not exponential** in a conventional full-attention model. Decode updates K/V incrementally. For hybrid models (DeltaNet/Mamba), state/checkpoint accounting differs.
- **KV precision**: BF16/FP16 → FP8 → NVFP4 where implemented and quality-tested. Trading numerical fidelity and kernel support for cache capacity. The speaker experienced how cache quantization freed space for more history; don't universally claim a more aggressive KV dtype is always better.
- **CPU/offload nuance**: it is possible to hold some weights in CPU RAM, or mix GPU+host placement, but reads/compute/staging can bottleneck on DDR bandwidth and the interconnect. Aim for GPU-resident *hot* computation where feasible. Revisit longer-context/parallel trade-offs in next section.

**Candidate visual:** the precise quantization matrix→vector animation, followed by per-layer K/V slots growing token-by-token and shrinking per token as cache dtype changes. Each new **attention** calculation reads prior values; never pretend old context costs zero.

**Speaker follow-up:** which real model's W4A16/NVFP4 or KV precision change first made an otherwise impossible context workable?

### 3. It works for me. Can I run more than one coding agent? (about 6 minutes)

**Story beats / subpoints**

- From **one working request** to several concurrent conversations and perhaps multiple *replicas*. Distinguish requests/sequences sharing one model instance versus independently loaded copies and independent hosts. These have very different weight-memory costs.
- **Prefill vs decode:** prefill processes many uncached prompt positions in parallel, frequently using Tensor Cores well; single-stream decode runs the next position and reads active weight matrices/cache, often memory-bandwidth-sensitive. Explain SMs/Tensor Cores and **GEMM vs GEMV** in ordinary language. Decode at large batch can become compute-bound. Avoid falsely claiming each new token reloads model checkpoint from SSD.
- **Memory bandwidth comparison:** GPU GDDR7 versus CPU DDR4/DDR5, and NVMe I/O. Show *measured* observations with precise benchmark labels separately from *rated* Spark/5090 peaks; different cards/cores/kernels and eGPU link can break naïve bandwidth→tok/s predictions.
- **Prefix caching:** same **initial token sequence**, same model/compatible settings, reuse previously computed K/V and/or hybrid state from an earlier request. The practical agent case is long repeated system/tools prefixes. 50K tokens is a **hypothetical size**, not a verified Claude Code system prompt. Injecting project instructions, date, tools or other dynamic data early can destroy matching.
- **vLLM** reuses fixed-size hash-indexed parent-chained KV blocks (can share physical blocks among compatible active requests). **SGLang RadixAttention** maintains a radix tree whose shared trunk branches into different request histories. It is an **indexing/prefix reuse** strategy, not a different attention equation. **llama.cpp** supports slot/prompt reuse but does not necessarily physically deduplicate simultaneous prefix K/V across independent slots.
- **Reality check:** prefix retention and cache eviction can dominate TTFT when agents take turns with long histories. Speaker's home-k8s Qwen3.8 notes document KV capacity increasing from ~741K to ~1.23M tokens under one configuration by switching FP8→NVFP4, easing cache churn; numbers depend on setup. Show what got faster *without* pretending higher KV capacity guarantees model answer quality.
- **Inference engines in practice:** at one stage llama.cpp felt lighter/better-fitting; later vLLM became compelling for concurrency/scheduling, with frequent back-and-forth. Show key high-leverage flags for llama.cpp, vLLM and optionally SGLang, but don't spend the talk reading YAML.

**Candidate visual:** the same three agent histories represented as **vLLM block-hash references / SGLang radix tree / llama.cpp slots**; split the tree when a token changes near the beginning. Then show the GPU context working set overflowing and prefix-cache eviction forcing renewed prefill.

**Speaker follow-up:** in which concrete experiment did concurrency push you toward vLLM, and were you running parallel sequences or separately loaded replicas?

### 4. Can I reduce the number of expensive target-model passes? (about 7 minutes)

**Story beats / subpoints**

- Why decode performance can bottleneck on repeatedly moving active weights through GPU memory, especially with one or a few streams.
- **Speculative decoding, plain first:** a cheaper mechanism guesses several next tokens; the main model checks the proposals in parallel; only valid tokens are kept. Proper stochastic verification can preserve the target's sampling distribution. Acceptance length ≠ guaranteed speedup.
- Distinguish a **drafter model**, **native MTP heads**, and **prompt n-gram heuristic drafting**; no single mechanism represents all speculation.
- **MTP**, **EAGLE-3**, **DFlash**, **DSpark**, **DFlash2**; add a few newer proposals only if their actual draft dependencies can be communicated in a short animation. Show one target/verifier and switch drafting mechanisms while keeping the same token-position axis.
- **Memory trade-off:** a separate drafter adds weight/state/workspace costs and can **reduce memory available for KV/prefix caching and concurrency**. Show a before/after VRAM allocation rather than a magical tokens/sec multiplier.
- **Firsthand DSpark training**: \`speculators\` pipeline, target-model rollouts/hidden-state extraction, SWE-bench/DeepSWE language diversity, warm-start versus from-scratch, rotary mismatch, teacher-forced versus free-running evaluation and why more agentic training data alone did not improve the tested from-scratch run. Don't imply AutoRound trained DSpark—AutoRound belongs in the weight-quantization story.
- **Model creators shipping matched draft models**: Meta Muse Glimmer 30B, Poolside Laguna S and XS 2.1 examples. Show 1 genuine runtime configuration and the extra drafter VRAM allocation.
- Optional quick lesson: when speculation can make *real agent throughput worse*, especially under high batch or reduced context retention.

**Candidate visual:** animated target-only time axis vs drafter→parallel verifier, then a selector for MTP/DFlash/DSpark/DFlash2, plus an optional panel of your real train/serve acceptance results. Keep green "accepted" count and end-to-end throughput distinct.

**Speaker follow-up:** what is the most memorable failed DSpark experiment (and what did it teach you), and which drafter has actually helped most on your own workload?

### 5. Things I found later that are unusually interesting (about 4 minutes)

**Story beats / subpoints**

- **Small/specialized inference engines:** a runtime or kernel highly optimized for a *particular model and particular GPU* can sometimes outperform a broad framework on that exact workload. Examples worth verifying and benchmarking: **NInfer on RTX 5090**, **Radiance on AMD Radeon AI PRO R9700** (coworker report), **Pennyroyal** (speaker's SGLang-derived experience), and other special-purpose runtimes. These are not all CUDA-based: the AMD path is different. Do not claim every specialized runtime was "entirely AI-written," that all are benchmark winners, or that a new engine's performance generalizes to all cards/models.
- **The big recent architecture change:** learned **n-gram lookup memory**, introduced in DeepSeek's **Engram** research and adopted in DeepSeek V4.1-Flash, with a separate related **PLE** approach in Qwen3.8-Flash-Next. Hash recent token IDs into learned table rows; only selected rows are accessed *for newly processed token positions*, not just once when a session starts. This is not ordinary MoE expert offload, KV cache or prompt n-gram speculative decoding.
- **Speaker's concrete example:** Pennyroyal kept ~47.68 GiB of Qwen PLE learned lookup weights on **NVMe**, with bounded staging/cache, because host DRAM could not hold its standard full in-RAM PLE and HiCache budget. It does not stream all model weights from NVMe per generated token. Explain where selected rows travel; distinguish from CPU-offloaded MoE experts.
- **Mac humility and crowd connection:** speaker ran a local model on Mac approximately once, so should not pretend to give a first-hand Apple Silicon performance guide. Bandwidth can suggest *some* characteristics, but GPU/ANE cores, kernels, quantization and unified-memory behavior matter. **oMLX** is a real MLX-native serving project at [omlx.ai](https://omlx.ai/) and [github.com/jundot/omlx](https://github.com/jundot/omlx); also mention Apple **MLX**, MLX-LM, llama.cpp and LM Studio if relevant. Briefly invite practitioners in the room to share their experience.

**Candidate visual:** "what's emerging" two-panel montage: GPU-specific inference kernel path and per-token n-gram hash→selected learned table rows→host/NVMe staging. Could be an optional branch if time is tight.

**Speaker follow-up:** which specialized runtime delivered the most surprising real improvement, and what measurement supports it?

### 6. Optional 60-second endcap: sharing local inference without a VPN (about 1 minute)

**Story beats / subpoints**

- LLM Collective: independently hosted model endpoints contributed by people on their own machines, exposed through a gateway. Not cross-host model tensor parallelism or pooled GPU VRAM.
- Speaker's practical motivation: don't require everyone to join a VPN or expose inbound ports into their home network. A contributor can make an **outbound-initiated authenticated connection** to a service/gateway, then receive appropriately routed requests through that connection **if this is how the deployed design works**. Verify actual Collective topology, trust boundaries and protocol before drawing exact networking arrows.
- This is a small example of "what you can do once a local model is useful as a service," not necessarily a flagship topic.

**Candidate visual:** 3 separate home-machine boxes, each running its own whole model, outbound arrows to a gateway, client/API requests routed back to an available appropriate model. No combined VRAM pool.

### Presentation allocation: a first-pass budget, not a promise

| Section | Approx. time |
| --- | ---: |
| 0. Why I started | 2 min |
| 1. What fits? Hardware, dense/MoE, first llama.cpp choices | 5 min |
| 2. More useful context: weights, quantization, KV | 5 min |
| 3. Multiple agents: cores/bandwidth, prefix reuse, scheduling | 6 min |
| 4. Go faster: speculative decoding and the DSpark story | 7 min |
| 5. Interesting recent developments and specialized engines | 4 min |
| 6. Optional LLM Collective endcap | 1 min |
| **Total** | **30 min** |

These timings are intentionally aggressive, because this is a 201-level fast visual tour, not six deep technical lectures. A talk that genuinely teaches all individual topics in depth would take much longer. A **core 20-minute route plus skippable branches** is a good fallback.

### Technical tone and facts to preserve while editing

- **DGX Spark 273 GB/s and RTX 5090 1,792 GB/s are vendor peak bandwidth specifications**, not measured real-model decode rates. Their ratio is not a speedup claim; the eGPU host link and software kernels complicate performance.
- Don't conflate "I chose 32 GB because 24 was too tight *for my goals*" with "all local inference needs 32 GB."
- Don't equate total MoE weight footprint with active-compute count, embeddings with contextual hidden states, or matrix-weight quantization with quantizing an abstract semantic cloud.
- Prefix caching works on identical **initial tokenized** content, not just thematically similar instructions; multiple independent model instances don't magically share cached KV.
- "No speaker notes" means **the README is the research inventory**, and visuals/short audience-facing captions carry the talk live.
- Never present illustrative speed numbers, memory bandwidth marketing figures, or uncertain AI-written engine origin stories as firsthand measurements.


## Earlier five-stage topical skeleton (provisional, not the preferred narrative)

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


## Focused self-teaching research: GPU cores, KV cache, shared prefixes, and per-token Engram (2026-11-16)

> **Status: researched conceptual teaching notes and scene briefs, not finalized slides or presenter notes.** The speaker wants to understand these ideas rather than pretend to have mastered all the details. Preserve explanatory nuance. The existing pages in \`src/slides.ts\` are visuals/style experiments, **not the talk plan**. The eventual slides should show real mechanisms with labels, not just pretty visual metaphors.

### Start with the three kinds of "memory" that sound similar but are not

| Thing | Created when? | What is stored? | When reused? | Where? |
| --- | --- | --- | --- | --- |
| **Model weights** | Training/quantization, loaded for inference | Parameters of projection/FFN matrices, router/experts, and optional embedding/n-gram tables | Reused on *every applicable inference pass*; weights do not change from token to token | GPU VRAM if resident; optionally CPU RAM or a targeted NVMe backing tier |
| **Per-request KV cache** | On prompt **prefill**, then incrementally during generation | **Key and value vectors at attention layers for processed positions**, not the original token IDs or a tiny token-to-position index | Subsequent tokens *in the same sequence* attend to cached past K/V instead of recomputing them | Usually GPU VRAM; possibly CPU/disk tiers depending on backend |
| **Prefix cache / shared KV** | After a prompt or prefix has been processed and retained | Reusable portions of previous KV/state, indexed by the **exact processed prefix** and appropriate model/config context | A *different request* with a matching initial token prefix can skip redundant prefill for that region | GPU KV blocks, possibly host/disk offload; engine-specific |
| **Engram / PLE n-gram weights** | Trained as part of a model; loaded/accessible at serving time | **Static learned rows of large hashed lookup tables** addressed using n-grams of token IDs | Lookup is performed for newly computed token positions, not only the beginning of a session; already-computed prefix work can be skipped through prefix caching | GPU, host DRAM, or specialized NVMe row lookup depending on implementation |

**Big correction:** the phrase "KV cache remembers that at position 37 was token X" is false as a technical explanation. Token IDs are tracked for scheduling/tokenization and prefix matching, but the *KV contents* are the **contextual key and value feature vectors**, generally for each relevant layer and KV head at each position. For a given attention layer, \`k_i = W_K h_i\`, \`v_i = W_V h_i\`, and for the new position \`q_t = W_Q h_t\`; the new query attends to previously cached keys and values. Even the **same token ID** at different positions or following different prior tokens can have **different K/V state**. Q is generally not cached for previous positions because the new token only needs to query past K and read past V. The attention response is schematically \`softmax(q_t K_{\le t}^T / sqrt(d)) V_{\le t}\`. Actual grouped-query, multi-head, RoPE/position encodings and hybrid architectures vary.

Sources: [vAttention description of per-layer K/V](https://www.microsoft.com/en-us/research/publication/vattention-dynamic-memory-management-for-serving-llms-without-pagedattention/); [vLLM KV cache architecture](https://docs.vllm.ai/en/latest/design/prefix_caching/); [DeepSeek official Engram code](https://huggingface.co/deepseek-ai/DeepSeek-V4.1-Flash/blob/main/inference/engram.py).

### What a forward pass does, and what happens with **no** KV cache

**With no KV cache**, a naive autoregressive runtime takes the entire known prefix—including the original prompt and every generated token—and **re-executes it** to compute the next-token output each decode step. It needn't recompute *all* token predictions for end-user output, but it usually recalculates earlier hidden states / attention-related work to produce the final logit. In an efficient engine **with** KV cache:

1. **Prefill** the uncached prompt positions (often many at once). Each attention layer computes K/V for each processed prompt position, stores it, and produces the needed hidden states/logits.
2. Sample/select the first output token from the final prompt logits.
3. **Decode** the newly generated token only: run that **new position** through the model layers; each attention layer forms a new Q/K/V, reads historical K/V, stores the new K/V, and emits logits for the following token.
4. Repeat. Earlier tokens' complete transformer layer computations are **not** rerun. Their cached K/V is still read as needed by attention. Dense weight matrices are still applied to the new token. The KV cache **avoids recomputing past positions**, not the cost of applying model weights at the next position.
5. For standard full attention, the amount of historical KV read at each new token generally increases with context length, even though old token projections need not be recomputed. For sliding-window attention and recurrent/hybrid models, the state/read pattern is different.

**Computational growth is polynomial, not exponential.** A simple way to explain it without committing to any one kernel:

- If an initial context has \`P\` tokens and we generate \`T\` more, repeatedly processing the **entire** prefix without KV yields approximately \`P + (P+1) + ... + (P+T-1) = PT + T(T-1)/2\` **token positions executed** across the generation run. With KV, after initial prefill, only about \`T\` new token positions go through the network's projections/FFNs. **This example counts token-position processing, not all attention FLOPs.**
- For an ordinary *full causal attention* implementation, the attention interaction count in a full sequence of length \`L\` scales **quadratically** (\`O(L²)\`). Recomputing full prefixes on every decode step can thus add up to **cubic** attention work in \`T\` for fixed small \`P\`. With KV, the incremental full-attention decode work is \`O(P T + T²)\`, plus the one-time \`O(P²)\` prompt prefill, for fixed model dimensions. Neither is exponential.
- **Caveat:** these are asymptotic textbook/naive complexity terms. Real long-context attention kernels (FlashAttention, MLA, sliding windows, grouped-query, recurrent layers) have very different memory movement, constants, and sometimes different scaling. For a 30-minute talk, state "without KV we needlessly repeat earlier token processing; with KV we keep keys/values and only run each new position" before discussing big-O.

**Proposed simple visual:** a four-token prompt \`A B C D\` and generation \`E F G\`. Disable KV: see four/five/six/seven token columns repeatedly illuminate on successive full passes. Enable KV: first prefill fills four columns of layer-specific K/V; next passes highlight only the new input token while a query beam reads old K/V. Show an operation counter that clearly says **processed token positions** vs **KV values read**, to avoid implying old memory is free.

### GPUs: where **cores** come in

**What the hardware actually offers:** a GPU contains multiple **streaming multiprocessors (SMs)**. The SM schedules many groups of threads (warps), has registers, shared SRAM and on-chip resources, and runs arithmetic. **Tensor Cores** specialize in tile-based matrix-multiply-accumulate operations, critical to transformer projections and FFNs. The terms **CUDA cores** and **Tensor Cores** should not be treated as two independent "parallel GPU devices" that each process a complete transformer layer; the whole SM runs coordinated kernels. Attention kernels also use scalar/vector operations for normalization, softmax, address/index logic, etc. Data moves from GPU **VRAM/GDDR/HBM** through caches/registers/shared memory into the execution hardware. Tensor-core throughput matters only if the workload can feed it.

**Prefill:** with many prompt positions, operations on the same learned weight matrix become a **large matrix multiplication (GEMM)**. A loaded tile of the weights can be reused across multiple token vectors. Tensor Cores have more useful work to do per byte read. A full, long prefill is thus **often compute-bound**, depending on attention, memory layout, context length and hardware.

**Decode, one active request:** applying a weight matrix to only one new token is closer to a **matrix-vector multiply (GEMV)** or tiny GEMM. The SMs have relatively little arithmetic per weight byte; sustained memory bandwidth often dominates. Simultaneously, attention reads the growing historical K/V, which can dominate at long contexts. The GPU may be busy but not saturating its available Tensor Core arithmetic capacity.

**Decode, many active requests or multiple speculative positions:** batching increases available matrix rows (more arithmetic for each streamed weight tile). This can raise utilization and move the workload **toward compute-bound**, at the expense of more active KV, scheduler contention, possible long queue times or drafter memory. Some algorithms use specialized attention or recurrent kernels; don't claim "decode is always only bandwidth limited."

**Useful roofline intuition:** \`arithmetic intensity = useful FLOPs / bytes moved\`. Performance is bounded by \`min(peak compute FLOP/s, sustained bandwidth × arithmetic intensity)\`. In one idealized BF16 weight matrix with \`M × N\` elements multiplied by \`B\` token vectors, weight fetches cost \`~2MN\` bytes while multiply-add arithmetic costs \`~2MNB\` FLOPs, suggesting **~B FLOP per weight byte** before accounting for activations, outputs, KV reads, other kernel work and caches. \`B=1\` is poorly amortized; large \`B\` can feed the Tensor Cores.

**Honest presenter wording:** "I understand the high-level memory-vs-compute tradeoff now; individual kernels, kernel occupancy, shared-memory tiling, and the exact crossover point are still things I'm learning. That's exactly why we're visualizing what's happening rather than pretending every setup has one magic flag."

Sources: [CUDA Programming Guide, Streaming Multiprocessors and warps](https://docs.nvidia.com/cuda/cuda-programming-guide/03-advanced/advanced-kernel-programming.html); [NVIDIA: prefill vs decode and roofline](https://developer.nvidia.com/blog/co-designing-ai-model-attention-for-fast-interactive-long-context-inference).

### vLLM: automatic prefix caching (APC) is a **hash-block** mechanism

The vLLM design does not store \`"system prompt" -> cached\` as a human-language string. It indexes reusable **completed KV blocks** by a hash derived from (a) the **previous block's hash**, (b) token IDs **inside the current block**, plus (c) relevant extra hashes (LoRA IDs, multimodal input hashes, **cache salt** for isolation, etc.). Block-chain ancestry matters: the same \`B C D\` appearing later after a *different* prefix does not yield the same reusable KV state.

- A first request pre-fills a 50,000-token prefix, creating the necessary K/V and making full, eligible blocks reusable. The next compatible request can retrieve the same cached block IDs and **increase their reference counts**, avoiding duplicate prefill and often duplicate physical KV storage for that shared prefix. Keep this qualified: partial blocks, simultaneous in-flight duplicate computation, block eviction and hybrid state alignment can prevent perfectly one-copy accounting.
- When requests diverge, only the **longest matching initial prefix** can be reused. Different user/project instructions, dates, tool definitions, chat templates, model adapters, image hashes or salts can shorten or prevent hits. A matching text chunk *later* in the prompt after the first mismatch does **not** qualify for ordinary prefix reuse.
- Full blocks are cached; capacity is finite; unreferenced cached blocks may be evicted when the free block queue needs space. Cached and **currently active** blocks are not all equally evictable. Same model server + correct configuration matters; **two independent replicas** do not automatically share KV just because both expose the same API endpoint. Remote KV-transfer/offloading is a separate feature.
- **Hybrid models:** if a model uses full attention + Gated DeltaNet/Mamba/other recurrent state, matching token hashes isn't enough by itself—cache reuse may require appropriate recurrent state/checkpoints and compatible block boundaries. vLLM now documents \`--enable-mamba-shared-prefix-checkpoint\` for matching a shared prefix that ends inside a block, subject to implementation/model support. Don't depict arbitrary Mamba state as 50,000 ordinary K/V blocks.

**Concrete agent harness test** (illustrative **50K**, **not** a verified current Claude Code prompt length):

~~~text
One vLLM model-serving instance:
Agent A: [IDENTICAL SYSTEM+TOOLS 50K] + [project A prompt] + ...
Agent B: [IDENTICAL SYSTEM+TOOLS 50K] + [project B prompt] + ...
Agent C: [IDENTICAL SYSTEM+TOOLS 50K] + [project C prompt] + ...

Cache: 50K-ish shared prefix K/V once (eligible full blocks; retained)
Branches: separate K/V for distinct project histories and generated replies
~~~

**Critical practical nuance:** *three different harnesses* are likely to serialize different system instructions, tool schemas, metadata or chat templates. They can share only **whatever first token sequence actually matches**. Even three runs of the **same** harness can diverge early if a current date, repo path or session ID is injected near the beginning. Audit tokenized prompt order or actual cache-hit metrics, don't assert "all Claude Code system prompts are automatically a single cache entry." Example metrics: \`prefix_cache_hits\` and \`prefix_cache_queries\` where provided by the engine; measure cold versus warm TTFT and prefill-token counts. Privacy: in a multi-tenant environment review cache-salt isolation—cross-tenant cache sharing is not automatically appropriate.

Sources: [vLLM hash-block design and refcount/free queue](https://docs.vllm.ai/en/latest/design/prefix_caching/); [vLLM automatic prefix-caching guide and hybrid Mamba alignment](https://docs.vllm.ai/en/stable/features/automatic_prefix_caching/).

### SGLang: RadixAttention is a **radix tree over cached token prefixes**, not a new neural attention equation

SGLang's [original RadixAttention implementation](https://www.lmsys.org/blog/2024-01-17-sglang/) keeps a **compressed prefix trie/radix tree**. Tree edges contain **variable-length sequences of token IDs**; nodes point at the corresponding cached KV locations. Prefixes shared by several conversations appear as a single **trunk**; after the first differing token, conversations branch. The system finds the longest reusable prefix, locks/reference-protects its necessary cache state, and caches the new suffix. Under pressure, unneeded **leaf** subtrees can be evicted with an LRU-like policy while retaining shared trunks.

**Difference from vLLM:** vLLM tracks a hash table of fixed-size KV blocks chained by parent hashes. SGLang explicitly organizes variable-length token spans into a radix tree, making shared branches visible in the data structure. **Both achieve the same general optimization: reuse previously computed state for an exact compatible prefix.** A radix tree is an *index/eviction strategy*, not magic attention that changes \`softmax(QK^T)V\`, and it is not the same as a **speculative-decoding candidate tree** used to verify multiple possible future tokens.

**Hybrid prefix caching (important for the Qwen/Flash-Next workload):** modern [SGLang Unified Radix Cache](https://www.sglang.io/blog/unified-radix-cache) keeps one *logical* radix tree with components whose actual reusable contents differ:

- **Full attention:** the cached entire common prefix's KV pages are valid.
- **Sliding-window attention:** only the window of historical KV immediately relevant to the continuation must be present.
- **Mamba/DeltaNet/SSM state:** a saved recurrent-state **checkpoint valid at a precise prefix boundary** is needed; cannot reconstruct arbitrary intermediate state just because an unrelated full-attention KV block exists. Reuse may require copying state (copy-on-write) before divergence.
- The unified tree manages **component-specific residency and eviction**; do not show all branches having equally reusable state for every layer.

**Visual:** a shared root "SYSTEM + TOOLS" grows three branches. Switch index mode **vLLM hash blocks / SGLang radix tree** while keeping the prompts and underlying K/V data fixed. Then switch the model to hybrid and watch the full-attention path remain cached while a sliding window travels with the active frontier and Mamba checkpoint markers appear only at eligible positions.

Sources: [LMSYS RadixAttention design](https://www.lmsys.org/blog/2024-01-17-sglang/), [SGLang's September 2026 Unified Radix Cache explanation](https://www.sglang.io/blog/unified-radix-cache), [code-level component behavior](https://github.com/sgl-project/sglang/blob/main/python/sglang/srt/mem_cache/unified_cache/components/README.md).

### llama.cpp: supports prompt reuse, **not necessarily vLLM-style one physical shared prefix**

The answer to "will all three agents' identical system prompt be counted once in llama.cpp?" is **not necessarily**. Current [llama-server arguments](https://github.com/ggml-org/llama.cpp/blob/master/tools/server/README.md) include:

- \`--cache-prompt\` (request/server prompt prefix reuse; current docs default **enabled**).
- \`--parallel N\` (parallel slots) and \`--kv-unified\` (one shared **KV memory buffer across sequences**, which is not by itself a promise that identical prefixes are de-duplicated).
- \`--cache-ram N\` and \`--cache-idle-slots\` (RAM-backed saved prompt states across slot reuse; copying/restoring a cached state can occupy new storage).
- \`--ctx-checkpoints\` (especially relevant for hybrid/recurrent models), optional slot persistence.
- \`--cache-reuse N\` for qualified chunk reuse using KV shifting, not an all-purpose cross-slot prefix identity map.

**What is established from current implementation:** llama-server tends to select a slot whose existing prompt has the largest initial common prefix and can skip evaluating that portion when it runs in a compatible slot. A RAM-backed cache can save/restore prompt state across slot turnover. However **three simultaneously active slots can still hold separate instances of the common prefix**, and cross-slot restore/copy has different memory and latency behavior from shared vLLM block references.

A [October 16, 2026 discussion](https://github.com/ggml-org/llama.cpp/discussions/30664) specifically proposes **cross-slot attach / shared KV cells** and pinning common-prefix snapshots, motivated by agent harness tool/system prefixes. This is a **proposal/prototype**, not evidence that its opt-in flags are already present in current mainline. Version-check before using its results or recommending flags. Older llama.cpp guidance on \`--system-prompt-file\` is historical; verify against the installed CLI before using. For fairness, test not only whether the second request is fast but also **whether a simultaneous third request holds duplicate K/V**.

**Safety/compatibility nuance:** RAM-cache, unified KV, hybrid recurrent checkpoints, and version-specific cache restores have had correctness/compatibility reports; avoid recommending experimental flags as a blanket production fix. Use [upstream README](https://github.com/ggml-org/llama.cpp/blob/master/tools/server/README.md), [current server source](https://github.com/ggml-org/llama.cpp/blob/master/tools/server/server-context.cpp), and the [cross-slot proposal](https://github.com/ggml-org/llama.cpp/discussions/30664).

### Engram: **the table is persistent; the selected rows are accessed for newly processed tokens**

This corrects the tentative question "Are Engram weights read through once, at the beginning of the session?"

- **No**, not in that sense. The **massive learned lookup table** is a *weight tensor*, typically loaded/memory-mapped or made accessible by the serving runtime at **model initialization** (possibly in **host RAM** or specialized **NVMe** storage). The table does **not** get fully scanned once per user conversation and then disappear.
- Whenever the network **computes a new token position** at an Engram-augmented layer, its implementation derives **n-gram hashes from recent token IDs**, looks up the corresponding **small subset of learned table rows**, and merges those features into that layer's evolving hidden state via learned projections/gating. In DeepSeek-V4.1, the code handles needed lookback tokens across chunk boundaries. So Engram lookups happen during **prefill for uncached positions** *and* during **decode for new positions**, not only once at session start.
- **But repeated lookup does not necessarily mean repeated physical NVMe reads.** If the table is resident in CPU RAM, the data is fetched from there; NVMe-backed implementations can use bounded staging buffers, OS page cache, prefetch and hot-row reuse. In DeepSeek-V4.1's reference serving, deterministic addressing allows **host-memory prefetch**. Pennyroyal has a specialized **NVMe PLE** path that accesses selected rows; no blanket claim it performs exactly one disk I/O per n-gram per token.
- **Prefix-cache interaction:** when a whole input prefix is already processed and a serving engine reuses the relevant KV/**hybrid checkpoint state**, the model need not run those positions again, so their Engram lookups/computation are also skipped. However, for the newly appended suffix, Engram still does new lookups.
- DeepSeek's [official Engram research implementation](https://github.com/deepseek-ai/Engram) calls this **static N-gram memory with deterministic addressing**. The [V4.1 Engram inference code](https://huggingface.co/deepseek-ai/DeepSeek-V4.1-Flash/blob/main/inference/engram.py) and [vLLM port](https://docs.vllm.ai/en/latest/api/vllm/models/deepseek_v41/common/engram/) explicitly compute token-ID lookbacks for **every position/chunk**. It is **not** like caching the 50K-token system prompt *once at initialization*.
- Model-family distinction: DeepSeek-V4.1 has the large **Engram** tables; the speaker's Qwen3.8-Flash-Next/Pennyroyal deployment uses its own **PLE n-gram table** on NVMe. They are related ideas but **different concrete models and serving paths**; neither should be confused with MoE CPU expert offloading or speculative-decoding prompt n-gram matching.

**Two-stage animation:** (i) **once at startup**, draw the table arriving into its persistent storage tier; (ii) **for each processed position**, highlight a handful of hashed rows, bring a small vector into the target Engram layer, fuse with the residual stream. During a second request with a shared cached prefix, dim the previously computed prefix and animate new lookups *only* for the suffix. Add switches **DeepSeek V4.1 host-memory** vs **Pennyroyal NVMe PLE**; show the data path, not speculative benchmark numbers. Optional close-up: two n-grams mapping to same toy hash bucket, illustrating why hashing does not implement exact memorized phrase equality.

### Four interactive visualization candidates for the implementation agent

**Scene P — the true lifecycle of one token and its keys/values**

- Input token label with ID; contextual hidden-state vector; per-layer Q projection, K projection and V projection matrices. Save K and V in an expanding per-layer, per-KV-head array indexed by token position, while the current query attends to the cached past.
- Color-code token **identity**, hidden-state **representation**, stored **K**, stored **V**, and **Q**, with explicit tensor labels. Add slider for attention layer, position, sequence length, KV heads, and KV dtype.
- Correctness: a K/V pair is **not a raw token ID**; two copies of the same token can have different K/V. Keep positional encodings architecture-specific and explain selective/hybrid attention separately.

**Scene Q — disable the KV cache and watch repeated work**

- Initial four tokens and a three-token generated suffix. Two synchronized paths. Left reexecutes entire increasing prefix; right prefills once, then runs **only the new token** through the model and accesses cached K/V. Separate meters for **processed token positions** and **historical KV attention reads**. Show quadratic/cubic *polynomial* growth under a correctly described cost model, never "exponential."
- Optional roofline inset: prefill has many token vectors feeding Tensor Cores, batch-one decode has little arithmetic per weight read.

**Scene R — three agent harnesses, one shared prefix (vLLM vs SGLang vs llama.cpp)**

- Build three token-identical prompts for the first 50K **illustrative** tokens and different subsequent project histories. In **vLLM** mode show fixed full KV blocks with their parent hashes/refcounts; three requests can refer to the same blocks. In **SGLang** mode show a **compressed radix tree trunk** branching into three different suffixes; eviction removes unused leaves before the useful trunk. In **llama.cpp** mode show **slots** with local retained prompts and optional RAM cache restore; do **not** assume one physical shared prefix across all concurrent slots.
- Toggle an injected date/tool schema difference at token 500: all three modes stop **ordinary initial-prefix reuse** at divergence. In hybrid mode show that Mamba/DeltaNet state requires checkpoints at compatible boundaries. Count eligible cached positions, actual prefills skipped, number of physical stored KV blocks, and separate per-agent suffixes. Keep \`50K\` illustrative; never assert a fixed Claude Code system prompt size.
- Important: this is a **data structure / cache-sharing tree**, not an EAGLE speculative-token verification tree.

**Scene S — Engram each token, not each session**

- Render startup event only once: persistent giant learned table loaded/accessible in **CPU DRAM** or mapped **NVMe**. Token n-gram hash windows move with the currently processed position. Selected row addresses light up and are staged/fused into a particular model layer.
- Use play modes: **new prompt prefill** (many token positions hashed), **decode** (new position hashed each iteration), **cache-hit prefix** (no replay of cached past rows; only suffix tokens processed), **cold table lookup** (host/SSD latency), **hot lookup** (host/page cache). Distinguish physical storage access from logical lookup computations.
- The slide must label **Model weights (static)**, **Lookup-row fetch (per processed position)**, **KV cache (dynamic)**, **Prefix reuse (between requests)**. Differentiate DeepSeek Engram and Qwen PLE profiles.

### Presenter-understanding checklist (internal research aid, not speaker notes)

Before trying to teach a scene, be able to answer: **(1)** Which values are learned weights versus derived per-request activations? **(2)** Which parts of the diagram are repeated for every new token, and which are preserved from old positions? **(3)** When the GPU is "slow," is it short of VRAM, memory bandwidth, arithmetic occupancy, a compatible kernel, or an affordable cached prefix? **(4)** Do two identical initial prompts have physically shared KV or did the engine merely save/restore/copied a cache snapshot? **(5)** Are we describing full attention, a hybrid Mamba/DeltaNet layer, or sparse n-gram lookup?

Research uncertainty to preserve: actual VRAM bytes/KV per model layer, exact CUDA/Tensor Core kernel mapping in the user's selected versions, per-engine prefix-cache behavior on hybrid Qwen3.8/Flash-Next, and the real prefix length and tokenization of Claude Code/pi/Hermes agents. Validate with real prompts/logs rather than invented examples.


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

- [**PRIMARY: Production handoff and three-pass scene specifications**](docs/presentation-production-handoff.md)
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
