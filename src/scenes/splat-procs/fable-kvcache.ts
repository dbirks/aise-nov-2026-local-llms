// Splat proc: `fable-kvcache` — an ILLUSTRATIVE KV cache drawn as a ribbon of paged blocks
// (method A1: LLM-written Spark code, built in the browser on every load, animated per frame).
//
// Reading the picture:
//   x  = token position; the ribbon grows along +x. One block (page) holds TOK = 16 tokens.
//   z  = layer; ROWS = 8 rows, because every new token writes one K/V entry in every layer —
//        so the write front is a straight line across all rows.
//   dark slab          = block filled with keys/values (each token is one thin slice of the slab)
//   wire-frame outline = block allocated from the pool but not (yet) full
//   dotted footprint   = address space up to the context limit that is NOT allocated
// Loop: grow token by token → hold → blocks are freed back to outlines → outlines vanish → restart.
// Sizes, block length and layer count are made up for the drawing; nothing is measured, and the
// drawing does not claim that a context window is ever fully pre-allocated.
//
// Per-frame update: all splats are pushed once. The animation rewrites the colour/alpha word of
// a few hundred splats in PackedSplats.packedArray, moves 72 "write front" cap splats with
// setSplat, then flags the texture dirty (needsUpdate + updateVersion). No dyno program needed.
import type { PackedSplats } from '@sparkjsdev/spark';
import type { SplatProc } from './index';

const COLS = 20, ROWS = 8, TOK = 16, TOTAL = COLS * TOK;
const BX = 0.19, SLAB_W = 0.166, DX = SLAB_W / TOK;      // block pitch, slab length, token slice
const RZ = 0.2, SLAB_D = 0.158;                           // layer pitch, slab depth
const H = 0.26, Y0 = -0.13, Y1 = Y0 + H;
const XMIN = -(COLS * BX) / 2, ZMIN = -(ROWS * RZ) / 2;
const THIN = 0.0025;

const TOP_N = 4, FRONT_N = 4, CAP_N = 3;                  // splats per token slice / per cap edge
const SPEED = 22;                                         // tokens per second
const START = 104;                                        // tokens already cached at load
const T_HOLD = 1.6, T_FREE = 1.1, T_CLEAR = 0.7, T_REST = 0.5;
const FRESH = 7;                                          // tokens behind the front that still glow

const slabX = (col: number) => XMIN + col * BX + (BX - SLAB_W) / 2;
const slabZ = (row: number) => ZMIN + row * RZ + (RZ - SLAB_D) / 2;   // row 0 is the back row
const hash = (n: number) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
const byte = (g: number) => Math.max(0, Math.min(255, Math.round(g * 255)));

