import type { Slide } from '../deck/types';

// Deck v4, started 2026-11-18: slimmed down, built slide by slide from the speaker's list.
// Each slide is a heading or one short phrase. No animation by default.
// Served at the root and at /4/. Archives: v3 /3/, v2 /2/, v1 /1/.

export const slides: Slide[] = [
  {
    id: 'title',
    type: 'title',
    header: ['', 'AISE · November 2026'],
    headline: 'Configuring\nLocal LLMs',
    headlineSize: 215,
    chapters: [],
  },
];
