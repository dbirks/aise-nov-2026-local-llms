import type { Slide } from '../../deck/types';
import { slide as v1 } from '../route/d02';
import { chip } from './_ch';

// Variant A reuses v1 D02. 
export const slides: Slide[] = [{
  ...v1,
  id: "batching-a",
  variant: 'A',
  chip: chip(6),
  caption: {
    title: "One read of the weights, several requests",
    body: "Each decode step reads every weight from memory anyway, so serving several requests in that step costs little extra. Total throughput goes up even when each user’s speed doesn’t.",
  },
  notes: "v2 batching · reuses v1 D02. " + (v1.notes ?? ''),
} as Slide];
