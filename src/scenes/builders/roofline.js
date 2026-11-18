// Scene `roofline` — attainable throughput = min(peak compute, bandwidth × arithmetic intensity).
//
// It is a 2D plot; the only 3D is the thin wireframe "GPU housing" it hangs inside (README Scene H:
// keep the roofline 2D unless a third axis is clearly identified). x = arithmetic intensity in
// flop per byte moved, drawn in log2 steps so every doubling takes the same width; height =
// attainable throughput. The thick dark polyline is the envelope: a rising RAMP while one load of
// the weights only feeds a few token vectors (memory-bound, darker tint), then a flat ROOF once the
// cores are what runs out (compute-bound, lighter tint). The knee is the ridge.
//   DECODE rides the ramp. README's idealized example: a BF16 M×N weight tile applied to B token
//   vectors is ~2MNB flop for ~2MN weight bytes, so weight-only intensity ≈ B — batch 1 sits far
//   left, batch 64 has 64 reuses of the same tile and can cross the ridge.
//   PREFILL rides the roof: a chunk of prompt positions is one wide matmul per weight tile, so it
//   starts on the right. A longer prompt means MORE PASSES at that height, not a higher roof —
//   intensity is shown capped at the chunk size.
//   4-BIT WEIGHTS are ~4× fewer bytes per flop, so both markers slide RIGHT along the same roof.
//   Nothing here moves the roof itself: cheaper bytes are not a higher peak (kernels, dequant work
//   and hardware support all change, which is why the bar is a fixed illustrative roof).
// The light column above a marker is the compute it cannot reach at that intensity; the dark cubes
// flowing up the ramp are the weight bytes that set the height. All units are illustrative.
//
// Sources: Williams, Paterson & Waterman, "Roofline: An Insightful Visual Performance Model"
// (CACM 2009); README §2 (prefill/decode, weight-only intensity ≈ B, "never follows bits
// perfectly"). See the slide notes for what is simulated.
import { THREE, lam, ghost, M, Q, P, S, ease, emitter } from './_kit.js';

// ── plot frame, in world units ──────────────────────────────────────────
const XL = -3.5, XR = 3.5;                  // x extent of the plot
const YB = -1.45, YT = 1.85;                // y: no throughput … peak compute (the roof)
const L0 = 0, L1 = 11;                      // log2 intensity: 1 … 2048 flop/byte
const RIDGE = 5;                            // ≈32 flop/byte: where the ramp meets the roof
const YR0 = YB + 0.7;                       // envelope height at intensity 1
const AX = xOf(L0), AY = YR0, BX = xOf(RIDGE), BY = YT;   // ramp foot / knee on the roof

const CHUNK = 512;                          // illustrative: token vectors per prefill weight load
const QMULT = { fp16: 1, '4-bit': 4 };      // illustrative: flop per weight byte vs fp16
const LOG2 = Math.log2;

function xOf(l) { return XL + ((l - L0) / (L1 - L0)) * (XR - XL); }
function envY(l) { return l < RIDGE ? YR0 + (l / RIDGE) * (YT - YR0) : YT; }

// The story the scene tells while playing: decode climbs the ramp with batch, prefill rides the
// roof, then the same workloads with 4× fewer weight bytes. One beat ≈ 2.1 s, loop ≈ 10.7 s.
const TOUR = [
  { batch: 1, prompt: 128, weights: 'fp16' },
  { batch: 8, prompt: 128, weights: 'fp16' },
  { batch: 64, prompt: 128, weights: 'fp16' },
  { batch: 64, prompt: 2048, weights: 'fp16' },
  { batch: 1, prompt: 128, weights: '4-bit' },
];
const BEAT = 2.15;

/** short dark label on a transparent sprite (canvas text; redrawn once the display font loads) */
function mkLabel(text, h) {
  const cv = document.createElement('canvas');
  const c2 = cv.getContext('2d');
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.minFilter = THREE.LinearFilter;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  const draw = () => {
    const font = 'bold 72px "Jersey 15", ui-monospace, monospace';
    c2.font = font;
    cv.width = Math.ceil(c2.measureText(text).width) + 16;
    cv.height = 96;
    c2.font = font;
    c2.textBaseline = 'middle';
    c2.fillStyle = '#0c0c0c';
    c2.fillText(text, 8, 52);
    tex.needsUpdate = true;
    sp.scale.set((h * cv.width) / cv.height, h, 1);
  };
  draw();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(draw).catch(() => {});
  return sp;
}

