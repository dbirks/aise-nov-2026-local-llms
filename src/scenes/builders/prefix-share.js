// Scene `prefix-share` — three agent harnesses, one identical prompt prefix (README "Scene R").
//
// x = token position (left third = the illustrative 50k-token identical prefix, right third = each
// agent's own project history), z = agent lane, y = where the engine keeps the KV state.
// The three light rails are the three *prompts*: they stay identical in every mode, only the dark
// storage structure underneath them changes.
//   vLLM          → one row of fixed-size KV blocks under the prefix, thin cables from all three
//                   lanes onto the same blocks, refcount = a stack of lane-coloured tick pips
//                   floating on the front face of every shared block.
//   SGLang        → a compressed radix tree: one thick trunk for the shared span, one thinner
//                   branch per agent after the first differing token, node plate at the fork.
//   llama.cpp     → three independent slots, each with its OWN dark copy of the prefix row.
// The "diverge at token 500" toggle moves the fork/sharing boundary left: the trunk shrinks, the
// shared block row shrinks to a stub (vLLM's containing block stays a light outline = partial, so
// not reusable as a full block) and the rest of the prefix becomes three private copies again.
//
// Drawn quantities are illustrative geometry, NOT measurements: 50k prefix length (not a verified
// prompt size), 8 drawn cells per region (real blocks are far more numerous), the divergence
// marker is exaggerated (~24% of the span instead of 500/50k = 1%). This is a cache/index data
// structure, not an attention change and not a speculative-decoding candidate tree.
// Sources: repo README "Scene R"; vLLM prefix-caching design (hash blocks, refcount, free queue);
// LMSYS RadixAttention; llama.cpp server README (slots, --cache-prompt) + cross-slot discussion 30664.
import { THREE, lam, ghost, M, Q, P, S, ease, emitter } from './_kit.js';

const LANE = [-1.15, 0, 1.15];          // three agents (z)
const NL = 3;
const PX0 = -3.3, PX1 = -0.15;          // drawn span of the identical prefix
const SX0 = 0.0, SX1 = 3.4;             // drawn span of each agent's own tokens
const DIVX = -2.55;                     // drawn divergence point (exaggerated, see notes)
const NC = 8;                           // drawn cells per region
const CW = (PX1 - PX0) / NC, CWS = (SX1 - SX0) / NC;
const BW = 0.3;                         // every block is the same size (vLLM blocks are fixed-size)
const ROW_Y = 0.42, BH = 0.44, BD = 0.42, SHH = 0.5;
const RAIL_Y = ROW_Y - BH / 2 - 0.06;
const SH_Y = -1.05;                     // shared-structure height (vLLM block row / pool shelf)
const ARR = [0.4, 2.2, 4.0];            // when each agent's request shows up
const LOOP = 7.8, PXV = 2.3;            // loop length, prefill front speed (world units / s)
const TONE = [0x151515, 0x4a4a4a, 0x7c7c7c];   // lane identity in monochrome (A darkest)

const cells = Array.from({ length: NC * 2 }, (_, j) => (j < NC
  ? { pre: true, x0: PX0 + j * CW, x1: PX0 + (j + 1) * CW }
  : { pre: false, x0: SX0 + (j - NC) * CWS, x1: SX0 + (j - NC + 1) * CWS }));
const cxOf = j => (cells[j].x0 + cells[j].x1) / 2;
const wOf = j => (cells[j].x1 - cells[j].x0);

/** short dark-on-transparent text sprite; set() redraws in place */
function mkLabel(scene, text, h = 0.28) {
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthWrite: false, depthTest: false }));
  sp.renderOrder = 20;
  const set = t => {
    const cv = document.createElement('canvas'), g = cv.getContext('2d');
    const font = 'bold 56px ui-monospace, "DejaVu Sans Mono", monospace';
    g.font = font;
    const w = Math.max(24, Math.ceil(g.measureText(t).width)) + 14;
    cv.width = w; cv.height = 72;
    g.font = font; g.fillStyle = '#131313'; g.textBaseline = 'middle';
    g.fillText(t, 7, 38);
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    sp.material.map?.dispose();
    sp.material.map = tex; sp.material.needsUpdate = true;
    sp.userData.h = h; sp.userData.a = w / 72;
  };
  set(text);
  scene.add(sp);
  return sp;
}
const putLab = (sp, on, x, y, z) => {
  const k = Math.min(1, Math.max(on, 0.001));
  sp.scale.set(sp.userData.a * sp.userData.h * k, sp.userData.h * k, 1);
  sp.position.set(x, y, z);
};

