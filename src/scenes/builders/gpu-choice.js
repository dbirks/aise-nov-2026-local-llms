// Scene `gpu-choice` (route B01) — "Room vs speed vs where it plugs in"
//
// Upright glass tanks compare capacity linearly (RTX 5090 = 32 GB, DGX Spark = 128 GB; 4× height).
// Horizontal pipes below each tank compare manufacturer-rated memory bandwidth using sqrt(GB/s)
// thickness (1,792 GB/s GDDR7 vs 273 GB/s unified LPDDR5x) so 273 GB/s remains visible.
// A model + KV + workspace budget block (20 / 30 / 40 / 90 GB) drops into both tanks; overflow
// above 32 GB renders as a hatched/ghost block with "doesn't fit".
// Toggling `egpu` shows the Windows laptop + thin "eGPU link" cable on the left: one packet
// loads laptop -> 5090 once ("load once ~20 s, speaker observation") while decode reads circulate
// inside the 5090 tank when the budget fits. DGX Spark sits beside a standalone "separate machine"
// unit with no laptop link.
//
// Sources:
//   - NVIDIA RTX 5090 spec (32 GB GDDR7, 1,792 GB/s rated):
//     https://www.nvidia.com/en-us/geforce/graphics-cards/50-series/rtx-5090/
//   - NVIDIA DGX Spark spec (128 GB unified LPDDR5x, 273 GB/s rated):
//     https://docs.nvidia.com/dgx/dgx-spark/hardware.html
//   - Speaker observation (~20 s model load over laptop eGPU link, decode stays on card).
import { THREE, lam, ghost, M, Q, P, S, ease, emitter } from './_kit.js';

const CAP_5090 = 32;
const CAP_SPARK = 128;
const BW_5090 = 1792;
const BW_SPARK = 273;

const GB_SCALE = 0.034; // 128 GB = 4.352 units, 32 GB = 1.088 units
const BASE_Y = -1.68;
const TANK_W = 1.10;
const TANK_D = 1.10;
const BLOCK_W = 0.92;
const BLOCK_D = 0.92;

const X_LAPTOP = -3.35;
const X_5090 = -1.18;
const X_SPARK = 1.85;
const X_SPARK_BOX = 3.30;

const PIPE_Y = -2.30;
const PIPE_LEN = 1.54;
const pipeThick = gbps => 0.014 * Math.sqrt(gbps);
const TH_5090 = pipeThick(BW_5090);   // ~0.593
const TH_SPARK = pipeThick(BW_SPARK); // ~0.231

const CYCLE = 10.0;
const LOAD_END = 2.2;
const BEAT_T = [0.6, 4.0, 7.6];

function makeHatchTexture() {
  const cv = document.createElement('canvas');
  cv.width = 128;
  cv.height = 128;
  const g = cv.getContext('2d');
  g.fillStyle = '#dcdcdc';
  g.fillRect(0, 0, 128, 128);
  g.strokeStyle = '#222222';
  g.lineWidth = 14;
  for (let i = -128; i < 256; i += 32) {
    g.beginPath();
    g.moveTo(i, 0);
    g.lineTo(i + 128, 128);
    g.stroke();
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeLabel(lines, h = 0.34, align = 'center') {
  const arr = Array.isArray(lines) ? lines : [lines];
  const fpx = 68;
  const font = `bold ${fpx}px ui-monospace, "DejaVu Sans Mono", monospace`;
  const cv = document.createElement('canvas');
  const g = cv.getContext('2d');
  g.font = font;
  const maxW = Math.max(32, ...arr.map(t => Math.ceil(g.measureText(t).width)));
  const padX = 14;
  const lineH = fpx + 14;
  cv.width = maxW + padX * 2;
  cv.height = arr.length * lineH + 10;
  g.font = font;
  g.fillStyle = '#111111';
  g.textBaseline = 'middle';
  g.textAlign = align;
  const tx = align === 'left' ? padX : align === 'right' ? cv.width - padX : cv.width / 2;
  arr.forEach((t, i) => {
    g.fillText(t, tx, 5 + lineH * (i + 0.5));
  });
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, depthTest: false });
  const sp = new THREE.Sprite(mat);
  sp.renderOrder = 25;
  const totalH = h * arr.length;
  sp.userData.aspect = cv.width / cv.height;
  sp.userData.baseH = totalH;
  sp.scale.set(totalH * sp.userData.aspect, totalH, 1);
  if (align === 'left') sp.center.set(0, 0.5);
  else if (align === 'right') sp.center.set(1, 0.5);
  return sp;
}

