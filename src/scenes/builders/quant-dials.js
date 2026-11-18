import { THREE, lam, ghost, ease, emitter } from './_kit.js';

// Deck v2 quant-types B — "Three separate dials".
// Weights / activations / KV cache are three independent settings (docs/research/v2/embed-quant.md §4).
// Slab height = bit-width (UNIT world units per bit). Bit widths 16 / 8 / 4 are format facts;
// NVFP4 shows 4 payload + a hatched 0.5-bit block-scale plate (4.5 bits/element, NVIDIA NVFP4 blog).
// step / back cycle the weights dial (the story is the dial independence, not a timeline).
const UNIT = 0.125;
const FORMATS = {
  bf16: { body: 16, aBits: 16, scheme: 'bf16', ruler: 'dense', tag: 'bf16', bits: '16 bits' },
  int4: { body: 4, aBits: 16, scheme: 'w4a16', ruler: 'int4', tag: 'int4', bits: '4 bits' },
  nvfp4: { body: 4, aBits: 4, scheme: 'w4a4', ruler: 'nvfp4', tag: 'nvfp4', bits: '4.5 bits' },
};
const KV = { bf16: { bits: 16, tag: 'bf16', bitsTag: '16 bits' }, fp8: { bits: 8, tag: 'fp8', bitsTag: '8 bits' } };
// E2M1 magnitudes, signed: {0, ±0.5, ±1, ±1.5, ±2, ±3, ±4, ±6} — unevenly spaced. [MECHANISM]
const E2M1 = [0, 0.5, 1, 1.5, 2, 3, 4, 6];
const WPAL = ['bf16', 'int4', 'nvfp4'];
const FS = 72, LH = 92; // label canvas font px / line height

function hatchTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 24;
  const g = c.getContext('2d');
  g.fillStyle = '#dadada';
  g.fillRect(0, 0, 24, 24);
  g.strokeStyle = '#7d7d7d';
  g.lineWidth = 2.5;
  g.beginPath();
  for (const o of [-24, 0, 24]) { g.moveTo(o, 24); g.lineTo(o + 24, 0); }
  g.stroke();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(4, 4);
  return tex;
}

