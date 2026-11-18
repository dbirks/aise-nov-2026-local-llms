import type { Slide } from '../../deck/types';
import { chip } from './_chapters';
import { meta } from './_meta';
import { slides as base } from '../scene-lab/09-drafters';

// E02 — reuses an existing builder with route copy (handoff §3 E02).
export const slide: Slide = {
  ...(base[0] as Extract<Slide, { type: 'scene' }>),
  id: 'e02',
  example: false,
  chip: chip(4),
  caption: {
    title: "Where the guesses come from",
    body: "MTP heads are extra prediction heads trained into the target model; EAGLE-3 is a small separate drafter fed the target’s features. Both guess one step at a time, checked by the same verifier.",
  },
  controls: [{ kind: 'choice', action: 'drafter', label: 'drafter', options: [{ label: 'MTP', value: 'mtp' }, { label: 'EAGLE-3', value: 'eagle' }], initial: 'mtp' }, { kind: 'choice', action: 'k', label: 'draft slots', options: [{ label: '4', value: 4 }, { label: '8', value: 8 }], initial: 4 }],
  notes: meta({
    id: "E02",
    claim: "native MTP heads and EAGLE-3 are different sources of lookahead",
    evidence: ["MECHANISM", "SYNTHETIC DEMO"],
    simulated: "accept pattern identical for both, illustrative",
    not: "MTP gives an arbitrary number of tokens for free; every model’s MTP layout is identical; any speedup",
    reuses: "drafters (scene lab)",
    sources: ["https://docs.vllm.ai/projects/speculators/en/latest/user_guide/algorithms/decision_guide/", "EAGLE-3: arXiv:2503.01840"],
  }),
};
