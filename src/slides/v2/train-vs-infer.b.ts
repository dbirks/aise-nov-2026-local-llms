import type { Slide } from '../../deck/types';
import { chip } from './_ch';
import { meta } from '../route/_meta';

export const slides: Slide[] = [{
  id: 'train-vs-infer-b',
  variant: 'B',
  type: 'scene',
  scene: 'train-write',
  chip: chip(2),
  caption: {
    title: 'Training writes the weights. Inference reads them.',
    body: 'During training, every step nudges the numbers in the weights file. Once training stops, the file is frozen and inference only reads it.',
  },
  controls: [{
    kind: 'choice',
    action: 'mode',
    label: 'mode',
    options: [
      { label: 'training', value: 'train' },
      { label: 'inference', value: 'infer' },
    ],
    initial: 'train',
  }],
  notes: meta({
    id: 'train-vs-infer-b',
    claim: 'Training updates weights via backward passes while inference runs fixed weights read-only.',
    evidence: ['MECHANISM', 'SYNTHETIC DEMO'],
    simulated: '4 toy layer slabs of 6×6 weight cubes with seeded random nudges and step counter.',
    not: 'inference learns from your prompts; a 6×6 grid is a real layer',
    sources: [
      'docs/research/v2/setup.md',
      'https://huggingface.co/docs/safetensors',
      'https://github.com/ggml-org/ggml/blob/master/docs/gguf.md',
    ],
  }),
}];
