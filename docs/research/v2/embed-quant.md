# v2 research packet — chapter 04a: embeddings, quantization basics, GGUF

Slides: **gguf**, **embed-vec**, **quant-what**, **quant-types**.
Written 2026-11-18 by worker from primary sources fetched that day. Evidence labels: [MECHANISM] = how the
code/format works (source cited); [MEASURED by whom] = someone ran something; [MANUFACTURER SPEC];
[OPEN / VERSION-DEPENDENT]; [UNVERIFIED] = not confirmed, do not put the number on a slide.
Repo/citation dates are master-branch sources as of 2026-11-18 — llama.cpp moves fast, re-check before lock.

**Model named in the plan exists.** The deck can say "Qwen3.8-27B" (not a hypothetical nearest neighbour).

---

## gguf

### Facts

1. **Qwen3.8-27B exists.** Repo `Qwen/Qwen3.8-27B`, architecture `Qwen3_5ForConditionalGeneration`,
   "compact, deployment-friendly **dense** model", native vision-language. [MEASURED = reading of the repo,
   2026-11-18]
   https://huggingface.co/Qwen/Qwen3.8-27B
2. **GGUF is a container**, a binary format with metadata key-values + tensor info + aligned tensor data.
   Each tensor record carries its own `ggml_type`, so one file can hold tensors of many different quant
   types. It is not itself a quantization scheme. [MECHANISM]
   Spec: https://github.com/ggml-org/ggml/blob/master/docs/gguf.md ("GGUF is a file format for storing
   models for inference with GGML…"; tensor info block lists per-tensor `type` and `offset`.)
   The GGUF naming-convention section also documents `mmproj` (vision projector) and `mtp` (draft head)
   **sidecar** files loaded alongside a base model. [MECHANISM]
3. **Real size ladder for this model** — file list of `unsloth/Qwen3.8-27B-GGUF`, read from the HF API
   2026-11-18 ("UD" = unsloth's own mixed-recipe branding, not vanilla llama-quantize output)
   [MEASURED = HF file sizes]:
   | file | size |
   |---|---|
   | BF16 (2 shards) | 49.99 + 4.67 = **54.66 GB** |
   | Q8_0 | **29.05 GB** |
   | UD-Q6_K | 21.98 GB |
   | UD-Q5_K_M | 19.87 GB |
   | UD-Q4_K_M | **16.56 GB** |
   | Q4_0 (plain) | 16.06 GB |
   | UD-Q4_K_S | 15.36 GB |
   | UD-Q3_K_XL | 13.15 GB |
   | UD-IQ3_XXS | 10.93 GB |
   | UD-Q2_K_XL | 9.95 GB |
   | UD-IQ2_XXS | 7.21 GB |
   | UD-IQ1_S | **6.19 GB** |
   | MTP sidecar `mtp-Qwen3.8-27B-Q4_0.gguf` | 1.37 GB |
   | `mmproj-BF16.gguf` (vision tower) | 0.93 GB |
   https://huggingface.co/unsloth/Qwen3.8-27B-GGUF/tree/main
   Sanity arithmetic (derived, not a spec): 16.56 GB × 8 / ~27.3 B params ≈ **4.9 effective bits/weight**
   for the whole file — higher than Q4_K's 4.5 because some tensors are kept at more bits (see quant-what).
4. **Official FP8 safetensors release also exists** (`Qwen/Qwen3.8-27B-FP8`), so "GGUF goes smallest" is a
   statement about the community quant ecosystem, not about what the vendor publishes at 16→8 bit.
   [MEASURED = repo exists] https://huggingface.co/Qwen/Qwen3.8-27B-FP8
5. **Perplexity cost of the ladder, llama.cpp's own tool table** (delta vs F16 on Llama-3-8B; a different
   model — cite it as llama.cpp-measured reference numbers, not Qwen3.8 numbers): Q4_0 +0.4685, Q4_K_S
   +0.2689, Q4_K_M +0.1754, Q5_K_M +0.0569, Q6_K +0.0217, Q8_0 +0.0026. [MEASURED by llama.cpp devs,
   dataset not stated in the string]
   https://github.com/ggml-org/llama.cpp/blob/master/tools/quantize/quantize.cpp (`QUANT_OPTIONS` table)
6. **GGUF often goes further down than other published formats**: IQ1_S/IQ1_M (~1.56/1.75 bpw) and ternary
   TQ1_0 exist upstream; community repos ship sub-2-bit files for this model (6.19 GB above). safetensors
   can also be quantized (AWQ/GPTQ/FP8/compressed-tensors), so the comparison is per-repository, not per-format.
   [MECHANISM + point 3 above; the "often" claim = observation from HF, keep hedged]
