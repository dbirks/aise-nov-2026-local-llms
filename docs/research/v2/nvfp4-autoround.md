# Deck v2 Research Packet — Chapter 04b: `nvfp4` and `autoround`

Researched: 2026-11-18  
Plan contract: [deck-v2-plan.md](../../deck-v2-plan.md) (`nvfp4`, `autoround`), [presentation-production-handoff.md](../../presentation-production-handoff.md) (C01–C03), [AGENTS.md](../../../AGENTS.md).

---

## nvfp4

### 1. Facts

- **Element format (`E2M1`):** Each quantized weight or activation element is a 4-bit float with **1 sign bit, 2 exponent bits (bias = 1), and 1 mantissa bit**, representing 16 codes (15 distinct numerical values plus `-0.0`): `{±0.0, ±0.5, ±1.0, ±1.5, ±2.0, ±3.0, ±4.0, ±6.0}` (`fp4_max = 6.0`). There are **no Inf or NaN encodings** in E2M1. `[MECHANISM]`
  - Primary sources: [NVIDIA Developer Blog — Introducing NVFP4](https://developer.nvidia.com/blog/introducing-nvfp4-for-efficient-and-accurate-low-precision-inference/), [NVIDIA Transformer Engine NVFP4 docs](https://docs.nvidia.com/deeplearning/transformer-engine/features/low_precision_training/nvfp4/nvfp4.html), [NVIDIA PTX ISA — Alternate Floating-Point Data Formats](https://docs.nvidia.com/cuda/parallel-thread-execution/#alternate-floating-point-data-formats).
- **Two-level hierarchical scaling:** NVFP4 pairs a **per-block FP8 E4M3 scale** over **16 contiguous elements** (`s_block`) with a **per-tensor FP32 global scale** (`s_global`). Reconstruction is `x_hat = x_e2m1 * s_block * s_global`. `[MECHANISM]`
  - `s_global = global_amax / (fp8_max * fp4_max) = global_amax / (448.0 * 6.0)`
  - `s_block = (block_amax / fp4_max) / s_global`, quantized to FP8 E4M3 (`max = 448.0`).
  - Note on E4M3 sign bit: FP8 E4M3 (`max = 448.0`, NaN at `0x7F`/`0xFF`) is used for `s_block`; NVIDIA PTX ISA defines `ue4m3` as a 7-bit unsigned format (4 exponent bits, 3 mantissa bits, NaN `0x7F`, no Inf) stored in `.b8` with MSB padded to `0` for hardware block scales, while software recipes enforce positive E4M3 scale values. `[MECHANISM]`
  - Primary sources: [NVIDIA Transformer Engine NVFP4 docs](https://docs.nvidia.com/deeplearning/transformer-engine/features/low_precision_training/nvfp4/nvfp4.html), [NVIDIA Developer Blog — Introducing NVFP4](https://developer.nvidia.com/blog/introducing-nvfp4-for-efficient-and-accurate-low-precision-inference/), [NVIDIA PTX ISA](https://docs.nvidia.com/cuda/parallel-thread-execution/#alternate-floating-point-data-formats).
- **Weight vs activation block geometry:** In Transformer Engine / training recipes, activations use 1D blocks of 16 elements along the reduction dimension, while weights can use **16×16 2D blocks** (sharing one E4M3 scale per 16×16 tile for training symmetry) or 1×16 blocks for inference. `[MECHANISM]`
  - Primary source: [NVIDIA Transformer Engine NVFP4 docs](https://docs.nvidia.com/deeplearning/transformer-engine/features/low_precision_training/nvfp4/nvfp4.html).
- **Effective bits per element:** `4 + 8/16 = 4.50 bits/element` from E2M1 payloads plus E4M3 block scales (plus 32 bits per tensor for `s_global`, negligible for real layer matrices). Compare with **OCP MXFP4**: `E2M1` elements, **block size 32**, **E8M0** unsigned power-of-two scale (`2^(e-127)`), no per-tensor FP32 scale -> `4 + 8/32 = 4.25 bits/element`. `[MECHANISM]`
  - Primary sources: [OCP Microscaling Formats (MX) v1.0 Specification](https://www.opencompute.org/documents/ocp-microscaling-formats-mx-v1-0-spec-final-pdf), [NVIDIA Developer Blog — Introducing NVFP4](https://developer.nvidia.com/blog/introducing-nvfp4-for-efficient-and-accurate-low-precision-inference/).
- **Blackwell hardware support (W4A4 microscaled MMA):**
  - 5th-generation Tensor Cores in NVIDIA Blackwell execute native block-scaled FP4×FP4 matrix multiply-accumulate (`kind::mxf4nvf4` in PTX), with hardware dequantization/scaling fused into the MMA pipeline. `[MANUFACTURER SPEC / MECHANISM]`
  - **Datacenter Blackwell (`SM100`, e.g., B200 / GB200):** Uses Tensor Memory (`TMEM`) and `tcgen05.mma...kind::mxf4nvf4` descriptor-based instructions; B200 is rated at up to **9,000 TFLOPS dense / 18–20 PFLOPS sparse FP4** (check exact B200 TDP/datasheet SKU if citing a single number on slide; `SM100` kernel binaries are not binary-compatible with `SM120`). `[MANUFACTURER SPEC]`
  - **Consumer/Workstation Blackwell (`SM120`, e.g., GeForce RTX 5090, RTX PRO 6000 Blackwell):** Uses register-based `mma.sync.aligned...kind::f8f6f4` / block-scaled MMA instructions (`SM120`). GeForce RTX 5090 (`GB202`, 32 GB GDDR7, **1,792 GB/s** memory bandwidth) is rated at **3,352 AI TOPS** sparse FP4 Tensor performance. `[MANUFACTURER SPEC]`
  - **Pre-Blackwell GPUs (Ada `SM89`, Hopper `SM90`, Ampere `SM80/86`):** Lack native FP4 Tensor Cores; serving an NVFP4 checkpoint on older GPUs requires software dequantization to BF16/FP16 or FP8, losing W4A4 compute speedup (hence the speaker publishes a separate `W4A16` INT4 Marlin build for Ampere/Ada). `[MECHANISM]`
  - Primary sources: [NVIDIA GeForce RTX 5090 specs](https://www.nvidia.com/en-us/geforce/graphics-cards/50-series/rtx-5090/), [NVIDIA Blackwell Architecture Technical Brief](https://resources.nvidia.com/en-us-blackwell-architecture), [NVIDIA PTX ISA](https://docs.nvidia.com/cuda/parallel-thread-execution/), [dbirks/Qwen3.8-27B-W4A16-AutoRound](https://huggingface.co/dbirks/Qwen3.8-27B-W4A16-AutoRound).

### 2. Mechanism, precisely

1. **Global tensor pre-scale (`FP32`):** Given tensor `W`, find `global_amax = max(|W|)`. Compute `s_global = global_amax / (448.0 * 6.0)` so that after dividing the tensor by `s_global`, the largest possible block scale (`block_amax / 6.0`) equals `448.0`, the max finite FP8 E4M3 value.
2. **Partition into 16-element blocks:** Slice each row along the reduction dimension into contiguous blocks `B_k` of 16 values (`k = 0..15`).
3. **Local block scale (`FP8 E4M3`):** Compute `block_amax = max(|B_k|)`. Compute ideal scale `s_raw = (block_amax / 6.0) / s_global` and round to the nearest representable FP8 E4M3 value `s_block` (positive/unsigned `ue4m3`).
4. **Element quantization (`E2M1`):** Compute effective scale `s_eff = s_block * s_global`. Divide each element by `s_eff`, clamp to `[-6.0, +6.0]`, and round to the nearest of the 15 E2M1 magnitude levels `{0, ±0.5, ±1, ±1.5, ±2, ±3, ±4, ±6}`. Pack two 4-bit nibbles per byte (8 bytes payload + 1 byte `s_block` = 9 bytes per 16 values).
5. **Hardware execution (Blackwell Tensor Cores):** On `SM100`/`SM120`, both `W` and activations `X` can be quantized to NVFP4 (`W4A4`); the MMA instruction reads packed `E2M1` operands and `E4M3` block scales directly, accumulates block dot products in FP32, and multiplies by `s_global_W * s_global_X` in the epilogue.

#### Worked toy example: encoding one 16-value block (`[SIMULATED]`)

Suppose a weight tensor has `global_amax = 2.688` (set by an outlier in another block).
1. **Per-tensor FP32 scale:** `s_global = 2.688 / (448.0 * 6.0) = 2.688 / 2688.0 = 0.001`.
2. **One 16-value block `B`:**
   `[+0.092, -0.061, +0.044, -0.031, +0.022, -0.016, +0.008, +0.001, -0.007, +0.014, -0.023, +0.030, -0.045, +0.059, -0.011, +0.000]`
3. **Per-block FP8 E4M3 scale:** `block_amax = 0.092`.
   `s_raw = (0.092 / 6.0) / 0.001 = 15.333...`
   Nearest FP8 E4M3 representable value: **`15.0`** (`0 1010 111_2 = 0x57`, since E4M3 step at exponent `2^3 = 8` is `1.0`, giving `8..15` then `16`).
   Effective block step scale: `s_eff = s_block * s_global = 15.0 * 0.001 = 0.015`.
4. **Element-by-element E2M1 quantization and reconstruction (`x_hat = q * 0.015`):**

| Idx | `w` | `w / 0.015` | Nearest `E2M1` | Nibble (`s e1 e0 m`) | Dequant `w_hat` | Error (`w_hat - w`) |
|---:|---:|---:|---:|:---:|---:|---:|
| 0 | +0.092 | +6.133 | +6.0 | `0111` | +0.0900 | -0.0020 |
| 1 | -0.061 | -4.067 | -4.0 | `1110` | -0.0600 | +0.0010 |
| 2 | +0.044 | +2.933 | +3.0 | `0101` | +0.0450 | +0.0010 |
| 3 | -0.031 | -2.067 | -2.0 | `1100` | -0.0300 | +0.0010 |
| 4 | +0.022 | +1.467 | +1.5 | `0011` | +0.0225 | +0.0005 |
| 5 | -0.016 | -1.067 | -1.0 | `1010` | -0.0150 | +0.0010 |
| 6 | +0.008 | +0.533 | +0.5 | `0001` | +0.0075 | -0.0005 |
| 7 | +0.001 | +0.067 | +0.0 | `0000` | +0.0000 | -0.0010 |
| 8 | -0.007 | -0.467 | -0.5 | `1001` | -0.0075 | -0.0005 |
| 9 | +0.014 | +0.933 | +1.0 | `0010` | +0.0150 | +0.0010 |
| 10 | -0.023 | -1.533 | -1.5 | `1011` | -0.0225 | +0.0005 |
| 11 | +0.030 | +2.000 | +2.0 | `0100` | +0.0300 | 0.0000 |
| 12 | -0.045 | -3.000 | -3.0 | `1101` | -0.0450 | 0.0000 |
| 13 | +0.059 | +3.933 | +4.0 | `0110` | +0.0600 | +0.0010 |
| 14 | -0.011 | -0.733 | -0.5 | `1001` | -0.0075 | +0.0035 |
| 15 | +0.000 | 0.000 | +0.0 | `0000` | +0.0000 | 0.0000 |

- **Storage for this block:** 8 bytes (`16 × 4-bit` E2M1) + 1 byte (`s_block = 0x57`) = **9 bytes** (4.5 bits/weight), plus 1 shared `FP32` `s_global` (`0.001`) for the whole tensor.
- **Why MXFP4 loses more precision here:** Under MXFP4, this 16-element slice is merged with 16 neighboring elements into a 32-element block using a power-of-two `E8M0` scale (`... 0.015625, 0.03125, ...`). If the neighbor half contains one `0.38` outlier, the single shared `E8M0` scale for all 32 values jumps to `2^-4 = 0.0625` (or `2^-3 = 0.125`), collapsing elements like `+0.022` and `-0.016` onto `0.0` or `±0.5 * 0.0625`.

### 3. Must not imply

- **Not 4.0 bits per parameter in VRAM:** Including E4M3 block scales, NVFP4 weights take **4.50 bits/element** (before unquantized exception layers).
- **Not uniform spacing:** E2M1 spacing doubles by exponent (`0.5` steps near zero, `1.0` steps from `1..4`, `2.0` step from `4..6`); do not draw evenly spaced INT4 ticks.
- **Not weight-only (`W4A16`) by default:** Native NVFP4 inference quantizes **both weights and activations** (`W4A4`) for Blackwell FP4 Tensor Cores, and is separate from KV-cache quantization (`--kv-cache-dtype`).
- **Not universally supported or identical across GPUs:** Pre-Blackwell GPUs cannot execute native FP4 Tensor Core MMA; `SM100` (B200) and `SM120` (RTX 5090) differ in Tensor Core instruction/memory ISA.
- **Not every layer in a checkpoint is NVFP4:** Sensitive projections, `lm_head`, vision towers, and MTP heads are routinely kept in BF16.

### 4. Visual ideas

All three use the greyscale pixel language (tiles, slabs, number lines, arrows; dark = active/important, hatched/light = metadata/padding).

- **Idea A — Block Packer Pipeline (left-to-right assembly of one 16-value block):**
  - `x`: pipeline stage (`FP32` global scale -> 16 input tiles -> `max(|x|)` -> `FP8 E4M3` block scale -> normalized E2M1 non-uniform ruler -> packed 9-byte slab). `y`: magnitude / value. `z`: element index `0..15` across the 16-tile strip.
  - Size/motion: incoming 16-bit tiles shrink as they snap onto the 15 non-uniform E2M1 tick marks (`±0.5..±6`), then slide tightly into 8 dark payload bytes capped by 1 hatched `E4M3` scale byte and 1 distant `FP32` tensor-scale tag.
  - One control: **Toggle `NVFP4 (block 16, E4M3)` vs `MXFP4 (block 32, E8M0)`** — merges two 16-element blocks into 32 and injects an outlier in slot 20, forcing the shared power-of-two `E8M0` scale to jump and visibly zeroing small weights in slots `0..15`.
  - Toy size: 16 elements (or 32 when toggled to MXFP4).

- **Idea B — Non-Uniform E2M1 Number-Line Lathe / Magnifier:**
  - `x`: E2M1 value axis `[-6, +6]`. `y`: quantization residual `|w_hat - w|` per element. `z`: 16 parallel lanes, one per weight in the block.
  - Size/motion: each weight's raw marker slides along its `x` lane to the nearest dark E2M1 tick; tick spacing visibly widens outward (`0.5, 1.0, 2.0`), showing dense resolution near zero and coarse steps at the edges.
  - One control: **Block `amax` / Outlier Slider** (drags element `0` from `0.092` up to `0.50`), which scales `s_block` up in real time (`0x57 -> ...`) and stretches the E2M1 ticks across all 16 lanes, increasing errors on small weights `6..9`.
  - Toy size: 16 lanes (one NVFP4 block).

- **Idea C — Two-Level Scale Telescope (Tensor -> Block -> Nibble):**
  - `x`: 4 adjacent 16-element blocks (`64` values total, rendered as 4×16 grid of tiles). `y`: bit-width / precision height (`FP32` `s_global` slab at top, `E4M3` `s_block` bars per column, `E2M1` 4-bit nibbles below). `z`: 4 blocks deep.
  - Size/motion: camera starts on the full 4-block tensor slice showing `s_global` scaling everything down so no `s_block` exceeds `448`, then zooms into Block 0 where its 16 elements divide by `s_block * s_global` and reconstruct `w_hat`.
  - One control: **Step Button (`Global Scale` -> `Block Scale` -> `Snap E2M1` -> `Reconstruct & Error`)** — steps deterministically through the exact arithmetic of the 16-value worked block.
  - Toy size: 4 blocks × 16 elements (with Block 0 expanded numerically).

### 5. Open questions for the speaker

- Do you want to mention a specific measured VRAM or tok/s delta between `dbirks/Qwen3.8-27B-NVFP4-AutoRound` and `dbirks/Qwen3.8-27B-W4A16-AutoRound` on your hardware, or keep this slide purely format-mechanical?
- Should the `nvfp4` slide focus only on weights (`block 16 + E4M3 + FP32`), or briefly preview that activations are also quantized to `E2M1` on Blackwell (`W4A4`)?

---

## autoround

### 1. Facts

- **Paper & core optimization (`SignRound` / `AutoRound`):** Proposed by Cheng et al. (Intel, Sept 2023, [arXiv:2309.05516](https://arxiv.org/abs/2309.05516), *"Optimize Weight Rounding via Signed Gradient Descent for the Quantization of LLMs"*). AutoRound is a **post-training quantization (PTQ)** algorithm that tunes weights block-by-block (e.g., transformer decoder block) using **Signed Gradient Descent (SignSGD)** and a Straight-Through Estimator (STE) to minimize block output MSE `||W X - Q(W) X||_2^2` on calibration samples. `[MECHANISM]`
- **What it optimizes:** Three trainable parameters per quantized weight block (discarded after quantization, leaving zero inference-time overhead):
  1. **Rounding offset matrix `V`** (constrained to `[-0.5, 0.5]`, shifting each weight up or down across the rounding boundary instead of fixed nearest rounding).
  2. **Lower and upper clipping multipliers `alpha`, `beta`** (scaling the min/max range, typically initialized at `1.0` and constrained e.g. to `[0.5, 1.0]`, so extreme weight outliers do not stretch the step size `s`). `[MECHANISM]`
  - Primary source: [arXiv:2309.05516](https://arxiv.org/abs/2309.05516).
- **One-line comparisons with GPTQ and AWQ:**
  - **GPTQ** ([Frantar et al., arXiv:2210.17323](https://arxiv.org/abs/2210.17323)): Quantizes weights column-by-column using an approximate inverse Hessian (Optimal Brain Surgeon) to compensate rounding errors in remaining unquantized weights, rather than learning rounding/clipping via SignSGD. `[MECHANISM]`
  - **AWQ** ([Lin et al., arXiv:2306.00978](https://arxiv.org/abs/2306.00978)): Protects the ~1% salient weight channels (identified by activation magnitude, not weight magnitude) via searched per-channel scaling factors without backpropagation or weight-rounding optimization. `[MECHANISM]`
- **`intel/auto-round` GitHub defaults:**
  - `bits = 4`, `group_size = 128`, `sym = True` (for standard INT4 recipes; scheme-dependent for NVFP4/MXFP4/GGUF).
  - `iters = 200` (setting `iters = 0` disables optimization and falls back to plain Round-to-Nearest / RTN; higher recipes use `500–1000`).
  - `nsamples = 128`, `seqlen = 2048` (calibration dataset defaults such as `NeelNanda/pile-10k`; `batch_size` e.g. `4` or `8`; `enable_minmax_tuning = True` with `minmax_lr`). `[OPEN / VERSION-DEPENDENT — verified against current intel/auto-round README/API docs]`
  - Primary sources: [intel/auto-round GitHub](https://github.com/intel/auto-round), [intel/auto-round step-by-step guide](https://github.com/intel/auto-round/blob/main/docs/step_by_step.md).
- **Supported export formats (`format=` in `quantize_and_save`):**
  - `auto_round` (default; e.g. `auto_round:auto_gptq`, `auto_round:auto_awq` kernel-compatible packing) — **verified**.
  - `auto_gptq` — **verified**.
  - `auto_awq` — **verified**.
  - `gguf` (e.g., `gguf:q4_k_m` and selected GGUF quant types) — **verified**.
  - `llm_compressor` (used for floating-point schemes such as `scheme="NVFP4"`, `MXFP4`, `MXFP8`, emitting `compressed-tensors` checkpoints for vLLM / SGLang) — **verified**. `[OPEN / VERSION-DEPENDENT]`
  - Primary sources: [intel/auto-round GitHub](https://github.com/intel/auto-round), [vLLM AutoRound / compressed-tensors docs](https://docs.vllm.ai/en/latest/features/quantization/).
- **Speaker's own quantization workflow (`dbirks`):**
  - Quantized **Qwen3.8-27B** (hybrid GatedDeltaNet + full-attention + vision tower + MTP head) into two public Hugging Face checkpoints using Intel AutoRound:
    - [dbirks/Qwen3.8-27B-NVFP4-AutoRound](https://huggingface.co/dbirks/Qwen3.8-27B-NVFP4-AutoRound) (`NVFP4` / W4A4 packaged via `compressed-tensors` for Blackwell vLLM/SGLang). `[SPEAKER OBSERVATION / ARTIFACT]`
    - [dbirks/Qwen3.8-27B-W4A16-AutoRound](https://huggingface.co/dbirks/Qwen3.8-27B-W4A16-AutoRound) (`W4A16` INT4, `group_size=128`, ~19.5 GB on disk from ~52 GB BF16, targeting Marlin kernels on Ampere+ GPUs without native FP4). `[SPEAKER OBSERVATION / ARTIFACT]`
  - **Selective precision (mixed precision):** Large linear projections in the decoder are quantized to 4-bit, while sensitive components are kept in **BF16**: GatedDeltaNet recurrence-control projections (`in_proj_a`, `in_proj_b`), vision tower (`visual.*`), MTP head, and `lm_head`. `[SPEAKER OBSERVATION / ARTIFACT]`
  - Reference recipe file in speaker's repo (exact line-by-line contents not retrieved in search): [home-k8s `apps/qwen38-upload.yaml.hold`](https://github.com/dbirks/home-k8s/blob/main/apps/qwen38-upload.yaml.hold); serving guide: [home-k8s `qwen38-27b-vllm/SKILL.md`](https://github.com/dbirks/home-k8s/blob/main/.agents/skills/qwen38-27b-vllm/SKILL.md). **Note:** Exact `iters`/`nsamples`/`seqlen` values used in `qwen38-upload.yaml.hold` and held-out coding evaluation scores are `UNVERIFIED` here (only typical AutoRound settings `NeelNanda/pile-10k`, `nsamples=128`, `seqlen=2048`, `iters=200` appeared in search summaries).

### 2. Mechanism, precisely

1. **Calibration capture:** Run `nsamples` (default `128`) sequences of length `seqlen` (default `2048`) through the original BF16/FP16 model and cache the input activations `X` entering each transformer block.
2. **Differentiable rounding + clipping:** Replace each weight `W` in the block with its fake-quantized form `Q(W; V, alpha, beta)`:
   - Clipped bounds: `min_w' = alpha * min_w`, `max_w' = beta * max_w` (sets scale `s` and zero-point).
   - Tuned rounding: `q = clamp(round(W / s + V), q_min, q_max)` using Straight-Through Estimator (`d(round(u))/du = 1`), where `V ∈ [-0.5, 0.5]`.
3. **SignSGD loop (`iters = 200` default):** For each minibatch of cached block inputs `X`, compute block output reconstruction loss `L = MSE(Block_FP(X), Block_Q(X))`, backpropagate `∂L/∂V`, `∂L/∂alpha`, `∂L/∂beta`, and update with `sign(grad)` (`V <- clamp(V - lr * sign(∂L/∂V), -0.5, 0.5)`).
4. **Bake & export (zero runtime cost):** Discard `V, alpha, beta, X`; store only the final integer/FP4 codes and scales in the chosen format (`auto_round`, `auto_gptq`, `auto_awq`, `gguf`, or `llm_compressor`), leaving sensitive exceptions (e.g. `in_proj_a`/`b`, `lm_head`, `visual.*`) in BF16.
5. **Held-out validation:** Evaluate the exported model on tasks **not** in the calibration set (`pile-10k` MSE drop does not guarantee tool-calling or coding fidelity).

#### Worked toy example: 4 weights, RTN vs tuned rounding (`[SIMULATED]`)

Take one 4-weight row `w = [+0.52, +0.52, -0.52, +0.32]` with scale `s = 0.20` (no clipping change, `q ∈ [-8, 7]`), and one calibration activation vector `x_cal = [+1.0, +1.0, -0.5, +0.5]`:
- **True output:** `y_true = w · x_cal = 0.52(1) + 0.52(1) - 0.52(-0.5) + 0.32(0.5) = 0.52 + 0.52 + 0.26 + 0.16 = +1.460`.
- **RTN (`V = [0, 0, 0, 0]`):**
  - Normalized `w / 0.20 = [+2.6, +2.6, -2.6, +1.6]` -> `round` gives `[+3, +3, -3, +2]`.
  - Dequantized `w_rtn = [+0.60, +0.60, -0.60, +0.40]`.
  - Notice every term's signed error pushes `y` upward: `(+0.08)(1) + (+0.08)(1) + (-0.08)(-0.5) + (+0.08)(0.5) = +0.240`.
  - `y_rtn = 1.700`, **output error = `+0.240` (`MSE = 0.0576`)**.
- **Tuned rounding (`V = [0.0, -0.2, 0.0, 0.0]`):**
  - SignSGD sees `∂L/∂V_1 > 0` and nudges `w[1]/s + V_1 = 2.6 - 0.2 = 2.4`, flipping weight `1` from `3` to `2` (`w_ar[1] = +0.40`, error `-0.12`).
  - `w_ar = [+0.60, +0.40, -0.60, +0.40]`.
  - `y_ar = 0.60(1) + 0.40(1) - 0.60(-0.5) + 0.40(0.5) = 1.500`, **output error = `+0.040` (`MSE = 0.0016`, 36× lower)**.
- **Held-out check (why calibration ≠ eval):**
  - On a correlated unseen input `x_held_1 = [+1.0, +0.8, -0.4, +0.6]`: `y_true = 1.336`; `y_rtn = 1.560` (err `+0.224`); `y_ar = 1.400` (err `+0.064`, still 3.5× better).
  - On an opposite-sign input `x_held_2 = [+1.0, -0.5, +0.5, +1.0]` not represented in `x_cal`: `y_true = 0.320`; `y_rtn = 0.400` (err `+0.080`); `y_ar = 0.500` (err `+0.180`, **worse** — demonstrating why `nsamples=128` diverse samples and separate held-out evaluation are required).

### 3. Must not imply

- **Not QAT (Quantization-Aware Training):** AutoRound never runs pretraining/fine-tuning on original weights `W`; it only tunes temporary rounding/clipping parameters per block over ~128 calibration samples and discards them at export.
- **Not zero-cost or single-sample magic:** Tuning only `V` on too few/narrow samples can overfit `x_cal` and regress held-out prompts; calibration MSE ≠ coding/agent benchmark pass rate.
- **Not identical to LLM Compressor:** Intel `auto-round` is its own tool; `format="llm_compressor"` is an export serialization layout (`compressed-tensors`), not running Neural Magic's LLM Compressor optimizer.
- **Not uniform across all layers:** In `Qwen3.8-27B-NVFP4-AutoRound`, leaving `in_proj_a`/`in_proj_b`, `visual.*`, MTP, and `lm_head` in BF16 is deliberate engineering, not an incomplete job.

### 4. Visual ideas

Note: `deck-v2-plan.md` reserves v1's `src/scenes/builders/autoround.js` (4×8 weight cubes + calibration/held-out MSE bars + sensitive-layer outline) as **Variant A**. Ideas B and C below are distinct alternatives for Variants B and C:

- **Idea B — Error-Cancellation Dot-Product Balance (the 4-weight mechanism directly):**
  - `x`: weight index `0..3` plus a total output bar `y` at `x = 5`. `y`: signed contribution `Δw_i · x_i` (above/below a zero plane). `z`: 2 rows deep (back = `RTN`, front = `AutoRound`).
  - Size/motion: each weight's bar shows its signed rounding error multiplied by `x_cal[i]`. In `RTN`, all 4 bars point `+y` and stack into a tall `+0.24` output error tower. As `iters` advances, `V_1` slides past `-0.1` and weight `1` flips down (`3 -> 2`), flipping bar `1` negative (`-0.12`) so the stacked output error collapses to `+0.04`.
  - One control: **Input Vector Switch (`x_cal` vs `x_held_corr` vs `x_held_adv`)** — recomputes the exact 4 signed bars and total output error for `RTN` vs `AutoRound`, visibly exposing both generalization and single-sample overfitting.
  - Toy size: 4 weights (1×4 row) × 2 methods = 8 active bars + 2 error-sum towers.

- **Idea C — Block Pipeline + Selective BF16 Bypass (speaker's Qwen3.8 recipe):**
  - `x`: layer pipeline inside one hybrid block (`in_proj_a/b` recurrence gate -> `QKV/out` -> `MLP/FFN` -> `lm_head / visual` side card). `y`: bit-width height (`16` = tall dark BF16 slab; `4` = compact 4-bit slab) and held-out output drift meter on the right. `z`: calibration (`128` sample strip) vs held-out (`4` eval cards).
  - Size/motion: running `iters 0 -> 200` compresses the linear blocks to 4-bit and settles their rounding offsets, lowering output drift; toggling **Keep `in_proj_a/b` & `lm_head` in BF16** raises the tiny recurrence/head slabs back to height `16` with a small footprint tick while cutting held-out drift sharply.
  - One control: **Exception Toggle (`All 4-bit` vs `Sensitive BF16 kept`)** — recomputes both total checkpoint size ratio and simulated layer output drift.
  - Toy size: 6 named layer slabs (`in_proj_a/b`, `attn_qkv`, `attn_o`, `mlp_gate_up`, `mlp_down`, `lm_head`).

### 5. Open questions for the speaker

- In `apps/qwen38-upload.yaml.hold`, what exact `iters`, `nsamples`, `seqlen`, calibration dataset, and quantization GPU time did you use for `Qwen3.8-27B-NVFP4-AutoRound` and `Qwen3.8-27B-W4A16-AutoRound`?
- Did you quantize any other models with AutoRound (e.g., Qwen3.8-35B-A3B or a drafter), and which exact held-out coding/tool-call test caught regressions when you kept `in_proj_a`/`in_proj_b` in BF16?
- What is the exact on-disk size (GB) of `dbirks/Qwen3.8-27B-NVFP4-AutoRound` vs `W4A16-AutoRound` (~19.5 GB)?

---

## Orchestrator check (2026-11-18)

- Both checkpoints exist on Hugging Face (HF API `models/<repo>/tree/main`, sum of file sizes):
  `dbirks/Qwen3.8-27B-NVFP4-AutoRound` = **20.61 GB**, `dbirks/Qwen3.8-27B-W4A16-AutoRound` = **19.47 GB**.
  This supports the speaker's "~20 GB of weights" on `setup-slow-link`. [MEASURED: file listing]
