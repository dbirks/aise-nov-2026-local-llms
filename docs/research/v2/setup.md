# Deck v2 research packet — chapters 01–03 (why bother, inference basics, the setup)

Research date: **2026-11-18**. Compiled by a research worker; the orchestrator (Claude) must re-verify every
figure that lands on a slide before publishing. Sources are primary where possible (Intel/NVIDIA/AMD/Apple
pages, official engine docs, format specs, GitHub commits). Evidence labels per AGENTS.md / deck-v2-plan:
**MECHANISM** (how it works, no single vendor number), **MANUFACTURER SPEC** (vendor-published, not a measured
throughput/tokens/sec), **MEASURED (by whom)**, **OPEN / VERSION-DEPENDENT**, **UNVERIFIED**.

Slides covered: `why-cost`, `why-independence`, `train-vs-infer`, `engines`, `setup-egpu`,
`setup-slow-link`, `setup-hardware`, `setup-path`.

---

## why-cost

*Cheap tokens might not stay cheap.* [OPINION on the trend; the arithmetic below is the only checkable part.]

### 1. Facts
- Anthropic list price, **Claude Opus 5.5**: **$4.00 / 1M input tokens, $20.00 / 1M output tokens** (USD, global,
  standard tier). Source: Anthropic rate card PDF effective **2026-10-07**
  (https://assets.claude.com/1ef7a4a8e373004bc89d710b0a6f3f219323344f.pdf) and the live pricing page
  https://platform.claude.com/docs/en/about-claude/pricing. **MEASURED (published list price, dated).**
- Same source, **Claude Sonnet 5.5**: **$2.00 / 1M input, $10.00 / 1M output** (standard, global). Prompt-cache
  reads are far cheaper (Sonnet 5.5 cache hits $0.10/MTok; Opus 5.5 $0.20/MTok) — relevant because agents re-use a
  long system prompt. **MEASURED (dated list price).**
- Batch processing is listed at ~50% of standard rates in the same rate card (Opus 5.5 batch $2/$10). **MEASURED
  (dated).**
- Anthropic note: Claude 4.7+ use a newer tokenizer that "produces approximately 30% more tokens for the same
  text"; token counts are model- and workload-dependent, so any dollar figure is only as good as its token count.
  Source: platform.claude.com pricing page. **MEASURED (vendor statement).**
- Speaker uses a Claude subscription and referenced Opus 5.5 (docs/speaker-brainstorm.md). This is context, not a
  claim about a specific bill. **SPEAKER OBSERVATION.**
- "Heavily subsidised" / "prices will rise" / "AI market correction": **UNVERIFIED and deliberately not stated as
  fact** (AGENTS.md / speaker-brainstorm.md: "Do not state subsidies, a crash, or price increases as known facts").
  This is the speaker's opinion/hypothesis. **OPINION.**

### 2. Mechanism, precisely (the only honest number on this slide)
Monthly hosted cost = (input Mtok × input $/Mtok) + (output Mtok × output $/Mtok), optionally minus cache-hit
discounts. The cost is driven by *token volume*, which agent use inflates through repeated long system prompts,
tool schemas, and re-sent history.

Hypothetical worked example (usage numbers invented for illustration; rates are the dated list prices above):
- Heavy agent month ≈ **200 M input tokens + 20 M output tokens**.
- Opus 5.5 @ $4 / $20 per Mtok → 200×4 + 20×20 = **$1,200 / month**.
- Sonnet 5.5 @ $2 / $10 per Mtok → 200×2 + 20×10 = **$600 / month**.
- With heavy prompt-cache reuse the input line can drop a lot (cache reads ≈ 1–2% of input price), which is why
  the same usage on a caching-friendly workload bills far below the naive number. **HYPOTHETICAL / illustrative —
  never a quote.**

### 3. Must not imply
- Do not present any dollar figure as the speaker's real bill or as a quote; label it *hypothetical*.
- Do not state that providers sell tokens below cost, that prices will rise, or that a correction is coming.
- Do not name a provider and accuse it of anything. The comparison is generic "hosted API billing".
- Do not imply local inference is free: the hardware was paid for up front and uses electricity (both unmeasured
  here).

### 4. Visual ideas
- **A — a bill that grows with context.** X = agent turns (0..N, ~8 tiles), Y/Z = a bar whose height = cumulative
  billed tokens; a toggle switches model tier (Opus vs Sonnet) and a second toggle switches "cache re-use on/off"
  that collapses the repeated system-prompt tiles into one paid tile + many cheap reads. Colour: dark tiles = paid
  input, hatch = cache reads. One control (cache on/off) recomputes the total. Sizes ~8 turns. Label *HYPOTHETICAL*.
- **B — $/Mtok ladder.** Horizontal slabs at heights set by each dated list price (input/output for two models);
  a slider drags "monthly Mtok" and the corresponding $ reads off the slab. Only uses the verified rate numbers.
- **C — cost origin split.** Two stacked bands: "subscribed / opinion, unverified" (hatch) vs "documented list
  rate × token count" (solid), visually separating the opinion from the arithmetic.
- Common to all: nothing on screen is a forecast; the forecast lives in the speaker's words, not a chart.

### 5. Open questions for the speaker
- Keep a concrete hypothetical month (e.g. 200 M / 20 M tokens), or drop the dollar figure and keep the argument
  qualitative?
- Which single rate to show (Opus 5.5 $4/$20, or Sonnet 5.5 $2/$10)? Both are dated 2026-10-07.

---

## why-independence

*Your model, your rules.* [SPEAKER OBSERVATION / OPINION — keep provider-neutral, no accusations.]

### 1. Facts
- A locally hosted model is a **pinned artifact**: the exact weight file (GGUF or safetensors) on your disk
  determines the numerics you get. The GGUF/safetensors formats carry the tensors + metadata; what you run is what
  is in the file (see `engines` facts). **MECHANISM.**
- A hosted model is reached through a **model name / API endpoint**; the serving stack behind that name (weight
  revision, precision, quantization, routing, batching) is controlled by the provider, not the caller. It is
  generally true that providers may serve a model at reduced precision and may change serving internals over time.
  **MECHANISM / general industry practice — no specific provider named, no accusation.**
- No specific provider "secretly substituted a quantized model": AGENTS.md says **no evidence is provided for such
  substitutions**; do not assert it. **UNVERIFIED — do not claim.**
- Local = a compliance posture where the data can stay on the machine (this is the *setup-egpu* thread); the
  speaker's own work requires data to stay on the laptop. **SPEAKER OBSERVATION** (verified in
  docs/presentation-production-handoff.md line ~32).