const proc: SplatProc = ({ spark, THREE }) => {
  const c = new THREE.Vector3(), sc = new THREE.Vector3(), col = new THREE.Color();
  const qFront = new THREE.Quaternion();                                              // disc normal +z
  const qTop = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2);  // normal +y
  const qSide = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2);  // normal +x

  // index bookkeeping, filled while pushing
  const fillStart = new Uint32Array(TOTAL + 1);     // first splat of token t (all rows)
  const outStart = new Uint32Array(COLS + 1);       // first outline splat of block column
  let baseGrey = new Uint8Array(0);                 // resting grey of every splat
  let capStart = 0, onAlpha = 255;

  // animation state
  let phase = 0, tok = START, clock = 0, shownHead = -1, shownFree = 0, shownClear = 0, shownAlloc = 0;
  let last = 0;

  const setWord = (arr: Uint32Array, i: number, grey: number, alpha: number) => {
    grey &= 255;
    arr[i * 4] = (grey | (grey << 8) | (grey << 16) | (alpha << 24)) >>> 0;
  };

  /** token slices [a, b): visible or not, with the "fresh" glow relative to head */
  const paintTokens = (arr: Uint32Array, a: number, b: number, head: number, freed: number) => {
    for (let t = Math.max(0, a); t < Math.min(TOTAL, b); t++) {
      const vis = t <= head && t >= freed;
      const age = head - t, glow = vis && age < FRESH && head < TOTAL - 1 ? (1 - age / FRESH) ** 1.6 : 0;
      for (let i = fillStart[t]; i < fillStart[t + 1]; i++) {
        const g = baseGrey[i];
        setWord(arr, i, Math.round(g + (205 - g) * glow), vis ? onAlpha : 0);
      }
    }
  };
  const paintOutline = (arr: Uint32Array, colA: number, colB: number, on: boolean) => {
    for (let i = outStart[Math.max(0, colA)]; i < outStart[Math.min(COLS, colB)]; i++) setWord(arr, i, baseGrey[i], on ? onAlpha : 0);
  };
  /** the 8 moving end caps that close the partly filled block at the write front */
  const placeCaps = (splats: PackedSplats, head: number, show: boolean) => {
    const block = Math.floor(Math.max(0, head) / TOK), x = slabX(block) + ((Math.max(0, head) % TOK) + 1) * DX;
    let i = capStart;
    sc.set((SLAB_D / CAP_N) * 0.62, (H / CAP_N) * 0.62, THIN);
    col.setRGB(0.86, 0.86, 0.86);
    for (let r = 0; r < ROWS; r++) for (let a = 0; a < CAP_N; a++) for (let b = 0; b < CAP_N; b++) {
      c.set(x + 0.002, Y0 + ((b + 0.5) / CAP_N) * H, slabZ(r) + ((a + 0.5) / CAP_N) * SLAB_D);
      splats.setSplat(i++, c, sc, qSide, show ? 1 : 0, col);
    }
  };

  /** bring the splat buffer to the current animation state; returns true if anything changed */
  const sync = (splats: PackedSplats, force = false) => {
    const arr = splats.packedArray;
    if (!arr) return false;
    const head = phase === 0 ? Math.min(TOTAL - 1, Math.floor(tok) - 1) : TOTAL - 1;
    const freed = phase >= 2 ? Math.min(TOTAL, Math.floor((phase === 2 ? clock / T_FREE : 1) * COLS) * TOK) : 0;
    const cleared = phase >= 3 ? Math.min(COLS, Math.floor((phase === 3 ? clock / T_CLEAR : 1) * (COLS + 1))) : 0;
    const alloc = head < 0 ? 0 : Math.floor(head / TOK) + 1;                // blocks handed out so far
    if (force) {
      paintTokens(arr, 0, TOTAL, head, freed);
      paintOutline(arr, 0, COLS, false); paintOutline(arr, cleared, alloc, true);
    } else {
      if (head === shownHead && freed === shownFree && cleared === shownClear) return false;
      if (head !== shownHead) paintTokens(arr, Math.min(head, shownHead) - FRESH - 1, Math.max(head, shownHead) + 1, head, freed);
      if (freed !== shownFree) paintTokens(arr, shownFree, freed, head, freed);
      if (alloc !== shownAlloc || cleared !== shownClear) { paintOutline(arr, 0, COLS, false); paintOutline(arr, cleared, alloc, true); }
    }
    placeCaps(splats, head, phase === 0 && head >= 0 && head < TOTAL - 1);
    shownHead = head; shownFree = freed; shownClear = cleared; shownAlloc = alloc;
    return true;
  };

  const step = (dt: number) => {
    clock += dt;
    if (phase === 0) { tok += dt * SPEED; if (tok >= TOTAL) { tok = TOTAL; phase = 1; clock = 0; } }
    else if (phase === 1 && clock > T_HOLD) { phase = 2; clock = 0; }
    else if (phase === 2 && clock > T_FREE) { phase = 3; clock = 0; }
    else if (phase === 3 && clock > T_CLEAR) { phase = 4; clock = 0; }
    else if (phase === 4 && clock > T_REST) { phase = 0; clock = 0; tok = 0; }
  };

  return new spark.SplatMesh({
    constructSplats: splats => {
      const greys: number[] = [];
      const put = (x: number, y: number, z: number, sx: number, sy: number, sz: number, q: THREE_Q, grey: number, alpha = 1) => {
        c.set(x, y, z); sc.set(sx, sy, sz); col.setRGB(grey, grey, grey);
        splats.pushSplat(c, sc, q, alpha, col);
        greys.push(byte(grey));
      };
      type THREE_Q = typeof qFront;

      // ── 1 · token slices, pushed in token order so one token = one contiguous index range ──
      for (let t = 0; t < TOTAL; t++) {
        fillStart[t] = splats.numSplats;
        const block = Math.floor(t / TOK), k = t % TOK, x = slabX(block) + (k + 0.5) * DX;
        const tone = 0.27 + 0.1 * hash(t);                     // slight per-token banding
        for (let r = 0; r < ROWS; r++) {
          const z0 = slabZ(r), depth = (ROWS - 1 - r) * 0.012; // back rows a touch paler
          for (let a = 0; a < TOP_N; a++) put(x, Y1, z0 + ((a + 0.5) / TOP_N) * SLAB_D, DX * 0.66, (SLAB_D / TOP_N) * 0.56, THIN, qTop, tone + depth);
          for (let b = 0; b < FRONT_N; b++) put(x, Y0 + ((b + 0.5) / FRONT_N) * H, z0 + SLAB_D, DX * 0.66, (H / FRONT_N) * 0.62, THIN, qFront, 0.04 + depth * 0.5);
          // block end faces belong to the first / last token of the block
          if (k === 0 || k === TOK - 1) {
            const xe = k === 0 ? slabX(block) : slabX(block) + SLAB_W;
            for (let a = 0; a < CAP_N; a++) for (let b = 0; b < CAP_N; b++) {
              put(xe, Y0 + ((b + 0.5) / CAP_N) * H, z0 + ((a + 0.5) / CAP_N) * SLAB_D, (SLAB_D / CAP_N) * 0.62, (H / CAP_N) * 0.62, THIN, qSide, k === 0 ? 0.07 : 0.1);
            }
          }
        }
      }
      fillStart[TOTAL] = splats.numSplats;

      // ── 2 · block outlines: 12 edges of thin stretched splats per (block, layer) ──
      const E = 0.0048, OUT = 0.4;
      for (let b = 0; b < COLS; b++) {
        outStart[b] = splats.numSplats;
        for (let r = 0; r < ROWS; r++) {
          const x0 = slabX(b), x1 = x0 + SLAB_W, z0 = slabZ(r), z1 = z0 + SLAB_D;
          for (const y of [Y0, Y1]) for (const z of [z0, z1]) for (let i = 0; i < 3; i++) put(x0 + ((i + 0.5) / 3) * SLAB_W, y, z, (SLAB_W / 3) * 0.6, E, E, qFront, OUT);
          for (const y of [Y0, Y1]) for (const x of [x0, x1]) for (let i = 0; i < 3; i++) put(x, y, z0 + ((i + 0.5) / 3) * SLAB_D, E, E, (SLAB_D / 3) * 0.6, qFront, OUT);
          for (const x of [x0, x1]) for (const z of [z0, z1]) for (let i = 0; i < 3; i++) put(x, Y0 + ((i + 0.5) / 3) * H, z, E, (H / 3) * 0.6, E, qFront, OUT);
        }
      }
      outStart[COLS] = splats.numSplats;

      // ── 3 · moving write-front caps (positions are set in placeCaps) ──
      capStart = splats.numSplats;
      for (let i = 0; i < ROWS * CAP_N * CAP_N; i++) put(0, Y0, 0, 0.01, 0.01, THIN, qSide, 0.86, 1);
      onAlpha = (splats.packedArray![capStart * 4] >>> 24) & 255;       // how Spark encodes opacity 1

      // ── 4 · static furniture: dotted footprints, token axis, labels ──
      const dot = (x: number, z: number, tone: number, r = 0.0065) => put(x, Y0 + 0.002, z, r, 0.002, r, qFront, tone);
      for (let b = 0; b < COLS; b++) for (let r = 0; r < ROWS; r++) {
        const x0 = slabX(b), z0 = slabZ(r);
        for (let i = 0; i <= 4; i++) { dot(x0 + (i / 4) * SLAB_W, z0, 0.58); dot(x0 + (i / 4) * SLAB_W, z0 + SLAB_D, 0.58); }
        for (let i = 1; i < 4; i++) { dot(x0, z0 + (i / 4) * SLAB_D, 0.58); dot(x0 + SLAB_W, z0 + (i / 4) * SLAB_D, 0.58); }
      }
      // token axis in front of the ribbon: a rule with a tick per block, longer every 4 blocks
      const AZ = -ZMIN + 0.1;
      for (let x = XMIN; x <= -XMIN + 1e-6; x += 0.02) put(x, Y0, AZ, 0.012, 0.002, 0.006, qFront, 0.12);
      for (let b = 0; b <= COLS; b++) {
        const len = b % 4 === 0 ? 0.11 : 0.05;
        for (let z = 0; z <= len; z += 0.015) put(XMIN + b * BX, Y0, AZ + z, 0.006, 0.002, 0.009, qFront, 0.12);
      }
      // labels, rasterised from a 2D canvas into flat floor discs (dark ink on the pale ground)
      const label = (text: string, ox: number, oz: number, ux: number, uz: number, height: number) => {
        if (typeof document === 'undefined') return;
        const cv = document.createElement('canvas'), ctx = cv.getContext('2d');
        if (!ctx) return;
        const PX = 40, font = `700 ${PX}px ui-monospace, "DejaVu Sans Mono", Menlo, Consolas, monospace`;
        ctx.font = font;
        cv.width = Math.ceil(ctx.measureText(text).width) + 4; cv.height = Math.ceil(PX * 1.3);
        ctx.font = font; ctx.fillStyle = '#fff'; ctx.textBaseline = 'alphabetic';
        ctx.fillText(text, 2, PX);
        const data = ctx.getImageData(0, 0, cv.width, cv.height).data, S = 2, u = height / PX;
        for (let py = 0; py < cv.height; py += S) for (let px = 0; px < cv.width; px += S) {
          const a = data[(py * cv.width + px) * 4 + 3] / 255;
          if (a < 0.35) continue;
          // text runs along (ux, uz); its "up" is 90° to the left of that on the floor
          const along = px * u, up = (PX - py) * u;
          put(ox + ux * along + uz * up, Y0 + 0.002, oz + uz * along - ux * up, u * S * 0.62, 0.002, u * S * 0.62, qFront, 0.1, a);
        }
      };
      label('tokens', XMIN, AZ + 0.42, 1, 0, 0.2);
      for (let x = XMIN + 0.86; x <= XMIN + 1.4; x += 0.02) put(x, Y0, AZ + 0.35, 0.012, 0.002, 0.009, qFront, 0.1);       // arrow shaft
      for (let i = 0; i <= 6; i++) for (const sgn of [-1, 1]) put(XMIN + 1.4 - i * 0.016, Y0, AZ + 0.35 + sgn * i * 0.012, 0.011, 0.002, 0.009, qFront, 0.1);
      label('16 per block', XMIN + 1.62, AZ + 0.42, 1, 0, 0.2);
      label('8 layers', -XMIN + 0.36, -ZMIN, 0, -1, 0.2);

      baseGrey = Uint8Array.from(greys);
      sync(splats, true);
    },
    onFrame: ({ mesh }) => {
      const splats = mesh.packedSplats;
      if (!splats || !splats.packedArray || !baseGrey.length) return;
      const now = performance.now();
      const dt = last ? Math.min(0.1, (now - last) / 1000) : 0;
      last = now;
      const before = phase;
      step(dt);
      if (sync(splats, before === 4 && phase === 0)) {
        splats.needsUpdate = true;
        mesh.updateVersion();
      }
    },
  });
};

export default proc;
