import { THREE, lam, ease, emitter } from './_kit.js';

// Worked 16-value block from docs/research/v2/nvfp4-autoround.md (TOY / SIMULATED).
const W16 = [
  0.092, -0.061, 0.044, -0.031,
  0.022, -0.016, 0.008, 0.001,
  -0.007, 0.014, -0.023, 0.030,
  -0.045, 0.059, -0.011, 0.000,
];

const S_GLOBAL = 0.001;
const E2M1_LEVELS = [0, 0.5, 1, 1.5, 2, 3, 4, 6];

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
  return (sign ? -1 : 1) * E2M1_LEVELS[bestIdx];
}

function computeRuler(outlier) {
  const values = [outlier, ...W16.slice(1)];
  const blockAmax = Math.max(...values.map(Math.abs));
  const sRaw = (blockAmax / 6.0) / S_GLOBAL;
  const e4 = roundE4M3(sRaw);
  const sEff = e4.v * S_GLOBAL;
  const items = values.map((w, i) => {
    const scaled = w / sEff;
    const q = quantE2M1(scaled);
    const wHat = q * sEff;
    return { i, w, scaled, q, wHat, err: wHat - w };
  });
  const maxSmallErr = Math.max(
    ...items.filter(d => d.i > 0 && Math.abs(d.w) <= 0.025).map(d => Math.abs(d.err))
  );
  return { outlier, blockAmax, sBlock: e4.v, sHex: e4.code, sEff, items, maxSmallErr };
}

