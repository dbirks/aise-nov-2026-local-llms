// Scene `prefill` — prefill vs decode: one weight read per pass, wildly different work per read
// (chapter 03 opener, viz-audit M4).
//
// x = token position inside the pass that is climbing, y = layer (8 weight slabs), z = depth: the
// climbing pass runs in front of the slabs and the KV tray sits in front-right, below them.
// PREFILL: a wide row of N dark prompt tiles rises through the whole stack in ONE pass; each slab
// flashes dark while the row is inside it; the LEFT meter (compute) fills high, the RIGHT meter
// (weights read) gains exactly ONE unit. The prompt's KV then drops into the tray in front.
// DECODE: one tile climbs the same stack per step — every step adds another whole unit to the
// weights meter and one more tile to the tray, while the compute meter barely moves.
//
// Everything is illustrative: no batching, no KV-cache reads in the cost, no absolute times, no
// chunked prefill (see slide notes). Source: Kwon et al., arXiv:2211.05102 (prefill = one wide
// compute-bound pass over N positions; decode = one position per step, memory-bound).
import { THREE, lam, ghost, M, Q, P, S, ease, emitter } from './_kit.js';

const LAYERS = 8;                            // weight slabs drawn (real models have many more)
const DY = 0.46, Y0 = -1.55;                 // layer pitch, bottom slab
const SLAB_W = 2.9, SLAB_H = 0.17, SLAB_D = 1.15, SX = -0.15;
const ENTRY = -1.65, EXIT = 2.15;            // climb start/end (outside the stack)
const PASSZ = 0.88;                          // the climbing pass runs in FRONT of the slabs
const LT_P = 0.24, LT_D = 0.115;             // climb pace: prefill pass / decode step (seconds)
const TRAVEL_P = 0.6, TRAVEL_D = 0.55;       // extra time entering + leaving the stack
const GEN = 8;                               // decode tokens per cycle, then the cycle restarts
const UNITS = 10;                            // weights-read meter segments
const NMAX = 64;                             // largest prompt shown
const COLS = 13, ROWS = 6, GX = 0.185, GZ = 0.15;   // KV tray grid: one tile per cached token

const yOf = l => Y0 + l * DY;
const YTOP = yOf(LAYERS - 1);
const climbPhase = p => p === 'prefill' || p === 'decode';

