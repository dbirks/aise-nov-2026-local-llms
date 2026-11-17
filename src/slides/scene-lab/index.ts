import type { Slide } from '../../deck/types';

// Scene lab: brainstorm visualizations, one file per scene (`export const slides: Slide[]`), filename order.
// Not the talk plan — candidates to see what sticks. Every slide is marked example: true.
const mods = import.meta.glob<{ slides: Slide[] }>('./*.ts', { eager: true });

export const sceneLab: Slide[] = Object.keys(mods)
  .filter(k => !k.endsWith('/index.ts'))
  .sort()
  .flatMap(k => mods[k].slides);
