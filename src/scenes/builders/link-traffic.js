import { THREE, lam, ease, emitter } from './_kit.js';

const WEIGHTS_BYTES = 20e9;
const VOCAB = 150000;
const LOGITS_BYTES = VOCAB * 4;
const TOKEN_ID_BYTES = 4;
const DECODE_CABLE_BYTES = TOKEN_ID_BYTES + LOGITS_BYTES;
const RATIO_ROUNDED = Math.round(WEIGHTS_BYTES / DECODE_CABLE_BYTES / 100) * 100; // 33,300

const MAX_CUBES = 15;
const CUBE_H = 0.21;
const STEP_Y = 0.26;

function logCubes(bytes) {
  if (bytes <= 0) return 0;
  return Math.max(0, 2 * (Math.log10(bytes) - 3)); // 1 KB = 0, 10x per 2 cubes
}

function makeLabel(text, x, y, z, height = 0.32) {
  const canvas = document.createElement('canvas');
  const g = canvas.getContext('2d');
  const font = 'bold 72px ui-monospace, "DejaVu Sans Mono", monospace';
  g.font = font;
  canvas.width = Math.max(48, Math.ceil(g.measureText(text).width) + 24);
  canvas.height = 88;
  g.font = font;
  g.fillStyle = '#111111';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, canvas.width / 2, 44);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }),
  );
  height = Math.max(height, .45);
  sprite.scale.set(height * (canvas.width / canvas.height), height, 1);
  sprite.position.set(x, y, z);
  sprite.renderOrder = 10;
  return sprite;
}

function makeDynamicLabel(initial, x, y, z, height = 0.34) {
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({ transparent: true, depthTest: false }),
  );
  sprite.position.set(x, y, z);
  sprite.renderOrder = 10;
  let last = '';
  const set = text => {
    if (text === last) return;
    last = text;
    const canvas = document.createElement('canvas');
    const g = canvas.getContext('2d');
    const font = 'bold 72px ui-monospace, "DejaVu Sans Mono", monospace';
    g.font = font;
    canvas.width = Math.max(48, Math.ceil(g.measureText(text).width) + 24);
    canvas.height = 88;
    g.font = font;
    g.fillStyle = '#111111';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(text, canvas.width / 2, 44);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    sprite.material.map?.dispose();
    sprite.material.map = tex;
    sprite.material.needsUpdate = true;
    height = Math.max(height, .45);
  sprite.scale.set(height * (canvas.width / canvas.height), height, 1);
  };
  set(initial);
  return { sprite, set };
}

function buildTower(scene, cx) {
  const padGeo = new THREE.BoxGeometry(1.35, 0.1, 1.35);
  const pad = new THREE.Mesh(padGeo, lam(0x888888));
  pad.position.set(cx, -0.05, 0);
  pad.add(new THREE.LineSegments(new THREE.EdgesGeometry(padGeo), new THREE.LineBasicMaterial({ color: 0x181818 })));
  scene.add(pad);

  const cubes = [];
  const cubeGeo = new THREE.BoxGeometry(0.88, CUBE_H, 0.88);
  const edgeGeo = new THREE.EdgesGeometry(cubeGeo);
  for (let i = 0; i < MAX_CUBES; i++) {
    const mat = lam(0x1f1f1f);
    const mesh = new THREE.Mesh(cubeGeo, mat);
    mesh.position.set(cx, i * STEP_Y + CUBE_H / 2, 0);
    mesh.add(new THREE.LineSegments(edgeGeo, new THREE.LineBasicMaterial({ color: 0x6a6a6a })));
    scene.add(mesh);
    cubes.push({ mesh, mat, baseY: i * STEP_Y + CUBE_H / 2 });
  }
  return cubes;
}

