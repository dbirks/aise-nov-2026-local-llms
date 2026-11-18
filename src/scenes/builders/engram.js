// Scene `engram` — static learned n-gram memory (Engram / PLE): lookups per processed token,
// not per session. Scene-lab brainstorm; brief = README "Scene J" + "Scene S".
//
// Front: a ribbon of token tiles (x = token position). The dark bracket marks the *recent n-gram
// window* of the position being computed now; thin dark lines fan back to a vast, mostly inactive
// lookup table drawn as a city (40×24 toy rows). Selected rows rise and turn dark; each position's
// fused vector travels right into one layer's residual tube. The city is a *static weight tensor*:
// it arrives once at startup (the scale-up is drawn once and never replayed) and is not re-scanned.
//
// Modes: prefill = sweep many positions; decode = one new token per beat; cached prefix = the first
// 8 positions are dimmed and NOT recomputed, only the suffix is hashed — although the first suffix
// windows still read the cached token IDs (deterministic addressing across the boundary).
// 'hash collision' deliberately maps two different windows onto one bucket — with a toy table this
// is a property of hashing itself, not an implementation quirk.
//
// Everything is illustrative: 16 token positions, 960 rows, 2 orders, 2 hash heads, 5 layer plates,
// toy token IDs. No model specs, no selected-row counts from a real config, no latency/throughput.
import { THREE, lam, ghost, M, Q, P, S, ease, emitter } from './_kit.js';

// ── toy table (README Scene J: "label toy dimensions") ──────────────────────────────
const COLS = 40, ROWS = 24, CELLS = COLS * ROWS;
const TCX = -0.72, TCZ = -1.05, PX = 0.115, PZ = 0.082;
const CY = 0.0;                            // table plane height (the ribbon sits below it)
const CH0 = 0.075, CH1 = 0.42;             // row height: idle / selected

// ── token ribbon ───────────────────────────────────────────────────────────────────
const T = 16, DX = 0.3, RY = -2.0, RZ = 1.42, RX0 = -2.95;
const HEADS = 2;                            // hash heads per n-gram order (toy)

// ── residual tube (right) ──────────────────────────────────────────────────────────
const TX = 2.6, TZ = 0.1, TY0 = -2.0, TY1 = 2.7;
const LAY = [-1.3, -0.5, 0.3, 1.1, 1.9], TL = 2;   // 5 illustrative layers, one Engram layer

const cx = c => TCX + (c - (COLS - 1) / 2) * PX;
const cz = r => TCZ + (r - (ROWS - 1) / 2) * PZ;
const xOf = i => RX0 + i * DX;
const PERIOD = { prefill: 0.2, decode: 0.95, cache: 0.42 };

/** deterministic address from the token IDs in one n-gram window (toy hash, not Engram's real hash) */
function hash(g, head) {
  let h = 0x9e3779b9 ^ Math.imul(head + 1, 0x85ebca6b);
  for (let i = 0; i < g.length; i++) { h = (h ^ (g[i] + 0x76ab28)) >>> 0; h = Math.imul(h, 0x27d4eb2d); h ^= h >>> 15; }
  return (h >>> 0) % CELLS;
}

