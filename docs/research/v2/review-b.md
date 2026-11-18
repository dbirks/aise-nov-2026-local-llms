# Deck v2 independent accuracy + wording review

Scope: `src/slides.ts` (title + section framing lines) and every slide in `src/slides/v2/*.ts`, plus their builders in `src/scenes/builders/*.js` (and `src/scenes/pixel-viz.js` for `spec`), cross-checked against `docs/deck-v2-plan.md`, `AGENTS.md`, `docs/presentation-production-handoff.md`, and `docs/research/v2/*.md`.

---

## Title & Section Framing (`src/slides.ts`)

- **title** (`src/slides.ts:21-27`): verdict `ok`. Wording plain (`"Beyond\n“It Runs”"`). Accuracy: event/talk header only.
- **ch01–ch10** (`src/slides.ts:29-47`): verdict `ok`. Wording: all 10 framing lines read like plain speech, 1–2 sentences each, no banned filler. Accuracy: no unverified numbers.

---

## Per-slide review

### 00 Opening

- **open** (`src/slides/v2/open.ts:5-12`): verdict `ok` | wording: plain, 2 fragments/lines | accuracy: ok | controls: none.

### 01 Why bother?

- **why-objection** (`src/slides/v2/why-objection.ts:5-12`): verdict `ok` | wording: plain, 2 short sentences | accuracy: ok | controls: none.
- **why-good-enough** (`src/slides/v2/why-good-enough.ts:5-12`): verdict `ok` | wording: plain, 2 sentences | accuracy: speaker observation labelled in `notes` | controls: none.
- **why-cost** (`src/slides/v2/why-cost.ts:5-12`): verdict `fix` | wording: plain, 2 sentences | accuracy: `"My take: today’s prices are heavily subsidised, and that won’t last forever."` (`src/slides/v2/why-cost.ts:10`) — `"My take:"` marks it as opinion per `docs/deck-v2-plan.md:121-123`, but `docs/research/v2/setup.md:33-34, 52` says `"Do not state that providers sell tokens below cost, that prices will rise, or that a correction is coming"` and `"the forecast lives in the speaker's words"`. Drop `"and that won’t last forever"` from the slide text so the forecast stays spoken | controls: none.
- **why-independence** (`src/slides/v2/why-independence.ts:5-12`): verdict `ok` | wording: plain, 3 short sentences across 2 list items (strictly > 2 sentences if counting bullets together) | accuracy: provider-neutral capability statement, matches `setup.md:119-120` | controls: none.
- **why-fun** (`src/slides/v2/why-fun.ts:5-12`): verdict `ok` | wording: plain, 3 short sentences across 2 list items | accuracy: ok | controls: none.

### 02 What we mean by inference

- **train-vs-infer-a** (`src/slides/v2/train-vs-infer.ts:6-16`, `src/slides/route/a02.ts`, `src/scenes/builders/weights-fixed.js`): verdict `ok` | wording: plain, 2 sentences | accuracy: readout in inference mode (`weights-fixed.js:327`, `` `inference · prompt ${prompt} · weight updates ${updates} · loaded from ${fmt} into ${ENG_RO[fmt]}` ``) omits `simulated`/`toy` (training line 326 says `36 toy values`), minor; `ENG_OF` maps `gguf` -> `llama.cpp` and `safetensors` -> `vLLM / SGLang` | controls: `mode`, `artifact` both handled (`weights-fixed.js:340-349`).
- **train-vs-infer-b** (`src/slides/v2/train-vs-infer.b.ts:5-37`, `src/scenes/builders/train-write.js`): verdict `ok` | wording: plain, 2 sentences | accuracy: readout (`train-write.js:317-319`) prefixed `simulated ·`; labels `text batch`/`prompt`, `output`/`next token`, `loss`, `backward`, `read only` match mechanism | controls: `mode` (`train`/`infer`) handled (`train-write.js:326`).
- **engines** (`src/slides/v2/engines.ts:5-12`): verdict `ok` | wording: plain, 4 short sentences across 2 list items | accuracy: matches `setup.md:180-213` | controls: none.

### 03 My setup

