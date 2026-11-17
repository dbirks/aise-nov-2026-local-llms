// Scene `quant` — weight bits, activation bits and KV bits are THREE separate dials.
//
// Three independent volumes on light floor pads (left → right): a WEIGHT matrix (one small dark
// cube per sampled weight, height ∝ |value|), an ACTIVATION tensor (a thin column: one horizontal
// plate per element, width ∝ |value|) and the KV CACHE (two stacked plate piles, K and V).
//   · weights dial fp16 → int4 (W4A16) → nvfp4 (W4A4): cube heights SNAP to fewer magnitude
//     levels (visible staircase) and dark translucent plates mark the quantisation BLOCKS, each
//     with a dark scale tick at its foot — 4-bit storage still carries group/block scales.
//     nvfp4 uses the FP4 E2M1 magnitude grid (non-uniform: fine near 0, coarse at the top),
//     int4 a uniform magnitude ladder drawn deliberately coarse so the steps read on screen.
//   · a small mid-tone cap above each cube = |original − reconstructed| for that weight, so total
//     height stays the original value and the cap IS the reconstruction error. Nothing while fp16.
//     A thin ladder of level lines appears behind the grid: the exact magnitudes the heights are
//     allowed to land on (evenly spaced for INT4, fine near zero / coarse on top for FP4 E2M1).
//   · activations ONLY move when the activation dial moves (fp16 → fp8 → fp4). Picking int4
//     weights leaves the activation column completely untouched: that is the W4A16 point.
//   · KV dial fp16 → fp8 → nvfp4 squeezes the plate thickness (bytes per cached token) while the
//     light outline keeps showing the fp16 extent. It is driven independently of the weight dial.
// The dark bar on the light track in front of each group = relative bits/element (16-bit track).
//
// EVERY element value here is a fixed illustrative sample, not a real checkpoint. The bit numbers
// are arithmetic, not measurements: int4 shown as 4 + 32/128 ≈ 4.25 bits/param (one FP16
// scale+zero per 128-group) and nvfp4 as 4 + 8/16 = 4.5 (FP8-E4M3 block scale per 16) — the drawn
// block boundaries (2–3 columns) are schematic, not g=128. Do NOT imply: real model specs, memory
// or throughput numbers, that any precision is faster, that fp8/nvfp4 kernels exist on the
// speaker's or attendee hardware (nvfp4 needs supported GPUs), that every tensor is quantized
// (selective layers/bypasses are the norm), or that KV bits follow weight bits.
// Sources: repo README "Quantization: don't conflate weight bits, activation bits and KV bits";
// OCP Microscaling Formats (MX) / NVFP4 — Chhugani et al., arXiv:2409.12517 (FP4 E2M1 data +
// FP8-E4M3 block scale, block 16); vLLM "Quantized KV cache" + vllm.config.cache (fp8/nvfp4 KV).
import { THREE, lam, ghost, M, Q, P, S, ease, emitter, rng } from './_kit.js';

// ── numeric grids ─────────────────────────────────────────────────────────────
const E2M1 = [0, 0.5, 1, 1.5, 2, 3, 4, 6].map(v => v / 6);   // FP4 E2M1 magnitudes, normalised
const snapE = v => E2M1.reduce((b, g) => (Math.abs(g - v) < Math.abs(b - v) ? g : b), E2M1[0]);
const snapI4 = v => Math.round(v * 7) / 7;                    // INT4 magnitudes (8 drawn levels)
const snapF8 = v => { const s = Math.pow(2, Math.floor(Math.log2(v)) - 3); return Math.round(v / s) * s; };
const QW = { fp16: v => v, int4: snapI4, nvfp4: snapE };
const QA = { fp16: v => v, fp8: snapF8, fp4: snapE };
const WKEYS = ['fp16', 'int4', 'nvfp4'], AKEYS = ['fp16', 'fp8', 'fp4'], KKEYS = ['fp16', 'fp8', 'nvfp4'];
// bits per element INCLUDING the scale/metadata they travel with (arithmetic, see header)
const WBITS = { fp16: 16, int4: 4.25, nvfp4: 4.5 };
const ABITS = { fp16: 16, fp8: 8, fp4: 4.5 };
const KBITS = { fp16: 16, fp8: 8, nvfp4: 4.5 };
const WDIV = { fp16: [], int4: [2], nvfp4: [1, 3] };          // block boundary after column i
// the exact magnitude levels the heights above snap to: INT4 evenly spaced, FP4 E2M1 fine near
// zero and coarse at the top (drawn as a thin ladder behind the grid)
const LEVELS = { fp16: [], int4: [0, 1, 2, 3, 4, 5, 6, 7].map(j => j / 7), nvfp4: E2M1 };
const ADIV = { fp16: [], fp8: [], fp4: [3, 7, 11] };          // block boundary after plate i
const KDIV = { fp16: [], fp8: [3], nvfp4: [2, 5] };           // block boundary after plate i
// the auto tour: the point is what moves and what stubbornly does not
const BEATS = [
  { w: 'fp16', a: 'fp16', k: 'fp16', hold: 2.3 },
  { w: 'int4', a: 'fp16', k: 'fp16', hold: 2.6 },   // weights snap, activations untouched
  { w: 'nvfp4', a: 'fp4', k: 'fp16', hold: 2.6 },   // W4A4: both snap, finer blocks
  { w: 'fp16', a: 'fp16', k: 'fp8', hold: 2.4 },    // weights full again, KV moved alone
  { w: 'int4', a: 'fp16', k: 'fp8', hold: 2.8 },    // the combo a serving stack actually runs
];

