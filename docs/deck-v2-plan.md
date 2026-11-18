# Deck v2 plan

Started 2026-11-18, after the speaker's two brain-dumps. This file is the working contract for the new deck in
`src/slides.ts`. The previous build is archived in `src/decks/route-v1.ts`; open it with `?deck=v1`.

**Sources of truth, in order:**
1. This file.
2. `docs/presentation-production-handoff.md`, for evidence rules and scene metadata that still applies.
3. `AGENTS.md`, for the accuracy constraints, which still apply in full.

## How we work

- **The review loop.**
  - Claude orchestrates: writes the slides, dispatches workers, verifies, commits and pushes to `main`.
  - Pages deploys each push.
  - The speaker reviews the live site and comes back with notes. Claude applies them, pushes again, and repeats
    until each slide is locked.
- **On-screen words only.** No speaker notes, and nothing written for a presenter to read aloud. Notes fields
  hold only metadata: claim, evidence label, sources, and what the slide must not imply.
- **Plain wording.**
  - Short, normal sentences, the way a person says them.
  - None of these: "Let's dive in", "unlock", "supercharge", "it's not X, it's Y" patterns, rhetorical
    triplets, em-dash chains or emoji.
  - A slide title is a plain statement or question. The body is two sentences at most.
- **The teaching style.** Show the real mechanism as a mental model, not as an analogy or allegory:
  - Start with plain words.
  - Then give the real name.
  - Then the actual numbers or data flow.
  - Then one caveat.
- **3D slides get variants.**
  - Every slide whose 3D scene is still undecided ships as two or three variants: the same slide built
    different ways.
  - Each variant has a big **A**, **B** or **C** badge in the top-left corner, and ids like `quant-vec-a`,
    `quant-vec-b`.
  - The speaker picks one. The others move to `src/decks/v2-rejects.ts`; nothing is deleted.
  - If a concept genuinely has only one good picture, build one and say so.
- **Accuracy rules carry over unchanged.**
  - No invented measurements.
  - Manufacturer specs are labelled as manufacturer specs.
  - The speaker's experiences are labelled as speaker observations.
  - Opinions are labelled as opinions.
  - Toy data is labelled as simulated.
  - Nothing private from llm-collective: architecture only, as the speaker describes it.
- **Tooling and verification.**
  - pnpm only.
  - Each 3D slide passes the GPU screenshot Job in home-k8s (`apps/splat-lab-shots.yaml`), and Claude reviews
    the montage before asking the speaker to look.

## Deck features to add (Phase 0)

1. **Remember the slide across refresh.**
   - The hash already carries the slide id.
   - Also save the current slide index in `localStorage`, wrapped in try/catch.
   - On load: use the hash id if it exists in the deck. Otherwise use the saved index, clamped to the deck
     length. Otherwise start at 0.
   - This way a refresh stays put even after slides are renamed or reordered.
2. **Fast scrubber on phones.**
   - In the mobile feed, a thin strip runs down the right edge, about 28px wide and full height.
   - Dragging a thumb on it jumps through the slides proportionally.
   - While dragging, a large bubble beside the thumb shows `page n / N` and the slide title.
   - Release to land on that slide.
   - Desktop is unchanged.
3. **Variant badge.**
   - An optional `variant?: 'A' | 'B' | 'C'` field on slides.
   - It renders a large letter in the top-left of the slide frame, in the existing chrome font and ink colour,
     about 96px.
4. **Deck selector stays.** `?deck=v1` keeps opening the archived build.

## Workers

- **Concurrency.**
  - 4 pi workers, `qwen3-8-flash-next`.
  - 2–3 agy workers, `gemini-4-hydrogen-high`.
  - 2–3 Codex workers, `gpt-6.1-terra`.
- **Bigger models, used sparingly.**
  - agy `carbon` or `argon`, and Codex `gpt-6.1-astro`.
  - These are for one-off, high-value 3D work, such as the embedding scene and the engine comparison, once the
    cheaper workers have a baseline.
  - No Fable.
- **Ownership.**
  - Workers own disjoint files and never touch git.
  - Claude reviews every diff, runs the build, takes GPU shots, commits and pushes.

## Phases

- **P0, deck features.** The three features above.
- **P1, the text skeleton.**
  - Every slide below goes into `src/slides.ts` in order, in the existing layouts.
  - Each has its title and body copy, and a placeholder or reused scene.
  - This is reviewable before any new 3D work starts.
