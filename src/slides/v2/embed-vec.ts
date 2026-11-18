import type { Slide } from '../../deck/types';
import { chip } from './_ch';
import { meta } from '../route/_meta';

export const slides: Slide[] = [{
  id: 'embed-vec-a', variant: 'A', type: 'scene', scene: 'embed-vec', chip: chip(4),
  caption: { title: 'Each word becomes a list of numbers', body: 'Here every word is three numbers, so we can draw it as an arrow. In a real model like Qwen3.8-27B, each token is thousands of numbers long.' },
  controls: [{ kind: 'choice', action: 'word', label: 'word', options: ['France', 'Germany', 'Italy', 'Hitler', 'Mussolini', 'baguette', 'pumpernickel'].map(word => ({ label: word, value: word })), initial: 'France' }],
  notes: meta({ id: 'embed-vec-a', claim: 'Each word becomes a list of numbers', evidence: ['SYNTHETIC DEMO', 'MECHANISM'],
    simulated: 'Hand-placed coordinates and generated ribbon values.',
    not: 'These are real model coordinates; the 3D axes mean anything; static word vectors behave like contextual hidden states; analogies always work in real LLMs.',
    open: 'exact hidden_size for Qwen3.8-27B', sources: ['https://arxiv.org/abs/1301.3781 (Mikolov et al. 2013, word2vec)', 'Qwen3.8-27B config.json hidden_size — verify (docs/research/v2/embed-quant.md)'] }),
}];
