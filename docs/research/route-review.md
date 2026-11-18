# Independent Accuracy Review: `src/slides/route/` (a01–g01)

Reviewed against [presentation-production-handoff.md](../presentation-production-handoff.md) (§0–§4, §6–§7), [README.md](../../README.md), and primary documentation/model cards.

## Summary & Coverage

- **Present (29):** `a01`, `a02`, `a03`, `b01`, `b02`, `b03`, `b04`, `b05`, `c01`, `c02`, `c03`, `c04`, `c05`, `d01`, `d02`, `d03`, `d04`, `d05`, `e01`, `e02`, `e03`, `e04`, `e05`, `e06`, `f01`, `f02`, `f03`, `f04`, `g01`.
- **Missing (0):** none (`b04` landed during review).
- **Verdicts:** 20 `ok` · 9 `fix` (`a03`, `b01`, `b02`, `b05`, `c02`, `c03`, `d02`, `e05`, `f03`) · 0 `unsure`.

---

## Scene-by-Scene Review

### `a01` — `agent-loop` ([a01.ts](../../src/slides/route/a01.ts) · [agent-loop.js](../../src/scenes/builders/agent-loop.js))
- **verdict:** `ok`
- **caption:** Follows ladder in 2 sentences (loop → `coding agent`, `harness` → caveat `The model never runs tools itself`).
- **accuracy:** No contradictions. Trace is explicitly labeled `synthetic trace` (`agent-loop.js:152`); static weights stay `0x101010` (`agent-loop.js:285`); `where tools run` wall labels `text in, text out` (`agent-loop.js:154`).
- **controls:** `turn` (`1|2|3|4`, `agent-loop.js:343`) jumps to `TURN0[n-1]` and updates readout (`turn ${b.turn} of 4`); `reveal` (`boolean`, `agent-loop.js:346`) draws the `text in, text out` wall, dims tool lines, and updates readout.
- **open question (§7):** Bullet 11 (sanitized real tool trace vs synthetic) and Bullet 2 (model/quant identity).

### `a02` — `weights-fixed` ([a02.ts](../../src/slides/route/a02.ts) · [weights-fixed.js](../../src/scenes/builders/weights-fixed.js))
- **verdict:** `ok`
- **caption:** Follows ladder in 2 sentences (adjusts billions of numbers → `weights` → `your prompts never change them`).
- **accuracy:** No contradictions. Matrix updates only in `training`, stays frozen in `inference`; `file format` (`safetensors` / `GGUF`) is visibly separate from `engine` (`vLLM / SGLang` / `llama.cpp`, `weights-fixed.js:53-55`). Minor: readout `weights-fixed.js:315` says `into vllm` while 3D label says `vLLM / SGLang`.
- **controls:** `mode` (`training|inference`, `weights-fixed.js:321`) toggles arrows, matrix updates, logits bars, and readout; `artifact` (`safetensors|gguf`, `weights-fixed.js:327`) updates `lFile`, `lEng`, and readout.
- **open question (§7):** None.

### `a03` — `profiles` ([a03.ts](../../src/slides/route/a03.ts) · [profiles.js](../../src/scenes/builders/profiles.js))
- **verdict:** `fix`
- **caption:** **3 sentences** at `a03.ts:13` (`Every choice... . Pick the workload... . What are you running?`), exceeding the ≤ 2 sentence limit. Plain language, no jargon dump.
- **accuracy:** Readout string at `profiles.js:37` states `'cheap chat leans on memory bandwidth · every limit low'`, which contradicts `profiles.js:36` `lv: [0, 1, 0, 0, 0, 0]` where `memory bandwidth` (index 1) is `1` (`med`), not low.
- **controls:** `profile` (`coding|private|chat|long`, `profiles.js:181`) updates pillar heights, shades, cap plates, `lblProf`, and `PROF[prof].line` readout.
- **open question (§7):** Bullet 11 (one-question Mac/MLX audience invitation and final rhetorical landing).

### `b01` — `gpu-choice` ([b01.ts](../../src/slides/route/b01.ts) · [gpu-choice.js](../../src/scenes/builders/gpu-choice.js))
- **verdict:** `fix`
- **caption:** Follows ladder in 2 sentences (`128 GB` vs `32 GB`, `rated bandwidth`, Windows laptop eGPU integration).
- **accuracy:** Hardware specs match primary NVIDIA sources (RTX 5090: 32 GB GDDR7, 1,792 GB/s; DGX Spark: 128 GB unified LPDDR5x, 273 GB/s) and speaker ~20 s load observation is labeled `speaker observation` (`gpu-choice.js:260`). **Bug:** `gpu-choice.js:246` labels the bandwidth pipes `'pipe width ∝ rated GB/s'`, whereas `gpu-choice.js:40` computes `pipeThick = gbps => 0.014 * Math.sqrt(gbps)` and `gpu-choice.js:181` applies `thick` to both `y` and `z` — so **cross-sectional area** is `∝ rated GB/s`, while pipe width is `∝ √(rated GB/s)`. Minor: `b01.ts:37` `evidence` omits `'SYNTHETIC DEMO'` for the illustrative 20/30/40/90 GB budget blocks.
- **controls:** `budget` (`20|30|40|90`, `gpu-choice.js:429`) updates fit/overflow blocks, 2 GB tight sliver, pipe traffic, and readout; `egpu` (`boolean`, `gpu-choice.js:434`) toggles laptop, cable, load-once packet, and readout.
- **open question (§7):** Bullet 1 (24 GB vs 32 GB model/quant/context) and Bullet 3 (Thunderbolt/eGPU dock/link and ~20 s load conditions).

