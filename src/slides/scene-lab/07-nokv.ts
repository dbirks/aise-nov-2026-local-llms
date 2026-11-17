import type { Slide } from '../../deck/types';

export const slides: Slide[] = [{
  id: 'lab-nokv',
  type: 'scene',
  scene: 'nokv',
  example: true,
  chip: 'LAB — No KV cache',
  caption: {
    title: 'Why the KV cache exists',
    body: 'No cache: every new token re-runs the whole prefix. Cache: prefill once, then only the new position runs — and its query still reads every stored key/value.',
  },
  controls: [
    {
      kind: 'choice', action: 'prompt', label: 'prompt tokens', initial: 16,
      options: [{ label: '4', value: 4 }, { label: '16', value: 16 }],
    },
  ],
  notes: 'Brief: README "Scene Q" + "What a forward pass does, with no KV cache". '
    + 'Counted in TOKEN POSITIONS PER PASS, exactly as the README warns: not attention FLOPs, not per-layer/per-head vectors, not a speedup or a latency. '
    + 'Naive total = Σ(P+j) for j=0..T (the prompt plus every already-generated token, re-executed to emit the next token); cached total = P prefill + T new positions; '
    + '"k/v read" = the earlier positions each new query attends to, Σ(P+j) for j=1..T, drawn on the SAME scale as the naive meter — that is why it nearly matches it. '
    + 'Both are polynomial (README: PT + T(T−1)/2, up to cubic attention work), never exponential. '
    + 'ILLUSTRATIVE: 6 layers for a real model\'s many dozens, 4/16 prompt tokens and 6/10 generated, cubes drawn as one per position per layer (a real KV entry is a contextual K/V feature vector per layer per KV head, not a token ID), '
    + 'prefill shown as one wall sweep, and the left lane\'s empty rail ignores that naive runtimes may still keep activations around. '
    + 'Real kernels (FlashAttention, MLA, GQA, sliding windows, hybrid/recurrent layers) change the memory-movement constants entirely; the cached lane also still applies the dense weights to the new token — the cache removes recomputation, not all work. '
    + 'No hardware, model or measured throughput is claimed.',
}];
