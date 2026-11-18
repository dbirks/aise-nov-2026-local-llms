import type { Slide } from './deck/types';

// The new deck, started from scratch on 2026-11-18. Same design system, layouts and pixel-3D builders.
// The previous build lives in src/decks/route-v1.ts (open with ?deck=v1); its route slides are in
// src/slides/route/ and can be pulled in here with r('<id>') from './slides/route'.

export const slides: Slide[] = [
  {
    id: 'title',
    type: 'title',
    header: ['Engineering Local LLM Inference', 'AISE · November 2026'],
    headline: 'Beyond\n“It Runs”',
    chapters: [],
  },
];
