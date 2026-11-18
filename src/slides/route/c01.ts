import type { Slide } from '../../deck/types';
import { chip } from './_chapters';
import { meta } from './_meta';

export const slide: Slide = {
  id: 'c01', type: 'scene', scene: 'quant-matrix', chip: chip(2),
  caption: {
    title: 'Fewer levels, a slightly different answer',
    body: 'Quantizing stores each weight as one of a few allowed levels times a shared scale. The matrix changes a little, so W·h changes a little too: that difference is the quality you trade.',
  },
  controls: [
    { kind: 'choice', action: 'bits', label: 'bits', options: [8, 4, 3, 2].map(value => ({ label: String(value), value })), initial: 4 },
    { kind: 'choice', action: 'group', label: 'scale per', options: [{ label: 'tensor', value: 'tensor' }, { label: 'row', value: 'row' }], initial: 'tensor' },
    { kind: 'choice', action: 'input', label: 'input h', options: [{ label: 'h1', value: 1 }, { label: 'h2', value: 2 }], initial: 1 },
  ],
  notes: meta({ id: 'C01', claim: 'reducing weight precision perturbs computed activations', evidence: ['MECHANISM', 'SYNTHETIC DEMO'], simulated: '4×4 weights, two inputs and scaled integer quantization', not: 'chopping decimal places; a semantic direction; real models are 4×4; fewer bits always gives monotonically larger error', sources: ['https://github.com/intel/auto-round', 'https://docs.nvidia.com/deeplearning/transformer-engine/features/low_precision_training/nvfp4/nvfp4.html', 'docs/presentation-production-handoff.md §4.1'] }),
};
