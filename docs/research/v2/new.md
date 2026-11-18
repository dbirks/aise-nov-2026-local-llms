# v2 research packet — chapter 08: new engines, n-gram tables, PLE

Research date: 2026-11-18. All URLs fetched and quoted on this date unless noted.
Slides covered: `new-engines`, `ngram-tables`, `ple` (docs/deck-v2-plan.md §08).
Evidence labels: **[MECHANISM]** paper/source/config, **[MANUFACTURER SPEC]**, **[MEASURED by whom]**,
**[OPEN / VERSION-DEPENDENT]**, **[UNVERIFIED]**.

Companion facts already in presentation-production-handoff.md §F01–F04 are re-verified here; nothing
was copied without re-checking the primary source.

---

## new-engines

Working title: *Newer engines: NInfer, Radiance, Pennyroyal.* Three specialized runtimes the speaker
actually encountered, each tuned to a narrow hardware/model target. Reuse v1 `engine-map` builder.

### 1. Facts

**NInfer — https://github.com/Neroued/ninfer** (the speaker's https://github.com/dbirks/ninfer is his
copy/fork of this project; handoff §F01 links it as background)

- "Native C++/CUDA inference for selected models on RTX 5090 and DGX Spark." From-scratch C++20/CUDA
  engine; deliberately specialized: one GPU, one resident model, startup-fixed capacity of 1–8
  concurrent requests (README + Zread overview). **[MECHANISM]**
  https://raw.githubusercontent.com/Neroued/ninfer/master/README.md
- Supported matrix (README "Supported models and deployments", fetched 2026-11-18): Qwen3.6-27B /
  Qwen3.8-27B (RTX 5090, MTP; DFlash2 for 3.8-27B with companion weights); Qwen3.6-35B-A3B (RTX 5090,
  resident or CPU expert offload); Qwen3.8-Flash-Next / Qwen4Exp (RTX 5090 with CPU expert offload, or
  one/two DGX Spark, TP2(+EP2), MTP); GLM-5.3-Flash (two Sparks). Architecture note: x86-64 `sm_120a`
  for RTX 5090, AArch64 `sm_121a` for Spark. **[MECHANISM / VERSION-DEPENDENT at HEAD]**
- Weights are re-packaged into versioned `.ninfer` v3 artifacts (weights+config+tokenizer+template),
  published under `neroued/*` on HF; Flash-Next artifact is 101.00 GiB across four files, mixed
  NVFP4/Q8/NF4. **[MECHANISM]** — note this is a *new container format*, alongside GGUF/safetensors,
  not a GGUF loader.
- Self-measured decode throughput (README tables; "measured November 15–16, 2026", CUDA Graphs, MTP3):
  single DGX Spark, Qwen3.8-Flash-Next: C=1 70.0 tok/s, C=8 226.4 tok/s; dual Spark TP2: C=1 109.5,
  C=32 811.9 tok/s aggregate; RTX 5090 Qwen3.8-27B NVFP4: C=1 147.7, C=8 922.4 tok/s aggregate.
  **[MEASURED — by the NInfer project itself, conditions on their docs/performance pages; NOT
  independently verified]**
- Status: active, Apache-2.0, created 2026-06-26, 3.4k stars (GitHub metadata via search). Community
  ports exist for older cards (hidoba/ninfer-3090, xkeyC/ninfer-4090 — forks re-tuned to GA102/sm_89),
  which is itself the talk's point about narrow specialization. **[MECHANISM]**
- How NInfer places Flash-Next's 51B n-gram table (VRAM/RAM/SSD) is not stated in the README.
  **[UNVERIFIED]** — don't claim it.

**Radiance — https://github.com/Quackster/radiance (canonical source: codeberg.org/StillDeadcode/radiance; site: https://radiance.stilldeadco.de)**

- "An inference server for AMD GPUs, in C++ and HIP: language models, and image, video, speech and
  music generation." Single process serves several models at once; HTTP API speaks OpenAI chat/
  completions/Responses/images/audio/video, Anthropic Messages, and llama-server's native API, so
  existing clients work unchanged. **[MECHANISM]** README, fetched 2026-11-18.
- Kernels (`libr4d`) target AMD RDNA4 (`gfx1200`, `gfx1201`) — i.e. the Radeon AI PRO R9700 class the
  coworker runs; **not CUDA, not ROCm-vLLM**. Engine starts on any AMD family given a kernel library;
  architectures/kernels/quantizers are `.so` plugins. No GPU → host backend (AVX-512/AVX2) serves all
  bundled models. **[MECHANISM]**
- Model support (README table): Qwen3.8-Flash-Next (4-bit experts + int8 trunk, MTP, vision; 114 GiB
  `.rad` container), Qwen3.8-27B FP8 (29 GiB) / MXFP4 via AMD Quark (19 GiB) with DFlash2 drafter,
  Qwen3.6-35B-A3B FP8, MiniCPM5-2B w/ DSpark, Gemma 4 31B W4A8 + MTP, plus Qwen-Image, MiniMax video/
  music, TTS, embeddings. Own `.rad` container format + `rad-convert` recipe system. **[MECHANISM]**
- TP 1–8 ranks over AMD cards (lossy int8 wire options at 3–4 ranks); hybrid models capped to 8
  sequences because each sequence holds recurrent state. **[MECHANISM]**
