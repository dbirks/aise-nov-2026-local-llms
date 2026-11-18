import type { Slide } from '../../deck/types';
import { slide as v1 } from '../route/c01';
import { chip } from './_ch';

// Variant A reuses v1 C01. 
export const slides: Slide[] = [{
  ...v1,
  id: "quant-what-a",
  variant: 'A',
  chip: chip(4),
  caption: {
    title: "Quantization stores each number with fewer levels",
    body: "Each value snaps to the nearest of a few allowed levels, and one scale per block stretches them back. The answer comes out slightly different.",
  },
  notes: "v2 quant-what · reuses v1 C01. " + (v1.notes ?? ''),
} as Slide];
