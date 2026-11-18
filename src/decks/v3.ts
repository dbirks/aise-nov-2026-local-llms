import type { Slide } from '../deck/types';
import { v } from '../slides/v2';
import { CHAPTERS, SHORT, chip, head } from '../slides/v3/_ch';
import { COPY, DROP } from '../slides/v3/copy';
import { EXTRA } from '../slides/v3/extra';

// Deck v3, 2026-11-18 (docs/deck-v3-plan.md). Archived at /3/; the current deck is src/decks/v4.ts.
// Reuses the v2 slide files and scenes; v3 wording lives in src/slides/v3/copy.ts and new slides in
// src/slides/v3/extra.ts. Archived decks: v2 at /2/ (src/decks/v2.ts), v1 at /1/ (src/decks/route-v1.ts).

/** Section divider: number and chapter question only (speaker: no subtext). */
const section = (n: number): Slide => ({
  id: `ch${CHAPTERS[n][0]}`,
  type: 'section',
  header: ['', head(n)[1]], // the chapter is the big title here, so no running label
  number: CHAPTERS[n][0],
  title: CHAPTERS[n][1],
  framing: '',
});

/** Slides for these ids in chapter n: v3-only slides first, else the v2 files, with v3 headers and wording. */
const ids = (n: number, ...keys: string[]): Slide[] =>
  keys
    .flatMap(k => {
      const kept = (EXTRA[k] ? [EXTRA[k]] : v(k)).filter(s => !DROP.has(s.id));
      // once only one variant is left it is the pick: drop its A/B/C badge
      return kept.length === 1 ? kept.map(s => ({ ...s, variant: undefined }) as Slide) : kept;
    })
    .map(s => {
      const out = { ...s, ...COPY[s.id] } as Slide & { header?: unknown; chip?: unknown };
      if ('header' in s) out.header = head(n);
      if ('chip' in s) out.chip = chip(n);
      return out as Slide;
    });

const deck: Slide[] = [
  {
    id: 'title',
    type: 'title',
    header: ['', 'AISE · November 2026'],
    headline: 'Configuring\nLocal LLMs',
    headlineSize: 215,
    // built from CHAPTERS so it always matches the dividers; Opening and Close are left off
    chapters: CHAPTERS.slice(1, -1).map(([n, t]) => [n, SHORT[n] ?? t] as [string, string]),
  },
  ...ids(0, 'open'),
  section(1),
  ...ids(1, 'why-summary', 'why-objection', 'why-good-enough', 'why-cost', 'why-independence', 'why-fun'),
  section(2),
  ...ids(2, 'train-vs-infer', 'engines'),
  section(3),
  ...ids(3, 'setup-egpu', 'setup-slow-link', 'setup-hardware', 'gguf', 'embed-vec', 'quant-what', 'quant-types',
    'param-count', 'nvfp4', 'autoround', 'autoround-tool', 'moe'),
  section(4),
  ...ids(4, 'kv-cache'),
  section(5),
  ...ids(5, 'batching', 'prefix-cache', 'engines-cache'),
  section(6),
  ...ids(6, 'spec-decode', 'mtp', 'block-drafters', 'shipped-drafters', 'drafter-vram', 'speculators-tool', 'my-drafter'),
  section(7),
  ...ids(7, 'new-engines', 'ngram-tables', 'ple'),
  section(8),
  ...ids(8, 'share-why', 'collective', 'collective-request'),
  section(9),
  ...ids(9, 'close', 'qa'),
];


/** Page numbers in the top-right header ("12 / 64"), list rows marked with squares instead of 01, 02. */
export const slides: Slide[] = deck.map((s, i) => {
  if (s.type === 'title') return s;
  const out = { ...s } as Slide & { header?: [string, string] };
  const page = `${i + 1} / ${deck.length}`;
  if (out.header) out.header = [out.header[0], page];
  else out.page = page;
  if (out.type === 'list') {
    out.marker = 'square';
    // speaker: list lines read as phrases, no full stop at the end
    out.items = out.items.map(t => t.replace(/\.$/, ''));
  }
  return out as Slide;
});
