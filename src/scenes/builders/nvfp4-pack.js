import { THREE, lam, ease, emitter } from './_kit.js';

// Worked 16-value block from docs/research/v2/nvfp4-autoround.md (TOY / SIMULATED).
const W16 = [
  0.092, -0.061, 0.044, -0.031,
  0.022, -0.016, 0.008, 0.001,
  -0.007, 0.014, -0.023, 0.030,
  -0.045, 0.059, -0.011, 0.000,
];

// Second toy 16-value half merged in MXFP4 mode (32-value block), with a 0.38 outlier at slot 4 (index 20).
const W16_TOY2 = [
  -0.021, 0.034, -0.012, 0.006,
  0.380, -0.048, 0.019, -0.004,
  0.027, -0.055, 0.013, -0.009,
  0.041, -0.018, 0.005, -0.033,
];

const S_GLOBAL = 0.001;
const E2M1_LEVELS = [0, 0.5, 1, 1.5, 2, 3, 4, 6];

// Build positive FP8 E4M3 table (exp 0..15, mant 0..7, excluding NaN 0x7F).
const E4M3_TABLE = (() => {
  const out = [];
  for (let exp = 0; exp < 16; exp++) {
    for (let mant = 0; mant < 8; mant++) {
      if (exp === 15 && mant === 7) continue;
      const v = exp === 0
        ? Math.pow(2, -6) * (mant / 8)
        : Math.pow(2, exp - 7) * (1 + mant / 8);
      out.push({ code: (exp << 3) | mant, v });
    }
  }
  return out;
})();

function roundE4M3(x) {
  let best = E4M3_TABLE[0], bestDiff = Infinity;
  for (const e of E4M3_TABLE) {
    const d = Math.abs(e.v - x);
    if (d < bestDiff - 1e-12 || (Math.abs(d - bestDiff) <= 1e-12 && (e.code % 2 === 0))) {
      bestDiff = d;
      best = e;
    }
  }
  return best;
}

function quantE2M1(x) {
  const sign = x < 0 ? 1 : 0;
  const ax = Math.min(6.0, Math.abs(x));
  let bestIdx = 0, bestDiff = Infinity;
  for (let i = 0; i < E2M1_LEVELS.length; i++) {
    const diff = Math.abs(ax - E2M1_LEVELS[i]);
    if (diff < bestDiff - 1e-12 || (Math.abs(diff - bestDiff) <= 1e-12 && (i % 2 === 0))) {
      bestDiff = diff;
      bestIdx = i;
    }
  }
  return {
    q: (sign ? -1 : 1) * E2M1_LEVELS[bestIdx],
    idx: bestIdx,
    nibble: (sign ? '1' : '0') + bestIdx.toString(2).padStart(3, '0'),
  };
}

function computeModel(format) {
  const values = format === 'mxfp4' ? W16.concat(W16_TOY2) : W16.slice();
  const blockAmax = Math.max(...values.map(Math.abs));
  if (format === 'mxfp4') {
    // OCP MX v1.0 shared exponent: floor(log2(amax)) - floor(log2(6.0))
    const exp = Math.floor(Math.log2(blockAmax)) - 2;
    const sEff = Math.pow(2, exp);
    const items = values.map((w, i) => {
      const { q, nibble } = quantE2M1(w / sEff);
      const wHat = q * sEff;
      return { i, w, scaled: w / sEff, q, nibble, wHat, err: wHat - w };
    });
    const collapsedNonZero = items.slice(0, 16).filter(d => d.w !== 0 && d.q === 0).length;
    const maxErr = Math.max(...items.map(d => Math.abs(d.err)));
    return { format, values, blockAmax, sBlock: sEff, sEff, exp, items, collapsedNonZero, maxErr, bpw: 4.25 };
  }
  const sRaw = (blockAmax / 6.0) / S_GLOBAL;
  const e4 = roundE4M3(sRaw);
  const sEff = e4.v * S_GLOBAL;
  const items = values.map((w, i) => {
    const { q, nibble } = quantE2M1(w / sEff);
    const wHat = q * sEff;
    return { i, w, scaled: w / sEff, q, nibble, wHat, err: wHat - w };
  });
  const maxErr = Math.max(...items.map(d => Math.abs(d.err)));
  return { format, values, blockAmax, sBlock: e4.v, sHex: e4.code, sEff, items, collapsedNonZero: 0, maxErr, bpw: 4.5 };
}

