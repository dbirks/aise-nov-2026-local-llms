# Visualization audit — every talk slide

Date: 2026-11-16 · Auditor: research pass (no code changes) · Scope: `src/slides.ts` up to `...splatLab`
Reads: [AGENTS.md](../../AGENTS.md) · [src/slides.ts](../../src/slides.ts) ·
[pixel-scenes NOTES.md](../../design/handoff/pixel-scenes/NOTES.md) · [src/scenes/pixel-viz.js](../../src/scenes/pixel-viz.js) ·
[research notes](../local-llm-talk-research-notes.md) (passes 2–3). Verdicts: KEEP · ADJUST · REPLACE · ADD-VISUAL · FINE-AS-TEXT.

**Three deck-wide facts found in code (they drive several verdicts):**

- `SceneLayout` prints `simulated · <state line>` on every scene slide ([SceneLayout.tsx:141](../../src/layouts/SceneLayout.tsx)) —
  good compliance with AGENTS.md's simulated-data labeling. But the label is attached to *everything*, including math that is
  exact (softmax temperature, left-to-right draft acceptance). Recommend distinguishing **"illustrative geometry"**
  (made-up scale/timing) from **"no measured hardware numbers"** — same words on stage, different meaning.
- `CommandLayout` is static: it inverts `slide.active` and nothing else — no click, no `←`/`→` stepping, no scene binding
  ([CommandLayout.tsx](../../src/layouts/CommandLayout.tsx)). So `cmd-kv`'s "Each selected flag opens its 3D scene, then returns
  here" is currently false, and the config-as-map device the README/AGENTS ask for does not exist yet.
- Housekeeping: 10 of the 15 talk slides carry `example: true` → an EXAMPLE badge on most real content. Scenes have no
  on-canvas text at all (no label primitive in `pixel-viz.js`), so mechanisms needing a named axis stay unlabelled.

---

## title

- **Claim**: deck title + chapter list 01 Choose / 02 Fit / 03 Fast / 04 Serve / 05 Connect.
- **Current visual**: type `title`, no scene.
- **Verdict**: KEEP.
- **Why**: chapters match README's five-step route and every scene chip claims to reference them. Only inconsistency: the
  numbering convention breaks at `splat-lab` (`number: 'GS'`), which is not in this list.

## premise

- **Claim**: "You ran a model. Now what?" + four bullets (pick/fit/fast/serve+connect).
- **Current visual**: type `list`, text-only.
- **Verdict**: FINE-AS-TEXT.
- **Why**: 30 seconds of framing needs no geometry; a scene here competes with the title for attention. Two copy fixes:
  the third bullet ("bandwidth, batching, speculation") hides the prefill/decode split that AGENTS.md insists is a separate
  axis; and drop `example: true` once wording is final. Optional: number the bullets 01–05 to mirror the title chapters
  (currently 4 bullets ↔ 5 chapters).

## choose (section 01)

- **Claim**: framing = "Dense or mixture-of-experts, total versus active parameters, and what each costs in memory."
- **Current visual**: type `section`.
- **Verdict**: KEEP (divider) — chapter is **under-filled** (see Missing scenes M5): framing promises "what each costs in
  memory", but the chapter has one scene (`moe`) and it never shows bytes.