- **setup-why** (`src/slides/v2/setup-why.ts:5-12`): verdict `ok` | wording: plain, 2 sentences | accuracy: speaker observation; open question to confirm `"June"` in `notes` | controls: none.
- **setup-egpu-a** (`src/slides/v2/setup-egpu.ts:5-25`, `src/scenes/builders/egpu-box.js`): verdict `ok` | wording: plain, 2 sentences | accuracy: readout (`egpu-box.js:223-225`) starts with `speaker setup ·`; labels `work laptop`, `Thunderbolt 4`, `eGPU enclosure`, `data stays here`, `internet` match `setup.md:257-260` | controls: `boundary` handled (`egpu-box.js:232`).
- **setup-egpu-b** (`src/slides/v2/setup-egpu.b.ts:5-40`, `src/scenes/builders/egpu-pipes.js`): verdict `ok` | wording: plain, 2 sentences | accuracy: `32 Gb/s (~4 GB/s max)` (TB4), `64 Gb/s (~8 GB/s max)` (TB5), `1,792 GB/s (RTX 5090 spec)`, `area ∝ √(GB/s)` / `manufacturer spec`, `weights cross once`, readout (`egpu-pipes.js:340-342`) starts with `spec sheets ·`; matches `setup.md:260, 268, 272, 286` | controls: `link` handled (`egpu-pipes.js:351`).
- **setup-slow-link-a** (`src/slides/v2/setup-slow-link.ts:5-35`, `src/scenes/builders/link-once.js`): verdict `ok` | wording: plain, 2 sentences | accuracy: readout (`link-once.js:280-282`) separates `speaker · load: ~20 GB once, about 20 s` and `mechanism · decode: tokens cross, weights + kv stay on gpu`; labels `laptop / SSD`, `weights ~20 GB`, `~20 s`, `token ids cross` match `setup.md:333-349` | controls: `phase` handled (`link-once.js:287`).
- **setup-slow-link-b** (`src/slides/v2/setup-slow-link.b.ts:5-35`, `src/scenes/builders/link-traffic.js`): verdict `fix` | wording: plain, 2 sentences | accuracy: `link-traffic.js:146-148` creates `subLeft` (`weights cross once` / `vocab 150k × 4B`) and `subRight` (`no decode reads` / `~33,300× inside GPU`) but never adds them to `scene` (`scene.add(cableTopLabel.sprite, gpuTopLabel.sprite)` omits `subLeft.sprite, subRight.sprite`). Also `link-traffic.js:166, 213` prints `~0.6 MB / token` (`~0.6 MB over the cable`) without stating on-screen that `0.6 MB` is the optional full-logits case (default sampled-id return is a few bytes per `setup.md:357-361`) | controls: `phase` handled (`link-traffic.js:220`).
- **setup-hardware-a** (`src/slides/v2/setup-hardware.ts:6-16`, `src/slides/route/b01.ts`, `src/scenes/builders/gpu-choice.js`): verdict `ok` | wording: plain, 2 sentences | accuracy: `RTX 5090 · 32 GB`, `1,792 GB/s rated`, `DGX Spark · 128 GB`, `273 GB/s rated`, `load once ~20 s / speaker observation`, `decode reads stay on the card`; no prices or derived tok/s; matches `setup.md:405-409` | controls: `budget`, `egpu` handled (`gpu-choice.js:433-441`).
- **setup-hardware-b** (`src/slides/v2/setup-hardware.b.ts:5-10`, `src/scenes/builders/mem-quadrant.js`): verdict `fix` | wording: plain, 2 sentences | accuracy: `mem-quadrant.js:7` includes `{ name: 'Ryzen AI Max+ 395', cap: 128, bw: 256, ... }` and `mem-quadrant.js:31` readout for `focus === 'all'` says `'spec sheets · capacity and rated bandwidth · all four'`. Per `setup.md:413-415, 446, 554`, AMD does not publish a GB/s figure and `256 GB/s` is derived (`8000 MT/s × 256 bits ÷ 8`), not a spec-sheet number (`must be marked [derived, not vendor-published]`). Also `Ryzen AI Max+ 395` at `z: -3.8` (`mem-quadrant.js:7`) sits off the floor (`floor` spans `z = [-2.5, +2.3]` at `mem-quadrant.js:16`) | controls: `focus` handled (`mem-quadrant.js:33`).
- **setup-hardware-c** (`src/slides/v2/setup-hardware.c.ts:5-10`, `src/scenes/builders/mem-fill.js`): verdict `fix` | wording: plain, 2 sentences | accuracy: `mem-fill.js:29` readout computes `read once: ${Math.round(size/1792*1000)} ms on 5090` even when `size` is `60` or `110` GB (`> 32` GB, where the 5090 tank shows `"doesn't fit"`). Reporting a 5090 read time for a model that overflows 5090 VRAM is misleading, and `'spec math'` omits that `20 / 60 / 110 GB` are illustrative toy sizes | controls: `model` handled (`mem-fill.js:30`).
- **setup-path** (`src/slides/v2/setup-path.ts:5-12`): verdict `ok` | wording: plain, 3 short sentences across 2 list items | accuracy: speaker observation | controls: none.

### 04 Getting a smart enough model into VRAM

