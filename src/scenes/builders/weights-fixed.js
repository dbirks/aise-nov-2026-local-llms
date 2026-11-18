// Scene `weights-fixed` — handoff A02 "training creates weights; inference uses them".
//
// Centre: a 6×6 toy WEIGHT MATRIX standing on a light plinth: one dark cube = one learned
// number, cube height ∝ |w|, shade dark→mid with |w| (values come from a seeded PRNG —
// synthetic, no real model). Left: a TRAINING DATA stack and a gradient arrow; while phase =
// training, packets cross the arrow every beat, the cubes shift height slightly (a seeded
// update), the `updates` counter grows, and the WRITE arrow down to the model file lights up.
// Bottom: the ARTIFACT row — the matrix is saved as a FILE (safetensors / GGUF = a file
// format), which an ENGINE (vLLM / SGLang for safetensors, llama.cpp for GGUF) LOADS. Format
// ≠ engine: the file box is tagged "file format", the other box "engine", and the LOAD arrow
// only lights during inference.
// While phase = inference the training stack greys out, 4 prompt TOKEN tiles slide in from the
// left and pass UNDER the fixed matrix (the plinth edge darkens = the weights are read), then
// 6 LOGITS bars rise on the right — one next-token distribution. A new prompt changes the
// bars; the cubes never move and `updates` never grows: inference reads weights, it does not
// write them.
//
// Correctness: nothing here is a real checkpoint. The grid is a schematic for "many numbers
// learned offline and reused read-only"; the file/engine pair claims only the
// container-vs-runtime distinction (GGUF is a format, not an engine). No measurements, no
// tokens/sec, no training-data claims — see the slide notes.
import { THREE, lam, M, Q, P, S, ease, rng, emitter } from './_kit.js';

const N = 6;                 // 6×6 toy matrix = 36 numbers (real checkpoints: billions)
const NW = N * N;
const NT = 4;                // prompt tokens drawn
const NB = 6;                // logits bars (real vocab is ~10^5)
const STACK = 4;             // training-data slabs

// ── geometry anchors (slide units; whole scene ≈ 8.6 × 6, centred on the view target) ──
const gx = i => -1.75 + i * 0.5;           // matrix columns
const gz = j => -1.25 + j * 0.5;           // matrix rows
const bx = k => 2.0 + k * 0.4;             // logits bars
const PLATE_TOP = 0.78, PLATE_BOT = 0.62;
const TOK_Y = -0.72, TOK_Z = 0.35;
const SHELF_TOP = -0.5;
const SX = -3.1;                            // training-data stack column
const FILE_X = -0.6, FILE_Y = -2.2, ENG_X = 2.6;
const WX = -1.85;                           // write arrow

const cMid = new THREE.Color(0x8f8f8f), cDark = new THREE.Color(0x161616);
const cFlash = new THREE.Color(0x0c0c0c);
const cIdle = new THREE.Color(0xe2e2e2), cStackOn = new THREE.Color(0x3f3f3f);
const cBar = new THREE.Color(0x6e6e6e), cBarWin = new THREE.Color(0x111111);
const tmp = new THREE.Color(), tmp2 = new THREE.Color();

const clamp01 = v => (v < 0 ? 0 : v > 1 ? 1 : v);
const seg = (t, a, b) => clamp01((t - a) / (b - a));
const inOut = p => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);

const BEAT_TRAIN = 1.5, BEAT_INFER = 6.0;

const ENG_OF = { safetensors: 'vLLM / SGLang', gguf: 'llama.cpp' };
const ENG_RO = { safetensors: 'vllm', gguf: 'llama.cpp' };
const FILE_OF = { safetensors: 'safetensors', gguf: 'GGUF' };

