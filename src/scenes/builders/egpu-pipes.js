import { THREE, lam, ease, emitter, M, Q, P, S } from './_kit.js';

const BW_TB4 = 4;      // 32 Gb/s PCIe tunnel theoretical max (~4 GB/s)
const BW_TB5 = 8;      // 64 Gb/s PCIe tunnel theoretical max (~8 GB/s)
const BW_VRAM = 1792;  // RTX 5090 GDDR7 spec (1,792 GB/s)

const R_VRAM = 0.68;
// Area ∝ √(GB/s) ⇒ radius ∝ (GB/s)^0.25 so the thin pipe stays legible alongside 1,792 GB/s.
const pipeRadius = bw => R_VRAM * Math.pow(bw / BW_VRAM, 0.25);

const RATE_PER_GBPS = 0.05; // 0.20 cubes/s @ TB4, 0.40 cubes/s @ TB5, 89.6 cubes/s @ VRAM
const LOOP_S = 10.0;
const BEATS = 8;

function makeHatchTexture() {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#dcdcdc';
  g.fillRect(0, 0, 128, 128);
  g.strokeStyle = '#1e1e1e';
  g.lineWidth = 22;
  for (let offset = -128; offset <= 256; offset += 48) {
    g.beginPath();
    g.moveTo(offset, 0);
    g.lineTo(offset + 128, 128);
    g.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 3);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeLabel(lines, x, y, z, height = 0.32) {
  const arr = Array.isArray(lines) ? lines : [lines];
  const canvas = document.createElement('canvas');
  const g = canvas.getContext('2d');
  const font = 'bold 72px ui-monospace, "DejaVu Sans Mono", monospace';
  g.font = font;
  const maxW = Math.max(...arr.map(t => g.measureText(t).width));
  const lineH = 78;
  canvas.width = Math.max(48, Math.ceil(maxW) + 24);
  canvas.height = arr.length * lineH + 16;
  g.font = font;
  g.fillStyle = '#111111';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  arr.forEach((t, i) => g.fillText(t, canvas.width / 2, 8 + (i + 0.5) * lineH));
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }),
  );
  const totalH = Math.max(height, .45) * arr.length;
  sprite.scale.set(totalH * (canvas.width / canvas.height), totalH, 1);
  sprite.position.set(x, y, z);
  sprite.renderOrder = 10;
  return sprite;
}

function makeDynamicLabel(initialLines, x, y, z, height = 0.32) {
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({ transparent: true, depthTest: false }),
  );
  sprite.position.set(x, y, z);
  sprite.renderOrder = 10;
  let lastKey = '';
  const set = lines => {
    const arr = Array.isArray(lines) ? lines : [lines];
    const key = arr.join('\n');
    if (key === lastKey) return;
    lastKey = key;
    const canvas = document.createElement('canvas');
    const g = canvas.getContext('2d');
    const font = 'bold 72px ui-monospace, "DejaVu Sans Mono", monospace';
    g.font = font;
    const maxW = Math.max(...arr.map(t => g.measureText(t).width));
    const lineH = 78;
    canvas.width = Math.max(48, Math.ceil(maxW) + 24);
    canvas.height = arr.length * lineH + 16;
    g.font = font;
    g.fillStyle = '#111111';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    arr.forEach((t, i) => g.fillText(t, canvas.width / 2, 8 + (i + 0.5) * lineH));
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    sprite.material.map?.dispose();
    sprite.material.map = tex;
    sprite.material.needsUpdate = true;
    const totalH = Math.max(height, .45) * arr.length;
    sprite.scale.set(totalH * (canvas.width / canvas.height), totalH, 1);
  };
  set(initialLines);
  return { sprite, set };
}

function addBox(parent, w, h, d, color, edgeColor, x, y, z) {
  const geom = new THREE.BoxGeometry(w, h, d);
  const mesh = new THREE.Mesh(geom, lam(color));
  mesh.position.set(x, y, z);
  if (edgeColor !== null) {
    mesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(geom), new THREE.LineBasicMaterial({ color: edgeColor })));
  }
  parent.add(mesh);
  return mesh;
}