- **gguf** (`src/slides/v2/gguf.ts:5-12`): verdict `ok` | wording: plain, 2 sentences | accuracy: matches `embed-quant.md:58-61` | controls: none.
- **embed-vec-a** (`src/slides/v2/embed-vec.ts:5-13`, `src/scenes/builders/embed-vec.js`): verdict `ok` | wording: plain, 2 sentences; `5,120` verified in `embed-quant.md:119` | accuracy: readout (`embed-vec.js:25`) starts with `simulated ·`; no on-mesh `"toy"` sprite in 3D, though caption + readout state it | controls: `word` handled (`embed-vec.js:25`).
- **embed-vec-b** (`src/slides/v2/embed-vec.b.ts:5-13`, `src/scenes/builders/embed-analogy.js`): verdict `fix` | wording: plain, 2 sentences | accuracy: readout (`embed-analogy.js:18`) says `` `simulated · ${relation} step = [...] · same for every country` `` — `"same for every country"` conflicts with `embed-quant.md:144-160, 184-185` (offset analogies are cherry-picked 2013 word2vec results and do not hold uniformly). Change to `"same in this toy"` | controls: `relation` handled (`embed-analogy.js:18`).
- **embed-vec-c** (`src/slides/v2/embed-vec.c.ts:5-13`, `src/scenes/builders/embed-unroll.js`): verdict `ok` | wording: plain, 2 sentences | accuracy: `toy values`, `5,120 per token (Qwen3.8-27B hidden_size)`, `simulated ·` readout; matches `embed-quant.md:119` | controls: `dims` handled (`embed-unroll.js:12`).
- **quant-what-a** (`src/slides/v2/quant-what.ts:6-16`, `src/slides/route/c01.ts`, `src/scenes/builders/quant-matrix.js`): verdict `ok` | wording: plain, 2 sentences | accuracy: scene shows `toy int4 [-8,7] × scale` and `not nvfp4`; readout (`quant-matrix.js:75`) omits `simulated`/`toy` prefix (minor) | controls: `bits`, `group`, `input` handled (`quant-matrix.js:81-83`).
- **quant-what-b** (`src/slides/v2/quant-what.b.ts:5-10`, `src/scenes/builders/quant-haze.js`): verdict `ok` | wording: plain, 2 sentences | accuracy: labels `toy vectors; real weights` and `mostly layer matrices` (`quant-haze.js:19`) + `simulated ·` readout (`quant-haze.js:49`); stale `open: 'Research packet pending.'` in `notes` only | controls: `bits` handled (`quant-haze.js:51`).
- **quant-what-c** (`src/slides/v2/quant-what.c.ts:5-13`, `src/scenes/builders/quant-levels.js`): verdict `ok` | wording: plain, 2 sentences | accuracy: labels `toy vectors; real weights` and `mostly layer matrices` (`quant-levels.js:15`) + `simulated ·` readout (`quant-levels.js:35`); stale `open: 'Research packet pending.'` in `notes` only | controls: `bits`, `word` handled (`quant-levels.js:36`).
- **quant-types-a** (`src/slides/v2/quant-types.ts:6-16`, `src/slides/route/c02.ts`, `src/scenes/builders/quant.js`): verdict `ok` | wording: plain, 2 sentences | accuracy: `4.25` (INT4 group-128 with fp16 scale+zero) and `4.5` (NVFP4 E2M1 + fp8 block-16 scale) match format math; readout (`quant.js:264`) omits `simulated` before `w err` (minor) | controls: `weights`, `acts`, `kv` handled (`quant.js:274-276`).
- **quant-types-b** (`src/slides/v2/quant-types.b.ts:5-38`, `src/scenes/builders/quant-dials.js`): verdict `fix` | wording: plain, 2 sentences | accuracy: (1) `quant-dials.js:196` draws `'bf16\n16 dense levels'` — BF16 has **16 bits** (~65k codes), not `16 levels` (unlike `int4\n16 even levels` right next to it); (2) `quant-dials.js:239` draws `'follows weights\n' + f.aBits + ' bits'` under the third dial (`activations`), which directly contradicts the slide title `'Three separate dials'` and body `'Weights, activations and the KV cache each get their own precision'` (`quant-types.b.ts:12-13`, `embed-quant.md:360-366`) | controls: `w`, `kv` handled (`quant-dials.js:287-288`), but there is no `acts` control despite drawing 3 dials.
- **nvfp4-a** (`src/slides/v2/nvfp4.ts:5-37`, `src/scenes/builders/nvfp4-pack.js`): verdict `ok` | wording: plain, 2 sentences | accuracy: 16-value toy block, `S_GLOBAL = 0.001`, `sBlock = 15`, `9 bytes for 16 values` (`4.5 bpw`), MXFP4 `17 bytes for 32 values` (`4.25 bpw`), `E8M0 scale 0.0625`, `collapsedNonZero` all match `nvfp4-autoround.md:40-70`; `simulated ·` readout | controls: `format` handled (`nvfp4-pack.js:469`).
- **nvfp4-b** (`src/slides/v2/nvfp4.b.ts:5-38`, `src/scenes/builders/nvfp4-ruler.js`): verdict `ok` | wording: plain, 2 sentences | accuracy: E2M1 grid + E4M3 `sBlock` matches `nvfp4-autoround.md:40-69`; `simulated ·` readout | controls: `outlier` handled (`nvfp4-ruler.js:266`).
- **autoround-a** (`src/slides/v2/autoround.ts:6-16`, `src/slides/route/c03.ts`, `src/scenes/builders/autoround.js`): verdict `ok` | wording: plain, 2 sentences | accuracy: `autoround.js:82` readout omits `simulated` (minor); `7` bits for 3/4 4-bit + 1/4 16-bit is exact | controls: `method`, `keep` handled (`autoround.js:97-98`).
- **autoround-b** (`src/slides/v2/autoround.b.ts:5-10`, `src/scenes/builders/autoround-balance.js`): verdict `ok` | wording: plain, 2 sentences | accuracy: `W`, `SCALE`, `XS`, `V`, and errors (`+0.240 → +0.040`, `+0.224 → +0.064`, `+0.080 → +0.180`) match `nvfp4-autoround.md:152-165` exactly; `simulated ·` readout | controls: `input` handled (`autoround-balance.js:122`).
- **autoround-c** (`src/slides/v2/autoround.c.ts:5-10`, `src/scenes/builders/autoround-layers.js`): verdict `ok` | wording: plain, 2 sentences | accuracy: `nvfp4 · 20.61 GB`, `w4a16 · 19.47 GB`, `(file listing)` match `nvfp4-autoround.md:201` and `deck-v2-plan.md:313-314`; `toy sizes, not GB` labelled on bar and readout; kept layers match `nvfp4-autoround.md:137` | controls: `recipe` handled (`autoround-layers.js:130`).
- **moe-a** (`src/slides/v2/moe.ts:6-16`, `src/slides/route/b03.ts`, `src/scenes/builders/moe-store.js`): verdict `unsure` | wording: plain, 2 sentences | accuracy: marked `OPTIONAL: needs the speaker’s yes` in `deck-v2-plan.md:207, 297` and `moe.ts:5`; `35B total` / `~3B active` references `Qwen3.6-35B-A3B` (`b03.ts:46`), whose exact `config.json` active/total counts were not re-verified in the v2 packets | controls: `mode`, `batch` handled (`moe-store.js:484-491`).

