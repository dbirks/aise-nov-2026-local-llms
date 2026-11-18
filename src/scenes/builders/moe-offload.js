// Scene `moe-offload` — Route B04: "Experts parked in system RAM".
//
// WHAT THIS SHOWS (docs/presentation-production-handoff.md §3 B04, claim: putting MoE expert
// weights in host memory buys capacity, and where the selected expert lives decides what travels).
// Left box  = system RAM: all 8 expert weight slabs of one MoE layer stay resident there. That is
//             llama.cpp `-cmoe/--cpu-moe` (all MoE weights), `-ncmoe/--n-cpu-moe N` (first N layers)
//             or `-ot/--override-tensor` (per tensor pattern).
// Right box = the GPU: attention, the router and the shared expert stay device-resident, plus
//             `--moe-cache-mib` hot-expert slots (drawn here as 0 / 2 / 4 slots).
// Tube      = the link between the two tiers ("PCIe / TB link"). Only bytes that cross it are drawn
//             as moving objects: a small activation cube (hidden state out, result back) or a whole
//             expert slab (weights uploaded).
//
// TWO PLACEMENT MODES = the two ends of `--moe-cache-cpu-share` (0 … 1), per docs/moe-cache.md:
//   'cpu'  (share → 1) — a miss is computed on the CPU from the host expert: the ACTIVATION crosses
//            the link and back, the expert slab never moves.
//   'copy' (share → 0) — a miss uploads the expert weights into a device slot (evicting the
//            least-recently-used copy): the WEIGHTS cross the link, then the token computes on the GPU.
//   In BOTH modes: while the cache is not full every miss is uploaded ("Until the cache is full every
//   miss is uploaded, so the cache fills as fast as without the CPU share"), and a HIT runs on the
//   device with nothing crossing. With 0 slots the cache is disabled, so 'cpu' never copies anything
//   up and 'copy' re-uploads every selected expert it uses (docs: "Large batches still upload the
//   experts they use"). The host copy is the source of truth: a GPU slot is a COPY, so the CPU slab
//   never disappears — it just carries a dark dot while a device copy of it exists.
//
// DO NOT READ INTO THIS: no tokens/s, no GiB, no bandwidth, no latency and no speed ratio (the link
// tube is drawn narrow, it is not a bandwidth chart; the CPU slab lighting dark means "this expert's
// math happens there", not "as fast as the GPU"). It is not PLE's n-gram row lookups (see the
// dense-moe-ngram scene) and offloaded experts are NOT unused weights — they are read when routed to.
// The routing below is a fixed synthetic toy (6 tokens × 2 of 8 experts, clustered so a hot cache
// demonstrably produces hits); 8 experts, one layer and 4 slots are illustrative counts.
// Sources: https://github.com/ggml-org/llama.cpp/blob/master/docs/moe-cache.md ·
//          https://github.com/ggml-org/llama.cpp/blob/master/tools/server/README.md (-cmoe/-ncmoe/-ot/--moe-cache-mib).
import { THREE, lam, ghost, M, Q, P, S, emitter } from './_kit.js';

// ── toy model ──────────────────────────────────────────────────────────────────────
const NX = 8;                      // experts of this (single, illustrative) MoE layer
const TOKS = 6, TOKT = 2.05;       // 6 tokens × 2.05 s ≈ 12.3 s loop
const PICK0 = 0.10, PICK_D = 0.22; // the two expert picks of a token, as a fraction of its beat
const NEEDLE = 0.12, MOVE = 0.42;  // route-needle growth / transfer duration (beat fractions)
// fixed routing, seeded by hand: 2 of 8 experts per token. ids 2/5 form a hot pair that recurs (so a
// hot cache demonstrably removes trips) and 0/3/6 are colder traffic; 1/4/7 are never routed to in
// this pass yet stay stored in RAM — offloaded is not unused.
const ROUTE = [[2, 5], [2, 5], [6, 2], [3, 5], [2, 5], [0, 5]];
const SLOT_N = 4;                  // max hot slots drawn (control offers 0 / 2 / 4)

// ── system-RAM box (left) ──────────────────────────────────────────────────────────
const CPU_X0 = -3.4, CPU_X1 = -2.15, CPU_CX = (CPU_X0 + CPU_X1) / 2;
const CPU_Y0 = -1.55, CPU_Y1 = 1.5;
const SLAB_W = 0.84, SLAB_H = 0.26, SLAB_P = 0.36, SLAB_Y0 = 1.28, SLAB_CX = -2.68;
const yExp = e => SLAB_Y0 - e * SLAB_P;                    // expert e's parked slab
const CHIP_X = CPU_X0 + 0.25;                              // id chip at the left edge of each slab
const EXP_X = CPU_X1 - 0.12;                               // transfers attach to the cpu side here