- Self-measured points (README): Gemma 4 31B on two R9700: 103 tok/s prose / 141 code decode.
  **[MEASURED — by the Radiance author]**. Third-party: senn-tech blog measured Qwen3.8-27B on one
  R9700, Nov 16–17 2026: Radiance 59–61 tok/s vs vLLM-on-ROCm 19–28.
  **[MEASURED — third-party hobby blog, single setup; label the source if shown]**
  https://senn-tech.com/en/blog/zwei-r9700-radiance-qwen38-27b-messung
- Status: active; the earlier `stilldeadcode/vllm-radiance` Docker image is explicitly deprecated in
  favor of the standalone engine ("faster, easier to work on … lower energy cost"). **[MECHANISM]**
- Lineage note: Quackster/radiance (GitHub) and the stilldeadco.de site/Patreon are the same
  StillDeadCode project; README credits "Deadcode and the radiance contributors". **[MECHANISM]**

**Pennyroyal — https://github.com/jpezzulli/sglang-rtxpro6000 (branch `pennyroyal-main-sm120-final`)**

- "Penny Royal is an SGLang-derived runtime tuned for NVIDIA RTX PRO 6000 Blackwell (SM120), with one
  card (TP1) or two (TP2)." Apache-2.0 source, name from Neal Asher's Polity novels. **[MECHANISM]**
  README, fetched 2026-11-18.
- Two qualified model profiles, both at 524,288-token context: Qwen3.8-Flash-Next NVFP4 experts +
  automatic FP8 dense on SM120, maintained default = native NEXTN MTP with FR-Spec (verify width fixed
  by concurrency: block 8 at C1, block 4 at C2+); experimental DFlash2 opt-in with separate
  `incoai/Qwen3.8-Flash-Next-DFlash2` draft verified via FlashInfer SM120 kernel. Qwen3.8-27B FP8 +
  DFlash2 is the "established and qualified" profile. **[MECHANISM / VERSION-DEPENDENT]**
- Its signature system feature is the three-tier conversation cache: GPU → system RAM (HiCache) →
  NVMe (NIXL), restoring full hybrid state (attention KV + Mamba/recurrent state + PLE/QSA state);
  documented restore of a 490K-token conversation serving 5 new tokens. NIXL disk cache on by default.
  **[MEASURED by project + MECHANISM]** This is prefix caching — *separate* from the PLE table
  placement below.
- Host memory table (README "Hardware and memory"): Flash-Next default 32 GB HiCache + ~48 GiB
  RAM-backed PLE; 27B/DFlash2 96 GB HiCache + ~24.83 GB draft cache (recorded 27B launch: 79.45 GB KV
  + 16.63 GB Mamba + 24.83 GB draft ≈ 120.91 GB caches). **[MEASURED by project]**
- NVMe PLE (optional, v2.5+): the Flash-Next FP8 PLE table is exactly **51,200,245,760 bytes = 47.68
  GiB** on SSD; NVMe mode replaces pinned-RAM residency with bounded row buffers + row-ID staging + a
  small native page pool; separate snapshots showed host `MemAvailable` ~54–56 GiB higher. Measured
  C4 aggregate median: RAM-backed 428.90 tok/s vs NVMe 369.73 tok/s — the author documents this as a
  separate operational comparison, not a randomized A/B. Reader is an attributed adaptation of
  "SSD Stream v0.2.0". **[MEASURED by project; conditions in NVME-PLE.md]** This 47.68 GiB figure is
  the same table as in the speaker's home-k8s issue #135 and = Qwen's 51B n-gram table (see
  ngram-tables). **[MECHANISM cross-check: 20,000,096 rows × 2,560 B]**
- Status: releases v3.1.4 (2026-10-29), v3.1.5 (2026-11-03/04), v3.1.6 (2026-11-06); prebuilt image
  `ghcr.io/jpezzulli/sglang-rtxpro6000`. README states "Penny Royal did almost all the coding across
  these releases" (AI-assisted development, per the author) — report that as the project's own claim.
  **[OPEN — the "entirely AI-written" phrasing is NOT verified; handoff §2 also forbids asserting it]**

**Framing facts for the slide itself**

- These three + llama.cpp/vLLM/SGLang/Ollama are engines; GGUF/`.rad`/`.ninfer`/safetensors are
  container formats. **[MECHANISM]**
- No universal ranking exists across them; published numbers are self-measured on specific
  GPU/model/quant/concurrency combinations. Any comparison visual must show cells as
  "documented support / no documented support", never implied speed ratings (v1 engine-map V2 rule).
  **[Accuracy constraint from handoff §F01]**

### 2. Mechanism, precisely

Not a math slide. The structural story is a support matrix: engine × (GPU arch, model family, quant,
drafter, cache tier). Each engine is a narrow vertical slice:

- NInfer: fixed-target compile (`sm_120a`/`sm_121a`) → `.ninfer` artifact → one model resident →
  CUDA-graph decode with MTP/DFlash2 verification, 1–8 requests.
- Radiance: plugin `.so` architectures/kernels per gfx target → `.rad` container → OpenAI/Anthropic/
  llama-server front ends → TP ranks with optional lossy all-reduce wire.
- Pennyroyal: SGLang fork with SM120-scoped kernels → scheduler + radix/HiCache → state restored from
  RAM/NVMe including Mamba + PLE state → MTP/DFlash2 draft verification.

### 3. Must not imply

