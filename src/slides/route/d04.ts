import type { Slide } from '../../deck/types';
import { chip } from './_chapters';
import { meta } from './_meta';
import { slides as base } from '../scene-lab/06-prefix-share';

// D04 — reuses an existing builder with route copy (handoff §3 D04).
export const slide: Slide = {
  ...(base[0] as Extract<Slide, { type: 'scene' }>),
  id: 'd04',
  example: false,
  chip: chip(3),
  caption: {
    title: "Three engines, three indexes",
    body: "Engines remember shared prompts differently: vLLM hashes KV blocks, SGLang keeps a radix tree, llama.cpp keeps per-slot state. A change early in the prompt stops reuse in all three.",
  },
  notes: meta({
    id: "D04",
    claim: "vLLM hash blocks, SGLang radix tree and llama.cpp slots solve prompt reuse differently",
    evidence: ["MECHANISM", "SYNTHETIC DEMO", "OPEN / VERSION-DEPENDENT"],
    simulated: "50k prefix length, 8 drawn cells per region",
    not: "RadixAttention is a new attention equation; llama.cpp slots physically dedupe a shared prefix; independent hosts share cache",
    open: "hybrid Mamba/sliding-window checkpoints (V3) not drawn",
    reuses: "prefix-share (scene lab)",
    sources: ["https://docs.vllm.ai/en/latest/design/prefix_caching/", "https://www.lmsys.org/blog/2024-01-17-sglang/", "https://www.sglang.io/blog/unified-radix-cache", "https://github.com/ggml-org/llama.cpp/blob/master/tools/server/README.md"],
  }),
};
