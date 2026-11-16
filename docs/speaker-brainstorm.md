# Speaker brainstorm — 2026-11-16

> **Living, provisional first-person notes.** These preserve the speaker's brainstorming, not a final script, verified market forecast, or required slide order. As explicitly clarified by the speaker: current pages and scenes in `src/slides.ts` are **visual-style and interaction experiments**, not the agreed presentation outline. Don't use their order as evidence of speaker intent. Update this document as the speaker continues talking.

## The "why": local models crossed a personal reliability threshold

- The speaker's first real breakthrough was **Qwen3.6-27B**. Not just "it can call tools" but "it often makes the next sensible decision without me having to constantly remind it."
- Tasks where that feeling mattered: web research, investigating Kubernetes issues, and multi-step agent workflows. Specific small detail: remembering to **commit before pushing**—a behavior the speaker previously had to remind local models to do.
- The speaker suspects stronger post-training was a factor, but this is a **hypothesis**. The grounded claim is a personal impression of useful, reliable decisions. Other causes might include prompts, harnesses, context, and settings.
- Briefly tried **Muse Glimmer**. No firm verdict was given.
- **Qwen3.8-27B** then became a model the speaker used heavily for work and came to trust for many tasks. Verify release dates/model identities before making a chronology.
- This should be pitched as the moment local models went from a fun demo to a dependable workhorse *for the speaker*, not an unsupported universal ranking.

**Possible 15-second opening line:** "You've probably run a model locally. The interesting moment for me was when I stopped expecting it to mess up all the little procedural decisions."

Potential scene: a real, anonymized agent trace from Kubernetes investigation or git workflow, showing tool use, decisions, and what the speaker previously had to correct. Do not invent actual logs or benchmarked reliability percentages.

## The economics and personal motivation

- Running models locally is fun and technically rewarding in its own right.
- The speaker actively uses provider subscriptions and appreciates how accessible high-end inference is today; this is not an anti-cloud talk.
- Speculation: agent growth may increase demand and providers might eventually tighten subscriptions, quotas or pricing. The speaker has also wondered about an AI market correction. **Do not state subsidies, a crash, or price increases as known facts.**
- More grounded framing: local inference builds practical options, control, and resilience if provider costs, availability or limits change.
- The cost thesis could be a brief motivation, not a prolonged financial prediction.

## The actual workflow and deployment stories

- Speaker reports switching between **llama.cpp**, **vLLM**, and **NInfer** (name verified; see sources). This is valuable because it shows that one backend is not automatically best for every machine or workload.
- Personal setup may use WSL. A particularly memorable troubleshooting anecdote: heavy model file reads/caching caused the WSL2 VM's memory consumption as seen from Windows to grow unexpectedly; the speaker reports WSL being killed. The speaker found **direct-I/O / page-cache-avoidance flags** useful.
  - **Accuracy:** direct I/O can bypass the Linux kernel *page cache*, not bypass every sort of caching, and WSL is a virtualized memory subsystem rather than a partition "filling memory." Linux cached memory is generally reclaimable; WSL's reclaim behavior and memory limits need to be considered separately. Record the exact command + engine version + measured memory behavior before attributing the crash or prescribing a flag.
  - Microsoft documents WSL2 `.wslconfig` `autoMemoryReclaim` settings; don't confuse these with loader-specific I/O paths: https://learn.microsoft.com/en-us/windows/wsl/wsl-config
  - vLLM's `--safetensors-load-strategy` supports mmap/lazy, eager and explicit prefetch; **this is not automatically an O_DIRECT switch**: https://docs.vllm.ai/en/latest/configuration/engine_args/
- Speaker could walk through **one actual vLLM config**, selecting 3–5 consequential lines and leaving the complete file as a resource. Each configuration choice opens a brief 3D visualization of the underlying behavior. Then show how the same high-level problem appears in llama.cpp, NInfer or another engine. The alternative is opening with the *actual system used at work* and branching out.
- Keep the exact command/config, actual hardware, versions, performance measurements, and memory issue details **TODO** until supplied. Never manufacture them.

## Specialized inference engines: don't discount them

Potential key point: a narrower engine optimized for a specific GPU, model family, quantization, or serving workload can outperform a general-purpose stack **on that measured workload**, while sacrificing breadth, flexibility or ease of maintenance.