// ── layout ────────────────────────────────────────────────────────────────────
const NW_C = 6, NW_R = 4, NX = NW_C * NW_R;
const PX = 0.34, PZ = 0.44, WX = c => WXC + (c - (NW_C - 1) / 2) * PX, WZ = r => (r - (NW_R - 1) / 2) * PZ;
const WXC = -1.75, WH0 = 0.18, WHR = 1.6;                     // weight group centre, min height, range
const NA = 14, AP = 0.145, AX0 = -0.58, AD = 0.45, AW0 = 0.10, AWR = 0.85;
const AC = AX0 + 0.5, AY = i => 0.14 + i * AP;
const NK = 7, KW = 0.55, KD = 0.85, KGAP = 0.05, KX = [1.42, 2.12], KC = 1.77;
const KTH = { fp16: 0.24, fp8: 0.12, nvfp4: 0.068 };          // plate thickness ∝ bytes/cached token
const KTOP0 = NK * KTH.fp16 + (NK - 1) * KGAP + 0.06;         // fp16 reference extent
const BARZ = 1.32, BARL = 1.25, BARX = [WXC, AC, KC];         // bits/element tracks in front
const LBLY = 2.62, LBLY2 = 2.34;                              // group labels / K·V labels

export default function build(scene, emit) {
  const out = emitter(emit);
  const box = new THREE.BoxGeometry(1, 1, 1);
  const edge = (w, h, d, c = 0x8a8a8a) => new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(w, h, d)),
    new THREE.LineBasicMaterial({ color: c }));

  // ── light floor pads: three separate volumes, three separate footprints ─────
  for (const [x, w, d] of [[WXC, NW_C * PX + 0.28, NW_R * PZ + 0.68], [AC, 1.34, 1.34], [KC, 1.72, 1.5]]) {
    const p = new THREE.Mesh(box, ghost(0x7a7a7a, 0.14)); p.position.set(x, 0.01, 0); p.scale.set(w, 0.02, d);
    const e = edge(w, 0.06, d, 0x767676); e.position.set(x, 0.03, 0);
    scene.add(p, e);
  }

  // ── weight grid + its error caps + its quantisation blocks ──────────────────
  const wGrid = new THREE.InstancedMesh(box, lam(0x262626), NX);
  const wErr = new THREE.InstancedMesh(box, lam(0x5c5c5c), NX);
  const wDiv = new THREE.InstancedMesh(box, ghost(0x111111, 0.35), 2);      // one plate per block split
  const wTick = new THREE.InstancedMesh(box, lam(0x111111), 2);             // the scale that plate carries
  const wLev = new THREE.InstancedMesh(box, lam(0x7c7c7c), 8);              // the magnitude ladder it snaps to
  wGrid.frustumCulled = wErr.frustumCulled = wDiv.frustumCulled = wTick.frustumCulled = false;
  wLev.frustumCulled = false;
  scene.add(wGrid, wErr, wDiv, wTick, wLev);
  const xDiv = c => (WX(c) + WX(c + 1)) / 2;

  // ── activation column ───────────────────────────────────────────────────────
  const aPlate = new THREE.InstancedMesh(box, lam(0x2b2b2b), NA);
  const aErr = new THREE.InstancedMesh(box, lam(0x5c5c5c), NA);
  const aDiv = new THREE.InstancedMesh(box, lam(0x111111), 3);
  aPlate.frustumCulled = aErr.frustumCulled = aDiv.frustumCulled = false;
  scene.add(aPlate, aErr, aDiv);
  const aRef = edge(AWR + AW0 + 0.06, NA * AP, AD + 0.04, 0x8f8f8f);
  aRef.position.set(AX0 + (AWR + AW0) / 2, AY((NA - 1) / 2), 0);
  scene.add(aRef);

  // ── KV stacks (K darker than V so the two split in monochrome) ───────────────
  const kMesh = [new THREE.InstancedMesh(box, lam(0xffffff), NK), new THREE.InstancedMesh(box, lam(0xffffff), NK)];
  const cK = new THREE.Color(0x1d1d1d), cV = new THREE.Color(0x4a4a4a);
  for (let s = 0; s < 2; s++) {
    for (let i = 0; i < NK; i++) kMesh[s].setColorAt(i, s ? cV : cK);
    kMesh[s].frustumCulled = false; scene.add(kMesh[s]);
    const e = edge(KW + 0.06, KTOP0 - 0.03, KD + 0.06, 0x8f8f8f);            // fp16 extent = the reference
    e.position.set(KX[s], 0.045 + (KTOP0 - 0.03) / 2, 0); scene.add(e);
  }
  const kTick = new THREE.InstancedMesh(box, lam(0x111111), 4);              // cache scales
  kTick.frustumCulled = false; scene.add(kTick);

  // ── bits/element tracks (light = the 16-bit reference width) ────────────────
  const bars = BARX.map(x => {
    const tr = new THREE.Mesh(box, ghost(0x6f6f6f, 0.18)); tr.position.set(x, 0.05, BARZ); tr.scale.set(BARL, 0.02, 0.16);
    const te = edge(BARL, 0.06, 0.18, 0x8f8f8f); te.position.copy(tr.position);
    const bar = new THREE.Mesh(box, lam(0x141414)); bar.position.set(x, 0.05, BARZ);
    scene.add(tr, te, bar); return bar;
  });

  // ── labels (short; every number lives in the readout) ───────────────────────
  function label(text, h = 0.3) {
    const fpx = 64, f = `bold ${fpx}px ui-monospace, monospace`;
    const cv = document.createElement('canvas'), g = cv.getContext('2d');
    g.font = f;
    const w = Math.ceil(g.measureText(text).width) + 16;
    cv.width = w; cv.height = fpx + 16;
    g.font = f; g.fillStyle = '#111111'; g.textBaseline = 'middle'; g.fillText(text, 8, cv.height / 2);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, depthWrite: false, depthTest: false }));
    sp.renderOrder = 20; sp.userData.ar = w / cv.height; sp.scale.setScalar(0.001);
    scene.add(sp); return sp;
  }
  const labW = label('weights'), labA = label('activations'), labK = label('kv cache');
  const labKk = label('K', 0.24), labKv = label('V', 0.24);
  const setLab = (sp, h, x, y, z) => { sp.scale.set(Math.max(h * sp.userData.ar, 0.001), Math.max(h, 0.001), 1); sp.position.set(x, y, z); };

  // ── state ───────────────────────────────────────────────────────────────────
  const rand = rng(1127);
  const WV = Array.from({ length: NX }, () => 0.08 + rand() * 0.92);
  const AV = Array.from({ length: NA }, () => 0.08 + rand() * 0.92);
  const wq = new Float32Array(NX), we = new Float32Array(NX);   // quantised / error targets
  const wc = new Float32Array(NX), wec = new Float32Array(NX);  // animated
  const aq = new Float32Array(NA), ae = new Float32Array(NA);
  const ac = new Float32Array(NA), aec = new Float32Array(NA);
  const wdT = new Float32Array(2), wdC = new Float32Array(2);
  const lvT = new Float32Array(8);                            // ladder level positions (0..1 of range)
  const adT = new Float32Array(3), adC = new Float32Array(3);
  const kdT = new Float32Array(4), kdC = new Float32Array(4);
  let wp = 'fp16', ap = 'fp16', kp = 'fp16', err = 0, kth = KTH.fp16;
  let levT = 0, levC = 0;
  let playing = true, bi = 0, bt = 0;
  const flash = [0, 0, 0];

  function recompute(silent) {
    let se = 0, so = 0;
    for (let i = 0; i < NX; i++) {
      wq[i] = QW[wp](WV[i]); const d = WV[i] - wq[i]; we[i] = Math.abs(d); se += d * d; so += WV[i] * WV[i];
    }
    err = Math.sqrt(se / so);
    for (let i = 0; i < NA; i++) { aq[i] = QA[ap](AV[i]); ae[i] = Math.max(0, AV[i] - aq[i]); }
    for (let j = 0; j < 2; j++) wdT[j] = j < WDIV[wp].length ? 1 : 0;
    for (let j = 0; j < 3; j++) adT[j] = j < ADIV[ap].length ? 1 : 0;
    for (let j = 0; j < 4; j++) kdT[j] = j < KDIV[kp].length * 2 ? 1 : 0;
    levT = wp === 'fp16' ? 0 : 1;
    if (LEVELS[wp].length) for (let j = 0; j < 8; j++) lvT[j] = LEVELS[wp][j] ?? lvT[j];
    if (!silent) { flash[0] = 1; flash[1] = 1; flash[2] = 1; }
  }
  function setBeat(i) {
    bi = ((i % BEATS.length) + BEATS.length) % BEATS.length; bt = 0;
    const b = BEATS[bi];
    if (b.w !== wp) flash[0] = 1;
    if (b.a !== ap) flash[1] = 1;
    if (b.k !== kp) flash[2] = 1;
    wp = b.w; ap = b.a; kp = b.k; recompute(true);
  }
  setBeat(0);

  return {
    view: { target: [-0.6, 1.05, 0], radius: 40, theta: 0.42, phi: 1.12, size: 2.65 },
    update(dt) {
      if (playing) {
        bt += dt;
        if (bt >= BEATS[bi].hold) setBeat(bi + 1);
      }
      const k = ease(dt, 7);
      levC += (levT - levC) * k;
      kth += (KTH[kp] - kth) * k;
      for (let i = 0; i < NX; i++) { wc[i] += (WH0 + wq[i] * WHR - wc[i]) * k; wec[i] += (we[i] * WHR - wec[i]) * k; }
      for (let i = 0; i < NA; i++) { ac[i] += (AW0 + aq[i] * AWR - ac[i]) * k; aec[i] += (ae[i] * AWR - aec[i]) * k; }
      for (let j = 0; j < 2; j++) wdC[j] += (wdT[j] - wdC[j]) * k;
      for (let j = 0; j < 3; j++) adC[j] += (adT[j] - adC[j]) * k;
      for (let j = 0; j < 4; j++) kdC[j] += (kdT[j] - kdC[j]) * k;
      for (let g = 0; g < 3; g++) flash[g] = Math.max(0, flash[g] - dt * 1.6);

      // weight cubes: height = |value|; the dark cap above = what quantisation took away
      for (let r = 0; r < NW_R; r++) {
        for (let c = 0; c < NW_C; c++) {
          const i = r * NW_C + c, h = Math.max(wc[i], 0.001), e = Math.max(wec[i], 0.001);
          wGrid.setMatrixAt(i, M.compose(P.set(WX(c), h / 2, WZ(r)), Q, S.set(0.22, h, 0.26)));
          wErr.setMatrixAt(i, M.compose(P.set(WX(c), h + 0.02 + e / 2, WZ(r)), Q, S.set(0.19, e, 0.23)));
        }
      }
      // quantisation blocks: a shared scale per block, so it is a visible row of dark ticks
      // the discrete magnitude levels the heights are allowed to land on (none while fp16)
      for (let j = 0; j < 8; j++) {
        const a = Math.max(levC, 0.001);
        wLev.setMatrixAt(j, M.compose(P.set(WXC, WH0 + lvT[j] * WHR, -NW_R * PZ / 2 - 0.14), Q,
          S.set(Math.max((NW_C * PX - 0.1) * a, 0.0001), 0.014, 0.014)));
      }
      const dh = WH0 + WHR + 0.28;                            // block plate rises with the tallest cube
      const dz = (NW_R * PZ + 0.08);
      for (let j = 0; j < 2; j++) {
        const a = wdC[j], b = WDIV[wp][j] ?? WDIV.nvfp4[j], x = xDiv(b);
        wDiv.setMatrixAt(j, M.compose(P.set(x, dh * a / 2, 0), Q, S.set(Math.max(0.028 * a, 0.0001), Math.max(dh * a, 0.0001), Math.max(dz * a, 0.0001))));
        wTick.setMatrixAt(j, M.compose(P.set(x, 0.1 * a, NW_R * PZ / 2 + 0.22), Q, S.set(Math.max(0.09 * a, 0.0001), Math.max(0.2 * a, 0.0001), Math.max(0.09 * a, 0.0001))));
      }
      // activation column: width = |value|; only this dial moves it
      for (let i = 0; i < NA; i++) {
        const w = Math.max(ac[i], 0.001), e = Math.max(aec[i], 0.001);
        aPlate.setMatrixAt(i, M.compose(P.set(AX0 + w / 2, AY(i), 0), Q, S.set(w, 0.1, AD)));
        aErr.setMatrixAt(i, M.compose(P.set(AX0 + w + 0.015 + e / 2, AY(i), 0), Q, S.set(e, 0.055, AD)));
      }
      for (let j = 0; j < 3; j++) {
        const a = Math.max(adC[j], 0.001), b = ADIV[ap][j] ?? ADIV.fp4[j];
        aDiv.setMatrixAt(j, M.compose(P.set(AX0 + (AWR + AW0) / 2, (AY(b) + AY(b + 1)) / 2, 0), Q,
          S.set((AWR + AW0 + 0.1) * a, 0.022 * a, AD + 0.08)));
      }
      // kv stacks: thickness ∝ bytes per cached token, the light outline stays at the fp16 extent
      const pitch = kth + KGAP, top = 0.06 + NK * kth + (NK - 1) * KGAP;
      for (let s = 0; s < 2; s++) {
        for (let i = 0; i < NK; i++) {
          kMesh[s].setMatrixAt(i, M.compose(P.set(KX[s], 0.06 + i * pitch + kth / 2, 0), Q, S.set(KW, Math.max(kth, 0.001), KD)));
        }
        if (kMesh[s].instanceColor) kMesh[s].instanceColor.needsUpdate = true;
      }
      for (let j = 0; j < 4; j++) {
        const a = Math.max(kdC[j], 0.001), s = j % 2, b = KDIV[kp][(j - s) / 2] ?? 2;
        kTick.setMatrixAt(j, M.compose(P.set(KX[s], 0.06 + (b + 1) * pitch - KGAP / 2, KD / 2 + 0.07), Q,
          S.set(KW * 0.8 * a, 0.035 * a, 0.025)));
      }
      for (const mesh of [wGrid, wErr, wDiv, wTick, aPlate, aErr, aDiv, kMesh[0], kMesh[1], kTick]) mesh.instanceMatrix.needsUpdate = true;

      // bars: relative bits per element against the 16-bit track
      const bits = [WBITS[wp], ABITS[ap], KBITS[kp]];
      bars.forEach((bar, g) => {
        const L = Math.max(0.03, BARL * bits[g] / 16);
        bar.scale.set(L, 0.05 * (1 + 0.8 * flash[g]), 0.16);
        bar.position.set(BARX[g] - BARL / 2 + L / 2, 0.05, BARZ);
      });

      setLab(labW, 0.29, WXC, LBLY, 0);
      setLab(labA, 0.29, AC, LBLY, 0);
      setLab(labK, 0.29, KC, LBLY, 0);
      setLab(labKk, 0.22, KX[0], LBLY2, 0);
      setLab(labKv, 0.22, KX[1], LBLY2, 0);

      out({
        playing, weights: wp, acts: ap, kv: kp, err: +(err * 100).toFixed(1),
        readout: `weights ${WBITS[wp]} incl. scales · activations ${ABITS[ap]} · kv ${kp} · w err ${(err * 100).toFixed(1)}%`,
      });
    },
    action(name, arg) {
      const v = String(arg);
      if (name === 'play') { playing = !playing; bt = playing ? BEATS[bi].hold - 0.001 : bt; }
      else if (name === 'step') { playing = false; setBeat(bi + 1); }
      // the slide primes every control with its `initial` once on mount: a dial set to the value it
      // already has is that prime (or a no-op click), so it must not stop the auto tour.
      else if (name === 'weights' && WKEYS.includes(v) && v !== wp) { playing = false; wp = v; recompute(); }
      else if (name === 'acts' && AKEYS.includes(v) && v !== ap) { playing = false; ap = v; recompute(); }
      else if (name === 'kv' && KKEYS.includes(v) && v !== kp) { playing = false; kp = v; recompute(); }
    },
  };
}
