// Scene `drafters` — same target verifier, four drafting mechanisms (LAB brainstorm).
//
// The token-position axis (x) and the verifier slab at the bottom NEVER move. Only the drafter
// machinery above the slot row changes, so the mechanisms are directly comparable:
//   mtp     small learned heads attached to the target model (they hang off the dark bus out of
//           the column), one per future slot, chained: head i feeds head i+1 → K discrete draft
//           steps. Native MTP heads can be part of the target model; this does NOT claim every
//           MTP layout produces all positions independently in one zero-cost operation.
//   eagle-3 a small SEPARATE tower (visible gap to the column) fed with target features, drafting
//           one slot at a time; an optional extra candidate sits beside slot 3 in z (chain → tree).
//   dflash  one broad block drafter: a single slab sweeps across the K masked slots and fills them
//           in ONE draft pass — the contrast with EAGLE-3's sequential steps.
//   dspark  the DFlash slab + short dark Markov links between neighbouring slots + one confidence
//           bar per slot; the low-confidence suffix is greyed. Those scores only turn into adaptive
//           verification scheduling when the serving runtime implements that scheduler.
// Then the shared slab makes ONE left→right target pass: slots up to the accepted prefix commit
// (darkest + tick + growing run bar), everything after stays light = drafted but not used.
//
// All counts here are illustrative demo data — no measured accept lengths, proposal costs, GPU
// times or speedups. The accept pattern is deliberately identical for all four drafters so the
// drafting mechanism is the only thing that changes. Sources: README "Speculative decoding: a
// family of algorithms, not synonymous with one draft model"; distribution-preserving verification
// is rejection sampling, not equality testing (Leviathan et al. 2023; Chen et al. 2023).
import { THREE, lam, ghost, M, Q, P, S, ease, emitter } from './_kit.js';

const N = 8;                                    // candidate future token positions on the shared axis
const PITCH = 0.66, TILE = 0.44, TDEP = 0.24;
const X0 = -1.78;
const xOf = i => X0 + i * PITCH;
const Y_TIL = 0.34;                             // draft slot row (proposed future tokens)
const Y_BAND = 1.78;                            // drafter machinery band (heads / block slab)
const Y_RAIL = Y_TIL - TILE / 2 - 0.16;         // the token-position axis itself
const Y_SLAB = -1.62;                           // shared target verifier slab
const XP = X0 - PITCH;                          // verified prefix (last committed token)
const XC = XP - 0.58;                           // target model column
const AXIS_SPAN = (xOf(N - 1) - xOf(0)) + TILE + 0.55;
const AXIS_C = (xOf(0) + xOf(N - 1)) / 2;
const SLAB_L = AXIS_C - AXIS_SPAN / 2;
const CELLS = 40, CELL_W = AXIS_SPAN / CELLS;
const RUN_Y = Y_RAIL - 0.22, RUN_X0 = X0 - TILE / 2 - 0.07;
const CONF_Y = Y_TIL + TILE / 2 + 0.06;         // confidence bars (dspark) start here
const XT = XC + 0.9;                            // eagle-3 tower x — deliberately detached
const DUR = { draft: 3.1, verify: 2.5, hold: 1.9 };
const FAMS = ['mtp', 'eagle', 'dflash', 'dspark', 'dflash2'];
const NAME = { mtp: 'mtp', eagle: 'eagle-3', dflash: 'dflash', dspark: 'dspark', dflash2: 'dflash2' };
const LABEL = { mtp: 'mtp heads', eagle: 'eagle-3 tower', dflash: 'dflash block', dspark: 'dspark block', dflash2: 'dflash2 block' };
const COST = {
  mtp: k => `${k} chained head steps`,
  eagle: k => `${k} draft tower steps`,
  dflash: () => '1 draft pass',
  dspark: () => '1 draft pass + markov',
  dflash2: () => '1 draft pass + selector',
};
const acceptOf = k => (k === 8 ? 5 : 3);         // illustrative accepted prefix, same for all
const confOf = (i, k) => {                       // illustrative confidence scores (dspark)
  const a = acceptOf(k);
  return i < a ? 0.62 + 0.33 * (1 - i / a) : Math.max(0.12, 0.3 - (i - a) * 0.09);
};
const BR = 2;                                    // slot that gets the optional tree branch (eagle-3)