### 05 Where does the conversation live?

- **kv-cache-a** (`src/slides/v2/kv-cache.ts:6-16`, `src/slides/route/c05.ts`, `src/scenes/builders/nokv.js`): verdict `ok` | wording: plain, 2 sentences | accuracy: `nokv.js:274` readout omits `simulated`/`toy` tag (minor); `k/v read` bar visibly shows cached decode still reads past K/V | controls: `prompt` handled (`nokv.js:287`).
- **kv-cache-b** (`src/slides/v2/kv-cache.b.ts:5-37`, `src/scenes/builders/kv-fill.js`): verdict `ok` | wording: plain, 2 sentences | accuracy: `4 toy layers`, `2 × layers × kv heads × head dim × bytes per token` (`kv-serving.md:26`), `simulated ·` readout | controls: `ctx` handled (`kv-fill.js:292`).
- **kv-cache-c** (`src/slides/v2/kv-cache.c.ts:5-37`, `src/scenes/builders/kv-work.js`): verdict `ok` | wording: plain, 2 sentences (explicitly notes reading the whole cache) | accuracy: `n(n+1)/2 computed`, `n new + cached reads`, `simulated ·` readout | controls: `n` handled (`kv-work.js:224`).

### 06 Several agents, one GPU

- **batching-a** (`src/slides/v2/batching.ts:6-16`, `src/slides/route/d02.ts`, `src/scenes/builders/roofline.js`): verdict `ok` | wording: plain, 2 sentences | accuracy: `roofline.js:225-226` readout omits `simulated`/`illustrative` (minor) | controls: `batch`, `prompt`, `weights` handled (`roofline.js:233-235`).
- **batching-b** (`src/slides/v2/batching.b.ts:6-28`, `src/scenes/builders/batch-read.js`): verdict `ok` | wording: plain, 2 sentences | accuracy: `weights (20 units)`, `until compute or KV reads become the limit` at `b=16`, `simulated ·` readout | controls: `b` handled (`batch-read.js:189`).
- **prefix-cache-a** (`src/slides/v2/prefix-cache.ts:6-16`, `src/slides/route/d03.ts`, `src/scenes/builders/prefix-match.js`): verdict `ok` | wording: plain, 2 sentences | accuracy: `toy block = 4 tokens`, `vLLM default larger` (`prefix-match.js:27-28`); readout (`80`) omits `simulated` (minor) | controls: `change`, `evict` handled (`prefix-match.js:86-87`).
- **prefix-cache-b** (`src/slides/v2/prefix-cache.b.ts:6-29`, `src/scenes/builders/prefix-strips.js`): verdict `fix` | wording: plain, 2 sentences | accuracy: math (`12 + 3·n` vs `15·n`) and `simulated ·` readout ok, **but `prefix-strips.js:42` throws `ReferenceError: x is not defined` (`sp.position.set(x, y, z);` inside `label(text, sx, sy, h)`), so the scene crashes on load** | controls: `share`, `agents` handled (`prefix-strips.js:251-252`).
- **engines-cache-a** (`src/slides/v2/engines-cache.ts:6-16`, `src/slides/route/d04.ts`, `src/scenes/builders/prefix-share.js`): verdict `ok` | wording: plain, 1 sentence | accuracy: `50k (illustrative)` in readout, `each slot: own copy` for llama.cpp | controls: `mode`, `diverge` handled (`prefix-share.js:351-352`).
- **engines-cache-b** (`src/slides/v2/engines-cache.b.ts:5-43`, `src/scenes/builders/cache-three.js`): verdict `fix` | wording: plain, 2 sentences | accuracy: `cache-three.js:203` draws `'toy block 4; real default 16'`, which is stale as of vLLM `v0.34.0` (released 2026-11-16, default flipped `16 → 64`, `kv-serving.md:181, 234`). Also `cache-three.js:393` sets `const r3Arrived = beat >= 1;` instead of `beat >= 2`, triggering R3's partial-block/tree-split visual during R2's beat | controls: `slot` handled (`cache-three.js:456`).
- **engines-cache-c** (`src/slides/v2/engines-cache.c.ts:5-44`, `src/scenes/builders/cache-lens.js`): verdict `fix` | wording: plain, 2 sentences | accuracy: `cache-lens.js:211` draws `'vLLM: hashed blocks · toy block 4; real default 16'`, stale as of vLLM `v0.34.0` (`64`, `kv-serving.md:181, 234`) | controls: `engine` handled (`cache-lens.js:397`).

