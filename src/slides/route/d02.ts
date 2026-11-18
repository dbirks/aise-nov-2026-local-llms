import type { Slide } from '../../deck/types';
import { chip } from './_chapters';
import { meta } from './_meta';
import { slides as base } from '../scene-lab/01-roofline';

// D02 — reuses an existing builder with route copy (handoff §3 D02).
export const slide: Slide = {
  ...(base[0] as Extract<Slide, { type: 'scene' }>),
  id: 'd02',
  example: false,
  chip: chip(3),
  caption: {
    title: "Compute roof, bandwidth slope",
    body: "A kernel stops at whichever runs out first: arithmetic or memory traffic. That is the roofline; batching moves decode toward the roof, and the ceilings are rated peaks, not tokens per second.",
  },
  notes: meta({
    id: "D02",
    claim: "attainable FLOP/s = min(peak compute, bandwidth × arithmetic intensity)",
    evidence: ["MECHANISM", "MANUFACTURER SPEC", "SYNTHETIC DEMO"],
    simulated: "point positions are derived illustrative values",
    not: "an exact tok/s prediction from rated bandwidth; that batching only helps (queueing and KV pressure grow)",
    reuses: "roofline (scene lab)",
    sources: ["https://developer.nvidia.com/blog/co-designing-ai-model-attention-for-fast-interactive-long-context-inference", "handoff §4.4"],
  }),
};
