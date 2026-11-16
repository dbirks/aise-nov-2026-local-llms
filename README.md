# Beyond "It Runs": Engineering Local LLM Inference

Research and planning repository for a **30-minute, 201-level AI/software engineering meetup talk** (November 2026).

## Premise

Assume the audience has already run a model with **Ollama or LM Studio**. The interesting next question is how to **choose, fit, accelerate, serve, and connect** local language models on real hardware. This is not an installation walkthrough or a taxonomy of LLM trivia.

The talk is intended to be a **rapid, interactive tour through detailed 3D visualizations**. The presenter may spend 15 seconds on one scene and dive into another. Graphics must represent real mechanisms faithfully—not metaphors or decorative 3D.

## Working presentation structure

1. **Choose** — recent local model capabilities; dense vs. MoE; architecture and quality tradeoffs.
2. **Fit** — weight quantization, GPU/CPU residency, context, KV cache and hybrid-model state.
3. **Accelerate** — prefill/decode, throughput/latency, speculative decoding (MTP, EAGLE-3, DFlash, DFlash2, DSpark, and research extensions).
4. **Serve** — compare decisions in vLLM, llama.cpp, and Ollama; concurrency, scheduling and resource budgets.
5. **Connect** — show an actual API gateway connecting separately hosted models (the speaker's *LLM Collective*). Do not assume distributed GPU memory or cross-machine model execution.

**Narrative device:** start from a real serving configuration, open a 3D explanation for the engineering decisions behind individual flags, then return to the configuration. Use the same concepts to compare different inference engines. Do *not* force a line-by-line tour or claim illustrative config values are production defaults.

## Research & agent handoff

- [Living research notes and detailed 3D scene briefs](docs/local-llm-talk-research-notes.md)
- [Instructions for an implementation agent](AGENTS.md)

The notes include storyboards, camera/interaction ideas, technical accuracy guardrails, references, and unresolved research questions. They are **working research**, not a validated final script or ready-to-run configs.

## Proposed abstract

> You've tried Ollama or LM Studio and run a model on your own machine. Now what? This fast-moving, visual 201-level walkthrough explores the practical decisions behind hosting local models well: choosing architectures, quantizing weights, managing KV cache and GPU memory, speeding up generation, and configuring inference engines like vLLM and llama.cpp. We'll connect those ideas to lessons from real deployments and a shared gateway for independently hosted models.

## To gather from the speaker

- Actual hardware, model IDs and quantizations, serving versions and measured performance.
- Practical lessons: unexpected bottlenecks, tuning decisions, and failed experiments.
- Verified LLM Collective topology: routing, health, authorization, fallbacks, capabilities.
- Which configurations and speculative decoding methods work *today* for the selected models/hardware.

**Research notes updated:** November 16, 2026.