const c01 = t => (t < 0 ? 0 : t > 1 ? 1 : t);
const ss = t => { const x = c01(t); return x * x * (3 - 2 * x); };

export default function build(scene, emit) {
  const out = emitter(emit);
  const inst = (n, c) => {
    const m = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), lam(c), n);
    m.frustumCulled = false; scene.add(m); return m;
  };
  const box = (w, h, d, c, x, y, z) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), lam(c));
    m.position.set(x, y, z); scene.add(m); return m;
  };
  const cDraft = new THREE.Color(0x232323), cCommit = new THREE.Color(0x101010);
  const cReject = new THREE.Color(0xd9d9d9), cGrey = new THREE.Color(0xc2c2c2);
  const cIdle = new THREE.Color(0x9a9a9a), cDone = new THREE.Color(0x161616);
  const tmp = new THREE.Color();

  // ── shared stage: target model, token axis, verified prefix, verifier slab ──────
  box(0.4, 3.6, 0.44, 0x2b2b2b, XC, 0.06, 0);                         // the target model
  box(TILE * 0.8, TILE * 0.8, TDEP, 0x141414, XP, Y_TIL, 0);          // last committed token
  const rail = new THREE.Mesh(new THREE.BoxGeometry(AXIS_SPAN, 0.05, 0.5), ghost(0x8a8a8a, 0.18));
  rail.position.set(AXIS_C, Y_RAIL, 0);
  const railEdge = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(AXIS_SPAN, 0.09, 0.5)),
    new THREE.LineBasicMaterial({ color: 0x9f9f9f }));
  railEdge.position.copy(rail.position);
  const slabBase = new THREE.Mesh(new THREE.BoxGeometry(AXIS_SPAN, 0.44, 0.9), ghost(0x3a3a3a, 0.1));
  slabBase.position.set(AXIS_C, Y_SLAB, 0);
  const slabEdge = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(AXIS_SPAN, 0.5, 0.94)),
    new THREE.LineBasicMaterial({ color: 0x2a2a2a }));
  slabEdge.position.copy(slabBase.position);
  const cells = inst(CELLS, 0xffffff);                  // light = not verified yet, dark = passed
  const sweep = box(0.07, 1.0, 1.1, 0x101010, SLAB_L, Y_SLAB + 0.5, 0);  // the pass frontier
  scene.add(rail, railEdge, slabBase, slabEdge);

  // ── slot wells (the masked positions), draft tiles, committed ticks, run bar ────
  const wells = [];
  for (let i = 0; i < N; i++) {
    const w = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(TILE * 1.18, TILE * 1.18, TDEP * 1.25)),
      new THREE.LineBasicMaterial({ color: 0xcdcdcd }));
    w.position.set(xOf(i), Y_TIL, 0); scene.add(w); wells.push(w);
  }
  const tiles = inst(N, 0xffffff);
  const ticks = inst(N, 0x141414);
  const runBar = box(1, 0.11, 0.24, 0x131313, RUN_X0, RUN_Y, 0);
  runBar.scale.set(0.001, 1, 1);

  // ── MTP machinery ──────────────────────────────────────────────────────────────
  const bus = box(1, 0.12, 0.18, 0x333333, 0, Y_BAND, 0);              // out of the target model
  const heads = inst(N, 0x1b1b1b);                                     // one head per future slot
  const chain = inst(N, 0x111111);                                     // head i-1 → head i
  const drops = inst(N, 0x3d3d3d);                                     // head i → slot i

  // ── EAGLE-3 machinery: a separate small tower ─────────────────────────────────
  const tower = box(0.4, 1.0, 0.44, 0x242424, XT, 1.55, 0);
  const cap = box(0.32, 0.14, 0.36, 0x101010, XT, 2.12, 0);            // pulses once per draft step
  const eagleFeed = box(1, 0.1, 0.15, 0x333333, 0, 2.02, 0);           // target features in
  const stepLink = box(1, 0.09, 0.11, 0x1c1c1c, 0, 0, 0);              // tower → slot being drafted
  const branch = box(TILE * 0.78, TILE * 0.78, TDEP * 0.9, 0x5c5c5c, 0, 0, 0);
  const branchLink = box(0.4, 0.08, 0.08, 0x666666, 0, 0, 0);

  // ── DFlash / DSpark machinery: one broad block slab ───────────────────────────
  const slab = box(1, 0.22, 0.72, 0x3d3d3d, 0, Y_BAND, 0);
  const slabFeed = box(1, 0.12, 0.2, 0x3d3d3d, 0, Y_BAND, 0);         // target features in
  const slabDrops = inst(N, 0x707070);
  const markov = inst(N, 0x101010);                                    // slot i-1 → slot i (dspark)
  const conf = inst(N, 0xffffff);                                      // confidence bar per slot
  // Illustrative causal window and candidate path, not literal tensor geometry.
  const kernel = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(PITCH * 3, 0.7, 0.7)),
    new THREE.LineBasicMaterial({ color: 0x171717 }));
  scene.add(kernel);
  const convLinks = inst(N * 2, 0x222222);
  const candidates = inst(N * 3, 0xffffff);

  // ── labels (short; the rest of the labelling is in the readout). The caption card
  //    covers the lower-left of the slide, so labels stay high or to the right.
  const mkLabel = (text, x, y, h = 0.22, fontSize = 54) => {
    const cv = document.createElement('canvas'), g = cv.getContext('2d');
    const font = `bold ${fontSize}px ui-monospace, "DejaVu Sans Mono", monospace`;
    g.font = font;
    const w = Math.max(24, Math.ceil(g.measureText(text).width)) + 14;
    cv.width = w; cv.height = 72;
    g.font = font; g.fillStyle = '#151515'; g.textBaseline = 'middle'; g.fillText(text, 7, 40);
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, depthTest: false }));
    sp.scale.set(h * (w / 72), h, 1);
    sp.position.set(x, y, 0.6); scene.add(sp);
    return sp;
  };
  /** grow/shrink a thin bar from A toward B (A → B = what feeds what) */
  const bar = (m, ax, ay, az, bx, by, bz, thick, amt) => {
    const dx = bx - ax, dy = by - ay, dz = bz - az, L = Math.hypot(dx, dy, dz);
    m.position.set(ax + dx * amt / 2, ay + dy * amt / 2, az + dz * amt / 2);
    m.rotation.set(0, dz !== 0 ? -Math.atan2(dz, Math.hypot(dx, dy)) : 0, Math.atan2(dy, dx));
    m.scale.set(Math.max(L * amt, 0.001), thick, thick);
    m.visible = amt > 0.02;
  };
  mkLabel('target', XC + 0.04, 2.18, 0.23);
  mkLabel('shared verifier', xOf(0) + 0.3, Y_SLAB + 0.7, 0.22);
  mkLabel('token positions', 2.25, Y_SLAB - 0.6, 0.22);
  mkLabel('prompt', XP + 0.16, Y_TIL + 0.56, 0.22);
  const runLabel = mkLabel('accepted', 2.0, RUN_Y, 0.22);
  const branchLabel = mkLabel('tree branch', xOf(BR) + 0.4, Y_TIL + 0.68, 0.21);
  const confLabel = mkLabel('confidence', xOf(5) + 0.15, 1.44, 0.21);
  const passLabel = mkLabel('one draft pass', AXIS_C + 0.55, Y_BAND - 0.62, 0.22);
  const convLabel = mkLabel('local conv', AXIS_C - 0.5, 1.25, 0.35, 64);
  const selectorLabel = mkLabel('selector', AXIS_C + 1.0, 1.25, 0.35, 64);
  const experimentalLabel = mkLabel('experimental', AXIS_C + 2.0, 2.2, 0.35, 64);
  const famLabels = FAMS.map(f => mkLabel(LABEL[f], AXIS_C + 0.15, 2.62, 0.27));

  // ── state ──────────────────────────────────────────────────────────────────────
  let fam = 'mtp', K = 8, playing = true, phase = 0, t = 0, stepReq = false;
  const vis = { mtp: 0, eagle: 0, dflash: 0, dspark: 0, dflash2: 0 };
  const cur = {
    tile: new Float32Array(N).fill(0.001), tick: new Float32Array(N).fill(0.001),
    cell: new Float32Array(CELLS), well: new Float32Array(N).fill(0xcd),
    head: new Float32Array(N).fill(0.001), chain: new Float32Array(N).fill(0.001),
    drop: new Float32Array(N).fill(0.001), sdrop: new Float32Array(N).fill(0.001),
    mkv: new Float32Array(N).fill(0.001), cf: new Float32Array(N).fill(0.001),
    run: 0.001, sweep: 0.001, branch: 0.001,
  };
  const tileCol = Array.from({ length: N }, () => new THREE.Color(0x232323));

  return {
    view: { target: [-0.1, 0.18, 0], radius: 40, theta: 0.46, phi: 1.16, size: 2.8 },
    update(dt) {
      const now = ['draft', 'verify', 'hold'][phase];
      // step = land the next beat at once (everything is eased toward these targets, so it still
      // animates); play = sweep the three beats and loop every ~7.5 s.
      if (stepReq) {
        stepReq = false; playing = false; phase = (phase + 1) % 3;
        t = DUR[['draft', 'verify', 'hold'][phase]];
      }
      if (playing) { t += dt; if (t >= DUR[now]) { t = 0; phase = (phase + 1) % 3; } }
      const p = phase === 0 ? Math.min(1, t / DUR.draft) : 1;                        // drafting
      const v = phase === 0 ? 0 : phase === 1 ? Math.min(1, t / DUR.verify) : 1;    // the ONE target pass
      const k = ease(dt, 8);
      const a = acceptOf(K), seq = fam === 'mtp' || fam === 'eagle';
      const block = fam === 'dflash' || fam === 'dspark' || fam === 'dflash2';
      for (const f of FAMS) vis[f] += ((fam === f ? 1 : 0.001) - vis[f]) * ease(dt, fam === f ? 8 : 13);
      const vMtp = vis.mtp, vEa = vis.eagle, vBl = block ? Math.max(vis.dflash, vis.dspark, vis.dflash2) : 0.001;

      // draft front: K discrete steps (mtp / eagle-3) vs one continuous slab sweep (block)
      const step = p * K;
      const blockP = fam === 'dflash2' ? Math.min(1, p / 0.42) : p;
      const cov = X0 - TILE + blockP * (K * PITCH + TILE);
      const pres = i => (seq ? ss((step - i - 0.35) / 0.62) : ss((cov - xOf(i) + TILE * 0.9) / (TILE * 1.1)));
      const xV = SLAB_L + v * AXIS_SPAN;

      // ── slots: drafted tiles, wells, committed ticks, accepted run ──────────────
      for (let i = 0; i < N; i++) {
        cur.tile[i] += ((i < K ? Math.max(pres(i), 0.001) : 0.001) - cur.tile[i]) * k;
        const s = cur.tile[i];
        P.set(xOf(i), Y_TIL, 0); S.set(TILE * s, TILE * s, TDEP * s);
        tiles.setMatrixAt(i, M.compose(P, Q, S));

        // the target pass mixes each drafted tile into committed (dark) or unused (light)
        const vv = ss((xV - xOf(i)) / (PITCH * 0.8));
        tmp.copy(fam === 'dspark' && i >= a ? cGrey : cDraft);
        if (vv > 0) tmp.lerp(i < a ? cCommit : (fam === 'dspark' && i >= a ? cGrey : cReject), vv);
        tileCol[i].lerp(tmp, k);
        tiles.setColorAt(i, tileCol[i]);

        cur.well[i] += ((i < K ? 0x8a : 0xcd) - cur.well[i]) * k;
        wells[i].material.color.setScalar(cur.well[i] / 255);

        cur.tick[i] += ((i < a ? ss(vv * 1.4) : 0.001) - cur.tick[i]) * k;
        const ts = Math.max(cur.tick[i], 0.001);
        P.set(xOf(i), RUN_Y + 0.14, 0); S.set(TILE * 0.66 * ts, 0.09 * ts, 0.18 * ts);
        ticks.setMatrixAt(i, M.compose(P, Q, S));
      }
      const runFull = xOf(a - 1) + TILE / 2 + 0.07 - RUN_X0;
      cur.run += (Math.max(0.001, Math.min(Math.max(xV - RUN_X0, 0.001), runFull)) - cur.run) * k;
      runBar.scale.set(cur.run, 1, 1);
      runBar.position.x = RUN_X0 + cur.run / 2;
      runBar.visible = cur.run > 0.2;
      runLabel.visible = cur.run > 1.2;
      runLabel.position.x = RUN_X0 + cur.run + 0.72;

      // ── the shared verifier: one left→right pass, and it stays dark ────────────
      for (let j = 0; j < CELLS; j++) {
        const cx = SLAB_L + (j + 0.5) * CELL_W;
        cur.cell[j] += ((cx < xV ? 1 : 0.001) - cur.cell[j]) * k;
        const cs = Math.max(cur.cell[j], 0.001);
        P.set(cx, Y_SLAB, 0); S.set(CELL_W * 0.94 * cs, 0.36 * cs, 0.8 * cs);
        cells.setMatrixAt(j, M.compose(P, Q, S));
        cells.setColorAt(j, tmp.copy(cIdle).lerp(cDone, cur.cell[j]));
      }
      cells.instanceMatrix.needsUpdate = true;
      if (cells.instanceColor) cells.instanceColor.needsUpdate = true;
      cur.sweep += ((v > 0 && v < 1 ? 1 : 0.001) - cur.sweep) * ease(dt, 11);
      sweep.scale.set(1, cur.sweep, cur.sweep);
      sweep.position.x = xV;

      // ── MTP: bus out of the target model, one head per slot, chained, K steps ───
      const busW = (xOf(K - 1) - (XC + 0.2)) * vMtp;
      bus.scale.set(Math.max(busW, 0.001), 1, 1);
      bus.position.x = XC + 0.2 + Math.max(busW, 0.001) / 2;
      bus.visible = vMtp > 0.02;
      const stepNow = Math.min(K - 1, Math.floor(step));
      for (let i = 0; i < N; i++) {
        const on = i < K ? pres(i) * vMtp : 0.001;
        cur.head[i] += (on - cur.head[i]) * k;
        const hs = Math.max(cur.head[i], 0.001) * (i === stepNow && phase === 0 && playing ? 1.3 : 1);
        P.set(xOf(i), Y_BAND, 0); S.set(0.28 * hs, 0.28 * hs, 0.26 * hs);
        heads.setMatrixAt(i, M.compose(P, Q, S));
        cur.chain[i] += ((i > 0 && i < K ? ss((step - i + 0.2) / 0.5) * vMtp : 0.001) - cur.chain[i]) * k;
        const cn = Math.max(cur.chain[i], 0.001);
        P.set(xOf(i) - PITCH / 2, Y_BAND + 0.19, 0); S.set((PITCH - 0.3) * cn, 0.07 * cn, 0.09 * cn);
        chain.setMatrixAt(i, M.compose(P, Q, S));
        cur.drop[i] += (on - cur.drop[i]) * k;
        const ds = Math.max(cur.drop[i], 0.001);
        P.set(xOf(i), (Y_TIL + TILE / 2 + Y_BAND - 0.14) / 2, -0.03);
        S.set(0.05 * ds, (Y_BAND - 0.14 - Y_TIL - TILE / 2) * ds, 0.05 * ds);        drops.setMatrixAt(i, M.compose(P, Q, S));
      }
      for (const m of [heads, chain, drops]) m.instanceMatrix.needsUpdate = true;

      // ── EAGLE-3: separate tower, one slot per step, optional branch in z ────────
      tower.scale.set(vEa, 1, vEa);
      cap.scale.set(vEa, vEa * (phase === 0 && playing ? 1 + 0.5 * Math.max(0, 1 - (step % 1) * 2.6) : 1), vEa);
      const active = Math.min(K - 1, Math.floor(step));
      bar(eagleFeed, XC + 0.2, 2.02, 0, XT, 2.02, 0, 0.12, vEa);
      bar(stepLink, XT, 1.05, 0, xOf(active), Y_TIL + TILE / 2, 0, 0.1,
        vEa * (phase === 0 ? Math.min(1, step) : 0.001));
      cur.branch += ((( p > (BR + 1.5) / K ? 1 : 0.001)) * vEa - cur.branch) * k;
      branch.position.set(xOf(BR) + 0.26, Y_TIL - 0.12, 0.56);
      branch.scale.setScalar(Math.max(cur.branch, 0.001));
      branch.visible = cur.branch > 0.03;
      bar(branchLink, xOf(BR) + 0.05, Y_TIL - 0.04, 0.14, xOf(BR) + 0.26, Y_TIL - 0.12, 0.5, 0.08, cur.branch * vEa);
      branchLabel.visible = cur.branch > 0.6;

      // ── DFlash / DSpark: one broad slab fills the K masked slots in one pass ─────
      const sw = (K * PITCH - 0.05) * blockP * vBl;
      const sx = X0 - TILE / 2 + 0.03;
      slab.scale.set(Math.max(sw, 0.001), vBl, vBl);
      slab.position.x = sx + Math.max(sw, 0.001) / 2;
      slab.visible = sw > 0.03;
      bar(slabFeed, XC + 0.2, Y_BAND, 0, sx, Y_BAND, 0, 0.15, vBl);
      passLabel.visible = fam === 'dflash' && p > 0.15;
      for (let i = 0; i < N; i++) {
        const on = i < K ? pres(i) * vBl : 0.001;
        cur.sdrop[i] += (on - cur.sdrop[i]) * k;
        const sd = Math.max(cur.sdrop[i], 0.001);
        P.set(xOf(i), (Y_TIL + TILE / 2 + Y_BAND - 0.11) / 2, -0.2);
        S.set(0.05 * sd, (Y_BAND - 0.11 - Y_TIL - TILE / 2) * sd, 0.05 * sd);
        slabDrops.setMatrixAt(i, M.compose(P, Q, S));
        cur.mkv[i] += ((fam === 'dspark' && i > 0 && i < K ? pres(i) * vis.dspark : 0.001) - cur.mkv[i]) * k;
        const mv = Math.max(cur.mkv[i], 0.001);
        P.set(xOf(i) - PITCH / 2, Y_TIL, 0.3); S.set((PITCH - TILE - 0.02) * mv, 0.08 * mv, 0.09 * mv);
        markov.setMatrixAt(i, M.compose(P, Q, S));
        cur.cf[i] += ((fam === 'dspark' && i < K ? pres(i) * vis.dspark * confOf(i, K) : 0.001) - cur.cf[i]) * k;
        const cf = Math.max(cur.cf[i], 0.001);
        P.set(xOf(i), CONF_Y + 0.3 * cf, 0.34); S.set(0.13 * cf, 0.6 * cf, 0.12 * cf);
        conf.setMatrixAt(i, M.compose(P, Q, S));
        conf.setColorAt(i, tmp.copy(fam === 'dspark' && i >= a ? cGrey : cDraft));
      }
      for (const m of [slabDrops, markov, conf]) m.instanceMatrix.needsUpdate = true;
      if (conf.instanceColor) conf.instanceColor.needsUpdate = true;
      markov.visible = vis.dspark > 0.03;
      conf.visible = vis.dspark > 0.03;
      confLabel.visible = vis.dspark > 0.5;
      confLabel.position.x = xOf(K - 1) - 0.75;

      // A moving three-position window summarizes causal local mixing; the real
      // convolutions occur within layers, not as a separate post-draft pass.
      const isF2 = fam === 'dflash2' && vis.dflash2 > 0.03;
      const cp = c01((p - 0.42) / 0.28);
      const selecting = c01((p - 0.70) / 0.30) * K;
      const windowIndex = Math.min(K - 1, Math.floor(cp * K));
      kernel.visible = isF2 && p >= 0.42 && p < 0.70;
      kernel.position.set(xOf(windowIndex) - PITCH, Y_TIL, 0);
      convLabel.visible = kernel.visible;
      selectorLabel.visible = isF2 && p >= 0.70;
      experimentalLabel.visible = isF2;
      for (let i = 0; i < N; i++) {
        for (let j = 1; j <= 2; j++) {
          const on = kernel.visible && i === windowIndex && i >= j;
          P.set(xOf(i) - j * PITCH / 2, Y_TIL, 0.38);
          S.set(on ? j * PITCH : 0.001, 0.045, 0.045);
          convLinks.setMatrixAt(i * 2 + j - 1, M.compose(P, Q, S));
        }
        const chosen = ss((selecting - i) * 2);
        for (let j = 0; j < 3; j++) {
          const visible = isF2 && i < K && p >= 0.42;
          const scale = visible ? (j === 0 ? 1 : 1 - chosen) : 0.001;
          P.set(xOf(i), Y_TIL + 0.7 * (1 - (j === 0 ? chosen : 0)), -0.35 + j * 0.3);
          S.set(TILE * 0.8 * Math.max(scale, 0.001), 0.09 * Math.max(scale, 0.001), 0.2 * Math.max(scale, 0.001));
          candidates.setMatrixAt(i * 3 + j, M.compose(P, Q, S));
          candidates.setColorAt(i * 3 + j, tmp.setHex(j === 0 ? 0x101010 : 0x999999));
        }
      }
      convLinks.instanceMatrix.needsUpdate = true;
      candidates.instanceMatrix.needsUpdate = true;
      if (candidates.instanceColor) candidates.instanceColor.needsUpdate = true;

      tiles.instanceMatrix.needsUpdate = true;
      if (tiles.instanceColor) tiles.instanceColor.needsUpdate = true;
      ticks.instanceMatrix.needsUpdate = true;
      famLabels.forEach((sp, i) => { sp.visible = FAMS[i] === fam && vis[fam] > 0.5; });

      out({
        playing, drafter: fam, k: K, phase: now, accept: a,
        readout: `${NAME[fam]} · ${COST[fam](K)} for ${K} slots · target passes 1 (illustrative)`,
      });
    },
    action(name, arg) {
      if (name === 'play') playing = !playing;
      else if (name === 'step') stepReq = true;
      else if (name === 'drafter') { if (FAMS.includes(String(arg))) { fam = String(arg); phase = 0; t = 0; } }
      else if (name === 'k') { K = Number(arg) === 4 ? 4 : 8; phase = 0; t = 0; }
      else if (name === 'reset') { phase = 0; t = 0; }
    },
  };
}
