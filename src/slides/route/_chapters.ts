// The handoff's 8 chapters (§1). `chip` is the scene-slide chip prefix.
export const TALK = 'Beyond “It Runs”';
export const CHAPTERS = [
  ['00', 'Why bother?'],
  ['01', 'Will it fit?'],
  ['02', 'Where does the conversation go?'],
  ['03', 'Can several agents use it?'],
  ['04', 'Faster next tokens'],
  ['05', 'What else is happening now?'],
  ['06', 'Sharing it'],
  ['07', 'Closing'],
] as const;
export const chip = (n: number) => `${CHAPTERS[n][0]} — ${CHAPTERS[n][1]}`;
