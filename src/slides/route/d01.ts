import type { Slide } from '../../deck/types';
import { chip } from './_chapters';
import { meta } from './_meta';
import { slide as b0 } from '../talk/prefill';

// D01 — reuses an existing builder with route copy (handoff §3 D01).
export const slide: Slide = {
  ...(b0 as Extract<Slide, { type: 'scene' }>),
  id: 'd01',
  example: false,
  chip: chip(3),
  caption: {
    title: "Reading the prompt vs replying",
    body: "Reading your prompt pushes many positions through each weight read at once; that is prefill. Replying, one token at a time, moves one new position per read, which is decode: same weights, very different work per byte.",
  },
  notes: meta({
    id: "D01",
    claim: "prefill reuses each weight tile across many positions; batch-one decode does little arithmetic per weight fetch",
    evidence: ["MECHANISM", "SYNTHETIC DEMO"],
    simulated: "8 layers, meter units = one weight read",
    not: "cores switch off during decode; prefill is always compute-bound or decode always bandwidth-bound; absolute latencies",
    reuses: "prefill (talk)",
    sources: ["https://developer.nvidia.com/blog/co-designing-ai-model-attention-for-fast-interactive-long-context-inference", "https://arxiv.org/abs/2211.05102"],
  }),
};
