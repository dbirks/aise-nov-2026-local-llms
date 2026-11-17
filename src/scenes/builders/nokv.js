// Scene `nokv` — why the KV cache exists: without it, every decode step re-runs the whole prefix.
//
// Two mirrored lanes. Each lane is a stack of 6 translucent LAYER PLATES (attention layers drawn;
// real models have many more — illustrative) with a row of TOKEN TILES in front, a rail behind the
// plates and a meter column beside it. A pass lights the cells it executes, bottom layer → top.
//   LEFT = no cache: the whole known prefix lights through all six plates, on every pass. Work grows
//     with (prompt + tokens so far) × passes. Its back rail stays empty — nothing is kept.
//   RIGHT = kv cache: the prompt prefills once (a wall of light sweeps the row, filling one dark
//     K/V cube per position per layer), then each pass lights ONE new column while the stored cubes
//     behind it pulse — that new query still reads every earlier key/value.
// Under each token row: a bar per position = how many times that position has been executed — a
// descending staircase on the left (the prompt is re-run every pass), single ticks on the right.
// The three meters share ONE scale (this run's naive total): positions re-run vs positions run once,
// plus the past K/V positions the cached lane still READS. The cache turns repeated compute into
// memory traffic; it does not delete the past. Counts are token positions per pass — README: not
// attention FLOPs, not per-layer/per-head reads. Growth is polynomial, never exponential.
import { THREE, lam, ghost, M, Q, P, S, ease, emitter } from './_kit.js';

const LAYERS = 6;                    // attention layers drawn (illustrative)
const SLOTS = 22;                    // max positions = prompt 16 + 6 generated
const DX = 0.135, CELL = 0.098;      // token pitch, cell footprint
const DY = 0.70, Y0 = -0.15;         // layer pitch, lowest plate
const PLATE_D = 0.92;                // plate depth (z)
const STORE_Z = -0.58;               // stored K/V rail, clearly behind the plates
const TOK_Z = 0.58, BAR_Z = 0.92;    // token row, per-position counts (in front)
const BAR_Y = -1.24, BAR_H = 0.42;   // count-bar baseline and full-scale height
const SPAN = (SLOTS - 1) * DX;       // grid width
const LX0 = -3.72, RX0 = 0.885;      // lane grid origins (x of position 0)
const xL = i => LX0 + i * DX, xR = i => RX0 + i * DX;
const yOf = l => Y0 + l * DY;
const MID_L = LX0 + SPAN / 2, MID_R = RX0 + SPAN / 2;

const MX = { rerun: -0.5, ran: 0.02, read: 0.52 };   // meter column centres
const MW = { rerun: 0.28, ran: 0.28, read: 0.18 };
const MY = Y0, MH = 3.9;                              // meters share one scale

const nGen = p => (p === 16 ? 6 : 10);   // tokens generated per loop (illustrative)
const bump = (a, w) => Math.max(0, 1 - Math.abs(a) / w);
const clamp01 = v => Math.max(0, Math.min(1, v));

/** short camera-facing label: dark text on transparent, redrawn once the display font loads */
function mkLabel(scene, text, h, x, y, z) {
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthWrite: false, depthTest: false }));
  sp.renderOrder = 20;
  const draw = () => {
    const font = 'bold 72px "Jersey 15", ui-monospace, monospace';
    const probe = document.createElement('canvas').getContext('2d');
    probe.font = font;
    const w = Math.ceil(probe.measureText(text).width) + 16;
    // a fresh canvas each time: reusing one can leave the previous (pre-font) glyphs behind
    const cv = document.createElement('canvas');
    cv.width = w; cv.height = 96;
    const c2 = cv.getContext('2d');
    c2.font = font; c2.textBaseline = 'middle'; c2.fillStyle = '#0c0c0c';
    c2.fillText(text, 8, 52);
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.minFilter = THREE.LinearFilter;
    const old = sp.material.map;
    sp.material.map = tex; sp.material.needsUpdate = true;
    if (old) old.dispose();
    sp.scale.set((h * w) / 96, h, 1);
  };
  draw();
  if (document.fonts && document.fonts.load) {
    document.fonts.load('bold 72px "Jersey 15"').then(draw).catch(() => {});
  }
  sp.position.set(x, y, z);
  scene.add(sp);
  return sp;
}