export default function build(scene, emit) {
  const out = emitter(emit);

  /** camera-facing label, dark text on transparent; .setText(t) redraws a short string */
  const label = (text, h) => {
    const draw = t => {
      const fpx = 64, f = `bold ${fpx}px ui-monospace, monospace`;
      const cv = document.createElement('canvas'), g0 = cv.getContext('2d');
      g0.font = f;
      cv.width = Math.ceil(Math.max(g0.measureText(t).width, t.length * fpx * 0.84)) + 28;
      cv.height = fpx + 18;
      const g = cv.getContext('2d');
      g.font = f; g.fillStyle = '#151515'; g.textBaseline = 'middle';
      g.fillText(t, 14, cv.height / 2 + 1);
      return { tex: new THREE.CanvasTexture(cv), a: cv.width / cv.height };
    };
    const cur = draw(text);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({
      map: cur.tex, transparent: true, depthWrite: false, depthTest: false,
    }));
    sp.scale.set(h * cur.a, h, 1);
    sp.renderOrder = 10;
    scene.add(sp);
    sp.setText = t => {
      const r = draw(t);
      sp.material.map.dispose(); sp.material.map = r.tex;
      sp.scale.set(h * r.a, h, 1);
      sp.material.needsUpdate = true;
    };
    return sp;
  };

  // ── backdrop wall + floor (light tones: dark geometry and dark labels read against them) ──
  const wall = new THREE.Mesh(new THREE.BoxGeometry(9.2, 6.1, 0.18), lam(0xe6e6e6));
  wall.position.set(-0.15, 0.12, -2.35);
  const floor = new THREE.Mesh(new THREE.BoxGeometry(9.0, 0.16, 4.4), lam(0xd8d8d8));
  floor.position.set(-0.15, -2.72, 0.2);
  scene.add(wall, floor);

  // ── the matrix on its plinth (plate supported at the back so tokens pass UNDER it) ──
  const plate = new THREE.Mesh(new THREE.BoxGeometry(3.4, PLATE_TOP - PLATE_BOT, 2.9), lam(0xcfcfcf));
  plate.position.set(-0.45, (PLATE_TOP + PLATE_BOT) / 2, 0);
  const plateEdge = new THREE.LineSegments(new THREE.EdgesGeometry(plate.geometry),
    new THREE.LineBasicMaterial({ color: 0x8f8f8f }));
  plateEdge.position.copy(plate.position);
  const pedestal = new THREE.Mesh(new THREE.BoxGeometry(3.4, 3.2, 0.2), lam(0xdadada));
  pedestal.position.set(-0.45, -0.98, -1.45);
  scene.add(plate, plateEdge, pedestal);

  const cells = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), lam(0xffffff), NW);
  cells.frustumCulled = false;
  scene.add(cells);

  // ── prompt token tiles (light body + dark outline: input ≠ weight) ──
  const toks = [];
  for (let k = 0; k < NT; k++) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.3, 0.42), lam(0xbdbdbd));
    const edge = new THREE.LineSegments(new THREE.EdgesGeometry(body.geometry),
      new THREE.LineBasicMaterial({ color: 0x141414 }));
    g.add(body, edge);
    scene.add(g);
    toks.push(g);
  }

  // ── training-data stack ──
  const stack = [];
  for (let s = 0; s < STACK; s++) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.2, 1.45), lam(0xe2e2e2));
    m.position.set(SX, 1.0 + s * 0.42, -0.2);
    scene.add(m);
    stack.push(m);
  }

  // ── gradient arrow (stack → matrix) ──
  const shaft = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.12, 0.12), lam(0xe0e0e0));
  shaft.position.set(-2.35, 0.98, 1.15);
  const head = new THREE.Mesh(new THREE.ConeGeometry(0.19, 0.34, 4), lam(0xe0e0e0));
  head.rotation.z = -Math.PI / 2;
  head.position.set(-1.85, 0.98, 1.15);
  scene.add(shaft, head);
  const gpkt = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), lam(0xffffff), 3);
  gpkt.frustumCulled = false;
  scene.add(gpkt);

  // ── logits shelf + bars (the next-token distribution) ──
  const shelf = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.16, 1.3), lam(0xd0d0d0));
  shelf.position.set(3.0, SHELF_TOP - 0.08, 0.2);
  const shelfEdge = new THREE.LineSegments(new THREE.EdgesGeometry(shelf.geometry),
    new THREE.LineBasicMaterial({ color: 0x6f6f6f }));
  shelfEdge.position.copy(shelf.position);
  scene.add(shelf, shelfEdge);
  const bars = [];
  for (let k = 0; k < NB; k++) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.26, 1, 0.26), lam(0x6e6e6e));
    b.position.set(bx(k), SHELF_TOP + 0.02, 0.2);
    b.scale.y = 0.01;
    scene.add(b);
    bars.push(b);
  }

  // ── artifact row: model file → engine ──
  const fileBox = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.68, 1.25), lam(0xc8c8c8));
  fileBox.position.set(FILE_X, FILE_Y, 0.35);
  const fileEdge = new THREE.LineSegments(new THREE.EdgesGeometry(fileBox.geometry),
    new THREE.LineBasicMaterial({ color: 0x111111 }));
  fileEdge.position.copy(fileBox.position);
  const engBox = new THREE.Mesh(new THREE.BoxGeometry(2.9, 0.68, 1.25), lam(0xd6d6d6));
  engBox.position.set(ENG_X, FILE_Y, 0.35);
  const engEdge = new THREE.LineSegments(new THREE.EdgesGeometry(engBox.geometry),
    new THREE.LineBasicMaterial({ color: 0x111111 }));
  engEdge.position.copy(engBox.position);
  scene.add(fileBox, fileEdge, engBox, engEdge);

  /** a chunky arrow; [shaft, head] so both can be darkened per phase */
  const mkArrow = (x, y, z, len, vertical) => {
    const g = new THREE.Group();
    const sh = new THREE.Mesh(new THREE.BoxGeometry(vertical ? 0.13 : len, vertical ? len : 0.13, 0.13), lam(0xe0e0e0));
    const hd = new THREE.Mesh(new THREE.ConeGeometry(0.19, 0.32, 4), lam(0xe0e0e0));
    if (vertical) { hd.rotation.x = Math.PI; hd.position.y = -len / 2 - 0.13; }
    else { hd.rotation.z = -Math.PI / 2; hd.position.x = len / 2 + 0.13; }
    g.add(sh, hd);
    g.position.set(x, y, z);
    scene.add(g);
    return [sh, hd];
  };
  const writeArr = mkArrow(WX, -0.95, -1.15, 1.15, true);   // matrix → file (training writes)
  const loadArr = mkArrow(0.85, FILE_Y, 1.0, 1.0, false);   // file → engine (inference loads)

  // ── labels (all inside x ∈ [-4.3, 4.3]: the caption card covers the left of the slide) ──
  label('training data', 0.21).position.set(SX, 2.6, 0.3);
  const lUpd = label('updates 0', 0.21); lUpd.position.set(SX, 0.42, 0.5);
  label('weight matrix', 0.24).position.set(-0.45, 2.92, 0.3);
  const lMode = label('read only', 0.22); lMode.position.set(-0.45, -0.28, 0.9);
  label('prompt tokens', 0.21).position.set(-2.9, -1.22, 0.7);
  label('logits', 0.24).position.set(3.0, 1.66, 0.4);
  label('file format', 0.2).position.set(FILE_X, -1.72, 0.9);
  const lFile = label('safetensors', 0.21); lFile.position.set(FILE_X, FILE_Y - 0.02, 1.05);
  label('engine', 0.2).position.set(ENG_X, -1.72, 0.9);
  const lEng = label('vLLM / SGLang', 0.2); lEng.position.set(ENG_X, FILE_Y - 0.02, 1.05);
  const lWrites = label('writes', 0.19); lWrites.position.set(WX - 0.75, -1.62, -1.0);
  const lLoads = label('loads', 0.19); lLoads.position.set(0.85, -1.95, 1.15);

  // ── state ──────────────────────────────────────────────────────────────────
  let mode = 'inference', fmt = 'safetensors';
  let playing = true, p = 0, steps = 0;
  let updates = 0, prompt = 1, flash = 0;
  let trAmt = 0, inAmt = 0;                       // smoothed phase crossfade
  const W = new Float64Array(NW), Ht = new Float64Array(NW), Hc = new Float64Array(NW);
  const L = new Float64Array(NB);
  let win = 0;

  const setH = i => { Ht[i] = 0.16 + 1.3 * Math.abs(W[i]); };
  {
    const r = rng(1234);
    for (let i = 0; i < NW; i++) { W[i] = r() * 2 - 1; setH(i); Hc[i] = Ht[i]; }
  }
  function logits(n) {                            // one toy next-token distribution per prompt
    const r = rng(977 + n * 131);
    let mx = 0;
    for (let k = 0; k < NB; k++) { L[k] = 0.12 + r(); if (L[k] > mx) { mx = L[k]; win = k; } }
  }
  logits(1);

  function trainBeat() {
    const r = rng(0x51ed + updates * 7919);
    for (let i = 0; i < NW; i++) {
      W[i] = Math.max(-1, Math.min(1, W[i] * 0.98 + (r() - 0.5) * 0.18));
      setH(i);
    }
    updates++; flash = 1;
    lUpd.setText(`updates ${updates}`);
  }
  /** replay the seeded updates from the initial grid, so 'back' can undo one truthfully */
  function weightsAfter(n) {
    const r0 = rng(1234);
    for (let i = 0; i < NW; i++) W[i] = r0() * 2 - 1;
    for (let u = 0; u < n; u++) {
      const r = rng(0x51ed + u * 7919);
      for (let i = 0; i < NW; i++) W[i] = Math.max(-1, Math.min(1, W[i] * 0.98 + (r() - 0.5) * 0.18));
    }
    for (let i = 0; i < NW; i++) setH(i);
    updates = n;
    lUpd.setText(`updates ${updates}`);
  }
  function tick(dt) {
    p += dt / (mode === 'training' ? BEAT_TRAIN : BEAT_INFER);
    if (p >= 1) {
      p -= 1;
      if (mode === 'training') trainBeat();
      else { prompt++; logits(prompt); }
      return true;
    }
    return false;
  }

  return {
    view: { target: [-0.15, 0, 0], radius: 40, theta: 0.5, phi: 1.22, size: 3.6 },
    update(dt) {
      if (playing) tick(dt);
      else if (steps > 0 && tick(dt * 1.2)) steps--;
      flash += (0 - flash) * ease(dt, 3.2);
      trAmt += ((mode === 'training' ? 1 : 0) - trAmt) * ease(dt, 6);
      inAmt += ((mode === 'inference' ? 1 : 0) - inAmt) * ease(dt, 6);

      // ── weight cubes: dark + tall = a big learned number; heights frozen in inference ──
      let idx = 0;
      for (let j = 0; j < N; j++) {
        for (let i = 0; i < N; i++, idx++) {
          Hc[idx] += (Ht[idx] - Hc[idx]) * ease(dt, 7);
          const aw = clamp01(Math.abs(W[idx]));
          tmp.copy(cMid).lerp(cDark, 0.2 + 0.8 * aw);
          if (flash > 0.01) tmp.lerp(cFlash, 0.45 * flash);
          P.set(gx(i), PLATE_TOP + Hc[idx] / 2, gz(j));
          S.set(0.4, Math.max(0.02, Hc[idx]), 0.4);
          cells.setMatrixAt(idx, M.compose(P, Q, S));
          cells.setColorAt(idx, tmp);
        }
      }
      cells.instanceMatrix.needsUpdate = true;
      if (cells.instanceColor) cells.instanceColor.needsUpdate = true;

      // ── tokens: slide in from the left and pass UNDER the matrix ───────────
      let readP = 0;
      for (let k = 0; k < NT; k++) {
        const prog = inOut(seg(p, 0.05 * k, 0.05 * k + 0.55));
        const s = prog > 0 && prog < 1 ? Math.min(1, Math.min(prog, 1 - prog) * 8) * inAmt : 0.001;
        toks[k].position.set(-4.2 + prog * 5.4, TOK_Y, TOK_Z);
        toks[k].scale.setScalar(Math.max(s, 0.001));
        if (prog > 0.3 && prog < 0.85) readP = Math.max(readP, inAmt);
      }
      plateEdge.material.color.setHex(readP > 0 ? 0x111111 : 0x8f8f8f);

      // ── training stack + gradient arrow: live only while training ───────────
      stack.forEach((m, s) => {
        const active = trAmt > 0.5 && s === updates % STACK;
        m.material.color.copy(cIdle).lerp(active ? cStackOn : cMid, trAmt * (active ? 1 : 0.35));
      });
      tmp2.copy(cIdle).lerp(cDark, trAmt);
      for (const m of [shaft, head]) m.material.color.copy(tmp2);

      let gp = 0;
      for (let n = 0; n < 3; n++, gp++) {
        const q = seg(p, 0.1 + 0.11 * n, 0.45 + 0.11 * n);
        const s = (q > 0 && q < 1 ? Math.min(1, Math.min(q, 1 - q) * 8) : 0.001) * trAmt;
        P.set(-2.75 + q * 1.05, 0.98, 1.15); S.set(0.18 * s, 0.18 * s, 0.18 * s);
        gpkt.setMatrixAt(gp, M.compose(P, Q, S));
        gpkt.setColorAt(gp, cFlash);
      }
      gpkt.instanceMatrix.needsUpdate = true;
      if (gpkt.instanceColor) gpkt.instanceColor.needsUpdate = true;

      // ── logits bars: a new distribution per prompt ─────────────────────────
      const grow = seg(p, 0.58, 0.8), fall = 1 - seg(p, 0.92, 1);
      for (let k = 0; k < NB; k++) {
        const h = Math.max(0.01, (0.28 + 1.42 * L[k]) * grow * fall * inAmt);
        bars[k].scale.y = h;
        bars[k].position.y = SHELF_TOP + h / 2;
        bars[k].material.color.copy(k === win ? cBarWin : cBar);
      }

      // ── write / load arrows: training writes the file, inference loads it ───
      for (const m of writeArr) m.material.color.copy(cIdle).lerp(cDark, trAmt);
      for (const m of loadArr) m.material.color.copy(cIdle).lerp(cDark, inAmt);
      lWrites.material.opacity = 0.2 + 0.8 * trAmt;
      lLoads.material.opacity = 0.2 + 0.8 * inAmt;

      // ── readout ───────────────────────────────────────────────────────────
      const ro = mode === 'training'
        ? `training · weight updates ${updates} · 36 toy values adjusted · writes ${fmt}`
        : `inference · prompt ${prompt} · weight updates ${updates} · loaded from ${fmt} into ${ENG_RO[fmt]}`;
      out({ playing, mode, artifact: fmt, readout: ro });
    },
    action(name, arg) {
      if (name === 'play') { playing = !playing; steps = 0; }
      else if (name === 'step') { playing = false; steps = 1; }
      else if (name === 'back') {
        // undo the last completed beat: one fewer weight update / one fewer prompt
        playing = false; steps = 0; p = 0;
        if (mode === 'training') { if (updates > 0) weightsAfter(updates - 1); }
        else if (prompt > 1) { prompt--; logits(prompt); }
        flash = 0;
      }
      else if (name === 'mode') {
        const m = String(arg) === 'training' ? 'training' : 'inference';
        if (m !== mode) {
          mode = m; p = 0; steps = 0;
          lMode.setText(m === 'training' ? 'updating' : 'read only');
        }
      } else if (name === 'artifact') {
        const f = String(arg) === 'gguf' ? 'gguf' : 'safetensors';
        if (f !== fmt) { fmt = f; lFile.setText(FILE_OF[f]); lEng.setText(ENG_OF[f]); }
      }
    },
  };
}
