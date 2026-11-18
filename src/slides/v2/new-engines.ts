import type { Slide } from '../../deck/types';
import { slide as v1 } from '../route/f01';
import { chip } from './_ch';

// Variant A reuses v1 F01. 
export const slides: Slide[] = [{
  ...v1,
  id: "new-engines-a",
  variant: 'A',
  chip: chip(8),
  caption: {
    title: "Newer engines: NInfer, Radiance, Pennyroyal",
    body: "Each one targets a narrower set of hardware and models. Fast where it’s supported, missing where it isn’t.",
  },
  notes: "v2 new-engines · reuses v1 F01. " + (v1.notes ?? ''),
} as Slide];