### `b02` — `memtiers` ([b02.ts](../../src/slides/route/b02.ts) · [04-memtiers.ts](../../src/scenes/scene-lab/04-memtiers.ts) · [memtiers.js](../../src/scenes/builders/memtiers.js))
- **verdict:** `fix`
- **caption:** 2 sentences; moves from shelves/sizes/speeds to `VRAM`, `system RAM`, `NVMe`, and `Capacity, bandwidth and latency are three separate numbers`. Caveat on differing benchmarks is in the readout rather than the caption.
- **accuracy:** Benchmark rates in `memtiers.js:35-44` (`1466.75 gb/s` Boston Ltd RTX PRO 6000 copy; `20.5`/`41.5`/`78.0 gb/s` Malekal `moc-memory-stream-v4`; `10.97`/`0.0748 gb/s` Crucial P510 CrystalDiskMark) match [README.md](../../README.md#L692-L699). **Issue:** `b02.ts:19` tags `evidence: ["MECHANISM", "MANUFACTURER SPEC"]`, but the numbers displayed in `memtiers.js` are **published third-party benchmark observations** (not manufacturer peak specs), and `'SYNTHETIC DEMO'` is omitted despite the composite `96 GB / ~46 GB / 1 TB` machine and illustrative `log2`/`sqrt`/`cbrt` scaling. (Note also that handoff §3 B02 V3 asks for an interactive source switch so peak specs, third-party microbenchmarks, and speaker measurements are not mixed on one scale.)
- **controls:** Inherited from `04-memtiers.ts`: `ram` (`ddr3|ddr4|ddr5`, `memtiers.js:228`) updates `lblBw.ram`, pipe thickness/speed, and readout; `access` (`seq|rnd`, `memtiers.js:229`) updates `lblBw.nvme`, pipe thickness/speed, packet size/count, and readout.
- **open question (§7):** Bullet 3 / README (speaker's own `STREAM`, CUDA `bandwidthTest`, and `fio` measurements).

### `b03` — `moe-store` ([b03.ts](../../src/slides/route/b03.ts) · [moe-store.js](../../src/scenes/builders/moe-store.js))
- **verdict:** `ok`
- **caption:** Follows ladder in 2 sentences (router sends each token to a few blocks → `mixture-of-experts`, `35B-A3B` → `All experts still have to be stored`).
- **accuracy:** No contradictions. `toy: 4 layers × 8 experts` is labeled in 3D (`moe-store.js:230`); untouched experts remain visible mid-grey with outlines; `35B total` / `~3B active` match Qwen3.6-35B-A3B model card framing; `dense` mode lights all FFN slabs and switches active/touched gauges accordingly (`moe-store.js:424-425,436-437`).
- **controls:** `mode` (`dense|moe`, `moe-store.js:473`) switches architecture, gauges, labels, and readout; `batch` (`1|4|16`, `moe-store.js:476`) changes tokens in flight, touched-expert union gauge, and readout.
- **open question (§7):** Confirm exact model-card counts (`b03.ts:44`; Qwen3.6-35B-A3B uses 256 total experts in production vs 4×8 toy).

### `b04` — `moe-offload` ([b04.ts](../../src/slides/route/b04.ts) · [moe-offload.js](../../src/scenes/builders/moe-offload.js))
- **verdict:** `ok`
- **caption:** Follows ladder in 2 sentences (experts in system RAM → `llama.cpp`, `hot experts` cache → pays trip over slower link unless cached).
- **accuracy:** Accurately models `attention`/`router`/`shared expert` resident on GPU, 8 experts in `cpu ram experts` (host slab stays resident with a device-copy dot when cached), and llama.cpp `moe-cache` policy (`cpu` vs `copy` on full-cache miss, filling empty slots first, `0` slots disabling retention). Explicit synthetic disclaimer and no `tok/s` or `GiB` claims.
- **controls:** `place` (`cpu|copy`, `moe-offload.js:374`) switches activation round-trip vs expert upload on miss, resets pass, and updates readout (`expert copies` vs `activation trips`); `cache` (`0|2|4`, `moe-offload.js:377`) changes GPU hot-slot cages, resets pass, and updates hits/misses/copies/trips.
- **open question (§7):** Bullet 4 (`b04.ts:32`: speaker's actual `--cpu-moe` / `-ot` settings and `--moe-cache-mib` size).

### `b05` — `formats` ([b05.ts](../../src/slides/route/b05.ts) · [formats.js](../../src/scenes/builders/formats.js))
- **verdict:** `fix`
- **caption:** Follows ladder in 2 sentences (containers → `GGUF`, `safetensors`, `weight tensors`, `quantized` → `not because of the extension`).
- **accuracy:** Bit-per-weight figures match GGUF/NVIDIA specs (`Q8_0` 8.5, `Q4_K_M` ~4.8 example, `INT4 g128` 4.125, `NVFP4` 4.5 excluding global scale). **Issues:** (1) `formats.js:36` renders the `llama.cpp` slab `dark` (`0x222222`) and `vLLM` / `SGLang` `mid` (`0x666666`) permanently regardless of `scheme`/`fp4`, implying `llama.cpp` is active even when showing `safetensors` / `NVFP4`; (2) `formats.js:61` uses `'b/w'` (`gguf ~4.8 b/w`, `fp16 ... 16 b/w`), which ambiguously reads as bandwidth rather than `bpw` or `bits/wt`; (3) `formats.js:50` snaps the 64 toy cubes with the same uniform 7-level rounding whether `fp4` is `true` or `false`, whereas `b05.ts:16` warns not to imply the two 4-bit reconstructions are identical.
- **controls:** `scheme` (`fp16|q8|q4`, `formats.js:66`) updates crate widths, scheme labels, cube heights, and readout; `fp4` (`boolean`, `formats.js:67`) updates the `safetensors` crate width (`4.125` vs `4.5`), `NVFP4` label/status, and readout (does not change cube snapping).
- **open question (§7):** Per-model/version engine support and actual mixed-precision tensor mixes (`b05.ts:17`).

### `c01` — `quant-matrix` ([c01.ts](../../src/slides/route/c01.ts) · [quant-matrix.js](../../src/scenes/builders/quant-matrix.js))
- **verdict:** `ok`
- **caption:** Follows ladder in 2 sentences (allowed levels × shared scale → `Quantizing`, `W·h` → quality tradeoff).
- **accuracy:** Exact deterministic toy arithmetic matching handoff §4.1 (`W[0..1]` match §4.1; `q = clip(round(w/scale), -8, 7)` for 4-bit; `y = W·h` and `yq = Wq·h` computed directly in `quant-matrix.js:43-46`). Labels explicitly state `toy int${bits} [...] × scale` and `not nvfp4` (`quant-matrix.js:55,57`). Minor: `|error|` bars use scale factor `5` vs `1.55` for `W, h, y` (`quant-matrix.js:72`) without a `×3.2` scale note on the bar, though exact numeric error is in the readout.
- **controls:** `bits` (`8|4|3|2`, `quant-matrix.js:80`), `group` (`tensor|row`, `quant-matrix.js:81`), and `input` (`1|2`, `quant-matrix.js:82`) all call `recompute()` and update bars, level lines, `codeLabel`, and readout.
- **open question (§7):** None.

### `c02` — `quant` ([c02.ts](../../src/slides/route/c02.ts) · [10-quant.ts](../../src/slides/scene-lab/10-quant.ts) · [quant.js](../../src/scenes/builders/quant.js))
- **verdict:** `fix`
- **caption:** Follows ladder in 2 sentences (blocks share a stored scale → `INT4`, `NVFP4 (E2M1)` → independence caveat).
- **accuracy:** E2M1 magnitudes (`[0, 0.5, 1, 1.5, 2, 3, 4, 6]/6`) and block metadata arithmetic (`4.25` for INT4 g128 with scale+zero, `4.5` for NVFP4 4+8/16) are accurate. **Bug:** `c02.ts` inherits `controls` from `10-quant.ts:20`, where the `weights` dial options are labeled `'int4 w4a16'` and `'nvfp4 w4a4'`. Clicking `'nvfp4 w4a4'` on `weights` leaves `acts` at `'fp16'` (`quant.js:273`), producing a contradictory state (button `'nvfp4 w4a4'` lit while activations column stays 16-bit and readout reports `activations 16`) and conflating weight precision with activation precision.
- **controls:** `weights` (`fp16|int4|nvfp4`, `quant.js:273`), `acts` (`fp16|fp8|fp4`, `quant.js:274`), `kv` (`fp16|fp8|nvfp4`, `quant.js:275`) each independently update their 3D tensor, error caps/plate thickness, bits bar, and readout.
- **open question (§7):** Which real Qwen3.8 tensors stayed BF16 in AutoRound (`c02.ts:22`).

### `c03` — `autoround` ([c03.ts](../../src/slides/route/c03.ts) · [autoround.js](../../src/scenes/builders/autoround.js))
- **verdict:** `fix`
- **caption:** Follows ladder in 2 sentences (nudges rounding on sample inputs → `AutoRound`, `calibration` → test unseen inputs + keep sensitive layers higher precision).
- **accuracy:** Straight-through rounding optimization on `cal`, separate evaluation on `held`, and selective BF16 layer (`(3×4 + 16)/4 = 7` bits/wt) are mathematically consistent. **Issue:** `c03.ts:17` tags `evidence: ['MECHANISM', 'SYNTHETIC DEMO', 'MEASURED ON SPEAKER SYSTEM']`, contradicting `c03.ts:20` (`recipe evidence is not a performance measurement`) — nothing in `autoround.js` is measured on the speaker's system.
- **controls:** `method` (`nearest|autoround`, `autoround.js:87`) toggles optimization animation and calibration/held-out error bars/readout; `keep` (`boolean`, `autoround.js:88`) excludes layer 1 from quantization, toggles outline box, updates footprint bar (`4` vs `7` bits) and readout.
- **open question (§7):** Whether to overlay real Qwen3.8 AutoRound recipe exceptions/evals (`c03.ts:20`).

### `c04` — `decode-pass` ([c04.ts](../../src/slides/route/c04.ts) · [15-decode-pass.ts](../../src/slides/scene-lab/15-decode-pass.ts) · [decode-pass.js](../../src/scenes/builders/decode-pass.js))
- **verdict:** `ok`
- **caption:** Follows ladder in 2 sentences (token climbs layers → `VRAM`, `keys and values` → `Nothing is re-downloaded from disk per token`). Minor: in `hybrid` mode, 4 of 6 layers update fixed recurrent state rather than reading K/V (covered by the 3D scene and readout).
- **accuracy:** Weights sit resident on the back slab and stream to cores per token (`decode-pass.js:13-15`). `hybrid` mode (`c04.ts:18-22`, `decode-pass.js:57-59`) draws 2 full-attention KV layers (`l=1, 5`) and 4 Gated DeltaNet fixed-state layers (`3:1` spacing, matching Qwen3.8-27B dense hybrid architecture) with all 8 FFN tiles active.
- **controls:** `arch` (`dense|moe|hybrid`, `decode-pass.js:401`) switches FFN tile streaming (`8/8` vs `2/8`), full-attention KV rows vs DeltaNet recurrent state plates, and readout.
- **open question (§7):** None.

### `c05` — `nokv` ([c05.ts](../../src/slides/route/c05.ts) · [07-nokv.ts](../../src/slides/scene-lab/07-nokv.ts) · [nokv.js](../../src/scenes/builders/nokv.js))
- **verdict:** `ok`
- **caption:** Follows ladder in 2 sentences (re-runs conversation vs keeps keys/values → `KV cache` → `grows polynomially, not exponentially`).
- **accuracy:** Matches handoff §4.3: counts token positions executed (`Σ(P+j)` vs `P + T`), explicitly includes the `k/v read` meter and pulses stored K/V cubes behind the plates so cached decode visibly still reads past K/V.
- **controls:** `prompt` (`4|16`, `nokv.js:287`) resets simulation with `4` or `16` prompt tokens (`10` or `6` generated tokens), updating grids, meters, and readout.
- **open question (§7):** None.

### `d01` — `prefill` ([d01.ts](../../src/slides/route/d01.ts) · [prefill.ts](../../src/slides/talk/prefill.ts) · [prefill.js](../../src/scenes/builders/prefill.js))
- **verdict:** `ok`
- **caption:** Follows ladder in 2 sentences (many positions per weight read vs one token per read → `prefill`, `decode` → `same weights, very different work per byte`). Minor: adding `at batch 1` avoids implying decode is always 1 token per read.
- **accuracy:** No contradictions; weights read meter advances `×1` for prefill (`N` tiles) and `+1` per generated token, while compute meter distinguishes wide matmul vs single-token pass.
- **controls:** Inherited from `prefill.ts`: `N` (`4|16|64`, `prefill.js:187`) updates prompt row width, KV tray count, and readout; `restart` (`1`, `prefill.js:186`) resets cycle to prefill.
- **open question (§7):** None.

### `d02` — `roofline` ([d02.ts](../../src/slides/route/d02.ts) · [01-roofline.ts](../../src/slides/scene-lab/01-roofline.ts) · [roofline.js](../../src/scenes/builders/roofline.js))
- **verdict:** `fix`
- **caption:** Follows ladder in 2 sentences (arithmetic vs memory traffic → `roofline` → `ceilings are rated peaks, not tokens per second`).
- **accuracy:** Log2 arithmetic-intensity plot (`min(peak, BW × I)`), idealized weight-only intensity (`B` for decode, capped `512` chunk for prefill, `4×` shift for 4-bit) match handoff §4.4 and `d02.ts` notes.
- **controls:** `batch` (`1|8|64`, `roofline.js:232`), `prompt` (`128|2048`, `roofline.js:233`), `weights` (`fp16|4-bit`, `roofline.js:234`) all move markers, ramp byte-flow, and readout (`decode @... · prefill @...`). **Bug:** `roofline.js:232-234` unconditionally set `playing = false` whenever `batch`/`prompt`/`weights` actions fire; because `SceneLayout.tsx:58-61` primes all controls with their `initial` values on mount, the auto-tour immediately pauses on load and never plays unless manually clicked.
- **open question (§7):** Bullet 6 (paired performance/memory metrics).

### `d03` — `prefix-match` ([d03.ts](../../src/slides/route/d03.ts) · [prefix-match.js](../../src/scenes/builders/prefix-match.js))
- **verdict:** `ok`
- **caption:** Follows ladder in 2 sentences (starts with same tokens → `prefix caching` → `One early change ends the match`).
- **accuracy:** Block size 4 (`toy block = 4 tokens`, `vLLM default larger` labeled in 3D, `prefix-match.js:26-27`). Divergence at token 3 (`floor(3/4) = 0`) invalidates all 4 blocks (`0 cached · 16 recomputed · stored blocks 9`), divergence at token 9 (`floor(9/4) = 2`) reuses 2 full blocks (`8 cached · 8 recomputed · stored blocks 7`), and `evict` drops shared blocks (`12 stored`). Matches vLLM full-block hash-chain behavior.
- **controls:** `change` (`-1|3|9`, `prefix-match.js:84`) moves `date changed` marker + hatch, updates reused blocks and readout; `evict` (`boolean`, `prefix-match.js:85`) drops shared blocks, restores private blocks, and appends `· evicted` to readout.
- **open question (§7):** Verify `cache_salt` tenant-isolation behavior on pinned vLLM version (`d03.ts:12`).

### `d04` — `prefix-share` ([d04.ts](../../src/slides/route/d04.ts) · [06-prefix-share.ts](../../src/slides/scene-lab/06-prefix-share.ts) · [prefix-share.js](../../src/scenes/builders/prefix-share.js))
- **verdict:** `ok`
- **caption:** Follows ladder in 2 sentences (`vLLM hashes KV blocks`, `SGLang keeps a radix tree`, `llama.cpp keeps per-slot state` → `A change early in the prompt stops reuse in all three`).
- **accuracy:** Accurately contrasts vLLM hash-chained full blocks + refcount ticks + partial-block outline, SGLang compressed radix trunk + fork node + branches, and llama.cpp independent per-slot copies. `50k` is explicitly tagged `(illustrative)` in the readout (`prefix-share.js:334,337`) and `06-prefix-share.ts:30` documents the exaggerated divergence marker position (~24% vs 1%).
- **controls:** Inherited from `06-prefix-share.ts`: `mode` (`vllm|sglang|llamacpp`, `prefix-share.js:351`) switches data structure geometry and readout; `diverge` (`boolean`, `prefix-share.js:352`) moves sharing boundary to `DIVX`, shows `token 500` marker and partial block, and updates readout.
- **open question (§7):** Hybrid Mamba/sliding-window checkpoint boundaries not drawn (`d04.ts:22`).

### `d05` — `agent-eviction` ([d05.ts](../../src/slides/route/d05.ts) · [14-agent-eviction.ts](../../src/slides/scene-lab/14-agent-eviction.ts) · [agent-eviction.js](../../src/scenes/builders/agent-eviction.js))
- **verdict:** `ok`
- **caption:** Follows ladder in 2 sentences (histories compete for KV room → `evicted`, `prefill` → `pays the full prefill again`).
- **accuracy:** Pool capacity `30` (`fp8`) vs `49` (`nvfp4`) echoes the speaker's `741,032 → 1,225,765` token pool observation (`~1.65×`, `d05.ts:23`) while displaying only synthetic `blk` counts (`30/30 blk`, `44/49 blk`) and relative TTFT bars (`no ms`, `no GiB`).
- **controls:** Inherited from `14-agent-eviction.ts`: `agents` (`1|4|8|24`, `agent-eviction.js:299`) calls `warm()`, updates active agents, eviction pressure, TTFT bars/peaks, and readout; `dtype` (`fp8|nvfp4`, `agent-eviction.js:302`) updates block widths, `cap()`, calls `evict()`, and updates readout.
- **open question (§7):** Bullet 6 (paired concurrency/TTFT/cache-dtype metrics).

### `e01` — `spec` ([e01.ts](../../src/slides/route/e01.ts) · [pixel-viz.js](../../src/scenes/pixel-viz.js#L178-L288) · [SceneLayout.tsx](../../src/layouts/SceneLayout.tsx#L27-L28))
- **verdict:** `ok`
- **caption:** Follows ladder in 2 sentences (guesses tokens, checked in one pass → `speculative decoding` → `With sampling, the check is min(1, p/q), not string matching`). Minor: `p` and `q` are not defined in the caption body (`p` = target, `q` = draft in Leviathan et al.; note `pixel-viz.js:204` has an inverted internal comment `p (draft) / q (target)` though its math computes `pp / qq` scaled by `p`).
- **accuracy:** Greedy vs distribution-preserving sampling (`bar` height `min(1, p/q)` vs uniform draw `mark`), rejected descendants dropped, target bonus token emitted. (`e01.ts:27` notes V3 draft-cost / net-regression mode is not built.)
- **controls:** `K` (`3|5|7`, `pixel-viz.js:283`), `p` (`0.5|0.7|0.9`, `pixel-viz.js:284`), and `mode` (`greedy|sampling`, `pixel-viz.js:285`) all reset and update draft cubes, acceptance sampling bars, and readout (`SceneLayout.tsx:28`).
- **open question (§7):** None blocking (`V3` draft-cost mode noted in `e01.ts:27`).

### `e02` — `drafters` ([e02.ts](../../src/slides/route/e02.ts) · [09-drafters.ts](../../src/slides/scene-lab/09-drafters.ts) · [drafters.js](../../src/scenes/builders/drafters.js))
- **verdict:** `ok`
- **caption:** Follows ladder in 2 sentences (`MTP heads` inside target vs `EAGLE-3` separate drafter → `Both guess one step at a time, checked by the same verifier`). Minor: specifying *chained* MTP heads (layout varies by model) aligns even closer with handoff §3 E02 Accuracy.
- **accuracy:** Accurately separates in-target chained MTP heads (`bus` + `heads` + `chain`) from detached EAGLE-3 tower (`tower` + `eagleFeed` + `stepLink` + optional `tree branch`). Readout marks `target passes 1 (illustrative)`.
- **controls:** `drafter` (`mtp|eagle`, `drafters.js:370`) and `k` (`4|8`, `drafters.js:371`) switch drafter geometry, slot count, and readout (`4`/`8 chained head steps` vs `draft tower steps`).
- **open question (§7):** None.

### `e03` — `drafters` ([e03.ts](../../src/slides/route/e03.ts) · [09-drafters.ts](../../src/slides/scene-lab/09-drafters.ts) · [drafters.js](../../src/scenes/builders/drafters.js))
- **verdict:** `ok`
- **caption:** Follows ladder in 2 sentences (`DFlash`, `DSpark`, `DFlash2` → `three different computations`).
- **accuracy:** Correctly distinguishes DFlash (one parallel block slab), DSpark (`markov` neighbor links + per-slot `confidence` bars + greyed suffix), and DFlash2 (`local conv` window + `selector` candidate paths + `experimental` label, `drafters.js:331-355`). Verifier still checks the full block in `dspark` (no fake adaptive truncation without runtime support).
- **controls:** `drafter` (`dflash|dspark|dflash2`, `drafters.js:370`) and `k` (`4|8`, `drafters.js:371`) switch computation geometry, `experimental` tag, slot count, and readout.
- **open question (§7):** Runtime adaptive-verification support (tagged `OPEN / VERSION-DEPENDENT`).

### `e04` — `drafter-vram` ([e04.ts](../../src/slides/route/e04.ts) · [02-drafter-vram.ts](../../src/slides/scene-lab/02-drafter-vram.ts) · [drafter-vram.js](../../src/scenes/builders/drafter-vram.js))
- **verdict:** `ok`
- **caption:** Follows ladder in 2 sentences (lives in same VRAM → `KV cache` → `can cost cache room that other agents needed`).
- **accuracy:** MTP grows target weights slightly (`wt: 3.40 → 3.85`, `d: 0.50`) while EAGLE-3 and DFlash add larger separate bands (`d: 1.60`, `2.50`), evicting KV rows (`120 → 96 → 72 → 48` blocks). Readout shows pass count reductions (`target passes 12 → ...`) without claiming `tok/s` or `GiB`.
- **controls:** Inherited from `02-drafter-vram.ts`: `mode` (`target-only|mtp|eagle3|dflash`, `drafter-vram.js:277`) and `accept` (`low|high`, `drafter-vram.js:280`) recompute `schedule()`, VRAM bands, KV blocks, pass slabs, and readout.
- **open question (§7):** Bullet 6 (`e04.ts:22`: paired drafter on/off memory + TTFT from speaker's vLLM).

### `e05` — `drafter-train` ([e05.ts](../../src/slides/route/e05.ts) · [drafter-train.js](../../src/scenes/builders/drafter-train.js))
- **verdict:** `fix`
- **caption:** Follows ladder in 2 sentences (DSpark trained on outputs/hidden states → `served acceptance barely moved`).
- **accuracy:** Three factual contradictions against `handoff §1 ch.04:140-144`, `§6:675-679`, and [README.md](../../README.md#L355-L361):
  1. `drafter-train.js:30`: `label('direct in #72', xs[4], -1.35, 0.23)` under `'convert / check'` directly contradicts `README.md:360` ("the raw checkpoint could not initially load into vLLM without format/config conversion") and `e05.ts:12` ("The conversion attempt was abandoned for this checkpoint").
  2. `drafter-train.js:46-47`: maps `'51'` → `'RoPE mismatch'` and `'60'` → `'training recipe'`, whereas `README.md:357-358` and `handoff:675-676` document the RoPE `partial_rotary_factor` mismatch in **`#59`** (while `#51` was initial Qwen3.6-27B DSpark planning) and **`#60`** as the methodology/eval correction.
  3. `drafter-train.js:56`: `'215,154 rows · 1.617'` prints an unverified exact count (`215,154`), whereas both `handoff:144` and `README.md:361` state `'215K-row'` / `'215k-row'`.
- **controls:** `mode` (`teacher|free`, `drafter-train.js:82`) switches conditioning links, X marks, slot colors, and readout (`6 of 6 toy slots` vs `2 of 6 toy slots`); `stage` (`pipeline|results`, `drafter-train.js:83`) toggles issue topics, metric labels, timeline tick shading, and readout.
- **open question (§7):** Bullet 7 (which custom DSpark checkpoint, recipe, and serving result the speaker wants on stage).

### `e06` — `release-bundle` ([e06.ts](../../src/slides/route/e06.ts) · [13-release-bundle.ts](../../src/slides/scene-lab/13-release-bundle.ts) · [release-bundle.js](../../src/scenes/builders/release-bundle.js))
- **verdict:** `ok`
- **caption:** Follows ladder in 2 sentences (`Muse Glimmer 30B`, `Laguna 2.1`, `DFlash` → `separate download, and not every engine can run it`).
- **accuracy:** Matches companion releases (`meta-models/Muse-Glimmer-30B-assistant`, `poolside/Laguna-S-2.1-DFlash`, `poolside/Laguna-XS-2.1-DFlash`). Native MTP defaults off (`no mtp` ghost outline) and toggling `mtp` appends `'mtp shown · illustrative'` in readout (`release-bundle.js:333`).
- **controls:** Inherited from `13-release-bundle.ts`: `release` (`muse|laguna-s|laguna-xs`, `release-bundle.js:343`), `companion` (`boolean`, `release-bundle.js:344`), and `mtp` (`boolean`, `release-bundle.js:345`) all update 3D artifacts, labels, and readout.
- **open question (§7):** Verify exact runtime support/version for Laguna 2.1 DFlash before any live demo.

### `f01` — `engine-map` ([f01.ts](../../src/slides/route/f01.ts) · [engine-map.js](../../src/scenes/builders/engine-map.js))
- **verdict:** `ok`
- **caption:** Follows ladder in 2 sentences (tuned for one GPU/model family → `support may simply not exist`).
- **accuracy:** Documented cells match `f01.ts:23` sources (including `vllm-metal` Apple Metal plugin and SGLang CPU backend, verified against upstream docs). Pillars are uniform height (`0.85` documented, `0.35` outline speaker report), explicitly not encoding speed; empty cells are labeled `empty: no source` (`engine-map.js:61`).
- **controls:** `engine` (`all|llamacpp|vllm|sglang|ninfer|radiance|pennyroyal`, `engine-map.js:94`) dims inactive columns, shows `scopesLabels[c]`, and updates readout; `unknown` (`boolean`, `engine-map.js:95`) toggles the unverified `Radiance`/`R9700` outline and readout.
- **open question (§7):** Bullet 8 (NInfer/Pennyroyal benchmark conditions; coworker permission & specs for Radeon R9700 Radiance).

### `f02` — `engram` ([f02.ts](../../src/slides/route/f02.ts) · [03-engram.ts](../../src/slides/scene-lab/03-engram.ts) · [engram.js](../../src/scenes/builders/engram.js))
- **verdict:** `ok`
- **caption:** Follows ladder in 2 sentences (hash of recent tokens picks rows → `DeepSeek's Engram` → `static weights, not KV cache, not RAG, not experts`).
- **accuracy:** Static table loads once at startup (`startup < 1`, never replayed); lookups run per newly computed position in `prefill` and `decode`; in `cache` mode (`cached = 8`), cached prefix positions are not recomputed while suffix windows still read cached token IDs across the boundary (`engram.js:270`).
- **controls:** Inherited from `03-engram.ts`: `mode` (`prefill|decode|cache`, `engram.js:366`), `ngram` (`2|3`, `engram.js:367`), and `collision` (`boolean`, `engram.js:368`) all update visuals, lookup/collision counts, and readout.
- **open question (§7):** None.

### `f03` — `ssd-access` ([f03.ts](../../src/slides/route/f03.ts) · [05-ssd-access.ts](../../src/slides/scene-lab/05-ssd-access.ts) · [ssd-access.js](../../src/scenes/builders/ssd-access.js))
- **verdict:** `fix`
- **caption:** 2 sentences (`Pennyroyal`, `Qwen3.8-Flash-Next`, `~47.68 GiB`, `PLE`, `NVMe`). Minor inaccuracy at `f03.ts:14`: `'The rest of the model stays on the GPU.'` oversimplifies host RAM staging/HiCache (`home-k8s #135`); `'Hot weights and KV stay on the GPU'` is cleaner.
- **accuracy:** **Issue:** `f03.ts:19` sets `evidence: ["MECHANISM", "MEASURED ON SPEAKER SYSTEM"]` without `"SYNTHETIC DEMO"`, and without distinguishing sources: `~47.68 GiB` comes from `home-k8s #135`, whereas the CrystalDiskMark rates in the `ssd-access.js:313-314` readout (`p510 seq1m q8t1 10.97 gb/s`, `p510 rnd4k q1t1 74.75 mb/s`) are from a **third-party 1 TB Crucial P510 review unit** ([README.md](../../README.md#L699)), *not* measured on the speaker's system (nor do they measure the actual Pennyroyal PLE workload).
- **controls:** Inherited from `05-ssd-access.ts`: `mode` (`sparse|dense`, `ssd-access.js:320`), `prefetch` (`boolean`, `ssd-access.js:321`), and `hit` (`0|50|90`, `ssd-access.js:322`) all update packet hops, staging occupancy, stall blink, and readout.
- **open question (§7):** Bullet 8 (Pennyroyal revision/measurements).

### `f04` — `ngram-timeline` ([f04.ts](../../src/slides/route/f04.ts) · [ngram-timeline.js](../../src/scenes/builders/ngram-timeline.js))
- **verdict:** `ok`
- **caption:** Follows ladder in 2 sentences (`learned n-gram lookup memory` → `Same family of idea, not the same code`).
- **accuracy:** Matches primary cards/papers: Jan 2026 Engram paper (`arXiv:2601.07372`), Apr 2026 `DeepSeek-V4-Flash` (no Engram documented), Aug 2026 `Qwen3.8-Flash-Next` (~51B PLE), Sep 2026 `DeepSeek-V4.1-Flash` (196B Engram); distinct vertical vs horizontal table ribs avoid implying shared code. Minor: `ngram-timeline.js:33` shortens the timeline labels to `'deepseek v4'` and `'deepseek v4.1'` without `'flash'`, whereas `descriptions` and `f04.ts:29,31` cite the `-Flash` variants.
- **controls:** `focus` (`paper|v4|qwen|v41`, `ngram-timeline.js:84`) moves highlight marker, top `focusLabels`, and readout; `scale` (`boolean`, `ngram-timeline.js:85`) toggles `tables`, `detailObjects`, `sizeLabels`, and `' · sizes hidden'` readout suffix.
- **open question (§7):** Confirm announcement dates vs Hugging Face repo creation dates (`f04.ts:26`).

### `g01` — `collective` ([g01.ts](../../src/slides/route/g01.ts) · [collective.js](../../src/scenes/builders/collective.js))
- **verdict:** `ok`
- **caption:** Follows ladder in 2 sentences (dials OUT to gateway, no home port or VPN → `Requests come back down that same connection`).
- **accuracy:** Public-safe (no keys, hostnames, private catalogs, or credentials). Accurately models independent contributors behind solid firewalls, outbound WSS tubes, inner Yamux streams (`stream 2`), streaming token return, catalog unavailability on disconnect, and no shared VRAM/KV (`no shared vram`).
- **controls:** `drop` (`boolean`, `collective.js:499`) drops contributor B offline, strikes `model b`, shows `unavailable` for B requests, and updates readout; `inbound` (`boolean`, `collective.js:501`) displays blocked inbound arrows at firewall walls and updates readout.
- **open question (§7):** Bullet 10 (confirm approved public-safe Collective topology statements).

---

## Prioritised Fixes

### High priority (factual contradictions / broken interaction)
1. **Fix `#51`/`#59`/`#60`/`#72` misattributions and unverified `215,154` count in `e05`** — [src/scenes/builders/drafter-train.js](../../src/scenes/builders/drafter-train.js)
   - Line `30`: replace `label('direct in #72', xs[4], -1.35, 0.23);` with `label('needs convert (#72)', xs[4], -1.35, 0.23);`
   - Line `47`: replace `const topics = ['proposal', 'RoPE mismatch', 'pipeline review', 'training recipe', 'data sources', 'serve evaluation', 'agentic test'];` with `const topics = ['proposal', 'initial plan', 'RoPE & pipeline', 'eval correction', 'data sources', '546k + convert', 'agentic test'];`
   - Line `56`: replace `'215,154 rows · 1.617'` with `'~215k rows · 1.617'` (matching `handoff:144` and `README.md:361` unless exact count is confirmed from `home-k8s #80`).
2. **Remove `w4a16`/`w4a4` conflation on the weights-only dial in `c02`** — [src/slides/route/c02.ts](../../src/slides/route/c02.ts)
   - Override `controls` from `base[0]` so the `weights` options use `{ label: 'int4', value: 'int4' }` and `{ label: 'nvfp4', value: 'nvfp4' }` instead of `'int4 w4a16'` / `'nvfp4 w4a4'` (`src/slides/scene-lab/10-quant.ts:20`), since `acts` is a separate dial.
3. **Fix `cheap chat` readout contradiction in `a03`** — [src/scenes/builders/profiles.js](../../src/scenes/builders/profiles.js)
   - Line `37`: replace `line: 'cheap chat leans on memory bandwidth · every limit low',` with `line: 'cheap chat leans on memory bandwidth · every other limit low',`
4. **Fix `pipe width` vs `pipe area` math label in `b01`** — [src/scenes/builders/gpu-choice.js](../../src/scenes/builders/gpu-choice.js)
   - Line `246`: replace `const lblPipeNote = makeLabel('pipe width ∝ rated GB/s', 0.31);` with `const lblPipeNote = makeLabel('pipe area ∝ rated GB/s', 0.31);` (or `'pipe width ∝ √(rated GB/s)'`).
5. **Fix mount auto-pause bug in `d02`** — [src/scenes/builders/roofline.js](../../src/scenes/builders/roofline.js)
   - Lines `232–234`: guard each control handler (`if (v !== batch) { playing = false; batch = v; }` etc.) so initial mount priming in `SceneLayout.tsx:58-61` does not freeze the `TOUR` loop.

### Medium priority (evidence mislabeling, caption length, visual ambiguity)
6. **Fix `evidence` tags in `b02`, `c03`, and `f03`**
   - [src/slides/route/b02.ts](../../src/slides/route/b02.ts):19 — replace `evidence: ["MECHANISM", "MANUFACTURER SPEC"],` with `evidence: ["MECHANISM", "SYNTHETIC DEMO"],` (or clarify that the rates in `memtiers.js` are published third-party microbenchmarks, not manufacturer peaks) and note in `simulated` that the machine profile combines separate hardware sources.
   - [src/slides/route/c03.ts](../../src/slides/route/c03.ts):17 — replace `evidence: ['MECHANISM', 'SYNTHETIC DEMO', 'MEASURED ON SPEAKER SYSTEM'],` with `evidence: ['MECHANISM', 'SYNTHETIC DEMO'],`.
   - [src/slides/route/f03.ts](../../src/slides/route/f03.ts):19 — replace `evidence: ["MECHANISM", "MEASURED ON SPEAKER SYSTEM"],` with `evidence: ["MECHANISM", "MEASURED ON SPEAKER SYSTEM", "SYNTHETIC DEMO"],` and append to `simulated` (`f03.ts:20`): `; P510 CrystalDiskMark rates in readout are from a third-party 1 TB review unit, not measured on the speaker's system`.
   - [src/slides/route/f03.ts](../../src/slides/route/f03.ts):14 — replace `The rest of the model stays on the GPU.` with `Hot layers and KV stay on the GPU.`
7. **Fix `formats.js` ambiguity and engine highlighting in `b05`** — [src/scenes/builders/formats.js](../../src/scenes/builders/formats.js)
   - Line `36`: replace `mesh(i === 0 ? dark : mid, ...)` with neutral uniform `mid` (or highlight `llama.cpp` vs `vLLM`/`SGLang` when toggling `fp4`/container focus) so `llama.cpp` does not look uniquely active for `NVFP4`.
   - Line `61`: replace `b/w` with `bpw` (`gguf ~4.8 bpw`, `fp16 · f16 16 · bf16 16 bpw`) so it is not misread as bandwidth.
   - Line `50`: when `index === 2 && fp4`, snap to a non-uniform E2M1 grid rather than the same uniform `7`-level INT4 grid (`b05.ts:16`).
8. **Trim `a03` caption to ≤ 2 sentences** — [src/slides/route/a03.ts](../../src/slides/route/a03.ts)
   - Line `13`: replace `body: 'Every choice in this talk bought something by spending something else. Pick the workload first, then see which limits you actually hit. What are you running?',` with `body: 'Every choice in this talk trades one limit for another. Pick your workload first to see which limits matter — what are you running?',`

### Low priority (minor precision & remaining open work)
9. **Clarify minor wording in `e01`, `e02`, `d01`, `f04`**
   - [src/slides/route/e01.ts](../../src/slides/route/e01.ts):13 — clarify `p/q` (`target/draft ratio min(1, p/q)`).
   - [src/slides/route/e02.ts](../../src/slides/route/e02.ts):14 — note that MTP chaining/layout depends on the target architecture.
   - [src/slides/route/d01.ts](../../src/slides/route/d01.ts):14 — add `at batch 1` (`Replying moves one new token per read at batch 1`).
   - [src/scenes/builders/ngram-timeline.js](../../src/scenes/builders/ngram-timeline.js):33 — change `'deepseek v4'` / `'deepseek v4.1'` to `'deepseek v4 flash'` / `'deepseek v4.1 flash'`.
