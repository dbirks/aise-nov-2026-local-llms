// Scene `decode-pass` — one decode pass, from memory to token (README "Scene F" brainstorm).
//
// A schematic GPU card: a light memory slab at the back carrying, per layer row, a strip of FFN
// weight tiles + one attention-weight tile and a row of stored KV blocks; a row of compute cores
// at the front; six layer plates stacked above. One generated token walks the tower:
// embedding → per layer, its weight tiles stream down as dark packets from the slab to the cores
// (dense: all 8 FFN tiles stream; MoE: only 2 of 8 dim expert tiles are selected and only those
// stream), its query reads the already-stored KV blocks (read packets + row flash), the residual
// cube rises one plate → repeat → at the top, logits bars grow and one token is sampled (winner
// bar goes dark) → the new token appends one KV block per layer, then the pass loops.
//
// Representative byte traffic, NOT a per-transistor GPU simulator (README Scene F correctness):
// weights are resident in the slab and are re-READ every token — packets show bytes fetched, not
// weight files moving into VRAM. Everything numeric is illustrative; see slide notes.
import { THREE, lam, ghost, M, Q, P, S, ease, emitter } from './_kit.js';

const LAYERS = 6;                    // layers drawn (real models have dozens — illustrative)
const EXPERTS = 8;                   // FFN/expert tiles per layer row
const KVN = 7;                       // KV blocks per layer row (6 stored + 1 appended this pass)
const CORES = 5;
const BARS = 7;                      // logits bars (real vocab is ~10^5 — illustrative)

// ── timeline, seconds; every visual is a pure function of T so 'step' just moves T ──
const LT = 1.15;                     // one layer's beat
const E0 = 0.9;                      // end of embedding
const L0 = E0, L1 = E0 + LAYERS * LT;
const G0 = L1, G1 = G0 + 1.5;        // logits + sampling
const A0 = G1, A1 = A0 + 1.6;        // kv append
const LOOP = A1 + 0.7;               // hold, then the next token repeats the walk
const BEATS = [E0, ...Array.from({ length: LAYERS }, (_, l) => L0 + (l + 1) * LT), G1, A1, LOOP];
const SAMPLE_T = G0 + 1.05;

// ── geometry anchors (slide units, centred near the view target) ──────────────
const yOf = l => -1.4 + l * 0.78;    // layer-plate height
const tileX = i => -0.86 + i * 0.42; // expert tiles on the slab
const ATTN_X = -1.62;                // attention-weight tile
const kvX = j => -3.62 + j * 0.24;   // KV block row on the slab
const coreX = i => -0.6 + i * 0.75;
const barX = k => -0.55 + k * 0.42;
const CORE_Y = -2.1;
const BAR_BASE = 3.4;
const TOWER_X = 0.62;                // residual column
const Z_WALL = -1.7, Z_MOUNT = -1.5, Z_TOWER = 0.1, Z_FRONT = 1.15;

const cDark = new THREE.Color(0x121212), cInk = new THREE.Color(0x161616);
const cTileOn = new THREE.Color(0x212121), cTileOff = new THREE.Color(0xc6c6c6);
const cCoreIdle = new THREE.Color(0x9f9f9f);
const cKv = new THREE.Color(0x787878), cKvRead = new THREE.Color(0x101010);
const cNew = new THREE.Color(0x141414);
const tmp = new THREE.Color(), tmp2 = new THREE.Color();

const clamp01 = v => (v < 0 ? 0 : v > 1 ? 1 : v);
const seg = (t, a, b) => clamp01((t - a) / (b - a));
const inOut = p => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);
// which 2 experts each layer's router picks (fixed pattern — illustrative)
const selOf = l => [(l * 3 + 1) % EXPERTS, (l * 3 + 5) % EXPERTS];

const BAR_H = [0.28, 0.5, 0.85, 0.4, 0.25, 0.65, 0.35];   // illustrative logit heights