- **P2, the research packets.**
  - One file per chapter in `docs/research/v2/`.
  - Primary sources checked by web search, with exact figures and their sources: model configs, format specs,
    engine docs, papers.
  - An open-questions list for the speaker.
  - Workers do the searching; Claude checks the figures that end up on slides.
- **P3, the 3D scenes.** Slides with a ◆ in the outline get two or three variants each, in chapter order, and
  each variant reuses an existing builder where one fits.
- **P4, the review loop.** Apply the speaker's notes, lock the slides, and move rejected variants out.

## The outline

Each slide is listed as **id**, then its working title, then what it says and shows. ◆ marks a slide with 3D
variants to build. Evidence labels are in brackets.

### 00 Opening

- **open**: *Six months of running models at home and at work.*
  - It covers what I've been learning, organised roughly in the order I learned it.
  - Terms get defined as they come up.

### 01 Why bother?

- **why-objection**: *Hosted models are cheap and good. Why run your own?*
  - It's a fair question, and mostly I agree.
- **why-good-enough**: *You don't always need the biggest model.*
  - For a lot of coding and business work you need a model that pays attention to detail, not the fastest one
    available.
  - A month or two ago I noticed I'd stopped reaching for the biggest one. [SPEAKER OBSERVATION]
- **why-cost**: *Cheap tokens might not stay cheap.*
  - Today's prices are heavily subsidised.
  - At API billing rates, heavy agent use already adds up.
  - [OPINION]. Any dollar figure is shown as a labelled hypothetical, never as a quote.
- **why-independence**: *Your model, your rules.*
  - Use it for whatever you need, security work included.
  - It doesn't change under you. A hosted service can swap the quantization or the routing whenever it likes.
  - [SPEAKER OBSERVATION / OPINION]. Name no provider and make no specific accusation.
- **why-fun**: *And it's fun.*
  - There are lots of knobs to turn.
  - Your reasons might be different, and that's fine.

### 02 What we mean by inference

- **train-vs-infer** ◆: *Training writes the weights. Inference reads them.*
  - Training learns patterns from a lot of text, and the output is a file of numbers called weights.
  - Inference runs those fixed weights to predict what comes next.
  - Reuse the `weights-fixed` builder from v1 A02 as variant A.
- **engines**: *An inference engine serves the weights.*
  - llama.cpp, vLLM, SGLang and Ollama are engines.
  - GGUF and safetensors are file formats, not engines.

### 03 My setup

- **setup-why**: *Around June, the Copilot limits started tightening.*
  - I'd wanted to self-host for a while, so I got a GPU. [SPEAKER OBSERVATION; confirm the month]
- **setup-egpu** ◆: *My work laptop has to stay my work laptop.*
  - Client work happens in Windows and WSL, and the data can't leave the laptop.
  - So the GPU goes in an external enclosure on Thunderbolt 4.
  - [SPEAKER OBSERVATION]. Look up the TB4 PCIe tunnel bandwidth as a [MANUFACTURER SPEC].
- **setup-slow-link** ◆: *A slow link is fine.*
  - The ~20 GB of weights cross once, and the model loads in about 20 seconds.
  - After that, only a little data moves per token.
  - [SPEAKER OBSERVATION] for the 20 s figure; the direction of traffic is [MECHANISM].
  - Show the weights crossing the link once, then token-sized traffic only.
- **setup-hardware** ◆: *Room or speed: about 128 GB of slower unified memory, or 32 GB of much faster GPU memory.*
  - At the moment both cost about the same. [MANUFACTURER SPEC for the capacities and bandwidths; prices need a
    date and a source, or get dropped]
  - Reuse the v1 `gpu-choice` builder as variant A.
- **setup-path**: *Ollama, then llama.cpp, then vLLM.*
  - I started on Ollama, saw people tuning flags on Reddit, and wanted that control.

### 04 Getting a smart enough model into VRAM

- **gguf**: *GGUF gives you many sizes of the same model.*
  - The same weights come at different bit-widths.
  - GGUF releases often go further down in size than other formats.
