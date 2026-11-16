# Local LLM Engineering — Living Research & 3D Visualization Briefs

Updated: 2026-11-16. Status: incremental research, not final slide specification.

## Presentation intent
30-minute live technical meetup talk. Rich, rapidly navigable, interactive 3D visualizations; some scenes may receive only ~15 seconds. Another coding agent will implement. Prioritize physically/mathematically faithful diagrams over metaphors. Explicitly label illustrative geometry vs measured tensors. The speaker may skip or expand scenes on demand.

## Narrative inventory
- Local model quality/market progression; Qwen3.6-27B, Qwen3.8-27B, Qwen3.6-35B-A3B, Muse Glimmer (verify model cards and release chronology before publication)
- Tokens, embeddings, contextual residual-stream representations, dimensions and parameter count
- Attention and hybrid architectures, dense vs MoE
- Quantization and its errors; weights vs activations vs KV cache
- Prefill vs decode, memory capacity vs bandwidth vs compute, GPU offload
- Speculative decoding, draft families, verifier and acceptance
- vLLM and llama.cpp configuration concepts
- Abliteration, activation steering, post-training risks; specific Qwen behavior research TBD
- LLM Collective: community API gateway for home-hosted models

## Scene family: speculative decoding (research pass 1)

### Shared base scene: verifier and draft timeline
**Geometry**: horizontal X axis is future token position; vertical Y separates target/verifier computation from draft computation; Z is candidate branching depth or alternatives. Represent tokens as labeled cuboids; time-consuming forward passes as translucent slabs spanning the token positions they process. Distinguish wall-clock scheduling from token position: do NOT imply that spatial distance equals execution time. Animate a shared prompt at left, a proposal path from the drafter, a target verification pass, accepted prefix in green, rejected continuation fading, and next corrected token. Add a toggle for greedy vs distribution-preserving sampling. In stochastic mode, don't describe verification as a naive argmax equality test.
**Controls**: play/pause; step draft/verify/commit; draft length K; probability/confidence display; accepted length; draft cost; verifier cost; compare sequential decoding. Quantities that are not actual benchmark measurements must be marked simulated.
**Narration**: 'We spend a cheap computation proposing several future tokens, then use the expensive model to check multiple positions in parallel. The useful result is how many consecutive draft tokens we can accept per verification step.'

### MTP
**Geometry**: several successive prediction modules/heads branching from or extending the target representation, each associated with a future position. Distinguish native trained MTP from an arbitrary independent small draft model. Show that dependencies and exact computation vary by architecture. The visualization must not imply all MTP heads are completely independent or always produce tokens simultaneously.
**15-second message**: 'Some models already contain extra machinery trained to predict multiple future positions; inference can use that machinery as a drafter.'

### EAGLE-3
**Geometry**: small draft-network tower beside a larger target tower. Thin feature streams from selected target representations enter the drafter. Candidate nodes grow sequentially along X; optional branch nodes extend in Z to form a tree. Animate repeated lightweight draft steps before one target verification pass.
**15-second message**: 'EAGLE-3 predicts ahead with a small learned network; the draft grows sequentially, often with branching, before the main model verifies it.'

### DFlash
**Geometry**: create K empty/masked positions arranged horizontally, all visible at once. Feature cables connect target hidden states to the draft tower. One broad translucent draft-compute slab passes across all K positions and produces K candidate distributions together. Verification follows. Non-causal attention means positions can interact during the draft pass; do not render as K sequential independent forward passes.
**15-second message**: 'DFlash proposes a whole block in one draft pass instead of taking a separate draft step for every future token.'

### DFlash2
**Geometry**: preserve DFlash's parallel backbone. Behind it, show small neighboring-position mixing operators (local dynamic convolutions), then top-K candidate columns at each future position. A thin predecessor-conditioned selector traces one path across candidate columns. Distinguish this lightweight selection dependency from running the entire backbone sequentially.
**15-second message**: 'DFlash2 retains parallel heavy computation, then uses lightweight local mixing and conditional candidate selection to improve the sequence.'
**Caveat**: exact training/serving availability experimental; verify against primary implementation before demo.

### DSpark
**Geometry**: parallel block backbone creates position-wise states; lightweight Markov dependency head draws short left-to-right links among proposed positions. Above each slot a confidence gauge displays estimated prefix survival. A movable verification-window boundary truncates risky suffixes according to estimated cost/load. Show both per-request latency and server batch capacity as separate meters.
**15-second message**: 'DSpark combines parallel proposals with cheap sequential dependencies, then chooses how much of a block is worth verifying.'

