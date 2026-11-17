import type { Slide } from '../../deck/types';

export const slides: Slide[] = [{
  id: 'lab-decode-pass',
  type: 'scene',
  scene: 'decode-pass',
  example: true,
  chip: 'LAB — One decode pass',
  caption: {
    title: 'One token, start to finish',
    body: 'One new token: weights stream from memory to cores, stored K/V is read, the residual climbs, one token is sampled — its K/V is appended. MoE streams 2 of 8 tiles.',
  },
  controls: [
    {
      kind: 'choice', action: 'arch', label: 'ffn', initial: 'dense',
      options: [{ label: 'dense', value: 'dense' }, { label: 'moe', value: 'moe' }],
    },
  ],
  notes: 'Brief: README "Scene F". '
    + 'ILLUSTRATIVE, not a per-transistor GPU model: 6 layers for a real model\'s dozens; one cube = one token\'s K/V for one layer (actually a feature vector per KV head); '
    + 'weight "tiles" and dark packets are representative per-layer byte traffic — weights sit resident in the slab and are re-read every token, nothing is moved into VRAM per pass and there is no whole-model transfer; '
    + 'the fixed 2-of-8 expert picks stand in for a learned router that chooses per token AND per layer (all experts stay stored — the dim tiles), and dense vs MoE differ in active weights, not total memory; '
    + '7 logits bars sketch a ~100k-way vocab with one sampled winner (sampling is stochastic, not argmax-by-construction); no SSD/offload path is shown per README. '
    + 'Memory hierarchy, sizes and timings are schematic simulated demo data — no hardware, bandwidth or throughput claim is made.',
}];
