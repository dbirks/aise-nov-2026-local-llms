# v2 research packet — chapters 05–06: KV cache, batching, prefix caching (slides `kv-cache`, `batching`, `prefix-cache`, `engines-cache`)

Researched 2026-11-18. Version basis checked this date:

- **vLLM** `v0.34.0` (released 2026-11-16, GitHub releases API) + `main` branch; docs `docs.vllm.ai/en/latest`.
- **SGLang** `v0.5.23` (2026-11-02) + `main`; docs `docs.sglang.io` (fetched 2026-11-18).
- **llama.cpp** `master` @ 2026-11-18; latest release tag `v1.0.0` (2026-11-13, GitHub releases API).
- **Qwen3.8-27B** `config.json` raw from <https://huggingface.co/Qwen/Qwen3.8-27B/raw/main/config.json> (fetched 2026-11-18); model card <https://huggingface.co/Qwen/Qwen3.8-27B>.

Evidence labels: **[MECHANISM]** = follows from the math/algorithm; **[MANUFACTURER SPEC]**; **[MEASURED by whom]**; **[VERSION-DEPENDENT @ ver]**; **UNVERIFIED** = not checked, do not put a number on a slide.

**Toy prompt set used throughout** (same three requests for every engine on `prefix-cache` / `engines-cache`):

- `S` = 1,000-token shared agent system prompt + tool list (toy round number).
- `R1` = S + “Fix the failing test in auth.py” (agent of user A)
- `R2` = S + “Summarize the diff in PR #42” (agent of user B, same S)
- `R3` = S′ + “What should I have for lunch?” where S′ differs from S at token ≈300 (a different tool-schema entry early in the system prompt).

---

## kv-cache

### Facts

1. **KV size formula.** For full-attention layers only:
   `KV_bytes ≈ 2(K and V) × L_attn × H_kv × D_head × T × b`, L=attention layers, H_kv=KV heads, D_head=head_dim, T=tokens, b=bytes per scalar. **[MECHANISM]** (tensor shapes are per-token, per-layer `[2, H_kv, D_head]`); same formula stated in `docs/presentation-production-handoff.md` §4.2. Real allocations add block padding, quant scales, fragmentation, shared prefixes, recurrent state — the formula is the tensor payload, not the VRAM bill. **[MECHANISM]**