export default function build(scene, emit) {
  const out = emitter(emit);
  const box = new THREE.BoxGeometry(1, 1, 1);
  const dark = lam(0x1d1d1d);
  const mid = lam(0x9a9a9a);
  const pale = lam(0xd9d9d9);
  const edgeMat = new THREE.LineBasicMaterial({ color: 0x161616 });
  const hatchMat = new THREE.MeshLambertMaterial({ map: hatchTexture() });
  const WX = -2.0, AX = 0.35, KX = 2.75;

  function drawLines(c, text) {
    const lines = String(text).split('\n'), g = c.getContext('2d');
    g.clearRect(0, 0, c.width, c.height); g.font = `bold ${FS}px sans-serif`;
    g.fillStyle = '#111111'; g.textBaseline = 'middle'; g.textAlign = 'center';
    lines.forEach((l, i) => g.fillText(l, c.width / 2, LH * i + LH / 2));
  }
  // height = total sprite height; a 2-line label uses height ≈ 2 × single-line height (≥ 0.13 × view.size per line)
  function label(text, x, y, z, height = 0.42, parent = scene) {
    const lines = String(text).split('\n');
    const meas = document.createElement('canvas').getContext('2d');
    meas.font = `bold ${FS}px sans-serif`;
    const c = document.createElement('canvas');
    c.width = Math.ceil(Math.max(...lines.map(l => meas.measureText(l).width))) + 24;
    c.height = LH * lines.length;
    drawLines(c, text);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false }));
    s.scale.set(height * c.width / c.height, height, 1);
    s.position.set(x, y, z);
    s.renderOrder = 10;
    parent.add(s);
    return s;
  }
  function dyn(parent) {
    let cur = null;
    return (text, x, y, z, height) => {
      if (cur) { parent.remove(cur); cur.material.map.dispose(); cur.material.dispose(); cur = null; }
      if (text) cur = label(text, x, y, z, height ?? 0.76, parent);
    };
  }
  const dw = dyn(scene), da = dyn(scene), dk = dyn(scene);

  // Floor
  const floor = new THREE.Mesh(box, pale);
  floor.position.set(0.2, -0.035, 0.4);
  floor.scale.set(6.7, 0.07, 6.0);
  scene.add(floor);

  // One column: body box + dark front divider lines counting bit planes (height = bit-width).
  function column(x, w) {
    const mesh = new THREE.Mesh(box, mid);
    scene.add(mesh);
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(box), edgeMat);
    scene.add(edges);
    const dividers = [];
    for (let j = 0; j < 16; j++) {
      const d = new THREE.Mesh(box, dark);
      d.scale.set(w + 0.04, 0.016, 0.024);
      scene.add(d);
      dividers.push(d);
    }
    return { mesh, edges, dividers, x, w };
  }
  function draw(col, h, depth, cz) {
    col.mesh.position.set(col.x, h / 2, cz);
    col.mesh.scale.set(col.w, Math.max(h, 0.002), depth);
    col.edges.position.copy(col.mesh.position);
    col.edges.scale.set(col.w + 0.01, Math.max(h, 0.002) + 0.01, depth + 0.01);
    const fz = cz + depth / 2 + 0.015;
    for (let j = 0; j < col.dividers.length; j++) {
      const y = (j + 1) * UNIT;
      const on = y < h - 0.015;
      col.dividers[j].visible = on;
      if (on) col.dividers[j].position.set(col.x, y, fz);
    }
  }
  const cW = column(WX, 2.1); // weights
  const cA = column(AX, 0.18); // activations wall
  const cK = column(KX, 1.2); // kv strip

  // NVFP4 block-scale hatch plate sitting on top of the weights slab
  const scalePlate = new THREE.Mesh(box, hatchMat);
  scene.add(scalePlate);
  const blockLabel = label('block\nscales', 0, 0, 0, 0.76);

  // Layer planes the activations flow between
  for (const z of [-1.62, 1.62]) {
    const p = new THREE.Mesh(box, ghost(0xbcbcbc, 0.32));
    p.position.set(AX, 1.12, z);
    p.scale.set(1.9, 2.25, 0.04);
    p.renderOrder = 2;
    scene.add(p);
    const e = new THREE.LineSegments(new THREE.EdgesGeometry(box), edgeMat);
    e.position.copy(p.position);
    e.scale.copy(p.scale);
    scene.add(e);
  }
  label('layer', AX, 2.45, -1.62, 0.4);

  // Flowing activation tiles
  const tiles = [];
  for (let i = 0; i < 7; i++) {
    const t = new THREE.Mesh(box, dark);
    t.scale.set(0.3, 0.16, 0.18);
    scene.add(t);
    tiles.push(t);
  }

  // Dial: base + dark knob + option nubs + rotating pale pointer
  function dial(x, z, n) {
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.4, 0.08, 20), mid);
    base.position.set(x, 0.04, z);
    scene.add(base);
    const knob = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.27, 0.13, 20), dark);
    knob.position.set(x, 0.13, z);
    scene.add(knob);
    for (let i = 0; i < n; i++) {
      const a = (i - (n - 1) / 2) * 0.8;
      const nub = new THREE.Mesh(box, pale);
      nub.scale.set(0.08, 0.05, 0.16);
      nub.position.set(x + Math.sin(a) * 0.52, 0.06, z + Math.cos(a) * 0.52);
      nub.rotation.y = a;
      scene.add(nub);
    }
    const ptr = new THREE.Group();
    ptr.position.set(x, 0.22, z);
    const arm = new THREE.Mesh(box, pale);
    arm.scale.set(0.08, 0.06, 0.4);
    arm.position.set(0, 0, 0.2);
    ptr.add(arm);
    scene.add(ptr);
    return ptr;
  }
  const pW = dial(WX, 2.5, 3);
  const pA = dial(AX, 2.5, 2);
  const pK = dial(KX, 2.5, 2);

  // Ruler above the weights slab; shows the allowed levels of the chosen weight format.
  // The group floats at y = 0 and is raised to sit just above the slab every frame.
  const RY = 0, RX = WX;
  const ruler = new THREE.Group();
  scene.add(ruler);
  const dr = dyn(ruler);
  function rebuildRuler(kind) {
    while (ruler.children.length) {
      const o = ruler.children[0];
      ruler.remove(o);
      o.geometry?.dispose();
      if (o.material) { o.material.map?.dispose(); o.material.dispose(); }
    }
    dr(null);
    if (kind === 'dense') {
      const plate = new THREE.Mesh(box, hatchMat);
      plate.position.set(RX, RY, 0);
      plate.scale.set(2.3, 0.12, 0.3);
      ruler.add(plate);
      label('too dense\nto draw', RX, -0.44, 0, 0.76, ruler);
      dr('bf16\n16 dense levels', RX, 0.62, 0, 0.76);
      return;
    }
    const track = new THREE.Mesh(box, mid);
    track.position.set(RX, RY, 0);
    track.scale.set(2.3, 0.05, 0.3);
    ruler.add(track);
    const ticks = kind === 'int4'
      ? Array.from({ length: 16 }, (_, i) => ({ t: (i - 8) / 8.5 })) // int levels -8..7, even spacing
      : WPX(kind); // signed E2M1, uneven spacing
    for (const { t } of ticks) {
      const nub = new THREE.Mesh(box, dark);
      nub.scale.set(0.045, 0.15, 0.12);
      nub.position.set(RX + t * 1.05, RY + 0.1, 0);
      ruler.add(nub);
    }
    const nums = kind === 'int4' ? [-8, 0, 7] : [-6, 0, 6];
    const map = kind === 'int4' ? (v => v / 8.5) : (v => v / 6.4);
    for (const v of nums) label(String(v), RX + map(v) * 1.05, -0.44, 0, 0.4, ruler);
    dr(kind === 'int4' ? 'int4\n16 even levels' : 'nvfp4\nuneven levels', RX, 0.62, 0, 0.76);
  }
  function WPX() {
    const t = [];
    for (const s of [-1, 1]) for (const u of E2M1) { if (s < 0 && u === 0) continue; t.push({ t: u * s / 6.4 }); }
    return t;
  }

  // Static labels: column names sit on the floor front edge, current-precision tags below them
  label('weights', WX, 0.02, 3.35, 0.38);
  label('activations', AX, 0.02, 3.35, 0.38);
  label('kv cache', KX, 0.02, 3.35, 0.38);
  label('grows with\ncontext', KX - 0.25, 2.95, 0.35, 0.76);

  // State (initial must match the slide control initials)
  let w = 'int4', kv = 'bf16';
  let playing = true, clock = 0, flow = 0;
  let hW = UNIT * FORMATS[w].body, hA = UNIT * FORMATS[w].aBits, hK = UNIT * KV[kv].bits;
  let kD = 0.4 + 1.3 * (0.5 - 0.5 * Math.cos((clock / 10) * Math.PI * 2));
  let aW = 1, aA = 1, aK = 1; // dial pointers in option-index space
  rebuildRuler(FORMATS[w].ruler);
  function refreshTags() {
    const f = FORMATS[w];
    dw(`${f.tag}\n${f.bits}`, WX, -0.75, 3.35, 0.76);
    da(`follows weights\n${f.aBits} bits`, AX, -0.75, 3.35, 0.76);
    dk(`${KV[kv].tag}\n${KV[kv].bitsTag}`, KX, -0.75, 3.35, 0.76);
  }
  refreshTags();

  return {
    view: { target: [0.1, 0.45, 0], radius: 40, theta: 0.08, phi: 1.12, size: 2.9 },
    update(dt) {
      if (playing) { clock += dt; flow += dt * 0.09; }
      const k = ease(dt, 6);
      const f = FORMATS[w];
      hW += (UNIT * f.body - hW) * k;
      hA += (UNIT * f.aBits - hA) * k;
      hK += (UNIT * KV[kv].bits - hK) * k;
      const g = 0.5 - 0.5 * Math.cos((clock / 10) * Math.PI * 2);
      kD += (0.4 + 1.3 * g - kD) * ease(dt, 4);
      draw(cW, hW, 1.6, 0);
      draw(cA, hA, 3.24, 0);
      draw(cK, hK, kD, -0.55 + kD / 2); // strip anchored at back, grows forward

      scalePlate.visible = f.ruler === 'nvfp4';
      if (scalePlate.visible) {
        scalePlate.position.set(WX, hW + UNIT * 0.25 + 0.02, 0);
        scalePlate.scale.set(2.1, UNIT * 0.5, 1.6);
        blockLabel.position.set(WX + 1.5, hW - 0.22, 1.0);
      }
      blockLabel.visible = scalePlate.visible;

      for (let i = 0; i < tiles.length; i++) {
        const u = (flow + i / tiles.length) % 1;
        tiles[i].position.set(AX + 0.24, 0.28, -1.5 + u * 3.0);
      }

      // dial pointers
      const tw = WPAL.indexOf(w), tk = ['bf16', 'fp8'].indexOf(kv), ta = f.aBits === 16 ? 1 : 0;
      aW += (tw - aW) * k; aA += (ta - aA) * k; aK += (tk - aK) * k;
      ruler.position.y = hW + 0.62;
      pW.rotation.y = (aW - 1) * 0.8;
      pA.rotation.y = (aA - 0.5) * 0.8;
      pK.rotation.y = (aK - 0.5) * 0.8;

      out({ playing, readout: `mechanism · ${f.scheme} · kv ${kv} · 3 separate settings` });
    },
    action(name, arg) {
      if (name === 'play') playing = typeof arg === 'boolean' ? arg : !playing;
      // no timeline here: step / back cycle the weights dial (the main control) forward / back
      else if (name === 'step') { playing = false; setW(WPAL[(WPAL.indexOf(w) + 1) % WPAL.length]); }
      else if (name === 'back') { playing = false; setW(WPAL[(WPAL.indexOf(w) - 1 + WPAL.length) % WPAL.length]); }
      else if (name === 'w' && FORMATS[arg]) { setW(arg); }
      else if (name === 'kv' && KV[arg]) { kv = arg; refreshTags(); }
    },
  };
  function setW(v) { if (!FORMATS[v]) return; w = v; rebuildRuler(FORMATS[w].ruler); refreshTags(); }
}
