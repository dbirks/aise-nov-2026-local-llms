# v4 slide-copy implementation handoff — 2026-11-18

**Status: READY TO IMPLEMENT**  
**Requested by the speaker:** 2026-11-18, after review of v4 Chapters 02–07.  
**Base examined:** \`main\` @ \`252c1890c6b78ce21c34e15dc1c24423cfafc379\`. **Re-fetch latest \`main\` before editing; another coding agent may have pushed meanwhile.**  
**Implementation target:** \`src/decks/v4.ts\` — active root and \`/4/\` deck.  
**Do not edit:** archived v1/v2/v3 decks, slide scene builders, older long research handoffs, or existing Chapter 01 wording.  
**Scope:** fill v4's Chapters **02–07** and a new, simple Chapter **08 — What I learned next** with text list pages; keep the pre-existing 01 pages exactly as they are; replace the old empty Chapter 08 ("What to explore next") with the new one. End with a **Questions?** content page as the last slide in Chapter 08.  
**This is a concrete implementation handoff, not general brainstorming.** The agent already polling for handoffs can read and apply it. This document does not start or configure the polling automation.

## Hard requirements

1. **Keep speaker's short, unfrilly wording.** Page title plus one or a few short phrase bullets; sub-bullets when specified; no paragraph copy, no extra explanations on slides, no speaker notes. Use v4's existing square-bullet look, phrase style and punctuation convention.
2. **No 3D scenes or decorations** required; the speaker explicitly moved to a **slim v4 text-first deck**. This supersedes the 3D-heavy requirements of historical handoff files for this implementation.
3. Keep first chapter **exactly intact**: Pricing, Stability, Fun, Hosted models are really good, The largest model isn't always necessary (including any empty bullet lists). Do not "improve" those slides.
4. Preserve the **user-dictated headlines and bullets** below. Technical caveats after the slide plans are for agent validation and potential speaker clarification, not an invitation to rewrite his voice.
5. All flags must be correctly spelled **and version/model dependent**. Don't add extra obscure flags. Do not imply any CLI below is an independently validated whole-model production launch command.
6. Support sub-bullets via the **existing \`subs\` property** seen on v4's Pricing slide, or a component already in the deck; don't fake indentation with extra spaces inside plain \`items\` when proper sub-bullet support exists.
7. Avoid modification of the title: the current **Configuring Local LLMs** is correct.
8. No separate chapter/page on "parameters" in Getting started. The speaker explicitly declined it.
9. **Drop** previous planned engine comparison (vLLM hash-blocks vs SGLang radix tree vs llama.cpp slots), batching/roofline deep dives, long EAGLE-3 breakdown, dedicated model-offload flags for vLLM, specialized engines/Engram/Qwen4 deep-dive pages, and extra wrap-up commentary. The new Chapter 08 is a **single simple list page**, not the old "What to explore next" research chapter. This v4 run ends at Questions.

---

## Exact requested slide order / copy

### 01 — Why run things locally? [UNCHANGED]

Copy all currently present slides unchanged from the newest v4 branch. At base commit this is:

- Pricing; "The pricing model won’t change underneath you" with Copilot sub-bullet; "Heavily subsidized tokens can’t last forever"
- Stability; "The quantization level won’t switch out from underneath you"; "Theoretically less downtime"
- Fun; empty
- Hosted models are really good; "Subscriptions are a great deal right now"; "They’re called frontier models for a reason"
- The largest model isn’t always necessary; empty

**Do not edit any of the above** even if wording issues remain for a later review.

### 02 — Getting started [2 pages]

**Page: Training and inference**

- Training
  - Learning patterns from large amounts of text, code, and other data
  - Requires enormous amounts of compute
- Inference
  - Running the trained model to generate responses
  - Requires much less compute than training

Implementation layout: "Training" and "Inference" should be two top-level bullet headers with nested \`subs\` rows or equivalent. No parameter-count explanation added.

**Page: What is an inference engine?**

- Download model weights, often from Hugging Face
  - GGUF or safetensors
- Load the model into GPU memory
- Process prompts and generate tokens
- Serve requests through an API

The format sub-bullet is attached to "Download model weights". The slide is a practical GPU-hosting overview, not a universal assertion that CPU-only inference cannot exist.

### 03 — Fitting a model into VRAM [5 pages]

**Page: What needs to fit?**

- Model weights
- KV cache for the conversation

**Exactly two bullets.** The runtime needs some additional working space, but the speaker explicitly chose **not** to list it on-screen.

**Page: Quantization**

- Reducing the precision of the model's weights
- Examples
  - Q8, Q5, Q4
  - W4A16
  - NVFP4

Use a sub-bullet grouping under "Examples". If you decide to add a colon after "Examples" solely for typography, keep the text short. Do not invent a quantizer UI; no 3D requested. W4A16 is a weight/activation precision convention, while NVFP4 is a specific number format; these examples are intentionally a brief orientation, not an exhaustive taxonomy.

**Page: Dense vs. Mixture of Experts**

- Dense example: Qwen3.8-27B
- MoE example: Qwen3.6-35B-A3B

**Exactly those two bullets.** The user will explain expert routing verbally.

**Page: MoE offloading**

- Move some expert weights into CPU RAM
- llama.cpp: \`--n-cpu-moe 6\`

**Only the llama.cpp example.** The speaker specifically withdrew the vLLM CPU-offload example. The example value \`6\` means expert tensors of the **first six MoE layers** live on CPU—not "6%" or "10%" of all model memory, and not only experts that are never active. Refer to [llama.cpp server options](https://github.com/ggml-org/llama.cpp/blob/master/tools/server/README.md).

**Page: Choosing hardware**

- Memory bandwidth
  - RTX 5090 — 32 GB at 1,792 GB/s
  - DGX Spark — 128 GB at 273 GB/s
  - M5 Max — up to 128 GB at 614 GB/s
  - M5 Ultra — up to 512 GB at 1,200 GB/s
  - AMD R9700 — 32 GB at 640 GB/s

The bullet heading is **Memory bandwidth**. Put the comparable *capacity + manufacturer-rated bandwidth* specs as five nested bullets, as requested. Display a discreet label **"Manufacturer-rated bandwidth"** if easily supported in the current text layout, **without inventing measured tokens/sec**. Memory capacities include maximum configurations for the Apple chips; bandwidth varies across models/configurations. Verify exact M5 chip releases and configurations if the published device spec has since changed. Vendor references: [RTX 5090](https://www.nvidia.com/en-us/geforce/graphics-cards/50-series/rtx-5090/); [DGX Spark](https://docs.nvidia.com/dgx/dgx-spark/hardware.html); [Apple Mac Studio technical specifications](https://www.apple.com/mac-studio/specs/); [AMD Radeon AI PRO R9700](https://www.amd.com/en/products/graphics/workstations/radeon-ai-pro/radeon-ai-pro-r9700.html). Treat these as rated specs, not workload benchmarks.

### 04 — More context [2 pages]

**Page: KV cache**

- Without this, each new message has to recompute all that came before

Then **below the bullet** show compact engine-specific CLI flags (as two short subordinate lines, using existing list/sub-bullet or command formatting; don't add a full page):

- llama.cpp: \`--ctx-size 32768 --parallel 4\`
- vLLM: \`--max-model-len 32768 --kv-cache-memory-bytes 8G\`

The flags are **illustrative independent settings**, not a recommended equal-capacity apples-to-apples comparison. \`--ctx-size\` sizes a llama.cpp context/KV budget that interacts with parallel slots; \`--max-model-len\` is a vLLM per-request max, and \`--kv-cache-memory-bytes\` explicitly reserves a cache capacity (here 8 GiB) rather than making two runtimes "the same". If the agent believes showing \`8G\` as an arbitrary sample is misleading, replace only the numeric value with a clearly marked placeholder and flag the concern to the speaker; retain the flag. vLLM also has \`--gpu-memory-utilization\` as an alternative sizing approach, not a setting that must appear on this slide.

**Technical wording concern to preserve for later speaker review:** the speaker explicitly dictated "each new **message**" here. In standard autoregressive decoding, the strongest statement is "each new **token** would need the earlier positions recomputed" absent KV; across new API messages or requests, persistence depends on serving engine/slots/prefix caching. **Do not silently change his bullet**; mark the caveat for subsequent editorial review.

**Page: Quantizing the KV cache**

- It's possible to quantize the KV cache as well

Then these concise engine flag examples underneath:

- llama.cpp: \`--cache-type-k q8_0 --cache-type-v q8_0\`
- vLLM: \`--kv-cache-dtype fp8\`

These are independently supported choices for suitable hardware/models, not guaranteed for all combinations; k/v dtype q8_0 and fp8 are not identical formats. The \`-ctk\`/\`-ctv\` aliases exist but the long flags are preferred on-screen as the speaker requested.

### 05 — Running requests in parallel [2 pages]

**Change the v4 section title** from "Several agents at once" to **"Running requests in parallel"** (speaker referred to that as the new chapter topic).

**Page: Running requests in parallel**

- One agent is nice, but two is nicer

Engine flags below:

- llama.cpp: \`--parallel 4\`
- vLLM: \`--max-num-seqs 4\`

These are **example values**. Parallel llama.cpp slots and vLLM maximum scheduled sequences are not perfectly identical concurrency controls. Do not promise four requests every time regardless of memory pressure.

**Page: Prefix caching**

- Not having to recompute the KV cache

Engine flags below:

- llama.cpp: \`--cache-prompt --cache-ram 8192\`
- vLLM: \`--enable-prefix-caching\`

**No separate slides comparing vLLM/SGLang/llama.cpp prefix data structures.** The \`--cache-prompt\` flag controls llama.cpp prompt reuse (enabled by default in current llama-server docs); \`--cache-ram 8192\` is a RAM prompt-cache budget **in MiB** (and not equivalent to shared physical GPU KV blocks in vLLM). llama.cpp also has slot matching and other flags, but don't clutter the slide. Note for a later copy pass: prefix caching means reuse of **already computed keys and values for an identical tokenized prefix**, rather than "recomputing the KV cache" itself; this was the speaker's exact phrasing, so preserve it now but record the caveat.

### 06 — Making things faster [2 pages]

**Page: Speculative decoding**

- A small drafter model tries to predict the next several upcoming tokens
- The main model still has to accept the predictions
- Different types: MTP, DFlash, DSpark, DFlash2

The first two bullets follow the speaker's wording. The third is the *same page*, not a separate comparison. No EAGLE-3, benchmarking or drafter VRAM page is requested in this trimmed deck. Technical caveat for development only: **native MTP isn't always a separate small model**, and verification semantics at sampling temperature are more nuanced than an equality check. The live bullet introduces the common external-drafter case.

**Page: Training your own drafter**

- Recommended library: \`vllm-project/speculators\`

**Exactly one bullet.** Do not expand into an elaborate personal drafter-training case study; that is in older technical handoffs if needed for audience questions. This is **not** Intel AutoRound / LLM Compressor; those are separate weight-quantization tools.

### 07 — Sharing local models [1 page]

**Page: LLM Collective**

- Models running at different people's homes
- A small Go binary runs at home and phones home to a central gateway
- The gateway handles API keys and sends requests to the right machine

Don't insert protocol details or turn this into a networking tutorial. The verified implementation uses authenticated outbound WebSocket with Yamux carrying streams, but only include them if the speaker later asks. Do not show private gateway addresses, token secrets, internal model inventories or imply pooled VRAM. The gateway checks client API keys and contributor authentication separately; concise audience copy above is intentionally simplified.

### 08 — What I learned next [2 pages]

**New section requested by the speaker.** Keep this short and text-only. Place the section immediately **after Sharing local models and before Questions?**; replace the previous empty "What to explore next" section rather than appending a duplicate.

**Page: What I learned next**

- N-gram weights
- How the model training process works in more detail
- Conceptualizing how a token flows through the model

**Exactly those three bullets**, preserving the speaker's phrasing. This is a preview of future learning topics, **not** a technical explanation page or a request to create 3D illustrations.

**Page: Questions?**

No bullet points. **This is the final page** in the new Chapter 08. No extra section divider, outro, or content after it.

---

## Developer implementation notes — keep off screen

**Existing structure:** \`src/decks/v4.ts\` currently defines \`const SECTIONS\`, \`const page(id, title, items)\`, section divider generation and page numbers. Extend the page declarations carefully and preserve existing code patterns. \`ListSlide\` supports \`subs?: Record<number, string[]>\`; the existing \`pricing\` page demonstrates nested bullets. For pages with flags, you may use simple extra list rows with code-formatted text **only if the layout renders Markdown/backticks as code**; otherwise show the literal flag with appropriate monospaced typography or plain text, without the backtick characters. Keep source code strings appropriately escaped. Prefer a compact \`pageWithSubs\` helper if necessary, but don't rewrite the deck framework.

**Flag verification (as of November 18, 2026):**

- **llama.cpp source of truth:** [official llama-server reference](https://github.com/ggml-org/llama.cpp/blob/master/tools/server/README.md), covering \`--ctx-size\`, \`--parallel\`, \`--cache-type-k\`, \`--cache-type-v\`, \`--cache-prompt\`, \`--cache-ram\`, \`--slot-prompt-similarity\`, \`--n-cpu-moe\`, \`--kv-unified\`. The latter two cache-sharing features are separate from actual physical cross-slot deduplication.
- **vLLM source of truth:** [latest vllm serve CLI](https://docs.vllm.ai/en/latest/cli/serve/), covering \`--max-model-len\`, \`--kv-cache-memory-bytes\`, \`--kv-cache-dtype\`, \`--max-num-seqs\`, \`--enable-prefix-caching\`. Some defaults and available precisions change by release/model/backend. Pin the package version used in any runnable demo.
- **Attributions/precision:** the title "Fitting a model into VRAM" is the *goal*, not a blanket statement that CPU offload is impossible. Display 32 GB/128 GB as vendor memory capacities and peak BW with GB/s, not as direct throughput predictions.
- **Citation/source metadata can go in source comments** or a separate notes file used by developers, but **the speaker will not use presenter notes**. Do not ship secret internal details from home-k8s or LLM Collective.
- **Do not restore** the v1/v2/v3 3D visualization backlog simply because older docs have a "primary" tag. This user direction and current v4 source supersede them.

**Acceptance checks:**

1. Root and \`/4/\` render v4 unchanged in visual design, with v3/v2/v1 archives still accessible.
2. Section 01's existing five pages are byte-for-byte unchanged (except automatic page numbering caused by overall deck size).
3. Sections 02–08 have **2, 5, 2, 2, 2, 1, 2 pages** respectively; final content slide is "Questions?". **Chapter 08 is "What I learned next"**, with one three-bullet page followed by the Questions page.
4. **21 content pages** = 5 existing Section 01 + 16 new; **8 section dividers + 1 title = 30 total pages**.
5. All CLI options use valid long names and the spellings above. Screenshots confirm sub-bullets are nested, code flags are readable on a projector and long hardware lines don't overflow.
6. Run \`pnpm build\` (plus any repo-specific lint/tests); check \`src/main.tsx\` still routes v4 at root and \`/4/\`.
7. **Commit and push** implementation as a normal atomic change on latest \`main\`; preserve concurrent changes and report the final commit.

