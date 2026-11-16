import type { Slide } from '../../deck/types';

export const slide: Slide = {
  id: 'kvledger',
  type: 'scene',
  scene: 'kvledger',
  chip: '02 — Make it fit',
  caption: {
    title: 'Local layers forget; global layers don’t',
    body: 'Sliding-window layers drop old KV, global layers keep every token — so a hybrid model’s cache still grows with context.',
  },
  controls: [
    {
      kind: 'choice', action: 'pattern', label: 'layers',
      options: [
        { label: 'all global', value: 'all-global' },
        { label: 'all local', value: 'all-local' },
        { label: '3 local : 1 global', value: 'hybrid 3:1' },
      ],
      initial: 'hybrid 3:1',
    },
    { kind: 'choice', action: 'W', label: 'window', options: [8, 16, 32].map(v => ({ label: String(v), value: v })), initial: 16 },
    { kind: 'toggle', action: 'arcs', label: 'attn inset', initial: true },
  ],
  notes: 'One tile = one token’s KV block in one layer; dark = still resident, pale + shrivelled = released. '
    + 'Bars are proportional to resident KV bytes (2 · kv_heads · head_dim · dtype bytes per token, the same '
    + 'constant for every layer), so only the tile count moves: per-layer bars cap at the window on local '
    + 'layers, global layers keep stretching, and the total bar grows linearly with context at a smaller slope. '
    + 'Scale is illustrative — real sliding windows are ~1–4k tokens and the interleaving ratio varies (Gemma 3 '
    + 'uses 5:1, this stand-in is 3:1). The inset arcs (lowest local layer) are synthetic attention weights '
    + '(recency + a first-token sink + a few key tokens); they show which KV a query reads, not measured scores. '
    + 'In all-global mode the inset falls back to layer 0 and reads its whole history. Not shown: some hybrid models replace attention in some layers with fixed-size recurrent/linear-attention '
    + 'state instead of dropping KV; KV dtype and paging are separate scenes.',
};
