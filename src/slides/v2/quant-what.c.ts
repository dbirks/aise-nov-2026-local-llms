import type { Slide } from '../../deck/types';
import { chip } from './_ch';
import { meta } from '../route/_meta';

export const slides: Slide[] = [{
  id: 'quant-what-c', variant: 'C', type: 'scene', scene: 'quant-levels', chip: chip(4),
  caption: { title: 'What fewer bits actually does', body: 'Every number has to land on one of a few allowed levels. Fewer bits means fewer levels, so the rounding error grows.' },
  controls: [
    { kind: 'choice', action: 'bits', label: 'bits', options: [16, 8, 4, 3, 2].map(value => ({ label: String(value), value })), initial: 16 },
    { kind: 'choice', action: 'word', label: 'word', options: ['France', 'Germany', 'Italy', 'Hitler', 'Mussolini', 'baguette', 'pumpernickel'].map(value => ({ label: value, value })), initial: 'Germany' },
  ],
  notes: meta({ id: 'quant-what-c', claim: 'Coordinates round to shared-scale integer levels.', evidence: ['MECHANISM', 'SYNTHETIC DEMO'], simulated: 'Hand-placed word vectors and shared-scale rounding; most model weights are layer matrices.', not: 'Decimal truncation, uniform error, guaranteed speedup, or embedding-only quantization. Individual rounding errors need not grow monotonically.', open: 'Research packet pending.', sources: ['https://huggingface.co/docs/transformers/main/en/quantization/overview', 'docs/research/v2/embed-quant.md'] }),
}];