export default function build(scene, emit) {
  const out = emitter(emit);
  const box = new THREE.BoxGeometry(1, 1, 1);
  const darkMat = lam(0x1b1b1b);
  const midMat = lam(0x6e6e6e);
  const paleMat = lam(0xd6d6d6);
  const trackMat = lam(0x9a9a9a);
  const wireMat = new THREE.LineBasicMaterial({ color: 0x161616 });
  const tickMat = new THREE.LineBasicMaterial({ color: 0x555555 });
  const linkMat = lam(0x4a4a4a);

  function label(text, x, y, z, height = 0.33, parent = scene) {
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

  const X_CENTER = -0.45;
  const X_SPAN = 0.54; // 6 * 0.54 = 3.24 -> [-3.69, +2.79]
  const xFromE2M1 = u => X_CENTER + Math.max(-6.3, Math.min(6.3, u)) * X_SPAN;
  const X_RESID = 3.45;

  // Base plate under the 16 lanes + residual base strip
  const floor = new THREE.Mesh(box, paleMat);
  floor.position.set(-0.45, -0.04, 0);
  floor.scale.set(6.9, 0.04, 4.6);
  scene.add(floor);

  const residBase = new THREE.Mesh(box, paleMat);
  residBase.position.set(X_RESID, -0.04, 0);
  residBase.scale.set(0.62, 0.04, 4.6);
  scene.add(residBase);

  // Longitudinal tick guide lines across all 16 lanes (non-uniform E2M1 spacing)
  for (const sgn of [-1, 1]) {
    for (const lvl of E2M1_LEVELS) {
      if (sgn === -1 && lvl === 0) continue;
      const u = sgn * lvl;
      const x = xFromE2M1(u);
      const isZero = lvl === 0;
      const isMajor = lvl === 0 || lvl === 2 || lvl === 4 || lvl === 6;
      const line = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(x, 0.005, -2.25),
          new THREE.Vector3(x, 0.005, 2.25),
        ]),
        isZero ? wireMat : tickMat
      );
      scene.add(line);

      // Front tick nub to emphasize widening spacing
      const nub = new THREE.Mesh(box, isZero ? darkMat : (isMajor ? midMat : trackMat));
      nub.position.set(x, 0.02, 2.28);
      nub.scale.set(isZero ? 0.06 : 0.04, isMajor ? 0.09 : 0.05, 0.14);
      scene.add(nub);
    }
  }

  // 16 parallel lanes in depth
  const rawCubes = [];
  const snapCubes = [];
  const linkBars = [];
  const residBars = [];
  const curSnapX = new Float32Array(16);
  const curResidH = new Float32Array(16);
  const wireCubeGeo = new THREE.EdgesGeometry(new THREE.BoxGeometry(0.17, 0.17, 0.17));

  for (let i = 0; i < 16; i++) {
    const z = (i - 7.5) * 0.27;
    const track = new THREE.Mesh(box, trackMat);
    track.position.set(X_CENTER, 0.0, z);
    track.scale.set(6.55, 0.018, 0.035);
    scene.add(track);

    // Hollow raw weight marker
    const raw = new THREE.LineSegments(wireCubeGeo, wireMat);
    raw.position.set(X_CENTER, 0.11, z);
    scene.add(raw);
    rawCubes.push(raw);

    // Solid dark snapped E2M1 cube
    const snap = new THREE.Mesh(box, darkMat);
    snap.scale.set(0.13, 0.13, 0.13);
    snap.position.set(X_CENTER, 0.11, z);
    scene.add(snap);
    snapCubes.push(snap);

    // Connecting error segment along lane
    const link = new THREE.Mesh(box, linkMat);
    link.scale.set(0.01, 0.03, 0.04);
    link.position.set(X_CENTER, 0.11, z);
    scene.add(link);
    linkBars.push(link);

    // Residual bar on the right
    const rBar = new THREE.Mesh(box, darkMat);
    rBar.scale.set(0.28, 0.01, 0.17);
    rBar.position.set(X_RESID, 0.005, z);
    scene.add(rBar);
    residBars.push(rBar);
  }

  // Static labels
  label('-6·s', xFromE2M1(-6), -0.22, 2.42, 0.30);
  label('-2·s', xFromE2M1(-2), -0.22, 2.42, 0.28);
  label('0', xFromE2M1(0), -0.22, 2.42, 0.30);
  label('+2·s', xFromE2M1(2), -0.22, 2.42, 0.28);
  label('+6·s', xFromE2M1(6), -0.22, 2.42, 0.30);

  label('16 weight lanes', -2.55, 0.45, -2.55, 0.32);
  label('hollow: raw weight', -2.35, 1.55, -1.65, 0.31);
  label('solid: E2M1 tick', 0.35, 1.55, -1.65, 0.31);
  label('residual |ŵ − w|', X_RESID, 2.75, 0, 0.32);

  const dynGroup = new THREE.Group();
  scene.add(dynGroup);
  function rebuildDynLabel(m) {
    while (dynGroup.children.length) {
      const s = dynGroup.children[0];
      dynGroup.remove(s);
      s.material.map.dispose();
      s.material.dispose();
    }
    label(`scale ${m.sBlock.toFixed(1)} × 0.001`, -0.45, 2.15, -1.65, 0.33, dynGroup);
    label(`6·s = ${(6 * m.sEff).toFixed(3)}`, xFromE2M1(6) - 0.15, -0.58, 2.42, 0.29, dynGroup);
  }

  let outlier = 0.092;
  let playing = true;
  let beat = 0;
  let clock = 0;
  let model = computeRuler(outlier);
  rebuildDynLabel(model);

  return {
    view: { target: [-0.30, 0.40, 0], radius: 40, theta: 0.20, phi: 1.14, size: 4.0 },
    update(dt) {
      if (playing) {
        clock += dt;
        if (clock >= 3.0) {
          clock = 0;
          beat = (beat + 1) % 3;
        }
      }
      const k = ease(dt, 7);
      const showSnap = beat >= 1;
      const showResid = beat >= 2;

      for (let i = 0; i < 16; i++) {
        const item = model.items[i];
        const z = (i - 7.5) * 0.27;
        const rawX = xFromE2M1(item.scaled);
        const snapX = xFromE2M1(item.q);

        rawCubes[i].position.set(rawX, 0.11, z);

        const targetX = showSnap ? snapX : rawX;
        curSnapX[i] += (targetX - curSnapX[i]) * k;
        snapCubes[i].position.set(curSnapX[i], 0.11, z);

        const dx = curSnapX[i] - rawX;
        linkBars[i].position.set((rawX + curSnapX[i]) / 2, 0.11, z);
        linkBars[i].scale.set(Math.max(Math.abs(dx), 0.005), 0.03, 0.04);

        const targetH = showResid ? Math.max(Math.abs(item.err) * 95, 0.012) : 0.012;
        curResidH[i] += (targetH - curResidH[i]) * k;
        residBars[i].scale.set(0.28, curResidH[i], 0.17);
        residBars[i].position.set(X_RESID, curResidH[i] / 2, z);
      }

      const line = `simulated · biggest ${model.outlier} · scale ${model.sBlock.toFixed(1)} × 0.001 · max error on small weights ${model.maxSmallErr.toFixed(4)}`;
      out({ playing, stage: ['raw', 'snap', 'residual'][beat], readout: line });
    },
    action(name, arg) {
      if (name === 'play') playing = typeof arg === 'boolean' ? arg : !playing;
      else if (name === 'step') {
        beat = (beat + (Number(arg) || 1) + 3) % 3;
        clock = 0;
      } else if (name === 'outlier') {
        const val = Number(arg);
        if ([0.092, 0.25, 0.5].includes(val)) {
          outlier = val;
          model = computeRuler(outlier);
          rebuildDynLabel(model);
          if (beat === 0) {
            beat = 2;
            clock = 0;
          }
        }
      }
    },
  };
}
