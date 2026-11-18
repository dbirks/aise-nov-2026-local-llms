// Deck v2 `batching` variant B — one weight read per engine step, B request lanes below it.
//
// Mechanism (docs/research/v2/kv-serving.md §batching fact 1): a decode step streams every resident
// weight through the compute units once, whatever the batch size. Every request in the batch
// appends one token in that same step, so the weight traffic is shared by B tokens instead of one.
// Toy model only: the weight set = 20 units, read exactly once per step, so weight units landing on
// each token = 20 / B. No bandwidth, no seconds, no tok/s — those would be invented measurements.
//
// Encoding: x = step order inside the loop (tokens land left to right), z = the separate requests in
// the batch (stacked in depth; on screen the lanes fan down-left because the camera is elevated),
// y = stacking only. The dark slab is the whole weight set; the light plate is that one read
// sweeping through it — one sweep per step for every B. The bottom bar is 20 / B on the SAME linear
// scale as the slab width, so a quarter-width bar really is a quarter of the slab's traffic per token.
import { THREE, lam, ghost, M, Q, P, S, ease, emitter } from './_kit.js';

const UNITS = 20;          // toy: the whole weight set, in arbitrary units
const SPAN = 4.6;          // world width standing for UNITS (slab, tracks, and the per-token bar)
const MAXB = 16;           // largest batch the control offers
const STEPS = 6;           // tokens per lane before the story loops
const STEP = 1.55;         // seconds per engine step
const READ = 0.85;         // part of that step spent streaming the weights
const HOLD = 2.2;          // seconds to read the result before looping
const LOOP = STEPS * STEP + HOLD;
const TH = 0.16, PHI = 1.14;   // camera angles, mirrored by the screen-space label helper below
// Orthonormal view basis of that camera (three.js spherical: x=sinφ sinθ, y=cosφ, z=sinφ cosθ):
// screen right r = (cosθ, 0, −sinθ), screen up u = d × r.
const RV = new THREE.Vector3(Math.cos(TH), 0, -Math.sin(TH));
const DV = new THREE.Vector3(Math.sin(PHI) * Math.sin(TH), Math.cos(PHI), Math.sin(PHI) * Math.cos(TH));
const UV = new THREE.Vector3().crossVectors(DV, RV);