// ── GPU box (right) ────────────────────────────────────────────────────────────────
const G_X0 = -0.95, G_X1 = 2.15, G_CX = (G_X0 + G_X1) / 2;
const G_Y0 = -1.55, G_Y1 = 1.5;
const PL_W = 2.2, PL_H = 0.28, PL_CX = 0.75;               // resident plates (left column: the token)
const ATT_Y = 1.28, RT_Y = 0.86, SH_Y = 0.44;              // always-resident plates
const HOT_Y0 = 0.12, HOT_P = 0.4, HOT_H = 0.3, HOT_CX = PL_CX;
const yHot = j => HOT_Y0 - j * HOT_P;                     // hot slot j
const HOT_LAB_Y = -1.35;                                  // "hot expert cache" label
const TOK_X = -0.66;                                       // the token cube, left of the plates
const TMP_X = HOT_CX, TMP_Y = yHot(1);                     // where an unretained upload flashes

// ── the link ───────────────────────────────────────────────────────────────────────
const TUBE_X0 = CPU_X1, TUBE_X1 = G_X0, TUBE_CX = (TUBE_X0 + TUBE_X1) / 2, TUBE_H = 0.5;
const A_IN = G_X0 + 0.08, A_OUT = CPU_X1 - 0.08;    // attach points just inside the tube mouth

const u01 = (v, a, b) => Math.max(0, Math.min(1, (v - a) / (b - a)));

// label textures: dark text on transparent (the background renders as the LIGHTEST tone), or light
// text for things drawn on a dark plate.
function labelTex(text, fpx = 68, fill = '#141414') {
  const lines = String(text).split('\n');
  const font = `bold ${fpx}px ui-monospace, monospace`;
  const cv = document.createElement('canvas'), g0 = cv.getContext('2d');
  g0.font = font;
  cv.width = Math.max(...lines.map(l => Math.ceil(g0.measureText(l).width)), 20) + 24;
  const lineH = Math.round(fpx * 1.12);
  cv.height = lineH * lines.length + 18;
  const g = cv.getContext('2d');
  g.font = font; g.fillStyle = fill; g.textAlign = 'center'; g.textBaseline = 'middle';
  lines.forEach((l, i) => g.fillText(l, cv.width / 2, 9 + lineH * (i + 0.5)));
  return { cv, lines: lines.length };
}

