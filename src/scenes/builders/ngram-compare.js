import { THREE, lam, emitter } from './_kit.js';

export default function build(scene, emit) {
  const g = new THREE.Group(); scene.add(g);
  const out = emitter(emit), box = new THREE.BoxGeometry(1, 1, 1), dark = lam(0x222222), mid = lam(0x777777), light = lam(0xbbbbbb);
  let playing = true, clock = 0, beat = 0, model = 'both';
  function block(x, y, z, w, h, d, mat = mid, parent = g) { const m = new THREE.Mesh(box, mat); m.position.set(x, y, z); m.scale.set(w, h, d); parent.add(m); return m; }
  function label(t, x, y, z, h = 0.45, parent = g) {
    const c = document.createElement('canvas'), a = c.getContext('2d');
    a.font = 'bold 76px monospace'; c.width = Math.ceil(a.measureText(t).width) + 24; c.height = 98;
    a.font = 'bold 76px monospace'; a.fillStyle = '#111'; a.textBaseline = 'middle'; a.fillText(t, 12, 49);
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthTest: false }));
    s.scale.set(h * c.width / c.height, h, 1); s.position.set(x, y, z); s.renderOrder = 10; parent.add(s); return s;
  }
  function tube(a, b, parent = g) {
    const v = new THREE.Vector3(...b).sub(new THREE.Vector3(...a));
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, v.length(), 8), dark);
    m.position.copy(new THREE.Vector3(...a).add(new THREE.Vector3(...b)).multiplyScalar(0.5));
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), v.normalize()); parent.add(m); return m;
  }
  const groups = { ds: new THREE.Group(), qwen: new THREE.Group() }; g.add(groups.ds, groups.qwen);
  // DeepSeek V4.1-Flash: stack at x=-1.45, 2-layer Engram table at tx=-2.75
  label('DeepSeek V4.1-Flash', -2.05, 2.85, 0, 0.46, groups.ds);
  label('~196.6B · 2 layers', -2.05, 2.30, 0, 0.44, groups.ds);
  for (let i = 0; i < 8; i++) block(-1.45, -1.15 + i * 0.44, 0, 1.2, 0.16, 0.65, mid, groups.ds);
  block(-2.75, 0.55, 0, 1.15, 2.45, 0.14, light, groups.ds);
  for (const y of [-0.71, 1.49]) tube([-2.75, y, 0], [-1.45, y, 0], groups.ds);
  // Qwen3.8-Flash-Next: stack at x=+1.40, 1-layer PLE table at tx=+2.55
  label('Qwen3.8-Flash-Next', 1.98, 2.85, 0, 0.46, groups.qwen);
  label('51.2B · 20M rows', 1.98, 2.30, 0, 0.44, groups.qwen);
  for (let i = 0; i < 8; i++) block(1.40, -1.15 + i * 0.44, 0, 1.2, 0.16, 0.65, mid, groups.qwen);
  block(2.55, 0.55, 0, 0.72, 2.45, 0.14, light, groups.qwen);
  label('layer 2', 2.55, -1.10, 0, 0.44, groups.qwen);
  tube([2.55, -0.27, 0], [1.40, -0.27, 0], groups.qwen);

  label('toy hash · real differs', 0, -2.05, 0, 0.45);
  for (let i = 0; i < 5; i++) block(-1.16 + i * 0.58, -2.60, 0, 0.46, 0.34, 0.34, i > 2 ? dark : mid);
  const rows = [block(0, 0, 0.3, 0.28, 0.14, 0.2, dark), block(0, 0, 0.3, 0.28, 0.14, 0.2, dark), block(0, 0, 0.3, 0.28, 0.14, 0.2, dark)];
  return {
    view: { target: [-0.10, 0.10, 0], radius: 40, theta: 0, phi: 1.35, size: 3.35 },
    update(dt) {
      if (playing) { clock += dt; if (clock >= 10) clock = 0; beat = Math.floor(clock / 2.5); }
      const row = (3 * 31 + (beat + 4) * 17) % 8;
      groups.ds.visible = model !== 'qwen';
      groups.qwen.visible = model !== 'ds';
      rows[0].position.set(-2.75, -0.55 + row * 0.32, 0.3);
      rows[1].position.set(2.55, -0.55 + row * 0.32, 0.3);
      rows[2].position.set(-2.75 + (clock % 2.5) / 2.5 * 1.3, 1.49, 0.3);
      rows[0].visible = rows[2].visible = model !== 'qwen';
      rows[1].visible = model !== 'ds';
      out({ playing, readout: `model cards · deepseek 196.6B in 2 layers · qwen 51.2B at layer 2 · ${model}` });
    },
    action(n, a) {
      if (n === 'play') playing = typeof a === 'boolean' ? a : !playing;
      else if (n === 'step') { playing = false; beat = (beat + (Number(a) || 1) + 4) % 4; clock = beat * 2.5 + 1.2; }
      else if (n === 'back') { playing = false; beat = (beat - 1 + 4) % 4; clock = beat * 2.5 + 1.2; }
      else if (n === 'model' && ['ds', 'qwen', 'both'].includes(a)) model = a;
    },
  };
}
