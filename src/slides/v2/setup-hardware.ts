import type { Slide } from '../../deck/types';
import { slide as v1 } from '../route/b01';
import { chip } from './_ch';

// Variant A reuses v1 B01. Prices left out until a dated source is found (plan open questions).
export const slides: Slide[] = [{
  ...v1,
  id: "setup-hardware-a",
  variant: 'A',
  chip: chip(3),
  caption: {
    title: "Room or speed",
    body: "One kind of box gives you 128 GB of slower unified memory, another 32 GB of much faster GPU memory. Capacity decides what fits; bandwidth decides how fast it runs.",
  },
  notes: "v2 setup-hardware · reuses v1 B01. " + (v1.notes ?? ''),
} as Slide];
