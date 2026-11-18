import type { Slide } from '../../deck/types';
import { slide as v1 } from '../route/e03';
import { chip } from './_ch';

// Variant A reuses v1 E03. 
export const slides: Slide[] = [{
  ...v1,
  id: "block-drafters-a",
  variant: 'A',
  chip: chip(7),
  caption: {
    title: "DFlash, DSpark, DFlash2: a whole block at once",
    body: "These draft several tokens in parallel instead of one at a time. Each leans on the big model’s state in a different way.",
  },
  notes: "v2 block-drafters · reuses v1 E03. " + (v1.notes ?? ''),
} as Slide];
