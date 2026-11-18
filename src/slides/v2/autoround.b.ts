import type { Slide } from '../../deck/types';
import { chip } from './_ch';
import { meta } from '../route/_meta';

export const slides: Slide[] = [{
  id: 'autoround-b', variant: 'B', type: 'scene', scene: 'autoround-balance', chip: chip(4),
  caption: { title: 'Round some weights the other way', body: 'Plain rounding pushed every error the same direction here, so they added up. AutoRound flips one, and the output lands much closer — on this input.' },
  controls: [{ kind: 'choice', action: 'input', label: 'input', options: [{ label: 'calibration', value: 'cal' }, { label: 'similar', value: 'held1' }, { label: 'different', value: 'held2' }], initial: 'cal' }],
  notes: meta({ id: 'autoround-b', claim: 'AutoRound tunes a per-weight rounding offset so block output error on calibration inputs shrinks; the gain can vanish on other inputs.', evidence: ['MECHANISM', 'SYNTHETIC DEMO'], simulated: 'One 4-weight row (w = [0.52, 0.52, -0.52, 0.32], s = 0.20) and three toy input vectors; every error is computed in the builder.', not: 'AutoRound retrains the model; calibration error equals real-task quality; tuned rounding is better on every input.', open: 'Which held-out test (if any) caught a regression in the speaker’s own quants.', sources: ['https://arxiv.org/abs/2309.05516', 'https://github.com/intel/auto-round', 'https://huggingface.co/dbirks/Qwen3.8-27B-NVFP4-AutoRound'] }),
}];