### DFlare
**Geometry**: target tower has many layers, each rendered as a thin horizontal plane. Multiple colored feature paths fan out from different target layers into distinct draft layers. Contrast against DFlash-style shared fused conditioning. Do not imply that these target layers are recomputed solely for each draft step if cached features are reused.
**15-second message**: 'DFlare improves how each draft layer receives information from the target model.'

### PCTree
**Geometry**: start with a DSpark-like chain of candidate positions. At each parent, create conditional child alternatives; expand into a tree in Z while maintaining a fixed verification budget. Highlight prefix-consistent paths; accepted root-to-leaf prefix survives. Clearly distinguish research method from widely deployed default.
**15-second message**: 'PCTree uses parent-conditioned branches to avoid losing every alternative when an early draft token is rejected.'

### Further methods to investigate
- XPress: causal refiner with fixed-count Jacobi iteration (vLLM Speculators docs)
- JetSpec: referenced in NVIDIA TensorRT Edge-LLM support docs
- P-EAGLE: deprecated in current Speculators decision guide; historical context only
- DFly / AngelSpec: training framework and draft family; distinguish method from toolkit

## Engineering requirements for downstream agent
1. Scene metadata: factual claim, narration (15s), detailed animation storyboard, camera path, interaction controls, data source, known simplifications.
2. Provide 'conceptual' and 'actual measured' modes where applicable; never make up model weights, attention values, or benchmark speedups.
3. Use reusable scene primitives: token tiles, layer planes, vectors, tensor grids, feature wires, probability distributions, forward-pass slabs, branching trees, time bars.
4. Allow keyboard step-through and camera reset; retain a single visual grammar across methods.
5. Distinguish wall time, number of forward passes, FLOPs, memory traffic, accepted-token count, and end-to-end throughput.
6. The 3D scene must remain legible when flattened or projected onto a 2D display.

## Sources (checked in this pass)
- vLLM Speculators algorithm overview: https://docs.vllm.ai/projects/speculators/en/stable/user_guide/algorithms/
- vLLM Speculators decision guide: https://docs.vllm.ai/projects/speculators/en/latest/user_guide/algorithms/decision_guide/
- DFlash paper (ICML 2026): https://proceedings.mlr.press/v306/chen26bv.html
- DSpark paper: https://arxiv.org/abs/2607.05147
- DFlare paper: https://arxiv.org/abs/2606.02091
- PCTree paper: https://arxiv.org/abs/2608.02123
- NVIDIA speculative decoding docs: https://github.com/NVIDIA/TensorRT-Edge-LLM/blob/main/docs/source/user_guide/examples/speculative-decoding.md

## Research cautions and pending work
- Avoid treating speedup numbers from different papers as comparable; hardware, workload, batch size, acceptance and baseline differ.
- Validate model release claims and architecture specifics against primary cards before making slides.
- Investigate EAGLE-3 feature construction and exact verification algorithm in a dedicated pass.
- Investigate actual DFlash2 implementation/training before committing low-level details.
- Investigate which newer techniques are available for the audience's likely inference stacks and hardware.
- Next focused pass: deeper visual storyboard for verifier acceptance and draft trees, or embeddings/hidden-state geometry.

## Research pass 2 — Verification mechanics (2026-11-13)

### Core mechanism: linear draft verification
Given a context, a cheaper drafter proposes tokens x1..xK sequentially or as a block. The target model processes the drafted continuation in one appropriately masked forward pass, producing conditional next-token distributions for each position. These are parallel computations across sequence positions *within the target pass*, not K independent target decode steps. Verify from left to right; the first rejected proposal invalidates all subsequent proposed tokens in that linear continuation, because they were conditioned on a prefix no longer selected. Continue from the accepted prefix plus a correction token. When all K are accepted, a target bonus token can also be sampled from the next target distribution, depending on algorithm and implementation.

### Greedy verification
For deterministic greedy target decoding, compare each proposed token to the target's argmax under its corresponding prefix. Accept the longest matching prefix; at the first mismatch emit the target argmax instead. No claim that this procedure preserves a stochastic target sampling distribution.

