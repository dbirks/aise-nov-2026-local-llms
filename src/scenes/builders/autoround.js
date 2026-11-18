// Synthetic, independent 4x8 linear blocks. Each cube is one weight; height encodes
// signed reconstructed value. Errors are mean squared output errors, averaged over
// layers, vectors and output coordinates. Scales are per row; footprint excludes scales.
import { THREE, lam, M, Q, P, S, ease, emitter, rng } from './_kit.js';

export default function build(scene, emit) {
  const out = emitter(emit), random = rng(30319), box = new THREE.BoxGeometry(1, 1, 1);
  const weights = Array.from({ length: 4 }, () => Array.from({ length: 4 }, () => Array.from({ length: 8 }, () => random() * 2 - 1)));
  const vectors = n => Array.from({ length: n }, () => Array.from({ length: 8 }, () => random() * 2 - 1));
  const cal = vectors(8), held = vectors(4);
  const scales = weights.map(layer => layer.map(row => Math.max(...row.map(Math.abs)) / 7));
  const offsets = weights.map(layer => layer.map(row => row.map(() => 0)));
  const quant = (l, r, c, v) => Math.max(-8, Math.min(7, Math.round(weights[l][r][c] / scales[l][r] + v))) * scales[l][r];
  const snapshot = () => offsets.map(layer => layer.map(row => [...row]));
  const frames = [snapshot()];
  // Straight-through gradient of block output MSE with respect to rounding offsets.
  for (let iter = 0; iter < 50; iter++) {
    for (let l = 0; l < 4; l++) for (let r = 0; r < 4; r++) {
      const grad = Array(8).fill(0);
      for (const x of cal) {
        let error = 0;
        for (let c = 0; c < 8; c++) error += (quant(l, r, c, offsets[l][r][c]) - weights[l][r][c]) * x[c];
        for (let c = 0; c < 8; c++) grad[c] += error * x[c] * scales[l][r];
      }
      for (let c = 0; c < 8; c++) offsets[l][r][c] = Math.max(-0.5, Math.min(0.5, offsets[l][r][c] - 0.025 * Math.sign(grad[c])));
    }
    frames.push(snapshot());
  }
  const error = (frame, inputs, keep) => {
    let sum = 0;
    for (let l = 0; l < 4; l++) for (let r = 0; r < 4; r++) for (const x of inputs) {
      let d = 0;
      if (!(keep && l === 1)) for (let c = 0; c < 8; c++) d += (quant(l, r, c, frame[l][r][c]) - weights[l][r][c]) * x[c];
      sum += d * d;
    }
    return sum / (4 * 4 * inputs.length);
  };
  const cubes = new THREE.InstancedMesh(box, lam(0x222222), 128); cubes.frustumCulled = false; scene.add(cubes);
  const outline = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(2.72, 0.58, 1.35)), new THREE.LineBasicMaterial({ color: 0x111111 }));
  outline.position.set(0, 1.24, 0); scene.add(outline);
  for (let l = 0; l < 4; l++) {
    const plate = new THREE.Mesh(box, lam(0x888888)); plate.scale.set(2.8, 0.06, 1.45); plate.position.set(0, l * 0.8, 0); scene.add(plate);
  }
  function label(text, x, y, z, h = 0.32) {
    const canvas = document.createElement('canvas'), g = canvas.getContext('2d');
    g.font = 'bold 72px monospace'; canvas.width = Math.ceil(g.measureText(text).width) + 16; canvas.height = 88;
    g.font = 'bold 72px monospace'; g.fillStyle = '#111'; g.textBaseline = 'middle'; g.fillText(text, 8, 44);
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(canvas), transparent: true, depthTest: false }));
    sprite.scale.set(h * canvas.width / canvas.height, h, 1); sprite.position.set(x, y, z); sprite.renderOrder = 20; scene.add(sprite); return sprite;
  }
  label('weight cubes', 0, 3.35, 0); label('sensitive layer', 0, 1.05, 1.15, 0.26);
  label('calibration error', -2.65, 3.15, 0, 0.27); label('held-out error', 2.65, 3.15, 0, 0.27);
  label('weight bits', 0, -0.65, 0, 0.28);
  const meter = x => {
    const track = new THREE.Mesh(box, lam(0x999999)); track.position.set(x, 1.5, 0); track.scale.set(0.18, 2.4, 0.18); scene.add(track);
    const fill = new THREE.Mesh(box, lam(0x111111)); scene.add(fill); return fill;
  };
  const cm = meter(-2.65), hm = meter(2.65);
  const track = new THREE.Mesh(box, lam(0x999999)); track.position.set(0, -0.95, 0); track.scale.set(3, 0.12, 0.18); scene.add(track);
  const footprint = new THREE.Mesh(box, lam(0x111111)); scene.add(footprint);
  let method = 'nearest', keep = false, playing = true, time = 0, index = 0, visibleCal = 0, visibleHeld = 0;
  const heights = new Float32Array(128);
  return {
    view: { target: [0, 1.15, 0], radius: 40, theta: 0.25, phi: 1.22, size: 3.1 },
    update(dt) {
      if (playing && method === 'autoround') { time = (time + dt) % 11; index = Math.min(50, Math.floor(time / 8 * 50)); }
      const frame = frames[index], baseline = error(frames[0], cal, keep), ce = error(frame, cal, keep);
      const he = error(method === 'autoround' && index < 50 ? frames[0] : frame, held, keep);
      visibleCal += (ce - visibleCal) * ease(dt, 7); visibleHeld += (he - visibleHeld) * ease(dt, 7);
      const meterMax = Math.max(error(frames[0], cal, false), error(frames[0], held, false), error(frames[50], held, false)) * 1.2 || 1;
      for (const [bar, value, x] of [[cm, visibleCal, -2.65], [hm, visibleHeld, 2.65]]) {
        const h = Math.max(0.01, 2.4 * value / meterMax); bar.scale.set(0.27, h, 0.27); bar.position.set(x, 0.3 + h / 2, 0);
      }
      for (let l = 0; l < 4; l++) for (let r = 0; r < 4; r++) for (let c = 0; c < 8; c++) {
        const i = l * 32 + r * 8 + c, value = keep && l === 1 ? weights[l][r][c] : quant(l, r, c, frame[l][r][c]);
        heights[i] += (value - heights[i]) * ease(dt, 7);
        cubes.setMatrixAt(i, M.compose(P.set((c - 3.5) * 0.31, l * 0.8 + 0.25 + heights[i] * 0.12, (r - 1.5) * 0.3), Q, S.set(0.22, 0.22, 0.22)));
      }
      cubes.instanceMatrix.needsUpdate = true; outline.visible = keep;
      const bits = keep ? 7 : 4, length = 3 * bits / 16;
      footprint.scale.set(length, 0.18, 0.22); footprint.position.set(-1.5 + length / 2, -0.95, 0);
      out({ playing, readout: `${method} · calib ${baseline.toFixed(3)}→${ce.toFixed(3)} · held ${he.toFixed(3)} · ${keep ? 3 : 4} of 4 layers 4-bit` });
    },
    action(name, arg) {
      if (name === 'play') playing = !playing;
      else if (name === 'step') { playing = false; if (method === 'autoround') { index = Math.min(50, index + 10); time = index / 50 * 8; } }
      else if (name === 'method' && (arg === 'nearest' || arg === 'autoround') && arg !== method) { method = arg; index = 0; time = 0; playing = method === 'autoround'; }
      else if (name === 'keep') keep = arg === true;
    },
  };
}
