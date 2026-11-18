// F01: documented examples, not an exhaustive compatibility matrix or benchmark.
import { THREE, lam, ease, emitter } from './_kit.js';

const engines = ['llamacpp', 'vllm', 'sglang', 'ninfer', 'radiance', 'pennyroyal'];
const names = ['llama.cpp', 'vLLM', 'SGLang', 'NInfer', 'Radiance', 'Pennyroyal'];
const rows = ['5090', 'PRO 6000', 'R9700', 'Apple', 'CPU'];
// 1 = documented example, 2 = speaker report, 0 = no source recorded.
const cells = [
  [1, 1, 1, 1, 0, 0],
  [1, 1, 1, 0, 0, 1],
  [1, 0, 0, 0, 2, 0],
  [1, 1, 0, 0, 0, 0],
  [1, 1, 1, 0, 0, 0],
];
const scopes = ['CUDA · Vulkan · Metal', 'GPU · CPU · Metal plugin', 'GPU · CPU backends', 'RTX 5090 · selected models', 'R9700 · speaker report', 'RTX PRO 6000 · Qwen3.8'];

function label(text, x, y, z, height = 0.32) {
  const canvas = document.createElement('canvas');
  const g = canvas.getContext('2d');
  g.font = 'bold 72px sans-serif';
  canvas.width = Math.ceil(g.measureText(text).width) + 16;
  canvas.height = 88;
  g.font = 'bold 72px sans-serif'; g.fillStyle = '#111111';
  g.textBaseline = 'middle'; g.fillText(text, 8, 44);
  const tex = new THREE.CanvasTexture(canvas); tex.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
  sprite.scale.set(height * canvas.width / canvas.height, height, 1);
  sprite.position.set(x, y, z); sprite.renderOrder = 10;
  return sprite;
}

export default function build(scene, emit) {
  const out = emitter(emit);
  let selected = 'all', unknown = true, playing = true, elapsed = 0, beat = 0;
  const columns = [], scopesLabels = [];
  const dx = 1.3, dz = 1.12;
  for (let c = 0; c < 6; c++) {
    const group = new THREE.Group(); scene.add(group); columns.push(group);
    const x = (c - 2.5) * dx;
    group.add(label(names[c], x, 1.25, c % 2 === 0 ? -2.95 : -3.6, 0.42));  // above the pillar tops (0.87)  // staggered so names don't collide
    const scope = label(scopes[c], -0.3, 2.3, -4.3, 0.42);
    scope.visible = false; scene.add(scope); scopesLabels.push(scope);
    for (let r = 0; r < 5; r++) {
      const z = (r - 2) * dz;
      const tile = new THREE.Mesh(new THREE.BoxGeometry(0.91, 0.06, 0.65), lam(0xc4c4c4));
      tile.position.set(x, 0, z); group.add(tile);
      group.add(new THREE.LineSegments(new THREE.EdgesGeometry(tile.geometry), new THREE.LineBasicMaterial({ color: 0x555555 })));
      group.children[group.children.length - 1].position.copy(tile.position);
      if (cells[r][c] === 1) {
        const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.85, 0.4), lam(0x242424));
        pillar.position.set(x, 0.45, z); group.add(pillar);
      } else if (cells[r][c] === 2) {
        const outline = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(0.56, 0.35, 0.42)), new THREE.LineBasicMaterial({ color: 0x111111 }));
        outline.position.set(x, 0.2, z); outline.userData.unverified = true; group.add(outline);
      }
    }
  }
  rows.forEach((name, r) => scene.add(label(name, -4.55, 0.12, (r - 2) * dz, 0.42)));
  scene.add(label('dark: documented', -0.9, 0.1, 3.2, 0.36));
  scene.add(label('outline: speaker report', 1.0, 0.1, 3.85, 0.36));
  scene.add(label('empty: no source', 2.9, 0.1, 3.2, 0.36));
  const apply = () => {
    columns.forEach((group, c) => {
      const active = selected === 'all' || selected === engines[c];
      group.traverse(obj => {
        if (obj.userData.unverified) obj.visible = unknown;
        if (obj.material) {
          obj.material.transparent = true;
          obj.material.opacity = active ? 1 : 0.16;
        }
      });
      scopesLabels[c].visible = selected === engines[c];
    });
  };
  apply();
  return {
    view: { target: [-0.6, 0.2, 0], radius: 40, theta: 0.08, phi: 0.6, size: 4.0 },
    update(dt) {
      if (playing) { elapsed += dt; if (elapsed >= 2) { elapsed = 0; beat = (beat + 1) % 6; } }
      columns.forEach((group, c) => {
        const target = selected === 'all' && c === beat ? 1.04 : 1;
        group.scale.y += (target - group.scale.y) * ease(dt, 7);
      });
      const idx = engines.indexOf(selected);
      const count = idx < 0 ? cells.flat().filter(v => v === 1).length : cells.filter(row => row[idx] === 1).length;
      const readout = idx < 0
        ? `all: ${count} sourced cells · unverified ${unknown ? 'shown' : 'hidden'}`
        : `${selected}: documented on ${count} of 5 rows · unverified ${unknown ? 'shown' : 'hidden'}`;
      out({ playing, readout });
    },
    action(name, arg) {
      if (name === 'play') playing = !playing;
      else if (name === 'step') { beat = (beat + 1) % 6; elapsed = 0; selected = engines[beat]; apply(); }
      else if (name === 'engine' && (arg === 'all' || engines.includes(arg))) { selected = arg; apply(); }
      else if (name === 'unknown') { unknown = !!arg; apply(); }
    },
  };
}
