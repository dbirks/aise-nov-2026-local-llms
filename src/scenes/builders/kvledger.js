// KV ledger — what actually stays in the KV cache, per (token, layer).
// x = token position (grows as decode proceeds), y = layer (8 thin planes), one tile per resident
// KV block. Sliding-window (local) layers release tiles older than W (they fade + shrink); global
// layers keep every token forever. Right side: per-layer byte bars + a total bar, so a hybrid
// model's total still grows linearly with context, just with a smaller slope.
// Numbers are illustrative (real windows are ~1–4k tokens); the inset arcs use synthetic weights.
import { THREE, lam, ghost, M, Q, P, S, ease, emitter } from './_kit.js';

const LAYERS = 8;
const TMAX = 32;
const DY = 0.78;
const LATX0 = -3.3, LATW = 4.1, DX = LATW / TMAX, LATX1 = LATX0 + LATW;
const BARX0 = 1.0, BARMAX = 2.3;
const TOTX0 = LATX0 - 0.02, TOTW = (BARX0 + BARMAX) - TOTX0;
const YBOT = -((LAYERS - 1) * DY) / 2;
const TOTY = YBOT - 0.72;

const yOf = l => YBOT + l * DY;
const xOf = t => LATX0 + (t + 0.5) * DX;

// local(l) === true → that layer attends inside a sliding window (3 local : 1 global, interleaved)
const PATS = {
  'all-global': { label: 'global', local: () => false },
  'all-local': { label: 'local', local: () => true },
  'hybrid 3:1': { label: 'hybrid 3:1', local: l => l % 4 !== 3 },
};

