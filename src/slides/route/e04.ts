import type { Slide } from '../../deck/types';
import { chip } from './_chapters';
import { meta } from './_meta';
import { slides as base } from '../scene-lab/02-drafter-vram';

// E04 — reuses an existing builder with route copy (handoff §3 E04).
export const slide: Slide = {
  ...(base[0] as Extract<Slide, { type: 'scene' }>),
  id: 'e04',
  example: false,
  chip: chip(4),
  caption: {
    title: "The drafter needs a seat",
    body: "A separate drafter’s weights live in the same VRAM as the target model and the KV cache. A faster single stream can cost cache room that other agents needed.",
  },
  notes: meta({
    id: "E04",
    claim: "external drafters spend VRAM that could hold KV or prefixes",
    evidence: ["MECHANISM", "SYNTHETIC DEMO"],
    simulated: "band sizes and KV block counts",
    not: "n-gram prompt drafting needs neural weights; MTP and external drafts cost the same; measured sizes",
    open: "paired drafter on/off memory + TTFT numbers from the speaker’s vLLM",
    reuses: "drafter-vram (scene lab)",
    sources: ["https://docs.vllm.ai/en/latest/features/speculative_decoding/", "https://docs.vllm.ai/projects/speculators/en/latest/user_guide/algorithms/decision_guide/"],
  }),
};