### 2. Mechanism, precisely
Two different control boundaries:
1. Local: `weights file on disk → engine loads them → same file every time`. Changing behaviour requires *you* to
   change the file or flags. The full numeric path is inspectable (config.json, GGUF metadata, quant type).
2. Hosted: `client sends tokens to an API name → provider runs some internal stack → returns tokens`. The client
   cannot see or pin the precision/kernel/routing behind the name; a provider can change them without changing the
   name. Also note: sending to a hosted provider means the prompt leaves your machine.
That is the whole mechanism. "It doesn't change under you" is precisely about **pinning the artifact + flags**.

### 3. Must not imply
- Do not name any provider or allege a specific hidden swap.
- Do not imply local is always better — the speaker actively uses and values hosted subscriptions
  (speaker-brainstorm.md). Frame as control/optionality, not ideology.
- Do not claim local inference is fully private by default if it uses an upstream model you downloaded; privacy is
  about *runtime data locality*, which is a setup property, not an engine property.

### 4. Visual ideas
- **A — pin vs name.** Left: a dark weight-file block with an arrow into an engine box, labelled "you control this
  file". Right: a "?" service box behind a label plate "model name", with a small gear that the *provider's* hand
  turns. One control toggles "you pin it / they change it" and shows the weight-file block morph between quant
  levels only in the provider lane. Sizes: 1 model each side.
- **B — two sliders.** Two parameter rows; in the lane labelled "local" the sliders are enabled; in the lane
  labelled "hosted" the same sliders are greyed and driven by an external pointer. Shows what each party controls.
- No dollar claim, no provider logo, no accusation in any variant.

### 5. Open questions for the speaker
- Keep the "hosted service can swap the quantization or the routing whenever it likes" line as a **general
  capability statement** (true), or soften it to avoid any reading that it happened to you specifically?

---

## train-vs-infer

*Training writes the weights. Inference reads them.* ◆ (reuse v1 `weights-fixed` as variant A.)

### 1. Facts
- Training of a transformer produces a file of numbers called **weights** (parameters); inference runs those fixed
  weights to predict the next token. No measured vendor numbers needed. **MECHANISM.**
- In a decoder-only transformer the inference-time tensors are (per layer): attention projections
  `W_Q, W_K, W_V, W_O` and a feed-forward block (up/gate/down projections), plus layer-norm scales; globally an
  input **embedding** matrix `[V, H]` and an **output/lm_head** matrix `[H, V]`, where `V` = vocabulary size,
  `H` = `hidden_size`. Parameter count, vocabulary size `V`, and hidden dimension `H` are **distinct quantities**
  (AGENTS.md). **MECHANISM.**
- A widely used reference architecture (Llama-family) uses SwiGLU FFN with `F ≈ (8/3)·H` rounded up; GQA shrinks
  the K/V projection widths below `H`. Exact values are model-specific and belong to the model's `config.json`.
  **OPEN / model-dependent — verify against a specific config.json before putting numbers on a slide.**

### 2. Mechanism, precisely (5–12 lines + toy arithmetic)
Training changes the weights; inference reads them.

Single-neuron toy that shows the difference:
- Weights `w = 0.5`, bias `b = 0`, input `x = 2`, target `y = 3`.
- **Inference step:** `pred = w·x + b = 0.5·2 = 1.0`. (Just multiply; nothing changes.)
- Loss `L = ½(pred − y)² = ½(1−3)² = 2`.
- **Training step (gradient):** `dL/dw = (pred − y)·x = (1 − 3)·2 = −4`. With SGD lr `= 0.1`:
  `w ← 0.5 − 0.1·(−4) = 0.9`. Now the *stored number changed*; next `pred = 0.9·2 = 1.8`.
- Training repeats this over a large corpus (backprop computes `dL/dW` for every weight, an optimiser such as AdamW
  updates them). The end product is the file of final `W`'s.
- Inference with the finished file: for a token sequence, look up the embedding row, run the fixed matrix products
  layer by layer, produce a logits vector over `V`, sample one next token, append it, repeat. **No gradient, no
  weight writes** during normal inference.

### 3. Must not imply
- Do not draw inference as "downloading web text each time you ask a question" (handoff A02: avoid this).
- Do not imply weights are updated when a user chats (unless fine-tuning/MoE-routing side effects, out of scope).
- Keep parameter count ≠ vocab ≠ hidden dim visually separate.
- Do not show a specific `H`/`F`/`V` number unless it is read from a named model's config.json.

### 4. Visual ideas
- **A (reuse `weights-fixed`):** grid of weight tiles. In "train" mode a gradient arrow flows back into each tile
  and the tile value changes (toy `0.5 → 0.9`); in "infer" mode the arrows only flow forward through unchanging
  tiles. X = layer depth, one matrix per layer-plane; Y/Z = token flowing. Dark/inverted tiles = actively updated
  in train, frozen in infer. Control: a train⇄infer switch. Toy: 4 layer-planes, 3×3 matrices.
