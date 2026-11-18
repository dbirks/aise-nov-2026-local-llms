import type { Slide } from '../../deck/types';
import { chip } from './_ch';
import { meta } from '../route/_meta';

export const slides: Slide[] = [{
  id: 'embed-vec-c', variant: 'C', type: 'scene', scene: 'embed-unroll', chip: chip(4),
  caption: { title: 'Three numbers is a toy', body: 'A plot can only show three numbers. A real model keeps thousands per token, so any picture of it is a projection.' },
  controls: [{ kind: 'choice', action: 'dims', label: 'numbers per token', options: [{ label: '3', value: 3 }, { label: '64', value: 64 }, { label: 'thousands', value: 4096 }], initial: 3 }],
  notes: meta({ id: 'embed-vec-c', claim: 'Three numbers is a toy', evidence: ['SYNTHETIC DEMO', 'MECHANISM'],
    simulated: 'Hand-placed coordinates and generated ribbon values.',
    not: 'These are real model coordinates; the 3D axes mean anything; static word vectors behave like contextual hidden states; analogies always work in real LLMs.',
    open: 'exact hidden_size for Qwen3.8-27B', sources: ['https://arxiv.org/abs/1301.3781 (Mikolov et al. 2013, word2vec)', 'Qwen3.8-27B config.json hidden_size — verify (docs/research/v2/embed-quant.md)'] }),
}];
