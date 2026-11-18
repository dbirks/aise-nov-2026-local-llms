// Deck v2 chapters (docs/deck-v2-plan.md). `chip(n)` is the scene-slide chip.
export const TALK = 'Beyond “It Runs”';
export const CHAPTERS: [string, string][] = [["00", "Opening"], ["01", "Why bother?"], ["02", "What we mean by inference"], ["03", "My setup"], ["04", "Getting a smart enough model into VRAM"], ["05", "Where does the conversation live?"], ["06", "Several agents, one GPU"], ["07", "Making each token faster"], ["08", "Other things I ran into"], ["09", "Sharing it"], ["10", "Close"]];
export const chip = (n: number) => `${CHAPTERS[n][0]} — ${CHAPTERS[n][1]}`;
export const head = (n: number): [string, string] => [TALK, `${CHAPTERS[n][0]} / 10`];