### 07 Making each token faster

- **spec-decode-a** (`src/slides/v2/spec-decode.ts:6-16`, `src/slides/route/e01.ts`, `src/scenes/pixel-viz.js`): verdict `ok` | wording: plain, 2 sentences | accuracy: `buildSpec` implements `min(1, p/q)` in `sampling` mode (`pixel-viz.js:203-209`); no `readout` emitted by `buildSpec` (minor) | controls: `K`, `p`, `mode` handled (`pixel-viz.js:283-285`).
- **spec-decode-b** (`src/slides/v2/spec-decode.b.ts:5-13`, `src/scenes/builders/spec-tree.js`): verdict `fix` | wording: plain, 2 sentences | accuracy: (1) `spec-decode.b.ts:10` and `spec-tree.js:26, 56` label the branches `'left'` and `'right'`, but the tree in `spec-tree.js:22-24` is laid out **top (`y = +1.08`) vs bottom (`y = -1.08`)**; (2) `spec-tree.js:49` readout prints `'left path'`/`'right path'` even when `draft === 'line'` | controls: `draft`, `accept` handled (`spec-tree.js:55-56`).
- **spec-decode-c** (`src/slides/v2/spec-decode.c.ts:5-13`, `src/scenes/builders/spec-accept.js`): verdict `ok` | wording: plain, 2 sentences | accuracy: `q`, `baseP`, `min(1, p/q)`, residual `norm(max(0, p-q))`, and greedy special case all exact; `toy probabilities` + `simulated ·` readout | controls: `word`, `greedy` handled (`spec-accept.js:59-60`).
- **mtp-a** (`src/slides/v2/mtp.ts:6-16`, `src/slides/route/e02.ts`, `src/scenes/builders/drafters.js`): verdict `ok` | wording: plain, 2 sentences | accuracy: `mtp heads`, `chained head steps`, `(illustrative)` in readout | controls: `drafter`, `k` handled (`drafters.js:375-376`).
- **mtp-b** (`src/slides/v2/mtp.b.ts:4-9`, `src/scenes/builders/mtp-modules.js`): verdict `ok` | wording: plain, 2 sentences | accuracy: `1 mtp module looped`, `shared` output head & embedding, matches `spec.md:66-87` | controls: `steps` handled (`mtp-modules.js:59`).
- **block-drafters-a** (`src/slides/v2/block-drafters.ts:6-16`, `src/slides/route/e03.ts`, `src/scenes/builders/drafters.js`): verdict `ok` | wording: plain, 2 sentences | accuracy: distinguishes `dflash` (`1 draft pass`), `dspark` (`1 draft pass + markov`), `dflash2` (`1 draft pass + selector`, `experimental`), `(illustrative)` in readout | controls: `drafter`, `k` handled (`drafters.js:375-376`).
- **block-drafters-b** (`src/slides/v2/block-drafters.b.ts:4-9`, `src/scenes/builders/block-deps.js`): verdict `ok` | wording: plain, 2 sentences | accuracy: `EAGLE-3` (`6 passes`), `DFlash` (`1 pass`, `bidirectional block`), `DSpark` (`1 + head`, `parallel + head`), `DFlash2` (`1 + selector`, `parallel + selector`, `no paper`, `version-dependent`) match `spec.md:117-145` | controls: `lane` handled (`block-deps.js:60`).
- **shipped-drafters** (`src/slides/v2/shipped-drafters.ts:5-12`): verdict `ok` | wording: plain, 2 sentences | accuracy: names no specific releases, matches `OPEN / VERSION-DEPENDENT` constraint | controls: none.
- **drafter-vram-a** (`src/slides/v2/drafter-vram.ts:6-16`, `src/slides/route/e04.ts`, `src/scenes/builders/drafter-vram.js`): verdict `ok` | wording: plain, 2 sentences | accuracy: readout (`drafter-vram.js:265-267`) omits `simulated` (minor); no GiB units claimed | controls: `mode`, `accept` handled (`drafter-vram.js:282-288`).
- **drafter-vram-b** (`src/slides/v2/drafter-vram.b.ts:5-13`, `src/scenes/builders/drafter-budget.js`): verdict `ok` | wording: plain, 2 sentences | accuracy: `32 toy units` on ceiling, `simulated ·` readout, sliding-window cap shown cleanly | controls: `ctx`, `window` handled (`drafter-budget.js:162-163`).
- **my-drafter-a** (`src/slides/v2/my-drafter.ts:6-16`, `src/slides/route/e05.ts`, `src/scenes/builders/drafter-train.js`): verdict `ok` | wording: plain, 2 sentences | accuracy: `546k rows · 2d16h`, `215,154 rows · 1.617`, `baseline ~1.66` match `spec.md:288-290` | controls: `mode`, `stage` handled (`drafter-train.js:83-84`).
- **my-drafter-b** (`src/slides/v2/my-drafter.b.ts:5-12`, `src/scenes/builders/drafter-funnel.js`): verdict `ok` | wording: plain, 2 sentences | accuracy: `#72` (`~546k rows`, `2 days 16 h`), `#80` (`215,154 rows`, `acceptance 1.617`, `baseline ~1.66`) match `spec.md:288-290`; `speaker run` labelled in readout | controls: `run` handled (`drafter-funnel.js:117`).

