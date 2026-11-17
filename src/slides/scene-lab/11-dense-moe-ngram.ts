import type { Slide } from '../../deck/types';

export const slides: Slide[] = [{
  id: 'lab-dense-moe-ngram',
  type: 'scene',
  scene: 'dense-moe-ngram',
  example: true,
  chip: 'LAB — Dense · MoE · n-gram',
  caption: {
    title: 'Three ways to add parameters',
    body: 'Same tokens, three mechanisms: every FFN block, top-k of eight experts, or hash-read rows of a huge weight table. A real model can combine them.',
  },
  controls: [
    {
      kind: 'choice', action: 'mode', label: 'mode',
      options: [{ label: 'dense', value: 'dense' }, { label: 'moe', value: 'moe' }, { label: 'n-gram', value: 'ngram' }],
      initial: 'dense',
    },
    { kind: 'choice', action: 'topk', label: 'top-k', options: [1, 2, 4].map(v => ({ label: String(v), value: v })), initial: 2 },
  ],
  notes: 'Brief: README "Dense vs MoE vs n-gram embedding tables: different scaling axes" — hold one token sequence fixed and switch between all-dense FFN, a 2-of-N router, '
    + 'and hash heads selecting table rows, with stored params / active compute / bytes fetched as separate gauges. '
    + 'WHAT THE SCENE KEEPS RIGHT: dense = every layer\'s feed-forward weights take part for this token, so stored weights and per-token computation rise together; MoE = a router sends '
    + 'each token through only the selected experts in MoE layers, so active compute drops while all stored experts still need storage or an offload strategy ("3B active" is not 3B '
    + 'resident); n-gram (PLE/Engram family) = local token IDs (here the previous + current token, bracketed) are hashed to rows of a *learned weight table* whose rows are read and '
    + 'injected as features — more capacity for relatively little math per token. It is NOT a third kind of MoE, NOT a KV cache, NOT a speculative n-gram matcher and NOT a routed MLP '
    + 'expert. The three modes are mechanisms, not mutually exclusive models: the Qwen3.8-Flash-Next card lists ~51B n-gram embedding parameters alongside its MoE layers, and home-k8s '
    + 'serves its FP8 ~47.68 GiB PLE table from NVMe (an immutable weight table, not prefix/KV caching). '
    + 'ILLUSTRATIVE / SIMULATED: 4 layers, 8 experts, top-k 1/2/4, a 128-row toy table with 4 rows read per token, which layer receives the injection, the per-token cascade timing and '
    + 'ALL gauge heights (relative bars, dense = 1). No parameter counts, byte counts, GiB values, latency, throughput or speedups are shown and none should be read off the bars — the '
    + 'real ratios for a specific checkpoint come from its model card and a measured run.',
}];
