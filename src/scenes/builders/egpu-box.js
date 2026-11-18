import { THREE, lam, ease, emitter } from './_kit.js';

function makeLabel(lines, x, y, z, height = 0.36) {
  const arr = Array.isArray(lines) ? lines : [lines];
  const canvas = document.createElement('canvas');
  const g = canvas.getContext('2d');
  const font = 'bold 72px ui-monospace, "DejaVu Sans Mono", monospace';
  g.font = font;
  const maxW = Math.max(...arr.map(t => g.measureText(t).width));
  const lineH = 78;
  canvas.width = Math.ceil(maxW) + 24;
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

function addDashedCage(parent, w, h, d, cx, cy, cz) {
  // Crisp dashed 3D bars on the front/top silhouette plus a subtle dashed wireframe cage.
  const cage = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(w, h, d)),
    new THREE.LineDashedMaterial({ color: 0x222222, dashSize: 0.28, gapSize: 0.16 }),
  );
  cage.computeLineDistances();
  cage.position.set(cx, cy, cz);
  parent.add(cage);

  const dashMat = lam(0x141414);
  const dashStep = 0.42;
  const dashLen = 0.22;
  const x0 = cx - w / 2, x1 = cx + w / 2;
  const y0 = cy - h / 2, y1 = cy + h / 2;
  const zFront = cz + d / 2;
  for (let x = x0 + dashLen / 2; x <= x1 - dashLen / 2; x += dashStep) {
    for (const y of [y0, y1]) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(dashLen, 0.045, 0.045), dashMat);
      bar.position.set(x, y, zFront);
      parent.add(bar);
    }
  }
  for (let y = y0 + dashLen / 2; y <= y1 - dashLen / 2; y += dashStep) {
    for (const x of [x0, x1]) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.045, dashLen, 0.045), dashMat);
      bar.position.set(x, y, zFront);
      parent.add(bar);
    }
  }
}

