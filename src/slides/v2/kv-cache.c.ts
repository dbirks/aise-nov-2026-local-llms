import type { Slide } from '../../deck/types';
import { chip } from './_ch';
import { meta } from '../route/_meta';

export const slides: Slide[] = [{
  id: 'kv-cache-c',
  variant: 'C',
  type: 'scene',
  scene: 'kv-work',
  chip: chip(5),
  caption: {
    title: 'Work per new token',
    body: 'Without a cache, token n redoes all n tokens before it, so the total grows with the square. With a cache, each step computes only the new token, though it still reads the whole cache.',
  },
  controls: [{
    kind: 'choice',
    action: 'n',
    label: 'tokens',
    options: [
      { label: '4', value: 4 },
      { label: '8', value: 8 },
      { label: '12', value: 12 },
    ],
    initial: 12,
  }],
  notes: meta({
    id: 'kv-cache-c',
    claim: 'Without a KV cache, token-steps grow quadratically as n(n+1)/2; with a KV cache, each step computes 1 new token while reading prior cached K/V.',
    evidence: ['MECHANISM'],
    simulated: '4, 8, or 12 token steps shown as side-by-side staircases.',
    not: 'attention cost per step is constant with a cache (it still reads all cached K/V); the cache is free',
    sources: [
      'docs/research/v2/kv-serving.md',
      'https://arxiv.org/abs/2309.06180',
    ],
  }),
}];