### Exact speculative sampling
Let p be the target's next-token distribution and q the draft's next-token distribution under the same accepted prefix. For proposed token x sampled from q, accept with probability min(1,p(x)/q(x)). On rejection, sample a replacement from r(y) proportional to max(0,p(y)-q(y)), normalized. This preserves the target's output distribution under the algorithm's assumptions; it does NOT imply identical token-by-token outputs for different random draws, nor necessarily bit-identical floating-point results. Expected acceptance at one step is sum_y min(p(y),q(y)) = 1 - TV(p,q). Explain that acceptance is distribution overlap, not merely top-1 agreement. Reference: Leviathan et al. ICML 2023, https://proceedings.mlr.press/v202/leviathan23a.html and appendix https://proceedings.mlr.press/v202/leviathan23a/leviathan23a.pdf

### 3D brief A: linear verification corridor
Geometry: a horizontal row of K translucent draft-token prisms, each at an increasing time position. A single broad target-forward-pass plane sweeps through all positions. Above each prism show the target conditional distribution as a vertical set of token-probability bars, and optionally the draft distribution in a second color. Controls: switch greedy/exact sampling; step through accepted prefix; click a position to reveal p(x), q(x), acceptance probability and residual distribution. On first rejection, gray out all later draft prisms; insert a correction prism. Make it clear that verification calculations occur together, while the acceptance decision follows prefix order. 15-second narration: 'The little model guesses several tokens. The large model evaluates those positions together. We keep the valid prefix and correct the first failure; later guesses no longer have the right context.' Accuracy constraints: don't depict independent target passes for each drafted token; do not equate distribution-preserving sampling with greedy matching.

### 3D brief B: probability overlap / exact sampling
Geometry: two aligned probability histograms p and q across the same token vocabulary; the overlapping portion of each column glows; non-overlapping draft mass and target-only residual mass are separate colors. Animate draft sampling from q, then a probabilistic acceptance gate with threshold min(1,p(x)/q(x)). If rejected, the replacement is sampled only from the positive residual (p-q)+ normalized. Controls: edit small 3-5 token distributions; show total overlap and total variation; toggle greedy mode for contrast. Include exact numerical checks summing to 1. 15-second narration: 'Exact speculative decoding doesn't just check whether the top guesses match. It uses how much the two probability distributions overlap, and corrects rejections so the final samples follow the large model's distribution.' Accuracy constraints: residual distribution is not simply p; use correct probability normalization and handle zero-probability cases.

### 3D brief C: tree attention verification
Geometry: a rooted 3D branching draft tree with token nodes and ancestry links. A target-verification plane processes all nodes in one packed tree-attention pass, with each node attending only to the original context and its own ancestors, not sibling branches. A selectable mask-matrix inset shows allowed and forbidden attention edges. Animate a single accepted path lighting up and the unused branches dimming. Controls: expand/prune branches; switch between chain and tree; show candidate node count, accepted path length, verification cost and depth. 15-second narration: 'Instead of betting on one continuation, the drafter proposes a tree. The target evaluates the candidates together, but each branch can only see its own ancestors. Verification chooses one valid continuation.' Accuracy constraints: do not imply all branches are emitted, or that siblings can attend to one another; acceptance details vary by greedy versus stochastic tree algorithm. Background: EAGLE-2/3 and tree-attention implementations, https://github.com/vllm-project/speculators/blob/main/docs/user_guide/algorithms/eagle3.md

### 3D brief D: why more accepted tokens may be slower
Geometry: stacked timeline tracks for draft computation, target verification, synchronization and useful accepted output. Three scenarios: batch-one, moderate load, saturated batch. User-adjustable draft length, acceptance probability, draft overhead, verification cost, batch size. Display measured or explicitly hypothetical cost model and useful accepted tokens per second, never a fabricated real benchmark. 15-second narration: 'More accepted tokens isn't the goal by itself. Extra drafting and verification consume GPU resources. At high concurrency, speculative work can displace useful work.' Sources: vLLM DSpark serving explanation https://github.com/vllm-project/vllm-project.github.io/blob/main/_posts/2026-08-14-dspark-adaptive-verification.md

### 3D brief E: DSpark adaptive verification across requests
Geometry: each concurrent request is a horizontal lane with up to K speculative-token slots. Slots carry conditional confidence c(r,i); the probability that the whole prefix through slot i survives is S(r,i)=product_{j<=i} c(r,j). Show a fixed budget B of verification slots as glowing tiles. A global scheduler allocates slots to the highest survival scores while preserving prefixes in each lane. A request with higher confidence can receive more slots than a low-confidence request. Controls: vary concurrency, confidences, cost budget and observe allocation and predicted throughput. Important: the conditional confidence values are estimates requiring calibration; survival product assumes the particular conditional interpretation, and the scheduler uses profiled serving costs. 15-second narration: 'DSpark estimates which drafted prefixes are worth checking, then spends verification compute on the most promising requests instead of blindly checking every slot.' Sources: https://docs.vllm.ai/projects/speculators/en/latest/user_guide/algorithms/dspark/ and https://github.com/vllm-project/vllm-project.github.io/blob/main/_posts/2026-08-14-dspark-adaptive-verification.md