- **NInfer**: specialized C++/CUDA inference runtime with RTX 5090 support for selected Qwen models. Presenter reports using/considering it for RTX 5090. Upstream: https://github.com/Neroued/ninfer
- **Radiance / vLLM Radiance**: community vLLM-derived RDNA4 work targeting AMD **Radeon AI PRO R9700** (confirm official product name). Speaker reports a coworker achieving good results. Distinguish the specific fork, GPU count, model, and benchmarks from other Radiance-derived projects; the statement that it became a separate fork needs repo/lineage confirmation. Illustrative sources: https://github.com/SlyBase/vllm-sly-radiance and https://github.com/magiccodingman/vllm-radiance
- **Pennyroyal / Penny Royal**: SGLang-derived, hardware/workload-targeted runtime; speaker reports good results with it. Canonical source: https://github.com/jpezzulli/sglang-rtxpro6000 ; NVIDIA forum discussion: https://forums.developer.nvidia.com/t/pennyroyal-v2-5-qwen3-8-on-rtx-pro-6000-with-sglang-online-fp8-nvme-ple-and-docker/383310 . Supported profiles and speculative options are version-specific.
- Comparison should focus on **tradeoffs**, not just tokens/sec: supported cards/models, context, quantization, GPU occupancy, tool calling and structured output, concurrency, installation effort, correctness/compatibility, and long-term support.
- Avoid invented claims that these engines are categorically faster than vLLM/llama.cpp.

**Possible quick 3D scene:** a set of different GPU cards/models with compatible engine "adapters"; a general engine supports broad combinations; a specialized kernel/engine targets a narrower path with fewer branches. Optional live metrics from real logs; do not imply unmeasured speedups.

## Hybrid local + provider setup

- Speaker uses a Claude subscription, mentioned **Opus 5.5**, and a **pi agent harness** with a local model in the workflow.
- **Open question:** which component calls which? Do not invent an orchestration graph until clarified.
- This reinforces a pragmatic story: cloud and local are complementary.

## Narrative structures under consideration — not settled

**A. Start with the real work machine:** "Here's the setup I use; here's why I switch between engines." Branch to WSL memory, quantization/KV cache, GPU constraints, draft models and engine specialization. Strength: concrete first-person knowledge. Risk: immediate wall of flags.

**B. Start with the turning point:** Qwen model became dependable; why bother running locally; the actual system and configuration choices that made it usable; end with specialized engines and shared infrastructure. Strength: clear why before how.

**C. Start with a real failure or fix:** the WSL host memory surprise (or another concrete incident), then use that to teach practical inference memory. Strength: memorable engineering story. Risk: not representative of all hosts.

No final decision needed yet. A likely natural hybrid: 60–90 seconds of personal quality story, then one genuine setup/config as the technical navigation, then specialized engines as an important counterexample to "one best server."

## Possible presentation moments / scenes (not required slide list)

1. **Trust threshold:** anonymized real trace and subjective model adoption timeline.
2. **WSL memory:** three distinct visual regions—loaded tensors, Linux file page cache, and WSL host-visible VM memory. Animate checkpoint loading/reclaim and limits, but don't represent cache memory as permanently unreclaimable.
3. **Config as navigation:** real vLLM command with clickable 3D drill-downs for quantization, KV cache allocation/precision, prefill/decode and concurrency.
4. **Engine tradeoff map:** vLLM vs llama.cpp vs NInfer vs Radiance vs Pennyroyal, with sourced support matrices and only comparable measured performance.
5. **Specialization:** narrow hardware-specific kernel path vs more general execution framework, focusing on *why* specialization may help.
6. **LLM Collective:** actual independent machines behind a shared API gateway. Do not depict pooled VRAM or multi-host tensor parallelism without evidence.

## Prompts for later speaker recall

- The exact WSL memory failure: which loader and flags? What memory reading increased? Was WSL out-of-memory or terminated externally?
- Real launch commands for vLLM, llama.cpp and NInfer. Which parameters were surprisingly high-leverage?
- The model, quantization and GPU used for NInfer/Radiance/Pennyroyal; any before/after throughput and tool-call examples.
- Did you switch engines for performance, support, reliability, API compatibility or maintenance?
- What one local-model task best demonstrates *trust* better than a synthetic benchmark?
- Where does the LLM Collective actually fit in the story?

## Notes maintenance

Keep this speaker brainstorming separate from `docs/local-llm-talk-research-notes.md` (mechanisms, research and visualization briefs). When new ideas arrive, append and revise here without forcing a slide order. Avoid treating current example slide placeholders as approved plans.