- **B — one-neuron close-up:** show exactly the toy above with `w, x, pred, y` and a dW arrow; then zoom out to a
  matrix of such cells. Recomputed by editing `x` or the learning rate. Legible flat.
- **C — file-boundary split:** left of a hard line = training stack with arrows *into* the file; right = engine
  loading the file and running read-only passes. One control moves the boundary cursor.
- All variants: label forward data flow vs backward weight-update flow with different arrow styles.

### 5. Open questions for the speaker
- Any specific model to name for `H`/`F`/`V`, or keep the toy purely abstract? (embed-vec in ch. 04 will pin
  `hidden_size` for Qwen3.8-27B from its config.json; this slide can stay model-agnostic.)

---

## engines

*An inference engine serves the weights. GGUF and safetensors are file formats, not engines.*

### 1. Facts (each is current-state, primary-sourced)
- **llama.cpp** — open-source C/C++ LLM inference engine built on the **ggml** tensor library; runs **GGUF**
  models; supports CPU+GPU offload. Reference: https://github.com/ggml-org/llama.cpp (and docs/gguf.md).
  **MECHANISM / project self-description.**
- **vLLM** — "a high-throughput and memory-efficient inference and serving engine for LLMs". Core:
  **PagedAttention** (KV-cache managed like OS virtual memory / paging) + **continuous batching**. Origin: UC
  Berkeley Sky Computing Lab. Source: https://docs.vllm.ai/en/latest/ and https://docs.nvidia.com/deeplearning/frameworks/vllm-release-notes/overview.html.
  **Project self-description.** (Their published "up to 24× vs HF Transformers" is a benchmark claim on their
  setup — do not restate as universal; it is theirs, on LLaMA-7B/13B, A10G/A100.)
- **SGLang** — "high-performance serving framework / runtime engine" for LLMs + a structured generation language;
  core is **RadixAttention** (KV reused via a radix tree over shared token prefixes). Source:
  https://docs.sglang.io/ and https://docs.nvidia.com/deeplearning/frameworks/sglang-release-notes/overview.html.
  **Project self-description.**
