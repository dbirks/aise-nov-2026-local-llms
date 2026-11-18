import type { Slide } from '../../deck/types';
import { chip } from './_chapters';
import { meta } from './_meta';

// B03 — total vs active parameters in MoE vs dense FFN (handoff §3 B03).
export const slide: Slide = {
  id: 'b03',
  type: 'scene',
  scene: 'moe-store',
  chip: chip(1),
  caption: {
    title: '35B stored, ~3B used per token',
    body: 'A mixture-of-experts layer has a router that sends each token to a few expert blocks. All experts still have to be stored, so 35B-A3B means 35B in memory and about 3B used per token.',
  },
  controls: [
    {
      kind: 'choice',
      action: 'mode',
      label: 'ffn',
      options: [
        { label: 'dense', value: 'dense' },
        { label: 'moe', value: 'moe' },
      ],
      initial: 'moe',
    },
    {
      kind: 'choice',
      action: 'batch',
      label: 'tokens in flight',
      options: [
        { label: '1', value: 1 },
        { label: '4', value: 4 },
        { label: '16', value: 16 },
      ],
      initial: 1,
    },
  ],
  notes: meta({
    id: 'B03',
    claim: 'total parameters and active parameters are different; storage does not shrink with routing',
    evidence: ['MECHANISM', 'SYNTHETIC DEMO'],
    simulated: '4 layers × 8 experts + 1 shared block, top-2 deterministic seeded routing; 35B / ~3B gauge labels reference Qwen3.6-35B-A3B',
    not: 'A3B is a 3B model; only active experts need memory; routing is random (real routers are learned)',
    open: 'confirm exact model-card counts for the model on stage',
    sources: [
      'https://huggingface.co/Qwen (Qwen3.6-35B-A3B model card — verify exact repo id)',
      'docs/presentation-production-handoff.md B03',
    ],
  }),
};
