import type { Slide } from '../../deck/types';
import { slide as v1 } from '../route/c02';
import { chip } from './_ch';

// Variant A reuses v1 C02. 
export const slides: Slide[] = [{
  ...v1,
  id: "quant-types-a",
  variant: 'A',
  chip: chip(4),
  caption: {
    title: "Four bits isn’t one format",
    body: "INT4 spaces its 16 levels evenly. NVFP4 doesn’t, and every block of 16 values shares one scale.",
  },
  notes: "v2 quant-types · reuses v1 C02. " + (v1.notes ?? ''),
} as Slide];
