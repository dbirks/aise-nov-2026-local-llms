// Scene `train-write` — deck v2 train-vs-infer B:
// A 4-layer stack of 6×6 weight cubes. In training mode a text batch enters, an output hits a
// loss marker, and a dark backward-sweep band moves down the stack nudging cube heights and
// incrementing the step counter. In inference mode a lock bar clamps the stack ('read only'),
// prompt tiles enter, and one predicted token comes out with all weights frozen.
import { THREE, lam, ghost, M, Q, P, S, ease, rng, emitter } from './_kit.js';

const LAYERS = 4;
const N = 6;
const NW = N * N;
const TOTAL = LAYERS * NW;

const LAYER_Y = l => -1.1 + l * 0.92;
const GX = c => -0.25 + (c - 2.5) * 0.30;
const GZ = r => (r - 2.5) * 0.30;

const cLight = new THREE.Color(0x6e6e6e);
const cDark = new THREE.Color(0x161616);
const cFlash = new THREE.Color(0x0a0a0a);
const tmp = new THREE.Color();

const clamp01 = v => (v < 0 ? 0 : v > 1 ? 1 : v);
const seg = (t, a, b) => clamp01((t - a) / (b - a));

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
    height = Math.max(height, .45);
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

  // ── 4 layer plates + stack of 6×6 weight cubes ──
  const plates = [];
  for (let l = 0; l < LAYERS; l++) {
    const y = LAYER_Y(l);
    const plate = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.05, 2.1), lam(0xdadada));
    plate.position.set(-0.25, y, 0);
    const edge = new THREE.LineSegments(new THREE.EdgesGeometry(plate.geometry), new THREE.LineBasicMaterial({ color: 0x5a5a5a }));
    edge.position.copy(plate.position);
    scene.add(plate, edge);
    plates.push(edge);
  }

  const cubes = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), lam(0xffffff), TOTAL);
  cubes.frustumCulled = false;
  scene.add(cubes);

  // ── input text tiles (3 tiles at the bottom) ──
  const batchGroup = new THREE.Group();
  scene.add(batchGroup);
  const inTiles = [];
  for (let i = 0; i < 3; i++) {
    const g = new THREE.Group();
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.16, 0.42), lam(0xc8c8c8));
    const edge = new THREE.LineSegments(new THREE.EdgesGeometry(box.geometry), new THREE.LineBasicMaterial({ color: 0x141414 }));
    g.add(box, edge);
    g.position.set(-0.85 + i * 0.6, -2.05, 0.72);
    batchGroup.add(g);
    inTiles.push(g);
  }

  // upward forward-pass pulse token moving through layers
  const fwdTile = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.18, 0.34), lam(0x282828));
  const fwdEdge = new THREE.LineSegments(new THREE.EdgesGeometry(fwdTile.geometry), new THREE.LineBasicMaterial({ color: 0x0e0e0e }));
  fwdTile.add(fwdEdge);
  scene.add(fwdTile);

  // ── training-only: output tile, loss marker, backward dark sweep band ──
  const trainGroup = new THREE.Group();
  scene.add(trainGroup);

  const outBox = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.18, 0.42), lam(0x4a4a4a));
  outBox.position.set(-0.25, 2.48, 0);
  outBox.add(new THREE.LineSegments(new THREE.EdgesGeometry(outBox.geometry), new THREE.LineBasicMaterial({ color: 0x111111 })));
  trainGroup.add(outBox);

  // loss marker on top-right
  const lossGroup = new THREE.Group();
  lossGroup.position.set(1.55, 2.48, 0);
  const lossCore = new THREE.Mesh(new THREE.OctahedronGeometry(0.28, 0), lam(0x161616));
  const lossCage = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(0.66, 0.66, 0.66)),
    new THREE.LineBasicMaterial({ color: 0x111111 }),
  );
  lossGroup.add(lossCore, lossCage);
  trainGroup.add(lossGroup);

  // connector arrow from output to loss
  const lossLink = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.06, 0.06), lam(0x222222));
  lossLink.position.set(0.6, 2.48, 0);
  trainGroup.add(lossLink);

  // dark backward-sweep band: hollow rectangular collar wrapping the layer footprint + downward arrow
  const bandGroup = new THREE.Group();
  const barThick = 0.15, span = 2.34;
  for (const [bx, bz, bw, bd] of [
    [0, span / 2, span + barThick, barThick],
    [0, -span / 2, span + barThick, barThick],
    [-span / 2, 0, barThick, span - barThick],
    [span / 2, 0, barThick, span - barThick],
  ]) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(bw, 0.15, bd), lam(0x121212));
    bar.position.set(-0.25 + bx, 0, bz);
    bandGroup.add(bar);
  }
  const bandGlow = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.06, 2.2), ghost(0x111111, 0.22));
  bandGlow.position.set(-0.25, 0, 0);
  bandGroup.add(bandGlow);
  // downward arrow on the right side of the band
  const arrowShaft = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.50, 0.10), lam(0x121212));
  arrowShaft.position.set(1.38, 0.18, 0);
  const arrowHead = new THREE.Mesh(new THREE.ConeGeometry(0.19, 0.30, 4), lam(0x121212));
  arrowHead.rotation.x = Math.PI;
  arrowHead.position.set(1.38, -0.18, 0);
  bandGroup.add(arrowShaft, arrowHead);
  trainGroup.add(bandGroup);

  // ── inference-only: lock bar across the stack + predicted token tile ──
  const inferGroup = new THREE.Group();
  scene.add(inferGroup);

  // lock bar clamping top and bottom of the 4-layer stack
  const lockRail = new THREE.Mesh(new THREE.BoxGeometry(0.16, 3.25, 0.16), lam(0x141414));
  lockRail.position.set(1.18, 0.32, 0.95);
  const lockTop = new THREE.Mesh(new THREE.BoxGeometry(2.75, 0.14, 0.16), lam(0x141414));
  lockTop.position.set(-0.12, 1.92, 0.95);
  const lockBot = new THREE.Mesh(new THREE.BoxGeometry(2.75, 0.14, 0.16), lam(0x141414));
  lockBot.position.set(-0.12, -1.24, 0.95);
  const lockBody = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.54, 0.28), lam(0x161616));
  lockBody.position.set(1.18, 0.32, 1.02);
  const lockShackle = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(0.28, 0.26, 0.16)),
    new THREE.LineBasicMaterial({ color: 0x111111 }),
  );
  lockShackle.position.set(1.18, 0.68, 1.02);
  inferGroup.add(lockRail, lockTop, lockBot, lockBody, lockShackle);

  const predTile = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.22, 0.46), lam(0x1c1c1c));
  predTile.position.set(-0.25, 2.48, 0);
  predTile.add(new THREE.LineSegments(new THREE.EdgesGeometry(predTile.geometry), new THREE.LineBasicMaterial({ color: 0x0a0a0a })));
  inferGroup.add(predTile);

  // ── labels ──
  const lInput = mkLabel(scene, 'text batch', -0.25, -2.58, 0.72, 0.34);
  const lOut = mkLabel(scene, 'output', -0.25, 2.95, 0, 0.32);
  const lLoss = mkLabel(scene, 'loss', 1.55, 3.12, 0, 0.34);
  const lSweep = mkLabel(scene, 'backward', 2.55, 0.95, 0, 0.32);
  const lStep = mkLabel(scene, 'step 1', 2.35, 0.45, 0, 0.36);
  const lLock = mkLabel(scene, 'read only', 2.25, 0.32, 0.95, 0.36);

  // ── weights state ──
  const W = new Float64Array(TOTAL);
  const Hc = new Float64Array(TOTAL);
  const Ht = new Float64Array(TOTAL);
  const flash = new Float32Array(LAYERS);

  {
    const r = rng(404);
    for (let i = 0; i < TOTAL; i++) {
      W[i] = 0.15 + r() * 0.85;
      Ht[i] = 0.12 + 0.48 * W[i];
      Hc[i] = Ht[i];
    }
  }

  let mode = 'train';
  let playing = true;
  let step = 1;
  let phase = 0;
  let lastLayerUpdated = 4; // tracks which layer the backward band just crossed in current cycle
  const TRAIN_CYCLE = 3.2;
  const INFER_CYCLE = 2.6;

  function nudgeLayer(l) {
    const r = rng(1009 + step * 373 + l * 41);
    const base = l * NW;
    for (let i = 0; i < NW; i++) {
      const delta = (r() - 0.5) * 0.24;
      W[base + i] = Math.max(0.12, Math.min(1.0, W[base + i] + delta));
      Ht[base + i] = 0.12 + 0.48 * W[base + i];
    }
    flash[l] = 1.0;
  }

  function applyMode() {
    const isTrain = mode === 'train';
    trainGroup.visible = isTrain;
    inferGroup.visible = !isTrain;
    lLoss.visible = isTrain;
    lSweep.visible = isTrain;
    lStep.visible = isTrain;
    lLock.visible = !isTrain;
    lInput.setText(isTrain ? 'text batch' : 'prompt');
    lOut.setText(isTrain ? 'output' : 'next token');
  }
  applyMode();

  function advanceCycle(dt) {
    const dur = mode === 'train' ? TRAIN_CYCLE : INFER_CYCLE;
    phase += dt / dur;
    if (phase >= 1) {
      phase -= 1;
      if (mode === 'train') {
        step++;
        lStep.setText(`step ${step}`);
        lastLayerUpdated = 4;
      }
    }
  }

  return {
    view: { target: [0.05, 0.25, 0], radius: 40, theta: 0.40, phi: 1.12, size: 3.15 },
    update(dt) {
      if (playing) advanceCycle(dt);

      const isTrain = mode === 'train';
      const k = ease(dt, 8);

      // forward pass happens in phase [0, 0.38] for train, [0, 0.65] for infer
      const fwdEnd = isTrain ? 0.36 : 0.65;
      const fwdT = seg(phase, 0.04, fwdEnd);
      if (fwdT > 0 && fwdT < 1) {
        fwdTile.visible = true;
        fwdTile.position.set(-0.25, -1.7 + fwdT * 4.0, 0.85);
      } else {
        fwdTile.visible = false;
      }

      // subtle input bounce
      inTiles.forEach((t, i) => {
        const pulse = seg(phase, 0.02 * i, 0.12 + 0.02 * i);
        const lift = Math.sin(pulse * Math.PI) * 0.12;
        t.position.y = -2.05 + lift;
      });

      if (isTrain) {
        // output + loss marker pulse around phase [0.34, 0.52]
        const outP = seg(phase, 0.32, 0.45);
        const lossP = seg(phase, 0.38, 0.55);
        outBox.scale.setScalar(0.75 + 0.3 * Math.sin(outP * Math.PI));
        lossCore.rotation.y += dt * 1.4;
        const ls = 1 + 0.28 * Math.sin(lossP * Math.PI);
        lossCore.scale.setScalar(ls);

        // backward sweep band: moves down from y = 2.05 to y = -1.25 during phase [0.50, 0.90]
        const backP = seg(phase, 0.50, 0.90);
        if (backP > 0 && backP < 1) {
          bandGroup.visible = true;
          const by = 2.05 - backP * 3.30;
          bandGroup.position.y = by;
          for (let l = LAYERS - 1; l >= 0; l--) {
            if (l < lastLayerUpdated && by <= LAYER_Y(l) + 0.25) {
              lastLayerUpdated = l;
              nudgeLayer(l);
            }
          }
        } else {
          bandGroup.visible = false;
        }
      } else {
        // inference: predicted token emerges at top during phase [0.60, 0.92]
        const predP = seg(phase, 0.58, 0.92);
        const s = predP > 0 ? Math.sin(Math.min(1, predP) * Math.PI * 0.85) : 0.001;
        predTile.scale.setScalar(Math.max(0.001, 0.5 + 0.55 * s));
        predTile.position.y = 2.25 + predP * 0.35;
      }

      // update cube heights and shades
      let idx = 0;
      for (let l = 0; l < LAYERS; l++) {
        flash[l] = Math.max(0, flash[l] - dt * 2.2);
        const plateY = LAYER_Y(l) + 0.025;
        // highlight plate edge slightly when forward tile passes or backward band touches
        const hit = isTrain ? flash[l] > 0.2 : Math.abs(fwdTile.position.y - LAYER_Y(l)) < 0.35 && fwdTile.visible;
        plates[l].material.color.setHex(hit ? 0x111111 : 0x5a5a5a);

        for (let r = 0; r < N; r++) {
          for (let c = 0; c < N; c++, idx++) {
            Hc[idx] += (Ht[idx] - Hc[idx]) * k;
            const h = Math.max(0.04, Hc[idx]);
            P.set(GX(c), plateY + h / 2, GZ(r));
            S.set(0.21, h, 0.21);
            cubes.setMatrixAt(idx, M.compose(P, Q, S));
            tmp.copy(cLight).lerp(cDark, clamp01((W[idx] - 0.12) / 0.88));
            if (flash[l] > 0.01) tmp.lerp(cFlash, 0.55 * flash[l]);
            cubes.setColorAt(idx, tmp);
          }
        }
      }
      cubes.instanceMatrix.needsUpdate = true;
      if (cubes.instanceColor) cubes.instanceColor.needsUpdate = true;

      const readout = isTrain
        ? `simulated · training step ${step} · weights changed`
        : 'simulated · inference · weights unchanged';
      out({ playing, readout });
    },
    action(name, arg) {
      if (name === 'play') playing = typeof arg === 'boolean' ? arg : !playing;
      else if (name === 'step' || name === 'back') {
        playing = false; mode = mode === 'train' ? 'infer' : 'train'; phase = 0.05; lastLayerUpdated = 4; applyMode();
      } else if (name === 'mode') {
        const m = arg === 'infer' || arg === 'inference' ? 'infer' : 'train';
        if (m !== mode) {
          mode = m;
          phase = 0.05;
          lastLayerUpdated = 4;
          applyMode();
        }
      }
    },
  };
}
