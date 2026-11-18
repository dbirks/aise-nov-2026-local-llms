// Deck v3 chapters (docs/deck-v3-plan.md). Audience questions, roughly in the order I ran into them.
export const TALK = 'Configuring Local LLMs';
export const CHAPTERS: [string, string][] = [
  ['00', 'Opening'],
  ['01', 'Why run a local model?'],
  ['02', 'Getting started: from Ollama to inference engines'],
  ['03', 'How do you fit a useful model on your GPU?'],
  ['04', 'How do you give it more context?'],
  ['05', 'How do you run several agents at once?'],
  ['06', 'How do you make generation faster?'],
  ['07', 'What else is worth experimenting with?'],
  ['08', 'Sharing local models'],
  ['09', 'Close'],
];
export const LAST = CHAPTERS[CHAPTERS.length - 1][0];
export const chip = (n: number) => `${CHAPTERS[n][0]} — ${CHAPTERS[n][1]}`;
export const head = (n: number): [string, string] => [TALK, `${CHAPTERS[n][0]} / ${LAST}`];
