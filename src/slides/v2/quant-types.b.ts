import type { Slide } from '../../deck/types';
import { chip } from './_ch';
import { meta } from '../route/_meta';

export const slides: Slide[] = [{
  id: 'quant-types-b',
  variant: 'B',
  type: 'scene',
  scene: 'quant-dials',
  chip: chip(4),
  caption: {
    title: 'Three separate dials',
    body: 'Weights, activations and the KV cache each get their own precision. A 4-bit model can still keep its cache at 16 or 8 bits.',
  },
  controls: [
    {
      kind: 'choice', action: 'w', label: 'weights', initial: 'int4',
      options: [{ label: 'bf16', value: 'bf16' }, { label: 'int4', value: 'int4' }, { label: 'nvfp4', value: 'nvfp4' }],
    },
    {
      kind: 'choice', action: 'kv', label: 'kv cache', initial: 'bf16',
      options: [{ label: 'bf16', value: 'bf16' }, { label: 'fp8', value: 'fp8' }],
    },
  ],
  notes: meta({
    id: 'quant-types-b',
    claim: 'Weight, activation and KV-cache precision are three independent settings: a 4-bit weight format does not set the cache precision.',
    evidence: ['MECHANISM'],
    simulated: 'Slab heights are illustrative bit-width units; the KV strip growth is a toy context animation. The bit widths (16 / 8 / 4, NVFP4 4.5 with block scales) are format facts from the cited sources.',
    not: 'One bit-width = one format; weight quantization also shrinks the KV cache; lower precision is always faster.',
    open: 'Which KV dtypes the speaker\'s vLLM build accepts on his eGPU (fp8 vs nvfp4_4over6) is version-dependent; NVFP4 W4A4 kernels are Blackwell+ hardware.',
    sources: [
      'docs/research/v2/embed-quant.md',
      'https://docs.vllm.ai/en/latest/features/quantization/quantized_kvcache/',
      'https://developer.nvidia.com/blog/introducing-nvfp4-for-efficient-and-accurate-low-precision-inference/',
    ],
  }),
}];
