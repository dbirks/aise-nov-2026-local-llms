import type { Slide } from '../../deck/types';
import { chip } from './_ch';
import { meta } from '../route/_meta';

export const slides: Slide[] = [{
  id: 'nvfp4-a',
  variant: 'A',
  type: 'scene',
  scene: 'nvfp4-pack',
  chip: chip(4),
  caption: {
    title: 'How NVFP4 packs a block',
    body: 'Sixteen numbers share one 8-bit scale, and each number keeps just 4 bits: a sign, two exponent bits, and one mantissa bit. With the scale that comes to 4.5 bits per weight.',
  },
  controls: [{
    kind: 'choice',
    action: 'format',
    label: 'format',
    options: [
      { label: 'nvfp4', value: 'nvfp4' },
      { label: 'mxfp4', value: 'mxfp4' },
    ],
    initial: 'nvfp4',
  }],
  notes: meta({
    id: 'nvfp4-a',
    claim: 'NVFP4 packs 16 E2M1 4-bit weights with one FP8 E4M3 block scale (4.5 bits/weight) plus a tensor-wide FP32 global scale.',
    evidence: ['MECHANISM', 'SYNTHETIC DEMO'],
    simulated: 'Toy 16-value block (and toy 16-value neighbor half with 0.38 outlier when toggled to MXFP4).',
    not: 'NVFP4 is 4.0 bits per weight (it is 4.5 with block scales); levels are evenly spaced; every layer is NVFP4; pre-Blackwell GPUs run it natively.',
    sources: [
      'https://developer.nvidia.com/blog/introducing-nvfp4-for-efficient-and-accurate-low-precision-inference/',
      'https://docs.nvidia.com/deeplearning/transformer-engine/features/low_precision_training/nvfp4/nvfp4.html',
      'https://www.opencompute.org/documents/ocp-microscaling-formats-mx-v1-0-spec-final-pdf',
    ],
  }),
}];
