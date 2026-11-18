import type { Slide } from '../../deck/types';
import { chip } from './_chapters';
import { meta } from './_meta';
import { slides as base } from '../scene-lab/14-agent-eviction';

// D05 — reuses an existing builder with route copy (handoff §3 D05).
export const slide: Slide = {
  ...(base[0] as Extract<Slide, { type: 'scene' }>),
  id: 'd05',
  example: false,
  chip: chip(3),
  caption: {
    title: "The model fits, the agents don’t",
    body: "Several long agent histories compete for the KV room left after the weights. When an old prefix gets evicted, that agent’s next turn pays the full prefill again.",
  },
  notes: meta({
    id: "D05",
    claim: "a resident model can still thrash its prefix cache under several long-lived agents",
    evidence: ["MECHANISM", "MEASURED ON SPEAKER SYSTEM", "SYNTHETIC DEMO"],
    simulated: "agent counts, prefix lengths, TTFT meter",
    not: "a bigger cache removes all queueing; FP8→NVFP4 is a universal capacity ratio or keeps answer quality equal; each agent gets full max context",
    reuses: "agent-eviction (scene lab)",
    sources: ["https://github.com/dbirks/home-k8s/blob/main/.agents/skills/qwen38-27b-vllm/SKILL.md (741,032 FP8 → 1,225,765 NVFP4 token pool, config-specific)", "https://docs.vllm.ai/en/latest/design/prefix_caching/"],
  }),
};