- **embed-vec** ◆: *Each word becomes a list of numbers.*
  - A 3D plot with arrows from the origin to: France, Germany, Italy, Hitler, Mussolini, baguette, and a German
    bread (pumpernickel or pretzel).
  - Under the plot, a small matrix shows each word's 3 coordinates, and it stays in sync as the camera orbits.
  - The punchline: in a real model the list isn't 3 numbers long. For Qwen3.8-27B it is *N* numbers, the
    `hidden_size` from the model's `config.json`, which must be verified in P2.
  - **Accuracy:**
    - The default coordinates are hand-placed and labelled [SYNTHETIC DEMO].
    - An optional variant may use real embeddings projected to 3D. If so, state the model, layer and projection
      method on screen, and note that the projection distorts distances.
    - Don't imply that static input embeddings behave like contextual hidden states.
  - **Variant ideas:**
    - A: arrows plus a matrix.
    - B: the same, plus analogy offsets drawn as parallel arrows (France→Paris-style; Germany→Hitler ≈
      Italy→Mussolini).
    - C: a single word's vector unrolling from 3 numbers into a long strip of N cells.
- **quant-what** ◆: *Quantization stores each number with fewer levels.*
  - The same arrows from the previous slide. As the bit-width drops (16 → 8 → 4), each coordinate snaps to a
    coarser grid, and the arrow tips get hazy or jitter between grid points.
  - **Accuracy:**
    - It isn't "chopping decimal places". Values are rounded to a small set of levels, with a scale per block.
    - The matrix shows the stored integer and the scale.
    - Most of the weights being quantized are the layer matrices, not just embeddings. Say this in one line.
  - **Variant ideas:**
    - A: the arrow tips snap onto a visible 3D lattice.
    - B: hazy arrows, with error cones.
    - C: a number line per coordinate, showing the levels.
- **quant-types** ◆: *Four bits isn't one format.*
  - INT4 levels are evenly spaced. NVFP4 (E2M1) levels are not, and it adds a block scale.
  - Weights, activations and the KV cache are separate settings.
  - Reuse v1's `quant` and `quant-matrix` builders as variants.
- **nvfp4** ◆: *How NVFP4 packs a block.*
  - 16 values share one FP8 scale.
  - Each value uses 4 bits: 1 sign bit, 2 exponent bits and 1 mantissa bit.
  - Show a block being encoded step by step. Check the block size and scale format against the NVIDIA docs in P2.
- **autoround** ◆: *Tuning the rounding instead of just rounding.*
  - AutoRound learns small adjustments so the rounded weights give closer outputs.
  - Then test on data it wasn't tuned on.
  - The models I quantized: list from the speaker. [SPEAKER OBSERVATION]
  - Reuse v1's `autoround` builder as variant A.