- **Why**: no dense-vs-MoE cost visual and no total-vs-active readout. The claim has a citable instance: Qwen3-30B-A3B's card
  records "30.5B in total and 3.3B activated", 48 layers, 128 experts, 8 activated
  ([model card](https://huggingface.co/Qwen/Qwen3-30B-A3B)).

## moe (scene `moe`, chip "01 — Choose a model")

- **Claim**: "Each token runs through a few experts per layer. Every expert stays loaded, because the next token may pick
  different ones."
- **Current visual**: `buildMoE`: L=4 layer plates × E=8 expert boxes, one router cube per layer, a token tile climbing the
  stack, beams drawn router→selected expert, per-instance darkening while selected, optional long-run "usage heat", `k` 1–4.
  Routing is `rng`-uniform random.
- **Verdict**: ADJUST.
- **Why**: this is the deck's best mechanism↔geometry match: nothing ever disappears, so *active ≠ resident* is shown, not
  asserted (AGENTS.md "MoE 'active parameters' are not total memory occupancy"). Random routing is disclosed in `notes`.
  Three problems:
  1. **"Every expert stays loaded" is a default, not a law.** llama.cpp has `--cpu-moe` / `--n-cpu-moe N` precisely to keep
     expert weights in system RAM ([PR #15077](https://github.com/ggml-org/llama.cpp/pull/15077)). As written the caption
     teaches the audience that expert offload is impossible, and it also hides the chapter-02 link (this *is* a fit decision).
  2. **Scale is silently wrong**: 4 layers × 8 experts vs the model card's 48 × 128 (8 active). Nothing on slide says which
     world the audience is in.
  3. **No numbers where the caption needs them**: "a few experts per layer" is a fraction of FFN mass, which is the sentence
     the slide is about.
- **Proposal**: same geometry, plus (a) readout `active params ≈ k/E of FFN bytes` (with the card's 3.3B/30.5B as the real
  anchor), (b) a caption state line "illustrative scale 4×8; Qwen3-30B-A3B: 48 layers × 128 experts, 8 active",
  (c) a residency toggle `all resident / experts in RAM`: dim all expert boxes into a single RAM slab and give each selected
  expert a bus hop, reusing `buildOffload`'s bus box + activation cube. Takeaway (15 s): "One token uses a few experts per
  layer; the other experts are idle but still occupy memory — unless you deliberately park them in RAM and pay bandwidth."
  Controls: keep `k`, `usage`; add `residency`. Caveats: expert sizes are equal here, real experts are equal only in
  balanced-MoE designs (unverified for the speaker's actual model); per-layer router logits are not shown — do not imply
  the top-k set is the same across layers (the code re-randomises per layer, which is right).

## fit (section 02)

- **Claim**: framing = "Weights, KV cache and runtime workspace all compete for the same memory."
- **Current visual**: type `section`.
- **Verdict**: KEEP (divider); chapter is missing its anchor scene (Missing scenes **M1**).
- **Why**: nothing in this chapter shows KV cache or workspace — only `-ngl` weight placement. The framing sentence currently
  has one third of its content visualised.

## cmd-kv (command, header "02 — Make it fit")

- **Claim**: title "KV cache precision"; body "Set separately from weight precision. Each selected flag opens its 3D scene,
  then returns here." Lines: `vllm serve $MODEL`, `--max-model-len …`, `--kv-cache-dtype fp8` (active),
  `--gpu-memory-utilization …`, `--max-num-seqs …`.
- **Current visual**: static inverted command lines + side card.
- **Verdict**: REPLACE (copy + behaviour).
- **Why**:
  1. The body promises navigation the layout cannot do (see deck-wide facts) and there is **no KV-cache scene to open**.
  2. "Set separately from weight precision" is the correct AGENTS.md constraint (weight vs activation vs KV quantization are
     distinct) but the command shows no weight-precision flag, so the contrast is invisible.
  3. `--kv-cache-dtype fp8` understates the caveat: in vLLM fp8 (e4m3) KV storage may also put attention *in* the fp8 domain
     with the FA3 backend (queries quantized too), while other kernels dequantize on read
     ([Quantized KV cache](https://docs.vllm.ai/en/stable/features/quantization/quantized_kv_cache/),
     [vLLM blog 2026-04-22](https://vllm.ai/blog/2026-04-22-fp8-kvcache)) — i.e. it is not only a storage knob.
     Also "lower precision ⇒ better throughput" must not be implied (AGENTS.md).
  4. `--gpu-memory-utilization …` as an elided value is right for a 201 talk, but current vLLM docs describe sizing the cache
     from memory free after warmup (extensible KV cache) and treating an explicit value as a hard cap
     ([Optimization and tuning](https://docs.vllm.ai/en/stable/configuration/optimization/),
     [engine args](https://docs.vllm.ai/en/stable/configuration/engine_args/)). The scene must not present it as
     "initialize the KV cache" (research-notes flag-mapping says the same).
  5. Syntax is plausible but **unverified against the installed version** (AGENTS.md checkpoint) — no `llama-server` twin
     exists, yet chapter 02's other scene maps to a llama.cpp flag (`-ngl`).
- **Proposal**: two command slides, one per engine, sharing layout: vLLM (`--max-model-len`, `--quantization`,
  `--kv-cache-dtype`, `--gpu-memory-utilization`, `--max-num-seqs`) and llama.cpp (`-m x.gguf`, `--ctx-size`, `-ngl`,
  `-ctk/-ctv` — defaults f16, `q8_0`/`q4_0`… allowed
  ([server README](https://github.com/ggml-org/llama.cpp/blob/master/tools/server/README.md))). Make `active` step with
  `←`/`→` and bind each line to a scene id (`Enter`/Space opens it, `Esc`/`.` returns) — that is the whole navigation device,
  and it needs a `command` layout change plus a scene-id field in `types.ts` (contract change → escalate, do not hand-edit).
  Caption for the KV line: "cache storage precision is its own dial: it changes how much fits *and* what attention reads."

## offload (scene `offload`, chip "02 — Make it fit")

- **Claim**: "-ngl decides how many layers live in VRAM. The rest run from system RAM, and activations cross the bus once per token."
- **Current visual**: `buildOffload`: 12 slabs stacked, `onG(i) = i ≥ 12−ngl` (deepest layers go to GPU — matches llama.cpp),
  CPU platform left / GPU platform right, bus bar at z=1.45, a 9-layer wireframe capacity box over the GPU stack, activation
  cube walks a route with a bus hop only at the CPU→GPU boundary; per-layer step duration 0.44 (CPU) vs 0.10 (GPU);
  slabs beyond CAP flash near-white.
- **Verdict**: ADJUST.
- **Why**: the *contiguous split* and *single boundary crossing* are faithful, and the state emits `over: max(0, ngl−CAP)`.
  Problems, in order of severity:
  1. **The cost is attributed to the bus, but it is mostly bandwidth.** Per token, activations are tiny (≈ hidden-dim × dtype,
     a few MB even at 4096 width) while CPU-resident layers must stream *their weights* from system RAM every token. That
     asymmetry is the actual lesson and the geometry hides it: the only cue is invented step durations (NOTES: "timing ratios
     are made up"). Fix the copy and show the two byte counters.
  2. **`CAP = 9` layers invents a hardware capacity in layers.** Layer byte sizes differ (attention vs FFN, first/last,
     embedding), and KV cache + workspace also live in VRAM (AGENTS.md: capacity is its own axis). Express the budget in GiB.
  3. **KV cache is absent from the scene**, so "the same memory" competition in chapter 02 is not shown here either.
     In llama.cpp multi-GPU *layer* mode "the KV cache for layer *l* lives on the GPU that owns layer *l*"
     ([docs/multi-gpu.md](https://github.com/ggml-org/llama.cpp/blob/master/docs/multi-gpu.md)), and KV offload is a separate
     switch (`-kvo/--kv-offload`, default enabled per the packaged
     [llama-server(1) manpage](https://manpages.debian.org/unstable/llama.cpp-tools/llama-server.1.en.html)) — so
     "activations cross the bus once per token" is a special case, not a general rule.
  4. `-ngl` is llama.cpp syntax sitting under a vLLM-only command slide; the chapter needs both spellings (see `cmd-kv`).
- **Proposal**: keep x = device, y = layer index (execution order), z = bus lane; add (a) slab **size ∝ bytes** (or at least
  attention-slab vs FFN-slab widths) so the VRAM budget can be a GiB fill plane instead of a 9-layer box; (b) two live
  counters per token: `weights read from RAM` (sum of offloaded slab bytes) and `activation bytes over PCIe`; (c) KV block
  columns rising beside the GPU stack, fed by the same control as **M1**; (d) controls `-ngl` + weight precision (reuse
  `flow`'s `SZW` 4 / 2.1 / 1.15 idea) + a `KV on GPU / KV in RAM` toggle. Takeaway: "-ngl is a bet on bandwidth: every token
  now streams those layers' weights out of system RAM."

## fast (section 03)

- **Claim**: framing = "Decode is a memory stream. Speed comes from moving fewer bytes per useful token."
- **Current visual**: type `section`.
- **Verdict**: ADJUST (copy).
- **Why**: the sentence is a decode-only truth and silently skips prefill, which AGENTS.md requires to stay a separate axis.
  Suggested framing: "Prefill computes a prompt; decode streams a memory. Each has its own bottleneck." (Missing scene
  **M4**.)

## flow (scene `flow`, chip "03 — Make it fast")

- **Claim**: "Every decode step reads all active weights. Smaller weights or wider pipes help; a batch reuses one stream."
- **Current visual**: `buildFlow`: particle basin = weights (draw count ∝ `SZW` FP16 4 / Q8 2.1 / Q4 1.15), tube radius =
  bandwidth tier `BW` RAM 1 / Unified 3 / VRAM 7, 1600 stream particles on Frenet frames, faceted core = model, 36-segment
  ring = step progress, `B` dark orbs spawn per completed step; readout `rel = BW/size × 4`.
- **Verdict**: ADJUST — the strongest physics in the deck, with two misleading implications.
- **Why**:
  1. **Batch looks like a speed multiplier for you.** Spawning `B` orbs per step reads as "batch 8 ⇒ 8× faster"; batching
     multiplies *aggregate* throughput, while per-user token latency typically flattens or worsens (AGENTS.md keeps those
     axes separate; vLLM's tuning guide frames batching/chunked-prefill as throughput-vs-latency tradeoffs,
     [docs](https://docs.vllm.ai/en/stable/configuration/optimization/)).
  2. **Weights-only stream** (the scene's own `notes` admit it). Decode reads weights *once per step* but reads KV *per
     sequence per step*, so bytes/step ≈ W + B·KV(t): KV grows with batch and context while W does not
     (Pope et al., *Efficiently Scaling Transformer Inference*, [arXiv:2211.05102](https://arxiv.org/abs/2211.05102)).
     Illustrative arithmetic from the Qwen3-30B-A3B card (48 layers, 4 KV heads, head_dim 128 *unverified*):
     2·4·128·2 B ≈ 98 KB/token ⇒ ≈3.1 GB per 32K-token sequence at f16; at B=8 that is ≈25 GB of KV read per step against
     ≈18–19 GB of Q4_K_M weights — i.e. the "extra" stream overtakes the one the scene draws. Label this arithmetic
     explicitly as computed-from-card-numbers, not measured.
  3. `BW = {RAM 1, Unified 3, VRAM 7}` is an invented monotone tier list; unified-memory machines can beat mid-tier dGPUs on
     bandwidth, so "Unified sits between RAM and VRAM" is hardware-specific (unverified as a general claim).
  4. "all active weights" is right for dense; for MoE it is only the selected experts (cross-link to `moe`).
- **Proposal**: keep the basin/pipe/core grammar. Add (a) a **second, thinner stream** "KV" emerging from a VRAM slab whose
  particle count and pipe radius scale with a `context length` and `batch` control; (b) print the one formula the scene is
  really about: **bytes per useful token = W/B + KV(t)**; (c) two meters, `tokens/s total` and `tokens/s per request = total/B`;
  (d) a `dense / MoE (only active experts)` toggle that shrinks the basin. Takeaway: "Batching amortises the weight read over
  B sequences — until the KV reads for those B contexts become the stream."

## spec (scene `spec`, chip "03 — Make it fast")

- **Claim**: "A small draft proposes K tokens. One target pass keeps the accepted prefix and adds one token of its own."
- **Current visual**: `buildSpec`: output row + draft lane; `start()` rolls a left-to-right first rejection index `a`
  (`r() > p`), draft boxes pop sequentially under a moving draft slab; a translucent target slab rises to span K+1 positions
  (`verify` → `check`); accepted drafts darken and commit into the row, the rejected one and all descendants fall away
  (`st=2/3`, shrinking); one dark target token is emitted from above; `n += a+1`; 18-slot strip then `full` → reset.
- **Verdict**: ADJUST (keep geometry; fix copy; add the missing verification mode).
- **Why**: the *linear-draft ancestry* rule — first rejection invalidates everything conditioned on it, target supplies the
  correction, and the all-accepted case yields a bonus target token (`a = K` path emits K accepted + 1 target) — is drawn
  correctly and matches research-notes pass 2 and the original algorithm
  (Leviathan et al., ICML 2023, [PMLR](https://proceedings.mlr.press/v202/leviathan23a.html)). Gaps:
  1. **Verification is equality-flavoured.** A fixed per-token `p` with "keeps the accepted prefix" copy is the *greedy*
     story. AGENTS.md is explicit: distribution-preserving verification is accept `min(1, p(x)/q(x))` then resample from
     `(p−q)⁺`, i.e. **overlap (1−TV), not top-1 matching**. That is the talk's most technical claim and it is currently only
     in speaker notes.
  2. **One drafter shape is presented as the mechanism.** Draft duration `K×0.22` encodes a *sequential* drafter; a block
     drafter (DFlash-style: one pass produces K candidates) is a different shape, and tree proposals need ancestry masks.
     AGENTS.md: do not show MTP / EAGLE-3 / DFlash / DFlash2 / DSpark as equivalent.
  3. **No "when it stops helping" cue.** Research-notes 3D brief D covers exactly that (draft/verify work displaces useful
     work at high concurrency), and it belongs in chapter 04 too.
- **Proposal**: keep the corridor. Add (a) a `greedy | exact sampling` toggle that raises two mini histograms (p, q) over one
  chosen position with the overlap shaded and the `(p−q)⁺` residual used only on rejection (research-notes 3D brief B);
  (b) a `drafter` choice `AR steps | one block pass | tree (Z = branch)` that changes only how candidates appear while the
  target slab + prefix-accept rule stay identical; (c) readout in *structural* units — `accepted/round`, `target passes per
  token`, `draft passes per token` — and **never** tokens/s (that would be an invented benchmark, AGENTS.md). Takeaway:
  "Cheap model proposes, expensive model checks several positions in one pass; we keep the valid prefix and correct the first
  failure — and with sampling, 'correct' means drawing from the big model's distribution, not comparing top tokens."

## sample (scene `sample`, chip "03 — Make it fast")

- **Claim**: "Low temperature sharpens the peaks. Top-p floods everything below the cut-off."
- **Current visual**: `buildSample`: 110² plane displaced by 24 Gaussian bumps whose amplitudes are
  `softmax(Z/T)` over authored logits `Z`; water plane at a level between the k-th and (k+1)-th sorted probability; ball drops
  on a token sampled from the kept set, ring marks the landing; readout lists kept tokens and renormalised %.
- **Verdict**: ADJUST (math is fine; the *chapter* and the *interaction* are wrong).
- **Why**:
  1. **Chip mismatch.** Temperature/top-p is not memory bandwidth or speculation speed — it is a generation-quality dial, and
     in this deck's own logic it belongs to the config-as-map device (sampling params live in the serving config: vLLM
     `--default-sampling-params`-style defaults, Modelfile `PARAMETER temperature/top_p`, `llama-server` sampling flags).
     Options: re-chip to `04 — Serve it`, or re-frame it openly as "the dial we set before measuring speed". Keep the
     arbitrary-map disclosure: NOTES already say positions are not an embedding space, which satisfies the AGENTS.md
     embedding-projection constraint — keep that sentence on-slide, not just in `notes`.
  2. **Water-level ≠ literal top-p.** The code computes top-p correctly (smallest sorted prefix with cumulative mass ≥ p) and
     clamps the plane between the k-th and (k+1)-th probability, but a horizontal plane *reads* as "a height threshold".
     Ties/plateau cases will look wrong on stage; add the count readout `kept k / 24 tokens, ≥p mass` (it exists) plus one
     sentence "top-p is a mass cutoff, drawn as a level".
  3. **Unused control**: the scene supports `action('sample')` but `slides.ts` exposes only `T`/`topP`, so samples only fire
     on the 2 s auto-timer — the presenter cannot fire a sample on demand, which is the scene's best beat.
  4. Nothing is labelled at 34px+ (no label primitive), so "which token is which" lives only in the card.
- **Proposal**: re-chip; add a `sample now` button (`action:'sample'`) and a `greedy (T→0)` option so the argmax case is
  visible; billboard-label the top ~6 peaks with Jersey 15 ≥34 slide px. Takeaway: "Temperature changes the shape of the
  distribution; top-p decides how much of its mass you're willing to sample from."

## attn (scene `attn`, chip "02 — Make it fit")

- **Claim**: "Not every layer looks back forever. Sliding-window layers keep a fixed window of KV. Hybrid models mix them with
  full-attention layers."
- **Current visual**: `buildAttn`: 32 token dots on two rails (lanes = full / sliding, or one lane in `full`/`sliding` mode);
  QuadraticBezier tubes from each attended `j` to the query `q`, thickness ∝ synthetic softmax weight
  (recency + first-token sink + 3 key tokens); translucent band marks the window; query advances to N-1 then restarts.
- **Verdict**: ADJUST + **RELOCATE** (this is the clearest copy-paste/organisation error in the deck).
- **Why**:
  1. **Location**: it sits between `sample` (03) and the `serve` divider, i.e. inside chapter 03's run, while its chip says
     "02 — Make it fit". Live, ← → will walk the audience from a 03 scene into a 02-labelled scene. Either move it directly
     after the `fit` divider (best) or before it, or re-chip — but it genuinely *is* a fit topic, so move it, don't re-chip.
  2. **Mechanism mismatch**: the geometry draws attention *weights* (compute/graph), while the caption's claim is about *KV
     bytes per token per layer*. The word "KV" never appears in the scene state (`mode, W, q, N, win`) — the memory claim is
     text-only.
  3. **The dangerous implication**: a fixed window band next to an unbounded lane invites "sliding window ⇒ long context is
     cheap". For hybrid models the global layers still keep every token's KV, so total KV memory still grows linearly
     (Gemma 3 uses a 5:1 sliding:global ratio, [Raschka's architecture gallery](https://sebastianraschka.com/llm-architecture-gallery/swa/),
     [LLMs-from-scratch SWA notes](https://github.com/rasbt/LLMs-from-scratch/blob/main/ch04/06_swa/README.md);
     the unbounded-global-layer growth is reported for real stacks in
     [mlx-lm discussion #1568](https://github.com/ml-explore/mlx-lm/discussions/1568); vLLM had to learn to detect the
     interleaved pattern, [PR #21927](https://github.com/vllm-project/vllm/pull/21927)). Also flag AGENTS.md's hybrid-state
     rule: some layers hold other recurrent state entirely.
  4. Scale is illustrative: windows 4/8/16 tokens vs real 2048–4096-token windows (unlabelled).
- **Proposal**: convert to a **KV ledger** and keep the arcs as an inset. x = token position, y = layer (a thin plane per
  layer, hybrid pattern visible down the stack), z = lane; one KV block tile per token per layer, tiles outside the window
  fading out on local layers and *staying* on global layers; a byte meter per layer =
  `2 · kv_heads · head_dim · dtype_bytes · min(t, W)` vs `… · t`; luminance = resident KV (bright = in cache, dark/dim =
  released), with a third lane of fixed-size slabs for non-attention state. Controls: `mode`, `W`, `context length`,
  `KV dtype` (shares **M1** and `cmd-kv`). Takeaway: "Local layers drop old KV, global layers keep all of it — a hybrid's
  cache still grows with context." Arcs stay orbitable, labelled "synthetic weights".

## serve (section 04)

- **Claim**: framing = "Concurrency, scheduling and resource budgets in vLLM, llama.cpp and Ollama."
- **Current visual**: type `section` — the chapter has **no content slides**.
- **Verdict**: ADD-VISUAL (chapter-level gap; see **M2** + **M3**).
- **Why**: 20 minutes of the talk's thesis ("now operate one") is currently a divider. The chapter also owns the second half
  of `spec`'s story (speculation can displace useful work under load). Keep the divider's `example: true` until the real
  engine versions and flags are verified.

## connect (section 05)

- **Claim**: framing = "A gateway in front of models hosted on independent machines."
- **Current visual**: type `section` — no content slides.
- **Verdict**: ADD-VISUAL (**M3**).
- **Why**: the closing chapter is the speaker's differentiator and is empty. Hard constraints from AGENTS.md: do **not** draw
  pooled VRAM, cross-host tensor parallelism or one model split across machines; health checks / fallback / auth may appear
  only if the real LLM Collective does them; node count, models and policies are **(unverified — ask the speaker)**.

## splat-lab (section, `number: 'GS'`)

- **Claim**: appendix divider for Gaussian-splat experiments.
- **Current visual**: type `section`; `...splatLab` slides follow (out of audit scope).
- **Verdict**: FINE-AS-TEXT, but **fix the route**.
- **Why**: it is the 15th slide in the linear deck, so ← → at the end of chapter 05 walks into lab experiments during a
  30-minute talk. Either gate it behind the overview/`#/<id>` hash or move it to a separate deck route; `GS` also breaks the
  `NN / 05` numbering used by the other dividers.

---

## Missing scenes (ranked by value in a 30-minute talk)

**M1 · KV cache grows with context and with concurrency** — *chapter 02 anchor; target of `cmd-kv`.*
- Mechanism: each live sequence appends a K and V vector per attention layer per token; capacity, not compute, decides how
  many sequences/tokens fit.
- Geometry: x = token position, y = layer plane, z = request lane; one small block per (token, layer, request); a horizontal
  **budget plane** = VRAM left after weights + workspace (vLLM sizes the cache from memory free after warmup,
  [docs](https://docs.vllm.ai/en/stable/configuration/optimization/)); blocks stop being allocated (not "exploded") at the
  plane; a separate dashed line marks *logical* `--max-model-len`.
- Luminance: bright = resident, dim = pending/queued, flicker = evicted/recomputed. Size: uniform blocks (bytes/token/layer),
  basin of weight slabs underneath to show "weights were claimed first".
- Motion: sequences grow left→right at decode pace; new request arrives → new lane; hitting the budget → preemption (recompute
  or drop) with a cost flash.
- Controls: context length, requests in flight, `KV dtype` (f16 → q8/fp8 halves block depth), `-ngl` hook from `offload`,
  prefix-sharing toggle (shared prefix blocks render once, [Automatic Prefix Caching](https://docs.vllm.ai/en/stable/features/automatic_prefix_caching/)).
- Takeaway: "Context length is a *potential* memory bill, paid per token per layer per request."
- Reuse: `buildOffload` slab stacks + plates, `moe` instanced boxes with per-instance colour, `spec`'s translucent slabs.
- Caveats: do **not** depict a fully preallocated full-length cache per request (AGENTS.md; research notes); block/paged
  allocation and prefix caching are engine-dependent; hybrid layers hold other state; fp8 KV may also change the attention
  compute domain ([vLLM doc](https://docs.vllm.ai/en/stable/features/quantization/quantized_kv_cache/)).

**M2 · Continuous batching / the scheduler spends a token budget** — *chapter 04 anchor.*
- Mechanism: one forward step per iteration, chosen set of requests and tokens: vLLM V1's unified scheduler allocates a fixed
  token budget per request (`{request_id: num_tokens}`), which is what enables chunked prefill, prefix caching and
  speculation in one loop ([V1 user guide](https://docs.vllm.ai/en/stable/getting_started/v1_user_guide.html),
  [Optimization](https://docs.vllm.ai/en/stable/configuration/optimization/)); iteration-level scheduling origin: Orca,
  OSDI 2022 (unverified link — cite by name).
- Geometry: x = time (steps as rails), y = request lane (cards), z unused; each step a budget bar of N tiles is handed out;
  prefill chunks (wide light blocks) vs decode tokens (single dark tiles); a queued card waits above the lane.
- Brightness: in-batch = bright, queued = dim, preempted = flashes then re-enters. Motion: cards advance one cell per step.
- Controls: arrival rate, `--max-num-seqs`, token budget, chunked-prefill on/off. Readout: TTFT vs tokens/s per user vs total.
- Takeaway: "The scheduler spends a per-step token budget; your flags decide who waits."
- Reuse: `spec`'s row/lane tiles + translucent pass slab, `attn`'s rails, `flow`'s ring meter.
- Caveats: schedules/defaults are version-specific (verify against installed vLLM/llama.cpp; research-notes checkpoint);
  llama.cpp `--parallel` / `--batch-size` / `--ubatch-size` are *not* one "batch size"; never show measured latencies.

**M3 · Gateway in front of independent hosts** — *chapter 05 anchor.*
- Mechanism: a client hits one API; the gateway picks a healthy host by capability/policy; that host runs its own engine on
  its own GPU and streams the answer back.
- Geometry: x = client → gateway → hosts (left to right), y = host, z = in-flight request depth; host boxes each contain a
  *complete* miniature model+KV basin (from `flow`/`moe`) so no part of a model crosses a box boundary; routing links =
  thin tubes, request tokens = orbs.
- Brightness/motion: link lights only while carrying a request; a refused/queued request flashes at the gateway; capacity
  shown by orbs waiting at the gateway, not by merged host geometry.
- Controls: policy toggle (round-robin / capability / least-loaded), kill a host → fallback, capability filter
  ("needs 32K ctx"), latency overlay only if measured.
- Takeaway: "One endpoint, many independent machines: the gateway chooses a host, it does not build a bigger GPU."
- Reuse: `moe` router cube + beams as the routing idiom, `offload`'s platform boxes, `flow`'s orbs/tubes.
- Caveats (AGENTS.md, hard): no cross-host tensor parallelism, no pooled VRAM, no distributed execution, and topology/health/
  auth/fallback details are **(unverified — speaker must confirm)**.

**M4 · Prefill vs decode** — *chapter 03 opener.*
- Mechanism: prefill processes N prompt positions in one wide, compute-heavy pass; decode then does one position per step and
  is bandwidth-bound, reading weights + KV each time ([arXiv:2211.05102](https://arxiv.org/abs/2211.05102)).
- Geometry: x = token position, y = phase (prefill plane above decode row), z = batch; prefill = one broad slab sweeping
  across N tiles (all lit together), decode = single tile per step with a stream reusing `flow`'s pipe.
- Brightness: compute pressure (how much of the slab lights at once); motion: slow sweep then a tick-tick cadence; two meters
  (time-to-first-token, per-token latency) drawn as `flow`'s ring.
- Controls: prompt length, batch, chunked-prefill on/off (a wide prefill gets sliced and interleaved with decode ticks).
- Takeaway: "Prompt in, one wide pass; tokens out, one narrow pass — different bottlenecks, different flags."
- Caveats: no invented absolute times (ratios only, labelled illustrative); chunked prefill is default-on in V1 and
  prioritises decode, so "prefill blocks everything" is version-dependent.

**M5 · Weight quantization is a quality↔bytes trade, and it is not KV quantization** — *chapter 01/02 bridge.*
- Mechanism: fewer bits per weight shrinks the file roughly proportionally and perturbs outputs (perplexity / KL divergence
  against the reference), with per-format overhead so "4 bit" ≠ 4.00 bits/weight
  ([llama.cpp quantize docs](https://github.com/ggml-org/llama.cpp/tree/master/tools/quantize)).
- Geometry: x = layer, y = bits per weight, z = three parallel stacks (weights / activations / KV cache) so the three dials
  stay visibly separate; block quantisation rendered as tiles + scale stubs.
- Brightness = error signal (dither density or tone steps), size = bytes; a single "same model, four files" row of slabs.
- Controls: format (F16/Q8/Q4), which dial (weights vs KV vs activations), error metric toggle (perplexity delta / KLD).
- Takeaway: "Weight bits decide size and quality; KV bits decide how much context fits; activations are a third thing."
- Caveats: **no fabricated error numbers** — use speaker-measured numbers or a synthetic labelled distribution; do not imply
  lower precision is faster on every kernel/HW (AGENTS.md); llama.cpp `Q4_K_M` ≈ 4.8944 bits/weight on Llama-3.1-8B per the
  quantize README (third-party restatement — verify before publishing).

**M6 · Drafters are not interchangeable (MTP / EAGLE-3 / DFlash block / tree verification)** — *chapter 03 deep dive.*
- Mechanism: where the K candidates come from (native MTP heads, a small learned draft tower fed by target features, or one
  block pass) and how they are checked (chain vs tree with ancestry masks).
- Geometry: keep `spec`'s corridor as the shared spine; Z = branch depth for trees; a mask inset = a small tile matrix
  showing allowed attention edges (each node sees context + ancestors, never siblings).
- Controls: drafter switch (changes candidate birth pattern only: sequential steps / one slab / fan-out in Z), node count vs
  verification budget, greedy vs tree acceptance.
- Takeaway: "Same verification corridor, different drafting machinery — and tree drafts need ancestry masks."
- Caveats: research-notes pass 1 says DFlash2/DSpark availability is experimental; **verify implementations** before demoing;
  cite [vLLM Speculators algorithms](https://docs.vllm.ai/projects/speculators/en/stable/user_guide/algorithms/) and
  [EAGLE-3 docs](https://github.com/vllm-project/speculators/blob/main/docs/user_guide/algorithms/eagle3.md).

---

## Priority list

1. Fix `attn`: move it inside chapter 02, retitle the mechanism as a **KV-byte ledger** (blocks per token per layer), and show
   that hybrid global layers still grow linearly.
2. Build **M1 (KV cache growth vs context/concurrency)** — chapter 02's missing anchor and the scene `cmd-kv` promises.
3. Make the config-as-map device real: stepping `active` in `CommandLayout` + flag→scene bindings, and add the
   `llama-server` twin (`-ngl`, `--ctx-size`, `-ctk/-ctv`) — contract change in `types.ts`, so escalate first.
4. `flow`: add the KV stream and print `bytes/useful token = W/B + KV(t)`; split the readout into per-user vs total throughput.
5. Build **M2 (scheduler / continuous batching)** so chapter 04 exists at all; bind it to `--max-num-seqs`.
6. `spec`: add the greedy-vs-exact-sampling toggle (accept `min(1,p/q)`, residual `(p−q)⁺`, overlap = 1−TV) and move
   accepted/round + passes-per-token into the readout instead of any speed number.
7. Build **M3 (gateway over independent hosts)** for chapter 05 — after the speaker confirms topology, health, auth, fallback.
8. Copy/labels sweep: `offload` (bytes-per-token, GiB budget, no invented 9-layer cap), `moe` (expert-in-RAM option + real
   layer/expert counts), `sample` re-chip + `sample now` control, `moe`/`attn` illustrative-scale captions, un-`example` the
   reviewed slides, and keep `splat-lab` out of the linear talk route.