export default function build(scene, emit) {
  const out = emitter(emit);
  let phase = 'load';
  let playing = true;
  let clock = 0;
  let beat = 0;

  const X_CABLE = -1.05;
  const X_GPU = 1.65;

  // Common floor plate
  const floorGeo = new THREE.BoxGeometry(5.6, 0.08, 2.2);
  const floor = new THREE.Mesh(floorGeo, lam(0xb8b8b8));
  floor.position.set(0.15, -0.14, 0);
  floor.add(new THREE.LineSegments(new THREE.EdgesGeometry(floorGeo), new THREE.LineBasicMaterial({ color: 0x444444 })));
  scene.add(floor);

  // Vertical log10 ruler on the left
  const rulerX = -2.45;
  const maxRulerY = logCubes(WEIGHTS_BYTES) * STEP_Y;
  const axisGeo = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(rulerX, 0, 0),
    new THREE.Vector3(rulerX, maxRulerY + 0.15, 0),
  ]);
  scene.add(new THREE.Line(axisGeo, new THREE.LineBasicMaterial({ color: 0x222222 })));

  const ticks = [
    ['1 MB', logCubes(1e6) * STEP_Y],
    ['100 MB', logCubes(1e8) * STEP_Y],
    ['20 GB', logCubes(WEIGHTS_BYTES) * STEP_Y],
  ];
  for (const [txt, y] of ticks) {
    const tickGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(rulerX - 0.12, y, 0),
      new THREE.Vector3(rulerX + 0.12, y, 0),
    ]);
    scene.add(new THREE.Line(tickGeo, new THREE.LineBasicMaterial({ color: 0x222222 })));
    scene.add(makeLabel(txt, rulerX - 0.62, y, 0, 0.32));
  }

  const cableTower = buildTower(scene, X_CABLE);
  const gpuTower = buildTower(scene, X_GPU);

  scene.add(makeLabel('toy sizes · log10', 0.25, 4.82, 0, 0.34));
  scene.add(makeLabel('across the cable', X_CABLE, -0.58, 0.72, 0.34));
  scene.add(makeLabel('inside the GPU', X_GPU, -0.58, 0.72, 0.34));

  const cableTopLabel = makeDynamicLabel('~20 GB once', X_CABLE, 4.16, 0, 0.34);
  const gpuTopLabel = makeDynamicLabel('0 bytes', X_GPU, 0.52, 0, 0.34);
  const subLeft = makeDynamicLabel('weights cross once', X_CABLE, -1.04, 0.72, 0.32);
  const subRight = makeDynamicLabel('no decode reads', X_GPU, -1.04, 0.72, 0.32);
  scene.add(cableTopLabel.sprite, gpuTopLabel.sprite, subLeft.sprite, subRight.sprite);

  let targetCable = logCubes(WEIGHTS_BYTES);
  let targetGpu = 0;
  let curCable = targetCable;
  let curGpu = targetGpu;

  const applyPhase = () => {
    if (phase === 'load') {
      targetCable = logCubes(WEIGHTS_BYTES);
      targetGpu = 0;
      cableTopLabel.set('~20 GB once');
      gpuTopLabel.set('0 bytes');
      subLeft.set('weights cross once');
      subRight.set('no decode reads');
    } else {
      targetCable = logCubes(DECODE_CABLE_BYTES);
      targetGpu = logCubes(WEIGHTS_BYTES);
      cableTopLabel.set('~0.6 MB / token');
      gpuTopLabel.set('~20 GB / token');
      subLeft.set('vocab 150k × 4B');
      subRight.set(`~${RATIO_ROUNDED.toLocaleString('en-US')}× inside GPU`);
    }
  };
  applyPhase();

  function updateTower(tower, count, activeBeat) {
    const activeIdx = Math.floor(activeBeat) % Math.max(1, Math.ceil(count));
    for (let i = 0; i < MAX_CUBES; i++) {
      const fill = Math.max(0, Math.min(1, count - i));
      const c = tower[i];
      if (fill <= 0.005) {
        c.mesh.visible = false;
      } else {
        c.mesh.visible = true;
        c.mesh.scale.set(1, fill, 1);
        c.mesh.position.y = i * STEP_Y + (CUBE_H * fill) / 2;
        const lit = count > 0.5 && i === activeIdx;
        c.mat.color.setHex(lit ? 0x080808 : 0x2a2a2a);
      }
    }
  }

  return {
    view: { target: [-0.05, 1.9, 0], radius: 40, theta: 0.16, phi: 1.18, size: 3.4 },
    update(dt) {
      const k = ease(dt, 7);
      curCable += (targetCable - curCable) * k;
      curGpu += (targetGpu - curGpu) * k;

      if (playing) {
        clock += dt;
        if (clock >= 0.32) {
          clock = 0;
          beat = (beat + 1) % MAX_CUBES;
        }
      }

      updateTower(cableTower, curCable, beat);
      updateTower(gpuTower, curGpu, beat);

      cableTopLabel.sprite.position.y = curCable * STEP_Y + 0.42;
      gpuTopLabel.sprite.position.y = curGpu * STEP_Y + 0.48;

      const readout = phase === 'decode'
        ? 'simulated · per token: ~0.6 MB over the cable vs ~20 GB read inside the gpu'
        : 'simulated · load once: ~20 GB across the cable, 0 read inside the gpu';
      out({ playing, readout });
    },
    action(name, arg) {
      if (name === 'play') playing = typeof arg === 'boolean' ? arg : !playing;
      else if (name === 'step' || name === 'back') { playing = false; phase = phase === 'load' ? 'decode' : 'load'; applyPhase(); clock = 0; }
      else if (name === 'phase' && (arg === 'load' || arg === 'decode')) {
        phase = arg;
        applyPhase();
      }
    },
  };
}
