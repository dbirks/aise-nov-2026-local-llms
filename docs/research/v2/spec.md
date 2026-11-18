# Chapter 07 Research Packet — Speculative Decoding, MTP, Block Drafters, Shipped & Speaker Drafters

Updated: 2026-11-18. Scope: `docs/deck-v2-plan.md` Chapter 07 (`spec-decode`, `mtp`, `block-drafters`, `shipped-drafters`, `drafter-vram`, `my-drafter`).
Evidence labels used below: `[MECHANISM]`, `[MANUFACTURER SPEC]`, `[MEASURED (source)]`, `[OPEN / VERSION-DEPENDENT]`, `[SPEAKER OBSERVATION]`, `[UNVERIFIED]`.

---

## spec-decode

### 1. Facts

- **Core loop (draft $K$ / $\gamma$ tokens, verify in one target forward pass):** A fast drafter proposes $\gamma$ candidate tokens $x_1, \dots, x_\gamma$ given `prefix`; the target model $M_p$ computes $p_1(x), \dots, p_{\gamma+1}(x)$ for `prefix`, `prefix + [x_1]`, ..., `prefix + [x_1, ..., x_\gamma]` in a single parallel forward pass, yielding between $1$ and $\gamma + 1$ tokens per target step (`[MECHANISM]`). Source: Leviathan et al. (2023), *Fast Inference from Transformers via Speculative Decoding*, Algorithm 1, https://arxiv.org/abs/2211.17192.
- **Exact speculative sampling acceptance rule (distribution-preserving):** Given draft token $x_i \sim q_i(x)$ and target conditional distribution $p_i(x)$ under the same prefix, accept $x_i$ if $q_i(x_i) \le p_i(x_i)$, and otherwise accept with probability $p_i(x_i) / q_i(x_i)$ (compactly: accept with probability $\min(1, p_i(x_i)/q_i(x_i))$). At the first rejection (step $n < \gamma$), discard $x_{n+1}, \dots, x_\gamma$ and sample the replacement token from the adjusted residual distribution $p'(x) = \text{norm}(\max(0, p_{n+1}(x) - q_{n+1}(x)))$. If all $\gamma$ tokens are accepted ($n = \gamma$), sample the $(\gamma+1)$-th bonus token from $p_{\gamma+1}(x)$. This preserves the target distribution $p$ exactly (within floating-point numerics) (`[MECHANISM]`). Sources: Leviathan et al. (2023) §2.3 & Appendix A.1, https://arxiv.org/abs/2211.17192; Chen et al. (2023), *Accelerating Large Language Model Decoding with Speculative Sampling*, https://arxiv.org/abs/2302.01318; vLLM Triton rejection-sampling kernel `_compute_global_residual_mass` in https://github.com/vllm-project/vllm/blob/main/vllm/v1/worker/gpu/spec_decode/rejection_sampler_utils.py#L54.
- **Expected single-step acceptance rate ($\alpha$):** For two distributions $p, q$, the expected acceptance probability is $\alpha = \sum_x \min(p(x), q(x)) = 1 - \text{TV}(p, q)$, where $\text{TV}(p, q) = \frac{1}{2}\sum_x |p(x) - q(x)|$ (`[MECHANISM]`). Source: Leviathan et al. (2023) §3.2, https://arxiv.org/abs/2211.17192; DSpark §3.2.1 Eq. 8, https://arxiv.org/abs/2607.05147.
- **Greedy special case:** When target temperature $T = 0$ (greedy decoding), $p_i$ is a one-hot point mass on $\arg\max p_i$, so acceptance reduces to exact token equality $x_i == \arg\max p_i$, and the residual replacement reduces to emitting $\arg\max p_{n+1}$ (`[MECHANISM]`). Source: Leviathan et al. (2023) §2.3, https://arxiv.org/abs/2211.17192.
- **Linear draft invalidation:** In a single linear chain $x_1, \dots, x_\gamma$, each $x_j$ ($j > i$) was conditioned on $x_i$; once $x_i$ is rejected and replaced with $t \neq x_i$, all downstream $x_{i+1}, \dots, x_\gamma$ are conditioned on a dead prefix and must be discarded (`[MECHANISM]`). Source: Leviathan et al. (2023) §2.3, https://arxiv.org/abs/2211.17192.
- **Tree verification & ancestry masks:** Instead of a single linear chain, tree-based drafters (SpecInfer, EAGLE-2, EAGLE-3) arrange candidate tokens as a rooted tree of $N$ nodes packed into one verification sequence. A custom tree attention mask enforces that each node attends only to the shared prompt/KV prefix and its own ancestor chain back to the root, never to sibling or cousin branches (`[MECHANISM]`). Sources: SpecInfer (Miao et al., 2023), https://arxiv.org/abs/2305.09781; EAGLE-2 (Li et al., 2024), https://arxiv.org/abs/2406.16858; EAGLE-3 (Li et al., 2025), https://arxiv.org/abs/2503.01840.
- **Per-token latency cost model & high-batch caveat:** Latency per token is $L = (T_{\text{draft}} + T_{\text{verify}}) / \tau$, where $\tau$ is mean accepted length (including bonus token). Under light load, verifying extra candidate tokens is mostly memory-bandwidth-bound and cheap; under high concurrency/batch size, verifying extra rejected tokens consumes target compute/batch capacity and can reduce aggregate throughput (`[MECHANISM]` / `[MEASURED in DSpark paper]`). Source: DSpark §3 & §3.2, https://arxiv.org/abs/2607.05147.
- **Existing v1 scene:** `docs/deck-v2-plan.md` notes reusing v1 `spec` (`src/scenes/builders/decode-pass.js` / `spec`) as variant A (`[OPEN / VERSION-DEPENDENT]`).

### 2. Mechanism, precisely

1. **Draft stage:** Given prefix $S$, drafter $M_q$ outputs distributions $q_1, \dots, q_\gamma$ and candidate tokens $x_1, \dots, x_\gamma$ (either sequentially or in a block/tree).
2. **Parallel target verification pass:** Target $M_p$ runs a **single** forward pass over $[S, x_1, \dots, x_\gamma]$ with causal mask (linear) or ancestor-only mask (tree), producing logits/distributions $p_1, \dots, p_{\gamma+1}$ where $p_i = P_{M_p}(\cdot \mid S, x_{<i})$.
3. **Sequential acceptance decision (left to right):** Draw $r_i \sim U(0,1)$ for $i=1\dots\gamma$. Find first $i$ where $r_i > p_i(x_i)/q_i(x_i)$. Let $n = i - 1$ (or $n = \gamma$ if none reject).
4. **Correction / bonus token:** If $n < \gamma$, sample $t \sim \text{norm}(\max(0, p_{n+1} - q_{n+1}))$; else ($n = \gamma$) sample $t \sim p_{\gamma+1}$. Emit $[x_1, \dots, x_n, t]$ and roll back KV cache entries for rejected positions $> n$.

