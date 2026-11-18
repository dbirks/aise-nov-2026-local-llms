// Scene `kv-fill` — deck v2 kv-cache B:
// A VRAM slab split into a fixed dark 'weights' block on the left and a resizable 'free' area
// on the right (4 toy layer rows). As tokens arrive in front, each token appends a K/V plate
// pair into each layer row. When the context limit is reached, the next token produces a
// hatched 'context full' block.
import { THREE, lam, ghost, M, Q, P, S, ease, emitter } from './_kit.js';

const LAYERS = 4;
const MAX_CTX = 16;
const DX = 0.28;
const FREE_X0 = -1.55;
const ROW_Z = [-0.96, -0.38, 0.20, 0.78];
const TOK_Z = 1.58;

const slotX = t => FREE_X0 + (t + 0.5) * DX;

function mkLabel(scene, text, x, y, z, height = 0.34) {
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthWrite: false, depthTest: false }));
  sp.renderOrder = 15;
  const draw = t => {
    const font = 'bold 72px ui-monospace, "DejaVu Sans Mono", monospace';
    const probe = document.createElement('canvas').getContext('2d');
    probe.font = font;
    const w = Math.ceil(probe.measureText(t).width) + 24;
    const cv = document.createElement('canvas');
    cv.width = w; cv.height = 94;
    const g = cv.getContext('2d');
    g.font = font; g.fillStyle = '#111111'; g.textBaseline = 'middle';
    g.fillText(t, 12, 48);
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    const old = sp.material.map;
    sp.material.map = tex; sp.material.needsUpdate = true;
    if (old) old.dispose();
    height = Math.max(height, 0.42);
    sp.scale.set((height * w) / 94, height, 1);
  };
  draw(text);
  sp.position.set(x, y, z);
  scene.add(sp);
  sp.setText = t => draw(t);
  return sp;
}

