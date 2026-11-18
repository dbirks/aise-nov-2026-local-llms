import type { Slide } from '../deck/types';

// Deck v4, started 2026-11-18: slimmed down, built slide by slide from the speaker's list.
// Each slide is a heading or one short phrase. No animation by default.
// Served at the root and at /4/. Archives: v3 /3/, v2 /2/, v1 /1/.
// List lines are phrases: no full stop at the end, Oxford comma.

const TITLE: Slide = {
  id: 'title',
  type: 'title',
  header: ['', 'AISE · November 2026'],
  headline: 'Configuring\nLocal LLMs',
  headlineSize: 215,
  chapters: [],
};

/** Sections in order; the deck below is built from these. */
const SECTIONS: { title: string; slides: Slide[] }[] = [
  {
    title: 'Why run things locally?',
    slides: [
      {
        id: 'pricing',
        type: 'list',
        header: ['', ''],
        title: 'Pricing',
        items: [
          'The pricing model won’t change underneath you',
          'Heavily subsidized tokens can’t last forever',
        ],
        subs: { 0: ['GitHub Copilot switching from request-based to usage-based billing'] },
        notes: 'evidence: SPEAKER OPINION (line 2). Copilot moved to token-based GitHub AI Credits from 2026-06-01 (github.blog, 2026-04-27).',
      },
    ],
  },
  { title: 'Getting started', slides: [] },
  { title: 'Fitting a model into VRAM', slides: [] },
  { title: 'More context', slides: [] },
  { title: 'Several agents at once', slides: [] },
  { title: 'Making things faster', slides: [] },
  { title: 'Sharing local models', slides: [] },
  { title: 'What to explore next', slides: [] },
];

const deck: Slide[] = [
  TITLE,
  ...SECTIONS.flatMap((sec, i) => {
    const n = String(i + 1).padStart(2, '0');
    const divider: Slide = { id: `ch${n}`, type: 'section', header: ['', ''], number: n, title: sec.title, framing: '' };
    const label = `${n} — ${sec.title}`;
    return [divider, ...sec.slides.map(s => ('header' in s ? { ...s, header: [label, ''] } : { ...s, chip: label }) as Slide)];
  }),
];

/** Page numbers top right, square list markers. */
export const slides: Slide[] = deck.map((s, i) => {
  if (s.type === 'title') return s;
  const page = `${i + 1} / ${deck.length}`;
  const out = { ...s } as Slide & { header?: [string, string] };
  if (out.header) out.header = [out.header[0], page];
  else out.page = page;
  if (out.type === 'list') out.marker = 'square';
  return out as Slide;
});
