# On-screen wording review: Configuring Local LLMs

**Created:** November 18, 2026  
**Base reviewed:** \`main\` @ \`a435ca3a07bef0a4bc7f2ef06dbc692a885fffbf\`  
**Status:** working copy handoff for discussion with the speaker; **not** a finalized full-deck rewrite  
**Relationship to active coding agent:** keep the existing 3D scene work running. This file collects wording changes and review decisions separately to avoid write conflicts. **Do not rewrite scene builders or auto-apply every proposed line until the speaker approves the language.**  
**Scope of this first pass:** talk title, Opening (00), Why bother? (01), What we mean by inference (02); next sections (03–05) are copied/referenced for review, *not revised yet*. No presenter/speaker notes are planned.

## Speaker's direction — high confidence

1. **Title is approved:** **Configuring Local LLMs**. Remove the placeholder **Beyond “It Runs”** from the title slide, global running label and eventual external blurb. This exact new title is the speaker's instruction.
2. **Audience-facing, not self-congratulatory.** Present a useful grab bag of terms/definitions, settings, tricks, lessons and practical examples collected over roughly six months of local inference at home and work. The approximate order learned is an organizing convenience, **not a perfect linear narrative** and not a grand "my journey" framing.
3. **Warm, informal, precise.** Ordinary words first; name the technical term; show what actually moves/changes in an accurate visualization. The speaker does **not** want hype, technical-word dumps, or a literal apples/factory allegory. Use personal stories when they explain a practical lesson, not to center the speaker.
4. **Real config snippets** from llama.cpp and vLLM should appear where they help a particular section; do not do a long config-file tour. Keep SGLang where comparison matters.
5. **Local motivations:** hosted models and subscriptions are excellent, and the speaker uses them. Still, per-use economics, changing quotas/billing, control over model version and quantization, keeping client data on a machine when required, and the sheer fun of tinkering all motivate local inference. Do **not** imply everyone should run locally or that every hosted provider secretly downgrades models.
6. **Direct Copilot detail now verifiable:** GitHub announced the end of request-based premium billing on April 27, 2026; **June 1, 2026** began the shift to token-consumption-based GitHub AI Credits. In the old scheme a long agent request and a brief interaction could cost the same base premium request (subject to model multipliers); under the new approach consumption reflects model/input/output/cached token usage. Source: [GitHub announcement, April 27](https://github.blog/news-insights/github-copilot-is-moving-to-usage-based-billing/) and [GitHub billing docs](https://docs.github.com/en/copilot/reference/copilot-billing/request-based-billing-legacy/what-changed-with-billing). The speaker remembers using long-running Copilot sessions, sometimes keeping them going through follow-up questions, and becoming concerned as the pricing changed. **Do not imply he was gaming the service or that his client's exact plan switched on June 1 without confirmation.**
7. **Market outlook is subjective:** the speaker suspects generous subscription economics may change, but also acknowledges that models could become cheaper to serve. No confident crash prediction or quantified "all tokens heavily subsidized" claim needed on-screen.
8. **Precision control:** with a self-hosted model, the operator can know the actual weights/quantization and decide when to change them; a hosted provider may change available models/service routing, but no particular hidden quantization downgrade has been substantiated. Frame this as transparency/control, not an accusation.
9. **No extra artifact expectations:** the existing scenes and variant A/B/C experiments are still being made by the coding agent. This is a **copy review** and a planned future handoff to that agent, not a request to alter scenes.

## Proposed literal text for title, 00, 01 and 02

The **title is locked by explicit speaker instruction**. All other copy is an editorial **first draft** that the speaker will read and modify with us. Each line below maps to the existing slide ID. Preserve A/B visual alternatives; update common wording consistently after approval.

### Title and global chapter label — approved

Target code:
- \`src/slides.ts\`, \`slides[0].headline\`
- \`src/slides/v2/_ch.ts\`, \`TALK\`

**New title / global TALK:**

> Configuring Local LLMs

The existing title-slide metadata \`Engineering Local LLM Inference\` and \`AISE · November 2026\` can remain unless the speaker wants to change them. If the render layout cannot fit the text, use a **visual line break only**, preserving these exact words.

### 00 — Opening

Current chapter heading: \`Opening\` (no change needed yet).  
Slide: \`src/slides/v2/open.ts\`, ID \`open\`.

**Proposed title:**

> A grab bag of local LLM terms, tips and settings

**Proposed exact list items:**

> A few definitions, settings I've found useful, and things I've picked up along the way.

> Roughly in the order I learned them, with examples from llama.cpp and vLLM.

This deliberately does **not** put the speaker's six months or personal achievements in the headline. If we want the rough six-month time anchor, it can be mentioned briefly in person or swapped into the first item during the copy review. It is a community knowledge-sharing intro.

### 01 — Why run a local model?

Target chapter heading: \`src/slides/v2/_ch.ts\`, \`CHAPTERS[1][1]\`.  
Current: \`Why bother?\`.

**Proposed chapter title:**

> Why run a local model?

**Proposed section divider framing** (\`src/slides.ts\`, \`section(1,...)\`):

> Hosted models are great. So why would you want to run one yourself?

#### \`why-objection\` — acknowledge the obvious

**Title:**

> Hosted models are really good

**Items:**

> The models are capable, and subscriptions can be a great deal.

> I use them too.

This is a concession, not a straw man or a claim local models should replace all hosted options.

#### \`why-good-enough\` — workload fit

**Title:**

> You don't always need the biggest model

**Items:**

> A useful model is one that reliably does the work you ask it to do.

> Even with hosted models, I've found I don't always need the most expensive option.

The speaker specifically mentioned increasingly choosing a strong but non-top-tier hosted coding model (e.g. Opus 5.5 rather than a more expensive Fable-class model). The example can be added after verifying name/availability; it **does not alone prove** small local models match either hosted model.

#### \`why-cost\` — concrete trigger, uncertainty rather than prophecy

**Title:**

> Pricing and limits can change

**Items:**

> GitHub Copilot's switch from per-request billing to token-based credits made me think harder about long agent sessions.

> I still use hosted models, but I wanted another option if pricing or limits changed.

This is a **grounded personal motivation** plus a **documented public product change**, not a prediction that subscriptions will end. The speaker can mention his opinion about subsidized pricing and the possibility that future economics change, clearly as opinion, if he chooses.

#### \`why-independence\` — explicit control

**Title:**

> Know exactly what you're running

**Items:**

> With a local model, I choose the weights, the quantization, and when to change them.

> For work that has to stay on my machine, I can keep inference local.

Accuracy: local inference also depends on the agent harness and its tool/network integrations; don't suggest the entire application is automatically offline. The speaker's actual client constraint motivated the eGPU.

#### \`why-fun\` — non-prescriptive finish

**Title:**

> And it's fun

**Items:**

> There are a lot of settings to try, and I like seeing what each one changes.

> You might have completely different reasons, and that's fine too.

### 02 — What do we mean by inference?

Target \`CHAPTERS[2][1]\`, currently \`What we mean by inference\`.

**Proposed chapter title:**

> What do we mean by inference?

**Proposed section divider framing** (\`section(2,...)\`):

> Before the settings, two terms are worth separating: training and inference.

#### \`train-vs-infer\` — proposed copy common to visual variants A and B

**Title for A and B:**

> Training produces the weights. Inference uses them.

**Variant A proposed body:**

> During training, a model's numbers are adjusted using lots of examples, including text and code. Inference uses those learned weights to process a prompt and predict the next token.

**Variant B proposed body:**

> Training repeatedly adjusts the model's numbers. Once the model is trained and loaded for inference, those weights stay fixed while it produces responses.

Nuance: models may be fine-tuned or trained later; "fixed" describes standard deployed inference, not a permanent property of a checkpoint. Training can use multimodal data too; text/code are examples, not a complete list.

**Optional verbal fact, not another required slide:** the resulting weights can be in a small file or many files totalling hundreds of gigabytes. A 20 GB file isn't a hard rule or a parameter count by itself.

#### \`engines\` — clarify execution layer and file formats

**Title:**

> An inference engine runs the model

**Items:**

> llama.cpp, vLLM and SGLang are engines that load weights and compute responses. Ollama makes local models easier to download and run.

> GGUF and safetensors are file formats for storing model tensors. They're not inference engines.

Nuance: Ollama is also a model server/runtime with its own APIs and underlying execution components; this wording avoids over-drawing a strict engines-versus-wrappers line. GGUF is not inherently a quantization algorithm.

## Suggested wording consistency checklist for the eventual code change

- Replace \`Beyond “It Runs”\` everywhere audience-visible, not only title: \`src/slides.ts\`, \`src/slides/v2/_ch.ts\` and any displayed chapter navigation. The old \`README.md\` heading can remain historically unless the project owner wants the repository itself renamed.
- Prefer **local model**, **model weights**, **quantization**, **context**, **KV cache**, **prefix caching**, **drafter** in that order as concepts are introduced.
- Don't say "training makes a file of numbers" if the diagram visibly displays tensors spread across multiple shards; write "produces weights" instead.
- Don't call all submitted agent inputs "private": data locality must be measured relative to client requirements.
- Avoid definitive "won't last forever" for subscription prices and "hosted services quantize your model without warning" without specific evidence.
- Don't treat exact copy as a live screenshot of a not-yet-merged coding-agent variant; the route might change during review.

## Up next — literal current section topics awaiting the speaker's narration

These are *not revised*. The speaker asked to review sections 03–05 next; the freshest code should be fetched immediately before that review, because another agent is actively editing the deck.

### 03 My setup — current section framing

**Divider:** "What I actually run, and why it looks the way it does."

- \`setup-why\`: "Around June, the Copilot limits started tightening".
  - **Potential duplication** with newly proposed \`why-cost\`: decide whether to retain this as personal transition, merge it with the earlier pricing story, or replace with "That got me looking at running models on my own laptop."
- \`setup-egpu\`: "My work laptop has to stay my work laptop" (variants).
- \`setup-slow-link\`: "A slow link is fine" (variants).
- \`setup-hardware\`: "Room or speed" (variants).
- \`setup-path\`: "Ollama, then llama.cpp, then vLLM".

### 04 Getting a smart enough model into VRAM

**Divider:** "The first real problem was memory. A smart model has to fit on the card."

- \`gguf\`: "GGUF comes in many sizes of the same model".
- \`embed-vec\`: "Each word becomes a list of numbers" (variants; **token** is more precise than word).
- \`quant-what\`: "Quantization stores each number with fewer levels" (variants).
- \`quant-types\`: "Four bits isn't one format" (variants).
- \`nvfp4\`: "How NVFP4 packs a block" (variants).
- \`autoround\`: "Tune the rounding, don't just round" (variants).
- \`moe\`: "35B stored, about 3B used per token" (optional).

### 05 Where does the conversation live?

**Divider:** "Once it loaded, I found the weights weren't the only thing using VRAM."

- \`kv-cache\`: "Remember instead of redo" (three visual variants).

**Do not apply edits to 03–05 yet.** The speaker wants to narrate his reactions to exact live wording first.

## Structural update after speaker's November 18 walkthrough — proposed, not locked

**Speaker's newest preference:** the talk remains **Configuring Local LLMs**, but its main headers should be audience-focused practical questions. Personal stories explain *why the question came up*, not the primary focus of the talk. The project remains a knowledge-sharing **grab bag of terms, flag examples and tips**, arranged approximately in the order the speaker learned them. Don't replace a practical question with a lofty chapter slogan. The speaker is still freely brainstorming and may reorder again.

### Proposed new high-level route (supersedes earlier seven/chapter-nine skeleton for discussion only)

| Proposed chapter | Audience question and purpose | What from current v2 should move there |
| --- | --- | --- |
| **00. Opening** | A few terms, definitions, configuration options and experiments that helped me; roughly in discovery order | \`open\`; title fixed as **Configuring Local LLMs** |
| **01. Why run a local model?** | Cost/quotas, independence and verifiable quant/model versions, client data locality, use of smaller sufficient models, and fun | \`why-*\`; Copilot story **short** here, not a lengthy market-collapse argument |
| **02. Getting started: from Ollama to inference engines** | What weights are; training vs inference; GGUF vs weights vs engines; speaker heard Reddit llama.cpp settings and wanted to explore | \`train-vs-infer\`, \`engines\`, \`setup-path\`; the full hardware story follows in chapter 03 |
| **03. How do you fit a useful model on your GPU?** | Hardware choice, eGPU/locality, weight formats, dense/MoE active params, CPU offload, weight precision/AutoRound/NVFP4, total VRAM budget including required KV | \`setup-egpu\`, \`setup-slow-link\`, \`setup-hardware\`, \`gguf\`, \`embed-vec\`, \`quant-what\`, \`quant-types\`, \`nvfp4\`, \`autoround\`, \`moe\`; WSL direct I/O if there is time |
| **04. How do you give it more context?** | Explain forward passes, how KV stores contextual attention key/value vectors instead of raw tokens, cache precision, quality/capacity trade | \`kv-cache\`; bring KV dtype comparisons from older research if useful |
| **05. How do you run several agents at once?** | Prefill vs decode, Tensor Cores vs memory bandwidth, batching, prefix caches, vLLM hashed blocks, SGLang radix trees, llama.cpp slot reuse; actual coding harnesses | \`batching\`, \`prefix-cache\`, \`engines-cache\`; show flags/config and physical sharing caveats |
| **06. How do you make generation faster?** | Draft/verify, native MTP, EAGLE-3, DFlash, DSpark, DFlash2, acceptance logs, extra drafter VRAM, firsthand DSpark training pipeline | \`spec-decode\`, \`mtp\`, \`block-drafters\`, \`shipped-drafters\`, \`drafter-vram\`, \`my-drafter\` |
| **07. What else is worth experimenting with?** | NInfer/Radiance/Pennyroyal, Qwen3.8-Flash-Next, Engram vs PLE, giant sparse n-gram weight tables, VRAM/RAM/NVMe placement, Qwen4 anticipation | \`new-engines\`, \`ngram-tables\`, \`ple\` (careful: Gemma 3n PLE is a different acronym/design) |
| **08. Sharing local models** | Hosted/cloud + local model workflow, optional LLM Collective outbound app tunnel; make models accessible without requiring everyone to self-host | \`share-why\`, \`collective\`, \`collective-request\`; keep public-safe, privacy limits explicit |
| **09. Close / questions** | Trade-offs fit actual hardware and workload; optional Apple Silicon/MLX audience question | \`close\`, \`qa\` |

**Key rearrangement:** the personal Windows eGPU comparison and GGUF/quantization now reinforce one **fit the model** problem. The introductory *inference engine* definitions should come **before** the hardware/quantization details, naturally following Ollama. KV cache deserves its own explanatory bridge from fitting weights to fitting live conversation state. Avoid implying the user’s real experiments took place in one linear order.

### Answers and technical corrections that should inform proposed slide copy

#### What a parameter is

- A model parameter is **one learned numerical value**, usually in weight matrices, embeddings, layer norms, expert routers, expert FFNs, or other learned tensors. **27B** means about 27 billion such values, **not** 27B token types and **not** a 27-dimensional vector.
- **Hyperparameters** are settings chosen for training or architecture, such as learning rate, width, depth or batch size. The distinction: training **changes weights** using gradients; hyperparameter tuning **changes the recipe** or architecture that determines the training run. Some meta-learning exceptions exist but aren't relevant to this talk.
- Qwen3.8-27B's **hidden width 5,120** means a typical hidden state at a token position has 5,120 numerical components. The **vocabulary has 248,320 token IDs** (verify from the actual config used in scene), so an initial embedding table would already contain more than a billion learned values. Tokens need not be whole words.
- **Quantization normally does not remove logical model parameters**. It changes how their values are represented/stored, often packing multiple 4-bit values into 8- or 32-bit storage elements and leaving selected layers at higher precision.
- Hugging Face's **Safetensors parameter total can undercount a quantized model** when it tallies packed storage tensor elements rather than unpacked logical weight values. For example, [derikn's Qwen3.8-27B AWQ card](https://huggingface.co/derikn/Qwen3.8-27B-AWQ-INT4) explicitly says that 8 × INT4 weights are packed inside one INT32 tensor element and states the actual count **27,781,427,952**. [Percivio's NVFP4 card](https://huggingface.co/Percivio/Qwen3.8-27B-NVFP4-all) says each U8 byte packs two NVFP4 weights and the card therefore showed about 15B instead of 27B. This explains apparent **18B** and similar displays; the exact tally depends on format and exempt tensors. **It is not a reduction in the neural network's parameter count**.
- Proposed visualization: 8 independent 4-bit weight slots → 1 INT32 packed element; another view groups 2 × NVFP4 inside U8; show a counter for **logical learned weights**, **tensor storage elements** and **total bytes**, each different. A very useful ~15-second moment early in quantization.

#### What actually moves through memory at decode

- A useful literal phrasing is **"A new token's hidden state goes through the model's layers. The GPU accesses the active weight matrices, one layer after another, to transform that state."**
- In a resident GPU setup, weights typically stay in VRAM, but memory tiles move through GPU caches/shared memory/registers and into SM/Tensor Core computations every time they are used. It's imprecise to describe the entire checkpoint being copied across PCIe each token. For **dense** layers most feed-forward weights participate; in **MoE** only selected expert weights participate per token, plus shared layers/routers/attention.
- GPU data **must be accessible to the operation**, but it is **not universally mandatory that every model weight and all KV reside permanently in GPU VRAM**. Some engines compute offloaded layers/experts on CPU, use GPU reads of mapped host memory, or transfer selected weights to GPU per forward pass. Some offload KV/prefix pages to CPU and restore/stage needed cache portions on demand. This can dramatically reduce speed. [vLLM weight offload](https://docs.vllm.ai/en/latest/api/vllm/) documents CPU↔GPU traffic per forward pass. [llama.cpp server options](https://github.com/ggml-org/llama.cpp/blob/master/tools/server/README.md) distinguish weight offload and KV offload. **Engine choice and architecture matter**.
- Practical VRAM accounting: target weights + **active KV** + reusable prefix KV + recurrent state + runtime buffers + optional speculative drafter weights/state. The speaker's early priority was fitting the model **and** a useful context window, not cramming weights into every byte.
- Suggested visual: resident per-layer weight slabs in VRAM, token-state vector moves through them; a second path for selected CPU-hosted MoE experts with marked slower transfer or CPU execution; a separate KV slab that grows. **Show actual tile traffic, not a token-ball physically pushing the entire model file.**

#### Prefix caching and why an agent benefits

- **Prefill** of an uncached prompt computes the model's internal attention key/value state for its token positions. A subsequent *compatible request with exactly matching tokenized initial prefix* can reuse already computed state and avoid re-prefilling eligible blocks.
- The reused data is **computed contextual attention state**, not "the meaning of the prompt" or an ordered list of raw token strings. Prefix matching itself uses token IDs and relevant model/config/cache isolation metadata.
- VLLM keeps **hash-chain-indexed full KV blocks** with refcounts and a capacity-limited pool. SGLang's **RadixAttention** organizes shared token-prefix spans in a compressed radix tree. llama.cpp has slot-aware prompt reuse but **not necessarily physical KV dedup across simultaneous slots**. Same model-server/compatible settings required; distributed replicas do not magically share KV.
- A "50K Claude Code system prompt" is the speaker's illustrative recollection, **not a verified current token count**. Different harnesses usually have different tool schemas, chat serialization or dates and therefore might have little shared initial prefix. Don't claim all three separate harnesses only pay for the same 50K once.
- Proposed visual: first agent fills a long token prefix with KV blocks (prefill), then agents B/C with the same initial token IDs **reference** those same eligible blocks; branches create independent new K/V, change one early token to illustrate failed reuse, and show eviction under memory pressure.

#### Speculator training vs AutoRound — authoritative from the speaker's home-k8s issues

- **The DSpark drafter was trained using \`vllm-project/speculators\`, including a patched \`dbirks/speculators\` fork** as documented in [home-k8s #59](https://github.com/dbirks/home-k8s/issues/59), [#60](https://github.com/dbirks/home-k8s/issues/60), [#72](https://github.com/dbirks/home-k8s/issues/72), and [#80](https://github.com/dbirks/home-k8s/issues/80). Target model \`unsloth/Qwen3.6-27B-NVFP4\`; extract target hidden states, train the draft network/heads, convert checkpoint, serve and measure acceptance. Its target happened to be **NVFP4-quantized**; that doesn't make \`AutoRound\` the drafter trainer.
- **AutoRound** was used **separately** for quantizing main model checkpoints: [home-k8s #84](https://github.com/dbirks/home-k8s/issues/84), [#110](https://github.com/dbirks/home-k8s/issues/110). Some \`AutoRound\` exports use a format compatible with **LLM Compressor**, which is another quantization toolkit ([#109](https://github.com/dbirks/home-k8s/issues/109)). The speaker **should not** give an example of "training a DSpark with LLM Compressor/AutoRound" unless describing a separate, verified quantization step of weights.
- The training story has a useful honest lesson: target-generated on-policy trajectories, rotary/hidden-state compatibility, checkpoint conversion, **teacher-forced vs free-running acceptance** and careful held-out evaluation. The later **from-scratch agentic-data test was not better** than coding-only data in its conditions; preserve this finding rather than a simple success story.
- A real practical slide could say: **"If you're curious about training a drafter: the vLLM project's \`speculators\` library is what I used."** Add a separate slide for **"If you're curious about quantizing model weights: I used AutoRound."** Never imply Speculators natively *contains* AutoRound.

#### Other speaker details to preserve for late chapters

- **Qwen3.8-27B** was the local model the speaker returned to repeatedly for roughly a couple months; don't frame his setup as constant model-switching.
- **Qwen3.8-Flash-Next** felt snappier to the speaker because of its MoE/active-compute profile; architecture, engine, loading/offload and workload still matter, and **the official card** says ~125B transformer parameters / ~6B activated per token **plus ~51B n-gram embeddings and 4B MTP**. Different actual response rates require measured comparisons. Source [Qwen official model card](https://huggingface.co/Qwen/Qwen3.8-Flash-Next).
- **Engram / PLE lookup tables are learned model weights.** They persist across requests; **a subset of rows is accessed at every newly processed position**, both during initial prefill and later decoding. They are not a one-time first-prompt scan. Reusing an already-computed prefix avoids redoing those model passes. **Pennyroyal's NVMe PLE is an indexed row-access path, not generic MoE weights offloaded to SSD.**
- **Qwen4:** The speaker was anticipating the next generation. **As of November 18, 2026, Qwen announced Qwen4-Max on November 16, 2026** as a hosted model; no official local open-weight Qwen4 family checkpoint is verified as released here. Source [Qwen Qwen4-Max announcement](https://qwen.ai/blog/qwen4-max). Phrase: **"I'm curious to see what open-weight Qwen4 models bring,"** not "Qwen4 hasn't released at all" or a prediction of exact future release/model sizes.
- The speaker uses **Opus 5.5 with the pi agent harness and local models in a hybrid workflow**. **Open architectural question:** which agent delegates to which model and at which steps, and whether any client-controlled data is sent to a hosted model. Draw no call graph until verified. Sensitive client data that cannot leave Windows laptop must not be shown transmitted to a cloud/subscribed endpoint.
- At end, an optional **LLM Collective** example connects independent servers through authenticated **outbound WSS + Yamux** to the central Kubernetes gateway, making public-safe model routing possible without VPN membership. This is remote inference, **not** pooled VRAM or a substitute for a strict local-data boundary.

### Specific copy risks to flag for the coding agent (review, don't silently modify)

- The current \`setup-why\` Copilot slide **duplicates** the short personal price-change motivation now proposed under "Why run a local model?". Merge or cut rather than spending two slides on the same trigger.
- Existing "getting a smart enough model into VRAM" slides claim **"each word"** becomes a vector; prefer token ID and distinguish static embedding from contextual hidden states.
- Current "KV cache keeps that work ... one small step" can imply zero old-cache read cost; it **avoids recomputation of earlier positions** but attention still reads cached history.
- Current batching headline **"one read of the weights, several requests"** and body **"costs little extra"** overstate the ease of all batching cases; more sequences mean more arithmetic, KV/state, scheduling and possibly compute-bound execution. Reuse of weight tiles per batch is the accurate mechanism.
- "The drafter needs its **own full KV**" cannot be generalized to every MTP/DFlash/DSpark implementation; method-specific state/workspaces vary.
- Existing PLE slides show **Gemma 3n's per-layer embeddings** in one variant and **Qwen's n-gram learned-memory/PLE** in another. They use the same acronym for **different architectures**. Label and separate them rather than claiming one is an alternate visualization of the other.
- Source comparisons and performance must distinguish 5090 **rated GDDR bandwidth** from actual WSL eGPU transfer speed, and measured tok/s from speaker observations.

### Workflow for next review pass

1. Continue working with the speaker **chapter titles and a few sections at a time**, not wholesale rewriting the code.
2. Treat all the above as **PROPOSED STRUCTURE**, not consent to change a live route; explicit title and tone are approved.
3. As the speaker narrates, capture the intended learning question, what should be shown visually, one ordinary-language headline and one nuance, plus desired config flags.
4. When speaker approves a set, give coding agent a **copy-only diff** mapping old \`src/slides/v2/*.ts\` IDs to new strings. Avoid touching live 3D builders.

## Next coordination step

1. Speaker reads and corrects **proposed copy for 00–02**, then reads 03–05 exact live text/variants.
2. As opinions emerge, record **approved** changes separately from suggestions.
3. Once wording is approved, the coding agent applies it atomically to the current \`main\` version, preserving variants, scenes and source metadata.
4. A review build checks no outdated \`Beyond “It Runs”\` or inaccurate economic/quantization claim remains on screen.
