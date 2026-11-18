// Scene `agent-eviction` — the model fits in VRAM, the agents' retained prefixes don't
// (README "Scene N — 'fit the model' versus 'keep the agents fast'" + "Prefix caching and
// quantized KV", README lines 196-204 / 559-567).
//
// Three rows that share the same bytes:
//   1. top slab  = one fixed VRAM budget: weights (dark, dominant — the model DOES fit) and the KV
//      pool (outlined box; its dark fill = how full the pool is).
//   2. middle row = that same pool opened up. The row width IS the pool's bytes; each thin dark
//      block is a KV cache block and one contiguous run of blocks is one agent's retained prefix
//      (one luminance per agent, cycling, so neighbouring runs stay split in monochrome). The
//      leftmost run was used most recently, the rightmost is next out; the dark post at the right
//      is the capacity edge. Switching kv fp8 → nvfp4 makes every block narrower — same bytes,
//      more blocks — so more prefixes fit before anything is pushed past the post.
//   3. bottom row = turns arriving (a pointer travelling the rail; chatty agents act more often)
//      and one TTFT bar per agent: a small tick when its prefix was still resident, a tall spike
//      when it had been evicted and the whole prefix must be re-prefilled. The light outline behind
//      a bar is the worst TTFT that agent has paid, so the envelope under pressure stays visible.
// Dark = resident / important, light = empty pool, evicted or history.
//
// Illustrative / simulated. Do NOT imply: any GiB figure, latency in ms or tok/s (bar heights are
// relative shapes only), that any engine evicts in this order (this is an LRU-like drop of whole
// least-recently-used prefixes, chosen for legibility — real policies differ per engine/version),
// that NVFP4 KV is universally 1.65× (the block ratio here echoes ONE dated configuration in the
// repo README: a vLLM FP8 KV pool of 741,032 tokens becoming 1,225,765 tokens under NVFP4), that a
// full pool simply ends admission, or that decode throughput changes — decode is deliberately not
// drawn; cache capacity and TTFT are the axis. Sources: repo README as above; vLLM paged KV and
// automatic prefix caching.
import { THREE, lam, ghost, M, Q, P, S, ease, emitter } from './_kit.js';

const MAXAG = 24;                     // widest agent control
const GAP = 0.34;                     // visual gap between runs, in block widths
const CAPS = { fp8: 30, nvfp4: 49 };  // blocks in the fixed pool; 49/30 ≈ the README's 1.65×
// Deterministic workload, chosen so the teaching matrix is stable: 4 agents' working set fits both
// precisions, 8 agents' does not fit fp8 but does fit nvfp4, 24 agents' fits neither.
const preOf = i => 3 + ((i * 5) % 6);          // blocks of retained prefix (3..8), illustrative
const PMIN = 3, PMAX = 8;
const rfOf = i => 0.62 + ((i * 7) % 11) * 0.075;   // turn cadence: chatty agents act more often

const X0 = -3.8, XW = 7.6;            // the budget bar and the pool row share this span
const BAR_Y = 2.45, BAR_H = 0.52, SEG_W = 0.68;   // top row: weights | kv pool
const ROW_Y = 1.0, ROW_H = 0.62;      // middle row: the kv pool opened up
const BASE_Y = -1.62;                 // TTFT baseline
const CARD_Y = -2.28;                 // agent cards + arrival rail
const AX = -3.3, AW = 7.1;            // agent columns (the left gutter carries the ttft label)
const MISS_H = 1.5, HIT_R = 0.12;     // spike height in world units, tick as a fraction of it
const TONES = [0x161616, 0x454545, 0x747474, 0x2b2b2b, 0x5c5c5c, 0x8a8a8a];

