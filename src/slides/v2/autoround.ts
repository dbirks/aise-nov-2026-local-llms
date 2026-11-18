import type { Slide } from '../../deck/types';
import { slide as v1 } from '../route/c03';
import { chip } from './_ch';

// Variant A reuses v1 C03. 
export const slides: Slide[] = [{
  ...v1,
  id: "autoround-a",
  variant: 'A',
  chip: chip(4),
  caption: {
    title: "Tune the rounding, don’t just round",
    body: "AutoRound nudges how each weight rounds so the layer’s output stays closer to the original. Then you test it on data it wasn’t tuned on.",
  },
  notes: "v2 autoround · reuses v1 C03. " + (v1.notes ?? ''),
} as Slide];
