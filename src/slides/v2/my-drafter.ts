import type { Slide } from '../../deck/types';
import { slide as v1 } from '../route/e05';
import { chip } from './_ch';

// Variant A reuses v1 E05. evidence: SPEAKER OBSERVATION / MEASURED ON SPEAKER SYSTEM (issues #72, #80).
export const slides: Slide[] = [{
  ...v1,
  id: "my-drafter-a",
  variant: 'A',
  chip: chip(7),
  caption: {
    title: "I trained my own drafter",
    body: "Collect what the model actually says, train a small drafter on its hidden states, then convert and serve it. If you want to try it: vLLM’s speculators.",
  },
  notes: "v2 my-drafter · reuses v1 E05. " + (v1.notes ?? ''),
} as Slide];
