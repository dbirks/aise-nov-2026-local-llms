import { THREE, lam, emitter } from './_kit.js';

export default function build(scene, emit) {
  const group = new THREE.Group(); scene.add(group);
  const out = emitter(emit), box = new THREE.BoxGeometry(1, 1, 1);
  const dark = lam(0x222222), pale = lam(0xc8c8c8), mid = lam(0x777777);
  let draft = 'tree', accept = 'left', playing = true, beat = 0, clock = 0;
  const drawing = new THREE.Group(); group.add(drawing);
  function label(text, x, y, size = 0.46) {
    const c = document.createElement('canvas'), g = c.getContext('2d');
    g.font = 'bold 76px monospace'; c.width = Math.ceil(g.measureText(text).width) + 24; c.height = 98;
    g.font = 'bold 76px monospace'; g.fillStyle = '#111'; g.textBaseline = 'middle'; g.fillText(text, 12, 49);
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthTest: false }));
    s.scale.set(size * c.width / c.height, size, 1); s.position.set(x, y, 0.5); s.renderOrder = 10; drawing.add(s);
  }
  function cube(x, y, w, h, material, z = 0) { const m = new THREE.Mesh(box, material); m.position.set(x, y, z); m.scale.set(w, h, 0.16); drawing.add(m); }
  function tube(a, b) { const from = new THREE.Vector3(...a), to = new THREE.Vector3(...b), d = to.clone().sub(from); const m = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, d.length(), 8), mid); m.position.copy(from.add(to).multiplyScalar(0.5)); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()); drawing.add(m); }
  function rebuild() {
    while (drawing.children.length) { const o = drawing.children[0]; drawing.remove(o); if (o.isSprite) { o.material.map.dispose(); o.material.dispose(); } else if (o.geometry !== box) o.geometry.dispose(); }
    const nodes = draft === 'tree' ? [
      { p: -1, x: -3.05, y: 0, word: 'start' },
      { p: 0, x: -2.0, y: 1.08, word: 'the' }, { p: 0, x: -2.0, y: -1.08, word: 'a' },
      { p: 1, x: -0.95, y: 1.08, word: 'cat' }, { p: 2, x: -0.95, y: -1.08, word: 'dog' },
      { p: 3, x: 0.1, y: 1.08, word: 'sat' }, { p: 4, x: 0.1, y: -1.08, word: 'ran' },
    ] : [0, 1, 2, 3].map((_, i) => ({ p: i - 1, x: -3.05 + i * 1.05, y: 0, word: ['start', 'the', 'cat', 'sat'][i] }));
    const path = draft === 'tree' ? (accept === 'left' ? [0, 1, 3, 5] : [0, 2, 4, 6]) : [0, 1, 2, 3];
    nodes.forEach((n, i) => {
      if (n.p >= 0) tube([nodes[n.p].x, nodes[n.p].y, 0], [n.x, n.y, 0]);
      cube(n.x, n.y, 0.8, 0.44, beat >= 2 && !path.includes(i) ? pale : dark);
      label(n.word, n.x, n.y + 0.48, 0.44);
    });
    label(draft === 'tree' ? 'draft tree' : 'draft line', -1.5, 2.35, 0.48);
    label('attention mask', 2.25, 2.35, 0.48);
    label('prompt', 1.15, 1.80, 0.44);
    const count = nodes.length, cell = count === 7 ? 0.40 : 0.54, left = 1.20, top = 1.30;
    for (let i = 0; i < count; i++) {
      const ancestors = new Set(); for (let j = i; j >= 0; j = nodes[j].p) ancestors.add(j);
      cube(left - cell, top - i * cell, cell * 0.82, cell * 0.82, dark);
      for (let j = 0; j < count; j++) cube(left + j * cell, top - i * cell, cell * 0.82, cell * 0.82, ancestors.has(j) ? dark : pale);
    }
    label('row sees column', 2.25, -2.05, 0.44);
    label(beat >= 2 ? 'accepted path' : 'checking branches', -1.5, -2.05, 0.44);
  }
  rebuild();
  return {
    view: { target: [0.08, 0.05, 0], radius: 40, theta: 0, phi: Math.PI / 2, size: 3.3 },
    update(dt) {
      if (playing) { clock += dt; if (clock >= 3) { clock = 0; beat = (beat + 1) % 4; rebuild(); } }
      out({ playing, readout: `simulated · ${draft} of ${draft === 'tree' ? 7 : 4} · ${accept} path · 3 + 1 bonus · 1 target pass` });
    },
    action(name, arg) {
      if (name === 'play') playing = typeof arg === 'boolean' ? arg : !playing;
      else if (name === 'step') { playing = false; beat = (beat + (Number(arg) || 1) + 4) % 4; clock = 0; rebuild(); }
      else if (name === 'back') { playing = false; beat = (beat - 1 + 4) % 4; clock = 0; rebuild(); }
      else if (name === 'draft' && ['line', 'tree'].includes(arg)) { draft = arg; rebuild(); }
      else if (name === 'accept' && ['left', 'right'].includes(arg)) { accept = arg; beat = 2; rebuild(); }
    },
  };
}
