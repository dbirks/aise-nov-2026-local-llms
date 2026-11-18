import type { Slide } from '../../deck/types';
import { slide as v1 } from '../route/f02';
import { chip } from './_ch';

// Variant A reuses v1 F02. Verify both designs in P2.
export const slides: Slide[] = [{
  ...v1,
  id: "ngram-tables-a",
  variant: 'A',
  chip: chip(8),
  caption: {
    title: "Lookup tables for common phrases",
    body: "Qwen and DeepSeek both added tables indexed by the last few tokens. They differ in what they store and where the table lives.",
  },
  notes: "v2 ngram-tables · reuses v1 F02. " + (v1.notes ?? ''),
} as Slide];
