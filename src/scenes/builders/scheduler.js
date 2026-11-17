// Scene `scheduler` — continuous batching: every forward step *spends a token budget*
// (chapter 04 anchor, viz-audit M2).
//
// x = time: a conveyor of step columns drifting left. y = request lanes (6 rails) with a dim row
// of waiting cards above them. z is only used for a little depth.
// Bottom strip: the BUDGET. At the right edge stands an outline column ruled into B cells — that
// is all one step is allowed to do. Every step fills it and the SAME cells appear in the lanes
// above: each running request whose prompt is already decoded takes exactly ONE cell (a small
// dark cube in its lane, one dark plate in the budget column), and whatever cells are left go to
// ONE request's PREFILL as a light-grey chunk (chunked prefill) whose height in the budget column
// is exactly how many cells it took. A column that stops below the ceiling line is budget that
// went unspent: either max-num-seqs is full (rails beyond it shrink to stubs — admission, not
// memory, closes them) or no request is waiting. Queued requests wait as dim cards in the row
// above the lanes, the blocked head of the queue pulses, and finished cards slide out to the
// right.
//
// Everything is illustrative: prompt lengths, token counts and arrivals come from a seeded PRNG,
// one cell = one token slot of the step, one prefill chunk per step is a simplification, and this
// scene deliberately shows NO latency, tokens/s or throughput numbers. Modelled on vLLM V1's
// unified scheduler, which hands out a fixed token budget per step ({request_id: num_tokens}) so
// chunked prefill, prefix caching and speculation share one loop
// (https://docs.vllm.ai/en/stable/getting_started/v1_user_guide.html,
// https://docs.vllm.ai/en/stable/configuration/optimization/); iteration-level scheduling
// originates with Orca (OSDI 2022). Policy, defaults and knob names are version-specific — see
// the slide notes.
import { THREE, rng, lam, ghost, M, Q, P, S, ease, emitter } from './_kit.js';

const NCOLS = 6;                       // step columns kept on the belt (illustrative)
const DX = 0.48;                       // belt pitch: one step per DX
const X_NOW = 1.25;                    // x of the step being spent (where the budget stands)
const X_TAIL = X_NOW - (NCOLS - 1) * DX;
const LANES = 6;                       // request lanes
const DY = 0.3, LANE0 = 0.85;          // lane pitch, top lane
const QY = 1.45;                       // queue row (above the lanes)
const BASE_Y = -1.95;                  // floor of the budget column
const GAUGE_H = 0.95;                  // height of the largest budget shown (B = 32)
const CELL_H = GAUGE_H / 32;           // ONE TOKEN = one cell of this height, whatever B is
const CARD_X = X_NOW + 0.3;            // where a running card sits
const EXIT_X = X_NOW + 1.55;           // cards leave to the right
const QMAX = 5;                        // queued cards shown above the lanes
const STEP_DT = 0.6;                   // seconds per forward step
const MAXREQ = 14;

const laneY = i => LANE0 - i * DY;

