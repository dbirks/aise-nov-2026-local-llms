# Implementation-agent instructions

The task is to turn [the research notes](docs/local-llm-talk-research-notes.md) into an **interactive, 3D-first technical presentation**, not a conventional static slide deck. The speaker is presenting at an AI/software-engineering meetup in November 2026 for ~30 minutes.

## Intended audience and experience

Assume attendees have already experimented with Ollama or LM Studio. Show what changes when a model must fit hardware, run efficiently, support concurrent requests, and participate in shared serving infrastructure. Favor 15-second-to-one-minute interactive scenes, with optional deep-dives, over long passages of narration.

**Suggested organizing principle:** an on-screen practical vLLM / llama.cpp serving config acts as navigation. Select a relevant argument → show a mathematically faithful 3D mechanism → return to the config. Do not make the whole presentation a flag-by-flag tutorial.

## Visualization contracts

For each scene, provide:
1. One sentence naming the actual mechanism/claim and the 15-second takeaway.
2. A rigorous account of the source tensors or computations and what the visual primitives correspond to.
3. Geometry and axes: what x, y, z, colors, size and movement mean; clearly distinguish illustrative projections from actual data.
4. Camera storyboard: initial overview, animations/steps, orbit/zoom, exit transition, reset.
5. Interaction contracts: controls, default values and state transitions; keyboard support for live presenting.
6. A citation to a primary source for technical claims; flag unknowns for later confirmation.
7. Accuracy constraints: what the visual must NOT imply (see below).

## Key accuracy constraints

- 3D projections of token or hidden-state vectors can distort high-dimensional similarity. If using real embeddings, state the model, extraction layer, preprocessing and projection algorithm. Static embedding relationships do not automatically generalize to contextual residual streams.
- Model parameter count, vocabulary size, and hidden dimension are distinct quantities.
- Mixture-of-experts 'active parameters' are not total memory occupancy. A router selects expert computations by token and layer.
- Weight quantization, activation quantization and KV-cache quantization are distinct; lower precision does not guarantee better throughput on all kernels/hardware.
- Context length is not equivalent to an always-fully-allocated KV cache; for hybrid models some layers have other forms of recurrent/attention state.
- Prefill versus decode, per-user latency versus aggregate throughput, memory capacity versus bandwidth versus compute are separate axes.
- For stochastic speculative decoding, *distribution-preserving verification is not merely equality testing*. Rejected draft tokens invalidate descendants conditioned on them in a linear draft. Tree verification requires correct ancestry masks.
- MTP, EAGLE-3, DFlash, DFlash2, DSpark and related research methods have differing draft dependencies; avoid showing all of them as equivalent.
- vLLM, llama.cpp and Ollama expose different interfaces and runtime implementations. GGUF is a weight/container format, not an inference engine.
- LLM Collective is a gateway for models hosted on independent machines. Do not draw cross-host tensor parallelism, pooled VRAM or distributed model execution unless the speaker confirms that functionality.
- Do not invent measured model performance, hardware specifications, model comparisons, or the speaker's experiences. Clearly label simulated demo data.

## Suggested reusable 3D objects

Token tiles and positional axes; matrix grids and vector tips; transformer layer planes; expert-routing graph; logits/probability bars; VRAM slabs and KV blocks; compute slabs; attention masks; draft/verification timelines and trees; request queues and scheduler cards; independent model-host boxes and routing links.

## Research and implementation checkpoints

- Verify current release model architecture, parameter counts, token vocabulary, quantization formats and supported serving features against primary model cards.
- Verify exact command syntax against the installed versions of vLLM, llama.cpp and Ollama before showing runnable snippets.
- Ground speculative decoding animations in original papers + implementation specifics, and qualify comparisons with workload/hardware/batch-size details.
- Gather the speaker's actual host specs, configurations, observed measurements and LLM Collective topology before producing anecdotal or performance claims.
- Implement smooth transitions and a consistent visual grammar. Optimize for legibility on a projected conference display and rapid live navigation.
- Keep the full research notes linked above as the working source of truth; annotate updates with dates and references rather than silently replacing uncertainties with guesses.

## Output organization (suggestion)

Use a data-driven scene registry containing a scene id, narration, sources, optional config flag mapping, axes/visual encoding, steps, camera positions, controls, and accuracy constraints. Build presentation sequencing independently so the speaker can jump between concepts and revisit scenes.
