import type { Slide } from '../../deck/types';
import { chip } from './_chapters';
import { meta } from './_meta';

// E01 — reuses the original `spec` scene (pixel-viz.js) with route copy (handoff §3 E01).
export const slide: Slide = {
  id: 'e01',
  type: 'scene',
  scene: 'spec',
  chip: chip(4),
  caption: {
    title: 'Guess ahead, check in one pass',
    body: 'A cheap drafter guesses a few tokens and the big model checks them all in one pass, keeping the valid prefix: speculative decoding. With sampling, the check is min(1, p/q), not string matching.',
  },
  controls: [
    { kind: 'choice', action: 'K', label: 'K', options: [3, 5, 7].map(v => ({ label: String(v), value: v })), initial: 5 },
    { kind: 'choice', action: 'p', label: 'accept', options: [0.5, 0.7, 0.9].map(v => ({ label: String(v), value: v })), initial: 0.7 },
    { kind: 'choice', action: 'mode', label: 'verify', options: [{ label: 'greedy', value: 'greedy' }, { label: 'sampling', value: 'sampling' }], initial: 'greedy' },
  ],
  notes: meta({
    id: 'E01',
    claim: 'speculative decoding can reduce sequential target passes; rejected tokens invalidate their descendants',
    evidence: ['MECHANISM', 'SYNTHETIC DEMO'],
    simulated: 'fixed per-token acceptance, seeded p/q in sampling mode',
    not: 'accepted tokens × tok/s = speedup; sampling correctness is string equality; a slow drafter can never regress (it can — not drawn)',
    reuses: 'spec (talk)',
    open: 'draft-cost / net-regression mode (V3) not built',
    sources: ['https://docs.vllm.ai/en/latest/features/speculative_decoding/', 'Leviathan et al., ICML 2023 (arXiv:2211.17192)'],
  }),
};
