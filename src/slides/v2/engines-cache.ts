import type { Slide } from '../../deck/types';
import { slide as v1 } from '../route/d04';
import { chip } from './_ch';

// Variant A reuses v1 D04. Verify each engine’s current behaviour in P2.
export const slides: Slide[] = [{
  ...v1,
  id: "engines-cache-a",
  variant: 'A',
  chip: chip(6),
  caption: {
    title: "Three engines, three ways to find a shared start",
    body: "vLLM hashes fixed-size blocks, SGLang walks a tree of token sequences, and llama.cpp matches per slot.",
  },
  notes: "v2 engines-cache · reuses v1 D04. " + (v1.notes ?? ''),
} as Slide];
