import type { Slide } from '../../deck/types';
import { slide as v1 } from '../route/a03';
import { chip } from './_ch';

// Variant A reuses v1 A03. 
export const slides: Slide[] = [{
  ...v1,
  id: "close-a",
  variant: 'A',
  chip: chip(10),
  caption: {
    title: "Which trade-offs fit your hardware and your work?",
    body: "There’s no best setup, only the one that fits your models, your hardware and what you run on it.",
  },
  notes: "v2 close · reuses v1 A03. " + (v1.notes ?? ''),
} as Slide];