export default function build(scene, emit) {
  const out = emitter(emit);

  // ── weight stack ──────────────────────────────────────────────────────
  const slabs = new THREE.InstancedMesh(new THREE.BoxGeometry(SLAB_W, SLAB_H, SLAB_D), lam(0xffffff), LAYERS);
  for (let l = 0; l < LAYERS; l++) slabs.setMatrixAt(l, M.compose(P.set(SX, yOf(l), 0), Q, S.setScalar(1)));
  scene.add(slabs);
  const cIdle = new THREE.Color(0x9a9a9a), cUse = new THREE.Color(0x3f3f3f), tmp = new THREE.Color();
  const flash = new Float32Array(LAYERS);

  // ── meters: two outline boxes either side of the stack (labels live in the readout) ──
  const MY = Y0 - 0.14, MH = YTOP + 0.2 - MY, MW = 0.46;
  const compX = SX - SLAB_W / 2 - 1.0, wtX = SX + SLAB_W / 2 + 0.88;
  const edge = (w, h, d) => new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(w, h, d)),
    new THREE.LineBasicMaterial({ color: 0x111111 }));
  const compEdge = edge(MW, MH, MW), wtEdge = edge(MW, MH, MW);
  compEdge.position.set(compX, MY + MH / 2, 0);
  wtEdge.position.set(wtX, MY + MH / 2, 0);
  // left meter: continuous fill = how much compute this pass used
  const compFill = new THREE.Mesh(new THREE.BoxGeometry(MW - 0.11, 1, MW - 0.11), lam(0x131313));
  // right meter: one segment per *complete* read of all the weights
  const uh = MH / UNITS;
  const units = new THREE.InstancedMesh(new THREE.BoxGeometry(MW - 0.11, uh - 0.075, MW - 0.11), lam(0x161616), UNITS);
  for (let i = 0; i < UNITS; i++) units.setMatrixAt(i, M.compose(P.set(wtX, MY + (i + 0.5) * uh, 0), Q, S.setScalar(0.001)));
  scene.add(compEdge, compFill, wtEdge, units);
  const uAmt = new Float32Array(UNITS).fill(0.001);

  // ── KV tray beside/below the stack (kept clear of the climb column + the hint label) ──
  const TY = -1.55, TZ = 1.3, TXC = 1.9;
  const tw = COLS * GX + 0.12, td = ROWS * GZ + 0.1;
  const trayEdge = edge(tw, 0.4, td); trayEdge.position.set(TXC, TY + 0.2, TZ);
  const trayBase = new THREE.Mesh(new THREE.BoxGeometry(tw, 0.04, td), ghost(0x3a3a3a, 0.16));
  trayBase.position.set(TXC, TY + 0.02, TZ);
  const kv = new THREE.InstancedMesh(new THREE.BoxGeometry(GX - 0.05, 0.13, GZ - 0.045), lam(0x141414), COLS * ROWS);
  kv.frustumCulled = false;
  scene.add(trayEdge, trayBase, kv);

  // ── the pass that is climbing: a wide prompt row / one decode tile ────
  const row = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), lam(0x0b0b0b), NMAX);
  row.frustumCulled = false;
  const band = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), ghost(0x2a2a2a, 0.24));   // "one wide pass" plate
  const dec = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), lam(0x0b0b0b));
  scene.add(row, band, dec);

  // ── state ─────────────────────────────────────────────────────────────
  let N = 16, playing = true, phase = 'prefill', pt = 0, gen = 0, kvN = 0, stepReq = false, clock = 0;
  const FAR = 1e9;                                  // not born yet (clock never reaches it)
  const born = new Float32Array(COLS * ROWS).fill(FAR);
  let rowAmt = 0.001, decAmt = 0.001, comp = 0, yVis = ENTRY;

  function restart() { phase = 'prefill'; pt = 0; gen = 0; kvN = 0; born.fill(FAR); yVis = ENTRY; }
  function reveal(count) {                       // tiles fall in, oldest token first
    for (let i = kvN; i < count && i < born.length; i++) born[i] = clock + (i - kvN) * 0.016;
    kvN = Math.min(count, born.length);
  }
  const dur = () => ({
    prefill: LAYERS * LT_P + TRAVEL_P,
    kv: 0.4 + Math.min(N, 44) * 0.016,
    decode: LAYERS * LT_D + TRAVEL_D,
    gap: 0.24,
    hold: 1.7,
  })[phase];

  return {
    view: { target: [-0.1, -0.4, 0], radius: 40, theta: 0.62, phi: 1.12, size: 2.15 },

    update(dt) {
      clock += dt;
      const D = dur();
      if (playing) pt += dt;
      if (stepReq) {
        stepReq = false;
        if (climbPhase(phase)) {            // one slab per press, the pass parked inside it
          const k = Math.min(LAYERS, Math.round((ENTRY + Math.min(1, pt / D) * (EXIT - ENTRY) - Y0) / DY) + 1);
          pt = k >= LAYERS ? D : ((yOf(k) - ENTRY) / (EXIT - ENTRY)) * D;
        } else pt = D;
      }
      if (pt >= D) {
        pt = 0;
        if (phase === 'prefill') { phase = 'kv'; reveal(N); }
        else if (phase === 'kv') { phase = 'decode'; yVis = ENTRY; }
        else if (phase === 'decode') { gen++; reveal(N + gen); phase = gen >= GEN ? 'hold' : 'gap'; }
        else if (phase === 'gap') { phase = 'decode'; yVis = ENTRY; }
        else restart();
      }

      const climb = climbPhase(phase);
      const rowY = ENTRY + (climb ? Math.min(1, pt / D) : phase === 'hold' ? 0 : 1) * (EXIT - ENTRY);
      yVis += (rowY - yVis) * ease(dt, 9);

      // slabs light while the pass is inside them — the same full read every time
      const wantRow = phase === 'prefill' ? 1 : 0.001, wantDec = phase === 'decode' || phase === 'gap' ? 1 : 0.001;
      rowAmt += (wantRow - rowAmt) * ease(dt, wantRow > rowAmt ? 9 : 13);
      decAmt += (wantDec - decAmt) * ease(dt, wantDec > decAmt ? 12 : 14);
      for (let l = 0; l < LAYERS; l++) {
        const tgt = (climb ? 1 : 0) && Math.abs(yVis - yOf(l)) < DY * 0.44 ? 1 : 0;
        flash[l] += (tgt - flash[l]) * ease(dt, tgt ? 16 : 8);
        slabs.setColorAt(l, tmp.copy(cIdle).lerp(cUse, flash[l]));
      }

      // compute meter: high for the wide pass, barely a bump for a single token
      const inside = climb && yVis > Y0 - DY && yVis < YTOP + DY;
      const compT = phase === 'prefill' && inside ? 0.92 : phase === 'decode' && inside ? 0.14 : 0.035;
      comp += (compT - comp) * ease(dt, compT > comp ? 7 : 4);
      compFill.scale.set(1, Math.max(0.001, comp * MH), 1);
      compFill.position.set(compX, MY + Math.max(0.001, comp * MH) / 2, 0);

      // weights meter: one segment per completed read of the whole stack
      const tok = phase === 'decode' ? gen + 1 : gen;
      const shown = phase === 'prefill' || phase === 'kv' ? 1 : tok + 1;
      for (let i = 0; i < UNITS; i++) {
        const tgt = i < shown ? 1 : 0.001;
        uAmt[i] += (tgt - uAmt[i]) * ease(dt, tgt > uAmt[i] ? 11 : 14);
        units.setMatrixAt(i, M.compose(P.set(wtX, MY + (i + 0.5) * uh, 0), Q, S.setScalar(Math.max(uAmt[i], 0.001))));
      }

      // prompt row: N tiles shrinking so the whole row still fits one slab width
      const pitch = Math.min(0.55, (SLAB_W - 0.25) / N), tileW = pitch * 0.6;
      const tileH = Math.min(0.32, Math.max(0.08, pitch * 0.75));
      for (let i = 0; i < NMAX; i++) {
        const on = i < N ? rowAmt : 0.001;
        P.set(SX + (i - (N - 1) / 2) * pitch, yVis, PASSZ);
        row.setMatrixAt(i, M.compose(P, Q, S.set(tileW * on, tileH * on, 0.22 * on)));
      }
      band.scale.set(Math.max(0.001, (N - 1) * pitch + tileW + 0.2), Math.max(0.001, 0.44 * rowAmt), Math.max(0.001, 0.4 * rowAmt));
      band.position.set(SX, yVis, PASSZ);
      const dsz = Math.min(0.3, Math.max(0.16, pitch * 1.2));
      dec.scale.set(Math.max(decAmt, 0.001) * dsz, Math.max(decAmt, 0.001) * dsz, Math.max(decAmt, 0.001) * 0.22);
      dec.position.set(SX, yVis, PASSZ + 0.06);

      // KV tray: one tile per token the model now has to carry
      for (let i = 0; i < COLS * ROWS; i++) {
        const f = ease01((clock - born[i]) / 0.34);
        const col = i % COLS, r = Math.floor(i / COLS);
        P.set(TXC + (col - (COLS - 1) / 2) * GX, TY + 0.1 + (1 - f) * 0.85, TZ + (r - (ROWS - 1) / 2) * GZ);
        kv.setMatrixAt(i, M.compose(P, Q, S.setScalar(Math.max(f, 0.001))));
      }
      slabs.instanceColor.needsUpdate = true;
      units.instanceMatrix.needsUpdate = true;
      row.instanceMatrix.needsUpdate = true;
      kv.instanceMatrix.needsUpdate = true;

      out({
        playing, N, phase, gen,
        readout: phase === 'prefill' ? `prefill · ${N} tok in 1 pass · compute high · weights read ×1`
          : phase === 'kv' ? `prefill done · ${N} kv tiles · one pass · weights read ×1`
            : `decode · token ${tok} · compute low · weights read ×${shown}`,
      });
    },

    action(name, arg) {
      if (name === 'play') playing = !playing;
      else if (name === 'step') { playing = false; stepReq = true; }
      else if (name === 'restart') restart();
      else if (name === 'N') { N = [4, 16, 64].includes(Number(arg)) ? Number(arg) : 16; restart(); }
    },
  };
}

const ease01 = f => { const t = Math.min(1, Math.max(0, f)); return 1 - (1 - t) ** 2; };