2. **Qwen3.8-27B is a hybrid: only 16 of its 64 layers keep a KV cache.** `config.json` (raw, fetched 2026-11-18): `num_hidden_layers: 64`, `full_attention_interval: 4`, `layer_types` = 48 × `"linear_attention"` + 16 × `"full_attention"` (every 4th layer), `num_key_value_heads: 4`, `num_attention_heads: 24`, `head_dim: 256`, `hidden_size: 5120`, `intermediate_size: 17408`, `vocab_size: 248320`, `max_position_embeddings: 262144`, `mamba_ssm_dtype: "float32"`, `linear_num_value_heads: 48`, `linear_num_key_heads: 16`, `linear_key_head_dim: 128`, `linear_value_head_dim: 128`, `linear_conv_kernel_dim: 4`, `mtp_num_hidden_layers: 1`. Model card: “Hidden Layout: 16 × (3 × (Gated DeltaNet → FFN) → 1 × (Gated Attention → FFN))”; Gated Attention 24 Q / 4 KV heads, head dim 256. **[MECHANISM]** — verified against the repo file.
3. **Worked number (this model).** Per token, BF16 KV (b=2): `2 × 16 × 4 × 256 × 2 = 65,536 B = 64 KiB/token`. FP8 KV (b=1): 32 KiB/token. A 32,768-token context = `65,536 × 32,768 = 2,147,483,648 B` = **exactly 2.0 GiB** in BF16 (1 GiB FP8). Max positional span 262,144 tokens ⇒ 16 GiB BF16 / 8 GiB FP8 per sequence. **[MECHANISM]** arithmetic on fact 1–2; per-sequence, ignores shared prefixes and engine overhead.
4. **Contrast that makes the hybrid point.** If all 64 layers were full attention at the same head config: 256 KiB/token BF16 (4×). The 48 Gated DeltaNet layers instead keep a *constant-size recurrent state per sequence*, independent of T. From the config fields (48 V-heads × 128 × 128 state × fp32 ≈ 3 MiB per linear layer × 48 layers ≈ **144 MiB per sequence**, plus a small conv state with kernel dim 4) — **[MECHANISM]** product of config fields, but the exact state tensor layout is **UNVERIFIED against the engine implementation — OPEN**: confirm against vLLM/SGLang GDN state allocation before showing this number.
5. **No-cache cost grows quadratically.** Without keeping KV, producing T tokens after a P-token prompt executes `P + (P+1) + … + (P+T−1) = P·T + T(T−1)/2` token positions (dense-layer work); with KV: `P + T`. **[MECHANISM]** (handoff §4.3; classic transformer decode argument). Polynomial, **not** exponential (handoff line 106). Toy: P=1000, T=1000 → 1,499,500 positions vs 2,000 (≈750×).
6. **The KV cache stores computed key/value vectors per token position, not a table of token IDs.** **[MECHANISM]** (handoff line 106). Attention at each *new* token **reads** all prior K/V (or a window/subset, architecture-dependent) — caching removes *recompute*, not *reads*. **[MECHANISM]**
7. **KV dtype ≠ weight dtype.** vLLM exposes KV-cache quantization separately (`kv_cache_dtype="fp8" | "fp8_e4m3" | "fp8_e5m2"`, per-tensor or per-attention-head scales; FA3 + FP8 KV quantizes Q too). Source: [vLLM Quantized KV Cache docs](https://docs.vllm.ai/en/latest/features/quantization/quantized_kvcache/) (fetched 2026-11-18; doc footer dated 2026-11-02). NVFP4 KV is **not** listed on that page — the speaker's NVFP4-KV setup is engine/build-specific. **[VERSION-DEPENDENT]**
8. **Speaker's measured pool sizes.** Changing one serving config's KV cache from FP8 to NVFP4 grew the token pool from **741,032 → 1,225,765 tokens** (×1.65), from the speaker's home-k8s operating notes ([SKILL.md](https://github.com/dbirks/home-k8s/blob/main/.agents/skills/qwen38-27b-vllm/SKILL.md), as cited in `presentation-production-handoff.md` line 108). **[MEASURED — speaker's system, configuration-specific]** Not a universal FP8→NVFP4 ratio (ideal 4.5-bit block-scaled NVFP4 would suggest ~1.78×; actual pools differ due to other allocations — do not derive).
9. **Paged/block-quantized allocation is normal.** vLLM stores KV in fixed-size blocks (16-token default historically; **64** since v0.34.0 — see `engines-cache` fact 2); the PagedAttention paper is the original mechanism. Source: Kwon et al., *Efficient Memory Management for LLM Serving with PagedAttention*, [arXiv:2309.06180](https://arxiv.org/abs/2309.06180). **[MECHANISM]**

### Mechanism, precisely

Decode step `t`, full-attention layer, one sequence:

1. New token embedding → hidden vector `h` `[T?, 5120]` (batch=1 for decode).
2. Projections: `q = W_q h` → 24 heads × 256; `k = W_k h`, `v = W_v h` → **4 heads × 256 each** (GQA: 24 Q heads share 4 KV heads → only K,V are cached).
3. Append `k, v` to cache: per layer, per new token: `2 × 4 × 256 = 2,048` numbers = 4 KiB BF16; × 16 attention layers = 64 KiB/token (fact 3).
4. Attention reads `K[1..t]`, `V[1..t]` from cache + the single new `q`; softmax over positions; output = weighted sum of `V`.
5. FFN (both layer kinds) and Gated DeltaNet state update use `h`; the 48 linear layers fold the token into a fixed-size state, writing **no** per-token KV.
6. Without the cache, steps 2–5 must run for **every** prefix position each step → position-count quadratic (fact 5).

The prefix-cache/engines slides reuse items 2–3: a “block” in vLLM = 16 (now 64) of these per-token `[2,4,256]` slices across the 16 attention layers.

### Must not imply

- Not a cache of tokens, strings, or answers; it is float tensors indexed by position.
- Not every layer has KV in Qwen3.8-27B — do not fill 64 layer planes with KV tiles.
- With KV, old positions are **read** every step, just not recomputed; “we skip the earlier tokens” is wrong.
- No-cache cost is polynomial (quadratic in positions; attention FLOPs are a separate, also-quadratic meter), never exponential.
- The 2 GiB @ 32K figure is one sequence, BF16, tensor payload — not “what vLLM shows in `nvidia-smi`”.
- Weight quantization does not set KV precision; KV quantization does not (always) speed up kernels — support/throughput is kernel+hardware-dependent ([VERSION-DEPENDENT], handoff line 107).
- Context length is a model/runtime rule; KV pool capacity is a memory budget — not the same number (`--max-model-len` ≠ allocated cache).

### Visual ideas (3D, greyscale pixel style)

1. **“Recompute triangle vs cache strip” (variant A, extends v1 `nokv`/`kvcache`).**
   x = token position (0…12 toy, 8 prompt + 4 generated), y = decode step, z = layer. No-cache half: each step re-lays a full bar over positions 0..t → stacked slabs forming a triangle; total volume = `P·T + T(T−1)/2`, printed live. KV half: one new tile per step at position t, plus a *read* arrow sweeping the standing strip (label “read, not recompute”). Control: **context length n** slider (4→16) — recomputes the two counters (quadratic vs linear). Label the hybrid fact beside it: only 1 of every 4 layer planes holds tiles (Qwen3.8 layout), the other 3 planes hold a single thin state slab that does not grow.
2. **“VRAM slab filling” (variant B).**
   A 32 GB VRAM box (MANUFACTURER SPEC label); weights slab (hatched) at the bottom; above it, KV block tiles (16-token, engine-real granularity) stack as a chat grows. Per tile: 16 × 64 KiB = 1 MiB (BF16) — label every primitive. y = memory address, x = chat time. Control: **KV dtype** toggle BF16/FP8 → tile height halves, same tile count capacity doubles (echoes fact 8 without claiming the ratio). Toy: 8–16 tiles.
3. **“Per-step work meter” (variant C).**
   Horizontal token counter; two bars: “positions executed this step” (linear growth without cache; flat =1 with cache) and a cumulative area plot under each bar (triangle vs rectangle). One control: **tokens generated T** (4→16) recomputes both. Cheap, direct, pairs with the formula `P·T + T(T−1)/2` on-screen.

### Open questions for the speaker

- Which KV-dtype states to show (BF16/FP8 only, or the NVFP4 setup — public vLLM docs don't list NVFP4 KV)?
- Confirm the GDN per-sequence state estimate (≈144 MiB/sequence) against your engine's actual allocation, or drop the number and show “constant vs growing” qualitatively.
- OK to put your 741,032/1,225,765 pool numbers on the slide with “my system, this config” labeling?

---

## batching

### Facts

1. **Decode reads all resident weights once per engine step, whatever the batch B** (one fused pass per layer; batched GEMV/GEM). FLOPs ≈ `2·N·B` per step (2 FLOPs per weight per token), weight bytes = `N·b_w`. Weight-only arithmetic intensity **AI = 2B/b_w FLOPs per byte** — exactly B=1 → 1 FLOP/B at 16-bit (b_w=2), B=16 → 16 FLOPs/B. **[MECHANISM]** (roofline per handoff §4.4).
2. **Roofline:** `achievable FLOP/s ≤ min(P_peak, BW_eff × AI)`; memory-bound while `AI < P_peak/BW_eff` (the “ridge”). Adding batch B moves decode's AI right proportionally — that *is* why batching is nearly free in the bandwidth regime. **[MECHANISM]**. Reference explainer: [NVIDIA roofline blog](https://developer.nvidia.com/blog/co-designing-ai-model-attention-for-fast-interactive-long-context-inference/) (already cited in handoff D01).
3. **KV traffic is the counter-force.** Each sequence each step additionally *reads* its KV ≈ `bytes_per_token_KV × T` and writes one new tile. Qwen3.8-27B BF16: 64 KiB × 32,768 = 2 GiB read per sequence-step (packet `kv-cache` fact 3). KV bytes grow with **B×T** while weight bytes stay flat → at large B×T the step becomes KV-bound. **[MECHANISM]**
4. **Per-user vs aggregate:** `r_user = 1/Δt(B,T)`, `R_agg = B/Δt(B,T)`. In the weight-bound regime `Δt ≈ (W + B·kv(T))/BW` → R_agg grows ≈ linearly in B, r_user falls slowly; no measured curve exists for this machine yet. **[MECHANISM; formulas only — no numbers on slides except labelled toy arithmetic]**
5. **Hardware ceilings (context for the roofline axes):** RTX 5090 = 32 GB GDDR7, **1,792 GB/s** ([nvidia.com product page](https://www.nvidia.com/en-us/geforce/graphics-cards/50-series/rtx-5090/)); DGX Spark = 128 GB LPDDR5x, **273 GB/s** ([NVIDIA dev blog](https://developer.nvidia.com/blog/how-nvidia-dgx-sparks-performance-enables-intensive-ai-tasks/), [support spec page](https://www.nvidia.com/en-us/support/dgx-spark/)). **[MANUFACTURER SPEC — rated, not measured]** Peak FLOP/s for the 5090 in BF16/FP8 dense: **UNVERIFIED** (marketing “3352 AI TOPS” is FP4-with-sparsity; do not use as the ridge-point numerator).
6. **Continuous batching = per-step admission.** The scheduler forms a new batch every iteration: finished sequences leave, waiting prompts prefill in (often chunked), so requests do not wait for the whole batch to end. Origin: **ORCA**, Yu et al., OSDI ’22, [usenix.org/conference/osdi22/presentation/yu](https://www.usenix.org/conference/osdi22/presentation/yu); in vLLM's scheduler; llama.cpp server interleaves slots too (“Parallel decoding with multi-user support”, [server README](https://github.com/ggml-org/llama.cpp/blob/master/tools/server/README.md) top bullet). **[MECHANISM]**
7. **Prefill/decode are different regimes, not different machines:** prefill of P tokens = `2·N·P` FLOPs with one weight read → AI ≈ P per byte (huge) → usually compute-bound; decode = fact 1. Both always use cores and memory; “cores vs memory” is an absolute no. **[MECHANISM]** (handoff line 116–117).
8. **Toy bound arithmetic** (label **derived bound, not a prediction**): Qwen3.8-27B at ~27 B resident params × 2 B ≈ 54 GB BF16. At 1,792 GB/s the *weight-read floor* per step is 54e9/1.792e12 ≈ **30 ms** → ≤ ~33 tok/s at B=1 regardless of FLOPs (weight-bound intuition only; handoff line 548 forbids presenting this as a throughput estimate). B=16, each at 32K context: ≈ 54 + 16×2.15 ≈ 88 GB/step → ≈ 49 ms → ~20 tok/s/user, ~330 tok/s aggregate — all **[MECHANISM · TOY]** on rated bandwidth.
9. **Batching raises memory pressure, not just wins:** every admitted sequence costs live KV (fact 3) + engine overheads; capacity can cap B before compute does (DGX Spark's 273 GB/s can hold far more tokens than the 5090 can feed quickly — and vice versa; capacity ≠ bandwidth, handoff line 87). **[MECHANISM]**

### Mechanism, precisely

One engine step, batch B, layer with weights `W [d_out × d_in]`:

```
prefill:  H [P × d_in]  · Wᵀ → one weight read, 2·P·d_out·d_in FLOPs   (AI ~ P/b_w)
decode :  X [B × d_in]  · Wᵀ → one weight read, 2·B·d_out·d_in FLOPs   (AI ~ 2B/b_w …  B/b_w at b_w=2)
```

- Bytes moved per step ≈ `W_bytes + Σ_b (KV_read(T_b) + KV_write)`; FLOPs ≈ `2NB` (+ attention `~Σ T_b·d`, grows with context).
- Step time `Δt ≥ bytes/BW_eff`; while `W_bytes` dominates, `Δt` barely grows from B=1 to B=8–16 → each co-batched request rides the same weight fetch almost free.
- Ridge batch: `B* ≈ b_w·P_peak/(2·BW_eff)` — needs verified peak-FLOPs figure (UNVERIFIED above; leave B* symbolic or mark the slide “ridge value TBD”).
- Scheduler: admit → prefill (chunked) → decode lanes advance 1 token/step → retire; TTFT, inter-token latency, aggregate tok/s are three separate meters.

### Must not imply

- Batching does **not** multiply compute for free — it converts one weight read into B users of it; once B×KV or B×FLOPs dominates, per-user speed falls.
- No measured tok/s for any engine/GPU/model here — any curve is the labelled toy bound model (fact 8), never “a benchmark”.
- Don't infer tok/s by dividing weight bytes by rated bandwidth as a prediction (handoff line 548); it is a floor on time / ceiling on speed in the simplified streaming regime.
- Larger batch ≠ larger context: they consume the same KV pool differently.
- Decode is not “memory only” — attention compute, kernel launches, quant/dequant overhead all participate (handoff line 117).
- Per-user tok/s and aggregate tok/s must never share one meter or axis label.
- Batch size knobs (`--max-num-seqs`, `-np`, `--max-running-requests`) are caps/admission knobs in three engines with different semantics; not one flag concept shown as identical.

### Visual ideas

1. **“One slab, B lanes” (mechanism-primary; extends v1 `roofline`/`prefill`).**
   A big hatched weight slab (z = layer), and B request lanes on x. A pass animation: the slab is *lifted once* per step; B thin arrow fans (new-token vectors) enter, B new KV tiles (64 KiB scale-labelled) drop onto each lane's stack. Control: **B slider (1→16)** — recomputes weight bytes/req (`W/B` readout), aggregate vs per-user bound meters from fact 8's formulas. Toy B=16, lanes labelled A/B/user-2.
2. **Roofline plane with a batch dial.**
   x = arithmetic intensity (FLOPs/byte, log), y = achievable throughput (log, symbolic units), sloped plane `BW×I` + plateau `P_peak`; markers: prefill (far right), decode B=1 (x≈1), B=2/4/8/16 marching along the slope. The ridge line x=B* is labelled “needs verified peak FLOPs” or left as an unlabeled knee. Control: **B** moves the decode marker; readout: AI = 2B/b_w. Dark = the marker's current achievable ceiling.
3. **Three-meter service panel.**
   One step-timeline strip (continuous batching: prefill blocks, decode ticks, a lane retiring mid-strip and a new request admitted at the next tick — fact 6), below it three separate gauges: TTFT, per-user tok/s, aggregate tok/s. Control: **arrival rate / queue** toggle showing queue growth vs eviction-free region. All derived-bound labelled.

### Open questions for the speaker

- Do you have *any* measured tok/s vs batch curve from your box (even rough) we can label MEASURED on your system? Otherwise the slide stays formula+toy.
- Which hardware axis pair to show: 5090 vs Spark rated bandwidth (MANUFACTURER SPEC) on the roofline, or hardware-free (symbolic)?

---

## prefix-cache

### Facts

1. **What must match:** the *tokenized* initial sequence (after chat-template application), same model/config, same process/cache namespace; any mismatch at token k stops ordinary reuse at k−1. vLLM additionally requires whole-block alignment and, for multi-tenant isolation, the same `cache_salt` when used. Source: [vLLM APC design doc](https://docs.vllm.ai/en/latest/design/prefix_caching/) (fetched 2026-11-18). **[MECHANISM + doc]**
2. **vLLM: automatic prefix caching, on by default** (`enable_prefix_caching: bool = True`, [vllm/config/cache.py](https://github.com/vllm-project/vllm/blob/v0.34.0/vllm/config/cache.py) line 267 @ v0.34.0, verified in fetched file). Docs: “We only cache full blocks” — hits are quantized to block boundaries. Design doc Time-3 example: 14-token prompt sharing 10 tokens with a cached one, block size 4 → **only 8 tokens (2 blocks) hit**, the 2 extra shared tokens are recomputed. **[MECHANISM]** (doc example)
3. **Block granularity costs on the toy set (block_size 16):** shared prefix S = 1,000 tokens ⇒ blocks 0..61 = 992 tokens reusable (62 full blocks); the 63rd block mixes tokens 992–999 (shared) with R1's suffix → different hash → R2 recomputes from 992: **8 shared tokens wasted** (1.05% of S). With the new default 64 (@ v0.34.0, engines-cache fact 2) granularity wastes up to 63. **[MECHANISM]** arithmetic on doc semantics; label toy.
4. **llama.cpp server: prompt caching on by default, per-slot, exact-token LCP.** `cache_prompt` default `true`: “Re-use KV cache from a previous request … the common prefix does not have to be re-processed, only the suffix that differs” ([server README](https://github.com/ggml-org/llama.cpp/blob/master/tools/server/README.md), chat-completions/completions section, line 602 @ master 2026-11-18). Implementation: `n_past = slot.prompt.tokens.get_common_prefix(input_tokens)` — `tools/server/server-context.cpp` ~line 4063 @ master. No block quantization (reuses down to the exact token), but reuse is **within one slot's previous prompt** — see `engines-cache`. Caveat from README line 602: logits not guaranteed bit-identical vs non-cached path (nondeterminism note). **[doc + source]**
5. **The three-engine toy outcome table** (detail in `engines-cache`; same prompts): vLLM R2-hit = 992 of 1000 (block-quantized, any slot free); SGLang (page_size 1) R2-hit = 1000 tokens exactly (radix match is run-granular); llama.cpp R2-hit = 1000 *iff* R2 lands on the slot that already served S, else 0; R3 hits ~288 (vLLM), 300 (SGLang/llama.cpp same-slot). **[MECHANISM]** on the documented semantics.
6. **Eviction makes reuse conditional.** vLLM: cached blocks live in the free queue until allocated-from-head (LRU) — design doc “Eviction (LRU)” section. SGLang: `--radix-eviction-policy` default `lru` (docs.sglang.io server_arguments, fetched 2026-11-18; choices lru/lfu/slru/priority/tlru/joint_lru). llama.cpp: unified KV pool + `--cache-idle-slots` “save idle slots to the prompt cache on new task, and clear them when using unified KV (default: enabled, requires cache-ram)” (README line 171). Retention under concurrent agents, not the match rule, is usually what breaks. **[doc]**
7. **Consequence metric:** a crowded-out prefix turns a warm request cold → prefill reappears in TTFT while decode tok/s stays high; watch cached-input-tokens / prefix-hit ratio, preemptions, p50/p95 TTFT (handoff line 123). Formulas + axes only until the speaker measures. **[MECHANISM / OPEN]**
8. **Cross-tenant timing leakage is real enough that vLLM ships `cache_salt`** — “block reuse can leak existence via timing”; salt injected into block-0 hash ([design doc, “Cache Isolation for Security”](https://docs.vllm.ai/en/latest/design/prefix_caching/)). **[doc]**

### Mechanism, precisely

Reuse condition in one line per engine: *vLLM* `hash(parent_hash, block_tokens, extra_keys)` of each **full** 16/64-token block looked up in `cached_block_hash_to_block` → reused physical block; *SGLang* walk radix tree consuming up to `page_size` tokens per edge until mismatch → reuse the KV slot indices on the matched path, prefill the rest; *llama.cpp* longest common **prefix** of token-ID lists vs the slot's stored prompt (`get_common_prefix`), `n_past` = LCP length, evaluate only the suffix; optionally chunk-shift rescue for equal chunks ≥ `--cache-reuse` tokens after the prefix breaks (see `engines-cache`).

Worked toy (block 16): R1 prefill 1,020 tokens → 63 full blocks (1008 tok) + partial; R2 (same S, 980-tok suffix): first 62 blocks hit (992 tok); blocks from 992 recomputed; only R2's own blocks ≥ full become newly cacheable. Refcounts: blocks hit by two live requests have ref_cnt 2 → freed to the queue only when both release.

### Must not imply

- Not “the model remembers” — it is an exact-match index over token positions; a changed tool-schema field or date line mid-system-prompt truncates reuse there (R3).
- Not shared across model processes/hosts; each engine process (and each LLM-Collective machine) has **its own** cache (handoff line 124/169).
- A hit saves the *prefill* of the matched tokens only; decode still runs token-by-token.
- Availability ≠ reuse: eviction (LRU) can have dropped S by the time R2 arrives; “cached” must be shown as a lifetime, not a permanent store.
- Don't imply all three engines dedupe physical memory identically (vLLM shares block copies; llama.cpp slots do not necessarily — see next section).
- No specific provider's prompt-caching pricing/latency claims here.

### Visual ideas

1. **“Token strips + block grid” (variant A).**
   Three request strips (R1, R2, R3) on x = token position (toy 12–16 tiles, labelled “S ×9 … u ×3”), y = request. Below: a block grid (z = physical VRAM block ID) with tiles hashing in. A mismatch tile flashes “recompute”. Control: **block size 1 / 4 / 16 / 64** — re-steps the hit boundary over the R2 strip, live counter “shared but recomputed: 0/2/8/…”. Dark = hit tiles; hatched = recomputed.
2. **Lifetime/eviction theatre (variant B, extends D05).**
   Fixed VRAM slab (y = capacity); prefix S's blocks sit as a dark run; new agents' blocks pile in; at overflow the head of the free queue (oldest green line) pops and fades. A “next R2 arrives” button then replays TTFT: hit (short bar) if S survives, cold (long bar = P·T prefill work from `batching`) if evicted. Control: **agent count / pool size**. Toy: 10 blocks, 4 requests.
3. **Divergence microscope (variant C).**
   One prompt stream's tokens as tiles; overlay the exact diff point between S and S′ at token 300 (toy: tile 9); every engine's stored object dims right of that line. Control: **mismatch position slider** moves the truncation edge and recomputes hit token counts (block-quantized for vLLM granularity toggle). Shows “first difference kills everything after it”.

### Open questions for the speaker

- Any captured TTFT traces (warm vs cold) from the agents setup to label MEASURED?
- Want the cache_salt/security tangent on the slide, or keep it packet-only?
- llama.cpp demo: show default single-user prompt caching, or `-np` slots (that belongs to `engines-cache`)?

---

## engines-cache

### Facts

**vLLM (hash-chained fixed blocks)**

1. Default block size: **16 tokens through v0.33.0** (`DEFAULT_BLOCK_SIZE: ClassVar[int] = 16` in `vllm/config/cache.py` @ v0.20.0/v0.25.0/v0.30.0/v0.31.0/v0.32.0/v0.33.0, raw files checked 2026-11-18) → **64 in v0.34.0 and main** (`= 64`, [vllm/config/cache.py @ v0.34.0](https://github.com/vllm-project/vllm/blob/v0.34.0/vllm/config/cache.py) line 185; latest release v0.34.0 = 2026-11-16). **[VERSION-DEPENDENT — brief said 16; that is stale as of 2026-11-16.]**
2. Block hash = `hash((parent_block_hash, tuple(block_token_ids), extra_keys))`, first block's parent = `NONE_HASH` — `hash_block_tokens()`, [vllm/v1/core/kv_cache_utils.py](https://github.com/vllm-project/vllm/blob/main/vllm/v1/core/kv_cache_utils.py) lines 697–728 @ main (fetched 2026-11-18); chaining rationale and the block-1/2/3 prefix diagram: [design/prefix_caching](https://docs.vllm.ai/en/latest/design/prefix_caching/). `extra_keys` carry LoRA ids, multimodal image hashes, `cache_salt`. **[source+doc]**
3. Default hash algo `sha256` **since v0.11** (“addresses collision risks”; older versions “not guaranteed collision-free”); options `sha256_cbor`, `xxhash`, `xxhash_cbor` (`--prefix-caching-hash-algo`). **[doc / VERSION-DEPENDENT]** (design doc Note 2)
4. Structures: `KVCacheManager` ([vllm/v1/core/kv_cache_manager.py](https://github.com/vllm-project/vllm/blob/main/vllm/v1/core/kv_cache_manager.py)) → `BlockPool` ([vllm/v1/core/block_pool.py](https://github.com/vllm-project/vllm/blob/main/vllm/v1/core/block_pool.py), class line 107: `free_block_queue` “stores the free blocks in eviction order”, `cached_block_hash_to_block` hash→blocks map) → `FreeKVCacheBlockQueue`, an O(1)-remove doubly-linked list (design doc “Data Structure”; API doc [kv_cache_utils](https://docs.vllm.ai/en/latest/api/vllm/v1/core/kv_cache_utils/)). **[source]**
5. Ops semantics (design doc, “Operations”): allocate = pop free-queue **head** (evicting the LRU cached block it lands on); request free = blocks appended to queue **tail in reverse order** (“last block … should be evicted first”); hit = “touch” → ref_cnt++ and unlink from free queue. Duplication: v1's append-only block tables allow duplicate cached blocks for one hash key, “eliminated when the request is freed” — do **not** claim automatic physical dedupe on every write. **[doc/source]**
6. Hybrid-model caveat: with prefix caching, Mamba/GDN state is stored only at the Mamba block grid → hits can resume only at block boundaries; `--enable-mamba-shared-prefix-checkpoint` (off by default) adds a checkpoint at the shared-prefix junction; `--prefix-match-unit` sets key granularity. [vLLM docs/features/automatic_prefix_caching.md “Hybrid Mamba models”](https://docs.vllm.ai/en/latest/features/automatic_prefix_caching/) @ main. **[doc / VERSION-DEPENDENT; new 2026 surface — re-verify before showing flags]**

**SGLang (RadixAttention, token radix tree)**

7. Radix tree over token sequences; `TreeNode` holds edge token-key + KV slot indices + `last_access_time`; `match_prefix()` finds the longest cached prefix; nodes split at match boundaries. [python/sglang/srt/mem_cache/radix_cache.py @ main](https://github.com/sgl-project/sglang/blob/main/python/sglang/srt/mem_cache/radix_cache.py) — fetched file: `RadixCache` class line 282, `match_prefix` line 369, insert splits “leaf at the prompt boundary” (line ~491 comment). **[source]**
8. Eviction = LRU over **evictable leaves** via a heap; when a leaf is removed its parent re-enters candidacy — eviction “walks a branch from its tip toward the root”; root never evictable; unlocked = no in-flight request. [docs.sglang.io “Radix Cache Eviction Policies”](https://docs.sglang.io/docs/advanced_features/radix_eviction_policy) + `radix_cache.py evict()` lines 559–582 (`heapq` + `TreeNode.__lt__` on `last_access_time`, line 279). Default `--radix-eviction-policy lru` (server_arguments docs table, fetched 2026-11-18; lfu/slru/priority/tlru/joint_lru selectable). **[doc+source]**
9. `--page-size` default **1** (server_arguments docs table, fetched 2026-11-18): radix matching is token-granular by default → exact 1,000-token reuse of S; with page_size>1 reuse aligns to full pages (mechanism; exact flag interaction **UNVERIFIED**). **[doc]**
10. Cache-aware scheduling exists but **is not the default anymore**: `CacheAwarePolicy.LPM = "lpm" # longest prefix match`, `DFS_WEIGHT` etc. in [python/sglang/srt/managers/schedule_policy.py @ main](https://github.com/sgl-project/sglang/blob/main/python/sglang/srt/managers/schedule_policy.py) lines 175–177; `_sort_by_longest_prefix` reorders the waiting queue by tree-hit length. **Default `--schedule-policy` is now `fcfs`** (dataclass `= "fcfs"` @ commit b498f462, 2026-08-11, and the live server_arguments doc table shows default `fcfs`, options `lpm, random, fcfs, dfs-weight, lof, priority, routing-key`). Older SGLang docs (hyperparameter_tuning.md) stated lpm was the default — stale. **[VERSION-DEPENDENT — this changed in 2026; cite date]**
11. Paper name: RadixAttention comes from *SGLang: Efficient Execution of Structured Language Model Programs*, [arXiv:2312.07104](https://arxiv.org/abs/2312.07104) (title verified via arXiv API 2026-11-18). “Unified Radix Cache” (full KV + sliding-window + recurrent checkpoints, different valid reuse boundaries): [sglang.io blog](https://www.sglang.io/blog/unified-radix-cache) (cited in handoff; content not re-fetched — **treat details as [UNVERIFIED secondary]**). HiCache host-tier offload exists (`--hicache-ratio` default 2.0, server_arguments table). **[doc]**

**llama.cpp server (per-slot prompt cache)**

12. Slots: `-np, --parallel N` “number of server slots (default: -1, -1 = auto)” ([README line 178 @ master](https://github.com/ggml-org/llama.cpp/blob/master/tools/server/README.md)). Unified KV: `-kvu, --kv-unified` “use single unified KV buffer shared across all sequences (default: enabled if number of slots is auto)” (line 170); `--kv-unified-per-slot N` sizes per-slot limits of the shared pool (line 166, added by PR #24124, merged 2026-08-27); cross-slot unified support: PR #16736 (commit cd5e3b5, 2025-11-02). **Unified buffer ≠ deduplicated prefix KV: a shared pool still stores each slot's own copy of identical prompt tokens** (handoff line 122; no source found claiming cross-slot physical sharing — **[OPEN/MECHANISM]**).
13. Reuse rule: per slot, LCP of token IDs against that slot's previous prompt — `server-context.cpp` ~line 4061–4103 @ master: `if (slot.task->params.cache_prompt …) n_past = slot.prompt.tokens.get_common_prefix(input_tokens)`. `cache_prompt` per-request default true (README line 602). **[source]**
14. `--cache-reuse N` (default 0): after the common prefix, scan the old prompt and the new one for equal runs ≥ N tokens and **shift their KV to the new positions** instead of recomputing: loop at `server-context.cpp` ~lines 4092–4130 — `kv_shift = head_p − head_c; slot.mem.seq_rm(slot.id, head_p, head_c); slot.mem.seq_add(slot.id, head_c, head_c + n_match, kv_shift)`; requires `llama_memory_can_shift` and no multimodal; chunks with control/special tokens excluded per PR description [#9866](https://github.com/ggml-org/llama.cpp/pull/9866). This is the only one of the three engines that recovers non-prefix chunks. **[source]**
15. Slot persistence: `--slot-save-path PATH` (README line 230) + `POST /slots/{id}?action=save|restore|clear` — saves/restores a slot's prompt-cache state to file (README ~lines 1268–1303, sample `n_saved: 1745`). RAM tier: `-cram, --cache-ram N` max RAM cache MiB (default 8192; PR #16391) with `--cache-idle-slots` (default enabled, requires cache-ram) parking idle slots' prefixes. **[doc]**

**Same three prompts → what each engine stores/reuses** (toy: S=1,000 tok, mismatch at 300; versions above):

| | R1 (first) | R2 (same S) | R3 (S′, differs @ 300) | Unit of reuse | Eviction |
|---|---|---|---|---|---|
| vLLM | prefill all, cache full blocks (bs 16: 62 shared blocks) | hit 992 tok (bs 16) / 960 (bs 64); rest recomputed | hit ⌊300/bs⌋·bs = 288 (bs 16) | chained-hash block | LRU free-queue head |
| SGLang | prefill all; tree root→S edge→R1 branch | reuse exactly 1,000; branch added; S node shared, refcounted | split edge at 300; reuse 300 | token run on radix edge (page 1) | LRU evictable leaf, tip→root |
| llama.cpp | slot k: prefill all; S lives in slot k's KV | reuse 1,000 **only if** served by slot k; new slot ⇒ full re-prefill; `--cache-reuse` can still shift ≥N-chunks | same-slot: reuse 300; fresh slot: 0 (+chunk-shift rescue) | slot-local exact prefix (+RAM/file tier) | slot purge / cache-ram eviction (exact policy **UNVERIFIED**) |

### Mechanism, precisely

Lookup for a new request, per engine, ≤10 lines:

```
vLLM    tokens → chunks of block_size → h_i = H(h_{i-1}, toks_i, extra) for each full block
        → lookup h in cached_block_hash_to_block → touch (ref_cnt++, unlink from free queue)
        → new blocks = free_queue.popleft() (evict if cached); partial tail never hits.
SGLang  key = token list; descend tree consuming page-aligned runs; last matching node's
        device_indices = reused slots; split node at boundary on insert; LRU heap on leaves.
llama   n_past = LCP(slot.prev_tokens, new_tokens); prefill suffix;
        if cache_reuse ≥ chunk: seq_rm+seq_add shift equal mid-chunks by Δpos, n_past += match.
```

Hash chaining is what makes vLLM O(blocks) instead of O(prefix²) hashing (docs + `hash_block_tokens` LRU memo). Radix edges hold *runs* so one node can be the whole system prompt (compressed trie ⇒ few nodes; branch points at divergences only). llama.cpp stores no index at all — the “index” is positional inside a slot, hence slot affinity is the caching policy in practice.

### Must not imply

- RadixAttention is a **cache index**, not a different attention math (handoff line 121); a speculative-decoding candidate tree is an unrelated tree — do not reuse the same visual grammar for both.
- Three structures ≠ three equal caches: block-quantized hashing (wasted 8–63 shared tokens), token-granular tree (exact), slot-local (exact but per-slot, no cross-slot dedupe known).
- vLLM blocks are physically shared across requests when hit (ref_cnt>1); llama.cpp unified KV is a shared *pool*, not shared *content*; SGLang tree nodes are single copies with refcounts. Show at least one of these distinctions on screen, or the slide says “three ways to index, one copy each”.
- Don't show LPM as SGLang's default scheduling — it changed; as of 2026-08-11 (b498f462) and the live docs the default is `fcfs` (fact 10). If the slide says “cache-aware scheduling”, pair it with the flag name and date.
- `--cache-reuse` shifting is approximate-feeling magic: it relocates KV conditioned on the *old* positions to new positions — quality is workload-dependent; it requires ≥N-token runs without special tokens and a shift-capable memory backend. Not “unlimited context editing”.
- Engine versions move: vLLM default block size flipped 16→64 **two days before talk-prep**; every flag on screen needs a version tag.

### Visual ideas

1. **Variant A — three side-by-side structures, one prompt stream** (the plan's default).
   Shared x = the three toy prompts fed in sequence (R1, R2, R3; strips as in `prefix-cache`). Per engine column, its own z-depth structure grows: (1) vLLM: chain of block cubes, each cube's label showing `hash(prev‖toks)`, R2's arrow re-points at 62 hit cubes, one split cube “8 shared, still recomputed”; (2) SGLang: compressed trie — trunk cube labelled S(1000) splits into two leaf prisms, R3 splits the trunk at 300; (3) llama.cpp: two slot strips, R2 landing on slot 0 (hit, dark) vs slot 1 (cold, hatched), plus a demo of a mid-chunk teleporting under `--cache-reuse`. Control: **which slot does R2 land on** — flips llama.cpp between exact reuse and full re-prefill while vLLM/SGLang stay unaffected; that contrast *is* the slide. Toy: 12-token prompts in 4-token blocks, 3-node tree.
2. **Variant B — one structure morph.**
   A single token strip on x; a toggle swaps the index projection: blocks chain (cubes + hash arrows) ⇄ radix trunk/branches (y = branch point, z = depth) ⇄ slot lanes (y = slot id). The three prompts replay under each projection, hit extents recomputed. Honest but must label “same three prompts, different bookkeeping” so nobody reads it as three caches.
3. **Variant C — timed lookup.**
   One new request R2 enters; a scrubber steps: tokenize → (per engine, in sequence) hash chain / tree descend / LCP compare → reused extent glows in the KV slab → suffix prefill bar (length = P−hit, tied to `batching`'s cost meter). Steppable 0–6, reset. Best if A is too dense for projection size.

### Open questions for the speaker

- Which vLLM version will you actually run on stage (v0.33 block-16 world vs v0.34 block-64 world)? The toy arithmetic changes.
- Do you run llama.cpp with `-np` + unified KV (or was it `--parallel 1` slot-per-client)? Determines which llama.cpp column is “your setup”.
- Want the SGLang Unified-Radix (SWA + recurrent checkpoints) tangent, or is one-hybrid-model mention on `kv-cache` enough?
- Any preference on showing hash *contents* (parent-hash chain) as literal hash strings vs unlabeled link edges on a projector?

---

## Cross-cutting verification notes

- vLLM `v0.34.0` files fetched raw from GitHub tags; SGLang field defaults read from tag/commit snapshots (main is mid-refactor: `server_args.py` is a stub @ v0.5.23, defaults verified from docs table + commit b498f462 @ 2026-08-11); llama.cpp from `master` raw files @ 2026-11-18 (README + server-context.cpp; line numbers shift — cite file+symbol when locking slides).
- Numbers NOT found and NOT invented: 5090 dense BF16/FP8 peak FLOPs (ridge point), llama.cpp cache-ram eviction policy, SGLang page_size>1 match granularity, GDN per-sequence state bytes as allocated by engines, any tok/s measurement.