export default function build(scene, emit) {
  const out = emitter(emit);
  const tmp = new THREE.Color();
  const cLit = new THREE.Color(0x121212);
  // tile tones: upcoming / in the window now / computed earlier this run / cached prefix / cached+read
  const TONE = [0xe6e6e6, 0x161616, 0x9d9d9d, 0xc8c8c8, 0x767676].map(h => new THREE.Color(h));
  const cRow = new THREE.Color(0x9f9f9f);          // idle rows: visible but clearly inactive

  const cellX = new Float32Array(CELLS), cellZ = new Float32Array(CELLS);
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) { const i = r * COLS + c; cellX[i] = cx(c); cellZ[i] = cz(r); }
  const act = new Float32Array(CELLS), armed = new Float32Array(CELLS), floorv = new Float32Array(CELLS);

  /** short camera-facing label: dark text on transparent, bold monospace */
  const labels = [];
  const label = (text, x, y, z, h = 0.3) => {
    const cv = document.createElement('canvas'), F = 60;
    const g0 = cv.getContext('2d');
    g0.font = `bold ${F}px ui-monospace, monospace`;
    cv.width = Math.ceil(g0.measureText(text).width) + 20; cv.height = F + 16;
    const g = cv.getContext('2d');
    g.font = `bold ${F}px ui-monospace, monospace`;
    g.fillStyle = '#151515'; g.textBaseline = 'middle';
    g.fillText(text, 10, cv.height / 2 + 2);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, depthWrite: false }));
    sp.userData.k = [h * cv.width / cv.height, h];
    sp.scale.set(sp.userData.k[0], sp.userData.k[1], 1);
    sp.position.set(x, y, z);
    scene.add(sp); labels.push(sp);
    return sp;
  };

  // ── the table: ground plate + city of rows (one instance per row) ────────────────
  const city = new THREE.Group(); city.position.y = CY; scene.add(city);
  const spX = COLS * PX + 0.24, spZ = ROWS * PZ + 0.24;
  const base = new THREE.Mesh(new THREE.BoxGeometry(spX, 0.06, spZ), ghost(0xa9a9a9, 0.45));
  base.position.set(TCX, -0.085, TCZ);
  const baseEdge = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(spX, 0.1, spZ)),
    new THREE.LineBasicMaterial({ color: 0x7d7d7d }));
  baseEdge.position.copy(base.position);
  const cells = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), lam(0xffffff), CELLS);
  cells.frustumCulled = false;
  city.add(base, baseEdge, cells);

  // ── ribbon: token tiles + the n-gram bracket + the cached-prefix rail ────────────
  const tiles = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), lam(0xffffff), T);
  tiles.frustumCulled = false; scene.add(tiles);
  const rail = new THREE.Mesh(new THREE.BoxGeometry(1, 0.045, 0.16), lam(0x1d1d1d));
  rail.position.set(0, RY - 0.26, RZ); rail.scale.x = 0.001; scene.add(rail);
  const axis = new THREE.Mesh(new THREE.BoxGeometry(T * DX - 0.1, 0.035, 0.1), lam(0xc2c2c2));
  axis.position.set((RX0 + xOf(T - 1)) / 2, RY - 0.19, RZ); scene.add(axis);

  const brkL = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.52, 0.06), lam(0x141414));
  const brkR = brkL.clone();
  const brkTop = new THREE.Mesh(new THREE.BoxGeometry(1, 0.06, 0.06), lam(0x141414));
  scene.add(brkL, brkR, brkTop);
  const ghL = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.42, 0.05), lam(0x9a9a9a));
  const ghR = ghL.clone();
  scene.add(ghL, ghR);
  const flagPost = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.5, 0.035), lam(0x111111));
  const flagTop = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.11, 0.03), lam(0x111111));
  scene.add(flagPost, flagTop);

  // ── residual tube + layer plates (the Engram layer is dark + wide) ───────────────
  const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, TY1 - TY0, 12, 1, true), ghost(0x5f5f5f, 0.34));
  tube.position.set(TX, (TY0 + TY1) / 2, TZ); scene.add(tube);
  const caps = [TY0, TY1].map(y => {
    const c = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.05, 0.5), lam(0x8c8c8c));
    c.position.set(TX, y, TZ); scene.add(c); return c;
  });
  const plates = LAY.map((y, l) => {
    const t = l === TL;
    const m = new THREE.Mesh(new THREE.BoxGeometry(1, 0.05, 0.42), t ? lam(0x191919) : ghost(0x9a9a9a, 0.5));
    m.position.set(TX, y, TZ); m.scale.x = t ? 1.5 : 1; scene.add(m); return m;
  });
  const gatePlate = plates[TL];

  // ── hash lines (bracket → selected rows), fixed pool ────────────────────────────
  const LN = 12;
  const lPos = new Float32Array(LN * 6), lCol = new Float32Array(LN * 6);
  const lGeo = new THREE.BufferGeometry();
  lGeo.setAttribute('position', new THREE.BufferAttribute(lPos, 3));
  lGeo.setAttribute('color', new THREE.BufferAttribute(lCol, 3));
  const lines = new THREE.LineSegments(lGeo, new THREE.LineBasicMaterial({ vertexColors: true }));
  lines.frustumCulled = false; scene.add(lines);
  const links = Array.from({ length: LN }, () => ({ on: 0, ax: 0, ay: 0, az: 0, bx: 0, by: 0, bz: 0, g: 0, life: 0 }));

  // ── fused vectors (row → gate) + residual pulses rising in the tube ──────────────
  const VN = 12;
  const vecs = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), lam(0xffffff), VN);
  vecs.frustumCulled = false; scene.add(vecs);
  const parts = Array.from({ length: VN }, () => ({ on: 0, t: 0, ax: 0, ay: 0, az: 0, bx: 0, by: 0, bz: 0, cx: 0, cy: 0, cz: 0 }));
  const RN = 6;
  const risers = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), lam(0x2a2a2a), RN);
  risers.frustumCulled = false; scene.add(risers);
  const rises = Array.from({ length: RN }, () => ({ on: 0, t: 0 }));

  label('token ids', (RX0 + xOf(T - 1)) / 2, RY - 0.5, RZ);
  label('static table', TCX, CY + 0.6, TCZ - spZ / 2 + 0.2);
  label('residual', TX, TY1 + 0.34, TZ);
  const labCache = label('prefix cached', 0, RY + 0.5, RZ);

  // ── state ───────────────────────────────────────────────────────────────────────
  let mode = 'prefill', n = 3, collide = false, playing = true;
  let startup = 0, cursor = 1, filled = T, cached = 0;
  let timer = 0.3, hold = 0, done = 0, look = 0, collisions = 0;
  let shared = -1, sharedPos = -1, gate = 0;
  let bx0 = xOf(0), bx1 = xOf(n - 1);
  const ids = new Int32Array(T);
  const tc = Array.from({ length: T }, () => new THREE.Color(0xe4e4e4));
  const ts = new Float32Array(T).fill(1);
  const byPos = new Map();
  let seed = 11;
  const rand = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };

  // The run is stateful (which table rows each position armed, the fused residual, counters), so
  // 'back' rewinds one processed position by restoring the state recorded before that beat.
  const snaps = [];
  const snap = () => ({
    cursor, filled, done, look, collisions, shared, sharedPos, timer, hold,
    byPos: new Map([...byPos].map(([k, v]) => [k, v.slice()])),
    armed: armed.slice(), floorv: floorv.slice(),
  });
  function rewind() {
    const s = snaps.pop();
    if (!s) return;
    cursor = s.cursor; filled = s.filled; done = s.done; look = s.look; collisions = s.collisions;
    shared = s.shared; sharedPos = s.sharedPos; timer = s.timer; hold = s.hold;
    byPos.clear();
    for (const [k, v] of s.byPos) byPos.set(k, v.slice());
    armed.set(s.armed); floorv.set(s.floorv);
  }

  function newRun() {
    byPos.clear(); shared = -1; sharedPos = -1; done = 0; look = 0; collisions = 0;
    timer = 0.35; hold = 0;
    snaps.length = 0;
    if (mode === 'decode') { cached = 0; filled = 6; cursor = 6; }
    else if (mode === 'cache') { cached = 8; filled = T; cursor = 8; }
    else { cached = 0; filled = T; cursor = 1; }
    for (let i = 0; i < T; i++) ids[i] = 10 + Math.floor(rand() * 16);   // toy token IDs, small vocab
    armed.fill(0); act.fill(0); floorv.fill(0);
    for (const l of links) l.on = 0;
    for (const p of parts) p.on = 0;
    for (const r of rises) r.on = 0;
  }
  newRun();

  const spawnLink = (ax, ay, az, bx, by, bz, life) => {
    const l = links.find(k => !k.on) || links[0];
    Object.assign(l, { on: 1, ax, ay, az, bx, by, bz, g: 0, life });
  };
  const spawnVec = (ax, ay, az, bx, by, bz, cx2, cy2, cz2) => {
    const p = parts.find(k => !k.on) || parts[0];
    Object.assign(p, { on: 1, t: 0, ax, ay, az, bx, by, bz, cx: cx2, cy: cy2, cz: cz2 });
  };

  /** one processed position: hash its recent n-gram windows, light those rows, fuse them right */
  function process(p) {
    const picked = [];
    for (let o = 2; o <= n; o++) {                    // n-gram orders 2..n of the window (toy)
      const g = [];
      for (let i = Math.max(0, p - o + 1); i <= p; i++) g.push(ids[i]);
      if (g.length !== o) continue;               // not enough lookback yet → that order is skipped
      for (let hd = 0; hd < HEADS; hd++) picked.push(hash(g, hd));
    }
    if (!picked.length) return false;
    if (collide && p % 3 === 0) {                     // two different windows → one bucket (toy)
      const other = byPos.get(p - 2);
      if (other && other.length) {
        picked[picked.length - 1] = other[0];
        shared = other[0]; sharedPos = p - 2; collisions++;
      }
    }
    byPos.set(p, picked.slice());
    const ax = (xOf(Math.max(0, p - n + 1)) + xOf(p)) / 2, ay = RY + 0.06, az = RZ + 0.17;
    const h = CY + CH1 * 0.72;                       // world height of a lit row's top
    for (const ci of picked) {
      armed[ci] = 0.3;
      spawnLink(ax, ay, az, cellX[ci], h, cellZ[ci], collide && ci === shared ? 2.2 : 0.62);
      spawnVec(cellX[ci], h, cellZ[ci], (cellX[ci] + TX) / 2, Math.max(h, LAY[TL]) + 0.62, (cellZ[ci] + TZ) / 2,
        TX - 0.34, LAY[TL], TZ);
      if (ci === shared) floorv[ci] = 0.3;
    }
    look += picked.length; done++;
    return true;
  }

  function beat() {
    if (hold > 0) return;
    if (cursor > T - 1) { hold = 1.8; return; }
    snaps.push(snap());                                  // 'back' restores the state from before this beat
    if (snaps.length > 64) snaps.shift();
    process(cursor);
    cursor++;
    if (mode === 'decode' && filled < T) filled++;
    if (cursor > T - 1) hold = 1.8;
  }


  return {
    view: { target: [-0.15, 0.15, 0], radius: 40, theta: 0.36, phi: 1.12, size: 2.95 },
    update(dt) {
      if (playing) {
        if (startup < 1) startup = Math.min(1, startup + dt * 1.15);
        else if (hold > 0) { hold -= dt; if (hold <= 0) newRun(); }
        else { timer -= dt; while (timer <= 0 && hold <= 0) { beat(); timer += PERIOD[mode]; } }
      }
      const st = startup < 1 ? 0.05 + 0.95 * (1 - (1 - startup) ** 3) : 1;
      city.scale.set(1, Math.max(st, 0.001), 1);

      // rows: rise + darken while armed, then fall back (a shared bucket stays partly raised)
      for (let i = 0; i < CELLS; i++) {
        if (armed[i] > 0) { armed[i] -= dt; act[i] += (1 - act[i]) * ease(dt, 14); }
        else act[i] += (floorv[i] - act[i]) * ease(dt, 3.4);
        const a = act[i], h = CH0 + (CH1 - CH0) * a;
        P.set(cellX[i], h / 2 - 0.055, cellZ[i]); S.set(PX * 0.62, Math.max(h, 0.004), PZ * 0.62);
        cells.setMatrixAt(i, M.compose(P, Q, S));
        cells.setColorAt(i, tmp.copy(cRow).lerp(cLit, Math.min(1, a * 1.3)));
      }
      cells.instanceMatrix.needsUpdate = true;
      if (cells.instanceColor) cells.instanceColor.needsUpdate = true;

      // bracket = the n-gram window of the position being computed now
      const cp = Math.min(cursor, T - 1);
      const w0 = xOf(Math.max(0, cp - n + 1)) - 0.2, w1 = xOf(cp) + 0.2;
      bx0 += (w0 - bx0) * ease(dt, 9); bx1 += (w1 - bx1) * ease(dt, 9);
      const bs = startup >= 1 && cursor <= T - 1 ? 1 : 0.001;
      brkL.position.set(bx0, RY + 0.04, RZ + 0.16); brkL.scale.setScalar(bs);
      brkR.position.set(bx1, RY + 0.04, RZ + 0.16); brkR.scale.setScalar(bs);
      brkTop.position.set((bx0 + bx1) / 2, RY + 0.32, RZ + 0.16);
      brkTop.scale.set(Math.max(0.001, bx1 - bx0), bs, bs);

      // collision: the earlier window (grey) and the bucket both hash to (flag)
      const on = collide && shared >= 0 && sharedPos >= 0 && startup >= 1;
      const g0 = xOf(Math.max(0, sharedPos - n + 1)) - 0.15, g1 = xOf(sharedPos) + 0.15;
      ghL.position.set(on ? g0 : 0, RY + 0.02, RZ + 0.06); ghL.scale.setScalar(on ? 1 : 0.001);
      ghR.position.set(on ? g1 : 0, RY + 0.02, RZ + 0.06); ghR.scale.setScalar(on ? 1 : 0.001);
      const sx = shared >= 0 ? cellX[shared] : TCX, sz = shared >= 0 ? cellZ[shared] : TCZ;
      flagPost.position.set(sx, CY + 0.4, sz); flagPost.scale.set(1, on ? 1 : 0.001, 1);
      flagTop.position.set(sx, CY + 0.74, sz); flagTop.scale.setScalar(on ? 1 : 0.001);

      // tiles: lightest = not computed, dark = read by the bracket now, dim = cached prefix
      const win0 = cursor - n + 1;
      for (let i = 0; i < T; i++) {
        const exists = i < filled, inWin = cursor <= T - 1 && i >= win0 && i <= cp;
        let tone = 0;
        if (i < cached) tone = inWin && i < cursor ? 4 : 3;
        else if (i < cursor) tone = 2;
        else if (inWin) tone = 1;
        P.set(xOf(i), RY, RZ); S.set(0.25 * ts[i], 0.25 * ts[i], 0.13 * ts[i]);
        tiles.setMatrixAt(i, M.compose(P, Q, S));
        ts[i] += ((exists ? 1 : 0.001) - ts[i]) * ease(dt, exists ? 11 : 14);
        tc[i].lerp(TONE[tone], ease(dt, 8));
        tiles.setColorAt(i, tc[i]);
      }
      tiles.instanceMatrix.needsUpdate = true;
      if (tiles.instanceColor) tiles.instanceColor.needsUpdate = true;

      // cached-prefix rail + label
      const rl = mode === 'cache' && startup >= 1 ? cached * DX - 0.08 : 0.001;
      rail.scale.x += (rl - rail.scale.x) * ease(dt, 7);
      rail.position.x = (xOf(0) + xOf(cached - 1)) / 2;
      labCache.position.x = rail.position.x;
      const rv = mode === 'cache' && startup >= 1 ? 1 : 0.001;
      labCache.scale.set(labCache.userData.k[0] * rv, labCache.userData.k[1] * rv, 1);

      // hash lines: grow from the bracket to the row, then fade into the background
      for (let k = 0; k < LN; k++) {
        const l = links[k], o = k * 6;
        if (l.on) {
          l.g = Math.min(1, l.g + dt * 5.5); l.life -= dt;
          const fade = Math.max(0, Math.min(1, l.life * 2.2));
          if (l.life <= 0) l.on = 0;
          const e = l.g * l.g * (3 - 2 * l.g);
          lPos[o] = l.ax; lPos[o + 1] = l.ay; lPos[o + 2] = l.az;
          lPos[o + 3] = l.ax + (l.bx - l.ax) * e; lPos[o + 4] = l.ay + (l.by - l.ay) * e; lPos[o + 5] = l.az + (l.bz - l.az) * e;
          tmp.setHex(0xffffff).lerp(cLit, Math.max(0.05, fade));
          for (const j of [0, 3]) { lCol[o + j] = tmp.r; lCol[o + j + 1] = tmp.g; lCol[o + j + 2] = tmp.b; }
        } else { lPos[o] = lPos[o + 3] = 0; lPos[o + 1] = lPos[o + 4] = -99; lPos[o + 2] = lPos[o + 5] = 0; }
      }
      lGeo.attributes.position.needsUpdate = true;
      lGeo.attributes.color.needsUpdate = true;

      // vectors: row → gate (quadratic bezier); on arrival a residual pulse rises in the tube
      gate += (0 - gate) * ease(dt, 4);
      for (let k = 0; k < VN; k++) {
        const p = parts[k];
        if (p.on) {
          p.t += dt * 0.95;
          if (p.t >= 1) {
            p.on = 0; gate = 1;
            const r = rises.find(x => !x.on); if (r) { r.on = 1; r.t = 0; }
          } else {
            const u = p.t * p.t * (3 - 2 * p.t), iu = 1 - u;
            P.set(iu * iu * p.ax + 2 * iu * u * p.bx + u * u * p.cx,
              iu * iu * p.ay + 2 * iu * u * p.by + u * u * p.cy,
              iu * iu * p.az + 2 * iu * u * p.bz + u * u * p.cz);
            S.setScalar(0.15);
            vecs.setMatrixAt(k, M.compose(P, Q, S)); vecs.setColorAt(k, tmp.setHex(0x141414));
          }
        } else { P.set(0, -99, 0); S.setScalar(0.001); vecs.setMatrixAt(k, M.compose(P, Q, S)); }
      }
      vecs.instanceMatrix.needsUpdate = true;
      if (vecs.instanceColor) vecs.instanceColor.needsUpdate = true;

      for (let k = 0; k < RN; k++) {
        const r = rises[k];
        if (r.on) {
          const s = 1 - r.t;
          P.set(TX, LAY[TL] + 0.14 + r.t * 1.5, TZ);
          S.set(0.26 * s + 0.03, 0.11 * s + 0.02, 0.26 * s + 0.03);
          r.t += dt * 0.8; if (r.t >= 1) r.on = 0;
        } else { P.set(0, -99, 0); S.setScalar(0.001); }
        risers.setMatrixAt(k, M.compose(P, Q, S));
      }
      risers.instanceMatrix.needsUpdate = true;

      // the Engram layer takes the fused vector: a brief scale pulse (no colour tricks)
      gatePlate.scale.set(1.5 * (1 + gate * 0.4), 1 + gate * 4, 1 + gate * 0.5);
      const vs = startup >= 1 ? 1 : 0.001;
      for (const c of caps) c.scale.setScalar(vs);
      for (const l of labels) if (l !== labCache) l.scale.set(l.userData.k[0] * vs, l.userData.k[1] * vs, 1);

      let ro;
      if (startup < 1) ro = `startup · static table loaded once · ${COLS}×${ROWS} rows (toy)`;
      else if (mode === 'prefill') ro = `prefill · pos ${done}/${T - 1} hashed · ${look} lookups`;
      else if (mode === 'decode') ro = `decode · ${done} new positions · ${look} lookups` + (collide ? '' : ' · table resident');
      else ro = `cache hit · ${cached} skipped · ${done} new · ${look} lookups`;
      if (collide && startup >= 1 && collisions) ro += ` · ${collisions} shared bucket${collisions === 1 ? '' : 's'} (toy)`;
      out({
        playing, mode, n, collide, done, look, collisions, cached,
        readout: ro.length > 75 ? ro.slice(0, 74) : ro,
      });
    },
    action(name, arg) {
      if (name === 'play') { playing = !playing; timer = 0.1; }
      else if (name === 'step') {
        playing = false;
        if (startup < 1) startup = 1;
        else if (hold > 0) { hold = 0; newRun(); }
        else beat();
      }
      else if (name === 'back') { playing = false; startup = 1; rewind(); }
      else if (name === 'mode') { mode = PERIOD[String(arg)] ? String(arg) : 'prefill'; newRun(); }
      else if (name === 'ngram') { n = Number(arg) === 2 ? 2 : 3; newRun(); }
      else if (name === 'collision') {
        collide = !!arg;
        if (!collide) { shared = -1; sharedPos = -1; floorv.fill(0); collisions = 0; }
      }
    },
  };
}