- No universal "fastest engine"; missing matrix cells mean *undocumented*, not *slow* (handoff §F01).
- Radiance ≠ CUDA and ≠ vLLM-on-ROCm; NInfer support is model/arch-specific (its kernels literally
  target one SM version); Pennyroyal's numbers are not generic SGLang numbers.
- Do not claim any of these engines was wholly AI-written, is portable to other GPUs, or is a safe
  production choice; Pennyroyal is a personal/home runtime by its own description.
- Pennyroyal's HiCache/NIXL prefix cache ≠ PLE table offload ≠ MoE expert offload — three different
  mechanisms that all touch RAM+SSD (this confusion is the single biggest visual risk of chapter 08).
- Third-party blog numbers (senn-tech) and project self-measurements must carry their source label;
  none is a speaker measurement.

### 4. Visual ideas (3D, greyscale pixel style)

**A — Support wall (extends v1 `engine-map`).** x = engines (llama.cpp, vLLM, SGLang, Ollama, NInfer,
Radiance, Pennyroyal); y = hardware cards (RTX 5090, RTX PRO 6000 SM120, R9700, DGX Spark, CPU);
z-height of a tile = nothing (flat), fill = documented support (ink) vs hatch (none/unverified);
small token tiles (`.rad`, `.ninfer`, GGUF) fly to the engine that reads them. Control: a model-picker
(Qwen3.8-27B / Flash-Next / Gemma-3n-E4B) that recomputes which cells light. Toy: 7×5 grid.
**B — Three narrow pipelines.** Three horizontal lanes; each lane shows engine-specific stages as
boxes (artifact → resident weights → decode graph → drafter verify → cache tiers present in that
engine: Pennyroyal's lane visibly has GPU|RAM|NVMe cards). Motion: one request tile per lane moves
through its own stages only. Control: hover/tap a stage → primary-source citation tooltip. Toy: 5–6
stages × 3 lanes.
**C — One model, three homes.** Center: the same Qwen3.8-27B weight slab; three cameras orbit to
three mounts: CUDA slab (vLLM/NInfer), HIP slab (Radiance), fork slab (Pennyroyal). Size of each
mount's "kernel library" chip is labelled sm_120a / gfx1201 / SM120 — the point being specialization.
Control: toggle "show self-measured decode points" → only the documented (model, C) points appear,
each labelled by whom it was measured.

### 5. Open questions for the speaker

- Which NInfer commit/version and which model+quant did you run on your RTX 5090 (handoff §F01 asks
  the same); did you use `.ninfer` artifacts or converted weights?
- Which Pennyroyal release were you running with NVMe PLE (v2.5+? your manifest apps/
  pennyroyal-flashnext.yaml), RAM or NVMe mode, and would you attach your own observed tok/s as
  [SPEAKER OBSERVATION]?
- Coworker's R9700 Radiance run: which model/quant/container, so it can be labeled properly instead
  of citing the senn-tech blog?
- OK to state the projects' own "AI did most of the coding" claim with attribution (Pennyroyal README),
  and to mention the NVIDIA-forum cross-posting?

---

## ngram-tables

Working title (plan): *Qwen and DeepSeek both added n-gram lookup tables, in different ways.*
◆ 3D slide. Reuse v1 `engram` and `ssd-access` builders.

### 1. Facts

DeepSeek Engram (the research origin):

- Paper: "Conditional Memory via Scalable Lookup: A New Axis of Sparsity for Large Language Models",
  arXiv:2601.07372, v1 submitted **Mon 12 Jan 2026**, v2 12 Jul 2026; DeepSeek-AI + Peking Univ.
  **[MECHANISM]** https://arXiv.org/abs/2601.07372 · official code Apache-style Model License repo
  https://github.com/deepseek-ai/Engram
- Module: for each position t, hash the **suffix N-gram of compressed token ids** (orders n = 2..N,
  N=3 in the paper's models) with **K hash heads per order** into **prime-sized** table segments via a
  multiplicative-XOR hash; concatenate retrieved rows into a memory vector **e_t ∈ R^d_mem**.
  **[MECHANISM — paper §2.2 eq. (1)–(2)]**
- Tokenizer compression: precomputed surjection V→V′ collapsing NFKC/lowercase/accent-equivalent ids;
  "23% reduction in effective vocabulary for a 128k tokenizer" (paper appendix C). Cross-check:
  DeepSeek-V4.1-Flash config.json ships `engram_compressed_vocab_size: 99092` vs `vocab_size: 129280`
  = 23.35 % collapse. **[MECHANISM / MEASURED on the shipped config]**
  https://huggingface.co/deepseek-ai/DeepSeek-V4.1-Flash/raw/main/config.json
- Fusion (gating): k_t = W_K e_t, v_t = W_V e_t; scalar gate α_t = σ(RMSNorm(h_t)·RMSNorm(k_t)/√d);
  ṽ_t = α_t·v_t; then depthwise **causal conv, kernel 4, dilation = max n-gram order**, SiLU +
  residual; injected residually H^(ℓ) ← H^(ℓ) + Y. In the multi-branch (mHC, M=4) backbone: **one
  shared table + one shared W_V, M branch-specific W_K gates** → 8 gating scalars per token across 2
  layers. **[MECHANISM — paper §2.3–2.4]**
- Placement: paper Engram-27B/40B at **layers [2, 15] of 30/40**; shipped V4.1-Flash
  `engram_layer_ids: [1, 14]` (0-indexed) = same positions. Engram is not applied to every layer.
  **[MECHANISM]**
- Research-scale tables: Engram-27B: d_mem = 1280, **2,262,400 slots per layer**, 8 heads,
  **5.7B Engram params** total, iso-params with a 26.7B MoE (routed experts cut 72→55). Engram-40B:
  7,239,680 slots/layer → 18.5B. Arithmetic checks: 2,262,400×1280×2 = 5.79B ✓.
  **[MECHANISM — paper Table 1 + Appendix A Table 5]**
- Shipped size: V4.1-Flash model card: "Engram conditional memory (**196B parameters**, sparsely
  accessed via token-based lookup)"; config: two tables of 384,006,168 and 384,016,682 rows,
  `engram_head_dim: 256`, `engram_n_heads: 8`, `engram_max_ngram_size: 4`. Arithmetic:
  (384,006,168+384,016,682)×256 = 196.6B ✓. **[MECHANISM — model card + config.json]**
  https://huggingface.co/deepseek-ai/DeepSeek-V4.1-Flash
- Where it lives (vLLM implementation, docs/features/engram.md, fetched 2026-11-18): default =
  **pinned host RAM**, lookups served to a fused Triton kernel via UVA, prefetched on a side CUDA
  stream overlapping the preceding layers' compute; tables ≈ **200 GB FP8** (384M rows × 256 B/layer)
  or ≈ 104 GB packed MXFP4 (128 B row + 8 B ue8m0 block-32 scale). Options: GPU-resident, `/dev/shm`
  copy shared across DP replicas, hash-head sharding across TP×DP ranks, and (multi-engine NVLink
  domains) peer-GPU HBM splitting. https://github.com/vllm-project/vllm/blob/main/docs/features/engram.md
  **[MECHANISM / VERSION-DEPENDENT: current main-branch docs]**
- Paper's offload measurement: 100B-param Engram layer resident in **host DRAM**, prefetched over
  PCIe during the preceding block, H800, 512 seqs: Dense-4B 9,031.62→8,858.28 tok/s (−1.9 %), Dense-8B
  6,315.52→6,140.02 (−2.8 %) ⇒ "<3% overhead". **[MEASURED — DeepSeek, dense backbones, table forced
  through PCIe on every lookup; conservative lower bound, not a shipped-model measurement]**
- Scaling law: U-shaped sparsity allocation; optimum moves ~20–25 % of the *inactive* parameter
  budget from routed experts to Engram memory (ρ≈75–80 % to MoE); val loss 1.7248→1.7109 at 10B
  regime. Slot-count scaling (2.58e5→1.0e7 slots) is log-linear. **[MEASURED — DeepSeek's own
  training runs at ≤10B scale]**
- Mechanistic results (paper): suppressing Engram output at inference retains only 29–44 % of factual
  scores (TriviaQA 29 %) but 81–93 % of reading-comprehension scores (C3 93 %); gating visualizes on
  multi-token entities ("Alexander the Great"). **[MEASURED — DeepSeek]**

Qwen's n-gram embedding (shipped design on Qwen3.8-Flash-Next):

- Which model: **Qwen3.8-Flash-Next**, "experimental preview of the architecture that will underpin
  Qwen4", HF `Qwen/Qwen3.8-Flash-Next` (config `Qwen4ExpForConditionalGeneration`, model_type
  `qwen4_exp`). The model card lists "**N-gram Embedding**" as one of four headline architecture
  changes. **[MECHANISM — model card]**
