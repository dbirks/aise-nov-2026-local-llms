import type { Slide } from '../../deck/types';

// Splat lab: every file in this folder (except index.ts) exports `slides: Slide[]`.
// Files are concatenated in filename order, so name them by method: a1-*.ts, a2-*.ts, b-*.ts …
const mods = import.meta.glob<{ slides: Slide[] }>('./*.ts', { eager: true });

export const splatLab: Slide[] = Object.keys(mods)
  .filter(k => !k.endsWith('/index.ts'))
  .sort()
  .flatMap(k => mods[k].slides);