7. **Same weights ≠ same weights**: `llama-quantize` picks a *type per tensor* (see quant-what), and
   community "dynamic/XL/UD" recipes differ, so two "Q4" files of the same model are not identical tensors.
   [MECHANISM: llama-quant.cpp]

### Mechanism, precisely

1. HF checkpoint (safetensors, bf16) → `convert_hf_to_gguf.py` → GGUF with F16/BF16 tensors.
2. `llama-quantize in.gguf out.gguf Q4_K_M` → per tensor, a target type is chosen (mixture recipe), the
   f32 row block is encoded with `from_float`, blocks are written with their per-block scales.
3. A GGUF file = magic `GGUF` + metadata KV list (incl. `general.file_type` = the requested mixture) +
   tensor-info table (name, dims, type, offset) + tensor data at an alignment boundary (default 32 B).
4. At load, llama.cpp mmaps the data; kernels read blocks directly — no dequant-to-fp16 copy step.
5. File size ≈ Σ per tensor `rows × ggml_row_size(type, cols)` — the tool even prints this exactly with
   `--dry-run`.
6. Sidecars (`mmproj-*.gguf`, `mtp-*.gguf`) are separate small files for the vision tower / MTP draft head.

### Must not imply

- "GGUF = quantized" or "GGUF is always smaller" — a GGUF can be F32; safetensors can be FP4. The size
  comes from the tensor types, not the extension. (AGENTS.md + handoff B05.)
- "Q4 of the same model is one thing": Q4_0 vs IQ4_XS vs UD-Q4_K_M are different codebooks, block sizes and
  per-tensor mixes with different file sizes (see table: 15.36–17.66 GB across the Q4 neighbourhood).
- The 54.66 GB BF16 file includes the whole checkpoint; "27B" is the language-model parameter count on the
  model card — don't divide file bytes by it and present bpw as a spec (it's a derived check only).
- Don't present the Llama-3-8B ppl deltas as Qwen3.8-27B numbers.
- Don't show exact sizes for other brands' repos without reading their file lists.

### Visual ideas

1. **Weight slabs, one model, shrinking.** Row of 6–8 vertical slabs (BF16, Q8_0, Q6_K, Q5_K_M, Q4_K_M,
   Q3_K_XL, IQ2_XXS, IQ1_S), height ∝ GB from the table above (real data, labeled with repo + date). Each
   slab rendered as a stack of thin slices = the tensors; darker slices = the few tensors kept at more bits
   (output head, norms). x = bit budget, y = GB, z unused; control: slider morphs one slab, live readout
   "16.6 GB, loads in 22 s at 74 GB/s" style derived numbers off. Toy: 8 slabs, 5 slices each.
2. **Same tensor, two files.** One 256×512 weight tile shown twice: left = F16 grid (2 B/weight), right =
   Q4_K grid (nibbles + a visible 12 B scale strip per 256 block). Toggle between 4 type labels
   (Q4_0/Q4_K/Q8_0/BF16) recomputes the byte strip and the slab size = rows × row-size formula. x/y =
   matrix indices, tile brightness = weight magnitude, hatching = packed nibbles.
3. **Format vs contents.** Two axes: file format (GGUF / safetensors) × storage type (F16, FP8, Q8_0,
   Q4_K, IQ2). Grid cells filled only where a real artifact exists (mark each cell with the source repo),
   ~10 filled cells. Control: none needed; hover shows size. Prevents the "extension = quant" myth directly.

### Open questions for the speaker

- Which GGUF will you actually run on stage — unsloth UD-Q4_K_M (~16.6 GB)? Then the BF16→Q4_K_M step of
  the eGPU "20 GB weights cross once" story should use ~17 GB, and we re-check the load-time claim.
- Do you want the "sub-3-bit exists but is its own art form" tail (IQ1_S at 6.19 GB) on the slide, or stop
  the ladder at Q3?

---

## embed-vec

### Facts

