// Scene `drafter-vram` — a drafter is another tenant of the same VRAM budget (README "Scene I").
//
// Lower half: one capacity column. The dark ceiling plate is the memory available at runtime; the
// column is filled bottom-up by target weights (dark), runtime/workspace (mid grey) and — only when
// a drafter is on — a drafter band (dark). KV blocks are the small dark cubes filling whatever
// height is left. Raising the drafter band pushes the top rows of KV cubes past the ceiling: they
// rise and fade out = evicted, so the block count drops 120 → 96 → 72 → 48.
// Upper row: the 12 tokens being generated. Target-only stamps ONE dark target-pass slab per token.
// A drafter lays thin draft candidates under the rail first, then ONE target slab verifies the
// accepted prefix (+ the target supplies one more token) — fewer sequential target passes.
// Travelling tiles and the pips on the right edge link each beat to the resident block that pays
// for it (weights → target pass, drafter band → draft round).
//
// EVERY height, count and acceptance number here is illustrative geometry — not measured specs,
// model comparisons, speedups or throughput. Do not imply: real GiB values, TTFT/ITL, tokens/sec,
// that every drafter needs its own full KV cache, or that trading KV for drafting is always a win
// (at high batch the extra draft compute can cost throughput). Sources: repo README "Scene I" and
// research notes §3 (NVIDIA NIM speculative-decoding memory comparison; vLLM speculative config).
import { THREE, lam, ghost, M, Q, P, S, ease, emitter } from './_kit.js';

const R = 0.32;                          // one KV block row = one token slot ("rent unit")
const COLS = 12, DEPTH = 2;              // 24 blocks per row
const CAP = 10;                          // column capacity in rows
const TOK = 12;                          // tokens generated in the pass row
const FLOOR = -1.9, TOP = FLOOR + CAP * R;   // dark ceiling plate = the budget
const RAIL = 2.5, RZ = 0.55, CW = COLS * R;   // RZ: the pass row floats in FRONT of the column
const KMAX = 6;                          // widest draft block drawn

// Heights in rows — illustrative. MTP is the smallest reservation: its heads ride in the target
// checkpoint (weights band grows a little, thin extra state). EAGLE-3 / DFlash-family drafters have
// separate weights + feature/state buffers; the split between them here is not a measurement.
const MODES = {
  'target-only': { tag: 'no drafter', wt: 3.40, ws: 1.10, d: 0, K: 0, name: '' },
  'mtp': { tag: 'mtp', wt: 3.85, ws: 1.10, d: 0.50, K: 2, name: 'mtp heads' },
  'eagle3': { tag: 'eagle-3', wt: 3.40, ws: 1.30, d: 1.60, K: 4, name: 'eagle-3' },
  'dflash': { tag: 'dflash', wt: 3.40, ws: 1.50, d: 2.50, K: 6, name: 'dflash' },
};
const PACCEPT = { low: 0.45, high: 0.8 };   // per-candidate accept probability (illustrative)
const TD = 0.5, TV = 0.95, TB = 0.6;       // draft beat / verify beat / target-only beat

const rowsOf = k => Math.floor(CAP - (MODES[k].wt + MODES[k].ws + MODES[k].d));
const blocksOf = k => rowsOf(k) * COLS * DEPTH;
const ROWS0 = rowsOf('target-only');

