import type { Slide } from '../../deck/types';

export const slide: Slide = {
  id: 'prefill',
  type: 'scene',
  scene: 'prefill',
  chip: '03 — Make it fast',
  caption: {
    title: 'Prefill reads once, decode rereads',
    body: 'The prompt goes through in one parallel pass (compute-heavy). Every generated token re-reads all the weights (bandwidth-heavy).',
  },
  controls: [
    { kind: 'choice', action: 'N', label: 'prompt', options: [4, 16, 64].map(v => ({ label: String(v), value: v })), initial: 16 },
    { kind: 'choice', action: 'restart', label: 'restart', options: [{ label: 'run again', value: 1 }], initial: 0 },
  ],
  notes: 'Illustrative: 8 layers, ratios not measured times, and no absolute latency claims. Each meter unit is one complete read of all the weights — one pass for the whole prompt, then one per generated token. '
    + 'Batching, KV-cache reads (which grow with context) and chunked prefill are not shown: engines interleave prefill chunks with decode steps, so "prefill blocks everything" is version/scheduler-dependent (default-on in vLLM V1, decode-prioritising). '
    + 'Two separate axes: time-to-first-token (prefill, compute) vs per-token latency (decode, bandwidth) — and per-user latency vs aggregate throughput. Source: Kwon et al., arXiv:2211.05102.',
};
