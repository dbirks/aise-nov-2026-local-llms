// Scene `moe-store` — Route B03: "35B stored, ~3B used per token"
// Claim: total parameters and active parameters are different; storage does not shrink with routing.
// Toy model: 4 layers vertically, each = 1 router block (left) + 1 shared always-active block + 8 expert slabs.
// Top-k = 2 per token per layer (deterministic seeded routing).
// Modes:
//   'moe'   — token batch climbs the 4 layers; router lights, shared block lights, and the union of
//             top-2 experts touched by any token in the batch goes dark. Untouched experts remain solid
//             mid-grey (still stored in memory, not vanished).
//   'dense' — each layer is one long continuous FFN slab that lights fully for every token.
// Gauges (left of stack):
//   1. stored        — constant full height ("35B total", referencing Qwen3.6-35B-A3B model card)
//   2. used per tok  — short in MoE ("~3B active"), full in Dense ("all active")
//   3. touched       — computed fraction of the 32 toy experts touched by the batch this step
import { THREE, lam, ghost, M, Q, P, S, ease, emitter, rng } from './_kit.js';

const LAYERS = 4;
const NEX = 8;
const TOPK = 2;
const TOTAL_EXPERTS = LAYERS * NEX; // 32 toy experts
const MAX_BATCH = 16;
const PASSES = 3;
const PASS_T = 3.6;
const LOOP_T = PASSES * PASS_T; // 10.8 s loop

// Stack geometry (compact, centered around target [0.15, 0.15, 0] in right-half canvas)
const Y0 = -1.15;
const DY = 0.85;
const BLK_Y = 0.16;
const BLK_H = 0.30;
const BLK_D = 0.46;

const RTX = -0.34;
const SHX = 0.28;
const EX0 = 0.78;
const EX_SPAN = 2.74;
const EX_GAP = 0.075;
const EX_W = (EX_SPAN - (NEX - 1) * EX_GAP) / NEX;

const DENSE_X0 = -0.34;
const DENSE_X1 = EX0 + EX_SPAN;
const DENSE_W = DENSE_X1 - DENSE_X0;
const DENSE_CX = (DENSE_X0 + DENSE_X1) / 2;

// Left gauges
const GX = [-3.42, -2.28, -1.14];
const GW = 0.36;
const GD = 0.28;
const GY0 = -1.25;
const GH = 2.60;
const GY1 = GY0 + GH;

// Token track in front of the stack
const TOK_CX = (SHX + DENSE_X1) / 2;
const TOK_Z = 0.72;

const yOf = l => Y0 + l * DY;
const exX = e => EX0 + EX_W / 2 + e * (EX_W + EX_GAP);

function makeLabelTexture(text, fpx = 68) {
  const lines = String(text).split('\n');
  const font = `bold ${fpx}px ui-monospace, monospace`;
  const cv = document.createElement('canvas');
  const g0 = cv.getContext('2d');
  g0.font = font;
  const maxW = Math.max(...lines.map(ln => Math.ceil(g0.measureText(ln).width)), 20);
  const lineH = Math.round(fpx * 1.12);
  cv.width = maxW + 24;
  cv.height = lineH * lines.length + 18;
  const g = cv.getContext('2d');
  g.font = font;
  g.fillStyle = '#141414';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  lines.forEach((ln, idx) => {
    const cy = 9 + lineH * (idx + 0.5);
    g.fillText(ln, cv.width / 2, cy);
  });
  return { cv, lines: lines.length };
}