function mkHatchTexture() {
  const cv = document.createElement('canvas');
  cv.width = 64; cv.height = 64;
  const g = cv.getContext('2d');
  g.fillStyle = '#dcdcdc';
  g.fillRect(0, 0, 64, 64);
  g.strokeStyle = '#141414';
  g.lineWidth = 10;
  for (let i = -64; i <= 128; i += 22) {
    g.beginPath();
    g.moveTo(i, 64);
    g.lineTo(i + 64, 0);
    g.stroke();
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 2);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export default function build(scene, emit) {
  const out = emitter(emit);

  // ── VRAM base slab + fixed dark weights block ──
  const weightsMesh = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.68, 2.24), lam(0x202020));
  weightsMesh.position.set(-2.5, 0.34, -0.09);
  const weightsEdge = new THREE.LineSegments(
    new THREE.EdgesGeometry(weightsMesh.geometry),
    new THREE.LineBasicMaterial({ color: 0x0a0a0a }),
  );
  weightsEdge.position.copy(weightsMesh.position);
  scene.add(weightsMesh, weightsEdge);

  // subtle weight ribs on top so it reads as packed solid weights
  for (let r = 0; r < 3; r++) {
    const rib = new THREE.Mesh(new THREE.BoxGeometry(1.36, 0.04, 0.06), lam(0x3a3a3a));
    rib.position.set(-2.5, 0.70, -0.75 + r * 0.66);
    scene.add(rib);
  }

  // ── resizable free-VRAM tray + 4 layer rails + end capacity wall ──
  const freeGroup = new THREE.Group();
  scene.add(freeGroup);

  const trayFloor = new THREE.Mesh(new THREE.BoxGeometry(1, 0.05, 2.24), lam(0xe4e4e4));
  const trayEdge = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 0.08, 2.24)),
    new THREE.LineBasicMaterial({ color: 0x555555 }),
  );
  const capWall = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.62, 2.24), lam(0x181818));
  freeGroup.add(trayFloor, trayEdge, capWall);

  const rails = [];
  for (let l = 0; l < LAYERS; l++) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(1, 0.03, 0.44), lam(0xc8c8c8));
    rail.position.set(0, 0.04, ROW_Z[l]);
    const rEdge = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 0.03, 0.44)),
      new THREE.LineBasicMaterial({ color: 0x7a7a7a }),
    );
    rEdge.position.copy(rail.position);
    freeGroup.add(rail, rEdge);
    rails.push([rail, rEdge]);
  }

  // ── KV block pairs (K plate + V plate per token per layer) ──
  const totalKV = LAYERS * MAX_CTX;
  const kPlates = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), lam(0x161616), totalKV);
  const vPlates = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), lam(0x5a5a5a), totalKV);
  kPlates.frustumCulled = false;
  vPlates.frustumCulled = false;
  scene.add(kPlates, vPlates);

  // ── token tiles in front ──
  const tokTiles = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), lam(0x9a9a9a), MAX_CTX);
  tokTiles.frustumCulled = false;
  scene.add(tokTiles);

  // front token shelf line
  const tokRail = new THREE.Mesh(new THREE.BoxGeometry(1, 0.025, 0.44), ghost(0x666666, 0.35));
  freeGroup.add(tokRail);

  // ── hatched 'context full' block (overflow token + VRAM rejection block) ──
  const fullGroup = new THREE.Group();
  const hatchMat = new THREE.MeshBasicMaterial({ map: mkHatchTexture() });
  const fullSlab = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.56, 2.12), hatchMat);
  fullSlab.position.set(0, 0.31, -0.09);
  fullSlab.add(new THREE.LineSegments(
    new THREE.EdgesGeometry(fullSlab.geometry),
    new THREE.LineBasicMaterial({ color: 0x111111 }),
  ));
  const fullTok = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.16, 0.36), hatchMat);
  fullTok.position.set(0, 0.09, TOK_Z);
  fullTok.add(new THREE.LineSegments(
    new THREE.EdgesGeometry(fullTok.geometry),
    new THREE.LineBasicMaterial({ color: 0x111111 }),
  ));
  fullGroup.add(fullSlab, fullTok);
  fullGroup.visible = false;
  scene.add(fullGroup);

  // ── leader ticks from K and V labels on token 0, back row (l = 0) ──
  const kLine = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(slotX(0) - 0.052, 0.50, ROW_Z[0]),
      new THREE.Vector3(slotX(0) - 0.18, 1.06, -1.06),
    ]),
    new THREE.LineBasicMaterial({ color: 0x111111 }),
  );
  const vLine = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(slotX(0) + 0.052, 0.50, ROW_Z[0]),
      new THREE.Vector3(slotX(0) + 0.24, 1.06, -1.06),
    ]),
    new THREE.LineBasicMaterial({ color: 0x111111 }),
  );
  scene.add(kLine, vLine);

  // ── labels ──
  mkLabel(scene, 'weights', -2.5, 1.55, -0.60, 0.36);
  const lFree = mkLabel(scene, 'free VRAM', 2.05, 1.32, -0.55, 0.34);
  mkLabel(scene, '4 toy layers', 0.45, 1.05, -1.55, 0.32);
  mkLabel(scene, 'tokens', -2.35, 0.12, TOK_Z, 0.34);
  const lK = mkLabel(scene, 'K', slotX(0) - 0.22, 1.22, -1.08, 0.32);
  const lV = mkLabel(scene, 'V', slotX(0) + 0.28, 1.22, -1.08, 0.32);
  const lFull = mkLabel(scene, 'context full', 3.25, 1.35, -0.45, 0.34);
  lFull.visible = false;

  // Formula label required when kv-serving.md includes it (formula only, no model-specific number)
  mkLabel(scene, '2 × layers × kv heads × head dim × bytes per token', 0.35, -0.82, 2.05, 0.27);

  // ── state ──
  let ctx = 16;
  let tokens = 5;
  let full = false;
  let playing = true;
  let clock = 0;
  const vis = new Float32Array(MAX_CTX);
  for (let t = 0; t < tokens; t++) vis[t] = 1;

  function layoutCapacity() {
    const span = ctx * DX + 0.08;
    const midX = FREE_X0 + span / 2;
    trayFloor.scale.x = span;
    trayFloor.position.set(midX, 0, -0.09);
    trayEdge.scale.x = span;
    trayEdge.position.set(midX, 0.02, -0.09);
    capWall.position.set(FREE_X0 + ctx * DX + 0.06, 0.31, -0.09);
    for (const [rail, rEdge] of rails) {
      rail.scale.x = span - 0.06;
      rail.position.x = midX;
      rEdge.scale.x = span - 0.06;
      rEdge.position.x = midX;
    }
    tokRail.scale.x = span;
    tokRail.position.set(midX, 0.0, TOK_Z);

    const endX = FREE_X0 + ctx * DX + 0.34;
    fullGroup.position.x = endX;
    lFull.position.set(endX - 0.65, 1.55, -0.45);
    lFree.position.set(FREE_X0 + span * 0.78, 1.32, -0.55);
  }
  layoutCapacity();

  function advanceBeat() {
    if (full) {
      tokens = 1;
      full = false;
      vis.fill(0);
      vis[0] = 1;
    } else if (tokens < ctx) {
      tokens++;
    } else {
      full = true;
    }
  }

  return {
    view: { target: [0.15, 0.15, 0.1], radius: 40, theta: 0.32, phi: 0.96, size: 3.15 },
    update(dt) {
      if (playing) {
        clock += dt;
        const wait = full ? 1.8 : 0.55;
        if (clock >= wait) {
          clock = 0;
          advanceBeat();
        }
      }

      const k = ease(dt, 10);
      let idx = 0;
      for (let t = 0; t < MAX_CTX; t++) {
        const active = t < tokens && t < ctx ? 1 : 0;
        vis[t] += (active - vis[t]) * k;
        const s = Math.max(0.001, vis[t]);
        const sx = slotX(t);

        // token tile in front
        P.set(sx, 0.11 * s, TOK_Z);
        S.set(0.20 * s, 0.15 * s, 0.34 * s);
        tokTiles.setMatrixAt(t, M.compose(P, Q, S));

        for (let l = 0; l < LAYERS; l++, idx++) {
          const z = ROW_Z[l];
          const h = 0.44 * s;
          P.set(sx - 0.052, 0.055 + h / 2, z);
          S.set(0.078 * s, Math.max(0.001, h), 0.38 * s);
          kPlates.setMatrixAt(idx, M.compose(P, Q, S));

          P.set(sx + 0.052, 0.055 + h / 2, z);
          S.set(0.078 * s, Math.max(0.001, h), 0.38 * s);
          vPlates.setMatrixAt(idx, M.compose(P, Q, S));
        }
      }
      kPlates.instanceMatrix.needsUpdate = true;
      vPlates.instanceMatrix.needsUpdate = true;
      tokTiles.instanceMatrix.needsUpdate = true;

      const showKV = tokens >= 1;
      lK.visible = showKV;
      lV.visible = showKV;
      kLine.visible = showKV;
      vLine.visible = showKV;

      fullGroup.visible = full;
      lFull.visible = full;
      lFree.visible = !full && tokens < ctx - 2;

      const blocks = tokens * LAYERS;
      const readout = full
        ? `simulated · ${ctx}/${ctx} tokens · ${ctx * LAYERS} kv blocks · context full`
        : `simulated · ${tokens} tokens · ${blocks} kv blocks (4 layers) · weights unchanged`;
      out({ playing, readout });
    },
    action(name, arg) {
      if (name === 'play') playing = typeof arg === 'boolean' ? arg : !playing;
      else if (name === 'step') {
        playing = false;
        clock = 0;
        advanceBeat();
      } else if (name === 'back') {
        playing = false; clock = 0;
        if (full) full = false;
        else if (tokens > 1) tokens--;
        else { tokens = ctx; full = true; }
      } else if (name === 'ctx' && (Number(arg) === 8 || Number(arg) === 16)) {
        const next = Number(arg);
        if (next !== ctx) {
          ctx = next;
          if (tokens >= ctx) {
            tokens = ctx;
            full = true;
          } else {
            full = false;
          }
          clock = 0;
          layoutCapacity();
        }
      }
    },
  };
}