1. **config.json of Qwen/Qwen3.8-27B, quoted verbatim** (text_config) [MEASURED = reading the file,
   2026-11-18] https://huggingface.co/Qwen/Qwen3.8-27B/blob/main/config.json
   - `"hidden_size": 5120`
   - `"vocab_size": 248320` (model card: "Token Embedding: 248,320 (Padded)")
   - `"num_hidden_layers": 64`
   - `"intermediate_size": 17408`
   - `"tie_word_embeddings": false` → output head is a **separate** 248,320 × 5,120 matrix ("LM Output:
     248,320 (Padded)" on the card).
   - `dtype: bfloat16`; `max_position_embeddings: 262144`; hybrid layers:
     `"full_attention_interval": 4`, layer_types = 48 × linear_attention (Gated DeltaNet) + 16 ×
     full_attention (GQA: 24 Q heads / 4 KV heads, head_dim 256); `mtp_num_hidden_layers: 1`.
   → The plan's "**N** numbers" = **5,120**. Verified.
2. **Embedding matrix size:** 248,320 × 5,120 = 1,271,398,400 entries; at bf16 that is 2,542,796,800 B
   ≈ 2.37 GiB per table; embeddings + output head = 2.54 B params ≈ 9.4 % of "27B". [derived arithmetic]
3. **The table is a lookup, not a computation:** token id *i* → row *i* of `[vocab, hidden]`. That row is
   the hidden state entering layer 0 (this model: first DeltaNet block). [MECHANISM]
4. **Contextual hidden states are recomputed every layer**; the same token in two sentences has different
   vectors after layer 1. Handoff rule carries: only earlier positions visible (causal). [MECHANISM]
5. **The classic analogy is a real, quotable primary source.** Mikolov, Chen, Corrado, Dean,
   *Efficient Estimation of Word Representations in Vector Space* (ICLR 2013 workshop), arXiv:1301.3781,
   §1.1: "…it was shown for example that *vector("King") - vector("Man") + vector("Woman")* results in a
   vector that is closest to the vector representation of the word *Queen*."
   https://arxiv.org/abs/1301.3781 (quote verified in the paper HTML, ar5iv).
   The same paper introduces the analogy test set (9 morphological + 5 semantic relation categories,
   ~19.5 k questions; per the BATS survey the Google set has "8,869 semantic and 10,675 syntactic"
   questions in 15 relation types). [MEASURED by the authors, on word2vec, Google News corpus, 300-d]
   https://vecto.space/projects/BATS/ (secondary, for the counts)
6. **The analogies are cherry-picked — documented criticism.**
   - Drozd, Sedláček & Mareš, COLING 2016, *… "Beyond king – man + woman = queen"*
     (aclanthology.org/C16-1332.pdf): linear-offset analogy results are sensitive to dataset idiosyncrasies;
   - Gladkova et al., NAACL 2016 (aclanthology.org/N16-2002.pdf): offset works for some relation types,
     fails for others; motivated the BATS set (10+10 relations, far harder);
   - Jawahar, Plattner & Durrett, *The (too Many) Problems of Analogical Reasoning with Word Vectors*,
     aclanthology.org/S17-1017.pdf;
   - Allen & Hospedales, ICML 2019, *Analogies Explained* (proceedings.mlr.press/v97/…): the parallelogram
     law holds for **word2vec trained static** embeddings under specific conditions — "not trained to
     achieve it", and the theory assumptions break on other models.
   [all MEASURED/MECHANISM, static word2vec-type vectors]
7. **No verified result that LLM *input* embedding rows satisfy additive analogies.** The 2013 evidence is
   for shallow static models trained to predict context (CBOW). Transformer embedding tables are
   end-to-end trained lookups; tokenization splits many words (a "German bread" and "baguette" may be 2–4
   pieces — [UNVERIFIED] for the Qwen tokenizer; verify token IDs against the actual tokenizer at
   implementation time). Keep the on-screen claim to: "these are learned rows of a lookup table; the
   2013 analogy result is about 2013 word vectors, and it holds only for some relations, cherry-picked."
8. **The GGUF embedding table is quantized too**: for untied models llama-quant.cpp keeps `token_embd`
   near the file's main type (upgraded only in sub-3-bit recipes) but bumps `output.weight` to Q6_K.
   [MECHANISM] https://github.com/ggml-org/llama.cpp/blob/master/src/llama-quant.cpp

### Mechanism, precisely

```
E = embedding matrix, shape [248320, 5120], bf16
prompt "the baguette" → tokenizer → ids e.g. [91, 134201, 36133]   # per-id count UNVERIFIED for Qwen3.8
layer-0 hidden state h0[t] = E[id_t]           ← pure row copy, O(hidden) read
for layer in 1..64: h[t] = attn_block(h)[:t] + ffn(h)   # 48 linear-attn + 16 full-attn layers
h64[t] (5120) → output head [248320, 5120]ᵀ → 248,320 logits → softmax
```
The classic analogy: in word2vec, h(v) − h(w) ≈ constant *offset* across a relation; king−man+woman
succeeds because CBOW's objective plus softmax geometry make a limited form of composition linear — with
300 dimensions, not 5,120, and a ~10⁴-word vocabulary, not 248k. A 3D plot is a hand-labelled or projected
picture of a 5,120-dim space; distances in the picture are not the model's distances.

### Must not imply

- That the 3D axes are real dimensions of the model's space ("toy projection" or "hand-placed,
  [SYNTHETIC DEMO]" on screen; handoff line: geometry encodes exactly one declared thing).
- That input embeddings ≈ contextual hidden states; the row is only the starting point (AGENTS.md).
- That analogy arithmetic generally holds for LLM embeddings; state it as a 2013 word2vec result with
  cherry-picked examples.
- Parameter count ≠ vocab size ≠ hidden size (three different slide numbers: 27B / 248,320 / 5,120).
- That rows have "meaning coordinates" the model reads off; a lookup index has no geometry the network
  must respect.

### Visual ideas

1. **Giant table, one row lights up.** A 16×16-ish wall of dim tiles (the vocab × hidden block, labelled
   "248,320 × 5,120 only 1/256 shown"); picking a word lights one horizontal strip (one row) and
   unrolls it into a long 1D strip of 16 shown cells ("… of 5,120"). x = vocab index, y = hidden dim,
   brightness = weight value (hatch fill). Control: word selector; recompute = which row + strip values
   (synthetic placeholder weights, labelled).
2. **Same word, two contexts.** Left: fixed row E["king"] (static slab). Right: h₁["king"] after layer 1
   in two sentences (two arrows that leave the slab). The punchline is spatial: one stays, two move.
   Control: choose the second sentence from 2 presets. Toy: 3 arrows, 1 slab.
3. **Analogy arrows with a truth dial (plan variant B).** France→Germany, Italy→(Mussolini?) parallel-ish
   arrows like the plan's slide; a toggle swaps the *same* arrows from [SYNTHETIC DEMO] hand-placed
   coordinates to "word2vec, 300-d, 2013 (t-SNE-ish)" and the parallelism visibly weakens on some pairs.
   Labels carry the Mikolov cite + the cherry-pick caveat. Control: demo↔2013 toggle. Darker ink = the two
   pairs that survive.

### Open questions for the speaker

- Stick with France/Germany/Italy + Hitler/Mussolini + breads, or capitals? (plan already asks; the bread
  choice also changes tokenization aesthetics — pretzel is more likely multi-token than pumpernickel? UNVERIFIED.)
- Variant-C-style single-word strip (this packet's idea 1) is honestly the most truthful picture; do you
  still want the 3D arrow plot as the hero, with the table strip as its sub-panel?
- Do you want to export real Qwen3.8-27B input-embedding rows for the 7 words (needs a conversion run +
  PCA + on-screen method label) or stay synthetic? Real rows at Q4/PCA of 5,120-d static embeddings will
  probably NOT show clean parallels — decide before the "is this real?" question from the room.

---

## quant-what

### Facts

1. **Symmetric with a per-block scale (Q4_0 / Q8_0).** From `ggml/src/ggml-quants.c`
   (master, 2026-11-18) [MECHANISM]:
   - Q4_0: block of 32; `d = max_signed / -8` (so |d| = amax/8, stored fp16); code
     `q = MIN(15, (int8_t)(x·(1/d) + 8.5))` ∈ 0..15; dequant `w = (q − 8)·d`. Effective codebook = 16
     equally spaced levels, k·d, k ∈ {−8,…,7}, one endpoint pinned to the block's largest-magnitude value.
   - Q8_0: block of 32; `d = amax/127`, `q = round(x/d)` ∈ int8, dequant `w = q·d`.
   - Q4_1 (asymmetric): block of 32; `d = (max−min)/15`, `m = min` (both fp16), `q` 0..15,
     dequant `w = q·d + m` — `m` is the zero point.
   https://github.com/ggml-org/llama.cpp/blob/master/ggml/src/ggml-quants.c
2. **Worked toy example — a "block" of 8 values at 4 bits (toy: real Q4_0 blocks are 32).**
   w = [0.02, −0.48, 0.29, −0.68, −0.17, −0.04, 0.11, 0.33]; signed amax = −0.68 → d = 0.085.
   | w | round(w/d)+8 as q | dq = (q−8)·0.085 | error |
   |---|---|---|---|
   | 0.02 | 8 | 0.00 | +0.02 |
   | −0.48 | 2 | −0.51 | +0.03 |
   | 0.29 | 11 | 0.255 | +0.035 |
   | −0.68 | 0 | −0.68 | 0 |
   | −0.17 | 6 | −0.17 | 0 |
   | −0.04 | 8 | 0.00 | −0.04 |
   | 0.11 | 9 | 0.085 | +0.025 |
   | 0.33 | 12 | 0.34 | −0.01 |
   Max |error| = 0.04 ≤ half-step 0.0425; RMSE ≈ 0.027. Note the zero-point trick did NOT appear:
   Q4_0 spends a level at −0.68 and cannot reach +0.68 (ceiling +0.595) — asymmetry of the codebook is real.
   Same 8 values asymmetric (Q4_1-style): min −0.68, max 0.33 → d = 1.01/15 ≈ 0.0673, m = −0.68;
   every value gets a finer step but all 16 levels are spent on [−0.68, 0.33] (wasted none on the empty
   tail). [derived arithmetic on the cited formulas; label [SIMULATED/TOY]]
3. **K-quants don't just divide by amax.** `make_qx_quants` / `make_qkx1/quants` in the same file pick the
   scale by minimizing a weighted error and trying ~19 candidate scales (rmse_type) or a weighted
   least-squares fit of (scale, min) over a few iterations. [MECHANISM] That is why "4.5 bpw" Q4_K beats
   "4.5 bpw" Q4_0 (Llama-3-8B ppl +0.1754 vs +0.4685 — see §gguf.5).
4. **Two-level scales in K-quants (Q4_K):** super-block 256 = 8 sub-blocks × 32; per sub-block a 6-bit
   scale and 6-bit min packed into `K_SCALE_SIZE = 12` bytes, their own fp16 super-block scales `d`,
   `dmin`; dequant `w = (d·sc_j)·q − (dmin·mn_j)`. Block struct 144 B → 4.5 bpw. [MECHANISM]
   https://github.com/ggml-org/llama.cpp/blob/master/ggml/src/ggml-common.h
5. **What actually gets quantized** (untied model like Qwen3.8-27B) [MECHANISM: llama-quant.cpp]:
   - 2-D `*.weight` matmul tensors: yes (FFN, attention projections, token_embd at ~the file type).
   - Never: 1-D tensors (norms, biases — "quantize only 2D+ tensors"), router gates (`ffn_gate_inp`),
     ssm/conv1d weights, positional/patch embeddings.
   - Bumped: `output.weight` → Q6_K; in Q4_K_M some attention-V / FFN-down layers → Q6_K
     (`use_more_bits`: first ⅛, last ⅛ layers + every-3rd), merged `attn_qkv` → Q5_K.
   - ~91 % of this model's parameters (24.5 B of 27 B, minus the 2×1.27 B embedding tables) are layer
     matrices — the sentence "most of the weights being quantized are the layer matrices" checks out. [derived]
6. **Activations at inference, CPU path:** K-quant matmuls do NOT dequantize weights to fp16; activations
   are requantized row-wise to `q8_K` (`vec_dot_type = GGML_TYPE_Q8_K` for K-quants) and dot products run
   int8 per block with fp32 scales. [MECHANISM]
   https://github.com/ggml-org/llama.cpp/blob/master/ggml/src/ggml-cpu/ggml-cpu.c (~line 311+)
7. **Matmul ≠ embedding lookup.** Quantization changes `W·h` outputs (contextual stream), but the
   embedding row itself is just a copied row: a Q4_K file also stores E's rows at whatever type
   `token_embd` got (fact 5). Same arrows from embed-vec, if shown "in the file", are the *stored* table
   rows; after the first matmul everything is computed from quantized weights anyway.

### Must not imply

- Not "chopping decimal places": fp32→fp4 is a *different codebook* (16 levels per block + scale), values
  snap, they don't truncate. Show the scale; the integer codes alone are meaningless.
- Quantization error is **not** monotonic in bits across formats (Q4_K ≫ Q4_0; IQ types have codebook
  artifacts; AutoRound can invert the naive order). Don't draw an error-vs-bits line that goes straight
  down-left for format families.
- Don't imply each *number* is stored as "value·scale" at inference — the dot products combine codes;
  per-weight dequant is only the conceptual view.
- Don't show the whole model shrinking uniformly: a Q4_K_M file is a *mixture* (some Q6_K, Q5_K, unquantized
  strips) — the gguf slide's darker slices carry this.
- Don't claim accuracy numbers for Qwen3.8-27B quants: none are verified here (the ppl deltas are Llama-3-8B).

### Visual ideas

1. **Arrow tips onto a lattice (plan A, sharpened).** The 7 word-arrows from embed-vec; a 16-level
   quantizer per coordinate axis. Bit-width dial 16→8→4→2: grid planes appear at level spacing; arrow
   tips snap to nearest lattice point and a short dashed "error stub" shows the residual. Per-arrow card
   shows `q`, `d`, `q·d`. One control = bit-width (recomputes everything; deterministic). x/y/z = the same
   demo coordinates; 7 items. At 4-bit also show the scale strip d next to each arrow ("you also store this").
2. **Block zoom.** A 4×8 tile of one matrix row (32 cells = one real Q4_0 block) + one fp16 scale cell.
   Dial: symmetric ↔ asymmetric ↔ block-of-8 toy. The tile recolours to the quantized values; the delta
   layer (error per cell) shown as hatch density. x = column (block), y = row, brightness = value, size =
   bytes stored. Recompute control: quantizer selector (3 states). Toy 32 cells.
3. **W·h before/after (handoff C01 as a variant).** A 4×4 W, one h arrow, y = W·h; a button quantizes W,
   recomputes yq live, shows |Δ|. Edge case: two weights round *the same way* but their errors cancel vs
   accumulate — expose one such configuration. This is the honest "what quantization costs" picture.

### Open questions for the speaker

- Do you want the toy to use llama.cpp's real Q4_0 (32-block, codebook [−8..7]) for accuracy, or the
  textbook GPTQ-style [−7..7] example for symmetry? The plan's "not chopping decimals" line works either way.
- Which quantizer does the hazy-arrow error cone stand for on your eGPU build — do you have a spot-check
  ppl/bench delta between two files you'd show as [SPEAKER OBSERVATION]?

---

## quant-types

### Facts

1. **GGUF block types, sizes and bpw** — every row from struct sizes / `static_assert` comments in
   `ggml-common.h` (master 2026-11-18) [MECHANISM]. "bpw" is the *pure-block* rate; an M/S file's
   effective rate differs (mixture + unquantized tensors).
   | type | block values | bytes/block | bpw | scale layout |
   |---|---|---|---|---|
   | Q1_0 | 128 | 18 | 1.125 | 1 fp16 (sign-only codebook) |
   | TQ1_0 | 256 | 54 | 1.6875 | ternary grid |
   | IQ1_S | 256 | 50 | 1.5625 | fp16 + codebook grid (needs imatrix) |
   | IQ1_M | 256 | 56 | 1.75 | fp16 + grid + 3-bit sub-scales (needs imatrix) |
   | TQ2_0 | 256 | 66 | 2.0625 | ternary |
   | IQ2_XXS | 256 | 66 | 2.0625 | fp16 + 8×16-bit indices into 256-entry grid (needs imatrix) |
   | IQ2_XS | 256 | 74 | 2.3125 | grid + 4-bit sub-scales |
   | IQ2_S | 256 | 82 | 2.5625 | grid + sub-scales |
   | IQ3_XXS | 256 | 98 | 3.0625 | grid + sign bits (needs imatrix) |
   | Q2_K | 256 (16×16) | 84 | 2.625 | super d/dmin fp16 + 4-bit scales/min |
   | Q3_K | 256 (16×16) | 110 | 3.4375 | 6-bit scales |
   | IQ3_S | 256 | 110 | 3.4375 | grid |
   | IQ4_XS | 256 (8×32) | 136 | 4.25 | 6-bit scales (2-level) |
   | Q4_0 | 32 | 18 | 4.5 | 1 fp16, symmetric-ish k∈[−8,7] |
   | MXFP4 | 32 | 17 | 4.25 | 1 E8M0 (power-of-2) scale, OCP MX spec |
   | Q4_1 | 32 | 20 | 5.0 | fp16 d + fp16 min (zero point) |
   | IQ4_NL | 32 | 18 | 4.5 | fp16 + 16-entry nonlinear codebook |
   | Q4_K | 256 (8×32) | 144 | 4.5 | 6-bit sub scale+min per 32, fp16 super-blocks |
   | Q5_0 / Q5_1 | 32 | 22 / 24 | 5.5 / 6.0 | as Q4_0/Q4_1 + 5th bit plane |
   | Q5_K | 256 (8×32) | 176 | 5.5 | as Q4_K + 5th bit plane |
   | Q6_K | 256 (16×16) | 210 | 6.5625 | 8-bit sub-scales, 6-bit codes |
   | Q8_0 | 32 | 34 | 8.5 | 1 fp16, symmetric int8 |
   | NVFP4 (ggml) | 64 (4×16) | 36 | 4.5 | 4 UE4M3 sub-block scales + E2M1 codes |
   https://github.com/ggml-org/llama.cpp/blob/master/ggml/src/ggml-common.h
2. **IQ4_NL codebook (master as of today, 16 entries, ×d):** −127,−104,−83,−65,−49,−35,−22,−10,1,13,25,38,
   53,69,89,113 — non-uniformly spaced = "non-linear quantization". [MECHANISM, ggml-common.h
   `kvalues_iq4nl`] (Values differ from older llama.cpp releases — VERSION-DEPENDENT.)
3. **NVFP4 (E2M1):** 1 sign + 2 exponent + 1 mantissa bit. Positive magnitudes:
   **0, 0.5, 1, 1.5, 2, 3, 4, 6** (source stores them doubled as 0,1,2,3,4,6,8,12; comment links the OCP
   MX spec pdf). Max ±6. Gaps: 0→0.5 = 0.5 … 4→6 = **2** — geometric spacing, the opposite of INT4.
   [MECHANISM] ggml-common.h `kvalues_fp4`; OCP MX v1.0 spec (opencompute.org).
   Format definition: `x = x_e2m1 · s_block · s_global`, `s_block` = FP8 **E4M3** shared per **16** values,
   `s_global` = FP32 per tensor; 16 vs MXFP4's 32 chosen to cut outlier damage; NVIDIA report "1 % or less
   accuracy degradation vs FP8" (DeepSeek-R1-0528, their eval) and Blackwell-native tensor-core support.
   [MECHANISM + MANUFACTURER SPEC/claim]
   https://docs.nvidia.com/deeplearning/transformer-engine/features/low_precision_training/nvfp4/nvfp4.html ;
   https://developer.nvidia.com/blog/introducing-nvfp4-for-efficient-and-accurate-low-precision-inference/
   llama.cpp's encoding (quantize_row_nvfp4_ref): per 16-value sub-block, `s = UE4M3(amax/6)` — maps the
   grid max 6 onto the block max, i.e. rounding-up-to-representable behaviour [MECHANISM].
   GGML also ships **MXFP4** (E8M0 power-of-two scale per 32) and a `MXFP4_MOE` mixture (experts→MXFP4,
   everything else Q8_0). [MECHANISM: ggml-quants.c, quantize.cpp]
4. **Weights / activations / KV cache are three independent settings:**
   - **Weights:** the GGUF/safetensors type, fixed at release. llama.cpp quantizes only weight tensors
     offline; activations at inference are requantized on the fly to q8_K in CPU kernels (never stored in
     the file) — "W4A16" in vLLM engines means 16-bit activations through 4-bit-weight kernels.
     [MECHANISM: ggml-cpu.c `vec_dot_type`; vLLM docs]
   - **Activations:** a *kernel/checkpoint* choice (FP8 E4M3 / NVFP4 W4A4 on Blackwell; Marlin W4A16
     elsewhere). Not a llama.cpp file knob. [OPEN / VERSION-DEPENDENT for exact engine support matrix]
   - **KV cache:** llama.cpp `-ctk/--cache-type-k` and `-ctv/--cache-type-v`, default **f16**
     (`common/common.h:364`), allowed today: f32, f16, bf16, f8_e4m3, q8_0, q4_0, q4_1, iq4_nl, q5_0,
     q5_1 (`common/arg.cpp:281`). vLLM: `--kv-cache-dtype` fp8 (`fp8_e4m3`/`fp8_e5m2`), plus
     `nvfp4_4over6` cache dtype in current configs. [MECHANISM; list is VERSION-DEPENDENT]
     https://docs.vllm.ai/en/latest/features/quantization/quantized_kvcache/
   - Weight precision does **not** set KV precision (handoff rule; also implied by the separate flags).
     [MECHANISM]
5. **INT4 "evenly spaced" is per-block too:** plain INT4 quants still carry a scale (+ zero point); the
   *difference* to NVFP4 is the grid shape (linear vs FP4) + scale dtype (int/none vs FP8-E4M3) + block
   size. A 4-bit integer × fp32 scale ≠ NVFP4 in any kernel. [MECHANISM]

### Mechanism, precisely

Toy NVFP4 block, 16 values: take the 8 quant-what values plus 8 more so amax = 1.2.
s_block = UE4M3(1.2/6) = 0.2 exactly. Grid × 0.2 = {0, .1, .2, .3, .4, .6, .8, 1.2}·sign.
−0.68 → −0.6 (|−0.68−(−0.6)|=0.08 < 0.12 to −0.8), error −0.08; 0.02 → 0 (error +0.02);
0.33 → 0.3 (error +0.03); 0.66 → 0.6 (error +0.06). Contrast INT4 symmetric same amax:
d = 1.2/7 ≈ 0.1714: levels 0, ±.17, ±.34, … → −0.68 → −4d = −0.686 (error +0.006). INT4 wins *this* value,
FP4 wins values near 0 relative-error-wise. That is the real trade: FP grid = constant *relative*
resolution, int grid = constant *absolute* resolution. Two-level scaling then multiplies back
`s_global` (NVIDIA) — ggml stores only per-16 UE4M3 in the block itself [MECHANISM; arithmetic derived].
For drawing: INT4 = 16 evenly spaced ticks; NVFP4 = 8 magnitudes with growing gaps (0,.5,1,1.5,2,3,4,6),
duplicated negative + one shared fp8 scale tile per 16 values.

### Must not imply

- "4-bit" is not one level of a slider: INT4-Q4_0, Q4_K, IQ4_XS, MXFP4, NVFP4 all store 4-ish bits with
  different codebooks and block overhead (table above). Different files, different error structure.
- INT4 ≠ NVFP4 "quality" ordering: on weight data with outlier blocks FP4 + fine FP8 scales usually wins;
  in the toy above INT4 wins a specific value. Show both error patterns, declare no winner.
- Do not draw cross-host/NVFP4-on-this-laptop capability claims — NVFP4 kernels are Blackwell+ hardware
  territory [MANUFACTURER SPEC]; on the speaker's hardware NVFP4 may only run emulated or not at all [OPEN —
  confirm what his vLLM build supports].
