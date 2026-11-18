import { THREE, lam, emitter } from './_kit.js';

export default function build(scene, emit) {
  const g = new THREE.Group(); scene.add(g); const out = emitter(emit);
  const box = new THREE.BoxGeometry(1, 1, 1), dark = lam(0x222222), mid = lam(0x666666);
  let steps = 1, playing = true, beat = 0, clock = 0;
  function slab(x, y, w, h, mat = dark) { const m = new THREE.Mesh(box, mat); m.position.set(x, y, 0); m.scale.set(w, h, 0.35); g.add(m); return m; }
  function label(s, x, y, h = 0.48) {
    const c = document.createElement('canvas'), p = c.getContext('2d');
    p.font = 'bold 76px monospace'; c.width = Math.ceil(p.measureText(s).width) + 24; c.height = 98;
    p.font = 'bold 76px monospace'; p.fillStyle = '#111'; p.textBaseline = 'middle'; p.fillText(s, 12, 49);
    const v = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthTest: false, transparent: true }));
    v.scale.set(h * c.width / c.height, h, 1); v.position.set(x, y, 0.5); v.renderOrder = 10; g.add(v); return v;
  }
  function line(points, dashed = false) {
    const geo = new THREE.BufferGeometry().setFromPoints(points.map(p => new THREE.Vector3(...p)));
    const l = new THREE.Line(geo, dashed ? new THREE.LineDashedMaterial({ color: 0x222222, dashSize: 0.12, gapSize: 0.08 }) : new THREE.LineBasicMaterial({ color: 0x111111 }));
    if (dashed) l.computeLineDistances(); g.add(l); return l;
  }
  function arrow(x1, y1, x2, y2) {
    const a = new THREE.Vector3(x1, y1, 0), b = new THREE.Vector3(x2, y2, 0), d = b.clone().sub(a);
    const ar = new THREE.ArrowHelper(d.clone().normalize(), a, d.length(), 0x111111, 0.16, 0.1);
    g.add(ar); return ar;
  }
  for (let i = 0; i < 6; i++) slab(-2.65, -1.5 + i * 0.45, 1.4, 0.27, mid);
  slab(-2.65, 1.4, 1.8, 0.16);
  label('output head', -2.65, 1.82, 0.48);
  label('main model', -2.65, -2.02, 0.48);
  slab(1.65, 0.25, 1.6, 0.55, mid);
  slab(1.65, -0.25, 1.6, 0.16);
  label('mtp module', 1.65, 0.84, 0.48);
  label('projection', 1.65, -0.64, 0.48);
  arrow(-1.70, 1.0, 0.65, 0.45);
  label('hidden state', -0.52, 0.22, 0.47);
  line([[-1.75, 1.4, 0], [1.65, 1.4, 0], [1.65, 0.55, 0]], true);
  label('shared', -0.05, 1.82, 0.47);
  slab(1.65, -1.45, 1.5, 0.18);
  label('embedding', 1.65, -1.86, 0.48);
  line([[1.65, -1.35, 0], [2.85, -1.35, 0], [2.85, -0.25, 0], [2.45, -0.25, 0]], true);
  label('shared', 3.45, -1.18, 0.47);
  const loop = arrow(2.55, 0.35, 2.55, 0.85);
  const loopLine = line([[2.55, 0.85, 0], [3.35, 0.85, 0], [3.35, -0.1, 0], [2.55, -0.1, 0]]);
  const loopLabel = label('state + token', 2.95, 1.28, 0.47);
  label('t', -2.75, -2.62, 0.48);
  label('t+1 main', -0.70, -2.62, 0.48);
  const tokens = [label('t+2', 1.20, -2.62, 0.48), label('t+3', 2.30, -2.62, 0.48), label('t+4', 3.40, -2.62, 0.48)];
  return {
    view: { target: [0.05, -0.20, 0], radius: 40, theta: 0, phi: Math.PI / 2, size: 3.6 },
    update(dt) {
      if (playing) { clock += dt; if (clock > 3) { clock = 0; beat = (beat + 1) % 4; } }
      tokens.forEach((t, i) => { t.visible = i < steps; t.material.opacity = beat === i + 1 ? 1 : 0.65; });
      loop.visible = loopLine.visible = loopLabel.visible = steps > 1;
      out({ playing, readout: `simulated · 1 mtp module looped ${steps}× · drafts t+2${steps > 1 ? `…t+${steps + 1}` : ''} · target verifies` });
    },
    action(name, arg) {
      if (name === 'play') playing = typeof arg === 'boolean' ? arg : !playing;
      else if (name === 'step') { playing = false; beat = (beat + (Number(arg) || 1) + 4) % 4; clock = 0; }
      else if (name === 'back') { playing = false; beat = (beat - 1 + 4) % 4; clock = 0; }
      else if (name === 'steps' && [1, 2, 3].includes(Number(arg))) steps = Number(arg);
    },
  };
}