function makeBoxEdges(w, h, d, color = 0x161616) {
  return new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(w, h, d)),
    new THREE.LineBasicMaterial({ color })
  );
}

function makeReadout(budget, egpu) {
  const sp5090 = CAP_5090 - budget;
  const spSpark = CAP_SPARK - budget;
  if (budget === 30 && egpu) {
    return '30 GB budget · fits 5090 (2 GB spare) · fits spark (98 GB spare) · rated bw only';
  }
  if (sp5090 >= 0) {
    if (egpu) {
      return `${budget} GB budget · fits 5090 (${sp5090} GB spare) · fits spark (${spSpark} GB spare) · rated bw`;
    }
    return `${budget} GB · fits 5090 (${sp5090} GB spare) · fits spark (${spSpark} GB spare) · egpu off`;
  }
  const over = -sp5090;
  if (egpu) {
    return `${budget} GB budget · overflows 5090 (+${over} GB) · fits spark (${spSpark} GB spare) · rated bw`;
  }
  return `${budget} GB · overflows 5090 (+${over} GB) · fits spark (${spSpark} GB spare) · egpu off`;
}

export default function build(scene, emit) {
  const out = emitter(emit);
  const hatchTex = makeHatchTexture();

  // ── upright glass tanks (32 GB vs 128 GB, same base) ─────────────────
  function createTank(x, capGB) {
    const h = capGB * GB_SCALE;
    const cy = BASE_Y + h / 2;

    const plinth = new THREE.Mesh(new THREE.BoxGeometry(TANK_W + 0.14, 0.1, TANK_D + 0.14), lam(0x2e2e2e));
    plinth.position.set(x, BASE_Y - 0.05, 0);
    scene.add(plinth);

    const glass = new THREE.Mesh(new THREE.BoxGeometry(TANK_W, h, TANK_D), ghost(0xd4d4d4, 0.22));
    glass.position.set(x, cy, 0);
    const frame = makeBoxEdges(TANK_W, h, TANK_D, 0x161616);
    frame.position.set(x, cy, 0);
    const rim = makeBoxEdges(TANK_W + 0.04, 0.035, TANK_D + 0.04, 0x111111);
    rim.position.set(x, BASE_Y + h, 0);
    scene.add(glass, frame, rim);

    const fitMesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), lam(0x4a4a4a));
    const fitEdge = makeBoxEdges(1, 1, 1, 0x0b0b0b);
    fitMesh.position.set(x, BASE_Y, 0);
    fitEdge.position.set(x, BASE_Y, 0);
    scene.add(fitMesh, fitEdge);

    const overMat = new THREE.MeshBasicMaterial({ map: hatchTex, transparent: true, opacity: 0.84 });
    const overMesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), overMat);
    const overEdge = makeBoxEdges(1, 1, 1, 0x141414);
    overMesh.visible = false;
    overEdge.visible = false;
    scene.add(overMesh, overEdge);

    return { x, h, plinth, fitMesh, fitEdge, overMesh, overEdge };
  }

  const tank5090 = createTank(X_5090, CAP_5090);
  const tankSpark = createTank(X_SPARK, CAP_SPARK);

  // Thin 2 GB sliver highlight inside 5090 tank when budget === 30
  const sliver = new THREE.Mesh(new THREE.BoxGeometry(BLOCK_W, 0.068, BLOCK_D), lam(0xd4d4d4));
  sliver.position.set(X_5090, BASE_Y + 31 * GB_SCALE, 0);
  const sliverTick = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.024, 0.024), new THREE.MeshBasicMaterial({ color: 0x111111 }));
  sliverTick.position.set(X_5090 + TANK_W / 2 + 0.12, BASE_Y + 31 * GB_SCALE, 0);
  scene.add(sliver, sliverTick);

  // ── horizontal bandwidth pipes under each tank (thickness ∝ sqrt(GB/s)) ─
  function createPipe(x, thick) {
    const stub = new THREE.Mesh(new THREE.BoxGeometry(0.18, Math.abs(PIPE_Y - BASE_Y) - 0.06, 0.18), lam(0x4a4a4a));
    stub.position.set(x, (BASE_Y + PIPE_Y) / 2, 0);
    const pipe = new THREE.Mesh(new THREE.BoxGeometry(PIPE_LEN, thick, thick), lam(0x888888));
    pipe.position.set(x, PIPE_Y, 0);
    const pipeEdge = makeBoxEdges(PIPE_LEN, thick, thick, 0x1a1a1a);
    pipeEdge.position.set(x, PIPE_Y, 0);
    scene.add(stub, pipe, pipeEdge);
    return { pipe, pipeEdge, thick, x };
  }

  createPipe(X_5090, TH_5090);
  createPipe(X_SPARK, TH_SPARK);

  const N_PIPE = 5;
  const pipeCubes = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), lam(0x121212), N_PIPE * 2);
  pipeCubes.frustumCulled = false;
  scene.add(pipeCubes);

  // ── Windows laptop + thin eGPU link (left of 5090) ────────────────────
  const egpuGroup = new THREE.Group();
  const lapBase = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.09, 0.60), lam(0x323232));
  lapBase.position.set(X_LAPTOP, -1.52, 0);
  const lapScreen = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.50, 0.06), lam(0x222222));
  lapScreen.position.set(X_LAPTOP - 0.06, -1.26, -0.26);
  lapScreen.rotation.x = -0.18;
  const lapFace = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.38, 0.02), lam(0xc2c2c2));
  lapFace.position.set(X_LAPTOP - 0.06, -1.26, -0.225);
  lapFace.rotation.x = -0.18;
  const linkStartX = X_LAPTOP + 0.39;
  const linkEndX = X_5090 - TANK_W / 2;
  const linkLen = linkEndX - linkStartX;
  const egpuCable = new THREE.Mesh(new THREE.BoxGeometry(linkLen, 0.05, 0.05), lam(0x141414));
  egpuCable.position.set((linkStartX + linkEndX) / 2, -1.49, 0);
  egpuGroup.add(lapBase, lapScreen, lapFace, egpuCable);
  scene.add(egpuGroup);

  const loadPacket = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 0.16), lam(0x0c0c0c));
  scene.add(loadPacket);

  // Fast small loop of packets circulating INSIDE the 5090 tank ("decode reads stay on the card")
  const N_LOOP = 4;
  const loopPackets = new THREE.InstancedMesh(new THREE.BoxGeometry(0.13, 0.13, 0.13), lam(0x0c0c0c), N_LOOP);
  loopPackets.frustumCulled = false;
  scene.add(loopPackets);

  // ── DGX Spark standalone box (right of Spark tank, no laptop) ─────────
  const sparkBox = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.34, 0.66), lam(0x323232));
  sparkBox.position.set(X_SPARK_BOX, -1.51, 0);
  const sparkBoxEdge = makeBoxEdges(0.66, 0.34, 0.66, 0x101010);
  sparkBoxEdge.position.copy(sparkBox.position);
  const sparkConn = new THREE.Mesh(
    new THREE.BoxGeometry(X_SPARK_BOX - 0.33 - (X_SPARK + TANK_W / 2), 0.08, 0.16),
    lam(0x3c3c3c)
  );
  sparkConn.position.set((X_SPARK + TANK_W / 2 + X_SPARK_BOX - 0.33) / 2, -1.51, 0);
  scene.add(sparkBox, sparkBoxEdge, sparkConn);

  // ── labels (dark on transparent, bold >= 64px canvas font) ────────────
  const lbl5090 = makeLabel('RTX 5090 · 32 GB', 0.33);
  const lbl5090Bw = makeLabel('1,792 GB/s rated', 0.31);
  lbl5090Bw.position.set(X_5090, PIPE_Y - TH_5090 / 2 - 0.34, 0);

  const lblSpark = makeLabel('DGX Spark · 128 GB', 0.33);
  lblSpark.position.set(X_SPARK, BASE_Y + CAP_SPARK * GB_SCALE + 0.42, 0);
  const lblSparkBw = makeLabel('273 GB/s rated', 0.31);
  lblSparkBw.position.set(X_SPARK, PIPE_Y - TH_SPARK / 2 - 0.42, 0);

  const lblPipeNote = makeLabel('pipe width ∝ √ rated GB/s', 0.31);
  lblPipeNote.position.set(0.35, PIPE_Y - 1.04, 0);

  const lblNoFit = makeLabel("doesn't fit", 0.32);

  const lblTight = makeLabel(['little room', 'left for kv'], 0.25, 'left');
  lblTight.position.set(X_5090 + TANK_W / 2 + 0.28, BASE_Y + 31 * GB_SCALE + 0.04, 0);

  const lblLaptop = makeLabel('Windows laptop', 0.28);
  lblLaptop.position.set(X_LAPTOP, -1.98, 0);

  const lblLink = makeLabel('eGPU link', 0.27);
  lblLink.position.set((linkStartX + linkEndX) / 2, -1.20, 0);

  const lblLoad = makeLabel(['load once ~20 s', 'speaker observation'], 0.24, 'right');
  lblLoad.position.set(X_5090 - TANK_W / 2 - 0.14, -0.56, 0);

  const lblDecode = makeLabel(['decode reads', 'stay on the card'], 0.24, 'center');
  lblDecode.position.set((X_5090 + TANK_W / 2 + X_SPARK - TANK_W / 2) / 2, BASE_Y + 0.34, 0);

  const lblSeparate = makeLabel(['separate', 'machine'], 0.28);
  lblSeparate.position.set(X_SPARK_BOX, -0.82, 0);

  scene.add(
    lbl5090, lbl5090Bw, lblSpark, lblSparkBw, lblPipeNote,
    lblNoFit, lblTight, lblLaptop, lblLink, lblLoad, lblDecode, lblSeparate
  );

  // ── state ─────────────────────────────────────────────────────────────
  let budget = 30;
  let egpu = true;
  let playing = true;
  let cycleT = 0;
  let cur5090Fit = Math.min(budget, CAP_5090);
  let cur5090Over = Math.max(0, budget - CAP_5090);
  let curSparkFit = Math.min(budget, CAP_SPARK);
  let egpuVis = 1;
  let pipePhase5090 = 0;
  let pipePhaseSpark = 0;
  let loopPhase = 0;
  let beat = 0;

  const setSpriteVisible = (sp, vis) => {
    sp.visible = vis > 0.04;
    sp.material.opacity = vis;
  };

  return {
    view: { target: [-0.05, 0.14, 0], radius: 40, theta: 0.24, phi: 1.22, size: 3.85 },
    update(dt) {
      if (playing) {
        cycleT = (cycleT + dt) % CYCLE;
      }
      beat = cycleT < LOAD_END ? 0 : cycleT < 6.4 ? 1 : 2;

      const k = ease(dt, 7);
      const targ5090Fit = Math.min(budget, CAP_5090);
      const targ5090Over = Math.max(0, budget - CAP_5090);
      const targSparkFit = Math.min(budget, CAP_SPARK);

      cur5090Fit += (targ5090Fit - cur5090Fit) * k;
      cur5090Over += (targ5090Over - cur5090Over) * k;
      curSparkFit += (targSparkFit - curSparkFit) * k;
      egpuVis += ((egpu ? 1 : 0) - egpuVis) * k;

      // Update 5090 fitting block
      const h5090Fit = Math.max(0.001, cur5090Fit * GB_SCALE);
      tank5090.fitMesh.scale.set(BLOCK_W, h5090Fit, BLOCK_D);
      tank5090.fitMesh.position.y = BASE_Y + h5090Fit / 2;
      tank5090.fitEdge.scale.copy(tank5090.fitMesh.scale);
      tank5090.fitEdge.position.copy(tank5090.fitMesh.position);

      // Update 5090 overflow hatched block
      const hasOver = cur5090Over > 0.05;
      tank5090.overMesh.visible = hasOver;
      tank5090.overEdge.visible = hasOver;
      const top5090Tank = BASE_Y + CAP_5090 * GB_SCALE;
      if (hasOver) {
        const hOver = cur5090Over * GB_SCALE;
        tank5090.overMesh.scale.set(BLOCK_W, hOver, BLOCK_D);
        tank5090.overMesh.position.set(X_5090, top5090Tank + hOver / 2, 0);
        tank5090.overEdge.scale.copy(tank5090.overMesh.scale);
        tank5090.overEdge.position.copy(tank5090.overMesh.position);
        hatchTex.repeat.set(2, Math.max(0.8, hOver * 1.8));
        lblNoFit.visible = true;
        lblNoFit.position.set(X_5090, top5090Tank + hOver + 0.34, 0);
        lbl5090.position.set(X_5090, top5090Tank + hOver + 0.78, 0);
      } else {
        lblNoFit.visible = false;
        lbl5090.position.set(X_5090, top5090Tank + 0.48, 0);
      }

      // 2 GB thin sliver when budget === 30
      const showTight = budget === 30;
      sliver.visible = showTight;
      sliverTick.visible = showTight;
      lblTight.visible = showTight;

      // Update Spark fitting block
      const hSparkFit = Math.max(0.001, curSparkFit * GB_SCALE);
      tankSpark.fitMesh.scale.set(BLOCK_W, hSparkFit, BLOCK_D);
      tankSpark.fitMesh.position.y = BASE_Y + hSparkFit / 2;
      tankSpark.fitEdge.scale.copy(tankSpark.fitMesh.scale);
      tankSpark.fitEdge.position.copy(tankSpark.fitMesh.position);

      // Keep blocks distinct from ink packets while still reading as dark important mass
      const sparkFocus = beat === 2 ? 0x383838 : 0x484848;
      tankSpark.fitMesh.material.color.setHex(sparkFocus);
      const fit5090Ok = budget <= CAP_5090;
      tank5090.fitMesh.material.color.setHex(fit5090Ok ? (beat === 1 ? 0x383838 : 0x4a4a4a) : 0x626262);

      // eGPU group visibility & load-once packet + on-card decode loop
      egpuGroup.visible = egpuVis > 0.04;
      egpuGroup.scale.setScalar(Math.max(0.001, egpuVis));
      setSpriteVisible(lblLaptop, egpuVis);
      setSpriteVisible(lblLink, egpuVis);

      const inLoadPhase = egpu && cycleT < LOAD_END;
      const loadU = Math.min(1, cycleT / LOAD_END);
      if (egpu && inLoadPhase) {
        loadPacket.visible = true;
        const px = linkStartX - 0.1 + (X_5090 - (linkStartX - 0.1)) * loadU;
        loadPacket.position.set(px, -1.42, 0.25);
        setSpriteVisible(lblLoad, egpuVis);
      } else {
        loadPacket.visible = false;
        setSpriteVisible(lblLoad, egpu ? 0.9 * egpuVis : 0);
      }

      // Fast small loop of packets circulating INSIDE the 5090 tank when it fits
      const loopActive = fit5090Ok && (!egpu || !inLoadPhase);
      if (playing && loopActive) {
        loopPhase = (loopPhase + dt * 1.45) % 1;
      }
      lblDecode.visible = fit5090Ok;
      lblDecode.material.opacity = loopActive ? 1 : 0.85;
      for (let i = 0; i < N_LOOP; i++) {
        if (!fit5090Ok) {
          loopPackets.setMatrixAt(i, M.compose(P.set(0, -20, 0), Q, S.setScalar(0.001)));
          continue;
        }
        const a = (loopPhase + i / N_LOOP) * Math.PI * 2;
        const rx = 0.28, ry = Math.min(0.28, h5090Fit * 0.34);
        const cy = BASE_Y + h5090Fit * 0.52;
        P.set(X_5090 + Math.cos(a) * rx, cy + Math.sin(a) * ry, BLOCK_D / 2 + 0.08);
        loopPackets.setMatrixAt(i, M.compose(P, Q, S.setScalar(loopActive ? 1 : 0.65)));
      }
      loopPackets.instanceMatrix.needsUpdate = true;

      // Pipe packet traffic
      if (playing) {
        if (fit5090Ok) pipePhase5090 = (pipePhase5090 + dt * 1.25) % 1;
        pipePhaseSpark = (pipePhaseSpark + dt * 0.48) % 1;
      }
      for (let i = 0; i < N_PIPE; i++) {
        if (!fit5090Ok) {
          pipeCubes.setMatrixAt(i, M.compose(P.set(0, -20, 0), Q, S.setScalar(0.001)));
        } else {
          const u = (pipePhase5090 + i / N_PIPE) % 1;
          const px = X_5090 - PIPE_LEN / 2 + 0.14 + u * (PIPE_LEN - 0.28);
          pipeCubes.setMatrixAt(i, M.compose(P.set(px, PIPE_Y, TH_5090 / 2 + 0.07), Q, S.set(0.14, 0.24, 0.12)));
        }
        const v = (pipePhaseSpark + i / N_PIPE) % 1;
        const sx = X_SPARK - PIPE_LEN / 2 + 0.14 + v * (PIPE_LEN - 0.28);
        pipeCubes.setMatrixAt(N_PIPE + i, M.compose(P.set(sx, PIPE_Y, TH_SPARK / 2 + 0.06), Q, S.set(0.10, 0.12, 0.10)));
      }
      pipeCubes.instanceMatrix.needsUpdate = true;

      out({
        playing,
        budget,
        egpu,
        beat,
        readout: makeReadout(budget, egpu),
      });
    },
    action(name, arg) {
      if (name === 'play') {
        playing = !playing;
      } else if (name === 'step') {
        playing = false;
        const nextBeat = (beat + 1) % BEAT_T.length;
        cycleT = BEAT_T[nextBeat];
      } else if (name === 'budget') {
        const v = Number(arg);
        if (v === 20 || v === 30 || v === 40 || v === 90) {
          budget = v;
        }
      } else if (name === 'egpu') {
        egpu = Boolean(arg);
        if (egpu) cycleT = 0.02;
      }
    },
    dispose() {
      hatchTex.dispose();
    },
  };
}