export default function build(scene, emit) {
  const out = emitter(emit);
  const edge = (w, h, d, c = 0x111111) => new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(w, h, d)), new THREE.LineBasicMaterial({ color: c }));

  // ── 1 · fixed VRAM budget: weights, then what is left for the kv pool ───
  const wW = XW * SEG_W, pW = XW - wW, pX = X0 + wW + pW / 2;
  const weights = new THREE.Mesh(new THREE.BoxGeometry(wW - 0.05, BAR_H - 0.1, 0.92), lam(0x161616));
  weights.position.set(X0 + wW / 2, BAR_Y, 0);
  const poolEdge = edge(pW, BAR_H, 1.0);
  poolEdge.position.set(pX, BAR_Y, 0);
  const poolFill = new THREE.Mesh(new THREE.BoxGeometry(1, BAR_H - 0.16, 0.96), lam(0x1e1e1e));
  poolFill.position.set(pX, BAR_Y, 0);
  scene.add(weights, poolEdge, poolFill);

  // ── 2 · the pool opened up: light floor, dark capacity post, agent runs ─
  const floor = new THREE.Mesh(new THREE.BoxGeometry(XW + 0.3, 0.05, 1.15), ghost(0x9a9a9a, 0.5));
  floor.position.set(X0 + XW / 2, ROW_Y - ROW_H / 2 - 0.02, 0);
  const wall = new THREE.Mesh(new THREE.BoxGeometry(0.07, ROW_H + 0.4, 0.34), lam(0x111111));
  wall.position.set(X0 + XW + 0.06, ROW_Y + 0.12, 0.62);
  const link = new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position',
    new THREE.Float32BufferAttribute([
      X0 + wW, BAR_Y - BAR_H / 2, 0, X0, ROW_Y + ROW_H / 2 + 0.08, 0,
      X0 + XW, BAR_Y - BAR_H / 2, 0, X0 + XW, ROW_Y + ROW_H / 2 + 0.08, 0,
    ], 3)), new THREE.LineBasicMaterial({ color: 0x9a9a9a }));
  scene.add(floor, wall, link);

  const NB = MAXAG * PMAX;
  const kv = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), lam(0xffffff), NB);
  kv.frustumCulled = false;
  scene.add(kv);
  const cBg = new THREE.Color(0xdedede), tmp = new THREE.Color();

  // ── 3 · turns and time to first token ───────────────────────────────────
  const base = new THREE.Mesh(new THREE.BoxGeometry(AW + 0.9, 0.035, 0.6), lam(0x2a2a2a));
  base.position.set(AX + AW / 2, BASE_Y - 0.02, 0.1);
  const rail = new THREE.Mesh(new THREE.BoxGeometry(AW + 0.5, 0.022, 0.26), ghost(0x3a3a3a, 0.3));
  rail.position.set(AX + AW / 2, CARD_Y - 0.33, 0.1);
  const pointer = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.08, 0.4), lam(0x111111));
  scene.add(base, rail, pointer);

  const cards = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), lam(0xffffff), MAXAG);
  const bars = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), lam(0x161616), MAXAG);
  cards.frustumCulled = bars.frustumCulled = false;
  scene.add(cards, bars);
  const peaks = [];
  for (let i = 0; i < MAXAG; i++) {
    const e = edge(1, 1, 1, 0x7a7a7a);
    e.scale.setScalar(0.001);
    scene.add(e);
    peaks.push(e);
  }

  // ── prefix tiles: retrieved from the run (hit) or recomputed (miss) ─────
  const NT = 36;
  const trav = new THREE.InstancedMesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), lam(0xffffff), NT);
  trav.frustumCulled = false;
  scene.add(trav);
  const tF = new Float32Array(NT * 3), tT = new Float32Array(NT * 3), tU = new Float32Array(NT).fill(9);
  const tC = [];
  let tSlot = 0;
  const cDark = new THREE.Color(0x161616), cMid = new THREE.Color(0x8a8a8a);
  function spawn(fx, fy, tx, ty, dark) {
    const i = tSlot; tSlot = (tSlot + 1) % NT;
    tF.set([fx, fy, 0.5], i * 3); tT.set([tx, ty, 0.5], i * 3);
    tU[i] = 0; tC[i] = dark ? cDark : cMid;
  }

  // ── labels (short; the counts live in the readout) ──────────────────────
  function label(text) {
    const fpx = 56, f = `bold ${fpx}px ui-monospace, monospace`;
    const cv = document.createElement('canvas'), g = cv.getContext('2d');
    g.font = f;
    const w = Math.ceil(g.measureText(text).width) + 18;
    cv.width = w; cv.height = fpx + 12;
    g.font = f; g.fillStyle = '#141414'; g.textBaseline = 'middle'; g.fillText(text, 9, cv.height / 2);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({
      map: new THREE.CanvasTexture(cv), transparent: true, depthWrite: false, depthTest: false }));
    sp.renderOrder = 20;
    sp.scale.set(0.001, 0.001, 1);
    sp.userData.w = w / cv.height;
    scene.add(sp);
    return sp;
  }
  const setLab = (sp, h, x, y) => {
    sp.scale.set(Math.max(h * sp.userData.w, 0.001), Math.max(h, 0.001), 1);
    sp.position.set(x, y, 0.7);
  };
  const labW = label('weights'), labP = label('kv pool'), labT = label('ttft');

  // ── state ───────────────────────────────────────────────────────────────
  const ag = Array.from({ length: MAXAG }, (_, i) => ({
    pre: preOf(i),                                      // history this agent keeps re-sending
    rf: rfOf(i),
    every: 8, next: 0, slot: -1, resident: false, x: 0, tx: 0, ex: -9, vis: 0.001,
    fill: 0, bar: 0.001, barT: 0.001, peak: 0.001,
  }));
  ag.forEach((a, i) => a.tone = new THREE.Color(TONES[i % TONES.length]));
  let want = 8, dtype = 'fp8', playing = true, acc = 0, stepBeat = false;
  let order = [], used = 0, beat = 0, hist = [], bw = XW / CAPS.fp8, curX = AX + AW / 2, flash = 0;

  const cap = () => CAPS[dtype];
  const bwOf = () => XW / (cap() + GAP * cap() / PMIN);  // block width: the pool's bytes are fixed
  const xOf = i => AX + (AW / want) * (i + 0.5);
  const cardW = () => Math.max(0.12, Math.min(0.6, (AW / want) * 0.62));

  function layout() {                                    // MRU run at the left, one per resident agent
    let cur = 0;
    order.forEach((id, k) => {
      const a = ag[id];
      a.tx = X0 + (cur + a.pre / 2) * bw;
      a.slot = k;
      cur += a.pre + GAP;
    });
  }
  function warm() {                                      // prefixes arrive once, no history yet
    order = []; used = 0; hist = []; beat = 0; acc = 0; snaps.length = 0;
    for (let i = 0; i < MAXAG; i++) {
      const a = ag[i];
      a.resident = false; a.slot = -1; a.fill = 1; a.vis = 0.001; a.ex = -9;
      a.bar = a.barT = a.peak = 0.001;
      a.every = Math.max(1, Math.round(want * a.rf));    // how often this agent acts
      a.next = i < want ? i : 999;
    }
    for (let i = 0; i < want && used + ag[i].pre <= cap(); i++) {
      order.push(i); used += ag[i].pre; ag[i].resident = true;
    }
    layout();
  }
  function evict() {                                     // LRU-like: whole least-recent prefixes go
    while (used > cap() && order.length > 1) {
      const id = order.pop();
      used -= ag[id].pre;
      ag[id].resident = false; ag[id].fill = 0;
    }
    layout();
  }
  function turn(a) {                                     // one agent's turn comes up
    const agent = ag[a], hit = agent.resident;
    beat++;
    agent.next = beat + agent.every;
    if (hit) order.splice(agent.slot, 1);
    order.unshift(a);
    if (!hit) {                                          // prefix is gone: re-prefill it block by block
      agent.resident = true; agent.fill = 0.001; used += agent.pre;
    }
    agent.bar = 0.002; agent.barT = hit ? HIT_R : 1;
    agent.peak = Math.max(agent.peak * 0.92, agent.barT);
    hist.push(hit ? 1 : 0); if (hist.length > 12) hist.shift();
    evict();
    curX = xOf(a); flash = 1;
    const from = hit ? agent.tx : X0 - bw * 2;           // outside the pool = recomputed, not cached
    const cw = cardW();
    for (let k = 0; k < 3; k++) spawn(from, ROW_Y - 0.14, curX + (k - 1) * cw * 0.34, BASE_Y + 0.1, hit);
  }
  function due() {                                       // the longest-waiting agent, if any
    let best = -1;
    for (let i = 0; i < want; i++) {
      if (ag[i].next > beat) continue;
      if (best < 0 || ag[i].next < ag[best].next) best = i;
    }
    return best;
  }
  function beatStep() {
    snaps.push(snap());                                 // 'back' restores the pool/turn state from here
    if (snaps.length > 300) snaps.shift();
    const a = due();
    if (a >= 0) { turn(a); return; }
    beat++;                                              // nothing was ready: time passes instead
    for (let k = 0; k < 40; k++) { const b = due(); if (b >= 0) { turn(b); return; } beat++; }
  }

  // The pool sim is stateful (LRU order, byte usage, per-agent schedules), so 'back' rewinds one
  // beat by restoring the recorded state rather than trying to invert turn()/evict().
  const snaps = [];
  const snap = () => ({
    beat, used, order: order.slice(), hist: hist.slice(),
    ag: ag.map(x => [x.resident, x.next, x.every, x.fill, x.bar, x.barT, x.peak, x.ex]),
  });
  function rewind() {
    const s = snaps.pop();
    if (!s) return;
    beat = s.beat; used = s.used; order = s.order.slice(); hist = s.hist.slice();
    s.ag.forEach((v, i) => {
      const x = ag[i];
      [x.resident, x.next, x.every, x.fill, x.bar, x.barT, x.peak, x.ex] = v;
    });
    layout();
  }
  warm();

  return {
    view: { target: [-0.5, 0.2, 0], radius: 40, theta: 0.34, phi: 1.38, size: 3.6 },
    update(dt) {
      if (playing) {
        acc += dt;
        const itv = 0.11 + 0.9 / want;                   // a round stays ≈1.5-2.5 s whatever N is
        while (acc >= itv) { acc -= itv; beatStep(); }
      }
      if (stepBeat) { stepBeat = false; beatStep(); }

      // the pool's bytes are fixed; block width follows the kv precision
      bw += (bwOf() - bw) * ease(dt, 6);
      layout();
      const frac = Math.min(1, used / cap());
      poolFill.scale.x = Math.max(0.001, pW * frac);
      poolFill.position.x = X0 + wW + (pW * frac) / 2;

      const cw = cardW();
      for (let i = 0; i < MAXAG; i++) {
        const a = ag[i], live = i < want;
        a.x += (a.tx - a.x) * ease(dt, 7);
        const visT = live && a.resident ? 1 : 0.001;
        a.vis += (visT - a.vis) * ease(dt, a.vis < visT ? 10 : 6);
        if (!a.resident) a.ex = a.x;                     // fade out where the run was standing
        a.fill += (1 - a.fill) * ease(dt, 6);
        const rx = a.resident ? a.x : a.ex;
        for (let k = 0; k < PMAX; k++) {
          const on = k < a.pre;
          const grow = Math.max(0, Math.min(1, a.fill * (a.pre + 0.5) - k));
          const amt = Math.max(0.001, on ? grow * a.vis : 0);
          P.set(rx + (k - (a.pre - 1) / 2) * bw, ROW_Y - (1 - amt) * ROW_H * 0.3, 0);
          kv.setMatrixAt(i * PMAX + k, M.compose(P, Q, S.set(bw * 0.84, ROW_H * 0.84 * amt, 0.86)));
          kv.setColorAt(i * PMAX + k, tmp.copy(a.tone).lerp(cBg, 1 - amt));
        }
        a.bar += (a.barT * (live ? 1 : 0.001) - a.bar) * ease(dt, a.barT > a.bar ? 6 : 10);
        P.set(xOf(i), BASE_Y + 0.14 + Math.max(a.bar, 0.001) * MISS_H / 2, 0.14);
        bars.setMatrixAt(i, M.compose(P, Q, S.set(cw * visT, Math.max(0.001, a.bar * MISS_H), 0.44)));
        P.set(xOf(i), CARD_Y, 0);
        cards.setMatrixAt(i, M.compose(P, Q, S.set(cw * visT, 0.2 * visT, 0.66)));
        cards.setColorAt(i, tmp.copy(a.tone).lerp(cBg, a.resident && live ? 0 : 0.78));
        const ph = Math.max(live ? a.peak : 0.001, 0.001) * MISS_H;
        peaks[i].scale.set(live ? cw + 0.06 : 0.001, Math.max(0.001, ph), live ? 0.52 : 0.001);
        peaks[i].position.set(xOf(i), BASE_Y + 0.14 + ph / 2, 0.14);
      }
      kv.instanceMatrix.needsUpdate = true;
      if (kv.instanceColor) kv.instanceColor.needsUpdate = true;
      bars.instanceMatrix.needsUpdate = true;
      cards.instanceMatrix.needsUpdate = true;
      if (cards.instanceColor) cards.instanceColor.needsUpdate = true;

      flash = Math.max(0, flash - dt * 3.2);
      pointer.position.set(curX, CARD_Y - 0.33, 0.26);
      pointer.scale.setScalar(Math.max(0.5, 1 + flash * 1.8));

      for (let i = 0; i < NT; i++) {
        if (tU[i] > 1) { trav.setMatrixAt(i, M.compose(P.set(0, -9, 0), Q, S.setScalar(0.001))); continue; }
        tU[i] += dt / 0.42;
        const u = Math.min(1, tU[i]), e2 = u * u * (3 - 2 * u);
        P.set(tF[i * 3] + (tT[i * 3] - tF[i * 3]) * e2, tF[i * 3 + 1] + (tT[i * 3 + 1] - tF[i * 3 + 1]) * e2, 0.5);
        S.setScalar(Math.max(0.001, Math.sin(Math.PI * Math.min(1, u * 1.05)) * 1.5));
        trav.setMatrixAt(i, M.compose(P, Q, S));
        trav.setColorAt(i, tC[i] || cMid);
      }
      trav.instanceMatrix.needsUpdate = true;
      if (trav.instanceColor) trav.instanceColor.needsUpdate = true;

      setLab(labW, 0.24, X0 + wW / 2, BAR_Y + BAR_H / 2 + 0.22);
      setLab(labP, 0.24, pX, BAR_Y + BAR_H / 2 + 0.22);
      setLab(labT, 0.24, X0 + 0.3, BASE_Y + 0.34);

      const hh = hist.reduce((s, v) => s + v, 0);
      out({
        playing, agents: want, dtype, resident: order.length, turns: hist.length,
        readout: `${want} agents · kv ${dtype} · pool ${Math.round(frac * 100)}% full (${used}/${cap()} blk)`
          + ` · ${hh}/${hist.length} turns hit`,
      });
    },
    action(name, arg) {
      if (name === 'play') { playing = !playing; acc = 0; }
      else if (name === 'step') { playing = false; acc = 0; stepBeat = true; }
      else if (name === 'back') { playing = false; acc = 0; stepBeat = false; rewind(); }
      else if (name === 'agents') {
        want = [1, 4, 8, 24].includes(Number(arg)) ? Number(arg) : 8;
        warm();
      } else if (name === 'dtype') {
        dtype = String(arg) === 'nvfp4' ? 'nvfp4' : 'fp8';   // same agents, same bytes, more blocks
        hist = [];
        snaps.length = 0;
        evict();
      }
    },
  };
}