- Card numbers: "Number of Parameters: **125B with 6B activated, plus 51B n-gram embedding and 4B
  MTP**"; "**N-gram Embedding: 20,000,000 (bigrams/trigrams at layer 2)**"; hidden dim 2560; 48
  layers; vocab 248,320. Benchmark table row "# N-gram embedding params: 51B".
  **[MECHANISM — model card wording; whether "125B" already includes the 51B is not stated → OPEN]**
- config.json: `ngram_size: 3`, `ngram_vocab_size_base: 20000000`, `heads_per_ngram: 8`,
  `ple_embed_dim: 2560`, `ple_layer_ids: [2]`, `ple_conv_kernel_size: 4`, `split_ngram_parts: 128`,
  `make_ngram_vocab_size_divisible_by: 128`. Arithmetic: **20,000,000 × 2560 = 51.2B = the "51B"**.
  **[MECHANISM]** https://huggingface.co/Qwen/Qwen3.8-Flash-Next/raw/main/config.json
- Table bytes (shipped FP8 rows): **51,200,245,760 bytes = 47.68 GiB = 20,000,096 padded rows ×
  2,560 × 1 B FP8** — stated in Pennyroyal NVME-PLE.md and matching the speaker's home-k8s #135.
  **[MEASURED on the actual artifact, via Pennyroyal docs + speaker manifest]**
- Engine placement options (vLLM docs, same page as above): Qwen4Exp declares `ple_layer_ids`; vLLM
  calls it "same mechanism, called PLE". Options: `cpu_offload` (default true, pinned host RAM) or
  **`disk_offload`** — no GPU/pinned allocation at all; each step reads its rows from the safetensors
  files with `preadv`, rows stay checkpoint-format (BF16/FP8/NVFP4) and decode on GPU, hot rows served
  from the OS page cache; every TP rank reads its own rows; waits on the previous GPU step.
  **[MECHANISM / VERSION-DEPENDENT]**
