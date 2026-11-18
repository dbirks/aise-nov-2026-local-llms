import type { Slide } from '../../deck/types';
import { slide as v1 } from '../route/e02';
import { chip } from './_ch';

// Variant A reuses v1 E02. 
export const slides: Slide[] = [{
  ...v1,
  id: "mtp-a",
  variant: 'A',
  chip: chip(7),
  caption: {
    title: "MTP: the model drafts for itself",
    body: "Some models ship extra prediction layers trained alongside them. They guess the next few tokens from the model’s own state.",
  },
  notes: "v2 mtp · reuses v1 E02. " + (v1.notes ?? ''),
} as Slide];