function makeHatchTexture() {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = '#dcdcdc';
  g.fillRect(0, 0, 64, 64);
  g.strokeStyle = '#555555';
  g.lineWidth = 6;
  for (let o = -64; o < 128; o += 16) {
    g.beginPath(); g.moveTo(o, 0); g.lineTo(o + 64, 64); g.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 2);
  return tex;
}

export default function build(scene, emit) {
  const out = emitter(emit);
  const box = new THREE.BoxGeometry(1, 1, 1);
  const darkMat = lam(0x1e1e1e);
  const midMat = lam(0x6e6e6e);
  const paleMat = lam(0xd4d4d4);
  const hatchMat = new THREE.MeshLambertMaterial({ map: makeHatchTexture() });
  const edgeMat = new THREE.LineBasicMaterial({ color: 0x181818 });
  const softEdgeMat = new THREE.LineBasicMaterial({ color: 0x6a6a6a });
  const tickMat = new THREE.LineBasicMaterial({ color: 0x222222 });
  const arrowMat = lam(0x2e2e2e);

  const labelsGroup = new THREE.Group();
  scene.add(labelsGroup);

  function label(text, x, y, z, height = 0.34, parent = labelsGroup) {
    const c = document.createElement('canvas');
    const g = c.getContext('2d');
    g.font = 'bold 72px sans-serif';
    c.width = Math.ceil(g.measureText(text).width) + 24;
    c.height = 92;
    g.font = 'bold 72px sans-serif';
    g.fillStyle = '#111111';
    g.textBaseline = 'middle';
    g.fillText(text, 12, 46);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false }));
    s.scale.set(height * c.width / c.height, height, 1);
    s.position.set(x, y, z);
    s.renderOrder = 10;
    parent.add(s);
    return s;
  }

  function makeOutlinedBox(w, h, d, mat, wireMat = edgeMat) {
    const g = new THREE.Group();
    if (mat) {
      const m = new THREE.Mesh(box, mat);
      m.scale.set(w, h, d);
      g.add(m);
    }
    const e = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(w, h, d)), wireMat);
    g.add(e);
    return g;
  }

  function makeArrow(x1, x2, y, z) {
    const len = x2 - x1;
    const g = new THREE.Group();
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, len - 0.18, 8), arrowMat);
    shaft.rotation.z = -Math.PI / 2;
    shaft.position.set(x1 + (len - 0.18) / 2, y, z);
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.20, 8), arrowMat);
    tip.rotation.z = -Math.PI / 2;
    tip.position.set(x2 - 0.10, y, z);
    g.add(shaft, tip);
    scene.add(g);
    return g;
  }

  // Stage X positions (compact inside [-3.6, +3.6])
  const X_IN = -3.30;
  const X_MAX = -2.05;
  const X_SCALE = -0.80;
  const X_RULER = 1.15;
  const X_PACK = 3.45;

  // Base floor strip
  const floor = new THREE.Mesh(box, paleMat);
  floor.position.set(0.05, -0.02, 0);
  floor.scale.set(8.2, 0.03, 4.4);
  scene.add(floor);

  // Connecting pipeline arrows
  makeArrow(-2.75, -2.30, 0.06, 0);
  makeArrow(-1.80, -1.30, 0.06, 0);
  makeArrow(-0.30, 0.55, 0.06, 0);
  makeArrow(1.75, 2.75, 0.06, 0);

  // Active stage cursor bar
  const cursor = new THREE.Mesh(box, darkMat);
  cursor.scale.set(0.9, 0.07, 0.24);
  cursor.position.set(X_IN, 0.03, 2.35);
  scene.add(cursor);

  // Stage 0: 16 primary input bars + 16 toy-2nd-half hollow/mid bars (shown in mxfp4)
  const inBars1 = [];
  const inBars2 = [];
  for (let i = 0; i < 16; i++) {
    const z = (i - 7.5) * 0.26;
    const m1 = new THREE.Mesh(box, darkMat);
    m1.position.set(X_IN, 0, z);
    scene.add(m1);
    inBars1.push(m1);

    const m2 = makeOutlinedBox(0.20, 1, 0.17, midMat, edgeMat);
    m2.position.set(X_IN + 0.34, 0, z);
    m2.visible = false;
    scene.add(m2);
    inBars2.push(m2);
  }

  // Stage 1: block max marker (vertical post + top cap)
  const maxGroup = new THREE.Group();
  const maxPost = new THREE.Mesh(box, midMat);
  maxPost.scale.set(0.08, 1, 0.08);
  const maxCap = new THREE.Mesh(box, darkMat);
  maxCap.scale.set(0.55, 0.07, 0.35);
  const maxRef = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(X_IN - 0.2, 0, 0), new THREE.Vector3(X_MAX, 0, 0)]),
    tickMat
  );
  maxGroup.add(maxPost, maxCap);
  scene.add(maxGroup, maxRef);

  // Stage 2: scale byte slab (hatched + outlined) + global scale tag
  const scaleSlab = makeOutlinedBox(0.68, 0.72, 0.68, hatchMat, edgeMat);
  scaleSlab.position.set(X_SCALE, 0.38, 0);
  scene.add(scaleSlab);

  const globalTag = makeOutlinedBox(0.46, 0.26, 0.46, paleMat, softEdgeMat);
  globalTag.position.set(X_SCALE, 1.55, 0);
  scene.add(globalTag);

  // Stage 3: E2M1 non-uniform ruler along Y at X_RULER
  const rulerGroup = new THREE.Group();
  scene.add(rulerGroup);
  const rulerSpine = new THREE.Mesh(box, darkMat);
  rulerSpine.position.set(X_RULER, 0, 0);
  rulerSpine.scale.set(0.06, 3.3, 0.06);
  rulerGroup.add(rulerSpine);

  const RULER_H = 1.60; // maps [-6, +6] -> [-1.60, +1.60]
  const yFromE2M1 = v => (v / 6.0) * RULER_H;

  for (const sgn of [-1, 1]) {
    for (const lvl of E2M1_LEVELS) {
      if (sgn === -1 && lvl === 0) continue;
      const v = sgn * lvl;
      const y = yFromE2M1(v);
      const isMajor = lvl === 0 || lvl === 2 || lvl === 4 || lvl === 6;
      const wTick = isMajor ? 0.42 : 0.24;
      const tick = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(X_RULER - wTick / 2, y, -1.75),
          new THREE.Vector3(X_RULER + wTick / 2, y, 1.75),
        ]),
        lvl === 0 ? edgeMat : tickMat
      );
      rulerGroup.add(tick);
      // Small tick cross-nub on front
      const nub = new THREE.Mesh(box, lvl === 0 ? darkMat : midMat);
      nub.position.set(X_RULER, y, 1.78);
      nub.scale.set(wTick, 0.035, 0.06);
      rulerGroup.add(nub);
    }
  }

  // Ruler markers: solid dark cubes for active ticks, hollow cubes for zero-collapsed weights
  const snapMarkers = [];
  const zeroMarkers = [];
  for (let i = 0; i < 32; i++) {
    const m = new THREE.Mesh(box, darkMat);
    m.scale.set(0.14, 0.09, 0.12);
    scene.add(m);
    snapMarkers.push(m);

    const zBox = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(0.16, 0.11, 0.14)), edgeMat);
    zBox.visible = false;
    scene.add(zBox);
    zeroMarkers.push(zBox);
  }

  // Stage 4: Packed bytes stack (up to 16 dark payload bytes + 1 hatched scale byte)
  const payloadBytes = [];
  for (let b = 0; b < 16; b++) {
    const col = b < 8 ? 0 : 1;
    const row = b % 8;
    const byteMesh = makeOutlinedBox(0.36, 0.16, 0.48, darkMat, softEdgeMat);
    byteMesh.position.set(X_PACK + (col - 0.5) * 0.44, 0.10 + row * 0.21, 0);
    scene.add(byteMesh);
    payloadBytes.push(byteMesh);
  }
  const packedScaleByte = makeOutlinedBox(0.36, 0.22, 0.48, hatchMat, edgeMat);
  packedScaleByte.position.set(X_PACK, 0.10 + 8 * 0.21 + 0.05, 0);
  scene.add(packedScaleByte);

  // Dynamic state + labels
  let format = 'nvfp4';
  let playing = true;
  let beat = 0;
  let clock = 0;
  let model = computeModel(format);

  // Static labels
  label('+6', X_RULER - 0.44, yFromE2M1(6), 1.8, 0.28);
  label('0', X_RULER - 0.36, 0, 1.8, 0.28);
  label('-6', X_RULER - 0.44, yFromE2M1(-6), 1.8, 0.28);
  label('E2M1 ruler', X_RULER, 2.05, 0, 0.33);

  const dynLabels = new THREE.Group();
  scene.add(dynLabels);
  function rebuildDynLabels() {
    while (dynLabels.children.length) {
      const s = dynLabels.children[0];
      dynLabels.remove(s);
      s.material.map.dispose();
      s.material.dispose();
    }
    if (format === 'nvfp4') {
      label('16 input weights', X_IN, 2.75, 0.2, 0.33, dynLabels);
      label('block max 0.092', X_MAX + 0.15, 2.20, 0, 0.32, dynLabels);
      label('scale 15 × 0.001', X_SCALE, 1.05, 0, 0.31, dynLabels);
      label('FP32 0.001', X_SCALE, 2.05, 0, 0.29, dynLabels);
      label('9 bytes for 16 values', X_PACK + 0.05, 2.55, 0, 0.33, dynLabels);
    } else {
      label('16 + 16 weights', X_IN + 0.10, 2.75, 0.2, 0.33, dynLabels);
      label('toy 2nd half', X_IN + 0.15, -1.55, 1.8, 0.30, dynLabels);
      label('block max 0.380', X_MAX + 0.15, 2.20, 0, 0.32, dynLabels);
      label('E8M0 scale 0.0625', X_SCALE, 1.05, 0, 0.31, dynLabels);
      label(`${model.collapsedNonZero} collapsed to 0`, X_RULER, -2.05, 0, 0.32, dynLabels);
      label('17 bytes for 32 values', X_PACK + 0.05, 2.55, 0, 0.33, dynLabels);
    }
  }

  // Animated values
  const curMarkerY = new Float32Array(32);
  const curPackY = new Float32Array(17);
  let curCursorX = X_IN;

  function applyFormat(nextFormat) {
    format = nextFormat;
    model = computeModel(format);
    const isMx = format === 'mxfp4';
    globalTag.visible = !isMx;
    for (let i = 0; i < 16; i++) {
      inBars1[i].position.x = isMx ? X_IN - 0.16 : X_IN;
      inBars2[i].visible = isMx;
    }
    for (let b = 0; b < 16; b++) {
      const col = b < 8 ? 0 : 1;
      const row = b % 8;
      payloadBytes[b].visible = isMx || b < 8;
      payloadBytes[b].position.x = isMx ? X_PACK + (col - 0.5) * 0.44 : X_PACK;
      payloadBytes[b].position.y = 0.11 + row * 0.21;
    }
    packedScaleByte.position.x = isMx ? X_PACK + 0.22 : X_PACK;
    packedScaleByte.position.y = 0.14 + 8 * 0.21;
    rebuildDynLabels();
  }

  applyFormat(format);

  const STAGE_X = [X_IN, X_MAX, X_SCALE, X_RULER, X_PACK];
  const STAGE_NAMES = ['inputs', 'block max', 'scale', 'e2m1 snap', 'packed'];

  return {
    view: { target: [-0.25, 0.30, 0], radius: 40, theta: 0.14, phi: 1.08, size: 4.05 },
    update(dt) {
      if (playing) {
        clock += dt;
        if (clock >= 2.2) {
          clock = 0;
          beat = (beat + 1) % 5;
        }
      }
      const k = ease(dt, 7);
      const isMx = format === 'mxfp4';
      const barScale = isMx ? 4.8 : 17.5;

      // Cursor slide
      curCursorX += (STAGE_X[beat] - curCursorX) * k;
      cursor.position.x = curCursorX;

      // Stage 0: input bars (height ∝ w, negative hangs below y = 0)
      for (let i = 0; i < 16; i++) {
        const w1 = model.values[i];
        const h1 = Math.max(Math.abs(w1) * barScale, 0.025);
        inBars1[i].scale.set(0.22, h1, 0.17);
        inBars1[i].position.y = (w1 * barScale) / 2;

        if (isMx) {
          const w2 = model.values[16 + i];
          const h2 = Math.max(Math.abs(w2) * barScale, 0.025);
          inBars2[i].scale.set(1, h2, 1);
          inBars2[i].position.y = (w2 * barScale) / 2;
        }
      }

      // Stage 1: block max marker
      const maxH = model.blockAmax * barScale;
      maxPost.position.set(X_MAX, maxH / 2, 0);
      maxPost.scale.set(0.08, maxH, 0.08);
      maxCap.position.set(X_MAX, maxH, 0);
      maxRef.position.y = maxH;
      maxGroup.scale.y += ((beat >= 1 ? 1 : 0.72) - maxGroup.scale.y) * k;

      // Stage 2: scale slab emphasis
      const scaleTarget = beat === 2 ? 1.12 : 1.0;
      scaleSlab.scale.x += (scaleTarget - scaleSlab.scale.x) * k;
      scaleSlab.scale.y = scaleSlab.scale.x;
      scaleSlab.scale.z = scaleSlab.scale.x;

      // Stage 3: E2M1 snap markers
      const nVals = model.items.length;
      for (let i = 0; i < 32; i++) {
        const m = snapMarkers[i];
        const zb = zeroMarkers[i];
        if (i >= nVals) {
          m.visible = false;
          zb.visible = false;
          continue;
        }
        const item = model.items[i];
        const rawY = yFromE2M1(Math.max(-6, Math.min(6, item.scaled)));
        const snapY = yFromE2M1(item.q);
        const targetY = beat >= 3 ? snapY : rawY;
        curMarkerY[i] += (targetY - curMarkerY[i]) * k;
        const laneZ = isMx
          ? ((i % 16) - 7.5) * 0.21 + (i >= 16 ? 0.05 : -0.05)
          : (i - 7.5) * 0.21;
        const xOff = isMx && i >= 16 ? X_RULER + 0.14 : X_RULER - (isMx ? 0.14 : 0);

        const collapsed = isMx && i < 16 && item.w !== 0 && item.q === 0 && beat >= 3;
        m.visible = !collapsed;
        zb.visible = collapsed;
        m.position.set(xOff, curMarkerY[i], laneZ);
        zb.position.set(xOff, curMarkerY[i], laneZ);
      }

      // Stage 4: packed bytes slide slightly in when beat === 4
      const nBytes = isMx ? 16 : 8;
      for (let b = 0; b < nBytes; b++) {
        const row = b % 8;
        const restY = 0.11 + row * 0.21;
        const targetY = beat >= 4 ? restY : restY + 0.18;
        curPackY[b] += (targetY - curPackY[b]) * k;
        payloadBytes[b].position.y = curPackY[b];
      }
      const scaleRestY = 0.14 + 8 * 0.21;
      const scaleTargetY = beat >= 4 ? scaleRestY : scaleRestY + 0.22;
      curPackY[16] += (scaleTargetY - curPackY[16]) * k;
      packedScaleByte.position.y = curPackY[16];

      const line = format === 'nvfp4'
        ? `simulated · nvfp4 · ${model.values.length} values · scale ${model.sEff.toFixed(3)} · max error ${model.maxErr.toFixed(4)} · ${model.bpw} bits each`
        : `simulated · mxfp4 · ${model.values.length} values · scale ${model.sEff.toFixed(4)} · ${model.collapsedNonZero} collapsed to 0 · ${model.bpw} bits`;
      out({ playing, stage: STAGE_NAMES[beat], readout: line });
    },
    action(name, arg) {
      if (name === 'play') playing = typeof arg === 'boolean' ? arg : !playing;
      else if (name === 'step') {
        beat = (beat + (Number(arg) || 1) + 5) % 5;
        clock = 0;
      } else if (name === 'format' && (arg === 'nvfp4' || arg === 'mxfp4')) {
        applyFormat(arg);
      }
    },
  };
}
