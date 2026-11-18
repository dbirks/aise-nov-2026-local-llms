import type { Slide } from '../../deck/types';
import { slide as v1 } from '../route/d03';
import { chip } from './_ch';

// Variant A reuses v1 D03. 
export const slides: Slide[] = [{
  ...v1,
  id: "prefix-cache-a",
  variant: 'A',
  chip: chip(6),
  caption: {
    title: "Same first tokens, shared work",
    body: "Agents often start with the same system prompt and tool list. The engine can reuse the cached work for that shared start.",
  },
  notes: "v2 prefix-cache · reuses v1 D03. " + (v1.notes ?? ''),
} as Slide];