export default function build(scene, emit) {
  const out = emitter(emit);
  const N = LAYERS * TMAX;

  // ── layer planes + global/local markers (tall post = global, flat tick = local) ──
  const plate = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 0.02, 0.52), ghost(0x8a8a8a, 0.16), LAYERS);
  const mark = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), lam(0x1e1e1e), LAYERS);
  for (let l = 0; l < LAYERS; l++) {
    P.set((LATX0 + LATX1) / 2, yOf(l) - 0.26, 0);
    plate.setMatrixAt(l, M.compose(P, Q, S.set(LATW + 0.3, 1, 1)));
  }
  scene.add(plate, mark);

  // ── one tile per (token, layer) ──────────────────────────────
  const tiles = new THREE.InstancedMesh(new THREE.BoxGeometry(0.06, 0.4, 0.24), lam(0xffffff), N);
  scene.add(tiles);
  const cDark = new THREE.Color(0x151515), cPale = new THREE.Color(0xe4e4e4), cTmp = new THREE.Color();
  const curS = new Float32Array(N).fill(0.001);   // eased tile scale
  const curL = new Float32Array(N).fill(0.1);      // eased luminance: 0 resident → 1 released

  // ── byte meters: one bar per layer + a total bar ─────────────
  const track = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 0.11, 0.17), ghost(0x8f8f8f, 0.15), LAYERS);
  const bars = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 0.13, 0.24), lam(0x242424), LAYERS);
  for (let l = 0; l < LAYERS; l++) {
    P.set(BARX0 + BARMAX / 2, yOf(l), 0);
    track.setMatrixAt(l, M.compose(P, Q, S.set(BARMAX, 1, 1)));
    bars.setMatrixAt(l, M.compose(P, Q, S.set(0.001, 1, 1)));
  }
  const totTrack = new THREE.Mesh(new THREE.BoxGeometry(TOTW, 0.2, 0.28), ghost(0x8f8f8f, 0.15));
  totTrack.position.set(TOTX0 + TOTW / 2, TOTY, 0);
  const totBar = new THREE.Mesh(new THREE.BoxGeometry(1, 0.24, 0.34), lam(0x141414));
  totBar.position.set(TOTX0 + 0.001, TOTY, 0);
  scene.add(track, bars, totTrack, totBar);
  const barCur = new Float32Array(LAYERS);
  let totCur = 0.001;

  // ── inset: query token attending inside the window of one local layer ──
  const arcs = new THREE.Group(); scene.add(arcs);
  const arcMat = lam(0x1c1c1c);
  const winMat = new THREE.MeshBasicMaterial({ color: 0x3a3a3a, transparent: true, opacity: 0.2, depthWrite: false, side: THREE.DoubleSide });
  const band = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), winMat);
  scene.add(band);
  const KEY = [6, 13, 21];

  let pattern = 'hybrid 3:1', W = 16, showArcs = true, playing = true;
  let T = 8, clock = 0, hold = 0, arcKey = '';

  const isLocal = l => PATS[pattern].local(l);
  const residentOf = l => (isLocal(l) ? Math.min(T, W) : T);
  // inset layer: the first local (sliding-window) layer; in an all-global model, layer 0 with its full history
  const insetLayer = () => { for (let l = 0; l < LAYERS; l++) if (isLocal(l)) return l; return 0; };

  function rebuildArcs() {
    const lq = insetLayer();
    const q = T - 1, lo = Math.max(0, q - (isLocal(lq) ? W - 1 : q));
    const key = `${lq}|${q}|${W}|${pattern}|${showArcs}`;
    band.position.set((xOf(lo) + xOf(q)) / 2, yOf(lq) - 0.24, 0);
    band.scale.x = Math.max(0.001, (q - lo + 1) * DX);
    band.scale.z = 0.62;
    band.visible = showArcs && T > 1;
    if (key === arcKey) return;
    arcKey = key;
    arcs.children.slice().forEach(m => { m.geometry.dispose(); arcs.remove(m); });
    if (!showArcs || q <= lo) return;
    // spread the arcs over the whole window so “only this stretch is read” reads; weights synthetic
    const sc = [], nA = 6;
    for (let i = 1; i <= nA; i++) {
      const j = Math.round(q - ((q - lo) * i) / (nA + 1));
      if (j > lo) sc.push([j, 2.2 * Math.exp(-(q - j) / (0.45 * (q - lo) + 2)) + (j === 0 ? 1.8 : 0) + (KEY.includes(j) ? 1.1 : 0)]);
    }
    sc.sort((a, b) => b[1] - a[1]);
    const top = sc.slice(0, 5).sort((a, b) => a[0] - b[0]), m = Math.max(...top.map(d => d[1]));
    const e = top.map(d => Math.exp(d[1] - m)), tot = e.reduce((a, b) => a + b, 0) || 1, wmax = Math.max(...e) / tot;
    const y = yOf(lq) + 0.02, z = 0.46;
    top.forEach((d, i) => {
      const j = d[0], w = e[i] / tot, dist = xOf(q) - xOf(j), h = 0.14 + 0.34 * Math.sqrt(dist);
      const c = new THREE.QuadraticBezierCurve3(
        new THREE.Vector3(xOf(j), y, z), new THREE.Vector3((xOf(j) + xOf(q)) / 2, y + h, z), new THREE.Vector3(xOf(q), y, z));
      arcs.add(new THREE.Mesh(new THREE.TubeGeometry(c, Math.max(8, Math.min(26, Math.round(dist * 14))), 0.022 + 0.085 * w / wmax, 6), arcMat));
    });
  }

  function step() { playing = false; T = T >= TMAX ? 6 : T + 1; clock = 0; hold = 0; }

  return {
    view: { target: [0, -0.1, 0], radius: 40, theta: 0.46, phi: 1.16, size: 2.8 },

    update(dt) {
      if (playing) {
        if (T >= TMAX) { hold += dt; if (hold > 2.6) { hold = 0; T = 6; clock = 0; } }
        else { clock += dt; if (clock >= 0.22) { clock = 0; T++; } }
      }
      rebuildArcs();

      let resident = 0, globalRes = 0;
      const kS = ease(dt, 8), kL = ease(dt, 6);
      for (let l = 0; l < LAYERS; l++) {
        const loc = isLocal(l), res = residentOf(l);
        resident += res; if (!loc) globalRes += res;
        const cut = loc ? T - W : -1;
        for (let t = 0; t < TMAX; t++) {
          const i = l * TMAX + t;
          let ts = 1, tl = 0;
          if (t >= T) { ts = 0.001; tl = 0.12; }
          else if (t < cut) { ts = 0.48; tl = 0.92; }
          curS[i] += (ts - curS[i]) * kS;
          curL[i] += (tl - curL[i]) * kL;
          P.set(xOf(t), yOf(l), 0);
          tiles.setMatrixAt(i, M.compose(P, Q, S.setScalar(Math.max(curS[i], 0.001))));
          tiles.setColorAt(i, cTmp.copy(cDark).lerp(cPale, Math.min(1, curL[i])));
        }
        const bl = (res / TMAX) * BARMAX;
        barCur[l] += (bl - barCur[l]) * ease(dt, 6);
        P.set(BARX0 + Math.max(barCur[l], 0.001) / 2, yOf(l), 0);
        bars.setMatrixAt(l, M.compose(P, Q, S.set(Math.max(barCur[l], 0.001), 1, 1)));
        P.set(LATX0 - 0.2, yOf(l), 0);
        mark.setMatrixAt(l, M.compose(P, Q, S.set(loc ? 0.2 : 0.055, loc ? 0.085 : 0.36, loc ? 0.06 : 0.06)));
      }
      tiles.instanceMatrix.needsUpdate = tiles.instanceColor.needsUpdate = true;
      bars.instanceMatrix.needsUpdate = true;
      mark.instanceMatrix.needsUpdate = true;

      const tot = (resident / (TMAX * LAYERS)) * TOTW;
      totCur += (Math.max(tot, 0.001) - totCur) * ease(dt, 6);
      totBar.scale.x = totCur;
      totBar.position.x = TOTX0 + totCur / 2;

      const win = pattern === 'all-global' ? 'no window' : `W=${W}`;
      out({
        playing,
        readout: `${PATS[pattern].label} · ${win} · ${T} tok · kv tiles ${resident} (global ${globalRes})`,
        pattern, W, T, resident, global: globalRes,
      });
    },

    action(name, arg) {
      if (name === 'play') playing = !playing;
      else if (name === 'step') step();
      else if (name === 'pattern') { pattern = PATS[arg] ? arg : 'hybrid 3:1'; arcKey = ''; }
      else if (name === 'W') { W = arg; arcKey = ''; }
      else if (name === 'arcs') { showArcs = !!arg; arcKey = ''; }
    },
  };
}