- **moe** (optional, needs the speaker's yes): *35B stored, about 3B used per token.* Reuse v1 B03.

### 05 Where does the conversation live?

- **kv-cache** ◆: *Remember instead of redo.*
  - Without a cache, generating token 10,000 means reprocessing tokens 1 through 9,999.
  - The KV cache keeps each token's keys and values in VRAM, so each new token is one small step.
  - **Variant ideas:**
    - A: the recompute triangle against the cached strip (v1 `nokv`/`kvcache`).
    - B: a VRAM slab filling with KV blocks as the chat grows.
    - C: a token counter with a per-step work bar.

### 06 Several agents, one GPU

- **batching** ◆: *Several requests at once use the same weights read.*
  - Decode is limited by memory bandwidth, so serving several requests in one pass costs little extra.
  - Per-user speed and total throughput are different numbers.
  - Reuse v1's `roofline` and `prefill` builders.
- **prefix-cache** ◆: *Agents that start the same way can share the work.*
  - The same system prompt and tool list mean the same first tokens, so the cached KV for those tokens can be
    reused.
- **engines-cache** ◆: *Three engines, three ways to find a shared prefix.*
  - vLLM hashes fixed-size blocks; each block's hash includes the hash of the block before it.
  - SGLang keeps a radix tree of token sequences (RadixAttention).
  - llama.cpp keeps a cache per slot and reuses the longest match.
  - Verify the exact behaviour against current docs and source in P2.
  - **Variant ideas:**
    - A: three side-by-side 3D structures fed the same three prompts: a chain of hashed blocks, a branching
      tree, and per-slot strips.
    - B: one prompt stream, with a toggle that swaps the index structure.
    - C: a lookup animation, timed step by step for one new request.
  - The bigger models may be used here.

### 07 Making each token faster

- **spec-decode** ◆: *Guess a few tokens ahead, check them all in one pass.*
  - A small drafter guesses; the big model verifies the guesses together.
  - A wrong guess throws away everything after it.
  - Reuse v1 `spec` as variant A.
- **mtp** ◆: *MTP: the model drafts for itself.*
  - Extra prediction heads, trained with the model, guess the next few tokens.
- **block-drafters** ◆: *DFlash, DSpark, DFlash2: drafting a whole block at once.*
  - Show how each one's draft depends on the target model differently, and don't present them as equivalent.
  - Reuse v1's `drafters` builder.
- **shipped-drafters**: *Model makers now ship a matched drafter.*
  - [OPEN / VERSION-DEPENDENT]. Name specific releases only with sources.
- **drafter-vram** ◆: *The drafter needs room too.*
  - Weights plus its own KV, taken from the same VRAM. Reuse v1 `drafter-vram`.
- **my-drafter** ◆: *I trained my own drafter.*
  - The pipeline: trajectories → hidden states → train → convert → serve.
  - "If you want to try it: vLLM's `speculators`."
  - Use the figures from the v1 E05 issues (#72, #80), already verified. [SPEAKER OBSERVATION / MEASURED ON
    SPEAKER SYSTEM]

### 08 Other things I ran into

- **new-engines**: *Newer engines: NInfer, Radiance, Pennyroyal.*
  - What each one targets. Reuse v1 `engine-map`.
- **ngram-tables** ◆: *Qwen and DeepSeek both added n-gram lookup tables, in different ways.*
  - What each one stores, how it's indexed, and where it lives (VRAM, RAM or SSD).
  - Research both primary sources in P2. Reuse v1's `engram` and `ssd-access` builders.
- **ple** ◆: *PLE: per-layer embeddings.*
  - Define it (Gemma 3n is the reference implementation; verify).
  - Each layer gets its own small embedding lookup, which can live off the GPU.
  - Variant ideas: a layer stack with side tables feeding each layer.

### 09 Sharing it

- **share-why**: *Not everyone wants to buy hardware.*
  - I want coworkers to be able to use these models without each of them running their own.
- **collective** ◆: *LLM Collective: phone home, no VPN.*
  - Home machines run a small Go agent, configured by YAML, that points at the local engine.
  - The agent dials out to a gateway in Kubernetes and holds a multiplexed tunnel open (Yamux over WebSocket;
    confirm the wording).
  - Nothing at home is exposed to the internet.
  - [MECHANISM, as described by the speaker]. Public-safe: no hosts, keys or topology.
  - Reuse v1 `collective` as variant A.
- **collective-request** ◆: *What a request does.*
  - API key → `/models` → the request goes to the machine hosting that model.
  - Must not imply pooled VRAM, or one model split across machines.

### 10 Close

- **close**: *Which trade-offs fit your hardware and your work?*
- **qa**: *Questions, and what you'd like to hear about next time.*

## Open questions for the speaker

- The month the Copilot limits tightened (currently "around June").
- Which models you quantized, and with what settings.
- Keep or drop the MoE slide (**moe**).
- The hardware-price comparison: keep it with a dated source, or drop it.
- The German bread for **embed-vec**: pumpernickel or pretzel.
- Whether to keep the Hitler/Mussolini analogy, or switch to capitals (Paris/Berlin/Rome) if the room calls for
  it.

### Added during the build (2026-11-18)

- **PLE naming.** vLLM and Pennyroyal call Qwen3.8-Flash-Next's 51B n-gram table "PLE". Gemma 3n's PLE (per-layer
  embeddings) is an older, different design with the same acronym. Which one did you mean? The `ple` slide shows
  Gemma 3n as A and the Flash-Next table as B.
- **Prices.** The only dated price found was the RTX 5090 launch MSRP ($1,999). Both "about the same price" and the
  API-cost line stay off the slides until you give dated sources.
- **Your eGPU's GPU model.** `setup-egpu` B uses the RTX 5090 rated bandwidth "for scale" unless you confirm the card.
- **Qwen3.8-27B facts used on slides** (from `config.json`, fetched 2026-11-18): hidden_size 5,120; 64 layers, 16 of
  them full attention (the KV cache lives only in those); vocab 248,320.
- **Your quantized checkpoints** (verified on Hugging Face): `dbirks/Qwen3.8-27B-NVFP4-AutoRound` is 20.61 GB and
  `dbirks/Qwen3.8-27B-W4A16-AutoRound` is 19.47 GB. What AutoRound settings did you use (iters, nsamples, seqlen)?
