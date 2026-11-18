import type { Slide } from '../../deck/types';
import { slide as v1 } from '../route/a02';
import { chip } from './_ch';

// Variant A reuses v1 A02. 
export const slides: Slide[] = [{
  ...v1,
  id: "train-vs-infer-a",
  variant: 'A',
  chip: chip(2),
  caption: {
    title: "Training writes the weights. Inference reads them.",
    body: "Training learns patterns from a huge pile of text and saves them as a file of numbers, the weights. Inference runs those fixed numbers to predict the next token.",
  },
  notes: "v2 train-vs-infer · reuses v1 A02. " + (v1.notes ?? ''),
} as Slide];