export default function build(scene, emit) {
  const out = emitter(emit);

  // ── GPU housing: a thin wireframe box, 3D only as the container ────────
  const hx0 = XL - 0.35, hx1 = XR + 0.35, hy0 = YB - 1.5, hy1 = YT + 1.35, hz0 = -1.15, hz1 = 1.0;
  const hw = hx1 - hx0, hh = hy1 - hy0, hd = hz1 - hz0;
  const housing = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(hw, hh, hd)),
    new THREE.LineBasicMaterial({ color: 0x141414 }));
  housing.position.set((hx0 + hx1) / 2, (hy0 + hy1) / 2, (hz0 + hz1) / 2);
  const backWall = new THREE.Mesh(new THREE.BoxGeometry(hw - 0.06, hh - 0.06, 0.04), ghost(0x161616, 0.05));
  backWall.position.set((hx0 + hx1) / 2, (hy0 + hy1) / 2, hz0 + 0.04);
  const deck = new THREE.Mesh(new THREE.BoxGeometry(hw - 0.06, 0.05, hd - 0.1), ghost(0x161616, 0.11));
  deck.position.set((hx0 + hx1) / 2, hy0 + 0.05, 0);
  // a few "board" ribs on the back wall so the box reads as a housing, not a void
  const ribs = new THREE.InstancedMesh(new THREE.BoxGeometry(0.06, hh - 0.5, 0.06), ghost(0x161616, 0.1), 5);
  for (let i = 0; i < 5; i++) ribs.setMatrixAt(i, M.compose(P.set(xOf(1 + i * 2.2), (hy0 + hy1) / 2, hz0 + 0.11), Q, S.setScalar(1)));
  scene.add(housing, backWall, deck, ribs);

  // ── the two zones: under the ramp = memory-bound (darker), under the roof = compute-bound ──
  const zone = (pts, op) => {
    const g = new THREE.ShapeGeometry(new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y))));
    const m = new THREE.Mesh(g, ghost(0x161616, op));
    m.position.z = -0.3;
    scene.add(m);
  };
  zone([[XL, YB], [BX, YB], [BX, BY], [XL, AY]], 0.155);
  zone([[BX, YB], [XR, YB], [XR, BY], [BX, BY]], 0.06);

  // octave grid (log2 spacing), the ridge itself stays a solid post
  const gv = [];
  for (let l = 1; l < L1; l++) {
    if (l === RIDGE) continue;
    gv.push(xOf(l), YB, -0.28, xOf(l), envY(l), -0.28);
  }
  scene.add(new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(gv, 3)),
    new THREE.LineBasicMaterial({ color: 0xbebebe })));

  const yaxis = new THREE.Mesh(new THREE.BoxGeometry(0.04, YT - YB + 0.08, 0.04), lam(0x5c5c5c));
  yaxis.position.set(XL, (YB + YT) / 2, -0.1);
  const rail = new THREE.Mesh(new THREE.BoxGeometry(XR - XL + 0.3, 0.04, 0.2), lam(0x5c5c5c));
  rail.position.set((XL + XR) / 2, YB - 0.04, -0.1);
  const ridgePost = new THREE.Mesh(new THREE.BoxGeometry(0.05, BY - YB, 0.05), lam(0x2e2e2e));
  ridgePost.position.set(BX, (YB + BY) / 2, -0.14);
  scene.add(yaxis, rail, ridgePost);

  // ── the envelope: min(peak, bandwidth × intensity) ─────────────────────
  const rLen = Math.hypot(BX - AX, BY - AY), rAng = Math.atan2(BY - AY, BX - AX);
  const ramp = new THREE.Mesh(new THREE.BoxGeometry(rLen + 0.12, 0.16, 0.2), lam(0x0e0e0e));
  ramp.position.set((AX + BX) / 2, (AY + BY) / 2, 0);
  ramp.rotation.z = rAng;
  const roof = new THREE.Mesh(new THREE.BoxGeometry(XR - BX + 0.04, 0.16, 0.2), lam(0x0e0e0e));
  roof.position.set((BX + XR) / 2, BY, 0);
  const knee = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.26, 0.28), lam(0x0b0b0b));
  knee.position.set(BX, BY, 0);
  scene.add(ramp, roof, knee);

  // ── weight traffic: dark cubes flowing up the ramp under a memory-bound marker ──
  const FLOW = 16;
  const flow = new THREE.InstancedMesh(new THREE.BoxGeometry(0.09, 0.09, 0.13), lam(0x101010), FLOW);
  flow.frustumCulled = false;
  scene.add(flow);

  // ── markers ────────────────────────────────────────────────────────────
  const marker = (r, z) => {
    const ball = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 10), lam(0x0c0c0c));
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.05, 1, 0.05), lam(0x6a6a6a));
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.11, 1, 0.11), ghost(0x161616, 0.2));
    scene.add(post, head, ball);
    return { ball, post, head, r, z, l: 0 };
  };
  const dec = marker(0.19, 0.22), pre = marker(0.2, -0.2);

  const addLabel = (text, h, x, y, z = 0.55) => {
    const s = mkLabel(text, h);
    s.position.set(x, y, z);
    scene.add(s);
    return s;
  };
  const decTag = addLabel('decode', 0.3, 0, 0);
  const preTag = addLabel('prefill', 0.3, 0, 0);
  // zone names go in a header row above the plate: the tint below them is the zone
  addLabel('memory-bound', 0.32, xOf(1.9), YT + 1.12);
  addLabel('ridge', 0.28, BX, YT + 1.12);
  addLabel('compute-bound', 0.32, xOf(8.3), YT + 1.12);
  addLabel('flop per byte', 0.3, (XL + XR) / 2, YB - 0.94);
  for (const [l, t] of [[L0, '1'], [3, '8'], [6, '64'], [9, '512']]) addLabel(t, 0.26, xOf(l), YB - 0.42);

  // ── state ──────────────────────────────────────────────────────────────
  let batch = 1, prompt = 128, weights = 'fp16';
  let playing = true, tour = 0, bt = 0, stepReq = false, ph = 0, flowAmt = 0.001;
  const INT = m => m.l;

  function apply(k) {
    const b = TOUR[((k % TOUR.length) + TOUR.length) % TOUR.length];
    batch = b.batch; prompt = b.prompt; weights = b.weights;
  }
  apply(0);
  dec.l = LOG2(batch * QMULT[weights]);
  pre.l = LOG2(Math.min(prompt, CHUNK) * QMULT[weights]);

  function place(m, tag, l, above) {
    m.l = l;
    const x = Math.min(XR - 0.16, Math.max(XL + 0.16, xOf(l))), y = envY(l);
    m.ball.position.set(x, y, m.z);
    m.post.scale.set(1, Math.max(0.001, y - YB), 1);
    m.post.position.set(x, (YB + y) / 2, m.z);
    const gh = Math.max(0.001, BY - y - m.r - 0.12);      // compute out of reach at this intensity
    m.head.scale.set(1, gh, 1);
    m.head.position.set(x, y + m.r + 0.12 + gh / 2, m.z);
    const w = tag.scale.x / 2;                            // keep tags inside the housing
    const tx = Math.min(XR - 0.1 - w, Math.max(XL + 0.1 + w, x + (above ? -0.1 : -0.58)));
    tag.position.set(tx, y + (above ? Math.min(m.r + 0.72, YT + 0.42 - y) : -m.r - 0.5), 0.6);
  }

  return {
    view: { target: [0, 0, 0], radius: 40, theta: 0.34, phi: 1.18, size: 3.6 },
    update(dt) {
      if (playing) {
        bt += dt;
        ph = (ph + dt * 0.3) % 1;
        if (bt >= BEAT) { bt = 0; tour++; apply(tour); }
      }
      if (stepReq) { stepReq = false; playing = false; tour++; apply(tour); }

      const dT = LOG2(batch * QMULT[weights]);
      const pT = LOG2(Math.min(prompt, CHUNK) * QMULT[weights]);
      dec.l += (dT - dec.l) * ease(dt, 6);
      pre.l += (pT - pre.l) * ease(dt, 6);
      place(dec, decTag, dec.l, true);
      place(pre, preTag, pre.l, false);

      // bytes only have to climb the ramp while the marker is under it
      const tMax = Math.min(1, Math.max(0, dec.l / RIDGE)), want = tMax > 0.02 ? 1 : 0.001;
      flowAmt += (want - flowAmt) * ease(dt, want > flowAmt ? 7 : 5);
      for (let i = 0; i < FLOW; i++) {
        const t = ((ph + i / FLOW) % 1) * tMax;
        const edge = Math.min(1, Math.min(t, tMax - t) / 0.07 + 0.15);
        const s = Math.max(0.001, flowAmt * edge);
        P.set(AX + t * (BX - AX), AY + t * (BY - AY), 0.36);
        flow.setMatrixAt(i, M.compose(P, Q, S.set(s, s, s)));
      }
      flow.instanceMatrix.needsUpdate = true;

      const zone = l => (l < RIDGE ? 'memory-bound' : 'compute-bound');
      const iD = Math.round(2 ** INT(dec)), iP = Math.round(2 ** INT(pre));
      out({
        playing, batch, prompt, weights, iDec: iD, iPre: iP,
        decZone: zone(dec.l), preZone: zone(pre.l),
        readout: `decode @${Math.round(batch * QMULT[weights])} f/b ${zone(LOG2(batch * QMULT[weights]))}`
          + ` · prefill @${Math.round(Math.min(prompt, CHUNK) * QMULT[weights])} ${zone(pT)} · ${weights}`,
      });
    },
    action(name, arg) {
      if (name === 'play') { playing = !playing; bt = 0; }
      else if (name === 'step') { stepReq = true; }
      else if (name === 'back') { playing = false; bt = 0; tour--; apply(tour); }
      else if (name === 'batch') { const v = [1, 8, 64].includes(Number(arg)) ? Number(arg) : 1; if (v !== batch) { playing = false; batch = v; } }
      else if (name === 'prompt') { const v = Number(arg) === 2048 ? 2048 : 128; if (v !== prompt) { playing = false; prompt = v; } }
      else if (name === 'weights') { const v = String(arg) === '4-bit' ? '4-bit' : 'fp16'; if (v !== weights) { playing = false; weights = v; } }
    },
  };
}
