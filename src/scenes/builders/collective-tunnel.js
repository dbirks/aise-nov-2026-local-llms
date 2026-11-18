import { THREE, lam, ease, emitter } from './_kit.js';

function box(scene, x, y, w, h, d = 0.24, c = 0xc8c8c8) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), lam(c));
  m.position.set(x, y, 0); scene.add(m);
  const e = new THREE.LineSegments(new THREE.EdgesGeometry(m.geometry), new THREE.LineBasicMaterial({ color: 0x111111 }));
  m.add(e); return m;
}
function label(scene, text, x, y, h = 0.48) {
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

export default function build(scene, emit) {
  const out = emitter(emit); let phase = 'serve', playing = true, t = 0, growth = 1;
  box(scene, -2.65, 0, 2.1, 2.6); label(scene, 'home machine', -2.65, 1.72, 0.50);
  box(scene, -2.65, 0.55, 1.45, 0.62, 0.3, 0xeeeeee); label(scene, 'agent', -2.65, 0.55, 0.48);
  box(scene, -2.65, -0.55, 1.45, 0.62, 0.3, 0xeeeeee); label(scene, 'engine', -2.65, -0.55, 0.48);
  box(scene, -1.25, 0, 0.18, 3.4, 0.3, 0x444444); label(scene, 'home router', -1.25, -2.10, 0.48);
  box(scene, 2.65, 0, 1.95, 1.7); label(scene, 'gateway (k8s)', 2.65, 1.25, 0.50);
  const tube = box(scene, 0.5, 0, 2.9, 0.7, 0.18, 0x999999);
  const streams = [-0.19, 0, 0.19].map(y => line(scene, -1.16, y, 1.67, y, 0.045));
  label(scene, 'outbound WSS', 0.30, 0.80, 0.48);
  label(scene, 'Yamux streams', 0.30, -0.78, 0.48);
  line(scene, -0.25, -1.35, -1.0, -1.35, 0.07);
  line(scene, -0.80, -1.15, -1.0, -1.35, 0.07);
  line(scene, -0.80, -1.55, -1.0, -1.35, 0.07);
  line(scene, -0.68, -1.15, -0.32, -1.55, 0.08);
  line(scene, -0.68, -1.55, -0.32, -1.15, 0.08);
  label(scene, 'inbound blocked', 0.95, -1.45, 0.48);
  const packets = streams.map(() => box(scene, 0, 0, 0.18, 0.18, 0.25, 0x111111));
  return {
    view: { target: [0, 0, 0], radius: 40, theta: 0, phi: Math.PI / 2, size: 3.65 },
    update(dt) {
      if (playing) t = (t + dt) % 10;
      const target = phase === 'serve' ? 1 : Math.min(1, (t % 10) / 4);
      growth += (target - growth) * ease(dt, 6);
      tube.scale.x = Math.max(0.001, growth);
      tube.position.x = -1.16 + 1.45 * growth;
      streams.forEach(s => { s.scale.x = Math.max(0.001, growth); s.position.x = -1.16 + 1.415 * growth; });
      packets.forEach((m, i) => {
        m.visible = phase === 'serve';
        m.position.set(-1.05 + 2.60 * ((i % 2 ? 1 - (t / 5 + i / 3) % 1 : (t / 5 + i / 3) % 1)), (i - 1) * 0.19, 0.3);
      });
      out({ playing, readout: phase === 'serve' ? 'simulated · 1 outbound tunnel · 3 streams in flight · 0 inbound ports' : 'simulated · connect: outbound tunnel forming · 0 inbound ports' });
    },
    action(n, a) {
      if (n === 'phase' && ['connect', 'serve'].includes(a)) { phase = a; t = 0; }
      else if (n === 'play') playing = typeof a === 'boolean' ? a : !playing;
      else if (n === 'step' || n === 'back') { playing = false; phase = phase === 'serve' ? 'connect' : 'serve'; t = phase === 'connect' ? 2 : 0; }
    },
  };
}
