import { THREE, lam, ease, emitter } from './_kit.js';

function box(scene, x, y, w, h, d = 0.24, c = 0xc8c8c8) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), lam(c));
  m.position.set(x, y, 0); scene.add(m);
  const e = new THREE.LineSegments(new THREE.EdgesGeometry(m.geometry), new THREE.LineBasicMaterial({ color: 0x111111 }));
  m.add(e); return m;
}
function label(scene, text, x, y, h = 0.50) {
  const c = document.createElement('canvas'), g = c.getContext('2d');
  g.font = 'bold 76px sans-serif'; c.width = Math.ceil(g.measureText(text).width) + 20; c.height = 96;
  g.font = 'bold 76px sans-serif'; g.fillStyle = '#111'; g.textBaseline = 'middle'; g.fillText(text, 10, 48);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthTest: false }));
  s.scale.set(h * c.width / c.height, h, 1); s.position.set(x, y, 0.8); s.renderOrder = 10; scene.add(s); return s;
}
function line(scene, x1, y1, x2, y2, width = 0.07, c = 0x222222) {
  const dx = x2 - x1, dy = y2 - y1;
  const m = box(scene, (x1 + x2) / 2, (y1 + y2) / 2, Math.hypot(dx, dy), width, 0.1, c);
  m.rotation.z = Math.atan2(dy, dx); return m;
}
const names = ['model-a 27B', 'model-b 35B-A3B', 'model-c 8B'];

export default function build(scene, emit) {
  const out = emitter(emit); let offline = false, playing = true, t = 0, fade = 1;
  box(scene, 0, 2.15, 3.5, 2.0);
  label(scene, 'gateway /models', 0, 3.52, 0.54);
  const rows = names.map((n, i) => label(scene, n, 0, 2.70 - i * 0.55, 0.50));
  const tubes = [], blocks = [];
  for (let i = 0; i < 3; i++) {
    const x = (i - 1) * 2.85;
    tubes.push(line(scene, x * 0.45, 1.15, x, 0.35, 0.1));
    box(scene, x, -0.65, 2.45, 1.85);
    label(scene, `home ${i + 1}`, x, -0.08, 0.52);
    label(scene, 'VRAM', x, -0.58, 0.49);
    box(scene, x, -1.15, 1.9, 0.32, 0.25, 0xeeeeee);
    blocks.push(box(scene, x, -1.15, 1.6, 0.22, 0.3, 0x222222));
    label(scene, names[i], x, -1.92, 0.49);
  }
  for (let i = 0; i < 12; i++) line(scene, -3.7 + i * 0.65, -2.42, -3.38 + i * 0.65, -2.42, 0.045);
  line(scene, -3.7, -2.42, -3.7, -2.22); line(scene, 3.77, -2.42, 3.77, -2.22);
  label(scene, 'NOT pooled', 0, -2.85, 0.52);
  line(scene, -0.22, -3.15, 0.22, -3.55, 0.08);
  line(scene, -0.22, -3.55, 0.22, -3.15, 0.08);
  return {
    view: { target: [0, 0.1, 0], radius: 40, theta: 0, phi: Math.PI / 2, size: 3.7 },
    update(dt) {
      if (playing) t = (t + dt) % 10;
      fade += ((offline ? 0.12 : 1) - fade) * ease(dt, 6);
      tubes[1].material.transparent = true; tubes[1].material.opacity = fade;
      blocks[1].visible = !offline; rows[1].visible = !offline;
      out({ playing, readout: `simulated · /models: ${offline ? 2 : 3} models · each runs on one machine` });
    },
    action(n, a) {
      if (n === 'offline') offline = typeof a === 'boolean' ? a : !offline;
      else if (n === 'play') playing = typeof a === 'boolean' ? a : !playing;
      else if (n === 'step' || n === 'back') { playing = false; offline = !offline; }
    },
  };
}
