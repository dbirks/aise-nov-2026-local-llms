import type { Slide } from '../../deck/types';

export const slide: Slide = {
  id: 'kvcache',
  type: 'scene',
  scene: 'kvcache',
  chip: '02 — Make it fit',
  caption: {
    title: 'KV cache is a per-token bill',
    body: 'Every kept token costs K and V bytes in every layer, for every request in flight. What is left after the weights — not compute — decides how many fit.',
  },
  controls: [
    { kind: 'choice', action: 'requests', label: 'requests', options: [1, 2, 4].map(v => ({ label: String(v), value: v })), initial: 2 },
    { kind: 'choice', action: 'dtype', label: 'kv dtype', options: [{ label: 'fp16', value: 'fp16' }, { label: 'fp8', value: 'fp8' }], initial: 'fp16' },
    { kind: 'choice', action: 'cap', label: 'max len', options: ['1k', '4k', '16k'].map(v => ({ label: v, value: v })), initial: '16k' },
  ],
  notes: 'Scale is illustrative: 6 layers, 32 visible token slots and the "GiB-ish" budget are invented for legibility, and the max-model-len posts mark a logical limit, not a byte count. '
    + 'Allocation is shown page-wise (vLLM PagedAttention, SOSP 2023); engines differ — llama.cpp reserves differently, hybrid layers keep other state, and context length is never a fully preallocated cache. '
    + 'fp8 here only halves the bytes stored: it does not promise throughput, and in vLLM it can also move attention into the fp8 domain. Prefill vs decode is not modelled — every tick is one decode token per request.',
};
