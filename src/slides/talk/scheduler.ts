import type { Slide } from '../../deck/types';

export const slide: Slide = {
  id: 'scheduler',
  type: 'scene',
  scene: 'scheduler',
  chip: '04 — Serve it',
  caption: {
    title: 'The scheduler spends a budget',
    body: 'Every step gets a token budget. Running requests decode one token each, one new request prefills in chunks, the rest wait — your flags decide who waits.',
  },
  controls: [
    { kind: 'choice', action: 'seqs', label: 'max-num-seqs', options: [2, 4, 6].map(v => ({ label: String(v), value: v })), initial: 4 },
    { kind: 'choice', action: 'budget', label: 'token budget', options: [8, 16, 32].map(v => ({ label: String(v), value: v })), initial: 16 },
    { kind: 'choice', action: 'rate', label: 'arrivals', options: [{ label: 'low', value: 'low' }, { label: 'high', value: 'high' }], initial: 'high' },
  ],
  notes: 'Modelled on vLLM V1’s unified scheduler: one forward step spends a fixed token budget handed out per request, which is what lets chunked prefill, prefix caching and speculation share one loop '
    + '(docs.vllm.ai v1_user_guide, configuration/optimization). Illustrative, not measured: cells, prompt lengths, token counts and arrivals come from a seeded PRNG, one cell = one token slot, and nothing here is latency or tokens/s. '
    + 'Per-user latency and aggregate throughput are separate axes this scene does not measure; a column stopping under the ceiling means leftover budget (an admit limit or an empty queue), not an idle GPU. '
    + 'Simplifications: decode requests are served first and only one prefill chunk per step is drawn — engines also pack several chunks into a step and may preempt or recompute running requests under pressure, neither of which is shown here. '
    + 'Policy is version-specific — vLLM, llama.cpp and Ollama expose different knobs (llama.cpp --parallel / --batch-size / --ubatch-size are not one "batch size"), and the iteration-level idea is from Orca (OSDI 2022).',
};
