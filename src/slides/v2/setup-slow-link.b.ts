import type { Slide } from '../../deck/types';
import { chip } from './_ch';
import { meta } from '../route/_meta';

export const slides: Slide[] = [{
  id: 'setup-slow-link-b',
  variant: 'B',
  type: 'scene',
  scene: 'link-traffic',
  chip: chip(3),
  caption: {
    title: 'Where the bytes go',
    body: 'Loading moves the whole model across the cable once. While it generates, almost all the reading happens inside the GPU.',
  },
  controls: [
    {
      kind: 'choice',
      action: 'phase',
      label: 'phase',
      options: [
        { label: 'load', value: 'load' },
        { label: 'decode', value: 'decode' },
      ],
      initial: 'load',
    },
  ],
  notes: meta({
    id: 'setup-slow-link-b',
    claim: 'Load moves the model weights across the link once; per-token decode traffic across the link (token id + optional vocab-sized logits) is orders of magnitude smaller than reading all resident weights inside the GPU.',
    evidence: ['MECHANISM', 'SYNTHETIC DEMO'],
    simulated: 'Toy model: 20 GB weights, vocab 150,000 x 4 bytes logits ≈ 0.6 MB (~33,300x ratio inside GPU vs across cable during decode), plotted on a log10 stacked-cube scale.',
    not: 'the eGPU is as fast as an internal slot for every workload; bar heights are linear; 0.6 MB is a measured run rather than toy arithmetic',
    sources: ['speaker observation', 'docs/research/v2/setup.md'],
  }),
}];
