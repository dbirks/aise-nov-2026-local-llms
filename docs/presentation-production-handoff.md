# Local LLM Inference — narrative, technical, and visual production handoff

**Research snapshot:** November 17, 2026  
**Status:** production brief for future coding/research agents; not an approved slide deck or speaker notes  
**Audience:** 30-minute, 201-level engineering meetup; attendees have usually tried Ollama or LM Studio  
**Presenter:** first-person account of real local inference experiments on a Windows/WSL RTX 5090 eGPU and separate Linux/Kubernetes RTX PRO 6000 infrastructure  
**Source of truth for the narrative:** this file, the latest speaker-directed instructions, and the [current working outline in the README](../README.md#current-working-outline--a-guided-tour-of-how-i-learned-local-inference-2026-11-17)  
**Other research:** [technical notes and speculative methods](local-llm-talk-research-notes.md), [earlier brainstorming](speaker-brainstorm.md), [implementation conventions](../AGENTS.md)

## 0. Executive direction — read before implementing anything

The speaker does **not** want a lecture containing a string of technical terms, an installation walkthrough, a line-by-line YAML presentation, speaker notes, or merely pretty 3D art. He **does** want to communicate accurate **mental models**: use ordinary words first, introduce the real technical name, then show the actual tensor, index, cache, scheduling decision or data transfer as geometry and motion. A visual aid is worthwhile even if simple; impressiveness is not an objective.

The preferred narrative is a **loose reconstruction of the problems the speaker encountered over ~six months**:

- Hearing local models were useful, trying Ollama, and wanting a model that could be trusted for coding and troubleshooting;
- Deciding what GPU would actually be useful and fitting models in VRAM;
- Discovering llama.cpp, GGUF variants, quantization, MoE CPU offload and memory settings;
- Needing more useful context and learning what KV cache/quantized KV do;
- Running more simultaneous coding agents and finding out about batching, prefix reuse, vLLM and SGLang;
- Trying to accelerate decode with MTP and external speculative drafters, including a substantial personal DSpark training detour;
- Finding specialized runtimes and genuinely different newer architectures such as Engram/PLE;
- Optionally showing a short glimpse of independent hosted nodes connected with LLM Collective.

**Do not force false chronology.** The experiments overlapped and the speaker moved back and forth among runtimes. The top-level question for the audience is: **"Which trade-offs would I make for the models, hardware, and workload I actually have?"** The answer is not automatically "biggest model", "fastest single stream" or "most VRAM free".

### First-person material, stated with appropriate scope

- The speaker perceived a useful quality jump with **Qwen3.6-27B** and later **Qwen3.8-27B**, especially sensible multi-step decisions, tool calls, web searches, debugging Kubernetes and remembering procedural actions like committing before pushing. These are personal impressions, **not controlled measurements** or an assertion that other models are incompetent. Release dates and precise model names should be checked before the public narration.
- Hosted frontier inference is very useful and the speaker uses subscriptions. Concerns about future pricing, quotas, oversubscription or an AI market correction are **his opinions and hypotheses**, not established predictions. Avoid stating that every provider sells every token below cost or secretly substituted a quantized model; no evidence is provided for such substitutions.
- The original **32 GB RTX 5090** decision: 24 GB seemed too cramped for desired models and useful context; the 128 GB NVIDIA DGX Spark was appealing on capacity, but the speaker needed inference **integrated with his Windows/WSL work laptop** (external GPU), not a separate standalone machine. Official on-device bandwidth specifications: RTX 5090 **1,792 GB/s** (32 GB GDDR7) and DGX Spark **273 GB/s** (128 GB unified LPDDR5x). **Both are manufacturer-rated bandwidth, not tokens/sec or a controlled head-to-head.** The eGPU host link is separate and much slower than VRAM bandwidth. He reports model loading into the GPU taking about **20 seconds** on his particular connection, and did not notice a major inference penalty after load. Treat that as an anecdote, not a benchmark.
- His client/work constraint: for relevant tasks, **data must remain on the Windows laptop**. Running a local eGPU can meet that goal subject to the rest of the software setup. **Using another person’s LLM Collective contributor does send that request to another machine** and is therefore a different privacy/compliance arrangement; never imply the shared gateway preserves on-laptop locality.
- Community-shared llama.cpp launch options and Reddit experiments nudged the speaker beyond Ollama. He tried llama.cpp and vLLM repeatedly; llama.cpp sometimes fit memory better, vLLM became attractive for more concurrency. Not universal verdicts.
- He tried Intel **AutoRound** for weight quantization and the **vllm-project/speculators** library for training a DSpark-style draft model. **LLM Compressor is distinct**; AutoRound output may use the LLM-Compressor-compatible format, and a separate Muse drafter quantization job explored LLM Compressor. Do not merge these tools.
- The user reports intriguing specialized results from **NInfer** (RTX 5090/Blackwell), **Radiance** (coworker’s AMD Radeon AI PRO R9700), and **Pennyroyal** (SGLang-derived). Claims that the runtimes were entirely AI-generated, universally faster, or equally portable are **not verified** and should not be asserted. Many kernels and runtime specializations are architecture-specific.
- He has only tried running a model on a Mac once; do not make him the Mac inference expert. Brief crowd invitation for Apple Silicon / MLX / oMLX experiences is welcome.
- He wants attendees to feel free to have different reasons for running models: fun, local control, privacy, independence, or simply technical curiosity. Avoid framing the opening as a sermon on why everyone must self-host.

### Research ledger / evidence labels

Every presentation claim should be tagged in development materials as one of:

- **MECHANISM** — sourced from a primary paper, model code, or current serving implementation.
- **MEASURED ON SPEAKER SYSTEM** — issue/run log/config and conditions are available; date and test conditions needed.
- **SPEAKER OBSERVATION** — speaker recollection; no replicable benchmark yet.
- **MANUFACTURER SPEC** — rated maximum hardware spec, not sustained performance.
- **HYPOTHESIS / OPINION** — economic forecast, inferred cause, subjective preference.
- **SYNTHETIC DEMO** — designed input and toy parameters, openly labeled.
- **OPEN / VERSION-DEPENDENT** — mechanism or flag not confirmed for pinned engine version.

Never turn a plan/issue proposal into a completed production deployment, and never invent numbers to make a chart compelling.

---

## 1. Proposed 30-minute sequence — 8 navigable chapters, not a fixed slide list

| Part | Section / human problem | Budget | Core takeaway | Core scene IDs |
|---|---|---:|---|---|
| 00 | **Why bother? I wanted a local model I could use for real work** | 2 min | Firsthand motivation rather than a cloud-vs-local ideology | A01–A02 |
| 01 | **Will it fit? Which GPU, model and architecture?** | 5 min | Capacity is necessary but bandwidth, quant and hot memory matter | B01–B05 |
| 02 | **It fits, but where does the conversation go?** | 5 min | Weights, contextual vectors and KV are different quantities | C01–C05 |
| 03 | **Can several agents use it?** | 6 min | Batching, prefix sharing and cache eviction shape real service quality | D01–D05 |
| 04 | **Can I make next-token generation faster?** | 7 min | Drafting/verification trades VRAM and work for fewer target passes | E01–E06 |
| 05 | **What else is happening now?** | 4 min | Specialization and learned n-gram memory add new design choices | F01–F04 |
| 06 | **What if other people want to use it too?** | 1 min | Independent endpoints can be routed by a gateway without a VPN | G01 |
| 07 | **Closing / audience discussion** | spare | No best universal setup; ask who uses what | A03 |

This is very ambitious: **roughly 30 core/optional scene briefs exist below, but only a curated subset should play live**. The scene library is bigger than the talk on purpose. Present 2–3 deep dives and fast-pass the rest. A fallback **~20-minute route** should use A01, B01, B03, C02, C04, D01, D03, E01, E03, F01, G01 with transitions.

### Chapter 00 — Why bother?

**Audience question:** "With excellent hosted models and subscriptions, why would you bother running local ones?"

Subpoints:

1. Concise audience check: "Who here has run Ollama or LM Studio?" This sets 201-level assumptions without a tutorial.
2. One real initial motivation: people were saying local coding models were finally capable; speaker tried it; agent behavior became useful enough for web lookups, Kubernetes investigation and editing code. A **good decision** is more meaningful than raw tokens/sec.
3. Reasons differ: fun, control of one’s hardware, client data locality, optionality if hosted pricing/limits change, working across different model families and tool protocols.
4. Hosted frontier models remain valuable. If discussing subscription economics, qualify it as personal speculation; do not allege unpublished provider quantization/routing or promise a market crash.
5. Set a clear scope: what model weights are, how inference differs from training, what an inference engine does. Ollama/LM Studio provide onboarding and APIs; llama.cpp/vLLM/SGLang are engines/runtime ecosystems, **GGUF is a container/model format**.
6. Explain the format of the presentation: a collection of engineering findings in approximate discovery order, with real launch settings and a visual explanation when useful; not a glossary dump.

**Transition:** "Once I decided I wanted it on my own machine, the first challenge wasn't AI philosophy. It was memory."

### Chapter 01 — Will it fit?

1. The 24 GB vs 32 GB purchase. RTX 5090 eGPU vs DGX Spark 128 GB unified memory; bandwidth and integrated Windows/WSL deployment mattered. **Do not claim DGX Spark is globally slower**; capacity may enable a model the 5090 cannot hold.
2. Distinguish **GPU VRAM**, **CPU DRAM**, **external interconnect/PCIe/TB**, **NVMe**, and their separate capacity/bandwidth/latency.
3. A model is trained into **weight tensors**. Inference uses those fixed tensors to generate a probability distribution for the next token; prompts are not additional learned weights.
4. Total parameter count vs active parameters. Dense FFNs usually use all their parameters per token; a **mixture-of-experts (MoE)** layer computes a router and selected expert FFNs. In **35B-A3B**, **35B** is approximate total parameters and **A3B** approximately **3B active per token** in the model card’s definition; it is not a 3B model and all 35B weights must be stored/accessible somewhere.
5. **GGUF** can carry FP16/BF16 and many quantized tensor types; not intrinsically "always smaller". Community GGUF repositories often publish numerous Q2/Q3/Q4/Q5/Q6/Q8 variants; exact packing and tensors not always equal the headline bitwidth. Compare with safetensors/compressed-tensors checkpoint formats, which can also be quantized.
6. llama.cpp as the speaker’s early playground: GPU offload knobs, context size, tensor overrides, CPU placement of MoE experts. **CPU offload can make otherwise unfittable models possible, but moves data/compute to a lower-bandwidth tier**; CPU and GPU experts do not necessarily run at the same speed.
7. The model should ideally remain GPU-resident for the speaker's high-speed goals, **but leave space for KV, draft state, activations and engine overhead**. Strict "all in VRAM" is a preference for this workload, not a law of local inference.
8. WSL memory/loading anecdote: distinguish safetensors loader I/O, Linux page cache, the WSL VM’s host-visible accounting, GPU VRAM and the Thunderbolt link. Do not blame a specific crash on page cache without logs; [home-k8s issue #48](https://github.com/dbirks/home-k8s/issues/48) documents a **separate** WSL RTX 5090 eGPU crash investigation with multiple possible causes.
9. Practical flag reveal (validate pinned version before copy/paste): llama.cpp \`-m model.gguf\`, \`-c\` context, \`-ngl\` GPU-layer offload, \`--cpu-moe\` and \`-ot\` tensor override, \`--moe-cache-mib\` hot-expert caching. vLLM \`--max-model-len\`, \`--gpu-memory-utilization\`, \`--quantization\` when relevant; don't show a flag for a quant that is autodetected from the checkpoint as though it is mandatory.

**Transition:** "I got it to load. Then I discovered that model weights weren't the only thing occupying the card."

### Chapter 02 — Where does the conversation go?

1. Weight matrix: many learned numbers. **Quantization** maps them onto fewer representable levels with suitable scales/grouping. Contrast high-precision matrix \`W\` with reconstructed \`Wq\`; show \`W·h\` changing to \`Wq·h\`. This is **not** directly quantizing a semantic cloud or chopping decimal places.
2. **INT4 W4A16**: eligible weights use an integer low-bit representation, while relevant activations remain 16-bit. **NVFP4** uses **E2M1 4-bit values**, FP8 E4M3 scales per **16-element block** and a second/global scale in NVIDIA’s microscaled scheme; native Blackwell kernels may accelerate eligible operations. W4A4 and W4A16 are distinct, and not every layer/head uses the same quant.
3. **AutoRound**: post-training quantization/calibration and optimizable rounding/scaling; use calibration outputs to reduce reconstruction error, then evaluate on **held-out** coding/tool tasks. Some sensitive layers must remain higher-precision; mixed precision is deliberate. **Quantization-aware training (QAT)** updates a model under simulated quantization during training; it is not identical to PTQ/AutoRound. Mention only if it clarifies a question.
4. The initial token **embedding** is selected from a lookup table; later **contextual hidden states** are recomputed layer by layer. The same "king" token in different contexts can yield different representations. Only earlier/current positions are visible in causal self-attention, barring model-specific masks. Avoid literal king/queen semantic geometry without real data and a labeled projection.
5. One transformer block: norm → Q/K/V projections → attention reads past K/V → residual → feed-forward → residual, repeated. Architectures vary: Gated DeltaNet, MoE and other hybrid layers cannot all be drawn as a classic attention block.
6. **Without KV cache**, naïve decoding reprocesses growing prefixes. Work grows **polynomially**, not exponentially. With KV, existing key/value vectors at attention layers are stored so each decode iteration can process only the next token’s projections/FFNs and **read** the old KV. The KV cache is **not a table of token IDs**.
7. KV precision choices: BF16/FP16, FP8, NVFP4 where backend/model/kernel support allows. Weight precision **does not set KV precision**. Hybrid model recurrent/Mamba state has separate dtype and checkpoint rules. Quantizing KV frees capacity at a potential accuracy cost; some kernels are unsupported or may be slower.
8. An actual speaker-deployment example from [home-k8s Qwen3.8 operating guide](https://github.com/dbirks/home-k8s/blob/main/.agents/skills/qwen38-27b-vllm/SKILL.md) documents changing one KV setup from **741,032 FP8-token pool** to **1,225,765 NVFP4-token pool**, helping prefix-retention under specific constraints. That is **configuration-specific**, not a universal FP8/NVFP4 capacity ratio or a guarantee of equal answer quality.
9. Flag snippets for context: vLLM \`--kv-cache-dtype\`, \`--enable-prefix-caching\`, \`--max-model-len\`, \`--max-num-seqs\`. llama.cpp \`-c\`, \`-ctk\`/\`-ctv\` (verify supported types), \`-np\` parallel slots. The exact syntax and semantics depend on engine version.

**Transition:** "The interesting problem changed when I wanted several agents running rather than one chat at a time."

### Chapter 03 — Can several agents use it?

1. **One loaded model with multiple sequences** differs from **multiple replicas**, and neither implies a distributed model across hosts. Duplicated model weights for separate replicas can dominate memory.
2. **Prefill:** many prompt positions processed together, large matrix multiplication, often higher Tensor Core arithmetic utilization. **Decode:** fewer new positions per sequence, repeated weight-tile traffic and KV reads, often bandwidth-bound at batch one. Batch size/context can change the bottleneck.
3. GPU cores: streaming multiprocessors schedule warps; **Tensor Cores** accelerate matrix-multiply tiles; memory bandwidth determines how quickly values arrive. Prefill/decode is not "cores versus memory" in an absolute sense: both always use both. A **roofline** view relates FLOPs per byte to sustained bandwidth and achievable arithmetic throughput.
4. **Continuous batching**: admitting/advancing active decode sequences alongside prefill work without forcing all requests to start/end at the same time. It can raise aggregate output tok/s but may change individual latency. Different kernels, prefix cache, scheduling/queueing and cache capacity matter.
5. **Prefix caching:** if request B begins with *the same tokenized initial sequence* as request A under compatible model settings and isolation salt, the server can reuse computed attention state rather than prefill it again. The user’s "50K Claude Code system prompt" was a **hypothetical illustration**. Different harnesses may serialize different tools/system prompts; any early mismatch stops ordinary exact prefix reuse at that point.
6. **vLLM** indexes full KV blocks with hashes chained to preceding blocks, reference counts, block-pool allocation and eviction. This can enable **actual physical shared blocks** across compatible active requests. Source: [vLLM prefix cache design](https://docs.vllm.ai/en/latest/design/prefix_caching/).
7. **SGLang RadixAttention** organizes common token prefixes as a **compressed radix tree**, with shared trunk and diverging branches. This is an index for previously computed state, not a different neural attention formula. Its **Unified Radix Cache** accommodates full-attention KV, sliding-window KV and recurrent checkpoints, each with different valid reuse boundaries. Source: [SGLang unified radix research](https://www.sglang.io/blog/unified-radix-cache).
8. **llama.cpp** offers prompt reuse in slots and optional RAM-backed cache; a unified KV **buffer** does **not** necessarily mean that three simultaneously active slots physically share one copy of identical prompt KV. Benchmark the exact build and cache modes rather than claiming parity with vLLM.
9. **Cache eviction under concurrent coding agents** can cause enormous time-to-first-token despite high decode tok/s. Useful metrics: cached input tokens / prefix hit ratio, preemption count, p50/p95 TTFT, queue time, total active/waiting requests, per-user and aggregate tokens/sec. Add cache retention and schedule-policy decisions (e.g. longest prefix match in SGLang) only when measured.
10. Multi-tenant security: block reuse can leak existence via timing unless cache is isolated appropriately; vLLM documents optional **cache_salt**. Never imply every gateway contributor shares KV: each machine/process has **its own** cache unless an explicit remote KV mechanism exists.

**Transition:** "Once the service was juggling agents, I started asking if I could make the expensive part—generating the next token—happen less often."

### Chapter 04 — Faster generation: speculative decoding

1. Target-only autoregressive generation generally needs another target iteration to produce each next token.
2. **Speculative decoding**: a cheaper drafting mechanism proposes candidate future tokens; the target **verifies many candidate positions together**; valid output is committed. At temperature 0 the explanation can show matching greedy results; stochastic decoding needs the **distribution-preserving acceptance/rejection procedure**, not just string equality. Correct implementations retain the target distribution, modulo numerical issues.
3. **Not every drafter is a separate model**: heuristic prompt n-gram matching, **native MTP heads**, and externally trained EAGLE/DFlash/DSpark networks are different possibilities. An external drafter consumes its own weights and workspaces; its overhead can reduce room for KV and hurt under concurrency.
4. **MTP**: native additional prediction modules/heads trained to look ahead. Depending on the target architecture, draft steps may have dependencies; don't draw a universal "K logits for free in one pass". Compare model checkpoint native MTP to an external pretrained draft.
5. **EAGLE-3**: feature-conditioned learned autoregressive drafter, a sequence of cheap draft steps. Tree candidates/verification are separate concepts.
6. **DFlash**: block-parallel draft predictions from anchors and masked positions in a single draft-forward step. Proposals can suffer from weak within-block dependencies; verification is still required.
7. **DSpark**: DFlash-family backbone plus low-rank **Markov head** influencing intra-block token dependence and a **confidence head** predicting per-position acceptance. Actual adaptive verification requires **runtime support**, not merely presence of head weights.
8. **DFlash2**: DFlash-derived architecture adding **local dynamic convolution** and a low-rank **candidate selector**; more than a cosmetic version number. The official Speculators documentation currently describes its training and serving as experimental and may require a full, unquantized target LM head. Check version/method compatibility and exact weighting before a runnable demo.
9. **Keep one consistent verifier timeline** across methods: proposals → target evaluation → accepted prefix/rejection/resampling. Show *accepted length*, *draft cost*, *target passes*, *memory occupancy* and *end-to-end tok/s* as distinct metrics.
10. **Creators publishing companion drafts:** verified examples include [Meta Muse-Glimmer-30B assistant/DFlash](https://huggingface.co/meta-models/Muse-Glimmer-30B-assistant), [Poolside Laguna S 2.1 DFlash](https://huggingface.co/poolside/Laguna-S-2.1-DFlash), and [Laguna XS 2.1 DFlash](https://huggingface.co/poolside/Laguna-XS-2.1-DFlash). Model and draft are generally separate artifacts even if released together. A companion does not imply every runtime supports it.
11. **Real DSpark training attempt** ([home-k8s #50](https://github.com/dbirks/home-k8s/issues/50), [#51](https://github.com/dbirks/home-k8s/issues/51), [#59](https://github.com/dbirks/home-k8s/issues/59), [#60](https://github.com/dbirks/home-k8s/issues/60), [#69](https://github.com/dbirks/home-k8s/issues/69), [#72](https://github.com/dbirks/home-k8s/issues/72), [#80](https://github.com/dbirks/home-k8s/issues/80)):
    - Generate target-model distributions and representative coding/agent trajectories; DeepSWE means the *datacurve multi-language benchmark*, not an unrelated DeepSWE-named model.
    - Extract verifier hidden states/targets; train a draft backbone/heads; convert checkpoint to the serving format; run an actual inference test.
    - Encountered rotary \`partial_rotary_factor\` mismatch, training/serving kernel and format issues, weak accepted length, overfitting, and flawed initial evaluation assumptions.
    - A training run processed roughly **546K rows over about 2d16h**, but teacher-forced metrics weren't the same as real model-serving improvement. Later a 215K-row **agentic** from-scratch test reported about **1.617 accepted length** vs ~**1.66** coding-only baseline. This single test **did not** show that adding agentic examples alone improves the served drafter. A different DFlash warm-started model reportedly performed better, with other factors changed. Don't present this as proof that warm-start always beats data quality for all models.
12. For a fast practical slide, use a **real, version-pinned** example such as a vLLM \`--speculative-config\` dict and name the matching drafter artifact; never claim that syntax works for all versions/models or that temperature/sampling correctness is a string-match test.

**Transition:** "Even after doing all that tuning, I kept running into new model architectures and engines that changed what 'fit' even means."

### Chapter 05 — Specialized engines and newer models

1. Some serving runtimes trade breadth/maintenance for optimization of **one GPU architecture, one model family or a few kernels**. Compare capability and compatibility, not just a cherry-picked single-stream tok/s.
2. **NInfer** on RTX 5090 / SM120 path: investigate which model, revision, quantization and speculative support were actually tested by the speaker; link [speaker's NInfer repo](https://github.com/dbirks/ninfer) as background. Don't claim native peak applies to all consumer Blackwell.
3. **Radiance** on an AMD Radeon AI PRO R9700, observed by a coworker, is a different software/hardware ecosystem, not a CUDA engine. Confirm benchmark conditions and project lineage before presenting an attribution or multiplier.
4. **Pennyroyal** is an SGLang-derived implementation and includes hardware-specific Qwen3.8-Flash-Next support, KV/HiCache choices and **NVMe-backed PLE**. Its unusual result must not be generalized to every generic SGLang deployment.
5. **New weight structures beyond dense/MoE:** DeepSeek's [Engram paper](https://arxiv.org/abs/2601.07372) in January 2026 introduced learned conditional memory through fast hashed n-gram lookup; [DeepSeek-V4.1-Flash model card](https://huggingface.co/deepseek-ai/DeepSeek-V4.1-Flash) explicitly documents a huge **196B Engram** table in a shipped model. Qwen3.8-Flash-Next has a **separate related PLE** design and roughly **51B n-gram embedding parameters** ([model card](https://huggingface.co/Qwen/Qwen3.8-Flash-Next)). Different naming, implementations, hashing and fusion; do **not** imply literal code sharing or identical architecture.
6. **Engram/PLE is a learned static weight table**, not KV cache, RAG, a prompt-string n-gram speculative matcher or an MoE expert. For *each newly computed token position*, hash recent token IDs → gather a few learned table rows → transform/fuse features into the model computation. The **whole table is not reread once per chat session**. If earlier prefix computation is reused, its lookup work is already included in that reuse; new positions still require lookups.
7. **Pennyroyal case study:** the speaker's [home-k8s issue #135](https://github.com/dbirks/home-k8s/issues/135) and [manifest](https://github.com/dbirks/home-k8s/blob/main/apps/pennyroyal-flashnext.yaml) document approximately **47.68 GiB FP8 PLE rows on NVMe**, addressed by a specialized backend with bounded staging instead of pinning them all in ~46 GB available host RAM. This is **not** ordinary full MoE expert weights streamed from disk per token.
8. CPUs and unified-memory Macs: use bandwidth as **one** indicator, not prediction of tok/s; Apple kernels, GPU/ANE behavior, model format, memory bandwidth and framework compatibility all vary. Speaker can invite people familiar with [MLX](https://github.com/ml-explore/mlx), [MLX-LM](https://github.com/ml-explore/mlx-lm), or oMLX to share lessons.

**Transition:** "That's been useful for me. What if we want coworkers to use models without everyone buying the same hardware?"

### Chapter 06 — LLM Collective: optional brief preview

**Verified against the actual private implementation as of this research pass. Keep the public talk abstract; do not expose keys, private model catalog, client addresses, traffic content or internal deployment details.**

- **Actual topology:** an **independently hosted inference server** (OpenAI-compatible or supported Anthropic-compatible) runs on a contributor’s machine; a **small Go contributor client** configured with a local YAML backend map starts a persistent **outbound authenticated WebSocket** toward a **Go gateway in Kubernetes**. No inbound home router port or shared VPN membership is required.
- **Actual transport:** **TLS → WebSocket → WebSocket-as-net.Conn → HashiCorp Yamux session → separate multiplexed streams, each carrying ordinary HTTP**. "Reverse, outbound-initiated application tunnel" is a fair description. It is **not** a general-purpose VPN, TCP port forward, pooled VRAM or shared inference kernel.
- **Authentication/routing:** contributor identity uses an **Ed25519 challenge/response**, and gateway clients use their own API authentication. The configured backend **name** is resolved locally by the contributor to an allowlisted destination. The gateway resolves public model ID → connected contributor/backend → real local model and streams the response back. A model-list endpoint aggregates the contributed catalog; streaming requests pass back through the open connection.
- **No assumption of joining remote KV caches**: each provider independently loads a whole model and maintains its own memory/cache. Routing to a different model host also changes the model and potentially the privacy boundary.
- **Security:** no private authentication material in talk assets. One connection supports many concurrent HTTP streams but does **not** mean arbitrary Internet callers can scan the contributor's LAN; the implementation constrains routes and local backend resolution.
- **Public-safe one-minute story:** "I wanted a way for people who enjoy hosting models to contribute capacity, and for people who don't want to buy hardware to still use those endpoints. Each machine calls out to a gateway, so we don't have to install a VPN or expose every person's home inference port."
- **Source for authorized implementers:** connected GitHub repo e-gineering/llm-collective (private), README; internal/contributor/app/app.go; internal/contributor/proxy/proxy.go; internal/gateway/app/connect.go; internal/gateway/inference/handler.go; internal/tunnel/session.go. **Do not copy private files, URLs, credentials or operational data into this public talk repo.**

---

## 2. The visualization production contract

Each concept should be built to **communicate a correct mechanism in the 3D scene itself**, not rely on a page of explanatory text.

### Required learning ladder for each scene

1. **Everyday description:** "We reuse the calculations for identical earlier tokens."
2. **Actual name:** "Automatic prefix caching."
3. **Objects and mechanism:** show specific token IDs, KV page references, hashes or radix nodes, the reused blocks, and what still gets recomputed.
4. **Operational implication:** "This can make a repeated 50K-token prefix fast, but only while it is retained and still matches exactly."
5. **One caveat:** "Different tool definitions or a different model break the match."

This is **plain language without hand-wavy metaphors**. Real computations and data structures are the objects. A CPU/GPU panel can be simplified without replacing it with apples, an imaginary factory or an inaccurate semantic globe.

### Three versions for **every** scene — the downstream agent's workflow

For each scene ID, implement **three observable design iterations**, not merely one pretty result:

- **V1 — skeletal truth:** simplest possible geometry conveying one real invariant. Neutral camera, 2–3 states, one label per tensor/operation, no decorative motion. Demonstrate it to another engineer. Capture a screenshot/short screen recording and a one-sentence takeaway.
- **V2 — spatial mechanism:** add the real dependency/data movement, time scrubber and meaningful interaction; expose one deliberately tricky case (eviction, rejected draft, quantization error, partial prefix). Cite the data structures and check source alignment. Capture evidence.
- **V3 — stage-ready:** legible 16:9, existing sage/pixel 3D design language, camera transition, clear 15-second autoplay/step path, keyboard reset/skip and optional deeper mode. Maintain the exact invariant from V1; if a stylistic effect obscures the math, roll it back. Capture evidence.

**Accept V1 only if a viewer can answer "what changed and why" without the narrator.** Do not start V3 until the source-backed mechanism works in V1/V2. Keep V1/V2 available for comparing trade-offs; do not overwrite them without a recorded acceptance decision.

### Visual annotation standards

- A geometry must encode **exactly one declared thing** (e.g. a tile = an 8-bit quantized value; a block = 16 token positions; an edge = a hash/prefix relationship; an arrow = bytes transferred). Reuse a consistent visual grammar across scenes.
- Every number shown must have units and an origin: **measured / manufacturer spec / simulated / toy illustrative**. No inferred tokens/sec from memory bandwidth.
- Label axes clearly. High-dimensional embeddings shown in 3D are **toy projections**, never literal human-interpretable coordinates of arbitrary LLM hidden states.
- Use consistent camera anchors: weights left/below, active compute center, per-request state right, slower tiers farther away; but prioritize accuracy over a rigid visual metaphor.
- Distinguish **static weights**, **dynamic KV/recurrent state**, **active input tokens**, **draft tokens**, **accepted output tokens**, and **external network requests** through labels + stable outlines/patterns, not color alone.
- The presenter needs **jump-to-scene**, single-step, autoplay, scrub, orbit, reset, pause, optional callout and clear "back to question" navigation. No requirement to show a complete config screen at all times.
- All scene controls must work. A decorative slider that doesn't recompute the pictured state is not acceptable.
- Default states should use 4–16 tokens and small toy matrices for legibility; optionally transition to real scale by zooming out with explicit scale labels. Do **not** draw literal billions of independent blocks.
- When contrasting methods, hold underlying **target model, prompt positions, sample policy, cache budget and GPU** constant, unless the contrast itself is about changing one of these quantities.

### Engine/runtime source hygiene

The implementation repo currently contains experimental builders under src/scenes/builders and scene-lab page definitions under src/slides/scene-lab; the current src/slides/talk content is **not an approved final lineup**. **Inspect the live files first**, reuse rendering infrastructure and established styles, and avoid overwriting existing visual experiments or silently changing presentation order. Run pnpm build and interactive smoke tests; record what was tested.

Every implemented scene gets metadata:

~~~yaml
id: C03
chapter: 02
claim: "KV stores contextual attention keys and values, not raw token IDs"
confidence: MECHANISM
source_urls:
  - https://docs.vllm.ai/en/latest/design/prefix_caching/
runtime_examples:
  - engine: vllm
    pinned_version: TO_VERIFY
math_mode: schematic
geometry_contract: "Each block is a layer-specific K/V tensor for one token position"
states: [cold-prefill, first-decode, second-decode, cached-prefix]
v1: minimal-truth
v2: temporal-dependencies
v3: stage-ready-interactive
acceptance_checks:
  - "Old K/V is read during decode, never recomputed in the cached path"
  - "No number shown as measured unless sourced"
~~~

**Source rule:** Source URLs are part of the saved scene metadata and reviewer handoff. A link to a model card describes the model, **not proof** that a selected engine/kernel runs it on the presenter’s GPU. Validate runnable CLI examples in a pinned version.

---

## 3. Detailed visual scene library, including the three iteration designs

The IDs are *stable conceptual IDs* for agent handoff. They are not existing code symbols and they do **not** imply a mandatory slide order.

### A01 — "Why bother?" One real agent workflow

**Claim:** local model capability matters only when it does useful work.  
**Mechanism:** user prompt → model logits/next action → tool call → result → next model decision. Do not pretend tool execution happens inside the model weights.  
**V1:** one honest swimlane: local inference endpoint, calling agent, tools, real sequence of decisions. Use a sanitized actual trace if supplied; otherwise a conspicuously synthetic example.  
**V2:** show the model receiving a tool result and making the next choice; mark where a previously unreliable local model needed reminders (only if speaker supplies comparison).  
**V3:** 12-second actual coding/Kubernetes example with only 3–4 turns, zoom onto the decision points; no confidence percentage or benchmark fabricated.  
**Avoid:** implying the model has unrestricted access or that "remembering to commit" proves a specific post-training algorithm.

### A02 — training creates weights; inference uses them

**Claim:** a serving engine loads learned weights and uses them repeatedly; inference isn't training.  
**Mechanism:** offline gradient optimization yields fixed tensors; inference uses those tensors to map token sequences to next-token distributions.  
**V1:** pre-trained weight tensors as persistent matrix blocks, incoming token sequence, output logits.  
**V2:** show no weight updates during normal inference; prefill/decode use same fixed matrices.  
**V3:** reveal GGUF/safetensors as formats of the saved artifact, separate engine choices (llama.cpp/vLLM/SGLang) as different execution pipelines.  
**Avoid:** depicting a training process as downloading public web text every time the user asks a question.

### A03 — audience check / outro

**Claim:** no single best local setup; demand a workload-specific answer.  
**V1:** one concise "What are you running?" card.  
**V2:** toggle profiles (coding agent, offline/privacy, cheap chat, long context) and show which metrics would change.  
**V3:** optional audience poll / recap without hardcoded "winner" ranking.  
**Avoid:** unverified Mac comparisons; invite MLX/oMLX experience.

### B01 — the GPU buying decision: capacity vs bandwidth vs integration

**Claim:** DGX Spark and RTX 5090 solve different constraints.  
**V1:** two memory containers labeled **128 GB / 273 GB/s rated** and **32 GB / 1,792 GB/s rated**; no tokens/sec.  
**V2:** drag a model + KV budget into each. A target requiring 40 GB resident does not fit the 5090 regardless of HBM speed. A target under 32 GB can benefit from fast GDDR7 if kernels keep it resident.  
**V3:** insert a Windows/WSL laptop, a Thunderbolt/eGPU link, and a distinct host-transfer pipe. Show the speaker's **observed ~20s load** as anecdote; distinguish startup transfer from decode-local GPU reads.  
**Accuracy:** don't compute the ratio and call it model speedup; unified-memory GPU and standalone platform are architecturally different.  
**Sources:** NVIDIA [5090](https://www.nvidia.com/en-us/geforce/graphics-cards/50-series/rtx-5090/) and [DGX Spark](https://docs.nvidia.com/dgx/dgx-spark/hardware.html).

### B02 — the memory hierarchy: local GPU vs CPU vs eGPU link vs NVMe

**Claim:** size, bandwidth and latency are separate constraints.  
**V1:** three clearly labeled tiers of capacity; pipes are measured bandwidth **only if** benchmark method labeled.  
**V2:** change access pattern: sequential large matrix tiles vs many small random PLE row fetches; distinguish PCIe/TB staging from GPU GDDR.  
**V3:** interactive source switch: manufacturer peak, sourced STREAM/CUDA/fio measurements, actual measured inference; don't mix those values on one apparently comparable scale.  
**Accuracy:** RAM channel count determines DDR bandwidth, disk Q-depth matters, eGPU does not constrain all local VRAM reads to Thunderbolt speed.  
**Sources:** earlier README bandwidth research; NVIDIA specs; actual speaker tests to be gathered.

### B03 — what fits? Dense vs MoE / 35B-A3B

**Claim:** total parameters and active parameters are not the same.  
**V1:** dense FFN processes each token with all FFN blocks; MoE token chooses top-K expert FFNs via router.  
**V2:** show 35B stored weight footprint while ~3B active for one token, plus shared always-active tensors; route token B through different experts.  
**V3:** toggle batch size: across requests many distinct experts may be active; storage capacity does not collapse to the per-token active count.  
**Accuracy:** different MoE variants have shared experts, different top-K per layer and attention patterns; get exact model card before setting numerical counts.

### B04 — CPU offload of MoE experts

**Claim:** put cold/selected expert weights in CPU memory to fit more, trading traffic and compute location.  
**V1:** attention/router/shared components on GPU; some expert weights in CPU RAM.  
**V2:** selected token requests one CPU-hosted expert; show actual compute-on-CPU or copy-to-GPU branch, explicitly **engine dependent**.  
**V3:** toggle GPU expert hot cache and limited PCIe bandwidth, visualize cache hits and misses; observe why performance varies.  
**Accuracy:** do not confuse this with PLE's single-row hash lookups; no claim that all MoE experts are "unused" when offloaded.  
**Sources:** [llama.cpp MoE cache documentation](https://github.com/ggml-org/llama.cpp/blob/master/docs/moe-cache.md), [server flags](https://github.com/ggml-org/llama.cpp/blob/master/tools/server/README.md).

### B05 — GGUF and model choice without the format myth

**Claim:** a file format is not a quantization scheme.  
**V1:** one conceptual FP16 matrix packaged as GGUF; switch to Q4_K_M GGUF and show the reduced storage **because of the tensor quantization**, not the extension.  
**V2:** put the same semantic weight matrix into safetensors/compressed-tensors with a different scheme, including INT4/NVFP4.  
**V3:** "choose an artifact" grid with file format, quant type, compatible engines/kernels, memory footprint and model capability. Check per-model compatibility.  
**Accuracy:** avoid blanket "GGUF is always more compressed"; some checkpoints are mixed precision with different attention/vision/expert exceptions.  
**Sources:** [llama.cpp models](https://github.com/ggml-org/llama.cpp/blob/master/docs/models.md) and [tensor schemes](https://github.com/ggml-org/llama.cpp/wiki/Tensor-Encoding-Schemes).

### C01 — quantization: learned matrix changes the output vector

**Claim:** reducing precision of *weights* perturbs the *computed activations*.  
**V1:** 4×4 example \`W\`, input \`h\`, and computed \`y=W·h\`. Quantize each weight into a scaled set of 16 INT code levels, recompute \`yq\` and show the actual difference.  
**V2:** modify per-group scales/rounding and watch reconstruction error \`|yq-y|\`; add a second calibration input and observe trade-offs.  
**V3:** 3D **projected** output arrow shift with a numeric sidebar containing the original matrix and quantized matrix. Include reversible reveal of unchanged initial embedding vs changed contextual hidden result.  
**Accuracy:** no rounding "ten decimal places to four decimals", no semantic direction claim; scheme is integer + scales, real models use high dimensional matrices.  
**Sources:** [Intel AutoRound](https://github.com/intel/auto-round), [NVIDIA NVFP4](https://docs.nvidia.com/deeplearning/transformer-engine/features/low_precision_training/nvfp4/nvfp4.html).

### C02 — FP16 / INT4 / NVFP4 under a magnifying glass

**Claim:** the code values and metadata differ; 4-bit isn't a universal mathematical object.  
**V1:** show 16 signed INT4 possibilities in a scaled group; show one float approximated to the closest representable value.  
**V2:** switch to FP4 **E2M1** sign/exponent/fraction; a **16-element** block carries its FP8 E4M3 scale and tensor-scale metadata; visualize exception tensors kept BF16.  
**V3:** compatible GPU selector reveals kernels/operations supported on the selected architecture and the memory freed. Separate weight W4A16 vs eligible W4A4 activations.  
**Accuracy:** FP4 values + scales are not exactly "4 bits per original parameter" in total storage; don't conflate weight NVFP4 with KV NVFP4.

### C03 — AutoRound, calibration and selective precision

**Claim:** quantization quality is an engineering choice, not random rounding and hope.  
**V1:** BF16 baseline → low-bit estimate → quantized block output → comparison with original.  
**V2:** feed representative calibration examples; optimize weight rounding/scaling to reduce block reconstruction loss. Show a **separate held-out eval** not used for the calibration loop.  
**V3:** toggle one sensitive layer/head kept BF16; show weight footprint and example output error change. Refer to the speaker's real Qwen3.8 AutoRound exceptions: recurrence-control projections, vision tower, MTP head.  
**Accuracy:** QAT is a separate training approach; AutoRound is primarily a post-training quantization tool; optimization error is not equal to coding benchmark pass rate.  
**Sources:** [AutoRound guide](https://github.com/intel/auto-round/blob/main/docs/step_by_step.md), [home-k8s quant recipe](https://github.com/dbirks/home-k8s/blob/main/apps/qwen38-upload.yaml.hold).

### C04 — what actually happens in a forward pass

**Claim:** learned matrices are repeatedly applied to new hidden-state positions.  
**V1:** token IDs → initial embedding → one layer's attention + FFN → output logits; use arrows for data dependencies.  
**V2:** display residual vector across layers, Q/K/V projections, reads from prior KV, FFN matrix tile loads from **resident VRAM**, no per-token SSD checkpoint download.  
**V3:** open "dense / MoE / Gated DeltaNet hybrid" variants with the correct layer-specific architecture. Show model weights stored in VRAM vs bytes accessed in local execution caches.  
**Accuracy:** do not suggest one giant physical copy of the model is transferred per token; do not show all layers processing the same token independently in parallel.

### C05 — without KV versus with KV / quantized KV

**Claim:** KV stores contextual attention keys/values, preventing redundant work on earlier token positions.  
**V1:** four input tokens and three generated tokens; no-cache path repeatedly recomputes old positions; KV path saves computed K/V and processes only the new position on each decode.  
**V2:** two layer-specific K/V matrices and an attention query; read old K/V, append the new ones, allocate cache pages. One exact vector/token example to prove KV isn't token-ID storage.  
**V3:** BF16→FP8→NVFP4 KV control shows decreased bytes/token where supported, plus possible numeric error and added context capacity. Hybrid models show Mamba state instead of pretending every layer has K/V.  
**Accuracy:** naive no-KV recomputation grows polynomially, **not exponentially**. Changing KV precision is independent of changing weight precision.  
**Sources:** [PagedAttention paper](https://arxiv.org/abs/2309.06180), [vLLM KV quantization](https://docs.vllm.ai/en/latest/features/quantization/quantized_kvcache/).

### D01 — prefill and decode are different workloads

**Claim:** prefill uses weight tiles across many token positions; batch-one decode has much less arithmetic per weight fetch.  
**V1:** same matrix, left applied to 1,024 prompt vectors, right applied to one new token vector.  
**V2:** visualize weight reuse in large GEMM versus small GEMV, with existing KV reads visible during decode.  
**V3:** sliders for batch size and context length move a calculated arithmetic-intensity point; cache hits and differing attention algorithm can shift which work dominates.  
**Accuracy:** prefill often compute-bound, decode often bandwidth-bound at low batch, never absolute. No assertion that cores "turn off" during decode.  
**Sources:** [NVIDIA roofline explanation](https://developer.nvidia.com/blog/co-designing-ai-model-attention-for-fast-interactive-long-context-inference).

### D02 — GPU roofline and the concurrency trade

**Claim:** each workload has its own operations/byte; tensor compute and memory throughput jointly limit speed.  
**V1:** slope \`BW × I\` plus plateau \`P_peak\`; show where illustrative single-stream decode and long prefill lie.  
**V2:** drag batch size and precision to move points; graph is **derived illustrative**, not measured tokens/sec.  
**V3:** explain why request batching raises throughput but may increase queue time, active K/V and memory pressure. Put TTFT, ITL, aggregate tok/s in separate meters.  
**Accuracy:** don't infer exact throughput from peak GPU bandwidth. Label whether hardware BW is manufacturer spec or sustained benchmark.

### D03 — three coding agents share an identical prefix

**Claim:** repeated exact initial tokens can reuse computed state.  
**V1:** three requests share prefix **S** then diverge A/B/C; show the shared K/V only once in a compatible same-process cache.  
**V2:** inject one changed tool schema or date early in request B, and see the eligible longest common prefix shrink.  
**V3:** 50K-token **toy** prompt tree with metrics: cached tokens, recomputed tokens, retained memory, warm/cold TTFT. Show what happens if all blocks are evicted.  
**Accuracy:** 50K is illustrative; don't claim all coding harness system prompts really match, nor that two independent model hosts share cache.  
**Source:** [vLLM APC](https://docs.vllm.ai/en/latest/design/prefix_caching/).

### D04 — vLLM hash blocks vs SGLang radix tree vs llama.cpp slots

**Claim:** three implementations solve prompt reuse differently.  
**V1:** exact same three toy prompts in side-by-side data structures: linked hashed vLLM blocks; SGLang compressed radix edges; llama.cpp slot state.  
**V2:** play a repeat request, branching request and eviction. Show vLLM block refcounts, SGLang shared trunk and independent branches; llama.cpp slot restore without assuming physical deduplication.  
**V3:** switch a full-attention model to hybrid Mamba/sliding attention. Add Mamba checkpoint boundary and sliding-window validity in the SGLang variant; indicate engine-specific handling rather than imposing standard KV on all layers.  
**Accuracy:** RadixAttention is **cache indexing**, not a new attention equation; a speculative-candidate tree is a different tree.  
**Sources:** [vLLM APC](https://docs.vllm.ai/en/latest/design/prefix_caching/), [SGLang Unified Radix](https://www.sglang.io/blog/unified-radix-cache), [llama.cpp server](https://github.com/ggml-org/llama.cpp/blob/master/tools/server/README.md).

### D05 — a prefix cache being crowded out

**Claim:** a model can fit, yet several long-lived agents thrash its cache.  
**V1:** fixed VRAM slab and two alternating prompts; cached prefixes remain until capacity needed.  
**V2:** increase agents and long-prefix working set until the older prefixes are evicted; repeated prefill raises TTFT.  
**V3:** toggle KV FP8/NVFP4 and a drafter; one configuration retains a usable working set, another improves single stream but loses reuse. Present the speaker's **actual measured pool sizes** with setup-specific attribution or otherwise label synthetic.  
**Accuracy:** concurrent-agent support ≠ full max context per request; don't promise a large cache eliminates all queueing.  
**Source:** [home-k8s vLLM operating notes](https://github.com/dbirks/home-k8s/blob/main/.agents/skills/qwen38-27b-vllm/SKILL.md).

### E01 — target-only versus draft-and-verify

**Claim:** speculative decoding can reduce sequential expensive target passes, at a price.  
**V1:** target produces one token per iteration; alternative drafter proposes four candidates, target verifies positions together, accepted prefix advances.  
**V2:** show a mismatch at proposal 3: only valid prefix retained, later dependent proposals invalidated; then show stochastic acceptance/residual correction in a non-greedy mode.  
**V3:** vary draft cost, acceptance and batch size; count verifier passes separately from actual elapsed time. If the drafter is too slow, the animation must allow a net regression.  
**Accuracy:** "exact" sampling isn't just string matching, and raw accepted tokens are not equal to throughput multiplier.  
**Source:** [vLLM speculation](https://docs.vllm.ai/en/latest/features/speculative_decoding/).

### E02 — native MTP versus EAGLE-3

**Claim:** lookahead mechanisms have distinct sources of extra prediction.  
**V1:** MTP heads attached to target; EAGLE-3 an external lightweight feature-conditioned autoregressive draft.  
**V2:** show EAGLE-3 successive draft steps versus MTP’s architecture-dependent future heads and dependency mask.  
**V3:** toggle a target with/without native MTP support and expose extra memory/residency trade. No manufactured acceleration values.  
**Accuracy:** native MTP is not a free arbitrary-number-of-tokens output; don't treat every model’s MTP layout as identical.  
**Sources:** [Speculators decision guide](https://docs.vllm.ai/projects/speculators/en/latest/user_guide/algorithms/decision_guide/).

### E03 — DFlash, DSpark and DFlash2 in one verifier timeline

**Claim:** three different ways of improving a block-parallel drafter.  
**V1:** DFlash uses a learned parallel block of masked positions proposed from target features/anchors.  
**V2:** DSpark adds a Markov bias making position proposals depend on preceding draft token and a confidence prediction; DFlash2 adds local dynamic convolution plus a candidate selector/reranker. Visualize these as **different computations**, not labels on the same algorithm.  
**V3:** same verifier accepts/rejects candidate outputs; show a confidence-based adaptive-verify mode only if serving runtime supports it, and an "experimental/unsupported" state when it does not.  
**Accuracy:** DFlash2 is not DSpark v2; model/drafter vocabulary/logit-head constraints may differ, and DFlash2 tooling remains experimental.  
**Sources:** [DFlash2](https://docs.vllm.ai/projects/speculators/en/latest/user_guide/algorithms/dflash2/), [DSpark](https://docs.vllm.ai/projects/speculators/en/latest/user_guide/algorithms/dspark/).

### E04 — the drafter is a resident memory consumer

**Claim:** some speculative methods buy speed with VRAM that could otherwise retain KV or host another model.  
**V1:** target weights + KV + runtime on one 32 GB/96 GB slab, then add separately trained draft weights/state and show subtraction from free pool.  
**V2:** run a timeline target-only vs draft+verify, with acceptance linked to target pass count.  
**V3:** concurrent agent mode shows how a drafter might improve decode but worsen prefix retention or admission. Use measured inputs or prominent simulated labels.  
**Accuracy:** n-gram heuristic drafting may add no comparable separate neural weights; native MTP and external drafts differ.

### E05 — actual DSpark drafter training

**Claim:** engineering a useful drafter involves data provenance, compatible hidden states, correct training, and **valid serving evaluation**.  
**V1:** coding-agent trajectories → target rollouts → verifier hidden states/soft targets → train small draft → checkpoint → vLLM serve.  
**V2:** two synchronized paths: teacher-forced training (ground-truth previous token) vs free-running inference (self-generated previous token). First prediction mistake causes later candidates to drift; acceptance collapses. Add RoPE mismatch as a separately labeled *actual debugging incident*.  
**V3:** retrospective timeline based on home-k8s issues with only verified milestones/numbers and a test-set source legend. Show "more agentic data alone didn't fix this experiment" rather than a falsely triumphant training demo.  
**Accuracy:** no invented result or claim that every DSpark training run requires a fixed number of on-policy samples. **AutoRound is not this trainer**.  
**Sources:** [home-k8s #59](https://github.com/dbirks/home-k8s/issues/59), [#60](https://github.com/dbirks/home-k8s/issues/60), [#72](https://github.com/dbirks/home-k8s/issues/72), [#80](https://github.com/dbirks/home-k8s/issues/80), [Speculators training guide](https://docs.vllm.ai/projects/speculators/en/latest/user_guide/tutorials/train/).

### E06 — creators ship main-model and companion-draft bundles

**Claim:** the main model may be released alongside separately trained, matched draft weights.  
**V1:** model artifact + tokenizer/template + optional draft artifact; draw memory consumed by both.  
**V2:** concrete examples Muse Glimmer 30B and Poolside Laguna S/XS 2.1, linked to official model cards.  
**V3:** engine selection checks compatibility; show supported version and appropriate launch options, **without** promising every released drafter works unchanged with any quant.  
**Accuracy:** downloading main model does not always automatically install compatible drafter; MTP may instead be part of target checkpoint.  
**Sources:** [Meta collection](https://huggingface.co/collections/meta-models/muse-glimmer), [Laguna S 2.1](https://huggingface.co/poolside/Laguna-S-2.1), [Laguna S DFlash](https://huggingface.co/poolside/Laguna-S-2.1-DFlash).

### F01 — specialized inference engine support map

**Claim:** the fastest engine on one GPU/model may not be fastest or even compatible elsewhere.  
**V1:** rows = GPU architectures, columns = model/quantization families, mark documented compatibility (not "winner").  
**V2:** add supported engines: llama.cpp, vLLM, SGLang, NInfer, Radiance, Pennyroyal. Highlight the matched narrow kernel path; missing cells mean unknown/unsupported, not "slow".  
**V3:** layer sourced same-workload benchmark points and explicit conditions (batch, context, target revision, quant, test tool). Include a "community specialized runtime" vignette about iteration, not unverified claims of autonomous AI writing it all.  
**Accuracy:** AMD Radiance is not CUDA; NInfer support is architecture/model specific; no universal ranking.  
**Sources:** [dbirks/ninfer](https://github.com/dbirks/ninfer), [Pennyroyal runtime](https://github.com/jpezzulli/sglang-rtxpro6000), [home-k8s issue #135](https://github.com/dbirks/home-k8s/issues/135).

### F02 — DeepSeek Engram: n-gram hash → learned row lookup

**Claim:** large learned conditional-memory tables grow parameter capacity without running an MLP over all rows.  
**V1:** token IDs of recent positions form n-gram windows; deterministic hash maps to table row indices; only selected learned embedding rows are gathered and fused.  
**V2:** show multiple hashes, address collisions in toy table, context-dependent gating/fusion, and separate large static table vs dynamic KV.  
**V3:** exact DeepSeek V4.1 profile, table sharding/host prefetch if versioned, optional comparison with its original January Engram paper/demo. **The table is accessed for newly processed positions in prefill and decode, not once at session start**.  
**Accuracy:** DeepSeek V4.1's Engram memory is not RAG, not MoE MLP experts, not speculative n-gram reuse, not KV cache.  
**Sources:** [Engram paper](https://arxiv.org/abs/2601.07372), [official code](https://github.com/deepseek-ai/Engram), [DeepSeek V4.1 card](https://huggingface.co/deepseek-ai/DeepSeek-V4.1-Flash), [vLLM Engram feature](https://docs.vllm.ai/en/latest/features/engram/).

### F03 — Pennyroyal Qwen PLE on NVMe

**Claim:** a large n-gram *weight table* can be stored cold and accessed sparsely rather than pinning every row in host RAM or VRAM.  
**V1:** Qwen3.8-Flash-Next PLE static FP8 table (~47.68 GiB) on SSD; GPU model layers/KV remain separate.  
**V2:** token hashes select a few rows; fetch through bounded staging/page cache, then fuse into the target's hidden representation. Distinguish **logical lookup each processed token** from physical SSD I/O (may hit cache).  
**V3:** compare memory profiles **RAM resident PLE** vs **NVMe PLE**; show host-RAM budget and different access latencies, no invented tok/s. Include separate HiCache prefix caching as another unrelated memory tier.  
**Accuracy:** not MoE expert offload, not scanning the entire SSD table per token, not no-latency random I/O.  
**Sources:** [Qwen model card](https://huggingface.co/Qwen/Qwen3.8-Flash-Next), [home-k8s #135](https://github.com/dbirks/home-k8s/issues/135), [manifest](https://github.com/dbirks/home-k8s/blob/main/apps/pennyroyal-flashnext.yaml).

### F04 — Engram/PLE historical progression without a false "first"

**Claim:** a research mechanism later appears in differing shipped architectures.  
**V1:** early 2026 DeepSeek Engram paper/model → Qwen3.8-Flash-Next PLE → DeepSeek V4.1-Flash Engram.  
**V2:** layer/lookup structure of original demo vs released implementation, clearly separate vendor implementations.  
**V3:** short animated historical progression with dates **only after checking** announcement/model-card timestamps; show DeepSeek-V4 (without documented Engram) as a separate intervening release if useful.  
**Accuracy:** not "DeepSeek V4 originally launched with Engram" and not "Qwen cloned DeepSeek’s implementation".  
**Sources:** [January Engram paper](https://arxiv.org/abs/2601.07372), [Qwen model](https://huggingface.co/Qwen/Qwen3.8-Flash-Next), [DeepSeek model](https://huggingface.co/deepseek-ai/DeepSeek-V4.1-Flash).

### G01 — LLM Collective: outbound app-level tunnel

**Claim:** independently hosted model endpoints can be contributed without VPN membership or exposing inbound home ports.  
**V1:** client → gateway in Kubernetes → independent contributing home machine with complete model server; no inter-host tensor computation.  
**V2:** contributor first establishes **outbound WSS**, then the gateway opens a **Yamux stream** inside that connection for one request; HTTP request/streamed response go to and from only the selected allowlisted backend. Show distinct auth at client/gateway and contributor/gateway.  
**V3:** model catalog and routing: user selects model → gateway resolves contributor → Yamux stream → local server; contributor disconnects → model unavailable; multiple contributors remain separate. Include a generic configuration strip with **no real secrets, private hostnames or credentials**.  
**Accuracy:** outbound application tunnel ≠ VPN; "localhost" in contributor configuration means local to that machine; remote inference violates local-only-data policies if applied to sensitive work.  
**Sources:** authorized private e-gineering/llm-collective connector only; public-safe source-level summary in chapter 06.

---

## 4. Reference examples and calculation contracts

### 4.1 A small real matrix for quantization V1

Implement a **fully deterministic toy**. For example:

~~~text
W = [[+0.68, -0.12],
     [+0.31, +0.45]]
h = [+1.0, +0.5]
W × h = [+0.62, +0.535]
~~~

Choose a stated **scale** and quantizer, compute \`q = clip(round(w/scale), -8, 7)\`, \`Wq = q × scale\`; show the actual reconstructed matrix and actual resulting vector. This specific choice is **illustrative INT4 with a signed [-8,7] codebook** and must be labeled as such. It is **not** NVIDIA NVFP4. Allow the viewer to change \`h\` and watch the error; output values should be computed, not animated by hand. A more advanced mode can show a different per-group scale and block calibration.

### 4.2 KV memory formula and the exceptions

For a conventional full-attention model with **L attention layers**, **Hkv KV heads**, **Dhead dimensions**, **T tokens**, and **b bytes per scalar**:

~~~text
KV_bytes ≈ 2 × L × Hkv × Dhead × T × b
             K+V      token positions
~~~

This is an idealized tensor payload formula; actual allocation includes **block padding**, batch fragmentation, per-group quant scales, optional sliding windows, MLA/compressed K/V, tensor/pipeline parallelism, drafters, and **non-KV recurrent state**. **Don't** apply ordinary full-attention formula to every layer of Qwen3.6/3.8, DeepSeek V4.1, or Mamba. For multi-sequence capacity sum **distinct physically stored positions**, accounting for shared prefixes and allocations. Context limit is a model/runtime rule; cache capacity is a memory budget, not identical.

### 4.3 Why naïve non-cached decode is not exponential

Count **token positions executed** if the initial prompt has P tokens and we produce T tokens without keeping KV:

~~~text
without cache: P + (P+1) + ... + (P+T−1) = P*T + T*(T−1)/2
with KV cache: initial prefill P positions + ~T new positions
~~~

This illustrates repeated dense-layer work. Attention operation counts have different complexity; use a separate meter and an appropriate attention model. Don't claim the cached system never **reads** past tokens: attention reads the K/V tensors from prior positions each time (or a window/sparse subset depending on architecture). The **model weights** still participate every decode iteration.

### 4.4 Basic prefill/decode roofline

~~~text
arithmetic_intensity = FLOPs / bytes_from_memory
achievable_FLOPs_per_second <= min(peak_compute, effective_memory_bandwidth * arithmetic_intensity)
~~~

Peak compute and peak memory bandwidth are theoretical **ceilings**. Kernel launch overhead, tile efficiency, attention/KV reads, quantization/dequantization and CPU/GPU transfer make real numbers different. **No exact tok/s prediction** from dividing model weight size by the rated bandwidth; at best it is a lower-bound intuition in a simplified weight-streaming regime.

### 4.5 Example configuration fragments (not production recipes)

**llama.cpp** — options to research for a specific binary/model/GPU, not all required together:

~~~bash
llama-server -m model-Q4_K_M.gguf -c 32768 -ngl 999
# optional version/model-dependent:
# --cpu-moe
# --moe-cache-mib 1024
# -ot 'tensor_pattern=CPU'
# -ctk f8_0 -ctv f8_0
~~~

**vLLM** — concept mapping, verify exact CLI and model support:

~~~bash
vllm serve MODEL_ID \
  --max-model-len 32768 \
  --gpu-memory-utilization 0.9 \
  --max-num-seqs 16 \
  --enable-prefix-caching \
  --kv-cache-dtype fp8_e4m3
# Optional method-specific speculative config (only with compatible target/drafter).
# --speculative-config '{"method":"dspark","model":"DRAFT_ID","num_speculative_tokens":3}'
~~~

**Pennyroyal** — speaker's *existing* implementation uses environment options, not a generic vLLM CLI:

~~~yaml
PENNY_PLE_BACKEND: nvme
PENNY_PLE_NVME_MODEL: /models/flash-next-ple
~~~

These are **explanatory fragments**, not copy-paste defaults. Consult the installed version, model card, supported kernels and the actual manifest before demoing. vLLM and llama.cpp flags are not interchangeable.

### 4.6 Conceptual LLM Collective diagram (public-safe)

~~~text
                      [Corporate-authenticated users]
                                   |
                            [HTTPS API client]
                                   |
                        [Gateway / model catalog]
                             /            \
                  [Yamux stream A]     [Yamux stream B]
                        |                   |
                [Outbound WSS A]     [Outbound WSS B]
                        |                   |
              [Go contributor A]    [Go contributor B]
                        |                   |
               [Local model server] [Local model server]
                  [GPU A, KV A]        [GPU B, KV B]
~~~

The *outbound WSS connection* is initiated by each contributor and already established before inference requests arrive. Requests open logical Yamux streams across these connections. Authentication and allowlisting are separate. **No shared GPU memory, no assumed shared KV and no Internet-exposed home model server.**

---

## 5. Agent work packages — iterative research-to-scene process

The implementation agent should **not** attempt to build all scene IDs in one giant PR. Work in small coherent groups and preserve the V1/V2/V3 captures, with no need for the speaker to narrate during implementation.

| Package | Scene IDs | Primary deliverable | Critical gate |
|---|---|---|---|
| P0 Narrative/infrastructure | A01–A03, B01 | navigation, honest opening, hardware budget | no unsupported economics or hardware tok/s |
| P1 Model fit | B02–B05 | precise VRAM/DDR/NVMe and dense/MoE scenes | active vs resident params distinct |
| P2 Quantization | C01–C03 | deterministic matrix quant + FP4 scales + AutoRound | actual numeric computations check out |
| P3 Inference internals | C04–C05, D01–D02 | forward pass, no-KV comparison, roofline | old positions aren't recomputed with KV |
| P4 Concurrent agents | D03–D05 | vLLM/SGLang/llama.cpp prefix data structures | exact tokens and physical sharing correct |
| P5 Speculative | E01–E04 | draft/verify mechanics, drafters, memory budget | stochastic verification correctness |
| P6 Speaker DSpark | E05–E06 | actual experiment retrospective, vendor companion bundles | latest corrected eval results not earlier optimistic plan |
| P7 What's new | F01–F04 | specialized engines and Engram/PLE | no MoE/PLE/KV conflation |
| P8 Small Collective endcap | G01 | accurate application-tunnel model | no internal secrets, no pooled VRAM |
| P9 Integration | all accepted | selectable 20/30/extended routes and source manifest | one-command build and usable stage controls |

For **every package**:

1. **Read** the corresponding chapter, source links and existing experiment code.
2. **Refresh sources** if engine/model version changed. Use official docs/source/papers first, then the speaker’s home-k8s issues for firsthand observations. Avoid invented benchmark numbers.
3. Write a **claim → mechanism → precise nouns → visual encoding** sheet before any rendering.
4. Prototype the **three versions** (V1 truth; V2 mechanism; V3 presentation). Include a meaningful visual acceptance test for each.
5. Produce a **review artifact**: static overview image, one state transition clip/GIF if appropriate, source URLs, supported/runtime versions, measured/simulated labels, and a 15-second explanation in normal words.
6. Run **pnpm build**, inspect in browser at 1920×1080 and smaller projection/mobile dimensions, check pause/scrub/orbit/reset/navigation; test arrows, labels and contrast.
7. **Do not** automatically place every successful experiment into the talk lineup. The speaker decides ordering and which scenes merit time.
8. File correctness/design questions explicitly rather than silently replacing an uncertain behavior with the easy-to-animate version.

### Suggested automated scene invariant tests

- Quant scene: numeric \`W × h\` output is exact for chosen toy matrices; reducing bits does not *always* make error smaller in a naive monotonic line.
- KV scene: no-KV path reexecutes prior positions; cached path processes one newly emitted token (per active sequence) while **reading** earlier K/V.
- Prefix scene: if token 3 differs, ordinary initial prefix reuse cannot magically resume at token 20; vLLM only reuses compatible full hashed blocks; branch counts/refcounts sensible.
- MoE scene: a routed token doesn't activate all expert matrices; total stored params remain constant when routing changes.
- Draft scene: verifier rejects invalid descendants; fully correct stochastic variant preserves target distribution by the implemented method; no "acceptance × tokens/sec = speed".
- Engram scene: fixed learned table persists across sessions; per-new-position n-gram lookup happens; only selected rows fetched, not whole table.
- Collective scene: home contributor connects out first, gateway routes only declared backends, responses return over the same transport; no private LAN reachability implied.

---

## 6. Priority source pack (primary first)

### Architecture and data/attention

- [PagedAttention original paper](https://arxiv.org/abs/2309.06180) — paged KV allocation, sharing and batching.
- [vLLM hash-block prefix caching](https://docs.vllm.ai/en/latest/design/prefix_caching/) — parent hash, full blocks, refcounts, eviction, salts.
- [SGLang RadixAttention original design](https://www.lmsys.org/blog/2024-01-17-sglang/) — compressed shared-prefix radix tree.
- [SGLang Unified Radix Cache, 2026](https://www.sglang.io/blog/unified-radix-cache) — full KV / SWA / recurrent state.
- [NVIDIA attention and roofline](https://developer.nvidia.com/blog/co-designing-ai-model-attention-for-fast-interactive-long-context-inference) — prefill vs decode arithmetic intensity.
- [vLLM Quantized KV Cache](https://docs.vllm.ai/en/latest/features/quantization/quantized_kvcache/) — supported precision and scaling.
- [llama.cpp server options](https://github.com/ggml-org/llama.cpp/blob/master/tools/server/README.md) — context, slots, prompt reuse, MoE CPU placement.
- [llama.cpp MoE cache](https://github.com/ggml-org/llama.cpp/blob/master/docs/moe-cache.md) — on-device hot cache for CPU-hosted experts.

### Quantization and formats

- [Intel AutoRound](https://github.com/intel/auto-round) and [guide](https://github.com/intel/auto-round/blob/main/docs/step_by_step.md) — post-training quant, calibration, mixed schemes.
- [NVIDIA NVFP4 technical docs](https://docs.nvidia.com/deeplearning/transformer-engine/features/low_precision_training/nvfp4/nvfp4.html) — E2M1, E4M3 scale/16 values, BF16/FP8 distinction.
- [vLLM Quantization feature index](https://docs.vllm.ai/en/latest/features/quantization/) — availability, engine compatibility.
- [llama.cpp tensor encoding types](https://github.com/ggml-org/llama.cpp/wiki/Tensor-Encoding-Schemes) — GGUF FP16/quantized variants.
- [Speaker's AutoRound Qwen3.8 quant recipe](https://github.com/dbirks/home-k8s/blob/main/apps/qwen38-upload.yaml.hold).

### Speculation and firsthand drafter training

- [Speculators algorithm decision guide](https://docs.vllm.ai/projects/speculators/en/latest/user_guide/algorithms/decision_guide/) — MTP, EAGLE-3, DFlash, DSpark, DFlash2.
- [Speculators DSpark](https://docs.vllm.ai/projects/speculators/en/latest/user_guide/algorithms/dspark/) — Markov/confidence heads.
- [Speculators DFlash2](https://docs.vllm.ai/projects/speculators/en/latest/user_guide/algorithms/dflash2/) — dynamic convolutions, selector.
- [Speculators train guide](https://docs.vllm.ai/projects/speculators/en/latest/user_guide/tutorials/train/) — target hidden states, supervised draft training.
- [home-k8s #59](https://github.com/dbirks/home-k8s/issues/59) — initial actual pipeline and bugs.
- [home-k8s #60](https://github.com/dbirks/home-k8s/issues/60) — methodology correction supersedes overly optimistic early notes.
- [home-k8s #69](https://github.com/dbirks/home-k8s/issues/69) — diverse on-policy data and tool traces.
- [home-k8s #72](https://github.com/dbirks/home-k8s/issues/72) — one completed large training run and format issue.
- [home-k8s #80](https://github.com/dbirks/home-k8s/issues/80) — evaluation of from-scratch agentic data.
- [Muse Glimmer official collection](https://huggingface.co/collections/meta-models/muse-glimmer) and [assistant](https://huggingface.co/meta-models/Muse-Glimmer-30B-assistant).
- [Laguna S 2.1 and companion](https://huggingface.co/poolside/Laguna-S-2.1), [DFlash](https://huggingface.co/poolside/Laguna-S-2.1-DFlash).

### Specialized architectures and offload

- [DeepSeek Engram paper](https://arxiv.org/abs/2601.07372), [official Engram code](https://github.com/deepseek-ai/Engram).
- [DeepSeek V4.1 Flash model](https://huggingface.co/deepseek-ai/DeepSeek-V4.1-Flash), [vLLM Engram storage/config](https://docs.vllm.ai/en/latest/features/engram/).
- [Qwen3.8 Flash-Next card](https://huggingface.co/Qwen/Qwen3.8-Flash-Next) — MoE backbone + 51B PLE + MTP parameters.
- [Pennyroyal source](https://github.com/jpezzulli/sglang-rtxpro6000) and [speaker issue #135](https://github.com/dbirks/home-k8s/issues/135).
- [NInfer speaker fork](https://github.com/dbirks/ninfer).
- [NVIDIA RTX 5090](https://www.nvidia.com/en-us/geforce/graphics-cards/50-series/rtx-5090/) and [DGX Spark](https://docs.nvidia.com/dgx/dgx-spark/hardware.html) official specs.

### Networking — authorized-source review required

- e-gineering/llm-collective — private actual implementation, README and mentioned internal Go code.
- Speaker's public-safe project description in chat is authorized for conceptual talk design. Avoid forwarding private repo contents or secrets as part of review materials.

---

## 7. Unresolved facts to ask the speaker as the narrative evolves

Do not block an initial implementation on these; use **toy/illustrative** states and explicit TODO tags instead.

- The precise first model, quant variant, context target and card for the 24 GB vs 32 GB decision.
- The real identity and quantization of the model that reliably handled the first coding/Kubernetes workflows; whether "six months" is approximate and what prompted purchase.
- Actual Thunderbolt dock/eGPU adapter/link, WSL loader, "direct I/O" flags and memory/termination logs; observed 20s load under what checkpoint/engine/version.
- The exact GGUF builds, context/parallel settings and CPU-MoE tradeoffs tried by the speaker.
- Whether concurrency meant *model replicas* or multiple sequences sharing one resident model at each stage.
- Paired performance and memory metrics for different cache dtypes, drafter on/off, engines and agent workloads; use actual source snapshots, not aspirational benchmark values.
- Which custom DSpark checkpoint, training recipe and serving result he actually wants to show. Emphasize latest corrected conclusions over early optimistic planning.
- Specialized engine version/quant/model/driver/measurement for NInfer and Pennyroyal; coworker's Radeon R9700 Radiance results and permission to cite them.
- A sanitized, shareable real tool trace or a deliberately synthetic alternative.
- Which Collective topology/feature statements are approved for public talk; don't publish a private endpoint or credentials.
- Whether the Q&A should include a one-question Mac/MLX invitation and the preferred final rhetorical landing.

## Definition of done for the handoff (not the presentation)

The handoff is complete enough for a downstream implementation agent when it can:
(1) locate 8 story chapters and the approximate 30-minute route;
(2) identify the relevant **claim, mechanism and factual caveat** for each scene;
(3) prototype **three iterations** without inventing source data;
(4) check primary sources and real home-k8s issues;
(5) reuse the existing presentation code without treating prototypes as approved content;
(6) report what is measured versus hypothetical; and
(7) hand back an independently navigable, projection-readable collection from which the speaker can select a final live route.
