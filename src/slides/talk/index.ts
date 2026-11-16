import type { Slide } from '../../deck/types';

// New talk slides, one file each: `export const slide: Slide`. The file name is the key used in src/slides.ts.
const mods = import.meta.glob<{ slide: Slide }>('./*.ts', { eager: true });

export const talk: Record<string, Slide> = Object.fromEntries(
  Object.entries(mods)
    .filter(([k]) => !k.endsWith('/index.ts'))
    .map(([k, m]) => [k.replace(/^\.\//, '').replace(/\.ts$/, ''), m.slide]),
);

/** `[slide]` if the file exists yet, else `[]` — lets slides.ts reference slides that are still being built */
export const maybe = (key: string): Slide[] => (talk[key] ? [talk[key]] : []);
