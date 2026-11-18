// Scene `kv-work` — deck v2 kv-cache C:
// Two staircases side by side over token index 1..n (n = 4, 8, or 12).
// Left ('no cache'): step i computes i dark cubes, building a triangle of n(n+1)/2 cubes.
// Right ('with cache'): each step computes 1 new dark cube on top while prior cubes remain as
// pale 'cached' cubes (still read each step, not recomputed), totaling n computed cubes.
import { THREE, lam, M, Q, P, S, ease, emitter } from './_kit.js';

const MAX_N = 12;
const MAX_TRI = (MAX_N * (MAX_N + 1)) / 2; // 78
const MAX_CACHED = MAX_TRI - MAX_N;        // 66

const LX = -1.80;
const RX = 1.80;
const DX = 0.23;
const DY = 0.21;
const Y0 = -0.82;

const cDarkActive = new THREE.Color(0x111111);
const cDarkDone = new THREE.Color(0x363636);
const cPale = new THREE.Color(0xc8c8c8);
const cPaleRead = new THREE.Color(0xa2a2a2);
const tmp = new THREE.Color();

function mkLabel(scene, text, x, y, z, height = 0.34) {
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthWrite: false, depthTest: false }));
  sp.renderOrder = 15;
  const draw = t => {
    const font = 'bold 72px ui-monospace, "DejaVu Sans Mono", monospace';
    const probe = document.createElement('canvas').getContext('2d');
    probe.font = font;
    const w = Math.ceil(probe.measureText(t).width) + 24;
    const cv = document.createElement('canvas');
    cv.width = w; cv.height = 94;
    const g = cv.getContext('2d');
    g.font = font; g.fillStyle = '#111111'; g.textBaseline = 'middle';
    g.fillText(t, 12, 48);
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    const old = sp.material.map;
    sp.material.map = tex; sp.material.needsUpdate = true;
    if (old) old.dispose();
    sp.scale.set((height * w) / 94, height, 1);
  };
  draw(text);
  sp.position.set(x, y, z);
  scene.add(sp);
  sp.setText = t => draw(t);
  return sp;
}

