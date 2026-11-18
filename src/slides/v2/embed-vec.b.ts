import type { Slide } from '../../deck/types';
import { chip } from './_ch';
import { meta } from '../route/_meta';

export const slides: Slide[] = [{
  id: 'embed-vec-b', variant: 'B', type: 'scene', scene: 'embed-analogy', chip: chip(4),
  caption: { title: 'Similar words, similar directions', body: 'In this toy, the step from Germany to Hitler is the same arrow as Italy to Mussolini. Real models show this only roughly, and only for some words.' },
  controls: [{ kind: 'choice', action: 'relation', label: 'relation', options: [{ label: 'leader', value: 'leader' }, { label: 'food', value: 'food' }], initial: 'leader' }],
  notes: meta({ id: 'embed-vec-b', claim: 'Similar words, similar directions', evidence: ['SYNTHETIC DEMO', 'MECHANISM'],
    simulated: 'Hand-placed coordinates and generated ribbon values.',
    not: 'These are real model coordinates; the 3D axes mean anything; static word vectors behave like contextual hidden states; analogies always work in real LLMs.',
    open: 'exact hidden_size for Qwen3.8-27B', sources: ['https://arxiv.org/abs/1301.3781 (Mikolov et al. 2013, word2vec)', 'Qwen3.8-27B config.json hidden_size — verify (docs/research/v2/embed-quant.md)'] }),
}];
