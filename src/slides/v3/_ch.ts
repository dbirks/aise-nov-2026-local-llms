// Deck v3 chapters (docs/deck-v3-plan.md). Audience questions, roughly in the order I ran into them.
export const TALK = 'Configuring Local LLMs';
export const CHAPTERS: [string, string][] = [
  ['00', 'Opening'],
  ['01', 'Why run a local model?'],
  ['02', 'Getting started'],
  ['03', 'How do you fit a useful model on your GPU?'],
  ['04', 'How do you give it more context?'],
  ['05', 'How do you run several agents at once?'],
  ['06', 'How do you make generation faster?'],
  ['07', 'What else is worth experimenting with?'],
  ['08', 'Sharing local models'],
  ['09', 'Close'],
];
/** Shorter labels for the title-slide list (the full question is on each divider). Same order as CHAPTERS. */
export const SHORT: Record<string, string> = {
  '03': 'Fitting a model on your GPU',
  '04': 'More context',
  '05': 'Several agents at once',
  '06': 'Faster generation',
  '07': 'Worth experimenting with',
};
export const LAST = CHAPTERS[CHAPTERS.length - 1][0];
export const chip = (n: number) => `${CHAPTERS[n][0]} — ${CHAPTERS[n][1]}`;
/** Running header: the chapter we're in on the left (the page number is filled in by the deck). */
export const head = (n: number): [string, string] => [chip(n), `${CHAPTERS[n][0]} / ${LAST}`];
