// Scene `kvcache` — the KV cache is a per-token bill (chapter 02 anchor, viz-audit M1).
//
// x = token position, y = layer (6 shelves), z = request lane (1–4). One small dark block is the
// K+V of one token in one layer for one request. Blocks are allocated in pages of 16 tokens: a
// light outline page appears, then fills dark as tokens arrive — paged allocation, not a
// preallocated full-length cache. The flat plate above the stack is the memory left after the
// weights; the meter column at the right edge fills as that budget is spent. Hitting the budget
// makes the newest request wait for memory (dims, stops growing). The two dark posts mark the
// *logical* max-model-len slice: it stops a request long before the budget when set low.
//
// Every number here is illustrative (see the slide notes). Sources: vLLM PagedAttention (Kwon et
// al., SOSP 2023); vLLM "Optimization and tuning" (cache sized from memory free after warmup);
// vLLM "Quantized KV cache" (fp8 KV is storage *and* can change what attention reads).
import { THREE, lam, ghost, M, Q, P, S, ease, emitter } from './_kit.js';

const LAYERS = 6;              // attention layers drawn (real models have many more — illustrative)
const LANES = 4;               // maximum concurrent requests
const SLOTS = 32;              // visible token positions
const PAGE = 16;               // tokens per allocated page

const DX = 0.17, BW = 0.105, BD = 0.66;   // token pitch, block width, block depth
const DY = 0.78, DZ = 1.2;                // layer pitch, lane pitch
const X0 = -2.85, Y0 = -0.35;             // first slot x, lowest shelf y
const W_TOP = -0.85, W_BOT = -1.4;        // weight slab = memory claimed first
const PLATE_Y = 4.15;                     // budget ceiling
const METER_X = 3.5, METER_W = 0.5;

const BH = { fp16: 0.3, fp8: 0.15 };      // block height ∝ bytes per token per layer
const BUDGET = 4.0;                       // "GiB-ish" left after weights (illustrative)
const BLOCK_F16 = BUDGET / 256;           // one fp16 block costs this much of the budget
const CAPS = { '1k': 8, '4k': 16, '16k': 32 };   // logical max-model-len → token slots
const TICK = 0.36;                        // one decode step

const xOf = i => X0 + i * DX;
const yOf = l => Y0 + l * DY;
const zOf = i => (i - (LANES - 1) / 2) * DZ;