### 08 Other things I ran into

- **new-engines-a** (`src/slides/v2/new-engines.ts:6-16`, `src/slides/route/f01.ts`, `src/scenes/builders/engine-map.js`): verdict `ok` | wording: plain, 2 sentences | accuracy: documented cells vs `no source` + `speaker report` (R9700 Radiance) match `new.md` and `f01.ts:23` | controls: `engine`, `unknown` handled (`engine-map.js:95-96`).
- **ngram-tables-a** (`src/slides/v2/ngram-tables.ts:6-16`, `src/slides/route/f02.ts`, `src/scenes/builders/engram.js`): verdict `ok` | wording: plain, 2 sentences | accuracy: `(toy)` in readout, `table resident`, matches `new.md:306-314` | controls: `mode`, `ngram`, `collision` handled (`engram.js:389-394`).
- **ngram-tables-b** (`src/slides/v2/ngram-tables.b.ts:4`, `src/scenes/builders/ngram-compare.js`): verdict `ok` | wording: plain, 2 sentences | accuracy: `DeepSeek V4.1-Flash` (`~196.6B · 2 layers`), `Qwen3.8-Flash-Next` (`51.2B · 20M rows`, `layer 2`), `toy hash · real differs`; readout says `model cards ·` (`196.6B` and `51.2B` are derived from `config.json` counts, cards round to `196B` and `51B` — minor) | controls: `model` handled (`ngram-compare.js:57`).
- **ple-a** (`src/slides/v2/ple.ts:4`, `src/scenes/builders/ple-layers.js`): verdict `fix` | wording: plain, 2 sentences | accuracy: `262,144 rows`, `30 × 256`, `E2B ≈ 2.01B params` match `new.md:383-388`, **but `ple-layers.js:22` draws `'Qwen PLE: n-gram table'` directly beneath `'Gemma: per-layer embeddings'` with no `'≠'` or `'differs'`**, which makes it look like this Gemma diagram also describes Qwen's n-gram table (`new.md:450-453` requires disambiguation) | controls: `where` handled (`ple-layers.js:52`).
- **ple-b** (`src/slides/v2/ple.b.ts:4`, `src/scenes/builders/ple-placement.js`): verdict `fix` | wording: plain, 2 sentences | accuracy: `ple-placement.js:27` draws `'47.68 GiB FP8'` (exact per `new.md:241`), while `ple.b.ts:4` body says `'about 48 GB in FP8'` (mixing binary GiB with decimal GB; 47.68 GiB = 51.2 GB). Change `'48 GB'` to `'48 GiB'` in `ple.b.ts:4` | controls: `tier` handled (`ple-placement.js:53`).

### 09 Sharing it

- **share-why** (`src/slides/v2/share-why.ts:5-12`): verdict `ok` | wording: plain, 2 sentences | accuracy: ok | controls: none.
- **collective-a** (`src/slides/v2/collective.ts:6-16`, `src/slides/route/g01.ts`, `src/scenes/builders/collective.js`): verdict `ok` | wording: plain, 2 sentences | accuracy: public-safe, `no shared vram`, `no inbound port needed` | controls: `drop`, `inbound` handled (`collective.js:503-506`).
- **collective-b** (`src/slides/v2/collective.b.ts:4`, `src/scenes/builders/collective-tunnel.js`): verdict `ok` | wording: plain, 2 sentences | accuracy: public-safe, `outbound WSS`, `Yamux streams`, `inbound blocked`, `simulated ·` readout | controls: `phase` handled (`collective-tunnel.js:57`).
- **collective-request-a** (`src/slides/v2/collective-request.ts:4`, `src/scenes/builders/collective-route.js`): verdict `ok` | wording: plain, 2 sentences | accuracy: public-safe, `simulated ·`, one machine per request | controls: `model` handled (`collective-route.js:58`).
- **collective-request-b** (`src/slides/v2/collective-request.b.ts:4`, `src/scenes/builders/collective-models.js`): verdict `ok` | wording: plain, 2 sentences | accuracy: public-safe, `NOT pooled`, `simulated ·` readout | controls: `offline` handled (`collective-models.js:55`).

### 10 Close

- **close-a** (`src/slides/v2/close.ts:6-16`, `src/slides/route/a03.ts`, `src/scenes/builders/profiles.js`): verdict `fix` | wording: plain, 1 sentence | accuracy: `profiles.js:17-24` labels the six pillars with **v1 chapter numbers** (`01`, `01`, `02`, `03`, `03`, `00`) and line `135` draws `'chapter number under each pillar · tall + dark = leans on'`. In Deck v2 those topics are chapters `03`/`04`, `05`, `06`, `01` (`src/slides/v2/_ch.ts:3`) | controls: `profile` handled (`profiles.js:182`).
- **qa** (`src/slides/v2/qa.ts:5-12`): verdict `ok` | wording: plain, 1 sentence | accuracy: ok | controls: none.

