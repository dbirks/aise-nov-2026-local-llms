import type { Slide } from './types';

const storageKey = () => 'deck-pos:' + location.pathname + location.search;

export function initialIndex(slides: Slide[]): number {
  try {
    const id = decodeURIComponent(location.hash.replace(/^#\/?/, ''));
    const index = slides.findIndex(slide => slide.id === id);
    if (index >= 0) return index;
  } catch { /* malformed hash */ }
  try {
    const saved = localStorage.getItem(storageKey());
    if (saved !== null && /^-?\d+$/.test(saved)) {
      return Math.max(0, Math.min(slides.length - 1, Number(saved)));
    }
  } catch { /* storage unavailable */ }
  return 0;
}

export function saveIndex(i: number): void {
  try { localStorage.setItem(storageKey(), String(i)); } catch { /* storage unavailable */ }
}
