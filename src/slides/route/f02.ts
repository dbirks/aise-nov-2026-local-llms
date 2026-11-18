import type { Slide } from '../../deck/types';
import { chip } from './_chapters';
import { meta } from './_meta';
import { slides as base } from '../scene-lab/03-engram';

// F02 — reuses an existing builder with route copy (handoff §3 F02).
export const slide: Slide = {
  ...(base[0] as Extract<Slide, { type: 'scene' }>),
  id: 'f02',
  example: false,
  chip: chip(5),
  caption: {
    title: "A huge learned lookup table",
    body: "For each new token, a hash of the last few tokens picks a few rows from a huge learned table. That is DeepSeek’s Engram: static weights, not KV cache, not RAG, not experts.",
  },
  notes: meta({
    id: "F02",
    claim: "hashed n-gram lookups gather a few learned rows per newly processed position",
    evidence: ["MECHANISM", "SYNTHETIC DEMO"],
    simulated: "32-row toy table, hash values",
    not: "the table is read once per session; Engram is RAG, MoE experts, speculative n-gram reuse or KV",
    reuses: "engram (scene lab)",
    sources: ["https://arxiv.org/abs/2601.07372", "https://github.com/deepseek-ai/Engram", "https://huggingface.co/deepseek-ai/DeepSeek-V4.1-Flash", "https://docs.vllm.ai/en/latest/features/engram/"],
  }),
};
