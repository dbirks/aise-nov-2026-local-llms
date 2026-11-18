import type { Slide } from '../../deck/types';
import { slide as v1 } from '../route/c05';
import { chip } from './_ch';

// Variant A reuses v1 C05. 
export const slides: Slide[] = [{
  ...v1,
  id: "kv-cache-a",
  variant: 'A',
  chip: chip(5),
  caption: {
    title: "Remember instead of redo",
    body: "Without a cache, token 10,000 means redoing the work for tokens 1 through 9,999. The KV cache keeps that work in VRAM, so each new token is one small step.",
  },
  notes: "v2 kv-cache · reuses v1 C05. " + (v1.notes ?? ''),
} as Slide];
