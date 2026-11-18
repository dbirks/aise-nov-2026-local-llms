// Shared toy word vectors for deck v2 (embed-vec, quant-what). SYNTHETIC: hand-placed 3D coordinates so the
// country→leader and country→food offsets are parallel. Not taken from any real model.
export const OFFSET_LEADER = [-0.9, 1.5, 0.3];
export const OFFSET_FOOD = [0.5, -1.3, 0.6];
const add = (a, b) => a.map((x, i) => +(x + b[i]).toFixed(2));
const FRANCE = [1.6, 0.4, 1.2], GERMANY = [1.8, 0.6, -1.0], ITALY = [1.2, 0.2, 0.1];
/** [{ word, v:[x,y,z], kind:'country'|'leader'|'food' }] */
export const WORDS = [
  { word: 'France', v: FRANCE, kind: 'country' },
  { word: 'Germany', v: GERMANY, kind: 'country' },
  { word: 'Italy', v: ITALY, kind: 'country' },
  { word: 'Hitler', v: add(GERMANY, OFFSET_LEADER), kind: 'leader' },
  { word: 'Mussolini', v: add(ITALY, OFFSET_LEADER), kind: 'leader' },
  { word: 'baguette', v: add(FRANCE, OFFSET_FOOD), kind: 'food' },
  { word: 'pumpernickel', v: add(GERMANY, OFFSET_FOOD), kind: 'food' },
];
/**
 * Symmetric round-to-nearest quantization of every coordinate with ONE scale for the whole block
 * (all words × 3 numbers). bits >= 16 returns the values unchanged.
 * Returns { scale, qmax, words:[{ word, q:[ints], v:[dequantized] }] }.
 */
export function quantizeWords(bits, words = WORDS) {
  if (bits >= 16) return { scale: null, qmax: null, words: words.map(w => ({ word: w.word, q: null, v: w.v.slice() })) };
  const qmax = 2 ** (bits - 1) - 1;
  const maxAbs = Math.max(...words.flatMap(w => w.v.map(Math.abs)));
  const scale = maxAbs / qmax;
  return {
    scale, qmax,
    words: words.map(w => {
      const q = w.v.map(x => Math.max(-qmax - 1, Math.min(qmax, Math.round(x / scale))));
      return { word: w.word, q, v: q.map(n => n * scale) };
    }),
  };
}