**Worked toy example (4-token vocab `{A, B, C, D}`):**
- Suppose at position $i$: $q = [0.50, 0.30, 0.15, 0.05]$, $p = [0.30, 0.50, 0.15, 0.05]$.
- Overlap $\alpha = \sum \min(p, q) = 0.30 + 0.30 + 0.15 + 0.05 = 0.80$ ($1 - \text{TV}(p,q) = 1 - 0.20 = 0.80$).
- Draft samples $x = \text{A}$ from $q$. Since $p(\text{A})/q(\text{A}) = 0.30/0.50 = 0.60 < 1$, accept `A` with probability $0.60$ (if $r_i = 0.72 > 0.60$, reject!).
- On rejection, compute $\max(0, p - q) = [0, 0.20, 0, 0]$; normalize by $0.20$ $\implies p' = [0, 1.0, 0, 0]$. Replacement is `B` with prob $1.0$. Marginal probability of `B`: $q(\text{B})\cdot 1 + \text{reject prob } (0.50 \cdot 0.40) \cdot 1.0 = 0.30 + 0.20 = 0.50 = p(\text{B})$. Exact target distribution preserved.

### 3. Must not imply

- Do **not** imply that verification checks tokens via argmax/string equality in stochastic ($T > 0$) mode.
- Do **not** imply the target model runs $\gamma$ separate decode passes (it runs **one** parallel forward pass over the candidate positions).
- Do **not** imply that rejected draft tokens after the first mismatch can be salvaged in a linear draft.
- Do **not** imply that sibling branches in a draft tree can attend to each other during verification, or that more accepted tokens automatically equals wall-clock speedup at high batch sizes.

### 4. Visual ideas

- **Idea A — Linear verification corridor + distribution gate (toggle Greedy vs Exact):**
  - **Axes:** $X$ = token position $0\dots 7$ (4 prompt tiles + 4 draft tiles); $Y$ = bottom target verifier slab ($y < 0$), middle token tile row ($y = 0$), top aligned $p$ (dark) vs $q$ (light) 4-bar histograms ($y > 0$) at the selected position; $Z$ = depth separation of $p$ vs $q$ histograms.
  - **Size & motion:** 4 draft tiles step in (or appear); one wide dark verifier slab sweeps left-to-right across all 4 draft slots simultaneously; then left-to-right acceptance ticks stop at position 3 ($q(A)=0.50, p(A)=0.30$), greying out slots 3 & 4 and dropping a dark replacement tile from the $\max(0, p-q)$ residual bar.
  - **One control:** `mode` toggle (`greedy` vs `stochastic`), recomputing the acceptance gate (top-1 equality vs $\min(1, p/q)$ + residual normalization). Toy size: 4 prompt + 4 draft positions, 4-token vocab bars.
- **Idea B — Packed tree verification + ancestry mask matrix:**
  - **Axes:** $X$ = tree depth $0\dots 3$; $Z$ = branching alternatives (e.g., 8 candidate nodes arranged in a 3-depth tree); $Y$ = tree above, flat $8\times 8$ attention-mask grid below.
  - **Size & motion:** Hovering/stepping a candidate node highlights only its ancestor path (dark cubes) and lights up only its allowed row entries in the $8\times 8$ mask (zeros/sibling entries stay pale). One verification slab sweeps all 8 nodes together; only the surviving root-to-leaf path (e.g. 3 nodes) turns solid dark; pruned siblings sink/fade.
  - **One control:** `layout` toggle (`chain (4)` vs `tree (8)`), recomputing node count, mask matrix, and surviving prefix length.
- **Idea C — Distribution overlap slab ($\min(p,q)$ vs $\max(0,p-q)$):**
  - **Axes:** $X$ = 5 vocabulary tokens; $Y$ = probability height $0\dots 1$; $Z$ = front layer = draft $q$, back layer = target $p$, middle dark overlap = $\min(p,q)$.
  - **Size & motion:** Vertical bars split into dark shared core ($\min(p,q)$), pale draft excess ($\max(0, q-p)$), and mid-grey target residual ($\max(0, p-q)$). Stepping draws $x \sim q$, drops a gate cursor $r \in [0,1]$, either accepts or shifts to the normalized residual bars.
  - **One control:** `draft_quality` slider (`sharp / aligned` vs `shifted`), recomputing $\alpha = 1 - \text{TV}(p,q)$ and residual bars live.

### 5. Open questions for the speaker

- Confirm whether `spec-decode` keeps v1's `spec` builder as Variant A and adds a stochastic-sampling / tree-mask variant as Variant B/C (`docs/deck-v2-plan.md` notes reusing v1 `spec` as variant A).

---

## mtp

### 1. Facts