export default function build(scene, emit) {
  const out = emitter(emit);

  // ── lane scaffolding: plates, edges, the back rail, the token shelf ─────────────
  const pw = SPAN + 0.24;
  for (const cx of [MID_L, MID_R]) {
    for (let l = 0; l < LAYERS; l++) {
      const y = yOf(l) - 0.03;
      const plate = new THREE.Mesh(new THREE.BoxGeometry(pw, 0.025, PLATE_D), ghost(0xc0c0c0, 0.12));
      plate.position.set(cx, y, 0);
      const edge = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(pw, 0.06, PLATE_D)),
        new THREE.LineBasicMaterial({ color: 0x8d8d8d }));
      edge.position.set(cx, y, 0);
      // back rail = where this layer keeps its K/V. The right lane fills it with dark cubes; the
      // left lane's rail stays empty — nothing stored, so nothing to reuse next pass.
      const rail = new THREE.Mesh(new THREE.BoxGeometry(pw, 0.016, 0.2), ghost(0x9c9c9c, 0.5));
      rail.position.set(cx, y + 0.06, STORE_Z);
      scene.add(plate, edge, rail);
    }
    const shelf = new THREE.Mesh(new THREE.BoxGeometry(pw, 0.028, 0.26), ghost(0x8f8f8f, 0.5));
    shelf.position.set(cx, -0.87, TOK_Z);
    scene.add(shelf);
  }

  // ── instanced geometry ──────────────────────────────────────────────────────────
  const NC = LAYERS * SLOTS;
  const inst = n => {
    const m = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), lam(0xffffff), n);
    m.frustumCulled = false;
    scene.add(m);
    return m;
  };
  const cellsL = inst(NC), cellsR = inst(NC), store = inst(NC);
  const tokL = inst(SLOTS), tokR = inst(SLOTS), barL = inst(SLOTS), barR = inst(SLOTS);

  // ── meters: one shared scale, so left vs right is a real comparison ─────────────
  const mkMeter = key => {
    const w = MW[key];
    const edge = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(w, MH, w)),
      new THREE.LineBasicMaterial({ color: 0x141414 }));
    edge.position.set(MX[key], MY + MH / 2, -0.12);
    const fill = new THREE.Mesh(new THREE.BoxGeometry(w - 0.06, MH, w - 0.06), lam(0x141414));
    fill.position.set(MX[key], MY, -0.12);
    scene.add(edge, fill);
    return fill;
  };
  const mRerun = mkMeter('rerun'), mRan = mkMeter('ran'), mRead = mkMeter('read');

  mkLabel(scene, 'no cache', 0.3, MID_L, yOf(LAYERS - 1) + 0.62, 0);
  mkLabel(scene, 'kv cache', 0.3, MID_R, yOf(LAYERS - 1) + 0.62, 0);
  mkLabel(scene, 'rerun', 0.19, MX.rerun, -0.44, -0.12);
  mkLabel(scene, 'new', 0.19, MX.ran, -0.44, -0.12);
  mkLabel(scene, 'k/v read', 0.19, MX.read, -0.44, -0.12);

  // ── state ───────────────────────────────────────────────────────────────────────
  const GL = new Float32Array(NC), GR = new Float32Array(NC), ST = new Float32Array(NC), RD = new Float32Array(NC);
  const BL = new Float32Array(SLOTS), BR = new Float32Array(SLOTS), TV = new Float32Array(SLOTS);
  let prompt = 16, gen = nGen(prompt);
  let pass = 0, u = 0, playing = true, stopAt = Infinity, hold = 0;
  const total = () => gen + 1;                                    // prefill + one pass per new token
  const naiveMax = () => total() * prompt + (total() * (total() - 1)) / 2;
  const reset = () => { pass = 0; u = 0; hold = 0; stopAt = Infinity; };
  // pass j runs positions 0 … prompt+j-1; position i is the *newest* at pass jOf(i)
  const jOf = i => (i < prompt ? 0 : i - prompt + 1);
  const inPass = (i, j) => (i <= prompt + j - 1 ? 1 : 0);

  const cLite = new THREE.Color(0xc4c4c4), cDark = new THREE.Color(0x101010);
  const cPrompt = new THREE.Color(0x8c8c8c), cGen2 = new THREE.Color(0x1d1d1d);
  const cStore = new THREE.Color(0x7e7e7e), cRead = new THREE.Color(0x0c0c0c);
  const tmp = new THREE.Color();

  const naiveAt = (k, f) => {                       // positions re-executed (no cache)
    let n = 0;
    for (let j = 0; j < k && j < total(); j++) n += prompt + j;
    return n + (k < total() ? Math.floor(f * (prompt + k) + 1e-6) : 0);
  };
  const ranAt = (k, f) => {                         // positions executed once (kv cache)
    if (k === 0) return Math.floor(f * prompt + 1e-6);
    return prompt + Math.min(k - 1, gen) + (k <= gen && f > 0.4 ? 1 : 0);
  };
  const readAt = (k, f) => {                        // past K/V positions the new query reads
    let n = 0;
    for (let j = 1; j < k && j <= gen; j++) n += prompt + j;
    return n + (k >= 1 && k <= gen ? Math.floor(f * (prompt + k) + 1e-6) : 0);
  };

  return {
    view: { target: [0, 1.35, 0], radius: 40, theta: 0.34, phi: 1.18, size: 3.45 },
    update(dt) {
      const tot = total();
      if (playing) {
        if (pass < tot && pass < stopAt) {
          const dur = pass === 0 ? 1.2 : (prompt === 16 ? 0.9 : 0.55);
          u += dt / dur;
          while (u >= 1 && pass < tot) { u -= 1; pass++; }
          if (pass >= tot) { u = 1; hold = 1.7; }
          else if (pass >= stopAt) { u = 0; playing = false; }
        } else if (pass >= tot) {
          hold -= dt;
          if (hold <= 0) reset();
        } else playing = false;                      // single beat finished
      }

      const k = Math.min(pass, tot), f = k >= tot ? 1 : u;
      const nPass = prompt + k;              // positions this pass re-runs (naive lane)
      const newest = prompt + k - 1;         // newest position executed this pass
      const waveY = f * (LAYERS + 1.2) - 0.6;   // bottom → top sweep
      const waveX = f * (nPass + 1.4) - 0.7;    // prefill sweep along the row
      const pulse = bump(waveY - (LAYERS - 1) / 2, LAYERS * 0.72);

      // ── compute cells (on the plates) and stored K/V (behind them) ──────────────
      for (let l = 0; l < LAYERS; l++) {
        const y = yOf(l);
        for (let i = 0; i < SLOTS; i++) {
          const idx = l * SLOTS + i;
          // LEFT: every position in the prefix, every pass — the rectangle lights again
          const tl = i < nPass ? bump(waveY - l - 0.06 * i, 0.95) : 0;
          // RIGHT: the prefill wall, then only the newest column
          const tr = k === 0 ? (i < prompt ? bump(waveX - i, 1.5) : 0)
            : (i === newest && k <= gen ? bump(waveY - l, 0.95) : 0);
          GL[idx] += (tl - GL[idx]) * ease(dt, tl > GL[idx] ? 20 : 7);
          GR[idx] += (tr - GR[idx]) * ease(dt, tr > GR[idx] ? 20 : 7);

          P.set(xL(i), y + 0.07 + 0.1 * GL[idx], 0.06);
          S.set(CELL, 0.045 + 0.2 * GL[idx], CELL);
          cellsL.setMatrixAt(idx, M.compose(P, Q, S));
          cellsL.setColorAt(idx, tmp.copy(cLite).lerp(cDark, GL[idx]));

          P.set(xR(i), y + 0.07 + 0.1 * GR[idx], 0.06);
          S.set(CELL, 0.045 + 0.2 * GR[idx], CELL);
          cellsR.setMatrixAt(idx, M.compose(P, Q, S));
          cellsR.setColorAt(idx, tmp.copy(cLite).lerp(cDark, GR[idx]));

          // stored K/V: written once, kept, read by every later query
          const keep = k === 0 ? (i < prompt ? (waveX > i ? 1 : 0) : 0)
            : (i < prompt ? 1 : (i === newest && k <= gen ? (f * LAYERS > l ? 1 : 0) : 0));
          ST[idx] += (keep - ST[idx]) * ease(dt, keep > ST[idx] ? 11 : 16);
          const rd = k >= 1 && k <= gen && i <= newest ? bump(waveY - l, 1.2) : 0;
          RD[idx] += (rd - RD[idx]) * ease(dt, rd > RD[idx] ? 16 : 9);
          const s = Math.max(ST[idx], 0.001);
          P.set(xR(i), y + 0.09, STORE_Z);
          S.set(0.076 * s, (0.045 + 0.1 * s) * (1 + 0.45 * RD[idx]), 0.076 * s);
          store.setMatrixAt(idx, M.compose(P, Q, S));
          store.setColorAt(idx, tmp.copy(cStore).lerp(cRead, RD[idx]));
        }
      }

      // ── token rows + how many times each position has been executed ─────────────
      const shown = Math.min(prompt + Math.min(k, gen), SLOTS);
      for (let i = 0; i < SLOTS; i++) {
        const vis = i < shown ? 1 : 0.001;
        TV[i] += (vis - TV[i]) * ease(dt, vis > TV[i] ? 12 : 16);
        const isNew = k >= 1 && k <= gen && i === newest ? 1 : 0;
        const fL = i < nPass && k < tot ? pulse : 0;
        const fR = isNew * pulse;
        const s = Math.max(TV[i], 0.001), gen2 = i >= prompt;
        const h0 = 0.16;
        P.set(xL(i), -0.87 + h0 * (1 + 0.5 * fL) / 2, TOK_Z);
        S.set(0.1 * s, h0 * (1 + 0.5 * fL) * s, 0.13 * s);
        tokL.setMatrixAt(i, M.compose(P, Q, S));
        tokL.setColorAt(i, tmp.copy(gen2 ? cGen2 : cPrompt).lerp(cDark, 0.9 * fL));
        P.set(xR(i), -0.87 + h0 * (1 + 0.7 * fR) / 2, TOK_Z);
        S.set(0.1 * s, h0 * (1 + 0.7 * fR) * s, 0.13 * s);
        tokR.setMatrixAt(i, M.compose(P, Q, S));
        tokR.setColorAt(i, tmp.copy(gen2 ? cGen2 : cPrompt).lerp(cDark, 0.9 * fR));

        let cl = 0;
        for (let j = 0; j < k && j < tot; j++) cl += inPass(i, j);
        if (k < tot && inPass(i, k)) cl += f;
        const jn = jOf(i);
        const cr = jn < k ? 1 : (jn === k && k < tot
          ? (i < prompt ? clamp01(f * prompt - i) : clamp01(f * LAYERS)) : 0);
        BL[i] += (cl - BL[i]) * ease(dt, 6);
        BR[i] += (cr - BR[i]) * ease(dt, 8);
        // height ∝ times executed (same scale both lanes); dark simply means "has run"
        const maxc = tot;
        const hL = Math.max(BL[i] / maxc, 0.001) * BAR_H, hR = Math.max(BR[i] / maxc, 0.001) * BAR_H;
        P.set(xL(i), BAR_Y + hL / 2, BAR_Z); S.set(0.075, Math.max(hL, 0.001), 0.075);
        barL.setMatrixAt(i, M.compose(P, Q, S));
        barL.setColorAt(i, tmp.copy(cLite).lerp(cDark, Math.min(1, BL[i] * 2.5)));
        P.set(xR(i), BAR_Y + hR / 2, BAR_Z); S.set(0.075, Math.max(hR, 0.001), 0.075);
        barR.setMatrixAt(i, M.compose(P, Q, S));
        barR.setColorAt(i, tmp.copy(cLite).lerp(cDark, Math.min(1, BR[i] * 2.5)));
      }

      for (const m of [cellsL, cellsR, store, tokL, tokR, barL, barR]) {
        m.instanceMatrix.needsUpdate = true;
        if (m.instanceColor) m.instanceColor.needsUpdate = true;
      }

      // ── meters ──────────────────────────────────────────────────────────────────
      const naive = naiveAt(k, f), ran = ranAt(k, f), read = readAt(k, f), mx = naiveMax();
      const setMeter = (m, v) => {
        const fr = Math.max(0.004, Math.min(1, v / mx));
        m.scale.set(1, fr, 1);
        m.position.y = MY + MH * fr / 2;
      };
      setMeter(mRerun, naive); setMeter(mRan, ran); setMeter(mRead, read);

      out({
        playing, prompt, pass: k, generated: Math.min(k, gen), reRun: naive, ranOnce: ran, kvRead: read,
        readout: `re-run ${naive} vs ${ran} positions · past k/v read ${read} · `
          + (k === 0 ? 'prefill' : `token ${Math.min(k, gen)}/${gen}`),
      });
    },
    action(name, arg) {
      if (name === 'play') {
        playing = !playing;
        stopAt = Infinity;
        if (playing && pass >= total()) reset();
      } else if (name === 'step') {
        if (pass >= total()) reset();
        stopAt = pass + 1;          // finish/advance exactly one beat, then stop
        playing = true;
      } else if (name === 'prompt') {
        prompt = Number(arg) === 4 ? 4 : 16;
        gen = nGen(prompt);
        reset();
      }
    },
  };
}
