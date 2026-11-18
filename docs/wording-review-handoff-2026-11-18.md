# On-screen wording review: Configuring Local LLMs

**Created:** November 18, 2026  
**Base reviewed:** \`main\` @ \`a435ca3a07bef0a4bc7f2ef06dbc692a885fffbf\`  
**Status:** working copy handoff for discussion with the speaker; **not** a finalized full-deck rewrite  
**Relationship to active coding agent:** keep the existing 3D scene work running. This file collects wording changes and review decisions separately to avoid write conflicts. **Do not rewrite scene builders or auto-apply every proposed line until the speaker approves the language.**  
**Scope of this first pass:** talk title, Opening (00), Why bother? (01), What we mean by inference (02); next sections (03–05) are copied/referenced for review, *not revised yet*. No presenter/speaker notes are planned.

## Speaker's direction — high confidence

1. **Title is approved:** **Configuring Local LLMs**. Remove the placeholder **Beyond “It Runs”** from the title slide, global running label and eventual external blurb. This exact new title is the speaker's instruction.
2. **Audience-facing, not self-congratulatory.** Present a useful grab bag of terms/definitions, settings, tricks, lessons and practical examples collected over roughly six months of local inference at home and work. The approximate order learned is an organizing convenience, **not a perfect linear narrative** and not a grand "my journey" framing.
3. **Warm, informal, precise.** Ordinary words first; name the technical term; show what actually moves/changes in an accurate visualization. The speaker does **not** want hype, technical-word dumps, or a literal apples/factory allegory. Use personal stories when they explain a practical lesson, not to center the speaker.
4. **Real config snippets** from llama.cpp and vLLM should appear where they help a particular section; do not do a long config-file tour. Keep SGLang where comparison matters.
5. **Local motivations:** hosted models and subscriptions are excellent, and the speaker uses them. Still, per-use economics, changing quotas/billing, control over model version and quantization, keeping client data on a machine when required, and the sheer fun of tinkering all motivate local inference. Do **not** imply everyone should run locally or that every hosted provider secretly downgrades models.
6. **Direct Copilot detail now verifiable:** GitHub announced the end of request-based premium billing on April 27, 2026; **June 1, 2026** began the shift to token-consumption-based GitHub AI Credits. In the old scheme a long agent request and a brief interaction could cost the same base premium request (subject to model multipliers); under the new approach consumption reflects model/input/output/cached token usage. Source: [GitHub announcement, April 27](https://github.blog/news-insights/github-copilot-is-moving-to-usage-based-billing/) and [GitHub billing docs](https://docs.github.com/en/copilot/reference/copilot-billing/request-based-billing-legacy/what-changed-with-billing). The speaker remembers using long-running Copilot sessions, sometimes keeping them going through follow-up questions, and becoming concerned as the pricing changed. **Do not imply he was gaming the service or that his client's exact plan switched on June 1 without confirmation.**
7. **Market outlook is subjective:** the speaker suspects generous subscription economics may change, but also acknowledges that models could become cheaper to serve. No confident crash prediction or quantified "all tokens heavily subsidized" claim needed on-screen.
8. **Precision control:** with a self-hosted model, the operator can know the actual weights/quantization and decide when to change them; a hosted provider may change available models/service routing, but no particular hidden quantization downgrade has been substantiated. Frame this as transparency/control, not an accusation.
9. **No extra artifact expectations:** the existing scenes and variant A/B/C experiments are still being made by the coding agent. This is a **copy review** and a planned future handoff to that agent, not a request to alter scenes.

## Proposed literal text for title, 00, 01 and 02

The **title is locked by explicit speaker instruction**. All other copy is an editorial **first draft** that the speaker will read and modify with us. Each line below maps to the existing slide ID. Preserve A/B visual alternatives; update common wording consistently after approval.

### Title and global chapter label — approved

Target code:
- \`src/slides.ts\`, \`slides[0].headline\`
- \`src/slides/v2/_ch.ts\`, \`TALK\`

**New title / global TALK:**

> Configuring Local LLMs

The existing title-slide metadata \`Engineering Local LLM Inference\` and \`AISE · November 2026\` can remain unless the speaker wants to change them. If the render layout cannot fit the text, use a **visual line break only**, preserving these exact words.

### 00 — Opening

Current chapter heading: \`Opening\` (no change needed yet).  
Slide: \`src/slides/v2/open.ts\`, ID \`open\`.

**Proposed title:**

> A grab bag of local LLM terms, tips and settings

**Proposed exact list items:**

> A few definitions, settings I've found useful, and things I've picked up along the way.

> Roughly in the order I learned them, with examples from llama.cpp and vLLM.

This deliberately does **not** put the speaker's six months or personal achievements in the headline. If we want the rough six-month time anchor, it can be mentioned briefly in person or swapped into the first item during the copy review. It is a community knowledge-sharing intro.

### 01 — Why run a local model?

Target chapter heading: \`src/slides/v2/_ch.ts\`, \`CHAPTERS[1][1]\`.  
Current: \`Why bother?\`.

**Proposed chapter title:**

> Why run a local model?

**Proposed section divider framing** (\`src/slides.ts\`, \`section(1,...)\`):

> Hosted models are great. So why would you want to run one yourself?

#### \`why-objection\` — acknowledge the obvious

**Title:**

> Hosted models are really good

**Items:**

> The models are capable, and subscriptions can be a great deal.

> I use them too.

This is a concession, not a straw man or a claim local models should replace all hosted options.

#### \`why-good-enough\` — workload fit

**Title:**

> You don't always need the biggest model

**Items:**

> A useful model is one that reliably does the work you ask it to do.

> Even with hosted models, I've found I don't always need the most expensive option.

The speaker specifically mentioned increasingly choosing a strong but non-top-tier hosted coding model (e.g. Opus 5.5 rather than a more expensive Fable-class model). The example can be added after verifying name/availability; it **does not alone prove** small local models match either hosted model.

#### \`why-cost\` — concrete trigger, uncertainty rather than prophecy

**Title:**

> Pricing and limits can change

**Items:**

> GitHub Copilot's switch from per-request billing to token-based credits made me think harder about long agent sessions.

> I still use hosted models, but I wanted another option if pricing or limits changed.

This is a **grounded personal motivation** plus a **documented public product change**, not a prediction that subscriptions will end. The speaker can mention his opinion about subsidized pricing and the possibility that future economics change, clearly as opinion, if he chooses.

#### \`why-independence\` — explicit control

**Title:**

> Know exactly what you're running

**Items:**

> With a local model, I choose the weights, the quantization, and when to change them.

> For work that has to stay on my machine, I can keep inference local.

Accuracy: local inference also depends on the agent harness and its tool/network integrations; don't suggest the entire application is automatically offline. The speaker's actual client constraint motivated the eGPU.

#### \`why-fun\` — non-prescriptive finish

**Title:**

> And it's fun

**Items:**

> There are a lot of settings to try, and I like seeing what each one changes.

> You might have completely different reasons, and that's fine too.

### 02 — What do we mean by inference?

Target \`CHAPTERS[2][1]\`, currently \`What we mean by inference\`.

**Proposed chapter title:**

> What do we mean by inference?

**Proposed section divider framing** (\`section(2,...)\`):

> Before the settings, two terms are worth separating: training and inference.

#### \`train-vs-infer\` — proposed copy common to visual variants A and B

**Title for A and B:**

> Training produces the weights. Inference uses them.

**Variant A proposed body:**

> During training, a model's numbers are adjusted using lots of examples, including text and code. Inference uses those learned weights to process a prompt and predict the next token.

**Variant B proposed body:**

> Training repeatedly adjusts the model's numbers. Once the model is trained and loaded for inference, those weights stay fixed while it produces responses.

Nuance: models may be fine-tuned or trained later; "fixed" describes standard deployed inference, not a permanent property of a checkpoint. Training can use multimodal data too; text/code are examples, not a complete list.

**Optional verbal fact, not another required slide:** the resulting weights can be in a small file or many files totalling hundreds of gigabytes. A 20 GB file isn't a hard rule or a parameter count by itself.

#### \`engines\` — clarify execution layer and file formats

**Title:**

> An inference engine runs the model

**Items:**

> llama.cpp, vLLM and SGLang are engines that load weights and compute responses. Ollama makes local models easier to download and run.

> GGUF and safetensors are file formats for storing model tensors. They're not inference engines.

Nuance: Ollama is also a model server/runtime with its own APIs and underlying execution components; this wording avoids over-drawing a strict engines-versus-wrappers line. GGUF is not inherently a quantization algorithm.

## Suggested wording consistency checklist for the eventual code change

- Replace \`Beyond “It Runs”\` everywhere audience-visible, not only title: \`src/slides.ts\`, \`src/slides/v2/_ch.ts\` and any displayed chapter navigation. The old \`README.md\` heading can remain historically unless the project owner wants the repository itself renamed.
- Prefer **local model**, **model weights**, **quantization**, **context**, **KV cache**, **prefix caching**, **drafter** in that order as concepts are introduced.
- Don't say "training makes a file of numbers" if the diagram visibly displays tensors spread across multiple shards; write "produces weights" instead.
- Don't call all submitted agent inputs "private": data locality must be measured relative to client requirements.
- Avoid definitive "won't last forever" for subscription prices and "hosted services quantize your model without warning" without specific evidence.
- Don't treat exact copy as a live screenshot of a not-yet-merged coding-agent variant; the route might change during review.

## Up next — literal current section topics awaiting the speaker's narration

These are *not revised*. The speaker asked to review sections 03–05 next; the freshest code should be fetched immediately before that review, because another agent is actively editing the deck.

### 03 My setup — current section framing

**Divider:** "What I actually run, and why it looks the way it does."

- \`setup-why\`: "Around June, the Copilot limits started tightening".
  - **Potential duplication** with newly proposed \`why-cost\`: decide whether to retain this as personal transition, merge it with the earlier pricing story, or replace with "That got me looking at running models on my own laptop."
- \`setup-egpu\`: "My work laptop has to stay my work laptop" (variants).
- \`setup-slow-link\`: "A slow link is fine" (variants).
- \`setup-hardware\`: "Room or speed" (variants).
- \`setup-path\`: "Ollama, then llama.cpp, then vLLM".

### 04 Getting a smart enough model into VRAM

**Divider:** "The first real problem was memory. A smart model has to fit on the card."

- \`gguf\`: "GGUF comes in many sizes of the same model".
- \`embed-vec\`: "Each word becomes a list of numbers" (variants; **token** is more precise than word).
- \`quant-what\`: "Quantization stores each number with fewer levels" (variants).
- \`quant-types\`: "Four bits isn't one format" (variants).
- \`nvfp4\`: "How NVFP4 packs a block" (variants).
- \`autoround\`: "Tune the rounding, don't just round" (variants).
- \`moe\`: "35B stored, about 3B used per token" (optional).

### 05 Where does the conversation live?

**Divider:** "Once it loaded, I found the weights weren't the only thing using VRAM."

- \`kv-cache\`: "Remember instead of redo" (three visual variants).

**Do not apply edits to 03–05 yet.** The speaker wants to narrate his reactions to exact live wording first.

## Next coordination step

1. Speaker reads and corrects **proposed copy for 00–02**, then reads 03–05 exact live text/variants.
2. As opinions emerge, record **approved** changes separately from suggestions.
3. Once wording is approved, the coding agent applies it atomically to the current \`main\` version, preserving variants, scenes and source metadata.
4. A review build checks no outdated \`Beyond “It Runs”\` or inaccurate economic/quantization claim remains on screen.
