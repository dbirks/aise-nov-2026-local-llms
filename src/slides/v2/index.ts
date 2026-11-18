import type { Slide } from '../../deck/types';

// Deck v2 slides, one file per outline id (docs/deck-v2-plan.md): `export const slides: Slide[]`
// Variants B/C live beside it as `<id>.b.ts`, `<id>.c.ts` (same export), appended in file-name order.
// src/decks/v2.ts and src/decks/v3.ts order them with v('<id>').
const mods = import.meta.glob<{ slides: Slide[] }>('./[a-z]*.ts', { eager: true });
const byId: Record<string, Slide[]> = {};
for (const path of Object.keys(mods).sort()) {
  const key = path.slice(2, -3).split('.')[0];
  (byId[key] ??= []).push(...mods[path].slides);
}

/** The slides for outline id `key`, or [] while that file doesn't exist yet. */
export const v = (key: string): Slide[] => byId[key] ?? [];