- Pennyroyal path for the same table: RAM-backed (~48 GiB pinned, default) or NVMe overlay (see
  new-engines; measured −14 % median at C4 vs RAM in the author's non-randomized comparison).
  **[MEASURED by project]**

Concrete differences Qwen vs DeepSeek (all from the two configs + vLLM docs):

| Aspect | DeepSeek Engram (V4.1-Flash) | Qwen n-gram embedding (3.8-Flash-Next) |
|---|---|---|
| Table rows | 2 layers × 384.0M rows | 1 layer (layer 2) × 20.0M rows (padded 20,000,096) |
| Params | ~196.6B (FP8 ≈ 200 GB) | ~51.2B (FP8 = 47.68 GiB) |
| Row width | head_dim 256; rows are per-head; concat into d_mem | ple_embed_dim 2560 per row |
| Orders | 2-gram + 3-gram (`engram_max_ngram_size: 4`, heads applied over suffix n-grams) | bigram + trigram (`ngram_size: 3`) |
| Heads | 8 per order, prime segments, disjoint | `heads_per_ngram: 8` (toy hash math below is DeepSeek's published demo; Qwen's exact hash is not published) **[UNVERIFIED]** |
| Vocabulary keyed on | NFKC-compressed ids (99,092 of 129,280) | not published; card only says "indexing with short n-grams" **[UNVERIFIED]** |
| Layers | 2 (indices 1 and 14) | 1 (index 2) |
| Gating | context-aware sigmoid gate per mHC branch + depthwise causal conv k=4 | vLLM: "same mechanism"; Qwen's own gating/conv details unpublished beyond `ple_conv_kernel_size: 4` **[OPEN]** |
| Default serving storage | pinned host RAM, UVA side-stream prefetch | pinned host RAM or file-backed disk_offload |

### 2. Mechanism, precisely

DeepSeek Engram data flow (per Engram layer ℓ, per position t) — paper + demo code
(https://github.com/deepseek-ai/Engram/blob/main/engram_demo_v1.py, `NgramHashMapping`):

```text
x_t            raw token id
c_t = P(x_t)   compressed id (NFKC+lower+strip surjection; 129,280 → 99,092 in V4.1-Flash)
m_k^(ℓ)        per-layer odd multipliers, seeded RNG(seed + 10007·layer)
mix_n(t)   = (c_t·m_0) ⊕ (c_{t-1}·m_1) ⊕ … ⊕ (c_{t-n+1}·m_{n-1})      # int64, n = 2,3
z_{n,j}(t) = mix_n(t) mod M_{n,j}                                     # M = distinct primes,
e_t        = E_ℓ[ off_{n,j} + z_{n,j} ]  concatenated over (n, j)     # E_ℓ one table, disjoint prime segments
α_t        = σ( RMSNorm(h_t) · RMSNorm(W_K e_t) / √d )               # per mHC branch (4 branches)
Y_t        = ṽ + SiLU(Conv1D_4,δ=N(RMSNorm(ṽ))),  ṽ = α_t·W_V e_t     # causal depthwise conv
h_t        ← h_t + Y_t                                               # residual injection
```

Toy arithmetic (simulated ids/multipliers; algorithm exactly as in the demo):
compressed bigram (c_{t-1}, c_t) = (7, 50120); odd multipliers m_0 = 13, m_1 = 5.

```text
mix = 50120·13 ⊕ 7·5 = 651560 ⊕ 35 = 651531
head A prime 383:  651531 mod 383 = 48   → table row off_A + 48   (off_A = 0)
head B prime 419:  651531 mod 419 = 405  → table row off_B + 405  (off_B = 383 → row 788)
trigram with c_{t-2} = 4021, m_2 = 29: mix₃ = 651531 ⊕ 4021·29 = 651531 ⊕ 116609 = 538250
head C prime 431:  538250 mod 431 = 362
```

Two heads of the same order hitting the same row index is a *different* collision than two orders —
disjoint prime segments so double-collisions don't line up (vLLM docs phrase: "collisions cannot
collide twice"). Note `mix` does not depend on h_t at all: **indices are fully determined by token ids
→ this is why prefetch/offload works** (deterministic addressing).

Qwen's lookups: same shape of story (n-gram → hash heads → gather ~a dozen 2560-wide FP8 rows →
fuse with a conv k=4 into the residual stream at layer 2) but the exact hash is not published;
the row identity is again token-id-determined, which is why vLLM can serve it from safetensors with
`preadv` per step.

Key invariant for the scene: this is **static weight lookup, once per newly processed position**
(prefill and decode alike); the table is not re-scanned per session, and the KV cache is untouched.

### 3. Must not imply

- Not RAG, not KV cache, not prompt n-gram speculative matching, not MoE experts (no MLP is computed
  over the table; rows are *read*), not an input-token-embedding lookup. **[handoff §F02/F03 carry-over]**
- The table is consulted for every newly computed position, not once per chat; prefix reuse already
  absorbs past lookups. **[MECHANISM]**
- "196B / 51B parameters" are memory capacity, not per-token compute — per-token lookup work is
  ~16 gathers × 256 B (V4.1), independent of table size. Scaling rows ≠ more FLOPs (the paper's whole
  point; O(1)/token). **[MECHANISM]**
- Host-RAM/SSD residency is a *deployment choice*; the same model can serve with GPU-resident tables
  (`cpu_offload false`). Don't draw a fixed "VRAM/RAM/SSD" pipeline as if every engine does all three.
- Don't blur vLLM `disk_offload` (PLE table reads) with Pennyroyal NIXL (conversation prefix cache on
  NVMe) — two unrelated SSD uses. Also not "streaming MoE experts from disk".