export default function build(scene, emit) {
  const out = emitter(emit);

  // ── base plinths (resized to n) ──
  const plinthL = new THREE.Mesh(new THREE.BoxGeometry(1, 0.08, 0.56), lam(0xcecece));
  const plinthEdgeL = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 0.08, 0.56)),
    new THREE.LineBasicMaterial({ color: 0x555555 }),
  );
  const plinthR = new THREE.Mesh(new THREE.BoxGeometry(1, 0.08, 0.56), lam(0xcecece));
  const plinthEdgeR = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 0.08, 0.56)),
    new THREE.LineBasicMaterial({ color: 0x555555 }),
  );
  scene.add(plinthL, plinthEdgeL, plinthR, plinthEdgeR);

  // ── instanced cubes ──
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  const leftCubes = new THREE.InstancedMesh(boxGeo, lam(0xffffff), MAX_TRI);
  const rightNew = new THREE.InstancedMesh(boxGeo, lam(0xffffff), MAX_N);
  const rightCached = new THREE.InstancedMesh(boxGeo, lam(0xffffff), MAX_CACHED);
  leftCubes.frustumCulled = false;
  rightNew.frustumCulled = false;
  rightCached.frustumCulled = false;
  scene.add(leftCubes, rightNew, rightCached);

  // ── labels & big counters ──
  const lCountL = mkLabel(scene, '78', LX, 2.55, 0, 0.54);
  const lCountR = mkLabel(scene, '12', RX, 2.55, 0, 0.54);
  mkLabel(scene, 'no cache', LX, 2.02, 0, 0.36);
  mkLabel(scene, 'with cache', RX, 2.02, 0, 0.36);
  mkLabel(scene, 'n(n+1)/2 computed', LX, -1.38, 0, 0.30);
  mkLabel(scene, 'n new + cached reads', RX, -1.38, 0, 0.30);

  const lNew = mkLabel(scene, '1 new', RX + 0.95, 1.45, 0.25, 0.30);
  const lCached = mkLabel(scene, 'cached', RX + 0.85, 0.15, 0.25, 0.30);

  // ── state ──
  let n = 12;
  let k = 12;
  let playing = true;
  let holding = true;
  let clock = 0;

  const colVis = new Float32Array(MAX_N);
  for (let i = 0; i < k; i++) colVis[i] = 1;

  const xCol = (center, i) => center + (i - (n - 1) / 2) * DX;

  function resizePlinths() {
    const w = n * DX + 0.18;
    plinthL.scale.x = w;
    plinthL.position.set(LX, Y0 - 0.14, 0);
    plinthEdgeL.scale.x = w;
    plinthEdgeL.position.copy(plinthL.position);

    plinthR.scale.x = w;
    plinthR.position.set(RX, Y0 - 0.14, 0);
    plinthEdgeR.scale.x = w;
    plinthEdgeR.position.copy(plinthR.position);
  }
  resizePlinths();

  function updateCounters() {
    const tri = (k * (k + 1)) / 2;
    lCountL.setText(`${tri}`);
    lCountR.setText(`${k}`);
  }
  updateCounters();

  function stepBeat() {
    if (holding) {
      holding = false;
      k = 1;
      colVis.fill(0);
      colVis[0] = 1;
    } else if (k < n) {
      k++;
    } else {
      holding = true;
    }
    updateCounters();
  }

  return {
    view: { target: [0, 0.55, 0], radius: 40, theta: 0.18, phi: 1.12, size: 3.15 },
    update(dt) {
      if (playing) {
        clock += dt;
        const wait = holding ? 2.2 : 0.52;
        if (clock >= wait) {
          clock = 0;
          stepBeat();
        }
      }

      const sm = ease(dt, 11);
      let idxL = 0;
      let idxC = 0;

      for (let i = 0; i < MAX_N; i++) {
        const on = i < k && i < n ? 1 : 0;
        colVis[i] += (on - colVis[i]) * sm;
        const s = Math.max(0.001, colVis[i]);
        const isCurrent = i === k - 1;

        const xl = xCol(LX, i);
        const xr = xCol(RX, i);

        // Left staircase: all (i + 1) cubes are dark & computed
        for (let j = 0; j <= i; j++, idxL++) {
          const y = Y0 + j * DY;
          P.set(xl, y, 0);
          S.set(0.18 * s, 0.18 * s, 0.26 * s);
          leftCubes.setMatrixAt(idxL, M.compose(P, Q, S));
          tmp.copy(isCurrent ? cDarkActive : cDarkDone);
          leftCubes.setColorAt(idxL, tmp);
        }

        // Right staircase: top cube (j === i) is 1 new dark cube
        P.set(xr, Y0 + i * DY, 0);
        S.set(0.18 * s, 0.18 * s, 0.26 * s);
        rightNew.setMatrixAt(i, M.compose(P, Q, S));
        rightNew.setColorAt(i, cDarkActive);

        // Prior cubes (j < i) are pale 'cached' cubes (still read on active step)
        for (let j = 0; j < i; j++, idxC++) {
          P.set(xr, Y0 + j * DY, 0);
          S.set(0.17 * s, 0.17 * s, 0.24 * s);
          rightCached.setMatrixAt(idxC, M.compose(P, Q, S));
          tmp.copy(isCurrent ? cPaleRead : cPale);
          rightCached.setColorAt(idxC, tmp);
        }
      }

      leftCubes.instanceMatrix.needsUpdate = true;
      if (leftCubes.instanceColor) leftCubes.instanceColor.needsUpdate = true;
      rightNew.instanceMatrix.needsUpdate = true;
      if (rightNew.instanceColor) rightNew.instanceColor.needsUpdate = true;
      rightCached.instanceMatrix.needsUpdate = true;
      if (rightCached.instanceColor) rightCached.instanceColor.needsUpdate = true;

      // position right-side pointer labels relative to current n/k
      const topX = xCol(RX, Math.min(k - 1, n - 1));
      const topY = Y0 + Math.min(k - 1, n - 1) * DY;
      lNew.position.set(topX + 0.72, topY + 0.15, 0.3);
      lCached.visible = k >= 3;
      lCached.position.set(xCol(RX, n - 1) + 0.65, Y0 + 0.2, 0.3);

      const tri = (k * (k + 1)) / 2;
      const readout = k === n
        ? `simulated · ${n} tokens · ${tri} token-steps without cache vs ${n} with`
        : `simulated · ${k}/${n} tokens · ${tri} token-steps without cache vs ${k} with`;
      out({ playing, readout });
    },
    action(name, arg) {
      if (name === 'play') playing = typeof arg === 'boolean' ? arg : !playing;
      else if (name === 'step') {
        playing = false;
        clock = 0;
        if (k >= n) {
          k = 1;
          holding = false;
          colVis.fill(0);
          colVis[0] = 1;
        } else {
          k++;
          holding = k === n;
        }
        updateCounters();
      } else if (name === 'n' && [4, 8, 12].includes(Number(arg))) {
        const next = Number(arg);
        n = next;
        k = next;
        holding = true;
        clock = 0;
        for (let i = 0; i < MAX_N; i++) colVis[i] = i < n ? 1 : 0;
        resizePlinths();
        updateCounters();
      }
    },
  };
}
