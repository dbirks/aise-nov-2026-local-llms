import type { Slide } from '../../deck/types';
import { slide as v1 } from '../route/b03';
import { chip } from './_ch';

// Variant A reuses v1 B03. OPTIONAL: needs the speaker’s yes.
export const slides: Slide[] = [{
  ...v1,
  id: "moe-a",
  variant: 'A',
  chip: chip(4),
  caption: {
    title: "35B stored, about 3B used per token",
    body: "A mixture-of-experts model sends each token to a few expert blocks. All of them still have to fit in memory.",
  },
  notes: "v2 moe · reuses v1 B03. " + (v1.notes ?? ''),
} as Slide];
