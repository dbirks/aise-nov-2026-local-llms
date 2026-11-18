import { THREE, lam, ease, emitter } from './_kit.js';

export default function build(scene, emit) {
  const g = new THREE.Group(); scene.add(g);
  const out = emitter(emit), box = new THREE.BoxGeometry(1, 1, 1), dark = lam(0x222222), mid = lam(0x777777), light = lam(0xbbbbbb);
  let playing = true, clock = 0, beat = 0, where = 'cpu';
  function block(x, y, z, w, h, d, mat = mid, parent = g) { const m = new THREE.Mesh(box, mat); m.position.set(x, y, z); m.scale.set(w, h, d); parent.add(m); return m; }
  function label(t, x, y, z, h = 0.44, parent = g) {
    const c = document.createElement('canvas'), a = c.getContext('2d');
    a.font = 'bold 76px monospace'; c.width = Math.ceil(a.measureText(t).width) + 24; c.height = 98;
    a.font = 'bold 76px monospace'; a.fillStyle = '#111'; a.textBaseline = 'middle'; a.fillText(t, 12, 49);
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthTest: false }));
    s.scale.set(h * c.width / c.height, h, 1); s.position.set(x, y, z); s.renderOrder = 10; parent.add(s); return s;
  }
  function tube(a, b, parent = g) {
    const v = new THREE.Vector3(...b).sub(new THREE.Vector3(...a));
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, v.length(), 8), dark);
    m.position.copy(new THREE.Vector3(...a).add(new THREE.Vector3(...b)).multiplyScalar(0.5));
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), v.normalize()); parent.add(m); return m;
  }
  label('Gemma: per-layer embeddings', 0, 3.05, 0, 0.46);
  label('not Qwen n-gram PLE', 0, 2.52, 0, 0.44);
  label('6 of 30 layers', 2.05, 1.92, 0, 0.44);
  label('PLE: 262,144 rows', -1.95, 1.92, 0, 0.44);
  label('E2B ≈ 2.01B params', -1.95, 1.40, 0, 0.44);
  const table = new THREE.Group(); g.add(table);
  block(0, 0, 0, 2.5, 1.75, 0.12, light, table);
  for (let i = 0; i < 6; i++) block(-1.0 + i * 0.4, 0, 0.1, 0.035, 1.75, 0.08, dark, table);
  block(0, 0, 0.2, 2.5, 0.13, 0.08, dark, table);
  label('256 per band', 0, -1.22, 0, 0.44, table);
  for (let i = 0; i < 6; i++) {
    const y = -1.35 + i * 0.48;
    block(2.05, y, 0, 1.6, 0.13, 0.7, mid);
    tube([-0.65, y, 0], [1.25, y, 0]);
  }
  label('GPU', 2.05, -2.05, 0, 0.46);
  label('CPU RAM', -1.95, -2.05, 0, 0.46);
  const payload = block(0, 0, 0.35, 0.32, 0.15, 0.15, dark);
  return {
    view: { target: [0.05, 0.10, 0], radius: 40, theta: 0, phi: 1.35, size: 3.25 },
    update(dt) {
      if (playing) { clock = (clock + dt) % 10; beat = Math.floor(clock / 1.67) % 6; }
      table.position.x += ((-1.95 + (where === 'gpu' ? 0.95 : 0)) - table.position.x) * ease(dt, 6);
      table.position.y += ((where === 'gpu' ? 0.15 : -0.05) - table.position.y) * ease(dt, 6);
      payload.position.set(-0.65 + (clock % 1.67) / 1.67 * 1.90, -1.35 + beat * 0.48, 0.35);
      out({ playing, readout: `spec · gemma 3n e2b · 1 row per token · 30 × 256 numbers · table in ${where === 'cpu' ? 'cpu ram' : 'gpu'}` });
    },
    action(n, a) {
      if (n === 'play') playing = typeof a === 'boolean' ? a : !playing;
      else if (n === 'step') { playing = false; beat = (beat + (Number(a) || 1) + 6) % 6; clock = beat * 1.67 + 0.85; }
      else if (n === 'back') { playing = false; beat = (beat - 1 + 6) % 6; clock = beat * 1.67 + 0.85; }
      else if (n === 'where' && ['gpu', 'cpu'].includes(a)) where = a;
    },
  };
}
