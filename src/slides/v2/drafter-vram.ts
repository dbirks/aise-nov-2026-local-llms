import type { Slide } from '../../deck/types';
import { slide as v1 } from '../route/e04';
import { chip } from './_ch';

// Variant A reuses v1 E04. 
export const slides: Slide[] = [{
  ...v1,
  id: "drafter-vram-a",
  variant: 'A',
  chip: chip(7),
  caption: {
    title: "The drafter needs room too",
    body: "Its weights and its own cache come out of the same VRAM. That’s memory you can’t spend on context.",
  },
  notes: "v2 drafter-vram · reuses v1 E04. " + (v1.notes ?? ''),
} as Slide];
