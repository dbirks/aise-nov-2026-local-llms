import type { Slide } from '../../deck/types';

// Deck v2 slides, one file per outline id (docs/deck-v2-plan.md): `export const slides: Slide[]`
// (several entries when a slide has A/B/C variants). src/slides.ts orders them with v('<id>').
const mods = import.meta.glob<{ slides: Slide[] }>('./[a-z]*.ts', { eager: true });
const byId: Record<string, Slide[]> = {};
for (const [path, m] of Object.entries(mods)) byId[path.slice(2, -3)] = m.slides;

/** The slides for outline id `key`, or [] while that file doesn't exist yet. */
export const v = (key: string): Slide[] => byId[key] ?? [];