export default function build(scene, emit) {
  const out = emitter(emit);
  const rand = rng(0x2f71c3);

  // ── furniture: lane rails, queue shelf, budget floor ────────────────────
  const R_L = CARD_X + 0.22, R_R = X_TAIL - 0.18;
  const railLen = R_L - R_R, railCx = (R_L + R_R) / 2;
  const rails = [];
  for (let i = 0; i < LANES; i++) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(railLen, 0.025, 0.26), ghost(0x2f2f2f, 0.16));
    m.position.set(railCx, laneY(i) - 0.155, 0);
    scene.add(m);
    rails.push(m);
  }
  const shelf = new THREE.Mesh(new THREE.BoxGeometry(railLen - 0.5, 0.025, 0.26), ghost(0x2f2f2f, 0.1));
  shelf.position.set(railCx - 0.2, QY - 0.17, 0);
  const floor = new THREE.Mesh(new THREE.BoxGeometry(railLen, 0.025, 0.26), ghost(0x2f2f2f, 0.12));
  floor.position.set(railCx, BASE_Y - 0.03, 0);
  scene.add(shelf, floor);

  // ── the budget: an outline column of B cells + the ceiling line it cannot pass ──
  const lad = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1)),
    new THREE.LineBasicMaterial({ color: 0x111111 }));
  lad.position.set(X_NOW, BASE_Y, 0);
  const DIV = 8;                       // ruled divisions drawn (the cell count is in the readout)
  const ticks = new THREE.InstancedMesh(new THREE.BoxGeometry(0.54, 0.012, 0.02), lam(0x8a8a8a), DIV);
  ticks.frustumCulled = false;
  const ceil = new THREE.Mesh(new THREE.BoxGeometry(1, 0.02, 0.02), lam(0x9a9a9a));
  scene.add(lad, ticks, ceil);

  // ── request cards (pooled): queue row → lane → out the right edge ──────
  const reqs = [];
  for (let i = 0; i < MAXREQ; i++) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.24, 0.22), lam(0xffffff));
    mesh.scale.setScalar(0.001);
    mesh.visible = false;
    scene.add(mesh);
    reqs.push({ mesh, state: 'free', prem: 0, gen: 0, lane: 0, px: CARD_X, py: QY, ps: 0.001, pz: 0.12, tx: CARD_X, ty: QY, ts: 0.001, exit: 0 });
  }

  // ── one step's spend, twice: cells in the lanes, and the same cells stacked
  //    inside the budget column (dark = decode, light = prefill chunk) ─────
  const decCell = new THREE.InstancedMesh(new THREE.BoxGeometry(0.15, 0.15, 0.15), lam(0x101010), NCOLS * LANES);
  const preCell = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), lam(0x9a9a9a), NCOLS);
  const plate = new THREE.InstancedMesh(new THREE.BoxGeometry(0.32, 0.018, 0.16), lam(0x161616), NCOLS * LANES);
  const gChunk = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), lam(0xd2d2d2), NCOLS);
  const colRail = new THREE.InstancedMesh(new THREE.BoxGeometry(0.05, 1, 0.02), ghost(0x3a3a3a, 0.12), NCOLS);
  [decCell, preCell, plate, gChunk, colRail].forEach(o => { o.frustumCulled = false; scene.add(o); });
  const RAILH = QY - BASE_Y + 0.28;
  const edges = [];
  for (let i = 0; i < NCOLS; i++) {
    const mk = c => {
      const e = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1)), new THREE.LineBasicMaterial({ color: c }));
      e.scale.setScalar(0.001);
      scene.add(e);
      return e;
    };
    edges.push([mk(0x141414), mk(0x2a2a2a), mk(0x6f6f6f)]);
  }
  const cRun = new THREE.Color(0x131313), cPre = new THREE.Color(0x5f5f5f), cQueue = new THREE.Color(0x9a9a9a), tmp = new THREE.Color();

  // ── simulation state ───────────────────────────────────────────────────
  let B = 16, maxSeqs = 4, rate = 'high', playing = true;
  let fl = 0, lastInt = 0, stopAt = Infinity, hB = 16 * CELL_H, stepReq = false;
  const lanes = new Array(LANES).fill(null);
  const queue = [];
  let recs = [];                        // spent steps on the belt: {step, B, dec:[lane], chunk:{lane,cells}, used}

  const pArr = () => (rate === 'high' ? 0.7 : 0.12);
  const freeLane = () => { for (let l = 0; l < maxSeqs; l++) if (!lanes[l]) return l; return -1; };
  const spawn = () => {
    const r = reqs.find(q => q.state === 'free');
    if (!r) return;
    r.state = 'queue';
    r.prem = 10 + Math.floor(rand() * 30);         // prompt tokens to prefill (illustrative)
    r.gen = 5 + Math.floor(rand() * 9);            // tokens to generate      (illustrative)
    r.px = CARD_X + 0.9; r.py = QY; r.ps = 0.001;
    queue.push(r);
  };

  function doStep(step) {
    if (queue.length < QMAX && rand() < pArr()) spawn();
    const rec = { step, B, dec: [], chunk: null, used: 0 };
    let cells = B;

    // 1 · decode: every running request whose prompt is already in the cache spends ONE cell
    for (let l = 0; l < LANES; l++) {
      const r = lanes[l];
      if (r && r.state === 'run' && r.prem <= 0 && cells >= 1) { cells--; r.gen--; rec.dec.push(l); }
    }
    // 2 · chunked prefill: one request gets the rest, capped at a chunk of the budget
    const cap = Math.max(2, Math.round(B * 0.6));
    let pre = null;
    for (let l = 0; l < LANES; l++) { const r = lanes[l]; if (r && r.state === 'run' && r.prem > 0) { pre = r; break; } }
    if (!pre && cells >= 2 && queue.length) {
      const l = freeLane();
      if (l >= 0) { pre = queue.shift(); pre.lane = l; lanes[l] = pre; pre.state = 'run'; }
    }
    if (pre && cells >= 1) {
      const n = Math.min(cells, pre.prem, cap);
      cells -= n; pre.prem -= n;
      rec.chunk = { lane: pre.lane, cells: n };
    }
    // 3 · requests that spent their tokens leave; their lane is free from the next step on
    for (const l of rec.dec) {
      const r = lanes[l];
      if (r && r.gen <= 0) { r.state = 'exit'; r.exit = 0; lanes[l] = null; }
    }
    rec.used = B - cells;
    recs.push(rec);
    while (recs.length > NCOLS + 2) recs.shift();
  }

  return {
    view: { target: [0, -0.2, 0], radius: 40, theta: 0.3, phi: 1.2, size: 1.6 },

    update(dt) {
      // one continuous step position: the belt slides left and a column is born at the budget
      if (stepReq) { stepReq = false; stopAt = Math.floor(fl + 1e-6) + 1; playing = false; }
      if (playing || Number.isFinite(stopAt)) {
        fl = Number.isFinite(stopAt) ? Math.min(fl + dt / STEP_DT, stopAt) : fl + dt / STEP_DT;
        if (Number.isFinite(stopAt) && fl >= stopAt) stopAt = Infinity;
        while (fl >= lastInt + 1) { lastInt++; doStep(lastInt); }
      }

      // the budget frame, its divisions and the ceiling follow the current budget
      hB += (B * CELL_H - hB) * ease(dt, 6);
      lad.scale.set(0.46, Math.max(hB, 0.001), 0.2);
      lad.position.y = BASE_Y + hB / 2;
      for (let i = 1; i <= DIV; i++) {
        const on = i < DIV ? 1 : 0.001;
        ticks.setMatrixAt(i - 1, M.compose(P.set(X_NOW, BASE_Y + (hB * i) / DIV, -0.1), Q, S.set(on, on, on)));
      }
      ticks.instanceMatrix.needsUpdate = true;
      ceil.scale.x = Math.max(0.001, railLen);
      ceil.position.set(railCx, BASE_Y + hB, 0);

      // lanes past max-num-seqs are shut to admission: their rail becomes a short stub
      for (let l = 0; l < LANES; l++) {
        const open = l < maxSeqs;
        const r = rails[l];
        r.material.opacity += ((open ? 0.16 : 0.05) - r.material.opacity) * ease(dt, 6);
        const want = open ? 1 : 0.26;
        r.scale.x += (want - r.scale.x) * ease(dt, 7);
        r.position.x = R_L - (railLen * r.scale.x) / 2;
      }

      const newest = recs[recs.length - 1];
      const nRun = lanes.filter(Boolean).length;
      // why does the queue wait? either the step's cells ran out, or max-num-seqs is full
      const blocked = queue.length > 0 && (!newest || newest.used >= B || nRun >= maxSeqs);

      // cards
      for (const r of reqs) {
        if (r.state === 'queue') {
          const j = queue.indexOf(r);
          r.tx = CARD_X - j * DX; r.ty = QY; r.ts = 0.84;
        } else if (r.state === 'run') {
          r.tx = CARD_X; r.ty = laneY(r.lane); r.ts = 1;
        } else if (r.state === 'exit') {
          r.exit += dt; r.tx = EXIT_X; r.ty = laneY(r.lane); r.ts = 0.001;
          if (r.exit > 1) { r.state = 'free'; r.mesh.visible = false; }
        } else {
          r.tx = CARD_X + 0.9; r.ty = QY; r.ts = 0.001;
        }
        const k = ease(dt, 7);
        r.px += (r.tx - r.px) * k; r.py += (r.ty - r.py) * k;
        r.ps += (r.ts - r.ps) * ease(dt, r.ts > r.ps ? 8 : 12);
        tmp.copy(r.state === 'queue' ? cQueue : r.prem > 0 && r.state === 'run' ? cPre : cRun);
        if (r.state === 'queue' && blocked && queue[0] === r) tmp.lerp(cRun, 0.3 + 0.3 * Math.sin(fl * 8));
        r.mesh.material.color.copy(tmp);
        r.mesh.visible = r.ps > 0.01;
        r.mesh.scale.setScalar(Math.max(r.ps, 0.001));
        r.pz += ((r.state === 'exit' ? 0.5 : 0.12) - r.pz) * ease(dt, 6);   // leaving cards pass in front
        r.mesh.position.set(r.px, r.py, r.pz);
      }

      // the belt: one spent step per column. It dwells in the budget frame while the step runs,
      // then slides left with the steps behind it and fades out at the tail.
      const FADE = X_TAIL - 0.4;
      const off = (c, s) => {
        decCell.setMatrixAt(c * LANES + s, M.compose(P, Q, S.setScalar(0.001)));
        plate.setMatrixAt(c * LANES + s, M.compose(P, Q, S.setScalar(0.001)));
      };
      let nCol = 0;
      for (const rec of recs) {
        const age = Math.max(0, fl - rec.step - 1);
        const x = X_NOW - age * DX;
        const fade = Math.min(1, Math.max(0, (x - FADE) / 0.45));
        if (fade <= 0.02 || nCol >= NCOLS) continue;
        const bh = rec.B * CELL_H;
        P.set(x, (QY + BASE_Y) / 2, -0.07);
        colRail.setMatrixAt(nCol, M.compose(P, Q, S.set(1, RAILH, 1)));
        for (let s = 0; s < LANES; s++) off(nCol, s);
        rec.dec.forEach((l, i) => {
          const idx = nCol * LANES + i;
          if (idx >= NCOLS * LANES) return;
          const f = Math.max(fade, 0.001);
          decCell.setMatrixAt(idx, M.compose(P.set(x, laneY(l), 0.12), Q, S.setScalar(f)));
          plate.setMatrixAt(idx, M.compose(P.set(x, BASE_Y + (i + 0.5) * CELL_H, 0), Q, S.set(1, f, 1)));
        });
        const [e1, e2, e3] = edges[nCol];
        e3.position.set(x, BASE_Y + (bh * fade) / 2, 0);
        e3.scale.set(0.36 * fade, Math.max(0.001, bh * fade), 0.14 * fade);   // this step's budget
        if (rec.chunk) {
          const { lane, cells } = rec.chunk;
          const h = Math.max(0.015, cells * CELL_H * fade);
          const cy = BASE_Y + (rec.dec.length + cells / 2) * CELL_H;
          const ch = Math.max(0.02, (0.08 + 0.18 * (cells / rec.B)) * fade);
          preCell.setMatrixAt(nCol, M.compose(P.set(x, laneY(lane), 0.12), Q, S.set(0.3 * fade, ch, 0.2 * fade)));
          e1.position.set(x, laneY(lane), 0.12);
          e1.scale.set(0.3 * fade, ch, 0.2 * fade);
          gChunk.setMatrixAt(nCol, M.compose(P.set(x, cy, 0), Q, S.set(0.32 * fade, h, 0.14 * fade)));
          e2.position.set(x, cy, 0);
          e2.scale.set(0.32 * fade, h, 0.14 * fade);
        } else {
          preCell.setMatrixAt(nCol, M.compose(P, Q, S.setScalar(0.001)));
          gChunk.setMatrixAt(nCol, M.compose(P, Q, S.setScalar(0.001)));
          e1.scale.setScalar(0.001);
          e2.scale.setScalar(0.001);
        }
        nCol++;
      }
      while (nCol < NCOLS) {
        P.set(X_TAIL - 2, 0, 0);
        colRail.setMatrixAt(nCol, M.compose(P, Q, S.set(0.001, 0.001, 0.001)));
        for (let s = 0; s < LANES; s++) off(nCol, s);
        preCell.setMatrixAt(nCol, M.compose(P, Q, S.setScalar(0.001)));
        gChunk.setMatrixAt(nCol, M.compose(P, Q, S.setScalar(0.001)));
        for (const e of edges[nCol]) e.scale.setScalar(0.001);
        nCol++;
      }
      decCell.instanceMatrix.needsUpdate = preCell.instanceMatrix.needsUpdate = true;
      plate.instanceMatrix.needsUpdate = gChunk.instanceMatrix.needsUpdate = colRail.instanceMatrix.needsUpdate = true;

      out({
        playing, step: lastInt, running: nRun, queued: queue.length, used: newest ? newest.used : 0,
        B, maxSeqs, rate,
        readout: `step ${lastInt} · running ${nRun} · queued ${queue.length} · ${newest ? newest.used : 0}/${B} cells used`,
      });
    },

    action(name, arg) {
      if (name === 'play') { playing = typeof arg === 'boolean' ? arg : !playing; if (playing) stopAt = Infinity; }
      else if (name === 'step') stepReq = true;
      else if (name === 'seqs') maxSeqs = [2, 4, 6].includes(Number(arg)) ? Number(arg) : 4;
      else if (name === 'budget') B = [8, 16, 32].includes(Number(arg)) ? Number(arg) : 16;
      else if (name === 'rate') rate = String(arg) === 'high' ? 'high' : 'low';
    },
  };
}