- Hash collisions are real and accepted by design; don't draw the table as a perfect dictionary.
- Qwen/DeepSeek implementations differ (layers, sizes, gating); the vLLM phrase "same mechanism"
  refers to retrieval+gating, not shared code. Don't imply one copied the other.
- DeepSeek's "<3% overhead" is measured on dense prototypes with a 100B table, not on the shipped
  552B model; Pennyroyal's −14% NVMe-vs-RAM is a non-randomized operational comparison.

### 4. Visual ideas

**A — Two tables, one stream (comparison core).** x = token stream (positions left→right, 8 tiles);
each token tile raises above it the suffix-2-gram and 3-gram windows (thin brackets). z = two table
slabs behind the stream: slab D (DeepSeek, 2 rows labeled "layer 2", "layer 15", total-height bar
labelled 196B FP8) and slab Q (Qwen, single "layer 3? → layer 2" slab, 51B FP8). Per position:
multiplication+XOR shown as one tile→one arrow per head (toy: 4 heads shown, not 16) landing on a
highlighted row; rows flow forward and concatenate into a memory-vector strip that meets the hidden
state at a gate tile (dark = gate open). Control: edit the token sequence (or a toggle "inject a
collision") and every arrow recomputes deterministically. y = table slot index, log-scaled.
**B — Where the table lives (memory placement).** Three depth planes: VRAM | pinned RAM | NVMe.
A row slab can be parked in any plane; step animation shows side-stream prefetch overlapping the
preceding layer's compute bar (arrows move while a compute slab pulses). Toggle
`cpu_offload / disk_offload / GPU-resident` recomputes which plane holds the slab and rewrites the
GB readout (200 GB FP8 ↔ 104 GB MXFP4 ↔ 47.68 GiB Qwen). Toy: 8 rows in a 24-slot plane. Must show
the *same logical lookup per token* in all modes; only physical residence and latency shading change.
**C — Gate as volume knob.** One position enlarged: e_t strip (16 small tiles), h_t slab, gate value
α; a second run shows a polysemous/collided row where the gate closes (α≈0 → thin arrow) vs an idiom
where it opens ("By the way" style). Control: slide h_t vs e_t similarity; arrow thickness = α.
This is the paper's Figure-7 heatmap translated into one token. **[SYNTHETIC unless the speaker
captures real gate values]**

### 5. Open questions for the speaker

- You ran Flash-Next PLE on NVMe via Pennyroyal (home-k8s #135): keep that as the shipped-visual
  spine for Qwen, with DeepSeek's 200 GB pinned-RAM as the contrast? Sizes differ 4×; the slide should
  say so rather than hide it.
- Any personal observation worth a labelled badge (e.g. effect of NVMe PLE on your tok/s or host RAM)?
- Do you want the U-shaped allocation / Engram-27B research numbers on-slide at all, or keep the
  slide purely mechanism + sizes?
- Is `ple_layer_ids: [2]` 0-indexed as DeepSeek's [1,14] is (i.e. "layer 3" vs card's "layer 2")?
  Card text and list indexing should be reconciled before printing a layer number.

---

## ple

Working title (plan): *PLE: per-layer embeddings.* Define via **Gemma 3n** (the reference
implementation). ◆ 3D slide. Variant idea from the plan: layer stack with side tables feeding each
layer.

### 1. Facts

- Gemma 3n (Google, released on HF 2025-06/07) is the shipped reference for **Per-Layer Embeddings
  (PLE)**; the Engram paper lists it in related work as "Per-Layer Embeddings (Team, 2025)" alongside
  STEM (arXiv:2601.10639), L3 (arXiv:2601.21461), RWKV DeepEmbed, OverEncoding. PLE itself is not new
  in 2026; **its use in Qwen3.8-Flash-Next is a different thing that happens to share the acronym.**
  **[MECHANISM]** https://arxiv.org/html/2601.07372v2 §7
- Naming/size: `gemma-3n-E2B` = **5B total parameters, ~2B effective**; `E4B` = **8B total, ~4B
  effective**; E2B runs in ~2 GB, E4B ~3 GB accelerator memory. Google docs give the sharpest figure:
  standard execution loads >5B; with PLE caching + parameter skipping, E2B runs at an effective memory
  load of **1.91B** parameters. **[MANUFACTURER SPEC]**
  https://huggingface.co/blog/gemma3n · https://ai.google.dev/gemma/docs/gemma-3n
- Shapes (from `google/gemma-3n-E2B-it` config, via the un-gated onnx-community mirror, and
  E4B via a mirror of the released config; confirmed against transformers `modular_gemma3n.py`):
  - E2B: `vocab_size_per_layer_input = 262,144`, `hidden_size_per_layer_input = 256`,
    `num_hidden_layers = 30`, `hidden_size = 2048`, main vocab 262,400.
  - E4B: same 262,144 × 256, `num_hidden_layers = 35`.
  - One embedding table: **[262,144 rows × (num_layers × 256) cols]** → E2B row width 7,680;
    E2B PLE params = 262,144×7,680 = **2,013,265,920 (~2.01B, ~4.03 GB BF16)**;
    E4B = 262,144×8,960 = **2,348,810,240 (~2.35B, ~4.70 GB BF16)**.
    **[MECHANISM — config.json + transformers source]**
  - transformers stores it as `Gemma3nTextScaledWordEmbedding(vocab_size_per_layer_input,
    num_hidden_layers*hidden_size_per_layer_input, embed_scale=256**0.5)`.
