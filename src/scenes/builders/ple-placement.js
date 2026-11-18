import { THREE, lam, ease, emitter } from './_kit.js';

const TIERS = ['vram', 'ram', 'ssd'];

export default function build(scene, emit) {
  const g = new THREE.Group(); scene.add(g);
  const out = emitter(emit), box = new THREE.BoxGeometry(1, 1, 1), dark = lam(0x222222), mid = lam(0x777777), light = lam(0xc2c2c2);
  let playing = true, clock = 0, tier = 'ram';
  function block(x, y, z, w, h, d, mat = mid, parent = g) { const m = new THREE.Mesh(box, mat); m.position.set(x, y, z); m.scale.set(w, h, d); parent.add(m); return m; }
  function label(t, x, y, z, h = 0.45, parent = g, color = '#111') {
    const c = document.createElement('canvas'), a = c.getContext('2d');
    a.font = 'bold 76px sans-serif'; c.width = Math.ceil(a.measureText(t).width) + 24; c.height = 98;
    a.font = 'bold 76px sans-serif'; a.fillStyle = color; a.textBaseline = 'middle'; a.fillText(t, 12, 49);
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthTest: false }));
    s.scale.set(h * c.width / c.height, h, 1); s.position.set(x, y, z); s.renderOrder = 10; parent.add(s); return s;
  }
  label('Qwen PLE: n-gram table', 0, 2.85, 0, 0.48);
  label('Gemma PLE differs', 0, 2.30, 0, 0.45);
  const xs = { vram: -2.60, ram: 0, ssd: 2.60 };
  for (const [key, x] of Object.entries(xs)) {
    block(x, -0.55, 0, 2.20, 2.35, 0.2, light);
    label(key === 'vram' ? 'VRAM' : key === 'ram' ? 'system RAM' : 'NVMe SSD', x, 1.00, 0, 0.48);
  }
  label('layer 2', -2.60, -2.28, 0, 0.46);
  block(-2.60, -1.60, 0.3, 1.65, 0.20, 0.5, dark);
  const table = block(0, -0.35, 0.3, 2.05, 0.96, 0.35, dark);
  const tl = label('47.68 GiB FP8', 0, -0.35, 0.65, 0.44, g, '#f2f2f2');
  const cache = new THREE.Group(); g.add(cache);
  block(0, -1.35, 0.45, 1.95, 0.42, 0.2, mid, cache);
  label('hot rows cache', 0, -1.35, 0.72, 0.44, cache, '#f2f2f2');
  label('illustrative, not measured', 0, -2.85, 0, 0.45);
  const rows = [];
  for (let i = 0; i < 3; i++) rows.push(block(0, 0, 0.85, 0.18, 0.18, 0.18, dark));
  return {
    view: { target: [0, 0, 0], radius: 40, theta: 0, phi: 1.35, size: 3.35 },
    update(dt) {
      if (playing) clock = (clock + dt) % 12;
      const x = xs[tier];
      table.position.x += (x - table.position.x) * ease(dt, 6);
      tl.position.x = table.position.x;
      cache.visible = tier === 'ssd';
      const duration = tier === 'vram' ? 1 : tier === 'ram' ? 2 : 3;
      for (let i = 0; i < 3; i++) {
        const t = ((clock / duration + i * 0.18) % 1);
        rows[i].position.set(x + (-2.60 - x) * t, -0.35 - 1.25 * t, 0.85);
      }
      out({ playing, readout: `model card + vllm docs · 51.2B rows×dims · table in ${tier}` });
    },
    action(n, a) {
      if (n === 'play') playing = typeof a === 'boolean' ? a : !playing;
      else if (n === 'step') { playing = false; tier = TIERS[(TIERS.indexOf(tier) + 1) % TIERS.length]; }
      else if (n === 'back') { playing = false; tier = TIERS[(TIERS.indexOf(tier) - 1 + TIERS.length) % TIERS.length]; }
      else if (n === 'tier' && TIERS.includes(a)) tier = a;
    },
  };
}