- The E2M1 grid is 8 magnitudes *plus signs* (16 codes); do not label it "8 levels" without saying
  signed. (And it double-encodes 0: ±0.)
- KV/activation quantization are runtime flags, not file features; don't paint them on the GGUF slab.
- No measured speedups in this packet; NVIDIA's "≤1 % degradation vs FP8" is a manufacturer eval — label it.

### Visual ideas

1. **Two number lines, one block of 16.** Top: INT4's 16 evenly spaced ticks; bottom: signed E2M1's
   {±(0…6)} ticks with widening gaps. A 16-tile strip of one real block above each; dragging a single
   weight value along the axis animates its snap-to-tick + error bar on both lines at once. x = value,
   tick darkness = used levels. Recompute control: one slider = the value; second control = scale
   (shows both need a scale tile). 16 items per strip. This is the slide's whole claim in one screen.
2. **Scale hierarchy, 3D.** A 4×4 tile of NVFP4 values (16) with one FP8 scale brick hovering over it,
   and one big tensor-level FP32 brick at the base (s_global); toggle to MXFP4: tile grows to 8×4, scale
   brick becomes a power-of-two tick strip; toggle to Q4_K: super-block 256 outline with 8 sub-scale strips
   + dmin. z = scale level (tensor > block > value), size = bytes. Recompute control: format selector
   (INT4/Q4_K/MXFP4/NVFP4, 4 states). Toy 16–32 cells.