export default function build(scene, emit) {
  const out = emitter(emit);
  const box = new THREE.BoxGeometry(1, 1, 1);
  const edgeMat = new THREE.LineBasicMaterial({ color: 0x8f8f8f });

  // Labels are placed by SCREEN height (world units above/below the view target): the ortho camera
  // is elevated, so anything the scene stacks in z drifts down the screen, and text placed in world
  // y would collide with the lanes. screenY ≈ 0.9*y − 0.157*x − 0.4*z, hence the solve here.
  function label(text, x, screenY, h = 0.34) {
    const cv = document.createElement('canvas');
    const g = cv.getContext('2d');
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.minFilter = THREE.LinearFilter;
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false }));
    sp.renderOrder = 10;
    scene.add(sp);
    const rec = {
      sp,
      text: '',
      at(x, screenY) { sp.position.set(x, (screenY - UV.x * x) / UV.y, 0); },
      set(t) {
        rec.text = String(t);
        const font = 'bold 72px "Jersey 15", ui-monospace, monospace';
        const lines = rec.text.split('\n');
        g.font = font;
        cv.width = Math.ceil(Math.max(...lines.map(l => g.measureText(l).width)) + 16);
        const lh = 88;
        cv.height = Math.ceil(lines.length * lh);
        g.font = font;
        g.textBaseline = 'middle';
        g.fillStyle = '#0d0d0d';
        lines.forEach((l, i) => g.fillText(l, 8, i * lh + lh / 2));
        tex.needsUpdate = true;
        sp.scale.set((h * cv.width) / cv.height, h, 1);
      },
    };
    rec.set(text);
    rec.at(x, screenY);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => rec.set(rec.text)).catch(() => {});
    return rec;
  }

  // ── the weight slab: dark, whole, read once per step ──
  const slab = new THREE.Mesh(box, lam(0x141414));
  slab.scale.set(SPAN, 0.9, 1.3);
  slab.position.set(0, 2.0, 0);
  const slabEdge = new THREE.LineSegments(new THREE.EdgesGeometry(box), edgeMat);
  slabEdge.scale.copy(slab.scale);
  slabEdge.position.copy(slab.position);
  scene.add(slab, slabEdge);
  label('weights (20 units)', -1.5, 2.95);
  label('one read per step', 1.3, 2.95);

  // ── the read sweep: one light plate crossing the slab every step, whatever B ──
  const sweep = new THREE.Mesh(box, lam(0xe6e6e6));
  sweep.scale.set(0.28, 1.1, 1.5);
  sweep.position.set(0, 2.0, 0);
  scene.add(sweep);

  // ── counters ──
  label('reads per step', -1.15, 1.35);
  label('1', -1.15, 0.92, 0.5);
  label('tokens per step', 1.35, 1.35);
  const tokNum = label('4', 1.35, 0.92, 0.5);

  // ── request lanes (z) and the token tiles they each get per step ──
  const trackMat = ghost(0x5a5a5a, 0.3);
  const tracks = [], laneZ = [];
  for (let i = 0; i < MAXB; i++) {
    const t = new THREE.Mesh(box, trackMat);
    scene.add(t);
    tracks.push(t);
    laneZ.push(0);
  }
  const tiles = new THREE.InstancedMesh(box, lam(0x1c1c1c), MAXB * STEPS);
  tiles.frustumCulled = false;
  scene.add(tiles);
  label('requests', -2.35, -0.85, 0.32);
  label('one new token per request', 1.15, -0.85, 0.32);

  // ── weight units landing on each token: same linear scale as the slab ──
  label('weight units per token', -0.95, -1.35, 0.32);
  const baseline = new THREE.Mesh(box, ghost(0x5a5a5a, 0.26));
  baseline.scale.set(SPAN, 0.03, 0.12);
  baseline.position.set(0, -1.85, 0);
  scene.add(baseline);
  const unitBar = new THREE.Mesh(box, lam(0x141414));
  unitBar.position.set(0, -1.85, 0);
  const unitEdge = new THREE.LineSegments(new THREE.EdgesGeometry(box), edgeMat);
  scene.add(unitBar, unitEdge);
  const unitNum = label('5', 1.4, -1.85, 0.42);
  label('0', -2.3, -2.25, 0.3);
  label('20 units', 1.95, -2.25, 0.3);
  const caveat = label('until compute or KV\nreads become the limit', 0.6, -2.85, 0.62);
  caveat.sp.visible = false;

  const xTok = s => -2.0 + s * ((SPAN - 0.6) / (STEPS - 1));
  const fmt = v => (Number.isInteger(v) ? String(v) : String(Math.round(v * 100) / 100));

  let b = 4, playing = true, clock = 0, stepReq = false, barW = SPAN / b;
  const spacing = B => (B <= 4 ? 0.9 : 2.7 / (B - 1));

  return {
    view: { target: [0, 0.25, 0], radius: 40, theta: TH, phi: PHI, size: 2.7 },
    update(dt) {
      if (playing) { clock += dt; if (clock >= LOOP) clock -= LOOP; }
      if (stepReq) {
        stepReq = false; playing = false;
        const n = Math.floor(clock / STEP) + 1;
        clock = n * STEP > STEPS * STEP ? 0 : n * STEP;
      }
      const k = ease(dt, 7), dz = spacing(b);
      const th = Math.min(0.32, dz * 0.42), td = Math.min(0.44, dz * 0.6), pop = STEP - READ;

      for (let i = 0; i < MAXB; i++) {
        const on = i < b;
        laneZ[i] += ((i - (b - 1) / 2) * dz - laneZ[i]) * k;
        const t = tracks[i];
        t.visible = on;
        t.scale.set(SPAN - 0.3, 0.03, td);
        t.position.set(0, 0.1 - th / 2 - 0.03, laneZ[i]);
      }
      for (let s = 0; s < STEPS; s++) {
        const start = (s + 1) * STEP - pop;
        const prog = Math.max(0, Math.min(1, (clock - start) / pop));
        for (let i = 0; i < MAXB; i++) {
          const id = i * STEPS + s;
          if (i >= b || prog <= 0) { tiles.setMatrixAt(id, M.compose(P.set(0, -60, 0), Q, S.set(0.001, 0.001, 0.001))); continue; }
          const grow = 0.35 + 0.65 * prog;
          tiles.setMatrixAt(id, M.compose(P.set(xTok(s), 0.1, laneZ[i]), Q, S.set(Math.max(0.001, 0.26 * grow), Math.max(0.001, th * grow), Math.max(0.001, td * grow))));
        }
      }
      tiles.instanceMatrix.needsUpdate = true;

      const local = clock % STEP;
      const inRead = clock < STEPS * STEP && local < READ;
      sweep.visible = inRead;
      if (inRead) sweep.position.x = -SPAN / 2 - 0.3 + (SPAN + 0.6) * (local / READ);

      barW += (SPAN / b - barW) * k;
      const w = Math.max(barW, 0.002);
      unitBar.scale.set(w, 0.28, 0.28);
      unitBar.position.set(-SPAN / 2 + w / 2, -1.85, 0);
      unitEdge.scale.set(w, 0.29, 0.29);
      unitEdge.position.copy(unitBar.position);
      const per = UNITS / b;
      unitNum.set(fmt(per));
      unitNum.at(Math.max(-2.0, Math.min(2.55, -SPAN / 2 + w + 0.42)), -1.85);
      tokNum.set(String(b));
      caveat.sp.visible = b === MAXB;

      out({ playing, b, readout: `simulated · ${b} requests · 1 weight read · ${fmt(per)} units per token` });
    },
    action(name, arg) {
      if (name === 'play') playing = typeof arg === 'boolean' ? arg : !playing;
      else if (name === 'step') stepReq = true;
      else if (name === 'b') { const v = Number(arg); if (v === 1 || v === 4 || v === 16) b = v; }
    },
  };
}
