import type { Slide } from '../../deck/types';
import { chip } from './_ch';
import { meta } from '../route/_meta';

export const slides: Slide[] = [{
  id: 'setup-slow-link-a',
  variant: 'A',
  type: 'scene',
  scene: 'link-once',
  chip: chip(3),
  caption: {
    title: 'A slow link is fine',
    body: 'The ~20 GB of weights cross the cable once, and loading takes about 20 seconds. After that, the weights and the cache stay on the card.',
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
    id: 'setup-slow-link',
    claim: 'Weights (~20 GB) cross Thunderbolt 4 once during load (~20 s speaker observation); during resident decode only token ids (or logits) cross while weights and KV cache stay on the GPU.',
    evidence: ['SPEAKER OBSERVATION', 'MECHANISM'],
    simulated: '36 weight cubes and 8 KV cache blocks illustrate the one-time transfer vs resident decode loop; 0->20 s counter is scaled to the animation.',
    not: 'the eGPU is as fast as an internal slot for every workload; weights cross the cable per token; the 20 s load is Thunderbolt link speed alone; numbers measured unless labelled',
    sources: ['speaker observation', 'docs/research/v2/setup.md'],
  }),
}];