export default function build(scene, emit) {
  const out = emitter(emit);
  const edge = (w, h, d) => new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(w, h, d)),
    new THREE.LineBasicMaterial({ color: 0x111111 }));

  // ── capacity column: outline, floor, dark ceiling = the budget ──────────
  const colEdge = edge(CW + 0.5, CAP * R, 1.25);
  colEdge.position.set(0, FLOOR + CAP * R / 2, 0);
  const ceil = new THREE.Mesh(new THREE.BoxGeometry(CW + 0.42, 0.07, 1.15), lam(0x141414));
  ceil.position.set(0, TOP + 0.04, 0);
  const floorP = new THREE.Mesh(new THREE.BoxGeometry(CW + 0.42, 0.06, 1.15), lam(0x8a8a8a));
  floorP.position.set(0, FLOOR - 0.03, 0);
  scene.add(colEdge, ceil, floorP);

  // ── resident bands ──────────────────────────────────────────────────────
  const band = (depth, colour) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), lam(colour));
    const e = edge(1, 1, 1);
    m.scale.setScalar(0.001); e.scale.setScalar(0.001);
    scene.add(m, e);
    return { m, e, depth };
  };
  const wt = band(1.18, 0x1c1c1c), ws = band(1.02, 0xa6a6a6), dr = band(0.86, 0x242424);
  const put = (b, y, h) => {
    const hh = Math.max(h * R, 0.001);
    b.m.scale.set(CW + 0.08, hh, b.depth); b.e.scale.copy(b.m.scale);
    b.m.position.set(0, y + hh / 2, 0); b.e.position.copy(b.m.position);
  };

  // ── KV blocks: one instance per block, stacked up from the top of the bands
  const NB = COLS * DEPTH * ROWS0;             // 120 = every block target-only can afford
  const kv = new THREE.InstancedMesh(new THREE.BoxGeometry(0.26, 0.26, 0.26), lam(0xffffff), NB);
  kv.frustumCulled = false;
  const cFront = new THREE.Color(0x161616), cBack = new THREE.Color(0x5e5e5e);
  for (let i = 0; i < NB; i++) kv.setColorAt(i, Math.floor(i / COLS) % DEPTH ? cBack : cFront);
  scene.add(kv);
  const kvAmt = new Float32Array(NB).fill(0.001);

  // ── activity pips on the right edge (which resident block this beat uses)
  const pip = () => { const m = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), lam(0x0e0e0e)); m.scale.setScalar(0.001); scene.add(m); return m; };
  const pipW = pip(), pipD = pip();

  // ── pass row: rail, token ruler, dark target-pass slabs, thin draft candidates
  const rail = new THREE.Mesh(new THREE.BoxGeometry(CW + 0.35, 0.035, 0.62), ghost(0x2a2a2a, 0.3));
  rail.position.set(0, RAIL, RZ);
  scene.add(rail);
  const ticks = new THREE.InstancedMesh(new THREE.BoxGeometry(0.022, 0.12, 0.5), new THREE.MeshBasicMaterial({ color: 0x8f8f8f }), COLS + 1);
  for (let i = 0; i <= COLS; i++) ticks.setMatrixAt(i, M.compose(P.set(-CW / 2 + i * R, RAIL - 0.085, RZ), Q, S.setScalar(1)));
  scene.add(ticks);
  const tpass = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), lam(0x111111), TOK);
  const dslab = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), lam(0xffffff), TOK * KMAX);
  tpass.frustumCulled = dslab.frustumCulled = false;
  scene.add(tpass, dslab);
  const cPend = new THREE.Color(0x8a8a8a), cAcc = new THREE.Color(0x2b2b2b), cRej = new THREE.Color(0xd8d8d8);

  // ── travelling tiles: draft round ← drafter band, target pass ← weights ──
  const NT = 28;
  const trav = new THREE.InstancedMesh(new THREE.BoxGeometry(0.12, 0.12, 0.12), lam(0xffffff), NT);
  trav.frustumCulled = false;
  scene.add(trav);
  const tFrom = new Float32Array(NT * 3), tTo = new Float32Array(NT * 3), tT = new Float32Array(NT).fill(9);
  const cDark = new THREE.Color(0x111111), cLite = new THREE.Color(0x6e6e6e), tc = [];
  let tSlot = 0;
  function spawn(fx, fy, tx, ty, dark) {
    const i = tSlot; tSlot = (tSlot + 1) % NT;
    tFrom[i * 3] = fx; tFrom[i * 3 + 1] = fy; tFrom[i * 3 + 2] = RZ + 0.1;
    tTo[i * 3] = tx; tTo[i * 3 + 1] = ty; tTo[i * 3 + 2] = RZ + 0.1;
    tT[i] = 0; tc[i] = dark ? cDark : cLite;
  }

  // ── labels (short; the numbers live in the readout) ─────────────────────
  function label(text, h) {
    const fpx = 64, f = `bold ${fpx}px ui-monospace, monospace`;
    const cv = document.createElement('canvas'), g = cv.getContext('2d');
    g.font = f;
    const w = Math.ceil(g.measureText(text).width) + 22;
    cv.width = w; cv.height = fpx + 20;
    g.globalAlpha = 0.92; g.fillStyle = '#f4f4f4'; g.fillRect(0, 0, w, cv.height); g.globalAlpha = 1;
    g.font = f; g.fillStyle = '#111111'; g.textBaseline = 'middle';
    g.fillText(text, 11, cv.height / 2);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, depthWrite: false, depthTest: false }));
    sp.renderOrder = 20;
    sp.userData.w = w / cv.height;
    sp.scale.setScalar(0.001);
    scene.add(sp);
    return sp;
  }
  const setLab = (sp, h, x, y, z, on = 1) => {
    sp.scale.set(Math.max(h * sp.userData.w * on, 0.001), Math.max(h * on, 0.001), 1);
    sp.position.set(x, y, z);
  };
  const labCap = label('capacity', 0.2), labW = label('target weights', 0.25), labS = label('workspace', 0.22);
  const labK = label('kv blocks', 0.23), labP = label('target passes', 0.23);
  const labD = Object.fromEntries(Object.keys(MODES).filter(k => k !== 'target-only').map(k => [k, label(MODES[k].name, 0.23)]));

  // ── state ───────────────────────────────────────────────────────────────
  let mode = 'target-only', acc = 'high', playing = true, t = 0, prevT = 0;
  let hW = MODES['target-only'].wt, hS = MODES['target-only'].ws, hD = 0, hR = ROWS0;
  let flashW = 0, flashD = 0;
  let rounds = [], ks = [], cs = [], evs = [], total = 1;
  const pb = () => (mode === 'target-only' ? TB : TD + TV);

  // Scripted, deterministic schedule (no lucky draws): mean tokens per target pass = 1 + Σ p^i over
  // the K candidates, spread evenly, so low acceptance always costs more passes than high. The last
  // round's draft block is truncated by the end of the 12-token sequence.
  function schedule() {
    const K = MODES[mode].K, p = PACCEPT[acc];
    let ea = 0, q = 1;
    for (let i = 0; i < K; i++) { q *= p; ea += q; }
    const tpr = mode === 'target-only' ? 1 : 1 + ea;
    rounds = []; ks = []; cs = []; evs = [];
    let tok = 0, carry = 0;
    while (tok < TOK && rounds.length < TOK) {
      carry += tpr;
      const tr = Math.max(1, Math.floor(carry));
      carry -= tr;
      const kr = mode === 'target-only' ? 0 : Math.min(K, TOK - tok - 1);
      const a = Math.min(tr - 1, kr);
      cs.push(tok); ks.push(kr); rounds.push(a); tok += a + 1;
    }
    rounds.forEach((a, r) => {
      if (mode !== 'target-only') evs.push({ at: r * pb(), kind: 'draft', r });
      evs.push({ at: r * pb() + (mode === 'target-only' ? 0.1 : TD), kind: 'verify', r });
    });
    total = (evs.length ? evs[evs.length - 1].at : 0) + 1.2;
  }
  schedule();

  const amt = at => Math.max(0, Math.min(1, (t - at) / 0.24));

  return {
    view: { target: [-0.25, 0.3, 0], radius: 40, theta: 0.62, phi: 1.12, size: 2.35 },
    update(dt) {
      const m0 = MODES[mode];
      if (playing) {
        t += dt;
        if (t >= total) { t = 0; prevT = -1; tT.fill(9); flashW = flashD = 0; }
      }
      for (const e of evs) {
        if (!(prevT < e.at && t >= e.at)) continue;
        const xs = -CW / 2 + cs[e.r] * R, a = rounds[e.r];
        const yDr = FLOOR + (hW + hS + hD) * R - hD * R / 2;
        if (e.kind === 'draft') {
          flashD = 1;
          for (let c = 0; c < ks[e.r]; c++) spawn(xs + (c + 0.5) * R, yDr, xs + (c + 0.5) * R, RAIL - 0.1, false);
        } else {
          flashW = 1;
          spawn(xs + (a + 1) * R / 2, FLOOR + hW * R / 2, xs + (a + 1) * R / 2, RAIL + 0.2, true);
        }
      }
      prevT = t;

      // bands glide to the new budget split
      hW += (m0.wt - hW) * ease(dt, 6); hS += (m0.ws - hS) * ease(dt, 6);
      hD += (m0.d - hD) * ease(dt, 6); hR += (rowsOf(mode) - hR) * ease(dt, 7);
      const yW = FLOOR, yS = yW + hW * R, yD = yS + hS * R, yK = yD + hD * R;
      put(wt, yW, hW); put(ws, yS, hS); put(dr, yD, hD);

      flashW = Math.max(0, flashW - dt * 2.6); flashD = Math.max(0, flashD - dt * 2.6);
      const pipSet = (mesh, y, a) => {
        const s = Math.max(0.001, a * 0.22);
        mesh.scale.set(s, s, s); mesh.position.set(CW / 2 + 0.44, y, 0.32);
      };
      pipSet(pipW, yW + hW * R / 2, 0.3 + flashW);
      pipSet(pipD, yD + Math.max(hD * R, 0.12) / 2, m0.d > 0.05 ? 0.3 + flashD : 0);

      // KV blocks: row k survives while k < hR; squeezed rows rise past the ceiling and fade out
      for (let i = 0; i < NB; i++) {
        const row = Math.floor(i / (COLS * DEPTH)), c = i % COLS, z = Math.floor(i / COLS) % DEPTH;
        const tgt = Math.max(0, Math.min(1, hR - row));
        kvAmt[i] += (Math.max(tgt, 0.001) - kvAmt[i]) * ease(dt, tgt > kvAmt[i] ? 9 : 12);
        const s = Math.max(kvAmt[i], 0.001);
        P.set(-CW / 2 + (c + 0.5) * R, yK + (row + 0.5) * R + (1 - kvAmt[i]) * 0.32, (z - (DEPTH - 1) / 2) * R);
        kv.setMatrixAt(i, M.compose(P, Q, S.set(s, s, s)));
      }
      kv.instanceMatrix.needsUpdate = true;

      // pass row: one dark target slab per round, thin candidates below the rail
      rounds.forEach((a, r) => {
        const on = amt(r * pb() + (mode === 'target-only' ? 0.1 : TD));
        const w = Math.max(0.001, ((a + 1) * R - 0.13) * on), xs = -CW / 2 + cs[r] * R;
        tpass.setMatrixAt(r, M.compose(P.set(xs + w / 2, RAIL + 0.06, RZ), Q, S.set(w, 0.26, 0.5)));
        const K = ks[r];
        for (let c = 0; c < KMAX; c++) {
          const i = r * KMAX + c;
          if (c >= K) { dslab.setMatrixAt(i, M.compose(P, Q, S.setScalar(0.001))); continue; }
          const ca = amt(r * pb() + 0.04 + c * 0.05);
          dslab.setMatrixAt(i, M.compose(P.set(xs + (c + 0.5) * R, RAIL - 0.105, RZ), Q, S.set((R - 0.14) * ca, 0.11, 0.42)));
          dslab.setColorAt(i, on >= 0.99 ? (c < a ? cAcc : cRej) : cPend);
        }
      });
      for (let r = rounds.length; r < TOK; r++) tpass.setMatrixAt(r, M.compose(P, Q, S.setScalar(0.001)));
      for (let i = rounds.length * KMAX; i < TOK * KMAX; i++) dslab.setMatrixAt(i, M.compose(P, Q, S.setScalar(0.001)));
      tpass.instanceMatrix.needsUpdate = true;
      dslab.instanceMatrix.needsUpdate = true;
      if (dslab.instanceColor) dslab.instanceColor.needsUpdate = true;

      // travelling tiles
      for (let i = 0; i < NT; i++) {
        if (tT[i] <= 1) tT[i] += dt / 0.38;
        const u = Math.min(1, tT[i]), e2 = u * u * (3 - 2 * u);
        P.set(tFrom[i * 3] + (tTo[i * 3] - tFrom[i * 3]) * e2, tFrom[i * 3 + 1] + (tTo[i * 3 + 1] - tFrom[i * 3 + 1]) * e2, RZ + 0.1);
        S.setScalar(Math.max(0.001, u < 1 ? Math.sin(Math.PI * Math.min(1, u * 1.1)) * 1.7 : 0.001));
        trav.setMatrixAt(i, M.compose(P, Q, S));
        trav.setColorAt(i, tc[i] || cDark);
      }
      trav.instanceMatrix.needsUpdate = true;
      if (trav.instanceColor) trav.instanceColor.needsUpdate = true;

      // labels hug their bands
      setLab(labW, 0.25, 0, yW + hW * R / 2, 0.74);
      setLab(labS, 0.22, 0, yS + hS * R / 2, 0.62);
      setLab(labK, 0.23, 0, yK + Math.max(hR, 0.4) * R / 2 + 0.08, 0.6);
      setLab(labCap, 0.2, CW / 2 + 0.42, TOP + 0.16, 0.45);
      setLab(labP, 0.23, -CW / 2 - 0.2, RAIL + 0.3, RZ + 0.1);
      for (const k of Object.keys(labD)) setLab(labD[k], 0.23, 0, yD + Math.max(hD * R, 0.14) / 2, 0.55, mode === k ? 1 : 0);

      const base = blocksOf('target-only'), nb = blocksOf(mode);
      out({
        playing, mode, acc, blocks: nb, passes: rounds.length,
        readout: mode === 'target-only'
          ? `no drafter · kv blocks ${base} · target passes ${TOK}`
          : `${m0.tag} · kv blocks ${base} → ${nb} · target passes ${TOK} → ${rounds.length} · ${acc} acceptance`,
      });
    },
    action(name, arg) {
      if (name === 'play') playing = !playing;
      else if (name === 'step') {
        playing = false;
        const nx = evs.find(e => e.at > t + 1e-6);
        t = nx ? nx.at + 0.25 : 0;
        prevT = Math.min(prevT, t);
      } else if (name === 'back') {
        playing = false;
        const pv = [...evs].reverse().find(e => e.at < t - 0.26);
        t = pv ? pv.at + 0.25 : 0;
        prevT = t;                                        // rewinding must not re-fire a forward beat
      } else if (name === 'mode') {
        mode = MODES[String(arg)] ? String(arg) : 'target-only';
        t = 0; prevT = -1; schedule();
      } else if (name === 'accept') {
        acc = PACCEPT[String(arg)] ? String(arg) : 'high';
        t = 0; prevT = -1; schedule();
      }
    },
  };
}
