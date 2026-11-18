import type { Slide } from '../../deck/types';
import { chip } from './_ch';
import { meta } from '../route/_meta';

export const slides: Slide[] = [{
  id: 'kv-cache-b',
  variant: 'B',
  type: 'scene',
  scene: 'kv-fill',
  chip: chip(5),
  caption: {
    title: 'The cache grows with the conversation',
    body: 'Every token adds its keys and values to the cache in VRAM. The weights stay the same size; the cache keeps growing until the context is full.',
  },
  controls: [{
    kind: 'choice',
    action: 'ctx',
    label: 'context',
    options: [
      { label: '8', value: 8 },
      { label: '16', value: 16 },
    ],
    initial: 16,
  }],
  notes: meta({
    id: 'kv-cache-b',
    claim: 'Each generated token appends key and value vectors per attention layer into free VRAM while weights stay fixed.',
    evidence: ['MECHANISM', 'SYNTHETIC DEMO'],
    simulated: '4 toy layers and 8 or 16 free token slots in a schematic VRAM slab.',
    not: 'cache is allocated all at once in every engine; hybrid layers keep KV',
    sources: [
      'docs/research/v2/kv-serving.md',
      'https://arxiv.org/abs/2309.06180',
      'https://docs.vllm.ai/en/latest/features/quantization/quantized_kvcache/',
    ],
  }),
}];
