// Scene `ssd-access` — why NVMe holds a PLE table, not the hot weights (scene-lab, README "Scene O").
//
// One SSD slab (bottom, 32-row toy PLE table) → a small staging buffer (middle) → the GPU block
// (top right). Two modes. 'dense reread' (wrong): one dark block = the whole weight set has to
// cross the SSD tier for EVERY token; it crawls up (progress bar), squeezes through the tiny
// staging plate (a metaphor for the mismatch), and meanwhile the GPU waits under a blinking dark
// stall marker. 'sparse rows' (right): each token hashes to 3–4 selected rows; those dark tiles
// hop SSD → staging slot → GPU while the token counter ticks along. A row counted as a cache hit
// spawns already staged (no SSD hop). prefetch 'on' issues each token's SSD reads one beat early
// so the stall marker never lights; 'off' serialises read-then-use. Hit ratio 0/50/90 % sets how
// often the SSD hop is needed at all.
//
// The rates in the readout are the Crucial P510 1 TB review unit's CrystalDiskMark figures from
// the README (SEQ1M Q8T1 10.97 GB/s vs RND4K Q1T1 74.75 MB/s) shown as a LABELLED SCENARIO, not a
// measurement of the real PLE workload (which may batch, coalesce, use OS caching and prefetch)
// and not convertible to tokens/s. All timings here are illustrative. Traffic always passes the
// staging buffer — there is no direct SSD↔GPU path.
import { THREE, lam, M, Q, P, S, rng, ease, emitter } from './_kit.js';

// ── toy table / layout ─────────────────────────────────────────────────────
const COLS = 16;                       // 32 illustrative table rows
const TX = c => -3.15 + c * 0.42;      // tile x by column
const tileXZ = r => [TX(r % COLS), r < COLS ? -0.3 : 0.3];
const TY = -1.7;                       // tile height (slab top ≈ -1.9)
const STG_Y = -0.35;
const SX = [-1.08, -0.36, 0.36, 1.08]; // staging slot x
const GX = 1.95, GY = 1.75;            // GPU block centre

// ── illustrative timings (seconds) ─────────────────────────────────────────
const H1 = 1.25, DW = 0.12, H2 = 0.3;                        // sparse: ssd→slot, dwell, slot→gpu
const B_PAUSE = 0.35, B_RISE = 2.0, B_TOP = 0.3, B_RISE2 = 2.2, B_SINK = 0.3;
const NT = 8;                                                // token-counter cells

const lerp = (a, b, u) => a + (b - a) * u;
const smooth = u => u * u * (3 - 2 * u);

/** short dark-on-transparent text sprite; set() redraws in place */
function mkLabel(text, h = 0.3) {
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthWrite: false, depthTest: false }));
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
    sp.scale.set(h * (w / 72), h, 1);
  };
  set(text);
  return { sprite: sp, set };
}