export default function build(scene, emit) {
  const out = emitter(emit);

  /** short camera-facing label: dark text on transparent (background is the lightest tone).
   *  Canvas width is budgeted per character, not from measureText: a missing ui-monospace
   *  fallback can measure narrower than it draws, clipping the tail of the word. */
  const label = (text, h) => {
    const fpx = 60, f = `bold ${fpx}px ui-monospace, monospace`;
    const cv = document.createElement('canvas'), g0 = cv.getContext('2d');
    g0.font = f;
    cv.width = Math.ceil(Math.max(g0.measureText(text).width, text.length * fpx * 0.84)) + 28;
    cv.height = fpx + 18;
    const g = cv.getContext('2d');
    g.font = f; g.fillStyle = '#151515'; g.textBaseline = 'middle';
    g.fillText(text, 14, cv.height / 2 + 1);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, depthWrite: false }));
    sp.scale.set(h * cv.width / cv.height, h, 1);
    sp.renderOrder = 10;
    scene.add(sp);
    return sp;
  };

  // ── the card: base floor + back memory slab ────────────────────────────────
  const floor = new THREE.Mesh(new THREE.BoxGeometry(7.9, 0.14, 3.6), lam(0xdadada));
  floor.position.set(-0.45, -2.42, -0.15);
  const wall = new THREE.Mesh(new THREE.BoxGeometry(7.7, 6.9, 0.2), lam(0xd2d2d2));
  wall.position.set(-0.5, 1.05, Z_WALL);
  const wallEdge = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(7.7, 6.9, 0.2)),
    new THREE.LineBasicMaterial({ color: 0x111111 }));
  wallEdge.position.copy(wall.position);
  scene.add(floor, wall, wallEdge);

  // ── weight tiles (experts + one attention tile per layer), instanced ───────
  const NT = LAYERS * (EXPERTS + 1);
  const tiles = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), lam(0xffffff), NT);
  tiles.frustumCulled = false;
  scene.add(tiles);
  const selAmt = new Float32Array(LAYERS * EXPERTS);   // smooth dense↔moe selection

  // ── KV blocks per layer row ────────────────────────────────────────────────
  const NK = LAYERS * KVN;
  const kv = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), lam(0xffffff), NK);
  kv.frustumCulled = false;
  scene.add(kv);

  // ── travelling packets (weight streams, kv reads, kv append), one pool ─────
  const NP = 24;
  const packets = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), lam(0xffffff), NP);
  packets.frustumCulled = false;
  scene.add(packets);

  // ── compute cores ──────────────────────────────────────────────────────────
  const rail = new THREE.Mesh(new THREE.BoxGeometry(3.9, 0.1, 0.7), lam(0xb4b4b4));
  rail.position.set(0.9, CORE_Y - 0.32, Z_FRONT);
  scene.add(rail);
  const cores = [];
  for (let i = 0; i < CORES; i++) {
    const c = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.46, 0.58), lam(0x9f9f9f));
    c.position.set(coreX(i), CORE_Y, Z_FRONT);
    scene.add(c);
    cores.push(c);
  }

  // ── layer plates ───────────────────────────────────────────────────────────
  const plateEdges = [];
  for (let l = 0; l < LAYERS; l++) {
    const g = new THREE.BoxGeometry(4.5, 0.04, 2.9);
    const plate = new THREE.Mesh(g, ghost(0x2a2a2a, 0.09));
    plate.position.set(0.6, yOf(l), Z_TOWER);
    const e = new THREE.LineSegments(new THREE.EdgesGeometry(g), new THREE.LineBasicMaterial({ color: 0x8f8f8f }));
    e.position.copy(plate.position);
    scene.add(plate, e);
    plateEdges.push(e);
  }

  // ── residual cube ──────────────────────────────────────────────────────────
  const resid = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.34, 0.34), lam(0x141414));
  resid.position.set(TOWER_X, yOf(0), Z_TOWER);
  resid.scale.setScalar(0.001);
  scene.add(resid);

  // ── logits bars ────────────────────────────────────────────────────────────
  const bars = [];
  for (let k = 0; k < BARS; k++) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.24, 1, 0.24), lam(0x555555));
    b.position.set(barX(k), BAR_BASE + 0.02, Z_TOWER);
    b.scale.y = 0.01;
    scene.add(b);
    bars.push(b);
  }

  // ── labels (kept well inside the wall/floor: thin dark text vanishes over the lightest tone) ──
  label('kv cache', 0.28).position.set(-2.85, 3.7, Z_MOUNT + 0.06);
  label('weights', 0.28).position.set(1.55, 3.72, Z_MOUNT + 0.06);
  label('cores', 0.28).position.set(3.0, -2.18, Z_FRONT + 0.55);
  label('logits', 0.28).position.set(2.5, 4.12, Z_MOUNT + 0.06);

  // ── state ──────────────────────────────────────────────────────────────────
  let T = 0, playing = true, arch = 'dense', stepTo = null, stepWrap = false;

  function pushPacket(pk, sx, sy, sz, dx, dy, dz, p, size, col) {
    const s = p > 0 && p < 1 ? size * Math.min(1, Math.min(p, 1 - p) * 9) : 0.001;
    P.set(sx + (dx - sx) * p, sy + (dy - sy) * p - 0.16 * Math.sin(Math.PI * p), sz + (dz - sz) * p);
    S.set(s, s, s);
    packets.setMatrixAt(pk, M.compose(P, Q, S));
    packets.setColorAt(pk, col);
  }

  return {
    view: { target: [-0.4, 1.0, 0], radius: 40, theta: 0.6, phi: 1.18, size: 4.35 },
    update(dt) {
      if (playing) T = (T + dt) % LOOP;
      else if (stepTo !== null) {
        T += dt * 4.5;
        if (T >= stepTo) { T = stepWrap ? 0 : stepTo; stepTo = null; stepWrap = false; }
      }

      // which layer's beat is running (pure function of T)
      let al = -1, au = 0;
      if (T >= L0 && T < L1) { al = Math.floor((T - L0) / LT); au = (T - L0) / LT - al; }
      const streamPct = al >= 0 ? Math.round(Math.min(1, au / 0.4) * 100) : 100;

      // ── weight tiles ──────────────────────────────────────────────────────
      let pk = 0;
      for (let l = 0; l < LAYERS; l++) {
        const isActive = l === al;
        const s0 = selOf(l);   // this layer's router picks, always shown when in MoE mode
        const wr = isActive && au >= 0.42 && au < 0.72 ? Math.sin(Math.PI * seg(au, 0.42, 0.72)) : 0;
        for (let i = 0; i < EXPERTS; i++) {
          const idx = l * EXPERTS + i;
          const on = arch === 'dense' || i === s0[0] || i === s0[1];
          selAmt[idx] += ((on ? 1 : 0) - selAmt[idx]) * ease(dt, 6);
          tmp.copy(cTileOff).lerp(cTileOn, selAmt[idx]);
          if (isActive && on && au < 0.5) tmp.lerp(cInk, 0.55 * seg(au, 0, 0.5));   // source glows while streaming
          const x = tileX(i), y = yOf(l);
          P.set(x, y, Z_MOUNT); S.set(0.34, 0.3, 0.13);
          tiles.setMatrixAt(l * (EXPERTS + 1) + i, M.compose(P, Q, S));
          tiles.setColorAt(l * (EXPERTS + 1) + i, tmp);
          // stream this tile's bytes while its layer runs
          if (isActive && on) {
            const n = arch === 'dense' ? EXPERTS : 2;
            const k = arch === 'dense' ? i : (i === s0[0] ? 0 : 1);
            const start = 0.4 * (k / n), p = seg(au / 0.4, start, start + 0.6);
            pushPacket(pk++, x, y, Z_MOUNT + 0.05, coreX(k % CORES), CORE_Y + 0.34, Z_FRONT - 0.2, p, 0.17, cDark);
          }
        }
        // attention-weight tile: always active, streams with the beat
        tmp.copy(cTileOn).lerp(cInk, isActive && au < 0.5 ? 0.55 * seg(au, 0, 0.5) : 0);
        P.set(ATTN_X, yOf(l), Z_MOUNT); S.set(0.4, 0.44, 0.13);
        tiles.setMatrixAt(l * (EXPERTS + 1) + EXPERTS, M.compose(P, Q, S));
        tiles.setColorAt(l * (EXPERTS + 1) + EXPERTS, tmp);
        if (isActive) {
          const p = seg(au / 0.4, 0, 0.6);
          pushPacket(pk++, ATTN_X, yOf(l), Z_MOUNT + 0.05, coreX(2), CORE_Y + 0.34, Z_FRONT - 0.2, p, 0.19, cDark);
        }
        // ── KV row: stored blocks dim-dark, flash when this layer reads them
        for (let j = 0; j < KVN; j++) {
          const idx = l * KVN + j;
          const isNew = j === KVN - 1;
          let s = 0.21, y = yOf(l);
          if (isNew) {
            const ua = T - A0, st = 0.06 * l;
            s = 0.21 * seg(ua, st + 0.5, st + 0.72);          // appears as the append packet lands
          }
          tmp.copy(cKv);
          if (isNew) tmp.copy(cNew);
          else if (wr > 0 && j > 0) tmp.lerp(cKvRead, wr);
          P.set(kvX(j), y + 0.11 * s, Z_MOUNT + 0.1);
          S.set(s * 0.9, s * 1.6, s * 0.9);
          kv.setMatrixAt(idx, M.compose(P, Q, S));
          kv.setColorAt(idx, tmp);
        }
        // append packet for this layer, during the append phase
        if (T >= A0 && T < A1) {
          const ua = T - A0, st = 0.06 * l, p = seg(ua, st, st + 0.7);
          pushPacket(pk++, TOWER_X, 2.85, Z_TOWER, kvX(KVN - 1), yOf(l) + 0.2, Z_MOUNT + 0.1, p, 0.16, cDark);
        }
        // kv-read packets: three stored blocks stream to the cores
        if (isActive && au >= 0.42 && au < 0.66) {
          tmp2.setHex(0x3c3c3c);
          for (const [n2, j] of [[0, 1], [1, 3], [2, 5]]) {
            const p = seg((au - 0.42) / 0.24, 0.3 * (n2 / 3), 0.3 * (n2 / 3) + 0.7);
            pushPacket(pk++, kvX(j), yOf(l) + 0.2, Z_MOUNT + 0.15, coreX(1 + n2), CORE_Y + 0.34, Z_FRONT - 0.2, p, 0.14, tmp2);
          }
        }
      }
      for (; pk < NP; pk++) { P.set(0, -9, 0); S.setScalar(0.001); packets.setMatrixAt(pk, M.compose(P, Q, S)); }
      tiles.instanceMatrix.needsUpdate = true;
      kv.instanceMatrix.needsUpdate = true;
      packets.instanceMatrix.needsUpdate = true;
      if (tiles.instanceColor) tiles.instanceColor.needsUpdate = true;
      if (kv.instanceColor) kv.instanceColor.needsUpdate = true;
      if (packets.instanceColor) packets.instanceColor.needsUpdate = true;

      // ── cores: darken while the active layer computes ─────────────────────
      const pulse = al >= 0 && au >= 0.38 && au <= 0.72 ? Math.sin(Math.PI * seg(au, 0.38, 0.72)) : 0;
      for (const c of cores) c.material.color.copy(cCoreIdle).lerp(cInk, pulse);

      // ── active layer plate edge ───────────────────────────────────────────
      plateEdges.forEach((e, l) => e.material.color.setHex(l === al ? 0x111111 : 0x8f8f8f));

      // ── residual cube: embed → climb plate by plate → sampled away ────────
      let ry = yOf(0), rs = 0.001;
      if (T < E0) {
        ry = CORE_Y + seg(T, 0.1, E0) * (yOf(0) - CORE_Y);
        rs = seg(T, 0.08, 0.4);
      } else if (al >= 0) {
        ry = yOf(al) + 0.78 * inOut(seg(au, 0.62, 1));        // rises during the layer's beat
        rs = 1;
      } else if (T >= L1 && T < SAMPLE_T) {
        ry = yOf(LAYERS - 1) + 0.78;                          // arrives under the logits
        rs = 1;
      } else if (T >= SAMPLE_T) rs = 1 - seg(T, SAMPLE_T, SAMPLE_T + 0.25);   // leaves as the sampled token
      resid.scale.setScalar(Math.max(rs, 0.001));
      resid.position.y = ry;

      // ── logits bars + sampled token ───────────────────────────────────────
      for (let k = 0; k < BARS; k++) {
        const g = T < G0 ? 0.05 : seg(T, G0 + 0.05 + k * 0.05, G0 + 0.55 + k * 0.05);
        const h = Math.max(0.01, BAR_H[k] * (0.05 + 0.95 * g));
        bars[k].scale.y = h;
        bars[k].position.y = BAR_BASE + h / 2;
        if (T < SAMPLE_T) bars[k].material.color.setHex(0x555555);
        else bars[k].material.color.setHex(k === 2 ? 0x101010 : 0xbababa);   // the sampled token wins
      }

      // ── readout ───────────────────────────────────────────────────────────
      let ro;
      if (T < E0) ro = 'token embedding → residual stream starts';
      else if (al >= 0) {
        const sub = au < 0.4 ? 'stream' : au < 0.62 ? 'kv read' : 'residual up';
        ro = `layer ${al + 1}/${LAYERS} · weights streamed ${streamPct}% · ${sub}`
          + (arch === 'moe' ? ` · ffn 2/${EXPERTS}` : '');
      } else if (T < SAMPLE_T) ro = 'logits over the vocabulary · sampling';
      else if (T < A0) ro = 'one token sampled';
      else if (T < A1) ro = 'new kv appended · one block per layer';
      else ro = 'pass done · next token repeats the walk';
      out({ playing, arch, readout: ro });
    },
    action(name, arg) {
      if (name === 'play') { playing = !playing; stepTo = null; }
      else if (name === 'step') {
        playing = false;
        const nx = BEATS.find(b => b > T + 1e-3);
        stepTo = nx ?? LOOP; stepWrap = nx == null;
      } else if (name === 'arch') arch = String(arg) === 'moe' ? 'moe' : 'dense';
    },
  };
}
