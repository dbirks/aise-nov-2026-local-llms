import type { Slide } from '../../deck/types';
import { slide as v1 } from '../route/e01';
import { chip } from './_ch';

// Variant A reuses v1 E01. 
export const slides: Slide[] = [{
  ...v1,
  id: "spec-decode-a",
  variant: 'A',
  chip: chip(7),
  caption: {
    title: "Guess ahead, check in one pass",
    body: "A small drafter guesses a few tokens and the big model checks them all at once. The first wrong guess throws away everything after it.",
  },
  notes: "v2 spec-decode · reuses v1 E01. " + (v1.notes ?? ''),
} as Slide];
