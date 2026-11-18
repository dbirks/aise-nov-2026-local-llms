// Schematic release chronology; dates are source creation/submission months, not benchmarks.
import { THREE, lam, ease, emitter } from './_kit.js';

export default function build(scene, emit) {
  const out = emitter(emit);
  const xs = [-3.9, -1.3, 1.3, 3.9];
  const keys = ['paper', 'v4', 'qwen', 'v41'];
  const descriptions = [
    'paper · hash rows and gate · research mechanism',
    'deepseek v4 flash · no engram documented',
    'qwen3.8-flash-next · ple ~51b n-gram params · separate design',
    'deepseek v4.1 flash · 196b engram params · conditional memory',
  ];
  const label = (text, x, y, z = 0, height = 0.32) => {
    const canvas = document.createElement('canvas');
    const c = canvas.getContext('2d');
    c.font = 'bold 72px monospace';
    canvas.width = Math.ceil(c.measureText(text).width) + 20;
    canvas.height = 90;
    c.font = 'bold 72px monospace'; c.fillStyle = '#111111'; c.textBaseline = 'middle';
    c.fillText(text, 10, 45);
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(canvas), transparent: true, depthWrite: false }));
    sprite.scale.set(height * canvas.width / canvas.height, height, 1);
    sprite.position.set(x, y, z); scene.add(sprite); return sprite;
  };
  const box = (x, y, z, w, h, d, color = 0x333333) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), lam(color));
    mesh.position.set(x, y, z); scene.add(mesh); return mesh;
  };
  box(0, -1.3, 0, 8.3, 0.07, 0.12, 0x222222);
  const markers = xs.map(x => box(x, -1.3, 0, 0.2, 0.25, 0.22));
  const dates = ['jan 2026', 'apr 2026', 'aug 2026', 'sep 2026'];
  const names = ['engram paper', 'deepseek v4', 'qwen3.8 flash next', 'deepseek v4.1'];
  xs.forEach((x, i) => { label(dates[i], x, -1.75); label(names[i], x, -2.15, 0, 0.27); });
  // Paper: the lookup path is schematic, not a claim of identical implementations.
  ['hash', 'rows', 'gate'].forEach((s, i) => {
    const x = xs[0] + (i - 1) * 0.65;
    box(x, 0.25, 0, 0.45, 0.45, 0.25, 0x777777);
    label(s, x, 0.8, 0, 0.25);
  });
  box(xs[0], 0.25, -0.05, 1.7, 0.06, 0.08, 0x222222);
  // Model blocks are schematic. Table heights use sqrt(parameter count).
  [1, 2, 3].forEach(i => { box(xs[i], -0.55, 0, 1.35, 0.58, 0.55, 0x444444); label('model', xs[i], -0.55, 0.4, 0.28); });
  label('no engram', xs[1], 0.4, 0, 0.28);
  label('documented', xs[1], 0.05, 0, 0.28);
  const tables = [], detailObjects = [];
  [51, 196].forEach((n, index) => {
    const i = index + 2, h = 1.65 * Math.sqrt(n / 196);
    const table = box(xs[i], -0.18 + h / 2, 0, 0.85, h, 0.35, 0x777777);
    tables.push(table);
    // Distinct vertical/horizontal table detail indicates independent designs.
    if (index === 0) {
      for (let j = -1; j <= 1; j++) detailObjects.push(box(xs[i] + j * 0.23, -0.18 + h / 2, 0.2, 0.035, h, 0.04, 0x161616));
    } else {
      for (let j = 1; j <= 4; j++) detailObjects.push(box(xs[i], -0.18 + h * j / 5, 0.2, 0.85, 0.035, 0.04, 0x161616));
    }
  });
  const sizeLabels = [label('~51b ple', xs[2], 1.12, 0, 0.29), label('196b engram', xs[3], 1.8, 0, 0.29)];
  const highlight = box(xs[0], -1.3, 0.32, 0.43, 0.43, 0.08, 0x111111);
  const focusLabels = [
    label('hash → rows → gate', 0, 2.55, 0, 0.38),
    label('no engram documented', 0, 2.55, 0, 0.38),
    label('ple · separate design', 0, 2.55, 0, 0.38),
    label('engram · conditional memory', 0, 2.55, 0, 0.38),
  ];
  let focus = 0, playing = true, scale = true, timer = 0;
  const setFocus = i => { focus = (i + 4) % 4; timer = 0; };
  return {
    view: { target: [0, 0.1, 0], radius: 40, theta: 0, phi: Math.PI / 2, size: 3.6 },
    update(dt) {
      if (playing) { timer += dt; if (timer >= 2.5) setFocus(focus + 1); }
      highlight.position.x += (xs[focus] - highlight.position.x) * ease(dt, 7);
      focusLabels.forEach((s, i) => { s.visible = i === focus; });
      markers.forEach((m, i) => { m.scale.y += ((i === focus ? 1.7 : 1) - m.scale.y) * ease(dt, 7); });
      tables.forEach(t => { t.visible = scale; });
      sizeLabels.forEach(s => { s.visible = scale; });
      // The dark table dividers follow the table visibility.
      detailObjects.forEach(o => { o.visible = scale; });
      out({ playing, readout: descriptions[focus] + (scale ? '' : ' · sizes hidden') });
    },
    action(name, arg) {
      if (name === 'play') playing = typeof arg === 'boolean' ? arg : !playing;
      if (name === 'step') setFocus(focus + (arg === -1 ? -1 : 1));
      if (name === 'focus' && keys.includes(arg)) setFocus(keys.indexOf(arg));
      if (name === 'scale') scale = typeof arg === 'boolean' ? arg : !scale;
    },
  };
}