- **Ollama (current state — the important verified fact):** as of **Ollama 0.30** (blog dated **2026-06-05**) and
  the merged commit **9db4bdb** (2026-05-29, PR #16031, "runner: Remove CGO engines, use llama-server exclusively
  for GGML models"), Ollama **removed its vendored GGML/llama.cpp CGO backend**; **`llama-server` built from
  upstream llama.cpp (via CMake FetchContent) is now the sole inference engine for GGUF models**, and
  **safetensor-based models run on the MLX engine**. Sources: https://ollama.com/blog/improved-performance-and-model-support-with-gguf ,
  https://docs.ollama.com/development , https://github.com/ollama/ollama/commit/9db4bdbad6a4981ad761aa2b603e69e8fb83212c .
  **MECHANISM, dated (2026).** So "Ollama builds on llama.cpp/ggml" is now *literally* true for GGUF, and Ollama
  adds a packaging/config/API layer (Modelfile, model registry) plus an MLX path for safetensors.
- **GGUF** — a **binary container format** for GGML models (successor to GGML/GGMF/GGJT). mmap-friendly, key-value
  metadata, little-endian; tensors may be **F32/F16/BF16** *or* any quantized type (`Q4_0 … Q8_0, Q2_K…Q6_K, IQ1_S…IQ4_XS,
  MXFP4, NVFP4`, enum in ggml/include/ggml.h `enum ggml_type`). Default alignment 32 bytes. **It can be unquantized,
  so GGUF is not inherently "small".** Source: https://github.com/ggml-org/ggml/blob/master/docs/gguf.md .
  **FORMAT SPEC.**
- **safetensors** — a **tensor container format**: `8 bytes = header length N`, then `N` bytes of **JSON** header
  (`{"name": {"dtype": "F16", "shape": [...], "data_offsets": [begin, end]}, ...}`), then a raw little-endian byte
  buffer; designed for **mmap / zero-copy** and to avoid pickle's arbitrary-code risk. It stores tensors of a
  given dtype; **quantization details (e.g. compressed-tensors) live separately, e.g. HF `config.json`**. Source:
  https://github.com/huggingface/safetensors/blob/main/README.md . **FORMAT SPEC.**

### 2. Mechanism, precisely
- A **format** answers "how are the number-tensors packed on disk" (GGUF vs safetensors). An **engine** answers
  "what code loads those tensors and executes the forward pass". They are orthogonal:
  - GGUF (in-engine quant types) → llama.cpp / Ollama's llama-server, also readable by vLLM (lists GGUF support).
  - safetensors (HF checkpoints, bf16/fp8/etc.) → vLLM / SGLang (native HF), and Ollama's MLX path.
- Loading path in one line: `open file → read metadata header for tensor offsets → map/copy tensors to device RAM
  → run fixed forward pass`. Engine differences (PagedAttention, RadixAttention, batching) are all *runtime*
  concerns, not file-format concerns.
- Toy example of GGUF vs safetensors being the *same* weights: one 4×4 matrix stored **BF16 in GGUF** ≈ same values
  as **BF16 safetensors**; storing it as **Q4_K GGUF** shrinks it because each 32-weight block carries a 6-bit
  scale (+ min) and 4-bit codes, **not** because of the `.gguf` extension (llama.cpp Tensor-Encoding-Schemes wiki).

### 3. Must not imply
- GGUF ≠ engine; "Ollama" and "llama.cpp" are not the same command interface (AGENTS.md / handoff).
- GGUF is not "always more compressed" — it can hold FP16/BF16. Reduced size comes from the *quantization scheme*,
  not the extension (handoff B05).
- Do not present vLLM's marketing multipliers as universal speedups; they are benchmark claims on specific setups.
- Keep "engine", "model architecture", and "file format" as three separate labels.

### 4. Visual ideas
- **A — format lane vs engine lane.** Two rows on top = file-format boxes (GGUF, safetensors); two/three boxes
  below = engines (llama.cpp, vLLM, SGLang; Ollama drawn *sitting on* llama.cpp with a small MLX branch). Arrows
  connect compatible pairs (GGUF→llama.cpp/vLLM; safetensors→vLLM/SGLang/Ollama-MLX). Control: click a format to
  light up which engines can read it. Sizes: 2 formats, 4 engines. Boxes only, dark = selected pairing.
- **B — anatomy of a GGUF byte-layout:** a horizontal strip: `magic | version | tensor_count | metadata KV |
  tensor-info array | (pad to alignment) | tensor data`. Sliders change a tensor type BF16→Q4_K and the data block
  shrinks *with a visible per-block scale*, driving home "quant shrinks it, not the format". Toy: 4 tensors.
- **C — safetensors header inset:** show the JSON header `{dtype, shape, data_offsets}` pointing into a byte
  buffer, beside the analogous GGUF tensor-info, to contrast "JSON header" vs "binary header + kv metadata".
- Variant A is the safest headline picture; B/C are the "what's actually in the file" deep-dives.

### 5. Open questions for the speaker
- Show the Ollama→llama-server + Ollama→MLX split explicitly (accurate and dated 2026), or keep Ollama as a simple
  "on top of llama.cpp" box?

---

## setup-egpu

*My work laptop has to stay my work laptop. So the GPU goes in an external enclosure on Thunderbolt 4.* ◆
[SPEAKER OBSERVATION for the constraint and the enclosure; MANUFACTURER SPEC for TB4.]

### 1. Facts
- Speaker's constraint: for relevant client work, data must remain on the **Windows laptop** (Windows + WSL); the
  GPU is an **external enclosure over Thunderbolt 4** (RTX 5090 eGPU). Sources: docs/presentation-production-handoff.md
  lines ~31–32, speaker-brainstorm.md. **SPEAKER OBSERVATION.**
- **Thunderbolt 4 total link: 40 Gb/s. PCIe tunneling up to 32 Gb/s = "PCIe 3.0 ×4"**, and Intel explicitly states
  TB4 does **not** use PCIe 4.0 tunnels — "up to four PCIe 3.0 lanes", no shipping TB4 controller tunnels PCIe 4.0.
  Intel also advertises TB4 "storage speeds up to 3,000 MB/s" over that PCIe tunnel. Sources: Intel Thunderbolt 4
  announcement press deck
  (https://www.thunderbolttechnology.net/sites/default/files/intel-thunderbolt4-announcement-press-deck.pdf), Intel
  Thunderbolt Messaging Guide (2024), and Intel Community answer, 2025-02-23
  (https://community.intel.com/t5/Thunderbolt-Share/About-the-transmission-protocols-supported-by-Thunderbolt-4/m-p/1670168).
  **MANUFACTURER SPEC.**
- **Thunderbolt 5**: 80 Gb/s bidirectional, Bandwidth Boost to 120 Gb/s (transmit), PCIe **4.0 ×4** up to
  **64 Gb/s**. Source: Intel Thunderbolt 5 Technology Brief (2023-09)
  (https://www.intel.com/content/dam/www/central-libraries/us/en/documents/2023-09/thunderbolt-5-technology-brief.pdf).
  **MANUFACTURER SPEC.** (Useful as the "the link is the part that's slow, and TB5 doubles it" comparison.)
- Raw-vs-real: 32 Gb/s ÷ 8 = **4.0 GB/s theoretical** for the PCIe tunnel; after 8b/10b + Thunderbolt framing
  overhead vendors/community put the practical data ceiling around ~3 GB/s (Intel's own "up to 3,000 MB/s" storage
  figure is consistent; Eaton and the Thunderbolt 3 technology brief both note ~22–24 Gbps of usable data after DP
  reservation/encoding). Sources: Intel press deck; Thunderbolt 3 tech brief
  (https://www.thunderbolttechnology.net/sites/default/files/Thunderbolt3_TechBrief_FINAL.pdf); Eaton TB4 explainer.
  **MEASURED / MANUFACTURER-SPEC-derived.**
- Real-world eGPU host↔device **measured** copy bandwidth (Thunderbolt 3, community tools): CL!ng on a TB3 eGPU
  measured **H2D ≈ 16–21 Gbps (~2.0–2.6 GB/s)** and **D2H ≈ 21.5 Gbps (~2.7 GB/s)**; egpu.io consensus is realized
  PCIe tunneling ~22–24 Gbps. Source: egpu.io threads
  (https://egpu.io/forums/mac-setup/low-bandwidth-host-to-device/ ,
  https://egpu.io/forums/thunderbolt-enclosures/technical-questions-on-tb3-pcie-tunnelling-bandwidth/).
  **MEASURED (community, TB3, 2019–2021; not the speaker's own TB4 rig).** Direction is device↔host asymmetric (PCIe
  writes posted / reads non-posted — NVIDIA forum). Treat as an order-of-magnitude "a few GB/s", not a quote for the
  speaker's exact setup.
- **Contrast the eGPU link with the GPU's own VRAM:** the RTX 5090's GDDR7 is rated **1,792 GB/s** (MANUFACTURER
  SPEC). The Thunderbolt link (~3 GB/s) is roughly **two orders of magnitude** below that. This gap is why *where
  the weights live* (in VRAM vs streaming over the link) is the whole story. NVIDIA RTX 5090 page.

### 2. Mechanism, precisely
- An eGPU over Thunderbolt is still a **PCIe device** to the host; Thunderbolt just **tunnels** PCIe (and
  DisplayPort) over one USB-C cable. It presents the GPU at **PCIe 3.0 ×4-equivalent** bandwidth, not ×16, and not
  PCIe 5.0. The GPU's GDDR7 is untouched — that bandwidth applies to work already resident on the card.
- Data-flow consequence: **host→device copies** (loading weights once, or streaming offloaded layers) are
  Thunderbolt-bound (~3 GB/s). Once weights are resident, the **hot loop runs entirely on the card at GDDR7 speed**;
  per-token host↔device traffic is tiny (see `setup-slow-link`).
- The Windows/WSL wrinkle: the GPU must also be presented *into the WSL2 VM* (GPU passthrough / a WSL CUDA path),
  adding a virtualisation layer on top of the Thunderbolt PCIe path — a separate bottleneck from the link itself.
  **OPEN / setup-specific (handoff: do not attribute any crash to page cache without logs).**

### 3. Must not imply
- Do not imply Thunderbolt throttles the GPU's *own* VRAM reads; resident inference does not re-cross the link per
  token (AGENTS.md / handoff B02).
- Do not claim the laptop's Thunderbolt port equals TB4 spec without the speaker's machine model; the ~2.7 GB/s
  figures are **community TB3 measurements**, not the speaker's TB4 box. Say "a few GB/s, order of magnitude".
- Keep "data must stay on the laptop" as the *reason* for the eGPU, not a general privacy guarantee.
- Do not imply remote/shared inference (LLM Collective) meets this on-laptop rule — it does not (handoff line 32).

### 4. Visual ideas
- **A — laptop, cable, box, with two bandwidth meters.** Laptop slab (Windows/WSL) → thin Thunderbolt pipe → eGPU
  box containing a dense VRAM slab. Two labels: Thunderbolt ≈ "a few GB/s" (hatched pipe), VRAM ≈ "1,792 GB/s"
  (dark dense slab). Control: toggle "stream weights over the link" (pipe lights, VRAM idle) vs "weights resident"
  (pipe dark, VRAM slab pulses the hot loop). Toy: 1 model block that either crosses or sits in VRAM.
- **B — TB4 vs TB5 pipe thickness:** two parallel pipes labelled 32 Gb/s and 64 Gb/s feeding the same GPU, with a
  20 GB tile train crossing at visibly different rates; a VRAM slab off to the side labelled 1,792 GB/s. One
  control swaps TB4/TB5. Sizes: one 20 GB file split into ~8 tiles.
- **C — the WSL passthrough stack:** stacked planes: laptop OS → WSL2 VM → Thunderbolt PCIe → GPU, showing the
  path a weight byte takes; label which hops add latency. Keep it as data-flow, no benchmark.

### 5. Open questions for the speaker
- Exact laptop TB4 host controller + enclosure (JHL8xxx / ASMedia / OcuLink?) and the observed link rate — do you
  want the specific TB4 vs TB5 comparison on the slide, or just "slower than VRAM"?
- Do you want the WSL-passthrough layer shown, or is that too much detail for the eGPU slide?

---

## setup-slow-link

*A slow link is fine: the ~20 GB of weights cross once (~20 s), then only a little moves per token.* ◆
[20 GB and ~20 s = SPEAKER OBSERVATION; direction of traffic + per-token payload = MECHANISM.]

### 1. Facts
- Speaker reports the model loads into the eGPU in about **20 seconds** on his connection and he did not notice a
  major inference penalty after load. Source: handoff line ~31. **SPEAKER OBSERVATION (anecdote, not benchmark).**
- Working-set size "~20 GB" is the speaker's figure for a resident model. **SPEAKER OBSERVATION.** (Matches a
  ~27B-class model at ~4–5 bits + KV/workspace, but do not present that reverse-engineering as a spec.)
- Thunderbolt 4 PCIe tunnel = 32 Gb/s = 4.0 GB/s theoretical, ~3 GB/s practical (see `setup-egpu`). **MANUFACTURER
  SPEC / derived.**
- **Arithmetic (the core of this slide, all labelled):** crossing 20 GB at —
  - 4.0 GB/s (TB4 theoretical ceiling) → **5.0 s**
  - 3.0 GB/s (Intel's "up to 3,000 MB/s" storage figure) → **6.7 s**
  - 2.5 GB/s (conservative realized) → **8.0 s**
  - 2.0 GB/s → **10.0 s**
  - **Observed ~20 s implies an effective ~1.0 GB/s**, which is *below* the Thunderbolt link ceiling. **MECHANISM +
    the speaker's number**: so the 20 s is **not link-bound alone** — it also includes disk/NVMe read of the model
    file, format handling/dequantization, tensor placement into VRAM, and (on Windows) the WSL VM I/O path. Label:
    "observed 20 s ≠ 20 GB ÷ link rate; the load is dominated by non-link work."
- Per-token traffic when **all weights are resident on the GPU** = token id in, sampled id (or a logits row) out —
  bytes to a few hundred KB, not gigabytes. **MECHANISM** (detail in §2).

### 2. Mechanism, precisely (what crosses the link, per phase)
- **Load (once, host→device):** the engine reads the model file from storage and copies the weight tensors across
  Thunderbolt into VRAM. Volume ≈ the resident weight size (~20 GB here). This is a bulk, one-shot transfer.
- **Decode, steady state, weights fully on the GPU:** at each step the host→device payload is essentially
  **the new token id (a single integer, or `batch_size` integers) plus tiny control metadata**; the heavy work —
  every weight-tile read, the Q/K/V and FFN matrix products, and **KV-cache reads** — happens **on the card at GDDR7
  bandwidth and never touches the link**. Device→host returns either (a) the **sampled next-token id** (a few bytes —
  this is the default in a server: sampling runs on-device) or, (b) if the client requests the full **logits row for
  the last position only**, a vector of `V` floats: ~**100k–200k tokens typical vocabularies → fp16 ≈ 200–400 KB, fp32
  ≈ 400–800 KB** per token (illustrative arithmetic; do **not** invent a specific model's `V`). Even (b) is tiny
  next to 20 GB.
- **Toy check:** 20 GB crosses once (~20 s observed); then generating 200 tokens even at the *worst* logits case
  (~0.8 MB/token) is ~160 MB total, and in the normal sampled-id case is a few KB — so per-output-token link traffic
  is negligible after load. **MECHANISM.**
- **Where the picture breaks:** if a layer is **offloaded to the CPU** (llama.cpp `-ngl` less than full, MoE
  experts in RAM), then that layer's weights/activations *do* cross the link every token and the per-token traffic
  is no longer negligible. The slide's premise is **full-GPU-resident weights**; state that as a condition. **MECHANISM.**

### 3. Must not imply
- Do not present "~20 s" as derived from the Thunderbolt rate; show that 20 s is slower than the link alone predicts
  and attribute the rest to disk/format/WSL work (unless the speaker supplies a link-only timing).
- Do not imply weights cross the link *per token*. Only the request/response and any offloaded layers cross per
  token, and this slide's case is the weights-resident case.
- Do not confuse the eGPU host↔device PCIe/Thunderbolt pipe with the GPU's internal GDDR7 path.
- Do not state per-token KB figures as the speaker's measured values; the vocab/logits sizes are illustrative unless
  pinned to a named model's `config.json`.

### 4. Visual ideas
- **A — the one big crossing, then a trickle.** Timeline on X. Left: a fat arrow carries ~8 dark 20 GB tiles across
  the Thunderbolt pipe into the VRAM slab (a "~20 s" stopwatch). Right: after load, tiny per-token arrows
  (`token id →` in, `← sampled id` out) with a "bytes/token, not GB" label. Control: a **weights-resident ⇄
  CPU-offloaded** toggle that, when offloaded, grows the per-token arrow and re-routes a layer across the link. Toy:
  8 weight tiles, 5 tokens.
- **B — payload-size zoom:** one decode step magnified: inbound box "1 token id (a few bytes)", outbound box
  "1 sampled id (a few bytes)" vs a greyed "logits row (V floats)" showing the branch where the server samples
  on-device. Recompute by dragging `V` (label "toy", default e.g. 150k → 300 KB fp16) and a "sample on device?"
  toggle. Dark = the small default path.
- **C — load-time breakdown bar:** the ~20 s split into {disk read, format/dequant, Thunderbolt copy, VRAM place/WSL}
  as segments — only the Thunderbolt segment is bounded by ~3 GB/s; the others are "why 20 s > link-only". Mark the
  split **OPEN** until the speaker measures it; default to a single "observed ~20 s" block with no invented split.
- Variant A is the punchline picture; C must not fake segment sizes without a measurement.

### 5. Open questions for the speaker
- Can you capture a real load trace (time-to-first-byte vs total, and a link-only `cudaMemcpy` of a 20 GB buffer)
  so we can honestly split "link time" from "disk/format/WSL time"?
- Is the resident model actually ~20 GB? Which model + quant sets that number?

---

## setup-hardware

*Room or speed: ~128 GB of slower unified memory, or 32 GB of much faster GPU memory.* ◆ (reuse v1 `gpu-choice` as variant A.)

### 1. Facts (capacity + bandwidth = MANUFACTURER SPEC unless noted)
- **NVIDIA RTX 5090**: **32 GB GDDR7**, **512-bit**, memory bandwidth **1,792 GB/s**, PCIe **5.0**. Source: NVIDIA
  official spec page (https://www.nvidia.com/en-us/geforce/graphics-cards/50-series/rtx-5090/). **MANUFACTURER SPEC.**
- **NVIDIA DGX Spark (GB10 Grace Blackwell)**: **128 GB LPDDR5x coherent unified memory**, **256-bit**, memory
  bandwidth **273 GB/s**. Source: NVIDIA official (https://www.nvidia.com/en-us/products/workstations/dgx-spark/ and
  https://docs.nvidia.com/dgx/dgx-spark/hardware.html). **MANUFACTURER SPEC.**
- **AMD Ryzen AI Max+ 395 ("Strix Halo")**: **256-bit LPDDR5x-8000**, up to **128 GB** unified, integrated
  Radeon 8060S (RDNA 3.5). Source: AMD product page
  (https://www.amd.com/en/products/processors/laptop/ryzen/ai-300-series/amd-ryzen-ai-max-plus-395.html and the
  Ryzen AI Halo developer-platform page). **MANUFACTURER SPEC.** **Bandwidth caveat:** AMD's page lists memory
  *type/speed*, not a GB/s figure; the widely-quoted **256 GB/s is derived** (`8000 MT/s × 256 bits ÷ 8`), it is
  **not AMD-published**, and measured bandwidth is lower. Mark the 256 GB/s figure **[derived, not vendor-published]**.
  AMD also allows reserving up to ~96 GB as "graphics memory" via Variable Graphics Memory (driver/OS-dependent, and
  it is still unified LPDDR5, not dedicated VRAM).
- **Apple M4 Max**: up to **128 GB unified memory**, up to **546 GB/s** memory bandwidth. Source: Apple newsroom /
  tech specs (https://www.apple.com/newsroom/2024/10/apple-introduces-m4-pro-and-m4-max/ and
  https://support.apple.com/en-us/121553). **MANUFACTURER SPEC.** (A third unified-memory point: faster than
  Spark/Strix Halo but still far below the 5090's GDDR7, and shared with the CPU.)
- **Price (only where a dated source exists):**
  - RTX 5090 launch **MSRP $1,999 / £1,939**, dated **2025-01-23** (Digital Foundry / TechRadar, both citing NVIDIA's
    launch). **MEASURED (published MSRP, dated, launch price — street prices differ).**
  - DGX Spark / Strix Halo / M4 Max **real prices: UNVERIFIED from manufacturer pages** in this pass. Do **not**
    print "both cost about the same" unless the speaker supplies a **dated source**, else drop it (deck-v2-plan and
    AGENTS.md require prices to have a date+source or be dropped).
- Speaker's actual decision: 24 GB felt too cramped, wanted Windows/WSL *integration* (eGPU), so he did **not** pick
  a standalone 128 GB box; DGX Spark was attractive on capacity. Source: handoff line ~31. **SPEAKER OBSERVATION.**

### 2. Mechanism, precisely
- **Capacity** decides *whether a model + KV + activations fit at all*. **Bandwidth** decides *how fast each token's
  weight reads arrive* (decode is usually bandwidth-bound). These are **separate axes** (AGENTS.md).
- The trade in one line: a 128 GB unified box (Spark 273 GB/s / Strix ~256 GB/s derived / M4 Max 546 GB/s) can
  *hold* a model the 32 GB 5090 physically cannot (e.g. a 40 GB resident target), but every token it *does* hold is
  read ~4–7× slower than off the 5090's 1,792 GB/s GDDR7. Conversely a model that fits in 32 GB runs on far faster
  memory but no more room.
- Toy comparison: a target that needs 40 GB resident → **does not fit** the 5090 regardless of bandwidth; it fits
  the 128 GB box but is bandwidth-bound. A 24 GB target → fits both, but the 5090 reads weights ~1,792/~273 ≈ **6.6×**
  the rated bandwidth of the Spark. **Do not turn that 6.6× bandwidth ratio into a tokens/sec speedup** — kernel
  efficiency, batch size, offload and the eGPU link all intervene; it is a *bandwidth* ratio only. **MECHANISM.**

### 3. Must not imply
- **Do not compute a bandwidth ratio and call it model speedup** (handoff B01). No tokens/sec inferred from GB/s.
- Do not claim DGX Spark is "globally slower" — capacity may enable a model the 5090 cannot hold at all.
- Do not present 256 GB/s (Strix Halo) as an AMD-published spec; it is derived and measured is lower.
- Do not put manufacturer peak, a community benchmark and a speaker measurement on one "comparable" scale
  (handoff B02). Keep the unified-memory box and the standalone-GPU-over-Thunderbolt as architecturally different.
- Prices: only with a dated source. The $1,999 is a **dated launch MSRP**, not current street price.

### 4. Visual ideas
- **A (reuse `gpu-choice`):** two memory containers to scale — **128 GB / 273 GB/s** (Spark) and **32 GB / 1,792
  GB/s** (5090), with the M4 Max 128 GB / 546 GB/s and Strix 128 GB / ~256 GB[s derived] as optional third/fourth
  vessels. Container *volume* = capacity; a labelled *pipe/throttle size* = bandwidth (dark = high bandwidth). No
  tok/s anywhere.
- **B — fit test.** A draggable model+KV blob (~40 GB) into each container: it fills/overflows the 5090 (label
  "does not fit, regardless of speed") and sits in the 128 GB box (label "fits, bandwidth-bound"). One control =
  blob size (20→60 GB). Sizes: 2 containers, 1 model block split into weight+KV tiles.
- **C — capacity vs bandwidth quadrant.** X = capacity (32 → 128 GB), Y = bandwidth (273 → 1,792 GB/s), each
  device a labelled point (Spark low-bandwidth/high-capacity, 5090 high-bandwidth/low-capacity, M4 Max mid, Strix
  low-bandwidth/high-capacity). Mark the *axes are rated specs, not speed*. One control highlights a device's spec
  card. Keep the Strix point flagged [derived].
- Show eGPU only where relevant: note the 5090 number is its *VRAM* bandwidth; over Thunderbolt the host↔card path
  is ~3 GB/s (from `setup-egpu`/`setup-slow-link`) — do not merge the two numbers into one pipe.

### 5. Open questions for the speaker
- Keep the price line (only the dated RTX 5090 launch MSRP $1,999 is verifiable; the Spark/Mac/Strix side has no
  dated manufacturer price found here) or drop prices entirely?
- Which unified-memory box(es) to feature — DGX Spark, Strix Halo, M4 Max, or a subset — and are those the
  comparisons you actually weighed?

---

## setup-path

*Ollama, then llama.cpp, then vLLM.* [SPEAKER OBSERVATION for the journey; MECHANISM for what each step added.]

### 1. Facts
- Speaker's path: started on **Ollama**; saw people tuning flags (Reddit), wanted that control; tried **llama.cpp**
  (fit memory better at times) and moved to **vLLM** for more concurrency. Sources: handoff lines ~33, ~18.
  **SPEAKER OBSERVATION (not universal verdicts).**
- Community-shared llama.cpp launch options and Reddit experiments nudged him beyond Ollama. **SPEAKER OBSERVATION.**
- Verified current mechanism behind "Ollama → control" (same as `engines`): Ollama 0.30 (2026-06-05) + PR #16031
  (2026-05-29) make **llama-server (upstream llama.cpp) the sole GGUF engine**, safetensors on MLX — so "moving to
  llama.cpp" gives the underlying engine directly, with its flags. **MECHANISM, dated.**
- llama.cpp knobs that give "that control": `-m model.gguf`, `-c/--ctx-size`, `-ngl/--n-gpu-layers` (CPU/GPU layer
  placement), `--cpu-moe`, `-ot` tensor overrides, `--moe-cache-mib` hot-expert caching. Source: llama.cpp server
  README (https://github.com/ggml-org/llama.cpp/blob/master/tools/server/README.md). **VERSION-DEPENDENT** — verify
  exact flag syntax against the pinned version before showing runnable commands (AGENTS.md).
- vLLM's reason to exist at this step: **concurrency** — PagedAttention + continuous batching + prefix caching
  (https://docs.vllm.ai/en/latest/). Relevant flags: `--max-model-len`, `--gpu-memory-utilization`,
  `--enable-prefix-caching`, `--max-num-seqs`. **VERSION-DEPENDENT.**

### 2. Mechanism, precisely
- The path is a widening of the **control surface**, not a quality ladder:
  1. **Ollama** — packaging/registry + a friendly API on top of llama.cpp (and MLX for safetensors); sensible
     defaults; fewer exposed knobs.
  2. **llama.cpp** — the engine itself; direct access to layer offload (`-ngl`), context size, quant placement,
     MoE expert placement/caching → fits more model into more machines (at the cost of CPU/lower-bandwidth offload).
  3. **vLLM** — a **serving** engine; reorganises KV memory (PagedAttention) and schedules many sequences together
     (continuous batching) to raise **aggregate throughput** under concurrency, which is what running several coding
     agents needs.
- One-line toy of what changes per step: same fixed weights (from `train-vs-infer`); the engine only changes *how
  the resident tensors are executed and scheduled*, e.g. which layers live in VRAM (llama.cpp) and how many requests
  share one weight read (vLLM). No retraining.

### 3. Must not imply
- "llama.cpp fit better, vLLM for concurrency" is the speaker's experience, **not universal verdicts** (handoff 33).
- Do not imply newer = better across the board; each engine trades breadth vs specialization.
- Do not show a runnable command without pinning the version; the exact flag semantics change (AGENTS.md).
- Ollama and llama.cpp are not the same command interface; do not imply their flags are interchangeable.

### 4. Visual ideas
- **A — widening control surface.** Three stacked platforms (Ollama on top, llama.cpp middle, vLLM base); as the
  camera steps down, more labeled control tiles (-ngl, ctx, cpu-moe / max-model-len, max-num-seqs) light up dark.
  Same weight-file box persists across all three (the weights don't change, only the engine). One control = which
  engine is selected. Sizes: 3 engines, ~5 control tiles.
- **B — one workload, three stacks.** A single request queue entering three side-by-side engines; the visible
  difference is *how many requests get batched* and *what's offloaded*, not model quality. No tok/s unless measured;
  label **simulated** if animated. Sizes: 3 lanes, 4 requests.
- **C — the flags that mattered.** Ollama default card → an arrow to a llama.cpp card with 2–3 flags highlighted
  (the Reddit-tuning moment), arrow to a vLLM card with 2–3 concurrency flags. A plain data-flow diagram, not a
  flag-by-flag tour.
- Keep the "why" as: same weights, growing control; do not imply quality differences between engines.

### 5. Open questions for the speaker
- The three flags that most changed your experience at each step (llama.cpp and vLLM) — for an honest, minimal
  "these are the ones I actually used" card (versioned).
- Roughly when in the timeline each engine entered, if you want the slide to hint at ordering/dates.

---

### Cross-slide source list (verified this pass, 2026-11-18)
- Intel Thunderbolt 4 press deck (40 Gb/s, PCIe 32 Gb/s = PCIe 3.0×4, storage up to 3,000 MB/s); Intel TB4
  Community answer 2025-02-23 (no PCIe 4.0 tunnels); Intel Thunderbolt 5 Technology Brief (80/120 Gbps, PCIe 4.0×4
  up to 64 Gb/s); Thunderbolt 3 tech brief + Eaton explainer (usable-data-after-overhead context).
- egpu.io community measurements (CL!ng TB3 eGPU H2D ~16–21 Gbps, D2H ~21.5 Gbps; realized ~22–24 Gbps); NVIDIA
  dev-forum note on PCIe H2D/D2H asymmetry.
- NVIDIA RTX 5090 spec page (32 GB GDDR7, 512-bit, 1,792 GB/s, PCIe 5.0); NVIDIA DGX Spark page + user guide
  (128 GB LPDDR5x, 256-bit, 273 GB/s); AMD Ryzen AI Max+ 395 / Ryzen AI Halo pages (256-bit LPDDR5x-8000, up to
  128 GB; **256 GB/s is derived, not AMD-published**); Apple M4 Max newsroom + tech specs (up to 128 GB, up to
  546 GB/s).
- Anthropic rate card PDF effective 2026-10-07 + live pricing page (Opus 5.5 $4/$20, Sonnet 5.5 $2/$10 per MTok;
  tokenizer ~30% more tokens note).
- llama.cpp repo + docs/gguf.md + server README + Tensor-Encoding-Schemes wiki; ggml GGUF spec; HuggingFace
  safetensors README; vLLM docs/NVIDIA overview + PagedAttention blog; SGLang docs/NVIDIA overview; Ollama docs +
  blog (2026-06-05) + commit 9db4bdb (2026-05-29).

### UNVERIFIED / needs the speaker or orchestrator before it reaches a slide
- Speaker's real TB4 host↔device link rate and the 20 GB / ~20 s load split (link vs disk/format/WSL).
- Whether "~20 GB" is the actual resident size, and which model+quant.
- Any DGX Spark / Strix Halo / Mac Studio **current prices with a dated source** (only the RTX 5090 $1,999 dated
  launch MSRP was found; "both cost about the same" is otherwise UNVERIFIED).
- Strix Halo "256 GB/s" must be labelled derived, not vendor-published.
- Exact llama.cpp / vLLM flag syntax (pin the version before showing runnable commands).
- Any specific model's `hidden_size`/`V`/`F` (belongs to ch. 04 embed-vec; keep ch. 01–03 abstract or config.json-sourced).