export default function build(scene, emit) {
  const out = emitter(emit);
  const tmp = new THREE.Color();
  const EUL = new THREE.Euler(), EQ = new THREE.Quaternion();
  const cIdle = new THREE.Color(0xa8a8a8);    // parked weights / idle plate (light = not this token)
  const cComp = new THREE.Color(0x131313);    // doing this token's math (dark = important)
  const cRes = new THREE.Color(0x545454);     // a device copy of a host expert, idle

  const label = (text, h, fill) => {
    const { cv, lines } = labelTex(text, 68, fill);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({
      map: new THREE.CanvasTexture(cv), transparent: true, depthWrite: false, depthTest: false }));
    sp.userData = { ar: cv.width / cv.height, lines, text, h };
    sp.renderOrder = 20; sp.scale.set(0.001, 0.001, 1);
    scene.add(sp);
    return sp;
  };
  const setLab = (sp, x, y, z = 0.4, vis = 1) => {
    const s = Math.max(vis, 0.001), h = sp.userData.h * sp.userData.lines * s;
    sp.scale.set(h * sp.userData.ar, h, 1);
    sp.position.set(x, y, z);
    sp.visible = vis > 0.02;
  };
  const retex = (sp, text) => {
    if (sp.userData.text === text) return;
    const { cv, lines } = labelTex(text, 68, sp.userData.dark ? '#EDEDEd' : '#141414');
    sp.material.map.dispose();
    sp.material.map = new THREE.CanvasTexture(cv);
    sp.material.needsUpdate = true;
    sp.userData.ar = cv.width / cv.height; sp.userData.lines = lines; sp.userData.text = text;
  };
  const edge = (w, h, d, c = 0x2b2b2b) => new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(w, h, d)), new THREE.LineBasicMaterial({ color: c }));

  // ── system RAM: box + 8 expert slabs + device-copy dots ──────────────────────────
  const cpuPlate = new THREE.Mesh(new THREE.BoxGeometry(CPU_X1 - CPU_X0, CPU_Y1 - CPU_Y0, 0.06), ghost(0xdedede, 0.55));
  cpuPlate.position.set(CPU_CX, (CPU_Y0 + CPU_Y1) / 2, -0.34);
  const cpuEdge = edge(CPU_X1 - CPU_X0, CPU_Y1 - CPU_Y0, 0.9);
  cpuEdge.position.set(CPU_CX, (CPU_Y0 + CPU_Y1) / 2, 0.06);
  const slabMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), lam(0xffffff), NX);
  const chipMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), lam(0xd9d9d9), NX);
  const dotMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), lam(0x141414), NX);
  slabMesh.frustumCulled = chipMesh.frustumCulled = dotMesh.frustumCulled = false;
  scene.add(cpuPlate, cpuEdge, slabMesh, chipMesh, dotMesh);

  // ── GPU: box, always-resident plates, hot-expert slots ────────────────────────────
  const gPlate = new THREE.Mesh(new THREE.BoxGeometry(G_X1 - G_X0, G_Y1 - G_Y0, 0.06), ghost(0xdedede, 0.55));
  gPlate.position.set(G_CX, (G_Y0 + G_Y1) / 2, -0.34);
  const gEdge = edge(G_X1 - G_X0, G_Y1 - G_Y0, 0.9);
  gEdge.position.set(G_CX, (G_Y0 + G_Y1) / 2, 0.06);
  const plateMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), lam(0xffffff), 3);
  plateMesh.frustumCulled = false;
  const tick = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), lam(0x141414), 3);   // "runs every layer"
  tick.frustumCulled = false;
  const slotEdge = [];
  for (let j = 0; j < SLOT_N; j++) {
    const e0 = edge(1.2, HOT_H + 0.06, 0.62, 0x1d1d1d);
    e0.position.set(HOT_CX, yHot(j), 0.16);
    scene.add(e0); slotEdge.push(e0);
  }
  const hotMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), lam(0xffffff), SLOT_N);
  hotMesh.frustumCulled = false;
  scene.add(gPlate, gEdge, plateMesh, tick, hotMesh);

  // ── the link tube ────────────────────────────────────────────────────────────────
  const tube = new THREE.Mesh(new THREE.BoxGeometry(TUBE_X1 - TUBE_X0 + 0.06, TUBE_H, 0.44), ghost(0x9a9a9a, 0.4));
  tube.position.set(TUBE_CX, 0, 0.02);
  const tubeEdge = edge(TUBE_X1 - TUBE_X0 + 0.06, TUBE_H, 0.46, 0x3a3a3a);
  tubeEdge.position.copy(tube.position);
  scene.add(tube, tubeEdge);

  // ── movers: token cube, route needles, activation cubes, expert copies (+ drops) ──
  const tokCube = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.24, 0.24), lam(0x161616));
  tokCube.position.set(TOK_X, RT_Y, 0.42);
  scene.add(tokCube);
  const needleMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), lam(0x1a1a1a), 2);
  const actMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), lam(0x151515), 2);      // activation
  const cpMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), lam(0x1f1f1f), 4);       // expert copies
  needleMesh.frustumCulled = actMesh.frustumCulled = cpMesh.frustumCulled = false;
  scene.add(needleMesh, actMesh, cpMesh);
  const hide = i => { P.set(0, -9, 0); cpMesh.setMatrixAt(i, M.compose(P, Q, S.setScalar(0.001))); };

  // ── labels (short, every named object) ───────────────────────────────────────────
  const labCpu = label('cpu ram\nexperts', 0.25);
  const labGpu = label('gpu · vram', 0.25);
  const labAttn = label('attention', 0.2);
  const labRouter = label('router', 0.2);
  const labShared = label('shared expert', 0.2);
  const labHot = label('hot expert cache', 0.21);
  const labLink = label('PCIe / TB link', 0.185);
  const labTok = label('token', 0.2);
  const labExp = Array.from({ length: NX }, (_, e) => label(`e${e}`, 0.19));
  const labSlot = Array.from({ length: SLOT_N }, () => { const s = label('', 0.19, '#EDEDEd'); s.userData.dark = 1; return s; });

  // ── simulated state ──────────────────────────────────────────────────────────────
  let mode = 'cpu', slots = 2, playing = true, tc = 0, passT = 0, token = -1;
  let cache = [];                 // [{e, use, born, drop:{e,born}}] index === hot slot
  let hits = 0, misses = 0, copies = 0, trips = 0, clock = 0;
  let lane = [null, null];        // this token's two picks: {e, jit:'hit'|'copy'|'act', slot}

  const resetPass = () => { hits = misses = copies = trips = 0; cache = []; lane = [null, null]; token = -1; passT = 0; tc = 0; };

  // one token = two expert picks; the cache update is the llama.cpp moe-cache policy described above
  const pick = (e, j) => {
    const at = cache.findIndex(c => c.e === e);
    if (at >= 0) { hits++; cache[at].use = ++clock; return { e, jit: 'hit', slot: at }; }
    misses++;
    const upload = mode === 'copy' || cache.length < slots;    // fills while not full in both modes
    if (!upload) { trips++; return { e, jit: 'act', slot: -1 }; }
    copies++;
    if (slots === 0) return { e, jit: 'copy', slot: -2 };       // disabled cache: uploaded, not retained
    let s;
    if (cache.length < slots) { s = cache.length; cache.push({ e, use: ++clock, born: tc }); }
    else {
      s = 0;
      for (let i = 1; i < cache.length; i++) if (cache[i].use < cache[s].use) s = i;
      cache[s] = { e, use: ++clock, born: tc, drop: { e: cache[s].e, born: tc } };   // LRU copy is dropped
    }
    return { e, jit: 'copy', slot: s };
  };
  const stepToken = k => { lane = [pick(ROUTE[k][0], 0), pick(ROUTE[k][1], 1)]; };

  // piecewise path through the tube: expert slab ↔ tube ↔ token, or tube ↔ hot slot
  const path = (pts, u, dst) => {
    let tot = 0;
    const len = [];
    for (let i = 0; i < pts.length - 1; i++) { const d = Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]); len.push(d); tot += d; }
    let q = u * tot;
    for (let i = 0; i < len.length; i++) {
      if (q > len[i] && i < len.length - 1) { q -= len[i]; continue; }
      const f = len[i] > 0 ? q / len[i] : 1;
      return dst.set(pts[i][0] + (pts[i + 1][0] - pts[i][0]) * f, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * f, 0.34);
    }
    return dst.set(pts[pts.length - 1][0], pts[pts.length - 1][1], 0.34);
  };
  const toCpu = (e, u, dst) => path([[TOK_X, RT_Y], [A_IN, 0.06], [A_OUT, 0], [EXP_X, yExp(e)]], u, dst);
  const toGpu = (e, slot, u, dst) => {
    const tx = slot === -2 ? TMP_X : HOT_CX, ty = slot === -2 ? TMP_Y : yHot(slot);
    return path([[EXP_X, yExp(e)], [A_OUT, 0], [A_IN, 0.06], [tx, ty]], u, dst);
  };
  const A = new THREE.Vector3(), B = new THREE.Vector3();

  return {
    view: { target: [-0.9, 0.2, 0], radius: 40, theta: 0.14, phi: 1.44, size: 2.5 },
    update(dt) {
      if (playing) {
        const d = Math.max(0, Math.min(0.05, dt));
        tc += d; passT += d;
        if (passT >= TOKS * TOKT) resetPass();                 // counters describe one clean pass
      }
      const k = Math.min(TOKS - 1, Math.floor(passT / TOKT)), f = passT / TOKT - k;
      if (k !== token) { token = k; stepToken(k); }
      const hold = 1 - Math.max(0, (f - 0.93) / 0.07);         // fade before the loop restarts

      // resident-copy dot on each host slab
      const resOf = e => cache.some(c => c.e === e);
      const compOf = e => {                                   // computing on the cpu right now
        for (let j = 0; j < 2; j++) {
          const L = lane[j]; if (!L || L.jit !== 'act' || L.e !== e) continue;
          const t0 = PICK0 + j * PICK_D, mv = u01(f, t0 + NEEDLE + 0.02, t0 + NEEDLE + MOVE);
          if (mv > 0.4) return Math.min(1, (1 - Math.max(0, (f - (t0 + 0.62)) / 0.16)) * hold);
        }
        return 0;
      };
      const hotComp = j => {                                  // computing in this device slot right now
        for (let i = 0; i < 2; i++) {
          const L = lane[i]; if (!L || L.slot !== j) continue;
          const t0 = PICK0 + i * PICK_D;
          const mv = L.jit === 'hit' ? u01(f, t0 + NEEDLE * 0.6, t0 + NEEDLE + 0.08)
            : u01(f, t0 + NEEDLE + 0.02, t0 + NEEDLE + MOVE);
          if (mv > 0.65) return Math.min(1, (1 - Math.max(0, (f - (t0 + 0.68)) / 0.16)) * hold);
        }
        return 0;
      };

      // host expert slabs: light = parked, dark = this token's math runs here
      for (let e = 0; e < NX; e++) {
        const a = compOf(e);
        P.set(SLAB_CX, yExp(e), 0.02 + a * 0.12);
        S.set(SLAB_W * (1 + 0.06 * a), SLAB_H * (0.9 + 0.16 * a), 0.5);
        slabMesh.setMatrixAt(e, M.compose(P, Q, S));
        slabMesh.setColorAt(e, tmp.copy(cIdle).lerp(cComp, a));
        P.set(CHIP_X, yExp(e), 0.1);
        chipMesh.setMatrixAt(e, M.compose(P, Q, S.set(0.34, 0.3, 0.14)));
        const d = resOf(e) ? 1 : 0;
        P.set(CPU_X1 - 0.19, yExp(e), 0.36);
        dotMesh.setMatrixAt(e, M.compose(P, Q, S.setScalar(Math.max(0.001, d * 0.17))));
        setLab(labExp[e], CHIP_X, yExp(e), 0.34);
      }
      slabMesh.instanceMatrix.needsUpdate = true; chipMesh.instanceMatrix.needsUpdate = true;
      dotMesh.instanceMatrix.needsUpdate = true;
      if (slabMesh.instanceColor) slabMesh.instanceColor.needsUpdate = true;

      // GPU-resident plates: they run every layer, shown by a travelling dark tick
      const sweep = (tc % 1.2) / 1.2;
      for (let i = 0; i < 3; i++) {
        const y = [ATT_Y, RT_Y, SH_Y][i];
        P.set(PL_CX, y, 0.06); S.set(PL_W, PL_H, 0.52);
        plateMesh.setMatrixAt(i, M.compose(P, Q, S));
        plateMesh.setColorAt(i, tmp.copy(cIdle));
        P.set(PL_CX - PL_W / 2 + 0.09 + sweep * (PL_W - 0.18), y, 0.36);
        tick.setMatrixAt(i, M.compose(P, Q, S.set(0.11, PL_H * 0.62, 0.2)));
      }
      plateMesh.instanceMatrix.needsUpdate = true; tick.instanceMatrix.needsUpdate = true;
      if (plateMesh.instanceColor) plateMesh.instanceColor.needsUpdate = true;

      // hot slots + device copies
      for (let j = 0; j < SLOT_N; j++) {
        const on = j < slots ? 1 : 0;
        slotEdge[j].scale.set(on || 0.001, on || 0.001, on || 0.001);
        slotEdge[j].visible = on > 0;
        const c = on && cache[j];
        const grow = c ? Math.min(1, (tc - c.born) / 0.45) : 0;
        const a = hotComp(j);
        P.set(HOT_CX, yHot(j), 0.18 + a * 0.1);
        S.set(1.12 * Math.max(grow, 0.001), (HOT_H * (0.92 + 0.14 * a)) * Math.max(grow, 0.001), 0.5);
        hotMesh.setMatrixAt(j, M.compose(P, Q, S));
        hotMesh.setColorAt(j, tmp.copy(cRes).lerp(cComp, a));
        retex(labSlot[j], c && grow > 0.6 ? `e${c.e}` : '');
        setLab(labSlot[j], HOT_CX - 0.42, yHot(j), 0.4, c && grow > 0.6 ? 1 : 0);
      }
      hotMesh.instanceMatrix.needsUpdate = true;
      if (hotMesh.instanceColor) hotMesh.instanceColor.needsUpdate = true;

      // per-lane motion: needle, activation round trip, expert upload (+ dropped copy)
      for (let i = 0; i < 4; i++) hide(i);
      for (let j = 0; j < 2; j++) {
        const L = lane[j];
        const t0 = PICK0 + j * PICK_D;
        if (!L) { needleMesh.setMatrixAt(j, M.compose(P.set(0, -9, 0), Q, S.setScalar(0.001))); actMesh.setMatrixAt(j, M.compose(P.set(0, -9, 0), Q, S.setScalar(0.001))); continue; }
        const needle = u01(f, t0, t0 + NEEDLE) * hold;
        const mv = (L.jit === 'hit' ? u01(f, t0 + NEEDLE * 0.6, t0 + NEEDLE + 0.08)
          : u01(f, t0 + NEEDLE + 0.02, t0 + NEEDLE + MOVE)) * hold;
        // route needle from this token to the expert wherever it now lives
        const dx0 = TOK_X + 0.14, dy0 = RT_Y;
        const tx = L.slot >= 0 ? HOT_CX : L.slot === -2 ? TMP_X : EXP_X;
        const ty = L.slot >= 0 ? yHot(L.slot) : yExp(L.e);
        const ddx = tx - dx0, ddy = ty - dy0, dl = Math.max(0.02, Math.hypot(ddx, ddy));
        const ln = Math.max(0.02, dl * needle);
        EUL.set(0, 0, Math.atan2(ddy, ddx)); EQ.setFromEuler(EUL);
        needleMesh.setMatrixAt(j, M.compose(P.set(dx0 + ddx / dl * ln / 2, dy0 + ddy / dl * ln / 2, 0.3), EQ, S.set(ln, 0.045, 0.07)));
        if (L.jit === 'act') {                                   // activation out and back (cpu computes)
          const tri = mv < 0.5 ? mv * 2 : (1 - mv) * 2;
          toCpu(L.e, tri, A);
          actMesh.setMatrixAt(j, M.compose(P.set(A.x, A.y, 0.34), Q, S.setScalar(0.16)));
        } else {
          actMesh.setMatrixAt(j, M.compose(P.set(0, -9, 0), Q, S.setScalar(0.001)));
        }
        if (L.jit === 'copy') {                                  // weights cross the link
          toGpu(L.e, L.slot, mv, A);
          const ephem = L.slot === -2 ? Math.max(0.001, Math.min(1, (1 - f) / 0.12)) : 1;
          cpMesh.setMatrixAt(j, M.compose(P.set(A.x, A.y, 0.34), Q, S.set(0.55 * ephem, 0.24 * ephem, 0.42)));
        }
        const c = L.slot >= 0 ? cache[L.slot] : null;            // the evicted device copy falls away
        if (c && c.drop) {
          const g01 = Math.max(0, Math.min(1, (tc - c.drop.born) / 0.5));
          path([[HOT_CX, yHot(L.slot)], [A_OUT, 0], [EXP_X, yExp(c.drop.e)]], g01, B);
          cpMesh.setMatrixAt(2 + j, M.compose(P.set(B.x, B.y, 0.3), Q, S.set(0.5 * (1 - g01), 0.22 * (1 - g01), 0.4)));
        }
      }
      needleMesh.instanceMatrix.needsUpdate = actMesh.instanceMatrix.needsUpdate = cpMesh.instanceMatrix.needsUpdate = true;
      tokCube.scale.setScalar(0.9 + 0.25 * Math.sin(Math.PI * Math.min(1, f / 0.9)) * hold);

      setLab(labCpu, CPU_CX, CPU_Y1 + 0.32, 0.4);
      setLab(labGpu, G_CX, G_Y1 + 0.32, 0.4);
      setLab(labAttn, PL_CX, ATT_Y, 0.36);
      setLab(labRouter, PL_CX, RT_Y, 0.36);
      setLab(labShared, PL_CX, SH_Y, 0.36);
      setLab(labHot, HOT_CX, HOT_LAB_Y, 0.4, slots > 0 ? 1 : 0);
      setLab(labLink, TUBE_CX, 0.66, 0.4);
      setLab(labTok, TOK_X, RT_Y + 0.32, 0.4);

      out({
        playing, mode, slots, hits, misses, copies, trips,
        readout: `${mode} · ${slots} slots · hits ${hits} · misses ${misses} · ${copies} expert copies `
          + `· ${trips} activation trips`,
      });
    },
    action(name, arg) {
      if (name === 'play') playing = !playing;
      else if (name === 'step') {
        playing = false;
        const k = Math.floor(passT / TOKT), mid = k * TOKT + TOKT * 0.88;   // land where the outcome shows
        passT = passT < mid ? mid : Math.min(TOKS * TOKT - 0.01, mid + TOKT);
        tc = passT;
      } else if (name === 'place') {
        mode = String(arg) === 'copy' ? 'copy' : 'cpu';
        resetPass();
      } else if (name === 'cache') {
        const n = Number(arg);
        slots = [0, 2, 4].includes(n) ? n : 2;
        resetPass();
      }
    },
  };
}