export default function build(scene, emit) {
  const out = emitter(emit);

  // ── the three prompts: light rails + a light footprint box over the shared span ──
  const foot = [];
  for (let i = 0; i < NL; i++) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(SX1 - PX0 + 0.24, 0.04, 0.52), ghost(0x3f3f3f, 0.16));
    rail.position.set((PX0 + SX1) / 2, RAIL_Y, LANE[i]);
    const o = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1)),
      new THREE.LineBasicMaterial({ color: 0x8a8a8a }));
    o.position.set(0, ROW_Y, LANE[i]); o.scale.set(0.001, BH + 0.13, 0.58);
    scene.add(rail, o); foot.push(o);
  }

  // ── agent cards ──
  const cards = LANE.map((z, i) => {
    const c = new THREE.Mesh(new THREE.BoxGeometry(0.27, 0.27, 0.27), lam(TONE[i]));
    c.position.set(PX0 - 0.3, ROW_Y, z); c.scale.setScalar(0.001);
    scene.add(c); return c;
  });

  // ── private (per-lane) KV blocks: one instance per (lane, drawn cell) ──
  const priv = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), lam(0xffffff), NL * NC * 2);
  priv.frustumCulled = false;
  for (let i = 0; i < NL; i++) for (let j = 0; j < NC * 2; j++) priv.setColorAt(i * NC * 2 + j, new THREE.Color(TONE[i]));
  if (priv.instanceColor) priv.instanceColor.needsUpdate = true;
  scene.add(priv);
  const pv = new Float32Array(NL * NC * 2).fill(0.001);

  // ── vLLM: shared block row on a pool shelf, refcount ticks, reference cables ──
  const pool = new THREE.Mesh(new THREE.BoxGeometry(PX1 - PX0 + 0.3, 0.05, 2.3), ghost(0x2f2f2f, 0.13));
  pool.position.set((PX0 + PX1) / 2, SH_Y - 0.33, 0);
  const poolEdge = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 0.16, 2.3)),
    new THREE.LineBasicMaterial({ color: 0x9a9a9a }));
  scene.add(pool, poolEdge);

  const shared = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), lam(0x131313), NC);
  shared.frustumCulled = false; scene.add(shared);
  const sv = new Float32Array(NC).fill(0.001);

  const NT = NC * NL;
  const ticks = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), lam(0xffffff), NT);
  ticks.frustumCulled = false;
  for (let k = 0; k < NL; k++) for (let j = 0; j < NC; j++) ticks.setColorAt(k * NC + j, new THREE.Color(TONE[k]));
  if (ticks.instanceColor) ticks.instanceColor.needsUpdate = true;
  scene.add(ticks);
  const tkv = new Float32Array(NT).fill(0.001);

  // the drawn cell that the divergence point falls inside: partial ⇒ not a reusable full block
  const partEdge = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1)),
    new THREE.LineBasicMaterial({ color: 0x3a3a3a }));
  partEdge.scale.setScalar(0.001); scene.add(partEdge);

  const cables = [];
  for (let i = 0; i < NL; i++) {
    const row = [];
    for (let s = 0; s < 2; s++) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
      const l = new THREE.Line(g, new THREE.LineBasicMaterial({ color: TONE[i] }));
      l.frustumCulled = false; scene.add(l); row.push(l);
    }
    cables.push(row);
  }
  const setCable = (l, x0, y0, z0, x1, y1, z1, f) => {
    const a = l.geometry.attributes.position;
    a.setXYZ(0, x0, y0, z0);
    a.setXYZ(1, x0 + (x1 - x0) * f, y0 + (y1 - y0) * f, z0 + (z1 - z0) * f);
    a.needsUpdate = true;
    l.visible = f > 0.02;
  };

  // ── SGLang: trunk → node → branch per lane (variable-length token spans) ──
  const tube = (w, d, c) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), lam(c));
    m.scale.setScalar(0.001); scene.add(m); return m;
  };
  const trunk = tube(1, 1, 0x121212), node = tube(1, 1, 0x121212);
  const elbow = [tube(0, 0, 0x121212), tube(0, 0, 0x121212), tube(0, 0, 0x121212)];
  const branch = [tube(0, 0, 0x121212), tube(0, 0, 0x121212), tube(0, 0, 0x121212)];
  const branchT = [0.23, 0x4a4a4a, 0x7c7c7c];

  // ── write heads: where a prefill front currently is ──
  const head = () => { const m = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.16, 0.6), lam(0x0f0f0f)); m.scale.setScalar(0.001); scene.add(m); return m; };
  const heads = [head(), head(), head()], shHead = head();

  // ── token ruler: x = token position, dark span = identical, light span = differs ──
  const rulerY = -1.52;
  const ruler = new THREE.Mesh(new THREE.BoxGeometry(SX1 - PX0 + 0.3, 0.03, 0.3), ghost(0x3f3f3f, 0.18));
  ruler.position.set((PX0 + SX1) / 2, rulerY, 0);
  scene.add(ruler);
  const rt = new THREE.InstancedMesh(new THREE.BoxGeometry(0.016, 0.09, 0.34), new THREE.MeshBasicMaterial({ color: 0x8f8f8f }), NC * 2 + 1);
  for (let j = 0; j <= NC * 2; j++) {
    const x = j < NC ? PX0 + j * CW : SX0 + (j - NC) * CWS;
    rt.setMatrixAt(j, M.compose(P.set(x, rulerY, 0), Q, S.setScalar(1)));
  }
  rt.instanceMatrix.needsUpdate = true; scene.add(rt);
  const sameBar = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), lam(0x161616));
  const diffBar = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), ghost(0x6f6f6f, 0.5));
  scene.add(sameBar, diffBar);

  // ── divergence marker ──
  const post = new THREE.Mesh(new THREE.BoxGeometry(0.05, 1, 0.05), lam(0x101010));
  const plane = new THREE.Mesh(new THREE.BoxGeometry(0.02, 2.5, 2.5), ghost(0x111111, 0.07));
  scene.add(post, plane);

  // ── labels (short; the numbers live in the readout) ──
  const labs = {
    agents: [mkLabel(scene, 'agent a', 0.24), mkLabel(scene, 'agent b', 0.24), mkLabel(scene, 'agent c', 0.24)],
    blocks: mkLabel(scene, 'kv blocks', 0.26),
    trunk: mkLabel(scene, 'radix trunk', 0.25),
    own: mkLabel(scene, 'each slot: own copy', 0.25),
    div: mkLabel(scene, 'token 500', 0.25),
    same: mkLabel(scene, 'identical prefix', 0.23),
    diff: mkLabel(scene, 'different per agent', 0.23),
  };

  // ── state ──
  let t = 0, playing = true, mode = 'vllm', diverge = false;
  let aV = 1, aS = 0, aL = 0, dA = 0;
  const hAmt = [0, 0, 0], sHAmt = [0];

  const finishOf = i => {
    const dX = diverge ? DIVX : PX1, pX = mode === 'llamacpp' ? PX0 : dX;
    return ARR[i] + (mode === 'llamacpp' ? 0 : 0.55) + (SX1 - pX) / PXV;
  };

  return {
    view: { target: [-0.1, -0.1, 0], radius: 40, theta: 0.42, phi: 1.13, size: 3.5 },
    update(dt) {
      if (playing) t = (t + dt) % LOOP;
      const k = ease(dt, 6);
      aV += ((mode === 'vllm' ? 1 : 0) - aV) * k;
      aS += ((mode === 'sglang' ? 1 : 0) - aS) * k;
      aL += ((mode === 'llamacpp' ? 1 : 0) - aL) * k;
      dA += ((diverge ? 1 : 0) - dA) * k;

      const aSh = 1 - aL;                       // "sharing engine" amount
      const divX = PX1 + (DIVX - PX1) * dA;     // where ordinary initial-prefix reuse stops
      const pStart = aL * PX0 + aSh * divX;     // a slot's own prefill starts here

      // shared coverage of each drawn prefix cell (continuous as the boundary sweeps)
      const cov = cells.map(c => (c.pre ? Math.max(0, Math.min(1, (divX - c.x0) / CW)) : 0));

      // vLLM: the first request builds the shared blocks; the others only add a reference
      const sp = Math.max(PX0, Math.min(divX, PX0 + PXV * (t - ARR[0])));
      let refs = 0;
      for (let j = 0; j < NC; j++) {
        const f = cov[j] * Math.max(0, Math.min(1, (sp - cells[j].x0) / CW)) * aV;
        sv[j] += (Math.max(f, 0.001) - sv[j]) * ease(dt, 11);
        P.set(cxOf(j), SH_Y, 0); S.set(BW * sv[j] * 0.9, SHH * sv[j], 0.7 * sv[j]);
        shared.setMatrixAt(j, M.compose(P, Q, S));
      }
      shared.instanceMatrix.needsUpdate = true;

      // partial containing block: light outline, NOT reusable as a full block
      let pj = -1;
      for (let j = 0; j < NC; j++) if (cells[j].x0 < divX && divX < cells[j].x1) pj = j;
      const pAmt = aV * dA * (pj >= 0 ? 1 : 0);
      if (pj >= 0) {
        partEdge.position.set(cxOf(pj), SH_Y, 0);
        partEdge.scale.set(Math.max(CW * pAmt, 0.001), SHH + 0.07, 0.78);
      } else partEdge.scale.setScalar(0.001);

      const sActive = aV * (t > ARR[0] ? 1 : 0);
      sHAmt[0] += (Math.min(1, sActive) * (sp < divX - 0.02 ? 1 : 0) - sHAmt[0]) * ease(dt, 9);
      shHead.scale.setScalar(Math.max(sHAmt[0] * aV, 0.001));
      shHead.position.set(sp, SH_Y + SHH / 2 + 0.12, 0);

      // pool shelf + refcount ticks + cables
      poolEdge.position.set((PX0 + divX) / 2, SH_Y - 0.33, 0);
      poolEdge.scale.set(Math.max(divX - PX0 + 0.3, 0.001) * Math.max(aV, 0.001), 1, 1);
      pool.position.x = poolEdge.position.x;
      pool.scale.set(Math.max(aV, 0.001), 1, 1);

      for (let i = 0; i < NL; i++) {
        const la = Math.max(0, Math.min(1, (t - ARR[i]) / 0.35));
        const rf = Math.max(0, Math.min(1, (t - ARR[i] - 0.5) / 0.45));
        if (rf > 0.6) refs++;
        // own-copy blocks start right away in llama.cpp; a warm shared hit costs only a reference
        const ps = Math.max(pStart, Math.min(SX1 + 0.4, pStart + PXV * (t - ARR[i] - aSh * 0.55)));
        for (let j = 0; j < NC * 2; j++) {
          const own = aL + aSh * (1 - cov[j]);                    // covered by shared structure?
          const f = la * own * Math.max(0, Math.min(1, (ps - cells[j].x0) / (cells[j].x1 - cells[j].x0)));
          const tgt = Math.max(f * (1 - aS), 0.001);              // SGLang draws tubes instead
          const id = i * NC * 2 + j;
          pv[id] += (tgt - pv[id]) * ease(dt, 11);
          P.set(cxOf(j), ROW_Y, LANE[i]); S.set(BW * pv[id], BH * pv[id], BD * pv[id]);
          priv.setMatrixAt(id, M.compose(P, Q, S));
        }
        // refcount: one tick bar per referencing lane
        for (let j = 0; j < NC; j++) {
          const f = Math.max(0, Math.min(1, (sp - cells[j].x0) / CW)) * cov[j] * rf * aV;
          const id = i * NC + j;
          tkv[id] += (Math.max(f, 0.001) - tkv[id]) * ease(dt, 10);
          P.set(cxOf(j), SH_Y + 0.13 - i * 0.1, 0.44);
          S.set(0.22 * tkv[id], 0.05 * tkv[id], 0.1 * tkv[id]);
          ticks.setMatrixAt(id, M.compose(P, Q, S));
        }
        // reference cables: lane footprint → the shared blocks it points at
        for (let s = 0; s < 2; s++) {
          const x = s === 0 ? PX0 + 0.09 : divX - 0.09;
          const f = rf * aV * (s === 1 && divX - PX0 < 0.5 ? 0 : 1);
          setCable(cables[i][s], x, RAIL_Y - 0.02, LANE[i], x, SH_Y + SHH * 0.55, (i - 1) * 0.22, f);
        }
        // footprint box over the shared span (tokens that exist here but are not stored here)
        foot[i].position.set((PX0 + divX) / 2, ROW_Y, LANE[i]);
        foot[i].scale.set(Math.max((divX - PX0) * Math.max(aSh, 0.001), 0.001), BH + 0.13, 0.58);
        // SGLang branch: elbow out of the node, then a thinner span along the lane
        const bz = LANE[i], bStart = divX;
        const bEnd = Math.max(bStart, Math.min(SX1 + 0.2, bStart + PXV * (t - ARR[i] - 0.35)));
        const eAmt = aS * la * Math.max(0, Math.min(1, (t - ARR[i] - 0.15) / 0.4));
        const ex = 0.5, L = Math.hypot(ex, bz);
        elbow[i].position.set(bStart + ex / 2, ROW_Y, bz / 2);
        elbow[i].rotation.y = Math.atan2(-bz, ex);
        elbow[i].scale.set(Math.max(L * eAmt, 0.001), 0.26 * eAmt, 0.26 * eAmt);
        const bs0 = bStart + ex, bs1 = Math.max(bs0, bEnd);
        const bAmt = aS * la * (1 - aL);
        branch[i].position.set((bs0 + bs1) / 2, ROW_Y, bz);
        branch[i].scale.set(Math.max((bs1 - bs0) * bAmt, 0.001), 0.25 * bAmt, 0.25 * bAmt);
        branch[i].material.color.setHex(branchT[i]);
        // write head on this lane's own prefill front
        hAmt[i] += ((la > 0.95 && ps < SX1 - 0.05 && ps > pStart + 0.02 ? 1 : 0) - hAmt[i]) * ease(dt, 9);
        heads[i].scale.setScalar(Math.max(hAmt[i], 0.001));
        heads[i].position.set(ps, ROW_Y + BH / 2 + 0.1, LANE[i]);
        cards[i].scale.setScalar(Math.max(la, 0.001));
      }
      priv.instanceMatrix.needsUpdate = true;
      ticks.instanceMatrix.needsUpdate = true;

      // trunk + node (one shared span, fork where the first differing token is)
      const tAmt = aS * (t > ARR[0] ? 1 : 0);
      trunk.position.set((PX0 + sp) / 2, ROW_Y, 0);
      trunk.scale.set(Math.max((sp - PX0) * tAmt, 0.001), 0.5 * tAmt, 0.54 * tAmt);
      node.position.set(divX, ROW_Y, 0);
      node.scale.set(Math.max(0.11 * aS, 0.001), Math.max(0.62 * aS, 0.001), Math.max(0.62 * aS, 0.001));

      // ruler spans + divergence marker
      sameBar.position.set((PX0 + divX) / 2, rulerY - 0.14, 0);
      sameBar.scale.set(Math.max(divX - PX0, 0.001), 0.07, 0.42);
      diffBar.position.set((divX + SX1) / 2, rulerY - 0.14, 0);
      diffBar.scale.set(Math.max(SX1 - divX, 0.001), 0.07, 0.42);
      post.position.set(divX, -0.2, 0);
      post.scale.set(1, Math.max(dA, 0.001) * 2.5, 1);
      plane.position.set(divX, 0.05, 0);
      plane.scale.setScalar(Math.max(dA, 0.001));
      plane.material.opacity = 0.07 * dA;

      // labels
      for (let i = 0; i < NL; i++) putLab(labs.agents[i], Math.max((t - ARR[i]) / 0.4, 0.001), PX0 - 0.3, ROW_Y + 0.32, LANE[i]);
      putLab(labs.blocks, aV, PX1 + 0.85, SH_Y + 0.1, 0);
      putLab(labs.trunk, aS * (t > ARR[0] + 0.6 ? 1 : 0), (PX0 + divX) / 2, ROW_Y + 0.42, 0);
      putLab(labs.own, aL * (t > ARR[0] + 0.6 ? 1 : 0), PX0 + 1.3, ROW_Y + 0.42, LANE[0]);
      putLab(labs.div, dA, divX, ROW_Y + 0.78, 0);
      putLab(labs.same, 1, (PX0 + divX) / 2, rulerY - 0.44, 0);
      putLab(labs.diff, 1, (divX + SX1) / 2, rulerY - 0.44, 0);

      const n = ARR.filter(a => t >= a).length;
      const readout = mode === 'vllm'
        ? (diverge ? `diverge at token 500 · shared stub 1× · rest ${n} copies · refs ${refs}`
          : `shared positions 50k (illustrative) · stored blocks 3× → 1× · refs ${refs}`)
        : mode === 'sglang'
          ? (diverge ? `diverge at token 500 · trunk stops there · branches ×${n}`
            : `shared positions 50k (illustrative) · trunk 1 · branches ×${n}`)
          : (diverge ? `diverge at token 500 · slots keep separate copies · ${n}×`
            : `3 slots · every slot stores its own 50k prefix · stored ${n}×`);
      out({ playing, mode, diverge, agents: n, refs, readout });
    },
    action(name, arg) {
      if (name === 'play') { playing = !playing; }
      else if (name === 'step') {
        playing = false;
        const bs = [];
        for (let i = 0; i < NL; i++) bs.push(ARR[i], ARR[i] + 0.6, ARR[i] + 1.4, finishOf(i));
        bs.sort((a, b) => a - b);
        const nx = bs.find(b => b > t + 1e-4);
        t = nx === undefined ? 0 : nx + 0.05;
      } else if (name === 'mode') mode = ['vllm', 'sglang', 'llamacpp'].includes(String(arg)) ? String(arg) : 'vllm';
      else if (name === 'diverge') diverge = !!arg;
    },
  };
}
