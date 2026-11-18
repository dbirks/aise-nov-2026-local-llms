import type { Slide } from '../../deck/types';
import { chip } from './_chapters';
import { meta } from './_meta';

export const slide: Slide = {
  id: 'c03', type: 'scene', scene: 'autoround', chip: chip(2),
  caption: {
    title: 'Tune the rounding, then test fresh',
    body: 'AutoRound nudges how each weight rounds so a block’s output matches the original on sample inputs (calibration). Then you test on inputs it never saw, and keep sensitive layers at higher precision.',
  },
  controls: [
    { kind: 'choice', action: 'method', label: 'rounding', options: [{ label: 'nearest', value: 'nearest' }, { label: 'autoround', value: 'autoround' }], initial: 'nearest' },
    { kind: 'toggle', action: 'keep', label: 'keep one layer bf16', initial: false },
  ],
  notes: meta({
    id: 'C03', claim: 'Calibrated rounding, held-out evaluation and selective precision make quantization quality an engineering choice',
    evidence: ['MECHANISM', 'SYNTHETIC DEMO'],
    simulated: 'Four independent 4×8 layers; seeded calibration and held-out vectors; signed straight-through rounding optimization; weight-only footprint excludes scales. The BF16 layer is represented by its original weights.',
    not: 'AutoRound is QAT; calibration error is a coding benchmark; AutoRound trained the DSpark drafter',
    open: 'The cited speaker recipe lists recurrence-control in_proj_a / in_proj_b, visual.*, mtp and lm_head as BF16 exceptions; recipe evidence is not a performance measurement.',
    sources: ['https://github.com/intel/auto-round', 'https://github.com/intel/auto-round/blob/main/docs/step_by_step.md', 'https://github.com/dbirks/home-k8s/blob/main/apps/qwen38-upload.yaml.hold'],
  }),
};