export default function build(scene, emit) {
  const out = emitter(emit);
  const xMid = (X0 + xOf(SLOTS - 1)) / 2;

  // ── memory basin: weight slab, layer shelves, budget plate ───────────────
  const xSpan = (SLOTS - 1) * DX, zSpan = (LANES - 1) * DZ;
  const weights = new THREE.Mesh(new THREE.BoxGeometry(xSpan + 1.1, (W_TOP - W_BOT) * 0.7, zSpan + 1.5), lam(0x9a9a9a));
  const wH = (W_TOP - W_BOT) * 0.7;
  weights.position.set(xMid, W_TOP - wH / 2, 0);
  const plateW = xSpan + METER_W + 1.7;
  const plate = new THREE.Mesh(new THREE.BoxGeometry(plateW, 0.05, zSpan + 0.7), ghost(0x1a1a1a, 0.05));
  plate.position.set(xMid + 0.55, PLATE_Y, 0);
  const plateEdge = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(plateW, 0.18, zSpan + 0.7)),
    new THREE.LineBasicMaterial({ color: 0x111111 }));
  plateEdge.position.copy(plate.position);
  scene.add(weights, plate, plateEdge);
  for (let l = 0; l < LAYERS; l++) {
    const shelf = new THREE.Mesh(new THREE.BoxGeometry(xSpan + 0.5, 0.04, zSpan + 0.55), ghost(0x3a3a3a, 0.18));
    shelf.position.set(xMid, yOf(l) - BH.fp16 / 2 - 0.04, 0);
    scene.add(shelf);
  }

  // ── KV blocks: one instance per (request, layer, token) ──────────────────
  const N = LANES * LAYERS * SLOTS;
  const blocks = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), lam(0xffffff), N);
  blocks.frustumCulled = false;
  scene.add(blocks);
  const fill = new Float32Array(N);

  // outline of the page currently being written, one per (request, layer)
  const outlines = [];
  for (let i = 0; i < LANES * LAYERS; i++) {
    const o = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1)),
      new THREE.LineBasicMaterial({ color: 0x8a8a8a }));
    o.scale.setScalar(0.001);
    scene.add(o);
    outlines.push(o);
  }

  // request card at the left edge of every lane
  const cards = [];
  for (let i = 0; i < LANES; i++) {
    const c = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.26, 0.26), lam(0x141414));
    c.position.set(X0 - 0.52, yOf((LAYERS - 1) / 2) - 0.1, zOf(i));
    c.scale.setScalar(0.001);
    scene.add(c);
    cards.push(c);
  }

  // logical max-model-len: two dark posts marking the slice where a request must stop
  const capPosts = [];
  for (const z of [zOf(0) - 0.45, zOf(LANES - 1) + 0.45]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.05, PLATE_Y - W_TOP, 0.05), lam(0x111111));
    post.position.set(xOf(CAPS['16k'] - 1) + DX, (PLATE_Y + W_TOP) / 2, z);
    scene.add(post);
    capPosts.push(post);
  }

  // ── budget meter: weight top → budget plate ─────────────────────────────
  const mH = PLATE_Y - W_TOP;
  const meterEdge = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(METER_W, mH, METER_W)),
    new THREE.LineBasicMaterial({ color: 0x111111 }));
  meterEdge.position.set(METER_X, W_TOP + mH / 2, 0);
  const meterFill = new THREE.Mesh(new THREE.BoxGeometry(METER_W - 0.08, mH, METER_W - 0.08), lam(0x111111));
  meterFill.position.set(METER_X, W_TOP, 0);
  scene.add(meterEdge, meterFill);

  // ── state ───────────────────────────────────────────────────────────────
  const lanes = Array.from({ length: LANES }, (_, i) => ({
    on: false, tokens: 0, len: 12, stalled: false, stallT: 0, full: false, hold: 0, gap: 0.35 + i * 1.3,
    vis: 0.001, stallAmt: 0, fullAmt: 0,
  }));
  let prn = 7;
  const rand = () => { prn = (prn * 16807) % 2147483647; return (prn - 1) / 2147483646; };
  const newLen = () => 8 + Math.floor(rand() * 24);   // tokens this request will generate
  const cStall = new THREE.Color(0xbcbcbc), cFull = new THREE.Color(0x4a4a4a);
  // one luminance step per request lane, nearest lane darkest, so four lanes stay split in monochrome
  const cLane = Array.from({ length: LANES }, (_, i) => new THREE.Color(0x141414).lerp(new THREE.Color(0x555555), (LANES - 1 - i) * 0.34));
  const tmp = new THREE.Color();

  let want = 2, dtype = 'fp16', cap = '16k';
  let playing = true, acc = 0, stepReq = false, capX = capPosts[0].position.x, bh = BH.fp16;

  const cost = () => LAYERS * BLOCK_F16 * (dtype === 'fp8' ? 0.5 : 1);   // budget per token
  const used = () => lanes.reduce((a, L) => a + L.tokens, 0) * cost();
  const slotCap = () => Math.min(CAPS[cap], SLOTS);

  // 'back' rewinds one decode step. The sim is stateful (arrival timers, lengths, preemption), so
  // undo restores the lane states recorded before each step instead of trying to invert tick().
  const snaps = [];
  const snap = () => ({ prn, lanes: lanes.map(L => [L.on, L.tokens, L.len, L.stalled, L.stallT, L.full, L.hold, L.gap]) });
  function rewind() {
    const s = snaps.pop();
    if (!s) return;
    prn = s.prn;
    s.lanes.forEach((v, i) => {
      const L = lanes[i];
      [L.on, L.tokens, L.len, L.stalled, L.stallT, L.full, L.hold, L.gap] = v;
    });
  }

  function setRequests(n) {
    const prev = want;
    want = n;
    for (let i = 0; i < LANES; i++) {
      const L = lanes[i];
      if (i >= n) { L.on = false; L.tokens = 0; L.stalled = L.full = false; }
      else if (!L.on && i >= prev) L.gap = 0.3 + (i - prev) * 0.7;   // newly allowed lanes arrive, staggered
    }
  }
  // one decode step: every live request appends one token in every layer, oldest served first,
  // so the newest request is the one that runs out of memory. If nothing at all can be allocated,
  // one (the newest starved) request is preempted — its blocks are freed and it comes back later.
  function tick() {
    snaps.push(snap());
    if (snaps.length > 600) snaps.shift();
    let u = used(), progressed = false, starved = -1;
    for (let i = 0; i < want; i++) {
      const L = lanes[i];
      if (!L.on || L.full) continue;
      if (L.tokens >= Math.min(L.len, slotCap())) { L.full = true; L.stalled = false; L.stallT = 0; L.hold = 1.3; continue; }
      if (u + cost() <= BUDGET + 1e-9) {
        L.tokens++; u += cost(); L.stalled = false; L.stallT = 0; progressed = true;
      } else { L.stalled = true; L.stallT++; starved = i; }
    }
    if (!progressed && starved >= 0 && lanes[starved].stallT > 9) {
      const L = lanes[starved];
      L.on = false; L.tokens = 0; L.stalled = false; L.gap = 1.1;
      for (const o of lanes) o.stallT = 0;
    }
  }

  return {
    view: { target: [-0.1, 1.3, 0], radius: 40, theta: 0.62, phi: 1.12, size: 3.75 },
    update(dt) {
      if (playing) { acc += dt; while (acc >= TICK) { acc -= TICK; tick(); } }
      if (stepReq) { stepReq = false; tick(); }

      bh += (BH[dtype] - bh) * ease(dt, 6);
      capX += (xOf(slotCap() - 1) + DX - capX) * ease(dt, 7);

      let waiting = 0;
      for (let i = 0; i < LANES; i++) {          // request lifetime: arrive, hold a finished one, free it
        const L = lanes[i];
        if (i >= want) L.on = false;
        if (!L.on) {
          L.gap -= dt;
          if (L.gap <= 0 && i < want) { L.on = true; L.tokens = 0; L.len = newLen(); L.stalled = false; L.full = false; }
        } else if (L.full) {
          L.hold -= dt;
          if (L.hold <= 0) { L.on = false; L.tokens = 0; L.full = false; L.gap = 0.7; }   // blocks freed
        }
      }
      const uNow = used(), atCap = uNow + cost() > BUDGET + 1e-9;   // can anyone still be served?
      for (let i = 0; i < LANES; i++) {
        const L = lanes[i];
        L.vis += ((L.on ? 1 : 0.001) - L.vis) * ease(dt, L.on ? 9 : 13);
        L.stallAmt += ((L.on && L.stalled && atCap ? 1 : 0) - L.stallAmt) * ease(dt, 6);
        L.fullAmt += ((L.full ? 1 : 0) - L.fullAmt) * ease(dt, 6);
        if (L.on && L.stalled && atCap) waiting++;

        tmp.copy(cLane[i]).lerp(cStall, L.stallAmt).lerp(cFull, L.fullAmt * 0.5);
        for (let l = 0; l < LAYERS; l++) {
          const row = i * LAYERS + l, o = outlines[row];
          let shown = false;
          for (let j = 0; j < SLOTS; j++) {
            const idx = row * SLOTS + j, tgt = j < L.tokens ? L.vis : 0.001;
            fill[idx] += (tgt - fill[idx]) * ease(dt, tgt > fill[idx] ? 12 : 9);
            const s = Math.max(fill[idx], 0.001);
            P.set(xOf(j), yOf(l), zOf(i)); S.set(BW * s, bh * 0.9 * s, BD * s);
            blocks.setMatrixAt(idx, M.compose(P, Q, S));
            blocks.setColorAt(idx, tmp);
          }
          // the page being written: a light outline that the dark blocks then fill
          const s0 = Math.floor(L.tokens / PAGE) * PAGE;
          const end = Math.min(s0 + PAGE, slotCap(), SLOTS);
          if (L.on && !L.full && end > s0) {
            o.position.set((xOf(s0) + xOf(end - 1)) / 2, yOf(l), zOf(i));
            o.scale.set((end - s0) * DX - 0.06, bh + 0.09, BD + 0.12);
            shown = true;
          }
          if (!shown) o.scale.setScalar(0.001);
        }
        cards[i].scale.setScalar(Math.max(L.vis, 0.001));
        cards[i].material.color.copy(tmp);
      }
      blocks.instanceMatrix.needsUpdate = true;
      if (blocks.instanceColor) blocks.instanceColor.needsUpdate = true;

      const postAmt = want > 0 ? 1 : 0.001;
      const zNear = zOf(want - 1) + 0.45;
      capPosts[1].position.z += (zNear - capPosts[1].position.z) * ease(dt, 7);
      for (const post of capPosts) {
        post.position.x = capX;
        post.scale.set(postAmt, 1, postAmt);
      }

      const frac = Math.max(0.006, Math.min(1, uNow / BUDGET));
      meterFill.scale.set(1, frac, 1);
      meterFill.position.y = W_TOP + mH * frac / 2;

      const tok = lanes.reduce((a, L) => a + L.tokens, 0);
      out({
        playing, dtype, cap, requests: want, tok, waiting,
        readout: `kv ${uNow.toFixed(1)} / ${BUDGET.toFixed(1)} GiB-ish · ${want} request${want > 1 ? 's' : ''}`
          + ` · ${tok} tok` + (waiting ? ` · ${waiting} waiting` : ''),
      });
    },
    action(name, arg) {
      if (name === 'play') { playing = !playing; acc = 0; }
      else if (name === 'step') { playing = false; acc = 0; stepReq = true; }
      else if (name === 'back') { playing = false; acc = 0; stepReq = false; rewind(); }
      else if (name === 'requests') setRequests(Number(arg));
      else if (name === 'dtype') dtype = String(arg) === 'fp8' ? 'fp8' : 'fp16';
      else if (name === 'cap') cap = CAPS[String(arg)] ? String(arg) : '16k';
    },
  };
}