- Per-token lookup: `get_per_layer_inputs` gathers row = token id (out-of-table ids→0), reshaped
  `[B, T, num_layers, 256]` → each layer l slices columns [256l, 256(l+1)). This is a **1-token key**
  (no hashing, no context, exact index) — contrast with Engram/Qwen n-gram tables. **[MECHANISM]**
- There is also a learned *model-activation* side: `per_layer_model_projection` Linear(2048 →
  num_layers×256), scaled by 2048^−½, RMSNormed, then `(proj + table_slice) × 1/√2` forms the
  per-layer input actually consumed. **[MECHANISM — modular_gemma3n.py `project_per_layer_inputs`]**
- Injection point (transformers impl): inside each decoder layer's AltUP path —
  `per_layer_input_gate` Linear(2048→256) on the layer's first prediction → gelu → element-wise
  multiply with that layer's 256-dim PLE slice → `per_layer_projection` Linear(256→2048) → RMSNorm →
  added into the expanded prediction streams (AltUP widens the residual stream 4× at the end). So the
  PLE vector modulates per-layer, gated by activations; it is *not* the standard token embedding and
  not summed directly into the main residual stream. **[MECHANISM — modular_gemma3n.py;
  simplified in Google's on-device docs as "PLE data generated separately, cached to fast storage,
  added to the model inference process as each layer runs"]**
- Offload story (the talk-relevant part): because each (token, layer) lookup is independent and
  exact, the PLE table can live **outside accelerator memory** — Google AI Edge caches it to fast
  local storage/DRAM (that's what makes 5B act like 1.91B-resident); Engram paper's related-work note:
  other embedding-scaling designs "place embeddings at Layer 0"; Gemma 3n's per-layer tables + AltUP
  + MatFormer are what make the split work. **[MECHANISM / MANUFACTURER SPEC]**
- Also in the 5B→1.91B gap (don't attribute it all to PLE): AltUP unembed projections, the vision
  (MobileNet-v5, ~300M) and audio encoders (conditional parameter skipping), and 95 % activation
  sparsity in the first 10 FFNs (`activation_sparsity_pattern` in config). **[MECHANISM from config +
  docs; exact per-group param counts: UNVERIFIED]**
- llama.cpp / Ollama / MLX serve gemma-3n text-only from day 0 (HF blog); on-device PLE caching is
  primarily a Google AI Edge / MediaPipe feature. Whether llama.cpp offloads the PLE table to disk is
  **[UNVERIFIED]** — check before saying "every stack offloads it".

### 2. Mechanism, precisely

```text
Table:  T ∈ R^{262144 × (L·256)}          L = 30 (E2B) / 35 (E4B)
Key:    c_t (token id)                    — exact row, no hash, no context
Slice:  p_t^{(l)} = T[c_t][256·l : 256·(l+1)]        (256-dim, per token per layer)
Blend:  p̃_t^{(l)} = ( RMSNorm( W_proj·x_t /√2048 )^{(l)} + p_t^{(l)} ) / √2
Use:    g_t^{(l)} = act( A_gate·f_t^{(l)} )  ⊙  p̃_t^{(l)}      (256-dim)
        Δh = RMSNorm( A_proj·g_t^{(l)} )     (2048-dim)  → AltUP streams predictions[1:] += Δh
Memory: table = 2.01B (E2B) / 2.35B (E4B) params, ~4 GB BF16 → the piece that leaves the GPU.
```

Toy index arithmetic (E2B; synthetic token id, table shape real): token id c_t = 16,548, layer l = 7.

```text
row stride       = 30 × 256 = 7,680 values  = 15,360 B (BF16)
row start        = 16,548 × 15,360 B            = 254,177,280 B
layer-7 slice    = columns [7×256, 8×256)       = byte offset +3,584
→ read 512 B at byte offset 254,180,864
```

Compare with the n-gram slides: **one row lookup per token-layer** (Gemma) vs **≈16 hashed rows per
token-layer-with-engram** (DeepSeek) vs **≈16 hashed rows once, at a single layer** (Qwen). Sizes:
Gemma 2.0–2.3B params / ~4 GB, exactly indexable; DeepSeek 196B / ~200 GB; Qwen 51B / 47.68 GiB.

Effective-vs-total parameters for the slide: 5B total − 1.91B effective (E2B, Google docs figure);
difference is PLE table + skippable encoders + AltUP projections. E4B: 8B total, ~4B effective
(Google/HF figures; no per-piece breakdown published → UNVERIFIED beyond the PLE 2.35B arithmetic above).

### 3. Must not imply

- **PLE ≠ Engram/Qwen n-gram tables.** Gemma's lookup key is one token id, exact indexing, no hashing,
  no collisions, no context; Engram keys are hashed n-grams. Same family ("big off-GPU lookup table")
  but different mechanisms. Also note vLLM calls Qwen4Exp's n-gram layers "PLE" and Gemma 3n calls its
  per-token side embeddings "PLE" — the acronym is overloaded; on-slide, disambiguate.
- PLE parameters are not "not used" when offloaded — every token-layer slice is consumed each pass;
  offloading changes *where it is read from*, never *whether*.
- Total/active/effective are three different numbers (cf. MoE "active params ≠ memory occupancy"
  rule); E2B is not a 2B model.
- PLE is not the KV cache and not new in 2026; the 2026 story is shipped large-table offload designs
  (Gemma 3n 2025 → Engram research Jan 2026 → Qwen3.8-Flash-Next / DeepSeek-V4.1-Flash shipped).
  No "first" claims without dates **[handoff §F04]**.
- The exact 5B→1.91B split across PLE/AltUP/encoders is not itemized by Google — show the two totals,
  label the composition qualitative.
- In the transformers reference the PLE contribution enters through AltUP's expanded streams; drawing
  "table → straight into the main residual stream" is the reference-implementation mismatch risk.

### 4. Visual ideas

**A — Layer stack with side tables (plan's idea, made precise).** y = 30 thin layer planes (E2B),
token x_t moving upward through them. x = a side table slab at CPU-memory height (below the GPU
plane), rows = token ids; from row x_t, 30 narrow 256-wide strips peel off one at a time and enter
each layer (size of strip fixed: all equal — the *whole* point of per-layer). A small gate tile (dark
tile = large ||Δh||) sits at each layer input. Control: scrub the token; the row highlight and all 30
strips recompute (exact indexing — every index shown as arithmetic). Toy: 8 layers × 4 tokens,
labels at real numbers (262,144 × 7,680).
**B — One row unrolled.** Single token row (7,680 values) drawn as a long pixel strip; the camera
tracks it as dashed cuts divide it into 30 × 256 cells, each cell flying to its layer with a byte-offset
counter (uses the real arithmetic from §2: 16,548 × 15,360 B …). Toggle E2B↔E4B recomputes the cuts
(30→35). Control: token-id slider 0…262,144 shows offset = id×15,360. **[SYNTHETIC weights]**
**C — Where 5B lives.** Two stacked slabs: "on accelerator 1.91B" vs "off accelerator ~3.1B" with the
PLE table (~2.01B) named as the biggest off piece; a bandwidth pipe drawn thinner than the GPU's
weight reads, since the table serves one 256-value strip per token-layer (data rate = 30×512 B per
token = 15 KB/token BF16, vs ~2 GB/token for full 5B weights — the arithmetic that explains why CPU
memory is fine). **[MECHANISM arithmetic; the 1.91B/5B figures are Google's]** Control: token counter
animates the two flow thicknesses.
Common to all: greyscale; dark ink = the per-layer strips (the mechanism's payload); hatch = the
off-GPU region. Keyboard: ←/→ walk tokens, R reset.

### 5. Open questions for the speaker

- Have you (or should you) run Gemma 3n locally (llama.cpp/MLX/Google AI Edge) so the PLE slide can
  carry one [SPEAKER OBSERVATION] line, or stay purely mechanism + manufacturer figures?
- The deck plan asks "verify Gemma 3n is the reference implementation" — done (docs + HF blog +
  code). Still worth confirming the audience framing: present PLE as *2025 idea the speaker ran into
  while learning in 2026*, or keep dates off-slide?
- Show the acronym clash explicitly (Gemma PLE vs Qwen-4exp `ple_layer_ids`) on the slide, or in the
  `ngram-tables` slide only? Recommendation: one labelled line in `ngram-tables`, since the two scenes
  are adjacent.

---

## Source index

| Topic | URL |
|---|---|
| Engram paper | https://arxiv.org/abs/2601.07372 (HTML v2: https://arxiv.org/html/2601.07372v2) |
| Engram code/demo | https://github.com/deepseek-ai/Engram · https://github.com/deepseek-ai/Engram/blob/main/engram_demo_v1.py |
| vLLM Engram/PLE docs | https://github.com/vllm-project/vllm/blob/main/docs/features/engram.md |
| DeepSeek-V4.1-Flash card | https://huggingface.co/deepseek-ai/DeepSeek-V4.1-Flash · config: …/raw/main/config.json |
| Qwen3.8-Flash-Next card | https://huggingface.co/Qwen/Qwen3.8-Flash-Next · config: …/raw/main/config.json |
| Gemma 3n docs | https://ai.google.dev/gemma/docs/gemma-3n · https://huggingface.co/blog/gemma3n · https://developers.googleblog.com/introducing-gemma-3n-developer-guide/ |
| Gemma 3n PLE source | https://github.com/huggingface/transformers/blob/main/src/transformers/models/gemma3n/modular_gemma3n.py |
| NInfer | https://github.com/Neroued/ninfer (speaker copy: https://github.com/dbirks/ninfer) |
| Radiance | https://github.com/Quackster/radiance · https://radiance.stilldeadco.de/ · https://senn-tech.com/en/blog/zwei-r9700-radiance-qwen38-27b-messung |
| Pennyroyal | https://github.com/jpezzulli/sglang-rtxpro6000 (branch pennyroyal-main-sm120-final: README.md, NVME-PLE.md) |

Known unverified items collected: Qwen n-gram hash formula; whether "125B" includes the 51B table;
NInfer/Radiance placement of the Qwen PLE table; llama.cpp PLE offload behavior; E2B 1.91B effective
per-component composition; layer-index convention (0- vs 1-based) for Qwen `ple_layer_ids`.
