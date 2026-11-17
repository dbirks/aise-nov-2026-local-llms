import type { Slide } from '../../deck/types';

const BODY = 'Each draft slot is fed the token before it. In training that is the true one, so a miss stays local. '
  + 'Serving feeds its own guess: one early miss poisons the rest.';

export const slides: Slide[] = [
  {
    id: 'lab-exposure',
    type: 'scene',
    scene: 'exposure',
    example: true,
    chip: 'LAB — Teacher-forced vs free-running',
    caption: {
      title: 'Training saw the answers',
      body: BODY,
    },
    controls: [
      {
        kind: 'choice', action: 'error', label: 'first wrong guess',
        options: [{ label: 'slot 1', value: 1 }, { label: 'slot 2', value: 2 }, { label: 'slot 4', value: 4 }],
        initial: 2,
      },
      { kind: 'toggle', action: 'refs', label: 'show references', initial: true },
    ],
    notes: 'Brief: README DSpark training story (home-k8s #80 exposure gap; #72 teacher-forced train/accept_len ≈ 2.0, explicitly not a speedup). '
      + 'WHAT IS REAL: teacher forcing conditions the drafter on the reference previous token, free-running serving conditions it on its own output, '
      + 'so an early miss changes the input distribution of every later slot in the draft — that is the mechanism drawn here (links = what is fed in). '
      + 'ILLUSTRATIVE / SIMULATED: the 8-slot draft, which slots miss, and both counts (6/8 vs 1/8) are invented for one position of one request; they are not '
      + 'measured accept_len for any model, and accept_len is not a speedup. Do not read the pale tiles as wrong output: the target verifier still rejects them — '
      + 'the loss is wasted draft work and a short accepted run. One position is shown; real drafts are resampled from many positions.',
  },
];
