import { THREE, lam, ease, emitter } from './_kit.js';

function makeLabel(text, x, y, z, height = 0.34) {
  const canvas = document.createElement('canvas');
  const g = canvas.getContext('2d');
  const font = 'bold 68px ui-monospace, "DejaVu Sans Mono", monospace';
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
  sprite.scale.set(height * (canvas.width / canvas.height), height, 1);
  sprite.position.set(x, y, z);
  sprite.renderOrder = 10;
  return sprite;
}

function makeDynamicLabel(initial, x, y, z, height = 0.42) {
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
    canvas.width = Math.max(64, Math.ceil(g.measureText(text).width) + 28);
    canvas.height = 92;
    g.font = font;
    g.fillStyle = '#111111';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(text, canvas.width / 2, 46);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    sprite.material.map?.dispose();
    sprite.material.map = tex;
    sprite.material.needsUpdate = true;
    sprite.scale.set(height * (canvas.width / canvas.height), height, 1);
  };
  set(initial);
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

const clamp01 = v => (v < 0 ? 0 : v > 1 ? 1 : v);

export default function build(scene, emit) {
  const out = emitter(emit);
  let phase = 'load';
  let playing = true;
  let loadClock = 0; // 0..9.5 s loop (8 s transfer + 1.5 s hold)
  let decodeClock = 0; // 0..1.6 s per token beat
  let kvCount = 1;
  const maxKv = 8;

  // Left: laptop / SSD stack
  addBox(scene, 2.05, 0.12, 1.62, 0x5c5c5c, 0x181818, -2.2, -0.52, 0);
  addBox(scene, 1.9, 0.14, 1.5, 0x8e8e8e, 0x181818, -2.2, -0.36, 0);
  scene.add(makeLabel('laptop / SSD', -2.3, -1.14, 0.88, 0.34));
  const weightsLabel = makeLabel('weights ~20 GB', -2.2, 1.48, 0, 0.36);
  scene.add(weightsLabel);

  // Right: GPU with VRAM slab + shroud outline
  addBox(scene, 2.45, 0.14, 1.88, 0x3b3b3b, 0x111111, 2.15, -0.36, 0);
  addBox(scene, 2.25, 0.06, 1.24, 0x727272, 0x181818, 2.15, -0.25, -0.22); // VRAM slab
  const gpuCage = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(2.45, 1.28, 1.88)),
    new THREE.LineBasicMaterial({ color: 0x4a4a4a }),
  );
  gpuCage.position.set(2.15, 0.21, 0);
  scene.add(gpuCage);
  scene.add(makeLabel('GPU · VRAM', 2.25, -1.14, 0.95, 0.34));

  // Middle: Thunderbolt 4 cable
  const cableCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-1.24, -0.34, 0.05),
    new THREE.Vector3(-0.68, -0.52, 0.12),
    new THREE.Vector3(0.18, -0.52, 0.12),
    new THREE.Vector3(0.92, -0.32, 0.05),
  ]);
  scene.add(new THREE.Mesh(new THREE.TubeGeometry(cableCurve, 28, 0.055, 10, false), lam(0x2d2d2d)));
  addBox(scene, 0.14, 0.12, 0.14, 0x111111, null, -1.24, -0.34, 0.05);
  addBox(scene, 0.14, 0.12, 0.14, 0x111111, null, 0.92, -0.32, 0.05);
  scene.add(makeLabel('Thunderbolt 4', -0.22, -0.92, 0.24, 0.34));

  // 36 weight cubes (4 cols x 3 layers x 3 rows)
  const COLS = 4, ROWS = 3, LAYERS = 3, COUNT = COLS * ROWS * LAYERS;
  const srcPos = [], dstPos = [], cubes = [];
  const cubeGeo = new THREE.BoxGeometry(0.24, 0.24, 0.24);
  const slotGeo = new THREE.EdgesGeometry(new THREE.BoxGeometry(0.24, 0.24, 0.24));
  const slotMat = new THREE.LineBasicMaterial({ color: 0x999999 });
  const weightMat = lam(0x1a1a1a);
  const weightEdgeMat = new THREE.LineBasicMaterial({ color: 0x555555 });

  for (let l = 0; l < LAYERS; l++) {
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const sx = -2.2 + (c - 1.5) * 0.34;
        const sy = -0.14 + l * 0.31;
        const sz = (r - 1) * 0.34;
        srcPos.push(new THREE.Vector3(sx, sy, sz));

        const dx = 2.15 + (c - 1.5) * 0.34;
        const dy = -0.06 + l * 0.31;
        const dz = -0.22 + (r - 1) * 0.34;
        dstPos.push(new THREE.Vector3(dx, dy, dz));

        // Subtle outline slot on VRAM side so destination fills visibly
        const slot = new THREE.LineSegments(slotGeo, slotMat);
        slot.position.set(dx, dy, dz);
        scene.add(slot);

        const cube = new THREE.Mesh(cubeGeo, weightMat);
        cube.add(new THREE.LineSegments(slotGeo, weightEdgeMat));
        cube.position.set(sx, sy, sz);
        scene.add(cube);
        cubes.push(cube);
      }
    }
  }

  // KV strip inside the GPU (front of VRAM slab)
  const kvRail = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(1.88, 0.26, 0.3)),
    new THREE.LineBasicMaterial({ color: 0x555555 }),
  );
  kvRail.position.set(2.15, -0.06, 0.66);
  scene.add(kvRail);
  const kvBlocks = [];
  for (let i = 0; i < maxKv; i++) {
    const blk = addBox(scene, 0.18, 0.22, 0.24, 0x141414, 0x777777, 1.36 + i * 0.225, -0.06, 0.66);
    blk.scale.setScalar(0.001);
    kvBlocks.push(blk);
  }
  const kvLabel = makeLabel('KV cache (on GPU)', 2.15, 0.38, 0.78, 0.32);
  scene.add(kvLabel);

  // Tiny single token cubes for decode phase
  const tokIn = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 0.14), lam(0x0c0c0c));
  const tokOut = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 0.14), lam(0x282828));
  scene.add(tokIn, tokOut);

  // Phase-specific labels
  const counterLabel = makeDynamicLabel('0 s', -0.16, 1.36, 0, 0.44);
  const speakerSub = makeLabel('about 20 s · speaker', -0.16, 0.9, 0, 0.32);
  const tokenSub = makeLabel('token ids cross', -0.16, 0.98, 0, 0.34);
  scene.add(counterLabel.sprite, speakerSub, tokenSub);

  const applyPhase = () => {
    const isLoad = phase === 'load';
    counterLabel.sprite.visible = isLoad;
    speakerSub.visible = isLoad;
    tokenSub.visible = !isLoad;
    kvLabel.visible = !isLoad;
    kvRail.visible = !isLoad;
    if (isLoad) {
      loadClock = 0;
      kvCount = 0;
    } else {
      decodeClock = 0;
      kvCount = 1;
    }
  };
  applyPhase();

  const tmpPos = new THREE.Vector3();

  return {
    view: { target: [-0.02, 0.2, 0], radius: 40, theta: 0.26, phi: 1.08, size: 3.1 },
    update(dt) {
      const k = ease(dt, 8);
      if (phase === 'load') {
        if (playing) {
          loadClock += dt;
          if (loadClock >= 9.6) loadClock = 0;
        }
        const p = clamp01(loadClock / 8.0);
        const sec = Math.min(20, Math.round(p * 20));
        counterLabel.set(`${sec} s`);

        for (let i = 0; i < COUNT; i++) {
          const start = (i / COUNT) * 0.78;
          const u = clamp01((p - start) / 0.22);
          if (u <= 0) {
            cubes[i].position.copy(srcPos[i]);
            cubes[i].scale.setScalar(1);
          } else if (u >= 1) {
            cubes[i].position.copy(dstPos[i]);
            cubes[i].scale.setScalar(1);
          } else {
            // Smooth hop onto cable and across into VRAM
            const cablePt = cableCurve.getPoint(u);
            if (u < 0.22) {
              const f = u / 0.22;
              tmpPos.lerpVectors(srcPos[i], cablePt, f);
              tmpPos.y += Math.sin(f * Math.PI) * 0.35;
            } else if (u > 0.78) {
              const f = (u - 0.78) / 0.22;
              tmpPos.lerpVectors(cablePt, dstPos[i], f);
              tmpPos.y += Math.sin(f * Math.PI) * 0.35;
            } else {
              tmpPos.copy(cablePt);
              tmpPos.y += 0.14;
            }
            cubes[i].position.copy(tmpPos);
            cubes[i].scale.setScalar(0.75);
          }
        }
        tokIn.visible = false;
        tokOut.visible = false;
        for (const blk of kvBlocks) blk.visible = false;
      } else {
        // Decode phase: all weights stay resident in VRAM
        if (playing) {
          decodeClock += dt;
          if (decodeClock >= 1.6) {
            decodeClock = 0;
            kvCount = kvCount >= maxKv ? 1 : kvCount + 1;
          }
        }
        const f = decodeClock / 1.6;
        const pulse = f > 0.4 && f < 0.62 ? 1.06 : 1.0;
        for (let i = 0; i < COUNT; i++) {
          cubes[i].position.lerp(dstPos[i], k);
          cubes[i].scale.setScalar(pulse);
        }

        // Tiny token id hops in (0..0.44), sampled token id hops out (0.56..1.0)
        if (f < 0.44) {
          const u = f / 0.44;
          tokIn.visible = true;
          tokOut.visible = false;
          tokIn.position.copy(cableCurve.getPoint(u));
          tokIn.position.y += 0.18 + Math.sin(u * Math.PI) * 0.3;
        } else if (f > 0.56) {
          const u = 1 - (f - 0.56) / 0.44;
          tokIn.visible = false;
          tokOut.visible = true;
          tokOut.position.copy(cableCurve.getPoint(u));
          tokOut.position.y += 0.18 + Math.sin(u * Math.PI) * 0.3;
        } else {
          tokIn.visible = false;
          tokOut.visible = false;
        }

        for (let i = 0; i < maxKv; i++) {
          kvBlocks[i].visible = true;
          const target = i < kvCount ? 1 : 0.001;
          const s = kvBlocks[i].scale.x + (target - kvBlocks[i].scale.x) * k;
          kvBlocks[i].scale.setScalar(s);
        }
      }

      const readout = phase === 'load'
        ? 'speaker · load: ~20 GB once, about 20 s'
        : 'mechanism · decode: tokens cross, weights + kv stay on gpu';
      out({ playing, readout });
    },
    action(name, arg) {
      if (name === 'play') playing = typeof arg === 'boolean' ? arg : !playing;
      else if (name === 'phase' && (arg === 'load' || arg === 'decode')) {
        phase = arg;
        applyPhase();
      } else if (name === 'step') {
        if (phase === 'load') {
          loadClock = loadClock >= 7.8 ? 0 : loadClock + 1.6;
        } else {
          kvCount = kvCount >= maxKv ? 1 : kvCount + 1;
          decodeClock = 0.5;
        }
      }
    },
  };
}
