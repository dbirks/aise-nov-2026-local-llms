import type { Slide } from '../../deck/types';

// Handoff route (docs/presentation-production-handoff.md): one file per scene ID, `export const slide: Slide`.
// File name = scene ID key (a01 … g01). src/slides.ts orders them; a missing file is skipped (`r()`).
const mods = import.meta.glob<{ slide: Slide }>('./[a-g][0-9][0-9].ts', { eager: true });

export const route: Record<string, Slide> = Object.fromEntries(
  Object.entries(mods).map(([k, m]) => [k.replace(/^\.\//, '').replace(/\.ts$/, ''), m.slide]),
);

/** `[slide]` if the scene file exists yet, else `[]` */
export const r = (key: string): Slide[] => (route[key] ? [route[key]] : []);