---

## Prioritised fix list

1. **Runtime crash — `src/scenes/builders/prefix-strips.js:42`** (`prefix-cache-b`)
   - Delete line 42 (`x, y, z` are undefined; `rec.at(sx, sy)` on line 65 sets position):
   - Target:
     `    sp.renderOrder = 10;`
     `    sp.position.set(x, y, z);`
     `    scene.add(sp);`
   - Replacement:
     `    sp.renderOrder = 10;`
     `    scene.add(sp);`

2. **Contradictory / inaccurate labels — `src/scenes/builders/quant-dials.js:196, 239`** (`quant-types-b`)
   - `src/scenes/builders/quant-dials.js:196`:
     Target: `dr('bf16\n16 dense levels', RX, 0.62, 0, 0.76);`
     Replacement: `dr('bf16\n16 bits (dense)', RX, 0.62, 0, 0.76);`
   - `src/scenes/builders/quant-dials.js:239`:
     Target: ``da(`follows weights\n${f.aBits} bits`, AX, -0.75, 3.35, 0.76);``
     Replacement: ``da(`${f.scheme} preset\n${f.aBits} bits`, AX, -0.75, 3.35, 0.76);``
     *(or add an independent `acts` control to `src/slides/v2/quant-types.b.ts` + `quant-dials.js` so all three dials are actually separate.)*

3. **Unpublished AMD spec presented as spec sheet — `src/scenes/builders/mem-quadrant.js:7, 31`** (`setup-hardware-b`)
   - `src/scenes/builders/mem-quadrant.js:7`:
     Target: `{ name: 'Ryzen AI Max+ 395', cap: 128, bw: 256, key: 'amd', x: 1.5, z: -3.8 },`
     Replacement: `{ name: 'Ryzen AI Max+ 395 (est.)', cap: 128, bw: 256, key: 'amd', x: 1.5, z: -2.0 },`
   - `src/scenes/builders/mem-quadrant.js:31`:
     Target: `const readout = other ? \`spec sheets · ${other.name} holds ${other.cap / 32}× more · 5090 bandwidth ${(1792 / other.bw).toFixed(1)}×\` : 'spec sheets · capacity and rated bandwidth · all four';`
     Replacement: `const readout = other ? \`spec sheets · ${other.name} holds ${other.cap / 32}× more · 5090 bandwidth ${(1792 / other.bw).toFixed(1)}×\` : 'spec sheets (AMD 256 GB/s derived) · capacity and bandwidth · all four';`

4. **Readout computes read time for overflowing 5090 — `src/scenes/builders/mem-fill.js:29`** (`setup-hardware-c`)
   - `src/scenes/builders/mem-fill.js:29`:
     Target: ``out({playing,readout:`spec math · ${size} GB · read once: ${Math.round(size/1792*1000)} ms on 5090, ${Math.round(size/273*1000)} ms on spark (lower bound)`});``
     Replacement: ``out({playing,readout:`toy size · ${size} GB · ${size>32?"doesn't fit 5090":`${Math.round(size/1792*1000)} ms on 5090`}, ${Math.round(size/273*1000)} ms on spark (lower bound)`});``

5. **Stale vLLM default block size & premature R3 trigger — `src/scenes/builders/cache-three.js:203, 393` and `src/scenes/builders/cache-lens.js:211`** (`engines-cache-b`, `engines-cache-c`)
   - `src/scenes/builders/cache-three.js:203`:
     Target: `makeLabel(scene, 'toy block 4; real default 16', COL_X[0], 2.48, 0, 0.32);`
     Replacement: `makeLabel(scene, 'toy block 4 (v0.33: 16 · v0.34: 64)', COL_X[0], 2.48, 0, 0.32);`
   - `src/scenes/builders/cache-three.js:393`:
     Target: `const r3Arrived = beat >= 1;`
     Replacement: `const r3Arrived = beat >= 2;`
   - `src/scenes/builders/cache-lens.js:211`:
     Target: `makeLabel(vllmGroup, 'vLLM: hashed blocks · toy block 4; real default 16', 0.0, 2.86, 0, 0.34);`
     Replacement: `makeLabel(vllmGroup, 'vLLM: hashed blocks · toy block 4 (v0.33: 16 · v0.34: 64)', 0.0, 2.86, 0, 0.34);`

