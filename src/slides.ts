import type { Slide } from './deck/types';
import { splatLab } from './slides/splat-lab';
import { sceneLab } from './slides/scene-lab';
import { legacy } from './slides/legacy';
import { r } from './slides/route';
import { CHAPTERS, TALK } from './slides/route/_chapters';

// The deck, in order: the handoff route (docs/presentation-production-handoff.md §1, 8 chapters, one
// slide per scene ID), then the appendix (first-draft talk, scene lab, splat lab). Nothing here is an
// approved final lineup — the speaker picks which scenes play live.
//
// Accuracy: scene numbers are simulated/illustrative unless the slide's notes say otherwise; see AGENTS.md
// and the handoff's evidence labels.

/** Section divider for chapter n; framing = the handoff's transition line into that chapter. */
const section = (n: number, framing: string): Slide => ({
  id: `ch${CHAPTERS[n][0]}`,
  type: 'section',
  header: [TALK, `${CHAPTERS[n][0]} / 07`],
  number: CHAPTERS[n][0],
  title: CHAPTERS[n][1],
  framing,
});

export const slides: Slide[] = [
  {
    id: 'title',
    type: 'title',
    header: ['Engineering Local LLM Inference', 'AISE · November 2026'],
    headline: 'Beyond\n“It Runs”',
    chapters: CHAPTERS.map(([n, t]) => [n, t] as [string, string]),
  },
  section(0, 'There are excellent hosted models. Why would you bother running local ones?'),
  ...r('a01'), ...r('a02'),
  section(1, 'Once I wanted it on my own machine, the first problem wasn’t AI philosophy. It was memory.'),
  ...r('b01'), ...r('b02'), ...r('b03'), ...r('b04'), ...r('b05'),
  section(2, 'I got it to load. Then I found the weights weren’t the only thing on the card.'),
  ...r('c01'), ...r('c02'), ...r('c03'), ...r('c04'), ...r('c05'),
  section(3, 'The problem changed when I wanted several agents running, not one chat at a time.'),
  ...r('d01'), ...r('d02'), ...r('d03'), ...r('d04'), ...r('d05'),
  section(4, 'With agents queued up, I wanted the expensive part — the next token — to happen less often.'),
  ...r('e01'), ...r('e02'), ...r('e03'), ...r('e04'), ...r('e05'), ...r('e06'),
  section(5, 'New engines and architectures kept changing what “fit” even means.'),
  ...r('f01'), ...r('f02'), ...r('f03'), ...r('f04'),
  section(6, 'What if coworkers want to use these models without everyone buying the same hardware?'),
  ...r('g01'),
  section(7, 'Which trade-offs would you make for the models, hardware and workload you actually have?'),
  ...r('a03'),
  // ---- appendix ----
  {
    id: 'appendix',
    type: 'section',
    header: [TALK, 'Appendix'],
    number: 'AX',
    title: 'Appendix',
    framing: 'The first-draft talk and the visual experiments, kept for reference. Not part of the route.',
    example: true,
  },
  ...legacy.filter(s => s.id !== 'attn'),
  {
    id: 'scene-lab',
    type: 'section',
    header: [TALK, 'Appendix'],
    number: 'SL',
    title: 'Scene lab',
    framing: 'Brainstorm visualizations from the research notes — candidates, not the plan. Each one names the README brief it came from.',
    example: true,
  },
  ...sceneLab,
  {
    id: 'splat-lab',
    type: 'section',
    header: [TALK, 'Appendix'],
    number: 'GS',
    title: 'Splat lab',
    framing: 'Experiments: the same pixel pipeline fed by Gaussian splats made in different ways. Each slide names its method.',
    example: true,
  },
  ...splatLab,
  ...legacy.filter(s => s.id === 'attn'),
];

/**
 * Named routes: `?route=<name>` in the URL plays only these slide ids, in deck order.
 * '20' = the handoff's ~20-minute fallback route (§1): A01, B01, B03, C02, C04, D01, D03, E01, E03, F01, G01.
 */
export const routes: Record<string, string[]> = {
  '20': ['title', 'ch00', 'a01', 'ch01', 'b01', 'b03', 'ch02', 'c02', 'c04', 'ch03', 'd01', 'd03',
    'ch04', 'e01', 'e03', 'ch05', 'f01', 'ch06', 'g01', 'ch07', 'a03'],
};

/** The slides for the current URL's `?route=` (whole deck when absent or unknown). */
export function routeSlides(search = typeof location === 'undefined' ? '' : location.search): Slide[] {
  const ids = routes[new URLSearchParams(search).get('route') ?? ''];
  return ids ? slides.filter(s => ids.includes(s.id)) : slides;
}
