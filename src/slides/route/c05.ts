import type { Slide } from '../../deck/types';
import { chip } from './_chapters';
import { meta } from './_meta';
import { slides as base } from '../scene-lab/07-nokv';

// C05 — reuses an existing builder with route copy (handoff §3 C05).
export const slide: Slide = {
  ...(base[0] as Extract<Slide, { type: 'scene' }>),
  id: 'c05',
  example: false,
  chip: chip(2),
  caption: {
    title: "Remember instead of redo",
    body: "Without a memory, every new token re-runs the whole conversation so far. The KV cache keeps each layer’s keys and values, and the work saved grows polynomially, not exponentially.",
  },
  notes: meta({
    id: "C05",
    claim: "KV stores contextual keys/values so decode processes only the new position while reading old K/V",
    evidence: ["MECHANISM", "SYNTHETIC DEMO"],
    simulated: "6 layer plates, 4 or 16 toy tokens",
    not: "KV is a table of token IDs; cached decode never reads past tokens; exponential growth; every layer of a hybrid model has K/V",
    reuses: "nokv (scene lab); kvcache shows KV dtype pages",
    sources: ["https://arxiv.org/abs/2309.06180", "https://docs.vllm.ai/en/latest/features/quantization/quantized_kvcache/", "handoff §4.3 (P·T + T(T−1)/2 positions without cache)"],
  }),
};