6. **Direction labels mismatch 3D layout — `src/slides/v2/spec-decode.b.ts:10` and `src/scenes/builders/spec-tree.js:26, 49, 56`** (`spec-decode-b`)
   - `src/slides/v2/spec-decode.b.ts:10`:
     Target: `{ kind: 'choice', action: 'accept', label: 'accepted path', options: [{label:'left',value:'left'},{label:'right',value:'right'}], initial:'left' },`
     Replacement: `{ kind: 'choice', action: 'accept', label: 'accepted path', options: [{label:'top',value:'top'},{label:'bottom',value:'bottom'}], initial:'top' },`
   - `src/scenes/builders/spec-tree.js:7, 26, 49, 56`:
     Target (`line 7`): `let draft = 'tree', accept = 'left', playing = true, beat = 0, clock = 0;`
     Replacement: `let draft = 'tree', accept = 'top', playing = true, beat = 0, clock = 0;`
     Target (`line 26`): `const path = draft === 'tree' ? (accept === 'left' ? [0, 1, 3, 5] : [0, 2, 4, 6]) : [0, 1, 2, 3];`
     Replacement: `const path = draft === 'tree' ? (accept === 'top' ? [0, 1, 3, 5] : [0, 2, 4, 6]) : [0, 1, 2, 3];`
     Target (`line 49`): ``out({ playing, readout: `simulated · ${draft} of ${draft === 'tree' ? 7 : 4} · ${accept} path · 3 + 1 bonus · 1 target pass` });``
     Replacement: ``out({ playing, readout: `simulated · ${draft} of ${draft === 'tree' ? 7 : 4} · ${draft === 'tree' ? `${accept} path` : 'single path'} · 3 + 1 bonus · 1 target pass` });``
     Target (`line 56`): `else if (name === 'accept' && ['left', 'right'].includes(arg)) { accept = arg; beat = 2; rebuild(); }`
     Replacement: `else if (name === 'accept' && ['top', 'bottom'].includes(arg)) { accept = arg; beat = 2; rebuild(); }`

7. **Ambiguous PLE disambiguation label — `src/scenes/builders/ple-layers.js:22`** (`ple-a`)
   - `src/scenes/builders/ple-layers.js:22`:
     Target: `label('Qwen PLE: n-gram table', 0, 2.52, 0, 0.44);`
     Replacement: `label('not Qwen n-gram PLE', 0, 2.52, 0, 0.44);`

8. **GB vs GiB mismatch — `src/slides/v2/ple.b.ts:4`** (`ple-b`)
   - `src/slides/v2/ple.b.ts:4`:
     Target: `body:"Qwen3.8-Flash-Next's n-gram table is 51 billion numbers, about 48 GB in FP8. Engines can keep it in VRAM, in system RAM, or read the rows they need from SSD each step."`
     Replacement: `body:"Qwen3.8-Flash-Next's n-gram table is 51 billion numbers, about 48 GiB in FP8. Engines can keep it in VRAM, in system RAM, or read the rows they need from SSD each step."`

9. **Unadded sprites + logits caveat — `src/scenes/builders/link-traffic.js:148, 166, 213`** (`setup-slow-link-b`)
   - `src/scenes/builders/link-traffic.js:148`:
     Target: `scene.add(cableTopLabel.sprite, gpuTopLabel.sprite);`
     Replacement: `scene.add(cableTopLabel.sprite, gpuTopLabel.sprite, subLeft.sprite, subRight.sprite);`
   - `src/scenes/builders/link-traffic.js:166, 213`:
     Target (`line 166`): `cableTopLabel.set('~0.6 MB / token');`
     Replacement: `cableTopLabel.set('≤0.6 MB / token (logits)');`
     Target (`line 213`): `? 'simulated · per token: ~0.6 MB over the cable vs ~20 GB read inside the gpu'`
     Replacement: `? 'simulated · per token: ≤0.6 MB logits (bytes for token id) vs ~20 GB in gpu'`

10. **V1 chapter numbers on V2 close slide — `src/scenes/builders/profiles.js:18-23, 135`** (`close-a`)
    - Note: `profiles.js` is shared with v1 `a03.ts`; update chapter numbers only if v1 isn't kept fixed, or remove `'chapter number under each pillar · '` in `profiles.js:135` and drop `ch` sprites (`profiles.js:116-118`) so it works cleanly for both v1 and v2:
    - `src/scenes/builders/profiles.js:135`:
      Target: `const legend = mkText(['chapter number under each pillar · tall + dark = leans on'], { h: 0.34, maxW: 7.6 });`
      Replacement: `const legend = mkText(['tall + dark = workload leans on this limit'], { h: 0.34, maxW: 7.6 });`
      *(and remove `ch` label creation at lines 116-118, or map v2 chapters if `profiles.js` is v2-only.)*

11. **Forecast phrasing on slide — `src/slides/v2/why-cost.ts:10`** (`why-cost`)
    - `src/slides/v2/why-cost.ts:10`:
      Target: `items: ["My take: today’s prices are heavily subsidised, and that won’t last forever.", "At API rates, a busy month of agents already adds up."],`
      Replacement: `items: ["My take: today’s prices are heavily subsidised.", "At API rates, a busy month of agents already adds up."],`

12. **Misleading toy readout — `src/scenes/builders/embed-analogy.js:18`** (`embed-vec-b`)
    - `src/scenes/builders/embed-analogy.js:18`:
      Target: ``out({playing,readout:`simulated · ${relation} step = [${offset.map(n=>n.toFixed(2)).join(', ')}] · same for every country`});``
      Replacement: ``out({playing,readout:`simulated · ${relation} step = [${offset.map(n=>n.toFixed(2)).join(', ')}] · same in this toy`});``