### New research lead: ForeSpark (preprint Nov 10, 2026)
ForeSpark proposes jointly choosing the draft length *before* parallel drafting and verification length, whereas DSpark primarily schedules how much of a drafted block to verify. This is a useful next-generation extension to the scheduler visualization: show that unverified drafted tokens themselves cost compute. Treat published speedups as authors' experimental claims, not established cross-system comparisons. https://arxiv.org/abs/2611.13442

### Research follow-ups
- Check exact tree sampling variants; don't assert all EAGLE deployments preserve stochastic distributions without validating implementation.
- Validate EAGLE-3 feature inputs and how tree attention is realized in vLLM/llama.cpp/SGLang separately.
- Test whether current inference backends support each draft method on a concrete target model, quantization and hardware combination.

## Research / narrative pass 3 — Local inference after Ollama (2026-11-16)

### Audience and thesis
Audience has already run Ollama or LM Studio and likely tried a few local model families. This is a pragmatic 201-level talk, not installation instructions, and not a catalog of definitions. The through-line is **"from running a model to operating one"**: selecting a useful model, fitting it on real hardware, making it fast, serving simultaneous requests, and exposing contributed machines behind a shared API (the speaker's internal *LLM Collective*).

The speaker wants to communicate hands-on lessons from the past few months. Keep slots for actual anecdotes and numbers; **never invent hardware, throughput, failure stories, or collective topology**. Ask the speaker for these later rather than generating pseudo-benchmarks.

### Preferred information architecture: config as a map, problems as chapters
Start with a realistic `vllm serve` or `llama-server` command rendered as interactive, selectable lines, with a machine memory map and client request queue visible alongside it. Each cluster of flags is an entrance to a 3D mechanics scene; return to the command after the concept has become visually clear. Switch between vLLM and llama.cpp in a 'same constraint / different engine' comparison. This avoids the sterile feeling of one independent trivia slide per concept, while keeping visuals rich and rapid. **Do not force a linear flag-by-flag walkthrough**: the actual decision or bottleneck is the point, and some topics (such as speculative decoding, MoE routing, and embedding geometry) deserve excursions not tied to a flag.

### 30-minute live route (flexible, scenes can last ~15 seconds)
1. **Choose a model**: What quality and latency is acceptable for coding-agent workloads? Qwen/Muse examples; architecture and dense vs MoE; do not imply total parameter count predicts performance.
2. **Make it fit**: Distinguish parameter storage, quantized weights, activations, runtime buffers, KV cache and architecture-specific recurrent or hybrid state. Show offload cost.
3. **Make it fast**: Contrast prefill vs token-by-token decoding and bottlenecks; introduce batching and speculate-draft-verify; have method switcher for EAGLE-3, MTP, DFlash family etc. Avoid treating accuracy and speedup as universal.
4. **Serve it**: Move from one person using a model to multiple concurrent requests; show scheduler, request arrival/departure, cache allocations and time to first token vs output tokens/sec.
5. **Connect it**: LLM Collective API gateway, heterogeneous independently hosted models; show routing/health/capabilities, not fictional combined model compute. Only show cross-host parallel inference if the actual implementation does it.

### Flag-to-visual mapping to research / prototype
- `vllm serve MODEL`: choice of weight format and model architecture; memory footprint; tokenizer and prompt template.
- `--max-model-len`: prompt + generation limit; visualize positions, attention/state, cache footprint and distinction between model's supported length and what runtime/hardware can sustain. Do not claim it always preallocates the full-length cache per request.
- `--gpu-memory-utilization` / `--kv-cache-memory-bytes`: memory budget / cache capacity. vLLM's implementation and defaults change by version; current docs explicitly describe extensible KV-cache behavior. Do not describe these as switches that manually 'initialize the KV cache'.
- `--kv-cache-dtype`: quantize cache storage (model/backend-specific); separate from weight quantization `--quantization`; cache fidelity can affect outputs.
- `--max-num-seqs` and related scheduler settings: parallel active sequences, scheduling and throughput/latency tradeoff.
- `llama-server -m model.gguf`: model file; GGUF format and metadata.
- `--ctx-size`: same high-level context problem but distinct memory management behavior.
- `--n-gpu-layers`: CPU/GPU layer placement, residency and bandwidth/interconnect boundaries.
- `--cache-type-k`, `--cache-type-v`: K/V cache storage precision; not identical to the vLLM CLI values or hardware kernel support.
- `--parallel`, `--batch-size`, `--ubatch-size`, `--flash-attn`: compare concurrency, logical/physical prefill batches and attention kernels; don't conflate these as one 'batch size'.
- Ollama Modelfile `PARAMETER num_ctx`: bridge from a familiar first experience to deeper serving choices. Ollama configuration and llama.cpp command-line interfaces are not interchangeable.

### Proposed 3D visual scenes (implementation briefs)
**A. Memory pressure exploded view**: A GPU memory slab separated into occupied weight blocks, cache pages, temporary workspace and other reserved memory. Changing model weight quantization compresses weight storage; changing max context/active requests changes *potential* KV/cache pressure. Let hardware memory cap be a movable plane; indicate swapping/offload arrows and transfer costs. Use real model specs or a clearly labeled synthetic example. Different architectures may have non-standard attention caches.

**B. One prompt, multiple serving stacks**: Left is request queue, middle is engine scheduler, right is target hardware and generated tokens. A selector switches vLLM / llama.cpp / Ollama. Preserve client arrival times and workload; animate differences only if sourced or measured. Show shared concepts while making it explicit that implementations differ.

**C. Context length vs memory utilization**: Animate multiple active conversations, each gaining tokens and consuming cache structures where applicable. Let the camera reveal prefix sharing and paged or block allocation (engine-dependent), with a separate 'logical context limit' indicator. Avoid depicting exact preallocation without evidence.

**D. Prefill vs decode**: Show an input prompt of N positions processed in a high-parallelism prefill pass, then incremental decode steps. Pair with independent plots for time-to-first-token, per-token generation latency and aggregate throughput; show that parallel compute work and memory bandwidth constraints vary with batch and hardware.

**E. Collaborative endpoint architecture**: Individual independent machines each expose a model service; a central API gateway selects/routs requests by capability, availability, or policy, then returns output. Include health checks, fallback and auth only if confirmed as part of the real LLM Collective. **Do not depict pooling all GPU memory into a single virtual GPU**, or splitting one model over machines, without confirming distributed execution.

### Presentation style / guardrails
- On-screen main command should show ~4-7 meaningful lines at a time; config labels become clickable branching destinations. Keep full CLI cheatsheet as companion material.
- Add an instant-return gesture from every subscene, plus 15-second verbal version and optional deep dive.
- Use exact measured hardware/latency numbers from the speaker's logs later; otherwise mark projected quantities as illustrative.
- Distinguish performance of single-request latency from aggregate server throughput; avoid saying 'faster' without a metric.
- Distinguish software engine, model architecture and file format. GGUF is not an engine; 'Ollama' and 'llama.cpp' are not the same command interface.
- Phrase optional slide intro as 'Assume you can already run a model. What does it take to make it fit, run fast, serve others, and operate reliably?'

### Candidate meetup title and primer
**Beyond “It Runs”: Engineering Local LLM Inference**

*You've tried Ollama or LM Studio and run a model on your own machine. Now what? This fast-moving, visual 201-level walkthrough explores the practical decisions behind hosting local models well: choosing architectures, quantizing weights, managing KV cache and GPU memory, speeding up generation, and configuring inference engines like vLLM and llama.cpp. We'll connect those ideas to lessons from real deployments and a shared gateway for independently hosted models.*

### Verification references checked on 2026-11-16
- vLLM serve arguments (latest): https://docs.vllm.ai/en/latest/cli/serve/
- llama.cpp server CLI documentation: https://github.com/ggml-org/llama.cpp/blob/master/tools/server/README.md
- llama.cpp multi-GPU and memory notes: https://github.com/ggml-org/llama.cpp/blob/master/docs/multi-gpu.md
- Ollama Modelfile official reference: https://github.com/ollama/ollama/blob/main/docs/modelfile.mdx

### Open decisions for speaker
- Which actual Qwen model, hardware, quantization, inference engines and measured throughput best represent their hands-on experience?
- What problem motivated LLM Collective? Does it just route requests to available nodes or also support other execution strategies?
- Which inference stacks or advanced features are actually supported by the chosen models / hardware? Check versions before demos.