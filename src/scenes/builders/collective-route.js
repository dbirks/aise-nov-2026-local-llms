import { THREE, lam, emitter } from './_kit.js';

function box(scene, x, y, w, h, d = 0.24, c = 0xc8c8c8) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), lam(c));
  m.position.set(x, y, 0); scene.add(m);
  const e = new THREE.LineSegments(new THREE.EdgesGeometry(m.geometry), new THREE.LineBasicMaterial({ color: 0x111111 }));
  m.add(e); return m;
}
function label(scene, text, x, y, h = 0.52) {
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
  const out = emitter(emit); let selected = 0, playing = true, t = 0;
  box(scene, -3.45, 0, 1.6, 1.2);
  label(scene, 'client', -3.45, 0.98, 0.52);
  label(scene, 'API key', -3.45, -0.05, 0.51);
  box(scene, -0.60, 0, 3.1, 3.1);
  label(scene, 'gateway', -0.60, 1.98, 0.54);
  label(scene, '/models', -0.60, 1.15, 0.52);
  const rows = names.map((n, i) => label(scene, n, -0.50, 0.45 - i * 0.70, 0.51));
  const homes = [];
  for (let i = 0; i < 3; i++) {
    const y = 2.05 - i * 2.05;
    box(scene, 2.80, y, 2.85, 1.65);
    label(scene, `home ${i + 1} · GPU`, 2.80, y + 0.36, 0.51);
    label(scene, names[i], 2.80, y - 0.36, 0.51);
    homes.push(line(scene, 0.95, 0, 1.38, y, 0.06, 0x777777));
  }
  line(scene, -2.65, 0, -2.15, 0);
  const packet = box(scene, 0, 0, 0.28, 0.22, 0.3, 0x111111);
  const marker = box(scene, -1.92, 0, 0.14, 0.30, 0.3, 0x111111);
  label(scene, 'request / response', -0.45, -3.10, 0.52);
  return {
    view: { target: [0, 0, 0], radius: 40, theta: 0, phi: Math.PI / 2, size: 3.85 },
    update(dt) {
      if (playing) t = (t + dt) % 10;
      homes.forEach((m, i) => m.material.color.setHex(i === selected ? 0x111111 : 0xaaaaaa));
      marker.position.y = 0.45 - selected * 0.70;
      rows.forEach((s, i) => { s.material.opacity = i === selected ? 1 : 0.55; });
      const u = (t % 10) / 10, v = u < 0.5 ? u * 2 : (1 - u) * 2, dest = 2.05 - selected * 2.05;
      if (v < 0.35) packet.position.set(-2.65 + v / 0.35 * 1.15, 0, 0.4);
      else { const q = (v - 0.35) / 0.65; packet.position.set(-1.50 + q * 3.00, q * dest, 0.4); }
      out({ playing, readout: `simulated · model-${'abc'[selected]} → home ${selected + 1} · one machine serves the whole request` });
    },
    action(n, a) {
      if (n === 'model') { const i = names.indexOf(a); if (i >= 0) selected = i; t = 0; }
      else if (n === 'play') playing = typeof a === 'boolean' ? a : !playing;
      else if (n === 'step') { playing = false; selected = (selected + 1) % 3; t = 0; }
      else if (n === 'back') { playing = false; selected = (selected + 2) % 3; t = 0; }
    },
  };
}