export default function build(scene, emit) {
  const out = emitter(emit);
  const tmp = new THREE.Color();

  // Palette luminance choices: dark = active/important, mid-grey = solid stored/idle
  const cIdle = new THREE.Color(0x7c7c7c);
  const cAct = new THREE.Color(0x111111);
  const cRouterIdle = new THREE.Color(0x646464);

  function createLabel(text, h, fpx = 68) {
    const { cv, lines } = makeLabelTexture(text, fpx);
    const tex = new THREE.CanvasTexture(cv);
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, depthTest: false });
    const sp = new THREE.Sprite(mat);
    sp.userData = { aspect: cv.width / cv.height, lines, text, fpx };
    sp.renderOrder = 10;
    sp.scale.set(0.001, 0.001, 1);
    scene.add(sp);
    return sp;
  }

  function updateLabel(sp, text) {
    if (sp.userData.text === text) return;
    const { cv, lines } = makeLabelTexture(text, sp.userData.fpx);
    const tex = new THREE.CanvasTexture(cv);
    sp.material.map.dispose();
    sp.material.map = tex;
    sp.material.needsUpdate = true;
    sp.userData.aspect = cv.width / cv.height;
    sp.userData.lines = lines;
    sp.userData.text = text;
  }

  function setLabel(sp, lineHeight, x, y, z, vis = 1) {
    const s = Math.max(vis, 0.001);
    const totalH = lineHeight * sp.userData.lines;
    sp.scale.set(totalH * sp.userData.aspect * s, totalH * s, 1);
    sp.position.set(x, y, z);
    sp.visible = vis > 0.02;
  }

  // ── Layer shelves (background support plates) ──────────────────────────────────────
  for (let l = 0; l < LAYERS; l++) {
    const shelf = new THREE.Mesh(
      new THREE.BoxGeometry(DENSE_W + 0.34, 0.05, BLK_D + 0.24),
      ghost(0x989898, 0.38),
    );
    shelf.position.set(DENSE_CX, yOf(l), 0);
    scene.add(shelf);
  }

  // ── MoE components: routers, shared blocks, 32 expert slabs + solid outlines ───────
  const routers = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), lam(0xffffff), LAYERS);
  const routerFrames = [];
  for (let l = 0; l < LAYERS; l++) {
    const rf = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(0.28, 0.28, 0.28)),
      new THREE.LineBasicMaterial({ color: 0x222222 }),
    );
    rf.position.set(RTX, yOf(l) + BLK_Y, 0);
    scene.add(rf);
    routerFrames.push(rf);
  }

  const shared = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), lam(0xffffff), LAYERS);
  const sharedCollars = [];
  for (let l = 0; l < LAYERS; l++) {
    const sc = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(0.36, BLK_H + 0.06, BLK_D + 0.04)),
      new THREE.LineBasicMaterial({ color: 0x1a1a1a }),
    );
    sc.position.set(SHX, yOf(l) + BLK_Y, 0);
    scene.add(sc);
    sharedCollars.push(sc);
  }

  const experts = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), lam(0xffffff), TOTAL_EXPERTS);
  const expertFrames = [];
  for (let l = 0; l < LAYERS; l++) {
    for (let e = 0; e < NEX; e++) {
      const ef = new THREE.LineSegments(
        new THREE.EdgesGeometry(new THREE.BoxGeometry(EX_W, BLK_H, BLK_D)),
        new THREE.LineBasicMaterial({ color: 0x3a3a3a }),
      );
      ef.position.set(exX(e), yOf(l) + BLK_Y, 0);
      scene.add(ef);
      expertFrames.push(ef);
    }
  }

  // Routing needles: per layer, 1 to shared + up to NEX to routed experts
  const MAX_NEEDLES = LAYERS * (NEX + 1);
  const needles = new THREE.InstancedMesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshBasicMaterial({ color: 0x161616 }),
    MAX_NEEDLES,
  );

  // Dense FFN bars (one continuous slab per layer in 'dense' mode)
  const denseBars = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), lam(0xffffff), LAYERS);

  routers.frustumCulled = shared.frustumCulled = experts.frustumCulled = false;
  needles.frustumCulled = denseBars.frustumCulled = false;
  scene.add(routers, shared, experts, needles, denseBars);

  // ── Token cubes in flight + crisp outlines ─────────────────────────────────────────
  const tokRail = new THREE.Mesh(
    new THREE.BoxGeometry(0.05, DY * 3.4, 0.05),
    ghost(0x888888, 0.45),
  );
  tokRail.position.set(TOK_CX, Y0 + DY * 1.4, TOK_Z);
  scene.add(tokRail);

  const tokCubes = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), lam(0x101010), MAX_BATCH);
  tokCubes.frustumCulled = false;
  scene.add(tokCubes);

  // ── Left gauges: stored (35B total), used per token (~3B active), touched this step ──
  const gFills = [];
  const gCaps = [];
  for (let j = 0; j < 3; j++) {
    const frame = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(GW, GH, GD)),
      new THREE.LineBasicMaterial({ color: 0x383838 }),
    );
    frame.position.set(GX[j], GY0 + GH / 2, 0);
    const barW = j === 1 ? GW * 0.62 : GW * 0.84;
    const fill = new THREE.Mesh(
      new THREE.BoxGeometry(barW, 1, GD * 0.82),
      lam(j === 0 ? 0x262626 : 0x141414),
    );
    const cap = new THREE.Mesh(
      new THREE.BoxGeometry(GW + 0.06, 0.04, GD + 0.04),
      lam(0x111111),
    );
    scene.add(frame, fill, cap);
    gFills.push(fill);
    gCaps.push(cap);
  }

  // ── Sprites ────────────────────────────────────────────────────────────────────────
  const labStoredTop = createLabel('35B\ntotal', 0.34);
  const labStoredBot = createLabel('stored', 0.32);
  const labUsedTop = createLabel('~3B\nactive', 0.34);
  const labUsedBot = createLabel('used\nper tok', 0.32);
  const labTouchTop = createLabel('8 / 32', 0.34);
  const labTouchBot = createLabel('touched\nstep', 0.32);

  const labRouter = createLabel('router', 0.34);
  const labToy = createLabel('toy: 4 layers × 8 experts', 0.32);
  const labShared = createLabel('shared', 0.32);
  const labDense = createLabel('dense FFN (all used)', 0.34);
  const labBatch = createLabel('1 token', 0.32);

  // ── Deterministic seeded per-token routing (top-2 of 8 experts per layer) ──────────
  const rand = rng(42);
  function pickTopK() {
    const arr = [0, 1, 2, 3, 4, 5, 6, 7];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr.slice(0, TOPK).sort((a, b) => a - b);
  }
  const routes = Array.from({ length: PASSES }, () =>
    Array.from({ length: MAX_BATCH }, () =>
      Array.from({ length: LAYERS }, () => pickTopK()),
    ),
  );

  function computeUnion(passIdx, bCount) {
    const perLayer = Array.from({ length: LAYERS }, () => new Set());
    for (let b = 0; b < bCount; b++) {
      for (let l = 0; l < LAYERS; l++) {
        for (const e of routes[passIdx][b][l]) perLayer[l].add(e);
      }
    }
    let total = 0;
    for (let l = 0; l < LAYERS; l++) total += perLayer[l].size;
    return { perLayer, total };
  }

  // ── State & smooth animation accumulators ──────────────────────────────────────────
  let mode = 'moe';
  let batch = 1;
  let playing = true;
  // Start inside the first pass hold so frame 0 / screenshots immediately show full 4-layer routing
  let t = PASS_T * 0.54;

  let moeAmt = 1;
  const exAct = new Float32Array(TOTAL_EXPERTS);
  const shAct = new Float32Array(LAYERS);
  const rtAct = new Float32Array(LAYERS);
  const dnAct = new Float32Array(LAYERS);
  const gVal = [1.0, 3 / 35, 8 / 32];

  // Step beat positions within each PASS_T
  const BEATS = [0.16, 0.28, 0.40, 0.56];

  return {
    view: { target: [0.15, 0.15, 0], radius: 40, theta: 0.38, phi: 1.15, size: 3.45 },

    update(dt) {
      if (playing) t = Math.max(0, t + dt) % LOOP_T;
      const passIdx = Math.min(PASSES - 1, Math.floor(t / PASS_T));
      const f = (t - passIdx * PASS_T) / PASS_T;

      const isMoe = mode === 'moe';
      moeAmt += ((isMoe ? 1 : 0) - moeAmt) * ease(dt, 7);
      const denseAmt = 1 - moeAmt;

      // Token climbs from below Layer 0 to above Layer 3 during f ∈ [0.04, 0.52], holds [0.52, 0.90]
      const climb = Math.max(0, Math.min(1, (f - 0.04) / 0.48));
      const fade = 1 - Math.max(0, (f - 0.91) / 0.09);
      const layerOn = l => {
        const start = 0.05 + l * 0.11;
        return Math.max(0, Math.min(1, (f - start) / 0.06)) * fade;
      };

      const { perLayer, total: touchedTotal } = computeUnion(passIdx, batch);

      // ── MoE routers, shared blocks, 32 experts ──────────────────────────────────────
      let ns = 0;
      for (let l = 0; l < LAYERS; l++) {
        const w = layerOn(l);
        const rWant = isMoe ? w : 0;
        rtAct[l] += (rWant - rtAct[l]) * ease(dt, rWant > rtAct[l] ? 12 : 8);
        const ra = rtAct[l];
        const rScale = Math.max(0.001, moeAmt * (0.85 + 0.18 * ra));
        routers.setMatrixAt(l, M.compose(P.set(RTX, yOf(l) + BLK_Y, 0), Q, S.set(0.27 * rScale, 0.27 * rScale, 0.27 * rScale)));
        routers.setColorAt(l, tmp.copy(cRouterIdle).lerp(cAct, ra));
        routerFrames[l].visible = moeAmt > 0.08;
        routerFrames[l].scale.setScalar(rScale);

        const sWant = isMoe ? w : 0;
        shAct[l] += (sWant - shAct[l]) * ease(dt, sWant > shAct[l] ? 12 : 8);
        const sa = shAct[l];
        const sVis = Math.max(0.001, moeAmt);
        shared.setMatrixAt(
          l,
          M.compose(
            P.set(SHX, yOf(l) + BLK_Y + sa * 0.04, 0),
            Q,
            S.set(0.34 * sVis, BLK_H * (0.96 + 0.14 * sa) * sVis, BLK_D * (0.98 + 0.08 * sa) * sVis),
          ),
        );
        shared.setColorAt(l, tmp.copy(cIdle).lerp(cAct, sa));
        sharedCollars[l].visible = moeAmt > 0.08;
        sharedCollars[l].scale.setScalar(sVis);

        // Routing needle from router to shared (always active in MoE)
        if (isMoe && w > 0.05 && moeAmt > 0.2) {
          const x0 = RTX + 0.14;
          const x1 = SHX - 0.17;
          const ln = Math.max(0.02, (x1 - x0) * Math.min(1, w * 2.2));
          needles.setMatrixAt(ns++, M.compose(P.set(x0 + ln / 2, yOf(l) + BLK_Y, BLK_D / 2 + 0.04), Q, S.set(ln, 0.04, 0.04)));
        }

        // 8 expert slabs
        const touchedSet = perLayer[l];
        for (let e = 0; e < NEX; e++) {
          const idx = l * NEX + e;
          const want = isMoe && touchedSet.has(e) ? w : 0;
          exAct[idx] += (want - exAct[idx]) * ease(dt, want > exAct[idx] ? 12 : 8);
          const a = exAct[idx];
          experts.setMatrixAt(
            idx,
            M.compose(
              P.set(exX(e), yOf(l) + BLK_Y + a * 0.05, 0),
              Q,
              S.set(EX_W * sVis, BLK_H * (0.96 + 0.16 * a) * sVis, BLK_D * (0.98 + 0.1 * a) * sVis),
            ),
          );
          experts.setColorAt(idx, tmp.copy(cIdle).lerp(cAct, a));
          expertFrames[idx].visible = moeAmt > 0.08;
          expertFrames[idx].scale.setScalar(sVis);
          expertFrames[idx].position.y = yOf(l) + BLK_Y + a * 0.05;

          if (isMoe && touchedSet.has(e) && w > 0.05 && moeAmt > 0.2) {
            const x0 = RTX + 0.14;
            const x1 = exX(e) - EX_W / 2 - 0.01;
            const ln = Math.max(0.02, (x1 - x0) * Math.min(1, w * 2.0));
            needles.setMatrixAt(
              ns++,
              M.compose(P.set(x0 + ln / 2, yOf(l) + BLK_Y + 0.05, BLK_D / 2 + 0.04), Q, S.set(ln, 0.036, 0.036)),
            );
          }
        }

        // Dense long FFN bar
        const dWant = !isMoe ? w : 0;
        dnAct[l] += (dWant - dnAct[l]) * ease(dt, dWant > dnAct[l] ? 12 : 8);
        const da = dnAct[l];
        const dVis = Math.max(0.001, denseAmt);
        denseBars.setMatrixAt(
          l,
          M.compose(
            P.set(DENSE_CX, yOf(l) + BLK_Y + da * 0.04, 0),
            Q,
            S.set(DENSE_W * dVis, BLK_H * (0.98 + 0.14 * da) * dVis, BLK_D * (0.98 + 0.1 * da) * dVis),
          ),
        );
        denseBars.setColorAt(l, tmp.copy(cIdle).lerp(cAct, da));
      }

      for (; ns < MAX_NEEDLES; ns++) {
        needles.setMatrixAt(ns, M.compose(P.set(0, -20, 0), Q, S.setScalar(0.001)));
      }
      routers.instanceMatrix.needsUpdate = true;
      if (routers.instanceColor) routers.instanceColor.needsUpdate = true;
      shared.instanceMatrix.needsUpdate = true;
      if (shared.instanceColor) shared.instanceColor.needsUpdate = true;
      experts.instanceMatrix.needsUpdate = true;
      if (experts.instanceColor) experts.instanceColor.needsUpdate = true;
      needles.instanceMatrix.needsUpdate = true;
      denseBars.instanceMatrix.needsUpdate = true;
      if (denseBars.instanceColor) denseBars.instanceColor.needsUpdate = true;

      // ── Token cubes in flight (1 / 4 / 16) ──────────────────────────────────────────
      const tokY = Y0 - 0.30 + climb * (DY * 3 + 0.56);
      const cols = batch === 1 ? 1 : batch === 4 ? 4 : 8;
      const rows = batch === 16 ? 2 : 1;
      const cubeSz = batch === 1 ? 0.24 : batch === 4 ? 0.17 : 0.12;
      const pitchX = batch === 1 ? 0 : batch === 4 ? 0.25 : 0.17;
      const pitchY = 0.17;

      for (let b = 0; b < MAX_BATCH; b++) {
        if (b < batch) {
          const col = b % cols;
          const row = Math.floor(b / cols);
          const x = TOK_CX + (col - (cols - 1) / 2) * pitchX;
          const y = tokY + (row - (rows - 1) / 2) * pitchY;
          const s = cubeSz * (0.55 + 0.45 * fade);
          tokCubes.setMatrixAt(b, M.compose(P.set(x, y, TOK_Z), Q, S.set(s, s, s)));
        } else {
          tokCubes.setMatrixAt(b, M.compose(P.set(0, -20, 0), Q, S.setScalar(0.001)));
        }
      }
      tokCubes.instanceMatrix.needsUpdate = true;

      // ── Left gauges ─────────────────────────────────────────────────────────────────
      const targetG = [
        1.0,
        isMoe ? 3 / 35 : 1.0,
        isMoe ? touchedTotal / TOTAL_EXPERTS : 1.0,
      ];
      for (let j = 0; j < 3; j++) {
        gVal[j] += (targetG[j] - gVal[j]) * ease(dt, 7);
        const h = Math.max(0.03, gVal[j] * GH);
        gFills[j].scale.set(1, h, 1);
        gFills[j].position.set(GX[j], GY0 + h / 2, 0);
        gCaps[j].position.set(GX[j], GY0 + h, 0);
      }

      // ── Sprites ─────────────────────────────────────────────────────────────────────
      updateLabel(labUsedTop, isMoe ? '~3B\nactive' : 'all\nactive');
      updateLabel(labTouchTop, isMoe ? `${touchedTotal} / 32` : 'all FFN');
      updateLabel(labBatch, batch === 1 ? '1 token' : `${batch} tokens`);

      setLabel(labStoredTop, 0.30, GX[0], GY1 + 0.46, 0.1);
      setLabel(labStoredBot, 0.30, GX[0], GY0 - 0.32, 0.1);
      setLabel(labUsedTop, 0.30, GX[1], GY1 + 0.46, 0.1);
      setLabel(labUsedBot, 0.28, GX[1], GY0 - 0.40, 0.1);
      setLabel(labTouchTop, 0.32, GX[2], GY1 + 0.34, 0.1);
      setLabel(labTouchBot, 0.28, GX[2], GY0 - 0.40, 0.1);

      setLabel(labRouter, 0.30, RTX - 0.06, yOf(3) + 0.90, 0.1, moeAmt);
      setLabel(labToy, 0.30, EX0 + EX_SPAN / 2 + 0.22, yOf(3) + 0.90, 0.1, moeAmt);
      setLabel(labShared, 0.30, SHX, Y0 - 0.34, 0.1, moeAmt);
      setLabel(labDense, 0.30, DENSE_CX + 0.15, yOf(3) + 0.90, 0.1, denseAmt);
      setLabel(labBatch, 0.30, TOK_CX, Y0 - 0.64, TOK_Z);

      const readout = isMoe
        ? `batch ${batch} · experts touched ${touchedTotal} of ${TOTAL_EXPERTS} · stored unchanged`
        : `dense · batch ${batch} · all ffn weights active per token · 35B stored`;
      out({ playing, mode, batch, touched: touchedTotal, readout });
    },

    action(name, arg) {
      if (name === 'play') {
        playing = !playing;
      } else if (name === 'step') {
        playing = false;
        const passIdx = Math.floor(t / PASS_T);
        const f = (t - passIdx * PASS_T) / PASS_T;
        const nextBeat = BEATS.find(b => b > f + 0.02);
        if (nextBeat !== undefined) {
          t = passIdx * PASS_T + nextBeat * PASS_T;
        } else {
          const nextPass = (passIdx + 1) % PASSES;
          t = nextPass * PASS_T + BEATS[0] * PASS_T;
        }
      } else if (name === 'mode') {
        mode = arg === 'dense' ? 'dense' : 'moe';
        t = PASS_T * 0.54;
      } else if (name === 'batch') {
        const v = Number(arg);
        batch = v === 4 || v === 16 ? v : 1;
        t = PASS_T * 0.54;
      }
    },
  };
}