- **DeepSeek-V3 native MTP architecture:** Uses $D$ sequential MTP modules ($D = 1$ in DeepSeek-V3/R1 checkpoints) that preserve the complete causal chain at each prediction depth. The $k$-th module shares `Emb` and `OutHead` with the main model, and owns a projection matrix $M_k \in \mathbb{R}^{d \times 2d}$ and Transformer block $\text{TRM}_k(\cdot)$ (`[MECHANISM]` / `[MANUFACTURER SPEC]`). Source: DeepSeek-V3 Technical Report §2.4 Eq. 21–25, https://arxiv.org/abs/2412.19437.
- **DeepSeek-V3 MTP in inference:** Trained primarily to improve main-model representations; at inference time, the MTP modules can be discarded or repurposed for speculative decoding (`[MECHANISM]`). Source: DeepSeek-V3 Technical Report §2.4 ("MTP in Inference"), https://arxiv.org/abs/2412.19437.
- **EAGLE-3 contrast (external feature-conditioned AR drafter, not native MTP):** EAGLE-3 extracts **low, middle, and high** layer hidden states ($l, m, h \in \mathbb{R}^k$) from the target model, concatenates them to $3k$ dims, projects via FC to $k$ dims ($g$), fuses with token embedding $e_i$ through a single decoder layer, predicts tokens directly (abandoning EAGLE-1/2's feature regression loss), and uses "training-time test" (multi-step draft self-conditioning during training). Reported up to $6.5\times$ speedup / $1.38\times$ SGLang throughput at batch 64 (`[MECHANISM]` / `[MEASURED by authors]`). Source: EAGLE-3 (Li et al., 2025) §3.1 & Abstract, https://arxiv.org/abs/2503.01840; vLLM Speculators `eagle3.md`, https://github.com/vllm-project/speculators/blob/main/docs/user_guide/algorithms/eagle3.md.
- **How vLLM uses MTP as a drafter:** vLLM configures native MTP via `--speculative-config '{"method": "mtp", "num_speculative_tokens": K}'` (or `--speculative-config.method mtp`). When `num_speculative_tokens > num_nextn_predict_layers` (e.g., `num_nextn_predict_layers: 1` with 3 speculative steps), vLLM's `MTPSpeculator` / `MultiModuleMTPSpeculator` either loops the single MTP head autoregressively (taking its own output hidden state + sampled token embedding) or steps across the multiple modules (`[MECHANISM]` / `[OPEN / VERSION-DEPENDENT]`). Sources: vLLM `deepseek_mtp.py`, https://github.com/vllm-project/vllm/blob/main/vllm/model_executor/models/deepseek_mtp.py; `qwen3_5_mtp.py`, https://github.com/vllm-project/vllm/blob/main/vllm/model_executor/models/qwen3_5_mtp.py; `mtp/speculator.py` & `multi_module_mtp/speculator.py`, https://github.com/vllm-project/vllm/blob/main/vllm/v1/worker/gpu/spec_decode/mtp/speculator.py.
- **How SGLang uses MTP as a drafter:** SGLang exposes native MTP via `--speculative-algorithm NEXTN` (`[OPEN / VERSION-DEPENDENT]`). Source: SGLang speculative decoding / DeepSeek-V3 serving docs (search-verified, SGLang `docs` path moved; exact flag `--speculative-algorithm NEXTN` verified via SGLang GitHub/docs references).
- **Open models verified to ship native MTP weights/configs (checked 2026-11-18 directly on HuggingFace `config.json` / `model.safetensors.index.json`):**
  - **DeepSeek-V3** & **DeepSeek-R1**: `"num_nextn_predict_layers": 1` (`num_hidden_layers: 61`, `hidden_size: 7168`) (`[MANUFACTURER SPEC]`). Sources: https://huggingface.co/deepseek-ai/DeepSeek-V3/raw/main/config.json , https://huggingface.co/deepseek-ai/DeepSeek-R1/raw/main/config.json.
  - **DeepSeek-V4-Flash** (`"num_nextn_predict_layers": 1`, `num_hidden_layers: 43`) & **DeepSeek-V4.1-Flash** (`"num_nextn_predict_layers": 3`, `num_hidden_layers: 40`) (`[MANUFACTURER SPEC]`). Sources: https://huggingface.co/deepseek-ai/DeepSeek-V4-Flash/raw/main/config.json , https://huggingface.co/deepseek-ai/DeepSeek-V4.1-Flash/raw/main/config.json.
  - **Qwen3-Next-80B-A3B-Instruct**: No `num_nextn_predict_layers` key in `config.json`, **but** ships 1,553 `mtp.*` tensors (`mtp.fc.weight`, `mtp.layers.0.*`) in weights (`[MANUFACTURER SPEC]`). Source: https://huggingface.co/Qwen/Qwen3-Next-80B-A3B-Instruct/raw/main/model.safetensors.index.json.
  - **Qwen3.5-9B**, **Qwen3.5-27B**, **Qwen3.5-35B-A3B**, **Qwen3.6-35B-A3B**, **Qwen3.8-27B**: all have `"mtp_num_hidden_layers": 1`, `"mtp_use_dedicated_embeddings": false` inside `text_config` (`[MANUFACTURER SPEC]`). Sources: https://huggingface.co/Qwen/Qwen3.5-9B/raw/main/config.json , https://huggingface.co/Qwen/Qwen3.8-27B/raw/main/config.json , https://huggingface.co/Qwen/Qwen3.6-35B-A3B/raw/main/config.json.
  - **Qwen3.8-Flash-Next**: `"mtp_num_hidden_layers": 1`, `"mtp": {"hybrid": true, "layer_types": ["full_attention"], "num_hidden_layers": 1}` (`[MANUFACTURER SPEC]`). Source: https://huggingface.co/Qwen/Qwen3.8-Flash-Next/raw/main/config.json.
  - **GLM-4.5**, **GLM-4.7**, **GLM-4.7-Flash**, **GLM-5**: all have `"num_nextn_predict_layers": 1` (`[MANUFACTURER SPEC]`). Sources: https://huggingface.co/zai-org/GLM-4.5/raw/main/config.json , https://huggingface.co/zai-org/GLM-4.7/raw/main/config.json , https://huggingface.co/zai-org/GLM-4.7-Flash/raw/main/config.json , https://huggingface.co/zai-org/GLM-5/raw/main/config.json.
  - **Xiaomi MiMo-7B-Base** (`"num_nextn_predict_layers": 1`) & **MiMo-V2.6-Flash-RL** (`"num_nextn_predict_layers": 3`) (`[MANUFACTURER SPEC]`). Sources: https://huggingface.co/XiaomiMiMo/MiMo-7B-Base/raw/main/config.json , https://huggingface.co/XiaomiMiMo/MiMo-V2.6-Flash-RL/raw/main/config.json. *(Note: `XiaomiMiMo/MiMo-V2-Flash` and `MiMo-V2.6-Pro-RL` `config.json` did not include `num_nextn_predict_layers`.)*
- **Domain finetuning of native MTP:** Speculators supports finetuning an existing native MTP head (based on FastMTP, `arXiv:2509.18362`) while keeping `embed_tokens` and `lm_head` frozen (`[MECHANISM]` / `[OPEN / VERSION-DEPENDENT]`). Source: https://github.com/vllm-project/speculators/blob/main/docs/user_guide/algorithms/mtp.md.

### 2. Mechanism, precisely

1. **Main model pass at position $i$:** Produces final hidden state $\mathbf{h}_i^0 \in \mathbb{R}^d$ and samples next token $t_{i+1}$.
2. **MTP depth $k = 1 \dots D$ (sequential causal chain):**
   $$\mathbf{h}'^{k}_i = M_k\bigl[\text{RMSNorm}(\mathbf{h}_i^{k-1});\; \text{RMSNorm}(\text{Emb}(t_{i+k}))\bigr] \in \mathbb{R}^d, \qquad M_k \in \mathbb{R}^{d \times 2d}$$
   $$\mathbf{h}_i^k = \text{TRM}_k(\mathbf{h}'^k_i), \qquad P_{i+k+1} = \text{OutHead}(\mathbf{h}_i^k) \in \mathbb{R}^V$$
3. **Why it is sequential (not parallel independent heads):** Depth $k$ requires both the **sampled** token embedding $\text{Emb}(t_{i+k})$ from depth $k-1$ and the previous hidden state $\mathbf{h}_i^{k-1}$. When $D=1$ (DeepSeek-V3, Qwen3.5/3.8, GLM-4.x/5) and `num_speculative_tokens > 1`, inference engines reuse the single MTP Transformer block iteratively, feeding $(\mathbf{h}_i^k, t_{i+k+1})$ back in.
4. **Contrast with EAGLE-3:** EAGLE-3 is a separate external network taking fused `[low; mid; high]` target hidden states ($3d \to d$ FC) rather than only final hidden state $\mathbf{h}_i^0$, and can use a pruned `draft_vocab_size` (e.g., 32,000) with a `d2t` mapping, whereas native MTP shares the target's full `Emb` and `OutHead`.

### 3. Must not imply

- Do **not** imply that MTP heads are independent parallel heads that emit $K$ future tokens simultaneously in one step with zero causal dependency (DeepSeek-V3 / Qwen3.5 / GLM MTP chains each step on the previous sampled token + hidden state).
- Do **not** imply every open model ships MTP layers, or that `num_nextn_predict_layers = 1` means only 1 speculative token can be drafted (vLLM can roll 1 MTP layer for $K > 1$ steps, though accuracy degrades per step).
- Do **not** imply MTP has zero extra weights or zero KV cache: the MTP Transformer block (`mtp.layers.0`) has its own attention & MLP weights and its own attention KV cache entries.

### 4. Visual ideas

- **Idea A — Attached MTP Shelf vs Detached EAGLE-3 Tower:**
  - **Axes:** $X$ = step depth ($t+1 \dots t+4$); $Y$ = vertical layer stack of target model (layers $0\dots 6$ toy stack); $Z$ = side-by-side comparison (`MTP` attached directly to top layer vs `EAGLE-3` separate tower with `low/mid/high` taps).
  - **Size & motion:** In MTP mode, final hidden state + token tile enter `[RMSNorm | RMSNorm] -> M_k -> TRM_k -> shared OutHead`, then loop back 3 times; in EAGLE-3 mode, 3 thin buses from layers 1, 3, 6 merge (`3d -> d`) into an external 1-layer tower.
  - **One control:** `drafter` toggle (`native MTP (1 head, looped)` vs `native MTP (3 modules)` vs `EAGLE-3 (fused 3-layer)`), recomputing the feature taps and sequential stepping arrows. Toy size: 6-layer target stack, 4 future positions.
- **Idea B — Inside one MTP step (`2d -> d` causal chain):**
  - **Axes:** $X$ = future step $k = 1\dots 4$; $Y$ = bottom `Emb(t_{i+k})`, middle `M_k` projection + `TRM_k` block, top `OutHead` logits; $Z$ = hidden state channel vs embedding channel entering `M_k`.
  - **Size & motion:** Each step animates the two $d$-wide slabs normalizing, concatenating into a $2d$ slab, compressing through $M_k$ ($d \times 2d$), passing through $\text{TRM}_k$, and emitting token $t_{i+k+1}$ whose tile drops back into step $k+1$'s embedding input.
  - **One control:** `num_speculative_tokens` slider ($1\dots 4$), showing step-by-step chaining (with $D=1$ module reused vs $D=3$ distinct modules).

### 5. Open questions for the speaker

- Which specific open model does the speaker want highlighted as the MTP example on slide `mtp` (e.g., `Qwen3.8-27B` / `DeepSeek-V3` / `GLM-4.7` / `MiMo-V2.6-Flash`)?

---

## block-drafters

### 1. Facts

- **DFlash (Chen, Liang, Liu, ICML 2026 / `arXiv:2602.06036`):**
  - Lightweight **block diffusion** draft model (Qwen3-style decoder layers in Speculators) with **non-causal (bidirectional) attention** inside each block, predicting an entire block of `block_size - 1` masked tokens (default `block_size = 16`, or `15` speculative tokens; `sample_from_anchor = False`) in **one forward pass** (`[MECHANISM]` / `[MANUFACTURER SPEC]`). Sources: https://arxiv.org/abs/2602.06036 §4.1–4.2; https://github.com/vllm-project/speculators/blob/main/docs/user_guide/algorithms/dflash.md.
  - **Target conditioning via KV injection:** Extracts hidden states from a fixed set of uniformly spaced target layers (shallow to deep), concatenates and projects them into compact target context features, and **injects them directly into the Key and Value projections of every draft layer** (cached in the drafter's KV cache across iterations) (`[MECHANISM]`). Source: DFlash `arXiv:2602.06036` §4.1.
  - **Measured author benchmark (illustrative of workload/hardware dependence):** On Qwen3-4B / Qwen3-8B (`T=0`, 2048 max tokens, Table 1), DFlash(16) reports average $\tau = 6.54$ / $6.49$ ($4.91\times$ / $4.86\times$ speedup) vs EAGLE-3(60) $\tau = 3.48$ / $3.40$ ($2.08\times$ / $2.02\times$) (`[MEASURED by paper authors]`). Source: DFlash `arXiv:2602.06036` Table 1.
- **DSpark (DeepSeek, Cheng et al., `arXiv:2607.05147`, July 2026):**
  - **Semi-autoregressive generation:** Subclasses the DFlash block-parallel backbone (`sample_from_anchor = True`, so anchor + $\gamma-1$ masks produce $\gamma$ draft logits $U_1 \dots U_\gamma$ in one parallel pass), then adds a **lightweight sequential head** (`--markov-rank 256` default) to eliminate within-block independence / suffix decay (`[MECHANISM]`). Sources: https://arxiv.org/abs/2607.05147 §3.1; https://github.com/vllm-project/speculators/blob/main/docs/user_guide/algorithms/dspark.md.
  - **Three sequential head variants:** (1) `vanilla` (default): low-rank bigram bias $B(x_{k-1}, \cdot) = W_1[x_{k-1}] W_2$ where $W_1 \in \mathbb{R}^{V \times r}, W_2 \in \mathbb{R}^{r \times V}$ ($r = 256$); (2) `gated`: bias gated by backbone hidden state; (3) `rnn`: gated recurrent state $s_k \in \mathbb{R}^r$ over `[s_{k-1}; W_1[x_{k-1}]; h_k]` (`[MECHANISM]`). Sources: DSpark `arXiv:2607.05147` §3.1 Eq. 4–6; `dspark.md`.
  - **Confidence head & Hardware-Aware Prefix Scheduler:** Outputs conditional acceptance probability $c_k = \sigma(w^\top [h_k; W_1[x_{k-1}]]) \in (0,1)$, supervised against $c_k^* = 1 - \frac{1}{2}\|p_k^d - p_k^t\|_1$ and post-hoc calibrated via Sequential Temperature Scaling (STS). Prefix survival is $a_{r,j} = \prod_{i \le j} c_{r,i}$. Scheduler greedily adds $(r, j)$ in descending $a_{r,j}$ order to maximize $\Theta = \tau^* \cdot \text{SPS}(B)$ using profiled step throughput $\text{SPS}(B)$ (`[MECHANISM]`). Source: DSpark `arXiv:2607.05147` §3.2.1–3.2.2 Algorithm 1.
  - **Measured author claims:** On Qwen3-4B/8B/14B offline benchmarks, DSpark improves macro-average $\tau$ by $16.3\%$–$18.4\%$ over DFlash; in DeepSeek-V4 live traffic, $+60\%$–$85\%$ per-user speed (V4-Flash) over MTP-1 at matched throughput (`[MEASURED by paper authors]`). Source: DSpark `arXiv:2607.05147` §1.
- **DFlash2 (Inco AI / Z-Lab, August 18, 2026; `inco.ai/blog/dflash2/`, `z-lab/dflash`, `vllm-project/speculators`):**
  - **No separate arXiv paper found as of 2026-11-18; primary sources are the Inco AI technical blog (`https://inco.ai/blog/dflash2/`), pinned Z-Lab code (`https://github.com/z-lab/dflash/blob/07ebd93db9f472af339b644bb70221ad8428328a/dflash/model.py`), vLLM Speculators `dflash2.md`, and vLLM `vllm/v1/worker/gpu/spec_decode/dflash2/speculator.py`** (`[OPEN / VERSION-DEPENDENT]`).
  - **Two additions on top of DFlash (stays 1-pass backbone):**
    1. **Local dynamic causal convolutions:** Each draft layer wraps both attention and MLP with a grouped causal convolution (`conv_kernel_size = 2`, `conv_group_size = 16` defaults). A projection of hidden state produces dynamic input/output kernels around a shared learned base kernel; convolution never crosses anchor-block boundaries. Fixes suffix decay (attention to within-block tokens drops from 30% in Layer 1 to 8% in Layer 5 in plain DFlash; convolutions add ~3% params and ~0.7% cycle latency) (`[MECHANISM]` / `[MEASURED by Inco AI]`).
    2. **Low-rank bilinear candidate selector:** Keeps top-$K$ unary candidates per position (`selector_top_k = 16` default, rank `selector_rank = 256` default) and scores all adjacent pairs in parallel: $S_t(a,b) = U_t(b) + \langle A(a) \odot H(h_t), B(b)\rangle$. Only a tiny sequential walk traces the chosen path across top-16 candidates (vs DSpark's full-vocab Markov head: $+2.0\text{M}$ params / $+0.6\%$ latency vs $+77.8\text{M}$ / $+9.6\%$ on 5-layer Qwen3-4B GSM8K, raising $\tau$ from $4.27 \to 4.61$ at $T=0$ vs DSpark $4.49$) (`[MECHANISM]` / `[MEASURED by Inco AI]`).
  - **Constraints & experimental caveats:** DFlash2 currently requires the **full, unquantized verifier vocabulary** (no pruned draft vocab) because selection happens before vocab remapping; Inco AI did not publish the training objective, so Speculators' DFlash2 trainer uses an experimental split objective (`ce` + K-way selector CE with `replace`/`strict` miss policy) (`[OPEN / VERSION-DEPENDENT]`). Source: https://github.com/vllm-project/speculators/blob/main/docs/user_guide/algorithms/dflash2.md.

### 2. Mechanism, precisely

All three run a **single parallel block forward pass** conditioned on target hidden states injected into draft KV projections, then diverge in how intra-block coherence is handled:
- **DFlash:** Input = `[anchor, MASK, ..., MASK]` (len `B`). Non-causal self-attention + target-feature KV injection $\implies$ hidden states $h_1\dots h_{B-1} \implies$ independent logits $U_1\dots U_{B-1} \implies$ argmax/sample independently at each slot.
- **DSpark:** Input = `[anchor, MASK, ..., MASK]` (len $\gamma$, `sample_from_anchor=True`). Same parallel backbone yields $h_1\dots h_\gamma$ and $U_1\dots U_\gamma$. Then sequential loop $k=1\dots\gamma$: compute $B_k(x_{k-1}, \cdot) = W_1[x_{k-1}]W_2$ (or RNN state $s_k$) over full vocab $V$, sample $x_k \sim \text{softmax}(U_k + B_k)$, compute confidence $c_k = \sigma(w^\top[h_k; W_1[x_{k-1}]])$, and scheduler truncates verification length $\ell_r^*$ via cumulative survival $a_{r,j} = \prod_{i \le j} c_{r,i}$.
- **DFlash2:** Within every draft layer, wrap Attn and MLP with grouped 2-tap causal dynamic convs (still 1 parallel pass). From $U_t$, take top-16 candidates at each slot; score every $(16 \times 16)$ adjacent pair matrix in parallel via $U_t(b) + \langle A(a) \odot H(h_t), B(b)\rangle$; walk only the $K=16$ score table sequentially from anchor.

### 3. Must not imply

- Do **not** show DFlash, DSpark, and DFlash2 as identical algorithms or label DFlash2 as "DSpark v2".
- Do **not** depict DFlash as running $K$ separate sequential forward passes through the draft transformer layers.
- Do **not** imply DSpark's Markov bias operates only on top-16 candidates (it adds a low-rank bias across the **full** draft vocabulary $V$) or that DSpark's confidence truncation happens without a load-aware scheduler in the serving engine.
- Do **not** omit that DFlash2's selector is still experimental in Speculators' trainer and requires the full verifier vocabulary.

### 4. Visual ideas

- **Idea A — Shared block backbone with 3 swappable post-backbone mechanisms (v1 `drafters` refined):**
  - **Axes:** $X$ = block slots $0\dots 7$; $Y$ = bottom target context KV injection bus, middle 5-layer parallel draft slab, top head/selector layer; $Z$ = top-16 candidate columns at each slot (collapsed to 1 column in DFlash/DSpark, expanded to 16 in DFlash2).
  - **Size & motion:** One broad draft slab sweeps all 8 slots together. In **DFlash**, 8 independent tiles drop straight down. In **DSpark**, a thin $r$-dim arrow hops left-to-right across full-vocab logit bars + vertical confidence gauges $c_k$ and a movable verification cutoff wall. In **DFlash2**, short 2-tap brackets connect adjacent positions inside the slab, and a thin zigzag path traces across $16$-high candidate columns.
  - **One control:** `method` selector (`dflash` / `dspark` / `dflash2`), recomputing the intra-block wiring, candidate columns, and cutoff gate.
- **Idea B — Multi-request adaptive verification budget (DSpark vs fixed block):**
  - **Axes:** $X$ = draft slot $1\dots 8$; $Y$ = 4 concurrent requests stacked vertically; $Z$ = height of survival bar $a_{r,j} = \prod_{i\le j} c_{r,i}$.
  - **Size & motion:** Fixed budget of $B = 14$ dark verification tiles distributed across the 4 requests: high-confidence code request keeps 6 slots, chat requests keep 2–3, low-confidence tail slots past the cutoff stay pale and are never sent to the target pass.
  - **One control:** `concurrency_load` slider (`low` vs `high`), shrinking the budget $B$ and moving each lane's truncation fence dynamically.

### 5. Open questions for the speaker

- Confirm whether `block-drafters` reuses v1's `drafters` builder (`src/scenes/builders/drafters.js`) directly as Variant A, and whether DSpark's adaptive verification scheduler deserves Variant B (`docs/deck-v2-plan.md` notes reusing `drafters`).

---

## shipped-drafters

### 1. Facts

- **Distinction:** Some labs now ship **official matched drafters alongside their own base/target models** (same org/release), while third-party inference teams (RedHatAI, Inco AI, Z-Lab, NVIDIA) also publish standalone drafters for popular open models (`[OPEN / VERSION-DEPENDENT]`).
- **Official model-maker matched drafter releases (verified 2026-11-18 on HuggingFace):**
  1. **Meta — Muse Glimmer 30B + DFlash assistant:**
     - Target: `meta-models/Muse-Glimmer-30B` (29.8B params, 52 layers) — https://huggingface.co/meta-models/Muse-Glimmer-30B
     - Matched drafter: `meta-models/Muse-Glimmer-30B-assistant` (`2,555,985,152` BF16 params, 5 sliding-attention layers, `sliding_window: 2048`, `block_size: 16`, `target_layer_ids: [1,13,25,37,49]`, released Aug 2026) — https://huggingface.co/meta-models/Muse-Glimmer-30B-assistant (`[MANUFACTURER SPEC]`).
  2. **Poolside — Laguna S 2.1 & XS 2.1 + DFlash:**
     - Target: `poolside/Laguna-S-2.1` (117.6B params) — https://huggingface.co/poolside/Laguna-S-2.1
     - Matched drafters: `poolside/Laguna-S-2.1-DFlash` (`1,114,977,792` BF16 params, 6 sliding-attention layers, `sliding_window: 512`, `block_size: 16`, plus `-NVFP4`, `-FP8`, `-INT4` quants) — https://huggingface.co/poolside/Laguna-S-2.1-DFlash; and `poolside/Laguna-XS-2.1-DFlash` — https://huggingface.co/poolside/Laguna-XS-2.1-DFlash (`[MANUFACTURER SPEC]`).
  3. **DeepSeek — DeepSeek-V4-Flash / Pro + DSpark:**
     - Targets: `deepseek-ai/DeepSeek-V4-Flash` (284B total / 13B active) & `deepseek-ai/DeepSeek-V4-Pro` (1.6T total / 49B active)
     - Matched DSpark releases: `deepseek-ai/DeepSeek-V4-Flash-DSpark` — https://huggingface.co/deepseek-ai/DeepSeek-V4-Flash-DSpark and `deepseek-ai/DeepSeek-V4-Pro-DSpark` — https://huggingface.co/deepseek-ai/DeepSeek-V4-Pro-DSpark (same checkpoint with DSpark speculative module attached) (`[MANUFACTURER SPEC]`).
  4. **Xiaomi — MiMo-V2.5 / MiMo-V2.5-Pro + DFlash:**
     - `XiaomiMiMo/MiMo-V2.5-DFlash` — https://huggingface.co/XiaomiMiMo/MiMo-V2.5-DFlash and `XiaomiMiMo/MiMo-V2.5-Pro-FP4-DFlash` — https://huggingface.co/XiaomiMiMo/MiMo-V2.5-Pro-FP4-DFlash (alongside `XiaomiMiMo/MiMo-7B-MTPs`) (`[MANUFACTURER SPEC]`).
  5. **NVIDIA — Nemotron 3.5 Lightning / Bolt / Transcribe + DFlash / DSpark / DFlash2:**
     - `nvidia/NVIDIA-Nemotron-3.5-Lightning-30B-A3B-NVFP4-DFlash` — https://huggingface.co/nvidia/NVIDIA-Nemotron-3.5-Lightning-30B-A3B-NVFP4-DFlash
     - `nvidia/NVIDIA-Nemotron-3.5-Lightning-30B-A3B-NVFP4-DSpark` — https://huggingface.co/nvidia/NVIDIA-Nemotron-3.5-Lightning-30B-A3B-NVFP4-DSpark
     - `nvidia/NVIDIA-Nemotron-3.5-Bolt-E4B-4GB-DFlash` — https://huggingface.co/nvidia/NVIDIA-Nemotron-3.5-Bolt-E4B-4GB-DFlash (`[MANUFACTURER SPEC]`).
- **Notable third-party / research-lab drafters (distinct from model-maker official bundles):**
  - **RedHatAI** (`RedHatAI/speculator-models` collection): `RedHatAI/Qwen3-8B-speculator.eagle3`, `RedHatAI/gemma-4-31B-it-speculator.dflash`, `RedHatAI/GLM-5.2-speculator.dspark-preview`, etc. — https://huggingface.co/collections/RedHatAI/speculator-models (`[MANUFACTURER SPEC]`).
  - **Inco AI / Z-Lab**: `incoai/Qwen3.8-27B-DFlash2` (`1.92B` params), `z-lab/Qwen3-8B-DFlash-b16` (`1.05B` params) — https://huggingface.co/incoai/Qwen3.8-27B-DFlash2 , https://huggingface.co/z-lab/Qwen3-8B-DFlash-b16 (`[MANUFACTURER SPEC]`).
  - **NVIDIA third-party drafters**: `nvidia/Llama-3.3-70B-Instruct-Eagle3`, `nvidia/Qwen3-235B-A22B-Eagle3`, `nvidia/Kimi-K2.7-Code-DFlash` (`[MANUFACTURER SPEC]`).

### 2. Mechanism, precisely

A matched drafter is **not** a generic small model from the same family (like pairing Qwen3-0.6B with Qwen3-32B); it is specifically trained against the target's exact hidden-state layer indices (`target_layer_ids` / `eagle_aux_hidden_state_layer_ids`), hidden dimension, tokenizer, and often shares the target's embedding/LM head or vocabulary mapping:
- **Bundled inside checkpoint** (DeepSeek-V4-Flash-DSpark, native MTP models): one repo contains base + speculator weights.
- **Companion repo** (Muse Glimmer `*-assistant`, Laguna `*-DFlash`, Nemotron `*-DFlash`/`*-DSpark`, MiMo `*-DFlash`): separate checkpoint downloaded alongside the target, wired via `--speculative-config '{"method": "...", "model": "..."}'`.

### 3. Must not imply

- Do **not** imply that downloading a target model automatically installs or enables a companion drafter.
- Do **not** imply that any small model of the same family works as a matched DFlash/DSpark/EAGLE-3 drafter (hidden-state layer IDs and vocab/head must match the target checkpoint).
- Do **not** imply every quantized variant (e.g., GGUF Q4 vs NVFP4 vs FP8) works interchangeably with a BF16 drafter without engine/quant compatibility checks (note Poolside ships separate `-NVFP4`, `-FP8`, `-INT4` DFlash repos, and DFlash2 requires full unquantized LM head).
- Do **not** mix up official model-maker releases with third-party ecosystem drafters.

### 4. Visual ideas

*(Note: `shipped-drafters` has no ◆ in `docs/deck-v2-plan.md`, so it may be a text/table slide; 3D ideas included in case a visual is desired.)*
- **Idea A — Target + Companion Artifact Coupling Diagram:**
  - **Axes:** $X$ = 5 model makers (`Meta`, `Poolside`, `DeepSeek`, `Xiaomi`, `NVIDIA`); $Y$ = Target Slab (large dark box) + Drafter Slab (small mid-grey box); $Z$ = hidden-state tap cables (`target_layer_ids`) connecting specific target layers into the drafter.
  - **Size & motion:** Proportional parameter height (e.g., Muse 29.8B vs 2.56B; Laguna 117.6B vs 1.11B); clicking a column highlights the matched pair and its exact layer-tap indices.
  - **One control:** `release` selector (cycles the 5 official pairs), updating layer tap positions and parameter ratio readout.
- **Idea B — Packaging Matrix (Embedded vs Companion vs Third-Party):**
  - **Axes:** $X$ = packaging pattern (3 columns: `Embedded in weights`, `Official companion repo`, `Third-party speculator`); $Y$ = artifact stack (`weights + config + tokenizer + draft`).
  - **Size & motion:** Shows `vllm serve` reading either 1 repo or 2 linked repos + checking `target_layer_ids` compatibility latch.
  - **One control:** `packaging_mode` toggle.

### 5. Open questions for the speaker

- Confirm whether `shipped-drafters` stays a clean text/list slide (no ◆ in `docs/deck-v2-plan.md`) or wants a companion figure.

---

## drafter-vram

### 1. Facts

- **Drafters consume the same GPU VRAM pool as target weights and KV cache:** Adding an external drafter reserves memory for (a) drafter model weights, (b) drafter activation/workspace buffers (and any fused hidden-state staging buffer `self.hidden_states`), and (c) **the drafter's own KV cache** (`[MECHANISM]`). Sources: vLLM `DraftModelSpeculator` (`speculator.py`), `DFlashSpeculator` (`dflash/speculator.py` L289–338), `TargetDependentARSpeculator` (`target_dependent_ar/speculator.py` L33, L184), https://github.com/vllm-project/vllm/blob/main/vllm/v1/worker/gpu/spec_decode/dflash/speculator.py.
- **Verified real-world drafter weight & KV arithmetic (all parameters and dimensions from HuggingFace `config.json` & safetensors API as of 2026-11-18):**
  - **Case 1 — `Qwen/Qwen3.8-27B` + `incoai/Qwen3.8-27B-DFlash2`:**
    - Target weights: `27,781,427,952` BF16 params = `55.56 GB` (`51.75 GiB`) in BF16, or `~13.89 GB` raw payload at 4-bit (`[MANUFACTURER SPEC]`, HF API).
    - Target KV/state: Hybrid architecture (64 layers = 48 `linear_attention` + 16 `full_attention`, `num_key_value_heads: 4`, `head_dim: 256`). Full-attention KV in BF16 = $2 \times 16 \times 4 \times 256 \times 2 = 65,536\text{ B/tok} = 64\text{ KiB/tok}$ (plus fixed-size linear-attention recurrent state per sequence) (`[MANUFACTURER SPEC]`).
    - **DFlash2 drafter weights:** `1,924,404,480` BF16 params = `3.85 GB` (`3.58 GiB`) in BF16 (`[MANUFACTURER SPEC]`, HF API).
    - **DFlash2 drafter KV:** 5 layers, `sliding_window: 2048`, `num_key_value_heads: 8`, `head_dim: 128`, BF16 $\implies 2 \times 5 \times 8 \times 128 \times 2 = 20,480\text{ B/tok} = 20\text{ KiB/tok}$. Capped by sliding window at $2048 \times 20\text{ KiB} = 40\text{ MiB/sequence}$ (or `640 MiB` for 16 concurrent sequences $\ge 2048$ tokens) (`[MECHANISM]` from `config.json`).
  - **Case 2 — `Qwen/Qwen3-8B` + `RedHatAI/Qwen3-8B-speculator.eagle3`:**
    - **EAGLE-3 drafter weights:** `1,021,853,696` BF16 params = `2.04 GB` (`1.90 GiB`) in BF16 (`[MANUFACTURER SPEC]`, HF API).
    - **EAGLE-3 drafter KV:** 1 Llama-style layer, `num_key_value_heads: 8`, `head_dim: 128`, BF16, no sliding window $\implies 2 \times 1 \times 8 \times 128 \times 2 = 4,096\text{ B/tok} = 4\text{ KiB/tok}$. Across 32,768 pooled tokens = `128 MiB` (`0.125 GiB`) (`[MECHANISM]` from `config.json`).
  - **Case 3 — `poolside/Laguna-S-2.1` + `poolside/Laguna-S-2.1-DFlash`:**
    - **DFlash drafter weights:** `1,114,977,792` BF16 params = `2.23 GB` (`2.08 GiB`) in BF16; 6 layers, `sliding_window: 512`, `num_key_value_heads: 8`, `head_dim: 128` $\implies 24\text{ KiB/tok}$, capped at `12 MiB/sequence` (`[MANUFACTURER SPEC]` + `[MECHANISM]`).
- **Sliding-window KV optimization in Speculators / vLLM:** DFlash and DSpark speculators in `vllm-project/speculators` enable sliding-window attention on all draft layers by default (`--sliding-window`) specifically to bound drafter KV cache allocation at long context (`[MANUFACTURER SPEC]` / `[MECHANISM]`). Source: `vllm-project/speculators` README, https://github.com/vllm-project/speculators/blob/main/README.md.
- **Prefix-cache interaction caveat:** In vLLM, drafter KV cache groups must be registered cleanly (`draft_kv_cache_group_ids`); misconfigured or sliding-window vs full-attention interactions affect vLLM's KV block planner (`[OPEN / VERSION-DEPENDENT]`). Source: `dflash/speculator.py` L289–338, https://github.com/vllm-project/vllm/blob/main/vllm/v1/worker/gpu/spec_decode/dflash/speculator.py.
- **Heuristic / n-gram drafters:** N-gram or suffix-matching drafters in vLLM (`ngram`, `suffix`) add **no** neural draft weights or neural KV cache (`[MECHANISM]`). Source: `vllm/v1/worker/gpu/spec_decode/ngram/speculator.py`.

### 2. Mechanism, precisely

Total GPU memory under `--gpu-memory-utilization U`:
$$\text{Budget} = U \cdot \text{VRAM}_{\text{total}} = \text{TargetWeights} + \text{DrafterWeights} + \text{Runtime/Activations} + \text{TargetKVPool} + \text{DrafterKVPool}$$
When enabling a neural drafter on a fixed GPU (e.g., 32 GB RTX 5090 running 4-bit Qwen3.8-27B):
1. Target 4-bit weights take ~14–16 GiB (exact depends on quant format & excluded layers); runtime/CUDA graphs/activations take ~1.5–2.5 GiB.
2. Adding BF16 `Qwen3.8-27B-DFlash2` adds **3.58 GiB** of weights + **20 KiB/tok** (up to **40 MiB/req** at window 2048) of drafter KV cache.
3. Every GiB taken by `DrafterWeights + DrafterKVPool` is subtracted directly from `TargetKVPool`, shrinking the maximum concurrent agent sequences or prefix cache capacity.
4. Note **MTP** layers are already inside the target checkpoint's weight count (if loaded), whereas **EAGLE-3 / DFlash / DSpark** add a separate weight band; quantizing the drafter (e.g., INT4/FP8 draft) shrinks `DrafterWeights`, while sliding window attention bounds `DrafterKVPool`.

### 3. Must not imply

- Do **not** imply that a drafter is "free" in VRAM, or that only its weight file size matters (it also allocates its own KV cache slots per active token/window).
- Do **not** imply every drafter allocates a full-context unwindowed KV cache (DFlash/DFlash2/DSpark in Speculators & Muse/Laguna use sliding-window attention to cap per-sequence draft KV).
- Do **not** imply that trading KV capacity for a drafter is always a net win (at high concurrency, losing prefix-cache KV capacity or paying draft compute can worsen throughput/TTFT).
- Do **not** present illustrative v1 block counts (`120 -> 96 -> 72 -> 48`) as measured GiB values.

### 4. Visual ideas

- **Idea A — Fixed 32 GiB VRAM Column with Evicted KV Cubes (v1 `drafter-vram` with real Qwen3.8-27B numbers):**
  - **Axes:** $X$ = memory band width; $Y$ = bottom-up VRAM occupancy up to a dark 32 GiB ceiling plate (Target Weights $\to$ Runtime $\to$ Drafter Weights $\to$ Drafter KV $\to$ Target KV cubes); $Z$ = Target KV vs Drafter KV split.
  - **Size & motion:** Toggling drafter (`none` / `MTP (1 layer)` / `EAGLE-3 (1.9 GiB)` / `DFlash2 (3.58 GiB + SW 2048)`) raises the lower resident bands and pushes top Target KV cubes past the ceiling (evicted/fading).
  - **One control:** `drafter_mode` selector (`off` / `mtp` / `eagle3` / `dflash2-bf16` / `dflash2-int4`), recomputing remaining Target KV capacity in tokens / concurrent 8K agents. Toy grid: 10 rows $\times$ 12 cols = 120 KV blocks.
- **Idea B — Two-Tenant KV Pool (Sliding Window vs Full Context):**
  - **Axes:** $X$ = active sequence context length ($0 \dots 16\text{K}$ tokens); $Y$ = resident KV memory per request; $Z$ = 4 concurrent agent lanes.
  - **Size & motion:** As tokens stream in, Target full-attention KV slabs grow across $X$, while Drafter KV slabs either grow linearly (EAGLE-3 full attention) or flatten into a fixed-width dark cap at `window = 2048` (DFlash2).
  - **One control:** `context_len` slider ($1\text{K} \to 16\text{K}$), comparing linear vs sliding-window drafter KV growth alongside target KV.

### 5. Open questions for the speaker

- Confirm whether `drafter-vram` keeps v1's `drafter-vram` builder (`src/scenes/builders/drafter-vram.js`) as Variant A (`docs/deck-v2-plan.md`), and whether the speaker wants the real `Qwen3.8-27B + DFlash2 (3.58 GiB BF16)` arithmetic displayed in the HUD/legend.

---

## my-drafter

### 1. Facts

- **`vllm-project/speculators` library purpose & format:** Standardized open-source library (Apache-2.0, Red Hat / vLLM) for preparing data, extracting verifier hidden states, training speculative drafters (`eagle3`, `dflash`, `dflash2`, `dspark`, `mtp`, plus deprecated `peagle`), converting external checkpoints (`safeailab/EAGLE`, `z-lab/dflash`, native MTP), and saving a HuggingFace-compatible `speculators_config` / `speculator_config` checkpoint that `vllm serve <speculator_model>` loads directly (`[MANUFACTURER SPEC]`). Sources: https://github.com/vllm-project/speculators/blob/main/README.md ; https://github.com/vllm-project/speculators/blob/main/docs/user_guide/getting_started.md.
- **Main `speculators` CLI commands (verified in `src/speculators/cli/__init__.py` & `docs/user_guide/tutorials/train.md`):**
  1. `speculators regenerate-responses` — regenerate on-policy target responses from prompts.
  2. `speculators prepare-data` — apply chat template via vLLM render endpoint, tokenize, build `loss_mask` and `token_freq.pt`.
  3. `speculators generate-offline-data` — stream target prompts through vLLM (`scripts/launch_vllm.py`) to cache hidden states (`hs_*.safetensors`) to disk (optional if using online training or `hs_connectors` with Mooncake).
  4. `speculators train` (or `torchrun ... -m speculators.train`) — train draft weights on target hidden states (online or offline).
  5. `speculators convert` — convert external EAGLE-3 / DFlash / MTP checkpoints into `speculators` format (`--algorithm`, `--verifier`).
  6. `speculators stitch-mtp` — merge finetuned MTP weights back into the target checkpoint (`[MANUFACTURER SPEC]`). Sources: https://github.com/vllm-project/speculators/blob/main/src/speculators/cli/__init__.py ; https://github.com/vllm-project/speculators/blob/main/docs/user_guide/tutorials/train.md.
- **Speaker's own training experiment figures (already verified in `src/scenes/builders/drafter-train.js` & `docs/presentation-production-handoff.md`):**
  - Pipeline issues referenced: `home-k8s` `#50`, `#51`, `#59` (pipeline + bugs, incl. RoPE mismatch debugging incident), `#60` (corrected recipe), `#69` (data corpus), `#72` (serve + convert), `#80` (agentic test) (`[SPEAKER OBSERVATION]`).
  - Run `#72`: `~546k` rows, `2d16h` training time (`[MEASURED ON SPEAKER SYSTEM]`, from `drafter-train.js` L56).
  - Run `#80`: `215,154` rows, served acceptance length `1.617` vs `~1.66` baseline (`[MEASURED ON SPEAKER SYSTEM]`, from `drafter-train.js` L56, L77 — note the agentic-data run did not beat the `~1.66` baseline).
  - Source files in repo: `src/scenes/builders/drafter-train.js` L46–77; `docs/presentation-production-handoff.md` E05 L439–446.

### 2. Mechanism, precisely

End-to-end drafter training pipeline and why free-running inference differs from teacher-forced training:
1. **On-policy trajectories:** Prompts must be answered by the **same target model** (off-policy text from another model teaches tokens the target would reject).
2. **Hidden-state extraction:** Target runs forward passes over clean `(prompt + response)` tokens to emit selected layer hidden states (e.g., 3 layers for EAGLE-3; uniformly spaced layers for DFlash/DSpark; final norm layer for MTP). Offline caches `hs_*.safetensors` (e.g. `seq_len × num_layers × hidden_size × 2B`); online streams from a live vLLM server.
3. **Draft training (teacher-forced vs multi-step / block):** At each anchor token, drafter conditions on target hidden states + embeddings/masks and minimizes KL divergence / CE against target logits (plus DSpark Markov + BCE confidence loss, or EAGLE-3 training-time test).
4. **Convert / Serve:** Export config + weights (`speculators convert` or direct `speculator_config`), then launch `vllm serve` with `--speculative-config`.
5. **Why `#80` stalled at `1.617` vs `~1.66`:** More on-policy agentic rows alone (`215,154` rows) do not automatically fix train/serve mismatch (RoPE/conditioning bugs, teacher-forced vs free-running compounding drift, or objective/hyperparameter limits).

### 3. Must not imply

- Do **not** present the speaker's `215,154`-row run (`1.617` acceptance length) as a triumph over the `~1.66` baseline — it is an honest engineering retrospective showing that more agentic data alone did not beat baseline.
- Do **not** imply AutoRound (weight quantization tuning) is the drafter trainer.
- Do **not** imply every DSpark/DFlash training run requires a fixed number of samples or `2d16h`, or omit that the figures are specific to the speaker's `home-k8s` hardware/corpus.
- Do **not** invent contents of `home-k8s` `#59`/`#60`/`#69` beyond what is verified in `drafter-train.js` and `presentation-production-handoff.md`.

### 4. Visual ideas

- **Idea A — 6-Stage Pipeline Conveyor + Teacher-Forced vs Free-Running Drift (refinement of `src/scenes/builders/drafter-train.js`):**
  - **Axes:** $X$ = 6 pipeline stations (`trajectories -> rollouts -> hidden states -> train -> convert -> serve`) at $y < 0$, plus 6 future token slots at $y > 0$, plus `#50..#80` issue timeline at $y = -2.25$; $Y$ = reference token row above draft slot row.
  - **Size & motion:** Packet travels along the 6-station conveyor; upper row toggles between **teacher-forced** (each draft slot receives ground-truth reference token, 6/6 dark) and **free-running** (each slot feeds its own prediction sideways; mismatch at slot 2 causes slots 3–6 to go pale with slash marks).
  - **One control:** `mode` toggle (`teacher-forced` vs `free-running`) + `stage` toggle (`pipeline` vs `results` showing `#72: 546k rows · 2d16h` and `#80: 215,154 rows · 1.617 vs ~1.66`).
- **Idea B — Offline vs Online Hidden-State Plumbing + Experiment Outcome Bars:**
  - **Axes:** $X$ = `vLLM verifier` $\to$ `hidden states` $\to$ `drafter trainer` $\to$ `checkpoint`; $Y$ = VRAM/Disk slab size; $Z$ = `online` (streaming wire, 0 disk slab) vs `offline` (huge disk slab `hs_*.safetensors`, smaller simultaneous GPU need).
  - **Size & motion:** Shows `hs_0..hs_k` tensor slices (`seq × layers × d`) flowing either directly over GPU/network or stacking onto a disk slab before training, ending at a 2-bar measured comparison (`baseline ~1.66` vs `run #80: 1.617`).
  - **One control:** `hs_mode` toggle (`online` vs `offline`), recomputing GPU/disk occupancy.

### 5. Open questions for the speaker

- Confirm which base model and drafter architecture (DSpark? DFlash?) runs `#72` (`2d16h`, `546k` rows) and `#80` (`215,154` rows, `1.617` vs `~1.66`) targeted, and whether any exact details from `home-k8s` `#59`/`#60` (e.g., the RoPE mismatch) should appear on-screen.
