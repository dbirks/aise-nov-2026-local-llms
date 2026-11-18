import type { Slide } from '../deck/types';
import { v } from '../slides/v2';
import { CHAPTERS, chip, head } from '../slides/v3/_ch';
import { COPY } from '../slides/v3/copy';
import { EXTRA } from '../slides/v3/extra';

// Deck v3, started 2026-11-18 (docs/deck-v3-plan.md). Served at the root and at /3/.
// Reuses the v2 slide files and scenes; v3 wording lives in src/slides/v3/copy.ts and new slides in
// src/slides/v3/extra.ts. Archived decks: v2 at /2/ (src/decks/v2.ts), v1 at /1/ (src/decks/route-v1.ts).

const section = (n: number, framing: string): Slide => ({
  id: `ch${CHAPTERS[n][0]}`,
  type: 'section',
  header: head(n),
  number: CHAPTERS[n][0],
  title: CHAPTERS[n][1],
  framing,
});

/** Slides for these ids in chapter n: v3-only slides first, else the v2 files, with v3 headers and wording. */
const ids = (n: number, ...keys: string[]): Slide[] =>
  keys
    .flatMap(k => (EXTRA[k] ? [EXTRA[k]] : v(k)))
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
    // short labels so the list fits beside the headline; full questions are on the dividers
    chapters: [
      ['01', 'Why run a local model?'],
      ['02', 'From Ollama to engines'],
      ['03', 'Fitting a model on your GPU'],
      ['04', 'More context'],
      ['05', 'Several agents at once'],
      ['06', 'Faster generation'],
      ['07', 'Worth experimenting with'],
      ['08', 'Sharing local models'],
    ],
  },
  ...ids(0, 'open'),
  section(1, 'Hosted models are great. So why would you want to run one yourself?'),
  ...ids(1, 'why-objection', 'why-good-enough', 'why-cost', 'why-independence', 'why-fun'),
  section(2, 'Most of us start with Ollama. A few terms help once you look underneath.'),
  ...ids(2, 'train-vs-infer', 'params', 'engines', 'setup-path'),
  section(3, 'The first real problem is memory. A smart model has to fit on the card.'),
  ...ids(3, 'setup-egpu', 'setup-slow-link', 'setup-hardware', 'gguf', 'embed-vec', 'quant-what', 'quant-types',
    'param-count', 'nvfp4', 'autoround', 'autoround-tool', 'moe'),
  section(4, 'The weights aren’t the only thing using VRAM. The conversation needs room too.'),
  ...ids(4, 'kv-cache'),
  section(5, 'Several agents on one GPU, not one chat at a time.'),
  ...ids(5, 'batching', 'prefix-cache', 'engines-cache'),
  section(6, 'With agents queued up, each new token should cost less.'),
  ...ids(6, 'spec-decode', 'mtp', 'block-drafters', 'shipped-drafters', 'drafter-vram', 'speculators-tool', 'my-drafter'),
  section(7, 'A few newer things that changed how I think about fitting models.'),
  ...ids(7, 'new-engines', 'ngram-tables', 'ple'),
  section(8, 'What if coworkers want these models without buying hardware?'),
  ...ids(8, 'share-why', 'collective', 'collective-request'),
  section(9, 'Which trade-offs make sense for what you actually have?'),
  ...ids(9, 'close', 'qa'),
];


/** Page numbers in the top-right header ("12 / 64"), list rows marked with squares instead of 01, 02. */
export const slides: Slide[] = deck.map((s, i) => {
  if (s.type === 'title') return s;
  const out = { ...s } as Slide & { header?: [string, string] };
  const page = `${i + 1} / ${deck.length}`;
  if (out.header) out.header = [out.header[0], page];
  else out.page = page;
  if (out.type === 'list') out.marker = 'square';
  return out as Slide;
});
