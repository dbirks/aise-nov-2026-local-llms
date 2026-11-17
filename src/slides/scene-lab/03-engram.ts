import type { Slide } from '../../deck/types';

export const slides: Slide[] = [{
  id: 'lab-engram',
  type: 'scene',
  scene: 'engram',
  example: true,
  chip: 'LAB — Engram / PLE',
  caption: {
    title: 'Lookups per token, not session',
    body: 'The recent token IDs hash to a few rows of a huge static table; every processed position fuses them into one layer. A cached prefix is not replayed.',
  },
  controls: [
    {
      kind: 'choice', action: 'mode', label: 'mode',
      options: [{ label: 'prefill', value: 'prefill' }, { label: 'decode', value: 'decode' }, { label: 'cached prefix', value: 'cache' }],
      initial: 'prefill',
    },
    { kind: 'choice', action: 'ngram', label: 'n-gram', options: [2, 3].map(v => ({ label: String(v), value: v })), initial: 3 },
    { kind: 'toggle', action: 'collision', label: 'hash collision', initial: false },
  ],
  notes: 'Brief: README "Scene J" + "Scene S". Everything on screen is illustrative and simulated: a 40×24 toy table, 16 token positions, toy token IDs, n-gram orders 2–3 with 2 hash '
    + 'heads each and 5 layer plates — real row counts, orders, table capacity and dimensions come from a specific model config, not from this scene, and no fused token-weight '
    + 'vectors are shown. What the scene is trying to be accurate about: the city is a static weight tensor loaded once (its arrival is animated once, never replayed), the addresses '
    + 'are computed deterministically from recent token IDs, lookups happen for every newly processed position in prefill and decode, and a reused prefix is not recomputed even though '
    + 'the first suffix windows still read its token IDs. Not modelled: physical fetch tier (host RAM vs NVMe PLE staging/prefetch) versus logical lookup, learned relevance/suppression '
    + 'gating, DeepSeek-V4.1 Engram vs Qwen PLE profile differences, and any latency or throughput figure. The collision toggle is a toy-table property of hashing, not a measured rate.',
}];
