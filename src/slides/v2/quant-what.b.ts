import type { Slide } from '../../deck/types';
import { chip } from './_ch';
import { meta } from '../route/_meta';

export const slides: Slide[] = [{
  id: 'quant-what-b', variant: 'B', type: 'scene', scene: 'quant-haze', chip: chip(4),
  caption: { title: 'Fewer bits, fuzzier arrows', body: 'Each number snaps to the nearest allowed level, and one scale stretches the levels back. At 4 bits the arrows land close to where they were, but not exactly.' },
  controls: [{ kind: 'choice', action: 'bits', label: 'bits', options: [16, 8, 4, 3, 2].map(value => ({ label: String(value), value })), initial: 4 }],
  notes: meta({ id: 'quant-what-b', claim: 'A shared scale maps coordinates to discrete integer levels.', evidence: ['MECHANISM', 'SYNTHETIC DEMO'], simulated: 'Hand-placed word vectors and shared-scale rounding; most model weights are layer matrices.', not: 'Decimal truncation, uniform error, guaranteed speedup, or embedding-only quantization.', open: 'Research packet pending.', sources: ['https://huggingface.co/docs/transformers/main/en/quantization/overview', 'docs/research/v2/embed-quant.md'] }),
}];
