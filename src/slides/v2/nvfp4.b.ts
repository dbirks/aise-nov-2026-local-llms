import type { Slide } from '../../deck/types';
import { chip } from './_ch';
import { meta } from '../route/_meta';

export const slides: Slide[] = [{
  id: 'nvfp4-b',
  variant: 'B',
  type: 'scene',
  scene: 'nvfp4-ruler',
  chip: chip(4),
  caption: {
    title: 'Four bits, not evenly spaced',
    body: 'NVFP4 levels sit close together near zero and spread out toward 6. Small weights keep more detail than big ones.',
  },
  controls: [{
    kind: 'choice',
    action: 'outlier',
    label: 'biggest weight',
    options: [
      { label: '0.092', value: 0.092 },
      { label: '0.25', value: 0.25 },
      { label: '0.5', value: 0.5 },
    ],
    initial: 0.092,
  }],
  notes: meta({
    id: 'nvfp4-b',
    claim: 'E2M1 levels double in spacing outward from zero, so a block outlier stretches the shared scale and increases error on small weights.',
    evidence: ['MECHANISM', 'SYNTHETIC DEMO'],
    simulated: 'Toy 16-value block with synthetic element-0 outlier sweep (0.092, 0.25, 0.5).',
    not: 'NVFP4 is 4.0 bits per weight (it is 4.5 with block scales); levels are evenly spaced; every layer is NVFP4; pre-Blackwell GPUs run it natively.',
    sources: [
      'https://developer.nvidia.com/blog/introducing-nvfp4-for-efficient-and-accurate-low-precision-inference/',
      'https://docs.nvidia.com/deeplearning/transformer-engine/features/low_precision_training/nvfp4/nvfp4.html',
      'https://www.opencompute.org/documents/ocp-microscaling-formats-mx-v1-0-spec-final-pdf',
    ],
  }),
}];