3. **Three dials panel (weights/activations/KV).** Three separate sliders on a chunky control slab:
   file-type (from the gguf ladder), activation dtype, cache dtype (`-ctk` list, vLLM `--kv-cache-dtype`).
   Under each, the memory it governs lights on a mini VRAM stack: weights slab (~16.6 GB), KV slabs
   (fills with context). Nothing couples them — moving one leaves the others. Label each dial with the
   exact flag string from the cited sources; mark NVFP4 availability OPEN/VERSION-DEPENDENT.

### Open questions for the speaker

- Which of the three dials can you actually demonstrate on your eGPU (weights yes — NVFP4 attention/KV:
  does your vLLM build accept `--kv-cache-dtype nvfp4…` or is FP8 your best practical setting)? Confirm
  before showing flag syntax; engine docs change.
- The plan's "INT4 levels are evenly spaced / NVFP4 levels are not" — keep E2M1 magnitudes on screen as
  numbers (0, .5, 1, 1.5, 2, 3, 4, 6)? They're memorable and cheap.
- v1 `quant`/`quant-matrix` reuse is fine for variant A; want variant B to be the three-dials slab?

---

## Cross-slide notes

- Keep one number chain: 5,120 (hidden) → 248,320 (vocab) → 27B (params) → 54.7 GB BF16 → 16.6 GB Q4_K_M
  → 29 GB Q8_0 — all verified above with sources and dates.
- Every llama.cpp figure here is **branch master @ 2026-11-18**; the allowed KV-cache type list and IQ4_NL
  codebook both changed historically. Re-verify against the exact build you run on stage.
- Nothing in this packet was measured on the speaker's hardware; the only MEASURED-per-file numbers are
  HF byte counts and llama.cpp's own Llama-3-8B table.
- UNVERIFIED items deliberately left as holes: Qwen3.8-27B GGUF per-tensor type dump; token IDs of the
  demo words in the Qwen tokenizer; any Qwen3.8 quant perplexity; NVFP4 runtime support on the speaker's
  GPU; exact GGUF spec version number (not needed for slides).