export default function build(scene, emit) {
  const out = emitter(emit);
  let link = 'tb4';
  let playing = true;
  let tbPhase = 0.25;
  let vramPhase = 0;
  let clock = 0;
  let targetClock = 0;
  let lastClock = 0;

  // Laptop box on the left (x = -2.60)
  const laptop = new THREE.Group();
  laptop.position.set(-2.60, 0, 0);
  scene.add(laptop);
  addBox(laptop, 1.12, 0.24, 1.15, 0x525252, 0x111111, 0, -0.30, 0); // base
  addBox(laptop, 0.92, 0.04, 0.52, 0x222222, null, 0, -0.17, 0.14); // keyboard recess
  const screen = addBox(laptop, 1.12, 0.78, 0.08, 0x363636, 0x111111, 0, 0.18, -0.52);
  screen.rotation.x = -0.14;
  addBox(screen, 0.94, 0.60, 0.02, 0xc2c2c2, 0x181818, 0, 0.01, 0.045);
  scene.add(makeLabel('laptop', -2.60, -0.96, 0.55, 0.34));

  // GPU box on the right (x = -0.20 .. +3.60)
  const gpuBox = new THREE.Group();
  gpuBox.position.set(1.70, 0.05, 0);
  scene.add(gpuBox);
  addBox(gpuBox, 3.80, 0.12, 2.15, 0x8e8e8e, 0x161616, 0, -1.12, 0); // floor
  addBox(gpuBox, 3.80, 2.30, 0.08, 0xdcdcdc, 0x2a2a2a, 0, 0.03, -1.04); // light back wall for high contrast
  const boxCage = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(3.80, 2.30, 2.15)),
    new THREE.LineBasicMaterial({ color: 0x282828 }),
  );
  boxCage.position.set(0, 0.03, 0);
  gpuBox.add(boxCage);
  scene.add(makeLabel('GPU box', 1.70, 1.88, -0.55, 0.36));

  // VRAM block inside left side of GPU box (x = +0.28)
  const vramBlock = new THREE.Group();
  vramBlock.position.set(0.28, 0, 0);
  scene.add(vramBlock);
  addBox(vramBlock, 0.72, 1.62, 1.32, 0x383838, 0x0e0e0e, 0, 0, 0);
  for (const ry of [-0.46, 0, 0.46]) {
    addBox(vramBlock, 0.75, 0.05, 1.35, 0x161616, null, 0, ry, 0);
  }
  scene.add(makeLabel('VRAM', 0.28, 1.24, -0.15, 0.34));

  // Compute block inside right side of GPU box (x = +3.08)
  const computeBlock = new THREE.Group();
  computeBlock.position.set(3.08, 0, 0);
  scene.add(computeBlock);
  addBox(computeBlock, 0.78, 1.62, 1.32, 0x1f1f1f, 0x080808, 0, 0, 0);
  // Core die tiles on the front face
  for (let r = -1; r <= 1; r++) {
    for (let c = -1; c <= 1; c++) {
      addBox(computeBlock, 0.16, 0.30, 0.04, 0x525252, 0x101010, c * 0.22, r * 0.40, 0.67);
    }
  }
  scene.add(makeLabel('compute', 3.08, 1.24, -0.15, 0.34));

  // Pipe 1: thin hatched Thunderbolt pipe (laptop x=-2.04 -> VRAM x=-0.08, length=1.96)
  const TB_X0 = -2.04;
  const TB_X1 = -0.08;
  const TB_LEN = TB_X1 - TB_X0;
  const TB_MID = (TB_X0 + TB_X1) / 2;
  const hatchTex = makeHatchTexture();
  const tbPipeMat = lam(0xffffff, {
    map: hatchTex,
    side: THREE.DoubleSide,
  });
  const tbPipe = new THREE.Mesh(
    new THREE.CylinderGeometry(1, 1, TB_LEN, 20, 1, true, 0.08 * Math.PI, 1.50 * Math.PI),
    tbPipeMat,
  );
  tbPipe.rotation.z = -Math.PI / 2;
  tbPipe.position.set(TB_MID, 0, 0);
  scene.add(tbPipe);

  const ringMat = lam(0x181818);
  const tbRingL = new THREE.Mesh(new THREE.TorusGeometry(1, 0.16, 8, 24), ringMat);
  tbRingL.rotation.y = Math.PI / 2;
  tbRingL.position.set(TB_X0 + 0.03, 0, 0);
  const tbRingR = tbRingL.clone();
  tbRingR.position.set(TB_X1 - 0.03, 0, 0);
  scene.add(tbRingL, tbRingR);

  // Leader line from Thunderbolt label down to the thin pipe
  scene.add(new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-1.25, 0.24, 0),
      new THREE.Vector3(-1.32, 1.48, 0),
    ]),
    new THREE.LineBasicMaterial({ color: 0x333333 }),
  ));

  const tbLabel = makeDynamicLabel(
    ['Thunderbolt 4 · PCIe tunnel', '32 Gb/s (~4 GB/s max)'],
    -1.32, 1.88, 0, 0.32,
  );
  scene.add(tbLabel.sprite);

  // Pipe 2: very thick dark pipe between VRAM (x=+0.64) and compute (x=+2.69)
  const VP_X0 = 0.64;
  const VP_X1 = 2.69;
  const VP_LEN = VP_X1 - VP_X0;
  const VP_MID = (VP_X0 + VP_X1) / 2;
  // Open front-top 90° window toward camera so the dense river of cubes inside is crisp
  const vramPipe = new THREE.Mesh(
    new THREE.CylinderGeometry(R_VRAM, R_VRAM, VP_LEN, 32, 1, true, 0.08 * Math.PI, 1.50 * Math.PI),
    lam(0x202020, { side: THREE.DoubleSide }),
  );
  vramPipe.rotation.z = -Math.PI / 2;
  vramPipe.position.set(VP_MID, 0, 0);
  scene.add(vramPipe);

  const vramRingL = new THREE.Mesh(new THREE.TorusGeometry(R_VRAM, 0.045, 10, 32), lam(0x101010));
  vramRingL.rotation.y = Math.PI / 2;
  vramRingL.position.set(VP_X0 + 0.02, 0, 0);
  const vramRingR = vramRingL.clone();
  vramRingR.position.set(VP_X1 - 0.02, 0, 0);
  scene.add(vramRingL, vramRingR);

  scene.add(makeLabel(['1,792 GB/s', '(RTX 5090 spec)'], VP_MID, -1.82, 0.65, 0.32));
  scene.add(makeLabel('weights cross once', -1.62, -1.55, 0.55, 0.32));
  scene.add(makeLabel(['area ∝ √(GB/s)', 'manufacturer spec'], 0.35, -2.66, 0.65, 0.32));

  // Instanced cubes for Thunderbolt pipe (4 pool slots)
  const TB_SLOTS = 4;
  const tbCubes = new THREE.InstancedMesh(
    new THREE.BoxGeometry(0.14, 0.14, 0.14),
    lam(0x101010),
    TB_SLOTS,
  );
  tbCubes.frustumCulled = false;
  scene.add(tbCubes);

  // Instanced cubes for VRAM pipe (16 parallel lanes × 6 slots = 96 cubes)
  const LANES = [];
  LANES.push([0, 0]);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    LANES.push([Math.cos(a) * 0.22, Math.sin(a) * 0.22]);
  }
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 + 0.15;
    LANES.push([Math.cos(a) * 0.45, Math.sin(a) * 0.45]);
  }
  const VRAM_SLOTS = 6;
  const vramCubes = new THREE.InstancedMesh(
    new THREE.BoxGeometry(0.14, 0.14, 0.14),
    lam(0xc8c8c8),
    LANES.length * VRAM_SLOTS,
  );
  vramCubes.frustumCulled = false;
  scene.add(vramCubes);

  let targetTbR = pipeRadius(BW_TB4);
  let curTbR = targetTbR;

  function applyLink() {
    const isTb5 = link === 'tb5';
    targetTbR = pipeRadius(isTb5 ? BW_TB5 : BW_TB4);
    tbLabel.set(
      isTb5
        ? ['Thunderbolt 5 · PCIe tunnel', '64 Gb/s (~8 GB/s max)']
        : ['Thunderbolt 4 · PCIe tunnel', '32 Gb/s (~4 GB/s max)'],
    );
  }
  applyLink();

  function updateFlows(dtFlow) {
    const isTb5 = link === 'tb5';
    const tbRate = (isTb5 ? BW_TB5 : BW_TB4) * RATE_PER_GBPS; // 0.20 or 0.40 cubes/s
    const tbTransit = isTb5 ? 2.6 : 4.2;
    tbPhase += dtFlow * tbRate;

    const tbSpan = (tbRate * tbTransit) / TB_SLOTS;
    for (let i = 0; i < TB_SLOTS; i++) {
      const p = ((tbPhase / TB_SLOTS + i / TB_SLOTS) % 1 + 1) % 1;
      if (p < tbSpan) {
        const u = p / tbSpan;
        const sc = Math.min(1, u * 10, (1 - u) * 10) * (isTb5 ? 1.08 : 0.92);
        P.set(TB_X0 + 0.10 + u * (TB_LEN - 0.20), 0, 0);
        S.setScalar(Math.max(0.001, sc));
      } else {
        P.set(TB_MID, 0, 0);
        S.setScalar(0.0001);
      }
      tbCubes.setMatrixAt(i, M.compose(P, Q, S));
    }
    tbCubes.instanceMatrix.needsUpdate = true;

    const vramLaneRate = (BW_VRAM * RATE_PER_GBPS) / LANES.length; // 5.6 cubes/s per lane
    vramPhase += dtFlow * vramLaneRate;
    for (let l = 0; l < LANES.length; l++) {
      const [ly, lz] = LANES[l];
      const stagger = (l * 0.618034) % 1;
      for (let s = 0; s < VRAM_SLOTS; s++) {
        const u = (((vramPhase + stagger) / VRAM_SLOTS + s / VRAM_SLOTS) % 1 + 1) % 1;
        const sc = Math.min(1, u * 12, (1 - u) * 12);
        P.set(VP_X0 + 0.08 + u * (VP_LEN - 0.16), ly, lz);
        S.setScalar(Math.max(0.001, sc));
        vramCubes.setMatrixAt(l * VRAM_SLOTS + s, M.compose(P, Q, S));
      }
    }
    vramCubes.instanceMatrix.needsUpdate = true;
  }

  updateFlows(0.001);

  return {
    view: { target: [0.20, -0.15, 0], radius: 40, theta: 0.16, phi: 1.14, size: 3.1 },
    update(dt) {
      const k = ease(dt, 7);
      curTbR += (targetTbR - curTbR) * k;
      tbPipe.scale.set(curTbR, 1, curTbR);
      tbRingL.scale.setScalar(curTbR);
      tbRingR.scale.setScalar(curTbR);

      if (playing) {
        clock += dt;
        targetClock = clock;
      } else {
        clock += (targetClock - clock) * k;
      }
      const dtFlow = Math.max(0, clock - lastClock);
      lastClock = clock;
      updateFlows(dtFlow);

      const readout = link === 'tb5'
        ? 'spec sheets · tb5 ~8 GB/s max vs vram 1,792 GB/s'
        : 'spec sheets · tb4 ~4 GB/s max vs vram 1,792 GB/s';
      out({ playing, readout });
    },
    action(name, arg) {
      if (name === 'play') {
        playing = typeof arg === 'boolean' ? arg : !playing;
        if (!playing) targetClock = clock;
      } else if (name === 'step' || name === 'back') {
        playing = false; link = link === 'tb4' ? 'tb5' : 'tb4'; applyLink(); targetClock = clock;
      } else if (name === 'link' && (arg === 'tb4' || arg === 'tb5')) {
        link = arg;
        applyLink();
      }
    },
    dispose() {
      hatchTex.dispose();
    },
  };
}