export default function build(scene, emit) {
  const out = emitter(emit);
  let showBoundary = true;
  let playing = true;
  let clock = 0;
  let beat = 0;
  let pulsePhase = 0;

  // Laptop on the left (x = -1.9)
  const laptop = new THREE.Group();
  laptop.position.set(-1.9, -0.35, 0);
  scene.add(laptop);
  addBox(laptop, 1.75, 0.09, 1.28, 0x3a3a3a, 0x111111, 0, 0, 0);
  addBox(laptop, 1.38, 0.02, 0.56, 0x1a1a1a, null, 0, 0.055, -0.18); // keyboard inset
  addBox(laptop, 0.52, 0.02, 0.34, 0x555555, 0x111111, 0, 0.055, 0.34); // trackpad

  const lid = new THREE.Group();
  lid.position.set(0, 0.045, -0.62);
  lid.rotation.x = -0.32;
  laptop.add(lid);
  addBox(lid, 1.75, 1.12, 0.06, 0x242424, 0x111111, 0, 0.56, 0);
  addBox(lid, 1.54, 0.92, 0.02, 0xb8b8b8, 0x111111, 0, 0.56, 0.03);
  // Subtle terminal lines on screen
  for (let i = 0; i < 4; i++) {
    addBox(lid, 0.95 - i * 0.14, 0.055, 0.015, 0x2e2e2e, null, -0.22 + i * 0.04, 0.78 - i * 0.15, 0.045);
  }
  scene.add(makeLabel('work laptop', -2.05, -1.55, 0.95, 0.45));

  // Thunderbolt 4 cable connecting laptop to enclosure
  const cableCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-1.02, -0.35, 0.12),
    new THREE.Vector3(-0.55, -0.48, 0.18),
    new THREE.Vector3(0.05, -0.48, 0.16),
    new THREE.Vector3(0.58, -0.22, 0.08),
  ]);
  const cableMesh = new THREE.Mesh(
    new THREE.TubeGeometry(cableCurve, 28, 0.055, 10, false),
    lam(0x282828),
  );
  scene.add(cableMesh);
  addBox(scene, 0.14, 0.12, 0.14, 0x111111, null, -1.02, -0.35, 0.12);
  addBox(scene, 0.14, 0.12, 0.14, 0x111111, null, 0.58, -0.22, 0.08);
  scene.add(makeLabel('Thunderbolt 4', -0.18, -0.82, 0.25, 0.34));

  // Small pulse bead moving back and forth inside the Thunderbolt 4 link
  const linkBead = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 0.16), lam(0x0c0c0c));
  scene.add(linkBead);

  // Open eGPU enclosure on the right (x = +1.75)
  const enc = new THREE.Group();
  enc.position.set(1.75, -0.05, 0);
  scene.add(enc);
  addBox(enc, 2.35, 0.1, 1.5, 0x626262, 0x141414, 0, -0.35, 0); // base
  addBox(enc, 2.35, 1.15, 0.08, 0x7a7a7a, 0x141414, 0, 0.22, -0.71); // back wall
  addBox(enc, 0.08, 0.52, 1.5, 0x6c6c6c, 0x141414, -1.14, -0.09, 0); // left rail
  addBox(enc, 0.08, 0.52, 1.5, 0x6c6c6c, 0x141414, 1.14, -0.09, 0); // right rail
  const encFrame = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(2.35, 1.15, 1.5)),
    new THREE.LineBasicMaterial({ color: 0x333333 }),
  );
  encFrame.position.set(0, 0.22, 0);
  enc.add(encFrame);

  // GPU board inside the enclosure (long slab with 3 fan circles)
  const gpu = new THREE.Group();
  gpu.position.set(0, 0.18, 0.05);
  enc.add(gpu);
  addBox(gpu, 1.96, 0.62, 0.32, 0x1e1e1e, 0x0a0a0a, 0, 0, 0);
  addBox(gpu, 0.08, 0.72, 0.38, 0x484848, 0x111111, -0.96, -0.02, 0); // PCIe bracket

  const fanRotors = [];
  const fanGeo = new THREE.CylinderGeometry(0.21, 0.21, 0.03, 20);
  const hubGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.05, 12);
  const bladeGeo = new THREE.BoxGeometry(0.34, 0.035, 0.03);
  for (const fx of [-0.56, 0, 0.56]) {
    const ring = new THREE.Mesh(fanGeo, lam(0x9a9a9a));
    ring.rotation.x = Math.PI / 2;
    ring.position.set(fx, 0, 0.17);
    gpu.add(ring);

    const hub = new THREE.Mesh(hubGeo, lam(0x111111));
    hub.rotation.x = Math.PI / 2;
    hub.position.set(fx, 0, 0.18);
    gpu.add(hub);

    const rotor = new THREE.Group();
    rotor.position.set(fx, 0, 0.185);
    for (let b = 0; b < 3; b++) {
      const blade = new THREE.Mesh(bladeGeo, lam(0x222222));
      blade.rotation.z = (b * Math.PI) / 3;
      rotor.add(blade);
    }
    gpu.add(rotor);
    fanRotors.push(rotor);
  }

  scene.add(makeLabel('GPU', 1.75, 1.18, 0.12, 0.36));
  scene.add(makeLabel('eGPU enclosure', 1.75, -1.42, 0.95, 0.34));

  // Boundary + blocked outside link group (toggled by `boundary`)
  const boundaryGroup = new THREE.Group();
  scene.add(boundaryGroup);
  addDashedCage(boundaryGroup, 6.25, 2.55, 2.25, -0.02, 0.05, 0.02);
  boundaryGroup.add(makeLabel('data stays here', 1.05, 1.62, 0.1, 0.36));

  // Plain cloud-free 'internet' box outside the boundary above the laptop
  addBox(boundaryGroup, 1.5, 0.56, 0.52, 0xd4d4d4, 0x222222, -1.9, 2.38, 0);
  boundaryGroup.add(makeLabel('internet', -1.9, 2.9, 0, 0.36));

  // Dashed outside link from laptop up toward 'internet'
  const extLineGeom = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(-1.9, 0.84, 0),
    new THREE.Vector3(-1.9, 2.1, 0),
  ]);
  const extLine = new THREE.Line(
    extLineGeom,
    new THREE.LineDashedMaterial({ color: 0x3a3a3a, dashSize: 0.14, gapSize: 0.1 }),
  );
  extLine.computeLineDistances();
  boundaryGroup.add(extLine);

  // Crossed-out link (X made of two thin bars) at the boundary crossing
  const cross = new THREE.Group();
  cross.position.set(-1.9, 1.48, 0.08);
  const barA = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.085, 0.085), lam(0x111111));
  barA.rotation.z = Math.PI / 4;
  const barB = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.085, 0.085), lam(0x111111));
  barB.rotation.z = -Math.PI / 4;
  cross.add(barA, barB);
  boundaryGroup.add(cross);

  const apply = () => {
    boundaryGroup.visible = showBoundary;
  };
  apply();

  return {
    view: { target: [-0.05, 0.35, 0], radius: 40, theta: 0.24, phi: 1.12, size: 3.15 },
    update(dt) {
      if (playing) {
        clock += dt;
        pulsePhase = (clock % 4.0) / 4.0;
        for (const r of fanRotors) r.rotation.z -= dt * 3.8;
      } else {
        const targetPhase = (beat % 4) / 4;
        pulsePhase += (targetPhase - pulsePhase) * ease(dt, 7);
      }
      const u = 0.5 - 0.5 * Math.cos(pulsePhase * Math.PI * 2);
      linkBead.position.copy(cableCurve.getPoint(u));

      const readout = showBoundary
        ? 'speaker setup · gpu over thunderbolt 4 · data stays on the laptop side'
        : 'speaker setup · gpu over thunderbolt 4 · boundary hidden';
      out({ playing, readout });
    },
    action(name, arg) {
      if (name === 'play') playing = typeof arg === 'boolean' ? arg : !playing;
      else if (name === 'step' || name === 'back') {
        playing = false; showBoundary = !showBoundary; apply();
      } else if (name === 'boundary') {
        showBoundary = !!arg;
        apply();
      }
    },
  };
}
