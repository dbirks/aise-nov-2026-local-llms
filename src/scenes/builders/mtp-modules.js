import { THREE, lam, emitter } from './_kit.js';

export default function build(scene, emit) {
  const g = new THREE.Group(); scene.add(g); const out = emitter(emit);
  const box = new THREE.BoxGeometry(1, 1, 1), dark = lam(0x222222), mid = lam(0x666666);
  let steps = 1, playing = true, beat = 0, clock = 0;
  function slab(x, y, w, h, mat = dark) { const m = new THREE.Mesh(box, mat); m.position.set(x, y, 0); m.scale.set(w, h, 0.35); g.add(m); return m; }
  function label(s, x, y, h = 0.45) {
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
  for (let i = 0; i < 6; i++) slab(-2.35, -1.5 + i * 0.45, 1.4, 0.27, mid);
  slab(-2.35, 1.4, 1.8, 0.16);
  label('output head', -2.35, 1.82, 0.46);
  label('main model', -2.35, -2.02, 0.46);
  slab(1.15, 0.25, 1.6, 0.55, mid);
  slab(1.15, -0.25, 1.6, 0.16);
  label('mtp module', 1.15, 0.84, 0.46);
  label('projection', 1.15, -0.64, 0.46);
  arrow(-1.40, 1.0, 0.25, 0.45);
  label('hidden state', -0.45, 0.30, 0.43);
  line([[-1.45, 1.4, 0], [1.15, 1.4, 0], [1.15, 0.55, 0]], true);
  label('shared', -0.05, 1.82, 0.44);
  slab(1.15, -1.45, 1.5, 0.18);
  label('embedding', 1.15, -1.86, 0.46);
  line([[1.15, -1.35, 0], [2.45, -1.35, 0], [2.45, -0.25, 0], [1.95, -0.25, 0]], true);
  label('shared', 2.65, -0.95, 0.44);
  const loop = arrow(2.05, 0.35, 2.05, 0.85);
  const loopLine = line([[2.05, 0.85, 0], [2.85, 0.85, 0], [2.85, -0.1, 0], [2.05, -0.1, 0]]);
  const loopLabel = label('state + token', 2.65, 1.25, 0.44);
  label('t', -2.55, -2.62, 0.46);
  label('t+1 main', -0.65, -2.62, 0.46);
  const tokens = [label('t+2', 0.95, -2.62, 0.46), label('t+3', 2.05, -2.62, 0.46), label('t+4', 3.15, -2.62, 0.46)];
  return {
    view: { target: [0.20, -0.20, 0], radius: 40, theta: 0, phi: Math.PI / 2, size: 3.25 },
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
