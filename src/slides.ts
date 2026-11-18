import type { Slide } from './deck/types';
import { v } from './slides/v2';
import { CHAPTERS, TALK } from './slides/v2/_ch';

// Deck v2 (docs/deck-v2-plan.md), started 2026-11-18. One file per outline id in src/slides/v2/.
// The previous build is archived in src/decks/route-v1.ts (open with ?deck=v1).

/** Section divider for chapter n; framing = the line that carries us into it. */
const section = (n: number, framing: string): Slide => ({
  id: `ch${CHAPTERS[n][0]}`,
  type: 'section',
  header: [TALK, `${CHAPTERS[n][0]} / 10`],
  number: CHAPTERS[n][0],
  title: CHAPTERS[n][1],
  framing,
});

const ids = (...keys: string[]) => keys.flatMap(v);

export const slides: Slide[] = [
  {
    id: 'title',
    type: 'title',
    header: ['Engineering Local LLM Inference', 'AISE · November 2026'],
    headline: 'Beyond\n“It Runs”',
    chapters: CHAPTERS.slice(1, 10),
  },
  ...ids('open'),
  section(1, 'Hosted models are good and cheap right now. So why would you run your own?'),
  ...ids('why-objection', 'why-good-enough', 'why-cost', 'why-independence', 'why-fun'),
  section(2, 'Two words come up all the time: training and inference.'),
  ...ids('train-vs-infer', 'engines'),
  section(3, 'What I actually run, and why it looks the way it does.'),
  ...ids('setup-why', 'setup-egpu', 'setup-slow-link', 'setup-hardware', 'setup-path'),
  section(4, 'The first real problem was memory. A smart model has to fit on the card.'),
  ...ids('gguf', 'embed-vec', 'quant-what', 'quant-types', 'nvfp4', 'autoround', 'moe'),
  section(5, 'Once it loaded, I found the weights weren’t the only thing using VRAM.'),
  ...ids('kv-cache'),
  section(6, 'Then I wanted several agents on one GPU, not one chat at a time.'),
  ...ids('batching', 'prefix-cache', 'engines-cache'),
  section(7, 'With agents queued up, I wanted each new token to cost less.'),
  ...ids('spec-decode', 'mtp', 'block-drafters', 'shipped-drafters', 'drafter-vram', 'my-drafter'),
  section(8, 'A few newer things that changed how I think about fitting models.'),
  ...ids('new-engines', 'ngram-tables', 'ple'),
  section(9, 'What if coworkers want these models without buying hardware?'),
  ...ids('share-why', 'collective', 'collective-request'),
  section(10, 'Which trade-offs make sense for what you actually have?'),
  ...ids('close', 'qa'),
];
