import type { Slide } from '../../deck/types';
import { head } from './_ch';

// PLACEHOLDER until P3 builds the 3D variants. evidence: SPEAKER OBSERVATION (20 s), MECHANISM (traffic direction)
export const slides: Slide[] = [{
  id: "setup-slow-link",
  type: 'list',
  header: head(3),
  title: "A slow link is fine",
  items: ["The ~20 GB of weights cross the cable once. Loading takes about 20 seconds.", "After that, the weights and the cache stay on the card, and very little crosses per token."],
  example: true,
  notes: "evidence: SPEAKER OBSERVATION (20 s), MECHANISM (traffic direction)",
}];
