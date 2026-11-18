import { THREE, lam, ease, emitter } from './_kit.js';

// Toy token positions along x, request lanes along z, KV blocks above the tokens.
const lanes = [-1.5, 0, 1.5], starts = [0.2, 3, 5.8], loop = 10;
const BEAT_T = [0.3, 2.2, 3.1, 5, 5.9, 8];        // story beats: step goes forward, back reverses
const xToken = i => -3.75 + i * 0.5;
const xBlock = i => xToken(i * 4) + 0.75;
function label(scene, text, x, y, z, h = 0.38) {
  const canvas = document.createElement('canvas'), g = canvas.getContext('2d');
  g.font = 'bold 72px sans-serif';
  canvas.width = Math.ceil(g.measureText(text).width) + 16; canvas.height = 90;
  g.font = 'bold 72px sans-serif'; g.fillStyle = '#111'; g.textBaseline = 'middle'; g.fillText(text, 8, 46);
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false }));
  sprite.scale.set(h * canvas.width / canvas.height, h, 1); sprite.position.set(x, y, z); sprite.renderOrder = 10; scene.add(sprite); return sprite;
}
function box(scene, w, h, d, color, x, y, z) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), lam(color)); m.position.set(x, y, z); scene.add(m); return m;
}
function line(scene, points) {
  const obj = new THREE.Line(new THREE.BufferGeometry().setFromPoints(points.map(p => new THREE.Vector3(...p))), new THREE.LineBasicMaterial({ color: 0x333333 })); scene.add(obj); return obj;
}
export default function build(scene, emit) {
  const out = emitter(emit);
  const tiles = [], privateBlocks = [], refs = [], ticks = [];
  label(scene, 'shared KV · hash chain', 0, 3.05, -1.2);
  label(scene, 'toy block = 4 tokens', 0, -0.8, 2.4);
  label(scene, 'vLLM default larger', 0, -1.25, 2.4);
  lanes.forEach((z, r) => {
    label(scene, `request ${'ABC'[r]}`, 4.95, 0.15, z);
    tiles[r] = []; privateBlocks[r] = []; refs[r] = [];
    for (let i = 0; i < 16; i++) {
      const tile = box(scene, 0.43, 0.12, 0.52, 0x777777, xToken(i), 0, z);
      tiles[r].push(tile);
    }
    for (let b = 0; b < 4; b++) {
      const block = box(scene, 1.65, 0.3, 0.42, 0x222222, xBlock(b), 0.55, z); privateBlocks[r].push(block);
      refs[r].push(line(scene, [[xBlock(b), 0.23, z], [xBlock(b), 2, -1.2]]));
    }
  });
  label(scene, 'system + tools', -1.1, -0.35, -1.5, 0.32);
  label(scene, 'request suffix', 3, -0.35, -1.5, 0.32);
  const shared = [];
  for (let b = 0; b < 4; b++) {
    const group = new THREE.Group(); scene.add(group); group.position.set(xBlock(b), 2, -1.2);
    for (let k = 0; k < 2; k++) { const m = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.22, 0.48), lam(0x222222)); m.position.y = k * 0.24; group.add(m); }
    const cap = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.08, 0.56), lam(0x555555)); cap.position.y = 0.49; group.add(cap);
    shared.push(group); ticks[b] = [];
    for (let r = 0; r < 3; r++) { const tick = box(scene, 0.17, 0.09, 0.1, 0x111111, xBlock(b) - 0.4 + r * 0.4, 2.18, -0.87); ticks[b].push(tick); }
    if (b < 3) line(scene, [[xBlock(b) + 0.85, 2.48, -1.2], [xBlock(b + 1) - 0.85, 2.48, -1.2]]);
  }
  const changed = label(scene, 'date changed', 0, 1.1, 0, 0.34);
  const hatch = [];
  for (let k = 0; k < 3; k++) hatch.push(box(scene, 0.05, 0.025, 0.65, 0x111111, 0, 0.09, 0));
  let t = 0, playing = true, change = -1, evicted = false, fall = 0;
  return {
    view: { target: [0.5, 0.75, 0], radius: 40, theta: 0.15, phi: 1.1, size: 3.9 },
    update(dt) {
      if (playing) t = (t + dt) % loop;
      fall += ((evicted ? 1 : 0) - fall) * ease(dt, 6);
      const reused = evicted ? [0, 0, 0] : [0, change < 0 ? 3 : Math.floor(change / 4), 3];
      lanes.forEach((z, r) => {
        const progress = Math.max(0, Math.min(1, (t - starts[r]) / 1.8));
        const from = reused[r] * 4;
        tiles[r].forEach((tile, i) => { tile.material.color.setHex(i >= from && i < from + (16 - from) * progress ? 0x222222 : 0x999999); });
        for (let b = 0; b < 4; b++) {
          privateBlocks[r][b].visible = b >= reused[r] && !(r === 0 && !evicted && b < 3) && progress * (4 - reused[r]) > b - reused[r];
          refs[r][b].visible = r > 0 && b < reused[r] && t >= starts[r];
        }
      });
      shared.forEach((group, b) => {
        group.visible = b < 3 && t > starts[0] + (b + 1) * 0.35 && fall < 0.98;
        group.position.y = 2 - fall * 2.5; group.scale.setScalar(Math.max(0.001, 1 - fall));
        ticks[b].forEach((tick, r) => { tick.visible = group.visible && (r === 0 || (b < reused[r] && t >= starts[r])); tick.position.y = 2.18 - fall * 2.5; });
      });
      changed.visible = change >= 0; changed.position.x = change >= 0 ? xToken(change) : 0;
      hatch.forEach((stripe, k) => { stripe.visible = change >= 0; stripe.position.set(xToken(Math.max(change, 0)) + (k - 1) * 0.12, 0.09, 0); stripe.rotation.y = 0.55; });
      const cached = reused[1] * 4;
      const stored = evicted ? 12 : 4 + (4 - reused[1]) + 1;
      out({ playing, readout: `b: ${cached} cached · ${16 - cached} recomputed · stored blocks ${stored} (12 without sharing)${evicted ? ' · evicted' : ''}` });
    },
    action(name, arg) {
      if (name === 'play') playing = !playing;
      else if (name === 'step') { playing = false; t = BEAT_T.find(v => v > t + 0.05) ?? BEAT_T[0]; }
      else if (name === 'back') { playing = false; t = [...BEAT_T].reverse().find(v => v < t - 0.05) ?? BEAT_T[BEAT_T.length - 1]; }
      else if (name === 'change') { change = [-1, 3, 9].includes(Number(arg)) ? Number(arg) : -1; t = 3.1; }
      else if (name === 'evict') { evicted = !!arg; t = 3.1; }
    },
  };
}