export default function build(scene, emit) {
  const out = emitter(emit);
  const rand = rng(202611);

  // ── SSD tier: slab + instanced row tiles ─────────────────────────────────
  const slab = new THREE.Mesh(new THREE.BoxGeometry(7.1, 0.3, 1.3), lam(0xa8a8a8));
  slab.position.set(0, -2.05, 0);
  const slabEdge = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(7.1, 0.3, 1.3)),
    new THREE.LineBasicMaterial({ color: 0x111111 }));
  slabEdge.position.copy(slab.position);
  scene.add(slab, slabEdge);

  const tiles = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), lam(0xffffff), 32);
  tiles.frustumCulled = false;
  scene.add(tiles);
  const cTileLo = new THREE.Color(0xd6d6d6), cTileHi = new THREE.Color(0x161616);
  const tmp = new THREE.Color();

  // ── staging buffer: plate + four slot cages ──────────────────────────────
  const plate = new THREE.Mesh(new THREE.BoxGeometry(2.9, 0.06, 0.8), lam(0xc6c6c6));
  plate.position.set(0, STG_Y, 0);
  scene.add(plate);
  const slots = [], occs = [];
  for (let i = 0; i < 4; i++) {
    const cage = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(0.58, 0.34, 0.66)),
      new THREE.LineBasicMaterial({ color: 0x4a4a4a }));
    cage.position.set(SX[i], STG_Y + 0.2, 0);
    const occ = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.16, 0.5), lam(0x161616));
    occ.position.set(SX[i], STG_Y + 0.13, 0);
    occ.scale.setScalar(0.001);
    scene.add(cage, occ);
    slots.push(cage); occs.push(occ);
  }

  // ── GPU block + token counter + stall marker ─────────────────────────────
  const gpu = new THREE.Mesh(new THREE.BoxGeometry(1.45, 0.8, 0.95), lam(0x242424));
  gpu.position.set(GX, GY, 0);
  const gpuEdge = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1.45, 0.8, 0.95)),
    new THREE.LineBasicMaterial({ color: 0x111111 }));
  gpuEdge.position.copy(gpu.position);
  scene.add(gpu, gpuEdge);

  const ticks = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), lam(0xffffff), NT);
  ticks.frustumCulled = false;
  scene.add(ticks);
  const cTickLo = new THREE.Color(0xd6d6d6), cTickHi = new THREE.Color(0x161616);

  const stall = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), lam(0x111111));
  stall.position.set(0.78, GY, 0);
  stall.scale.setScalar(0.001);
  scene.add(stall);

  // ── dense "all weights" block + progress bar ─────────────────────────────
  const bigBlock = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), lam(0x1b1b1b));
  scene.add(bigBlock);

  const barRail = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(5.0, 0.12, 0.24)),
    new THREE.LineBasicMaterial({ color: 0x4a4a4a }));
  barRail.position.set(-0.9, -2.6, 0);
  const barFill = new THREE.Mesh(new THREE.BoxGeometry(1, 0.07, 0.18), lam(0x141414));
  scene.add(barRail, barFill);

  // ── row packets (sparse transfers) ───────────────────────────────────────
  const NPK = 8;
  const packets = new THREE.InstancedMesh(new THREE.BoxGeometry(0.28, 0.09, 0.26), lam(0x161616), NPK);
  packets.frustumCulled = false;
  scene.add(packets);

  // ── labels ───────────────────────────────────────────────────────────────
  const labels = [];
  const place = (text, x, y, h) => {
    const l = mkLabel(text, h);
    l.sprite.position.set(x, y, 0);
    scene.add(l.sprite);
    labels.push(l);
    return l;
  };
  const labWait = place('wait', 0.32, GY + 0.1, 0.26);
  const labTok = place('tokens', 2.42, GY + 0.82, 0.26);
  const labWeights = place('all weights', 0, -0.85, 0.3);
  place('nvme', 2.75, -2.6, 0.28);
  place('staging', -2.35, -0.12, 0.28);
  place('gpu', 1.02, GY + 0.62, 0.28);

  // ── state ────────────────────────────────────────────────────────────────
  let playing = true, mode = 'sparse', prefetch = true, hitPct = 50;
  let simT = 0, tokens = 0, stepReq = false;
  let active = [], slotCur = 0;                     // in-flight sparse tokens
  let densePhase = 'pause', densePT = 0;
  let blockX = 0, blockY = -1.38, blockW = 6.9, absorb = 0;
  const tileLit = new Float32Array(32), tileVis = new Float32Array(32);
  const occ = [0, 0, 0, 0], occVis = [0, 0, 0, 0];
  let stallAmt = 0, barVal = 0, railAmt = 0.001, denseAmt = 0, gpuPulse = 0;

  function reset() {
    active = []; tokens = 0; slotCur = 0;
    densePhase = 'pause'; densePT = 0; absorb = 0;
    blockX = 0; blockY = -1.38; blockW = 6.9;
    tileLit.fill(0);
  }

  function launchToken() {
    const t0 = simT;
    const n = rand() < 0.4 ? 4 : 3;                 // 3–4 hashed rows per token
    const picked = new Set();
    while (picked.size < n) picked.add(Math.floor(rand() * 32));
    let fireAt = t0, hasMiss = false;
    const rows = [...picked].map(r => {
      const hit = rand() * 100 < hitPct;
      const slot = slotCur++ % 4;
      if (!hit) { hasMiss = true; tileLit[r] = 1; fireAt = Math.max(fireAt, t0 + H1 + DW + H2); }
      else fireAt = Math.max(fireAt, t0 + H2);
      return { r, hit, slot };
    });
    active.push({ t0, rows, fireAt, hasMiss });
  }

  let stallTarget = 0, barProg = 0;

  function advance(dt) {
    simT += dt;
    if (mode === 'dense') {
      densePT += dt;
      if (densePhase === 'pause') {
        blockX = 0; blockY = -1.38; blockW = 6.9; absorb = 0; barProg = 0;
        if (densePT >= B_PAUSE) { densePhase = 'rise'; densePT = 0; }
      } else if (densePhase === 'rise') {
        const u = Math.min(1, densePT / B_RISE);
        blockY = lerp(-1.38, -0.3, u); blockX = 0; blockW = lerp(6.9, 2.9, smooth(u));
        barProg = 0.42 * u;
        if (u >= 1) { densePhase = 'top'; densePT = 0; }
      } else if (densePhase === 'top') {
        barProg = 0.42 + 0.08 * Math.min(1, densePT / B_TOP);
        if (densePT >= B_TOP) { densePhase = 'rise2'; densePT = 0; }
      } else if (densePhase === 'rise2') {
        const u = Math.min(1, densePT / B_RISE2);
        blockY = lerp(-0.3, GY - 0.05, u); blockX = u * GX; blockW = lerp(2.9, 6.9, smooth(u));
        barProg = 0.5 + 0.5 * u;
        if (u >= 1) { densePhase = 'sink'; densePT = 0; }
      } else {                                          // sink: absorbed by the GPU
        absorb = Math.min(1, densePT / B_SINK);
        barProg = 1;
        if (densePT >= B_SINK) { tokens++; gpuPulse = 1; densePhase = 'pause'; densePT = 0; }
      }
      stallTarget = (densePhase === 'rise' || densePhase === 'top' || densePhase === 'rise2') ? 1 : 0;
      return;
    }

    // sparse: fire completed tokens, then keep the pipeline fed
    for (let i = active.length - 1; i >= 0; i--) {
      if (simT >= active[i].fireAt) {
        for (const w of active[i].rows) if (!w.hit) tileLit[w.r] = 0;
        active.splice(i, 1); tokens++; gpuPulse = 1;
      }
    }
    const room = active.length < (prefetch ? 2 : 1);
    const due = prefetch ? (active.length === 0 || simT - (active[active.length - 1].t0) >= H1) : true;
    if (room && due) launchToken();
    const old = active[0];
    stallTarget = !prefetch && old && old.hasMiss && simT < old.fireAt ? 1 : 0;
  }

  // packet position from the row's schedule; null = not in flight
  const pv = new THREE.Vector3();
  function seg(ax, ay, az, bx, by, bz, u, hop) {
    const s = smooth(u);
    pv.set(lerp(ax, bx, s), lerp(ay, by, s) + (hop ? Math.sin(Math.PI * u) * 0.16 : 0), lerp(az, bz, s));
    return pv;
  }
  function packetPos(w, t) {
    const [tx, tz] = tileXZ(w.r), sx = SX[w.slot], sy = STG_Y + 0.16;
    const gx = GX - 0.18 + w.slot * 0.1, gy = GY - 0.47;
    if (w.hit) return t < H2 ? seg(sx, sy, 0, gx, gy, 0, t / H2, true) : null;
    if (t < H1) return seg(tx, TY + 0.12, tz, sx, sy, 0, t / H1, true);
    if (t < H1 + DW) { pv.set(sx, sy, 0); return pv; }
    const u = (t - H1 - DW) / H2;
    return u < 1 ? seg(sx, sy, 0, gx, gy, 0, u, true) : null;
  }

  return {
    view: { target: [0, 0.1, 0], radius: 40, theta: 0.55, phi: 1.12, size: 3.6 },
    update(dt) {
      if (playing) advance(dt);
      if (stepReq) {
        stepReq = false;
        const n0 = tokens;
        for (let g = 0; g < 640 && tokens === n0; g++) advance(1 / 60);   // advance one full beat
      }
      const dense = mode === 'dense';
      railAmt += ((dense ? 1 : 0.001) - railAmt) * ease(dt, 7);
      denseAmt += ((dense ? 1 : 0.001) - denseAmt) * ease(dt, 7);
      stallAmt += (stallTarget - stallAmt) * ease(dt, 8);
      gpuPulse += (0 - gpuPulse) * ease(dt, 5);
      barVal += (barProg - barVal) * ease(dt, 9);

      // row tiles: freshly-read rows go dark and pop, then fade back
      for (let i = 0; i < 32; i++) {
        tileVis[i] += (tileLit[i] - tileVis[i]) * ease(dt, tileLit[i] > tileVis[i] ? 14 : 3);
        const [x, z] = tileXZ(i);
        const k = 1 + 0.55 * tileVis[i];
        P.set(x, TY + 0.03 * tileVis[i], z); S.set(0.3 * k, 0.14 * k, 0.26 * k);
        tiles.setMatrixAt(i, M.compose(P, Q, S));
        tiles.setColorAt(i, tmp.copy(cTileLo).lerp(cTileHi, tileVis[i]));
      }
      tiles.instanceMatrix.needsUpdate = true;
      if (tiles.instanceColor) tiles.instanceColor.needsUpdate = true;

      // sparse packets ride their schedules through the staging slots
      let pi = 0;
      occ.fill(0);
      for (const tok of active) {
        for (const w of tok.rows) {
          const pos = packetPos(w, simT - tok.t0);
          if (!pos) continue;
          if (pi < NPK) { packets.setMatrixAt(pi++, M.compose(pos, Q, S.set(1, 1, 1))); }
          const t = simT - tok.t0;
          if (w.hit ? t < 0.1 : (t >= H1 - 0.08 && t <= H1 + DW)) occ[w.slot] = 1;
        }
      }
      for (let i = pi; i < NPK; i++) packets.setMatrixAt(i, M.compose(P.set(0, 9, 0), Q, S.set(0.001, 0.001, 0.001)));
      packets.instanceMatrix.needsUpdate = true;
      for (let i = 0; i < 4; i++) {
        occVis[i] += (occ[i] - occVis[i]) * ease(dt, occ[i] > occVis[i] ? 16 : 6);
        occs[i].scale.set(Math.max(0.001, occVis[i]), Math.max(0.001, occVis[i]), Math.max(0.001, occVis[i]));
      }

      // dense block + progress bar
      const bs = Math.max(0.001, 1 - absorb);
      bigBlock.position.set(blockX, blockY, 0);
      bigBlock.scale.set(Math.max(0.001, blockW * bs * denseAmt), 0.5 * bs * denseAmt, 0.95 * bs * denseAmt);
      labWeights.sprite.position.set(blockX, blockY + 0.55, 0);
      labWeights.sprite.visible = denseAmt > 0.5 && densePhase !== 'sink';
      barFill.position.set(-3.4 + 2.5 * barVal * railAmt, -2.6, 0);
      barFill.scale.set(Math.max(0.001, 5 * barVal * railAmt), railAmt, railAmt);
      barRail.scale.setScalar(railAmt);

      // GPU pulse + stall blink + token counter
      const gs = 1 + 0.06 * gpuPulse;
      gpu.scale.setScalar(gs); gpuEdge.scale.setScalar(gs);
      const blink = 0.5 + 0.5 * Math.sin(simT * 11);
      stall.scale.setScalar(Math.max(0.001, stallAmt * (0.16 + 0.16 * blink)));
      labWait.sprite.visible = stallAmt > 0.45;
      const filled = tokens % NT;
      for (let i = 0; i < NT; i++) {
        P.set(2.85, GY - 0.6 + i * 0.17, 0);
        S.setScalar(0.13 * (1 + (i === (tokens - 1) % NT ? gpuPulse * 0.9 : 0)));
        ticks.setMatrixAt(i, M.compose(P, Q, S));
        ticks.setColorAt(i, tmp.copy(cTickLo).lerp(cTickHi, i < filled || (tokens >= NT && filled === 0) ? 1 : 0));
      }
      ticks.instanceMatrix.needsUpdate = true;
      if (ticks.instanceColor) ticks.instanceColor.needsUpdate = true;

      out({
        playing, mode, prefetch, hit: hitPct,
        readout: dense
          ? 'scenario: p510 seq1m q8t1 10.97 gb/s · rereading all weights per tok'
          : `scenario: p510 rnd4k q1t1 74.75 mb/s · hit ${hitPct}% · prefetch ${prefetch ? 'on' : 'off'}`,
      });
    },
    action(name, arg) {
      if (name === 'play') playing = !playing;
      else if (name === 'step') { playing = false; stepReq = true; }
      else if (name === 'mode') { const m = String(arg) === 'dense' ? 'dense' : 'sparse'; if (m !== mode) { mode = m; reset(); } }
      else if (name === 'prefetch') prefetch = !!(arg === undefined ? !prefetch : arg === true || arg === 'true' || arg === 1 || arg === '1');
      else if (name === 'hit') hitPct = [0, 50, 90].includes(Number(arg)) ? Number(arg) : 50;
    },
  };
}
