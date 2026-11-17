import type { Slide } from '../../deck/types';

const BODY = 'One token axis, one verifier. Only the drafter changes: heads chained inside the target, a small '
  + 'separate tower drafting one slot at a time, or one parallel block.';

export const slides: Slide[] = [
  {
    id: 'lab-drafters',
    type: 'scene',
    scene: 'drafters',
    example: true,
    chip: 'LAB — Drafter families',
    caption: {
      title: 'Same verifier, four drafters',
      body: BODY,
    },
    controls: [
      {
        kind: 'choice', action: 'drafter', label: 'drafter',
        options: [
          { label: 'MTP', value: 'mtp' },
          { label: 'EAGLE-3', value: 'eagle' },
          { label: 'DFlash', value: 'dflash' },
          { label: 'DSpark', value: 'dspark' },
        ],
        initial: 'mtp',
      },
      {
        kind: 'choice', action: 'k', label: 'draft slots K',
        options: [{ label: '4', value: 4 }, { label: '8', value: 8 }],
        initial: 8,
      },
    ],
    notes: 'Brief: README speculative decoding family — same target verifier, different drafting mechanism. '
      + 'WHAT IS REAL: MTP = learned future-token heads that can live inside the target model, chained slot to slot (K steps, not one '
      + 'zero-cost shot for every position); EAGLE-3 = feature-conditioned lightweight autoregressive drafter, one slot per small step, '
      + 'chain or tree; DFlash = target-feature-conditioned parallel block drafter, K masked slots filled in one draft pass; '
      + 'DSpark = DFlash plus a lightweight Markov head between neighbouring slots and a trained confidence head per slot. '
      + 'The bottom slab is the target model evaluating the drafted positions in parallel; only the accepted prefix commits — '
      + 'rejected descendants were conditioned on the wrong prefix, and distribution-preserving verification is rejection sampling, not equality testing. '
      + 'ILLUSTRATIVE / SIMULATED: the draft length, which slots are accepted (5/8 and 3/4 — identical for all four drafters so only the '
      + 'mechanism differs), the confidence bar heights and the greyed suffix, and which slot carries the extra branch candidate '
      + '(EAGLE-3 drafts a chain or a tree — the tree is optional in practice). No measured accept lengths, proposal costs, GPU times or '
      + 'speedups are shown, and none should be implied from the animation. DSpark confidence scores only drive adaptive verification '
      + 'scheduling when the serving runtime implements that scheduler.',
  },
];
