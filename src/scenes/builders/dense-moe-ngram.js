// Scene `dense-moe-ngram` — three ways to add parameters (scene-lab brainstorm).
// Brief: README "Dense vs MoE vs n-gram embedding tables: different scaling axes".
//
// One FIXED token stream (bottom rail, 6 tiles, a dark cursor walks it) drives three mechanisms
// drawn in the same footprint, plus three gauges at the right: stored params / active compute /
// bytes fetched (relative bars, dense tick marked with a dark line).
//   dense — every layer's FFN is one solid bar; the whole bar darkens for every token, in all four
//           layers. Stored weights and per-token computation rise together.
//   moe   — that same per-layer FFN budget splits into 8 separate expert blocks (the gap opens).
//           A router cube per layer sends needles to top-k of them; the other experts stay present
//           but light — still stored weights, just not this token's math.
//   ngram — two hash heads read the *token pair* bracketed on the rail (previous + current token
//           ID) and address a few rows of a huge flat weight table (8×16 = 128 toy rows, 4 lit).
//           Rows rise dark; a fused vector is injected into one layer, whose stack keeps running
//           dimmed at the left.
// Do not imply (README): n-gram embeddings are NOT a third kind of MoE, NOT a KV cache, NOT a
// speculative n-gram matcher, NOT a routed MLP expert — they are a learned weight table addressed
// by hashed local token IDs. Dense/MoE/n-gram are mechanisms a real model combines (the
// Qwen3.8-Flash-Next card lists ~51B n-gram embedding parameters alongside its MoE layers), so the
// mode switch compares mechanisms, not whole models. Layer count, 8 experts, top-k, the table size,
// which layer is injected and ALL bar heights are illustrative: no parameter counts, bytes, GiB,
// latency, throughput or speedups are shown. Bar height uses a √ scale so the dense 1× baseline
// stays legible next to a ~5× table; the dark tick on each bar is that 1× level.
import { THREE, lam, ghost, M, Q, P, S, ease, emitter, rng } from './_kit.js';

// ── host stack: 4 layers × 8 FFN slots ─────────────────────────────────────────────
const LAYERS = 4, NSLOT = 8;
const X0 = -2.2, SPAN = 2.7, Y0 = -1.28, DY = 0.78;
const BLK_D = 0.42, BLK_H = 0.24, BLK_Y = 0.16;      // block depth, height, offset above shelf
const G_DENSE = 0.014, G_MOE = 0.082;                // slot gap: solid FFN bar vs separate experts
const RTX = X0 - 0.3;                               // router column

// ── fixed token stream ─────────────────────────────────────────────────────────────
const T = 6, RTW = 0.36, RTP = 0.44, RY = -1.86, TOKT = 1.8;   // 6 tokens × 1.8 s = 10.8 s loop

// ── n-gram table (toy size, clearly illustrative) ──────────────────────────────────
const TC = 8, TR = 16, TCELLS = TC * TR, NLIT = 4;   // 128 rows, 4 read per token
const TX0 = 0.72, TY0 = -1.3, TPX = 0.15, TPY = 0.185, TCW = 0.118;
const HEAD = [[0.96, -1.66], [1.5, -1.66]];          // hash heads under the table
const INJ_Y = Y0 + DY, INJ_X0 = 0.44, INJ_X1 = 0.72;  // table → layer 2 (the fused vector is injected)

// ── gauges ────────────────────────────────────────────────────────────────────────
const GX = [2.35, 3.1, 3.85], GW = 0.32, GY0 = -1.3, GY1 = 1.5, GH = GY1 - GY0, GMAX = 5.5;
const GV = { dense: [1, 1, 1], moe: [3, 0.3, 0.45], ngram: [5, 0.4, 0.6] };  // relative, illustrative

const yOf = l => Y0 + l * DY;
const cellW = g => (SPAN - (NSLOT - 1) * g) / NSLOT;
const cellX = (s, g) => X0 + cellW(g) / 2 + s * (cellW(g) + g);
const tokX = i => X0 + 0.22 + i * RTP;
const tcx = c => TX0 + (c % TC) * TPX;
const tcy = c => TY0 + Math.floor(c / TC) * TPY;
const barH = v => GH * Math.sqrt(Math.max(v, 0) / GMAX);

export default function build(scene, emit) {
  const out = emitter(emit);
  const tmp = new THREE.Color();
  const cIdle = new THREE.Color(0x9d9d9d);    // present, not used by this token
  const cAct = new THREE.Color(0x121212);     // doing this token's work
  const cWin = new THREE.Color(0x404040);     // inside the hashed window
  const cRow = new THREE.Color(0x131313);     // a table row this token reads
  const EUL = new THREE.Euler(), EQ = new THREE.Quaternion();

  /** short camera-facing label: dark text on transparent (background is the lightest tone) */
  const label = (text, h) => {
    const fpx = 60, f = `bold ${fpx}px ui-monospace, monospace`;
    const cv = document.createElement('canvas'), g0 = cv.getContext('2d');
    g0.font = f;
    cv.width = Math.ceil(g0.measureText(text).width) + 20; cv.height = fpx + 18;
    const g = cv.getContext('2d');
    g.font = f; g.fillStyle = '#151515'; g.textBaseline = 'middle';
    g.fillText(text, 10, cv.height / 2 + 1);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, depthWrite: false }));
    sp.userData.w = cv.width / cv.height;
    sp.renderOrder = 10;
    sp.scale.set(0.001, 0.001, 1);
    scene.add(sp);
    return sp;
  };
  const setLab = (sp, h, x, y, z, on = 1) => {
    const s = Math.max(on, 0.001);
    sp.scale.set(h * sp.userData.w * s, h * s, 1);
    sp.position.set(x, y, z);
  };

  // ── host stack: shelves + FFN cells ─────────────────────────────────────────────
  for (let l = 0; l < LAYERS; l++) {
    const shelf = new THREE.Mesh(new THREE.BoxGeometry(SPAN + 0.22, 0.05, BLK_D + 0.16), ghost(0x8f8f8f, 0.4));
    shelf.position.set(X0 + SPAN / 2, yOf(l), 0);
    scene.add(shelf);
  }
  const cells = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), lam(0xffffff), LAYERS * NSLOT);
  const routers = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), lam(0x141414), LAYERS);
  const needles = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), lam(0x161616), LAYERS * 4);
  cells.frustumCulled = routers.frustumCulled = needles.frustumCulled = false;
  scene.add(cells, routers, needles);
  const cur = new Float32Array(LAYERS * NSLOT);

  // ── n-gram table: backing plate + rows, hash heads, beams, injection guide ──────
  const tW = TC * TPX, tH = TR * TPY, tCx = TX0 + tW / 2 - TPX / 2, tCy = TY0 + tH / 2 - TPY / 2;
  const tPlate = new THREE.Mesh(new THREE.BoxGeometry(tW + 0.12, tH + 0.12, 0.05), ghost(0xb6b6b6, 0.5));
  tPlate.position.set(tCx, tCy, -0.06);
  const tEdge = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(tW + 0.12, tH + 0.12, 0.08)),
    new THREE.LineBasicMaterial({ color: 0x2c2c2c }));
  tEdge.position.copy(tPlate.position);
  const rowsMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), lam(0xffffff), TCELLS);
  const heads = new THREE.InstancedMesh(new THREE.BoxGeometry(0.22, 0.22, 0.22), lam(0x141414), 2);
  const beams = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), lam(0x171717), NLIT);
  rowsMesh.frustumCulled = heads.frustumCulled = beams.frustumCulled = false;
  scene.add(tPlate, tEdge, rowsMesh, heads, beams);
  const guide = new THREE.Mesh(new THREE.BoxGeometry(INJ_X1 - INJ_X0, 0.05, 0.1), ghost(0x4a4a4a, 0.55));
  guide.position.set((INJ_X0 + INJ_X1) / 2, INJ_Y, 0.18);
  const pulse = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.12), lam(0x121212));
  scene.add(guide, pulse);
  const tab = new Float32Array(TCELLS);

  // ── token rail: the same 6 tiles in every mode + a cursor over the hashed window ─
  const rail = new THREE.Mesh(new THREE.BoxGeometry(SPAN + 0.3, 0.04, 0.5), ghost(0x9a9a9a, 0.35));
  rail.position.set(X0 + SPAN / 2, RY - 0.14, 0);
  const tiles = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), lam(0xffffff), T);
  tiles.frustumCulled = false;
  const cursor = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1)),
    new THREE.LineBasicMaterial({ color: 0x111111 }));
  scene.add(rail, tiles, cursor);

  // ── gauges: outline + dark fill from the bottom, dark tick at the dense 1× level ─
  const gFill = [];
  for (let j = 0; j < 3; j++) {
    const e = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(GW, GH, 0.24)),
      new THREE.LineBasicMaterial({ color: 0x4c4c4c }));
    e.position.set(GX[j], GY0 + GH / 2, 0);
    const f = new THREE.Mesh(new THREE.BoxGeometry(GW - 0.08, 1, 0.2), lam(0x111111));
    const tk = new THREE.Mesh(new THREE.BoxGeometry(GW + 0.09, 0.035, 0.28), lam(0x111111));
    tk.position.set(GX[j], GY0 + barH(GV.dense[j]), 0);
    scene.add(e, f, tk);
    gFill.push(f);
  }

  const labStack = label('4 layers', 0.24);
  const labRouter = label('router', 0.24);
  const labTable = label('n-gram table', 0.24);
  const labHeads = label('hash heads', 0.22);
  const labG = [label('stored', 0.23), label('compute', 0.23), label('bytes', 0.23)];

  // ── deterministic per-token picks: experts per layer, table rows per token ──────
  const rand = rng(23);
  const shuffle = n => { const a = [...Array(n).keys()]; for (let i = n - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1));[a[i], a[j]] = [a[j], a[i]]; } return a; };
  const picks = Array.from({ length: T }, () => Array.from({ length: LAYERS }, () => shuffle(NSLOT).slice(0, 4)));
  const litRows = Array.from({ length: T }, () => shuffle(TCELLS).slice(0, NLIT).sort((a, b) => a - b));

  let mode = 'dense', topk = 2, playing = true, t = 0;
  let moeAmt = 0, ngAmt = 0, gap = G_DENSE;
  const gVal = [...GV.dense];

  return {
    view: { target: [0.8, 0.05, 0], radius: 40, theta: 0.5, phi: 1.12, size: 2.85 },
    update(dt) {
      if (playing) t = Math.max(0, t + dt) % (T * TOKT);            // clamp: first frames can carry dt ≤ 0
      const ti = Math.min(T - 1, Math.floor(t / TOKT));
      const f = (t - ti * TOKT) / TOKT;

      // mechanism morph (which sub-objects are present at all)
      moeAmt += ((mode === 'moe' ? 1 : 0) - moeAmt) * ease(dt, 6);
      ngAmt += ((mode === 'ngram' ? 1 : 0) - ngAmt) * ease(dt, 6);
      gap += ((mode === 'moe' ? G_MOE : G_DENSE) - gap) * ease(dt, 7);
      const nVis = Math.max(ngAmt, 0.001);

      // the sweep climbs the stack early in the token and holds until the token is handed over, so a
      // paused (or slow-rendered still) frame always shows what this token computed
      const fade = 1 - Math.max(0, (f - 0.94) / 0.06);
      const wave = l => Math.max(0, Math.min(1, (f - 0.06 - l * 0.085) / 0.05)) * fade;  // layer cascade
      const headB = Math.max(0, Math.min(1, (f - 0.02) / 0.08)) * fade;       // hashed lookups

      // FFN cells: one solid bar (dense / n-gram host) or 8 experts (moe)
      const cw = cellW(gap);
      for (let l = 0; l < LAYERS; l++) {
        const on = picks[ti][l].slice(0, topk);
        for (let s = 0; s < NSLOT; s++) {
          let want = 0;
          if (mode === 'dense') want = wave(l);
          else if (mode === 'moe') want = on.includes(s) ? wave(l) : 0;
          else want = 0.3 + 0.2 * wave(l);                          // host stack keeps running, dimmed
          cur[l * NSLOT + s] += (want - cur[l * NSLOT + s]) * ease(dt, want > cur[l * NSLOT + s] ? 11 : 8);
          const a = cur[l * NSLOT + s];
          P.set(cellX(s, gap), yOf(l) + BLK_Y, 0);
          S.set(cw * (1 + 0.14 * a), BLK_H * (0.86 + 0.2 * a), BLK_D * (1 + 0.1 * a));
          cells.setMatrixAt(l * NSLOT + s, M.compose(P, Q, S));
          cells.setColorAt(l * NSLOT + s, tmp.copy(cIdle).lerp(cAct, a));
        }
      }
      cells.instanceMatrix.needsUpdate = true;
      if (cells.instanceColor) cells.instanceColor.needsUpdate = true;

      // routers + needles: the router opens the experts it routes this token to
      let ns = 0;
      for (let l = 0; l < LAYERS; l++) {
        const lit = mode === 'moe' ? wave(l) : 0;
        const s = Math.max(moeAmt * (0.6 + 0.4 * lit), 0.001);
        routers.setMatrixAt(l, M.compose(P.set(RTX, yOf(l) + BLK_Y, 0), Q, S.set(0.26 * s, 0.26 * s, 0.26 * s)));
        if (mode === 'moe') for (const e of picks[ti][l].slice(0, topk)) {
          const xa = RTX + 0.14, ln = Math.max(0.02, (cellX(e, gap) - cw / 2 - 0.02 - xa) * Math.min(1, lit * 2.4));
          needles.setMatrixAt(ns++, M.compose(P.set(xa + ln / 2, yOf(l) + BLK_Y, 0.27), Q, S.set(ln, 0.045, 0.06)));
        }
      }
      for (; ns < LAYERS * 4; ns++) needles.setMatrixAt(ns, M.compose(P.set(0, -9, 0), Q, S.setScalar(0.001)));
      routers.instanceMatrix.needsUpdate = needles.instanceMatrix.needsUpdate = true;

      // n-gram table: rows rise dark where the hash heads land, then the fused vector is injected
      const sel = litRows[ti];
      for (let c = 0; c < TCELLS; c++) {
        const want = sel.includes(c) ? headB : 0;
        tab[c] += (want - tab[c]) * ease(dt, want > tab[c] ? 12 : 9);
        const a = tab[c];
        P.set(tcx(c), tcy(c), 0.02 + a * 0.1);
        S.set(TCW * (0.8 + 0.3 * a) * nVis, TPY * 0.72 * (0.8 + 0.3 * a) * nVis, (0.06 + 0.2 * a) * nVis);
        rowsMesh.setMatrixAt(c, M.compose(P, Q, S));
        rowsMesh.setColorAt(c, tmp.copy(cIdle).lerp(cRow, a));
      }
      rowsMesh.instanceMatrix.needsUpdate = true;
      if (rowsMesh.instanceColor) rowsMesh.instanceColor.needsUpdate = true;
      tPlate.scale.setScalar(nVis); tEdge.scale.setScalar(nVis); guide.scale.set(nVis, nVis, nVis);
      for (let h = 0; h < 2; h++) {
        const s = Math.max(nVis * (0.45 + 0.55 * headB), 0.001);
        heads.setMatrixAt(h, M.compose(P.set(HEAD[h][0], HEAD[h][1], 0.12), Q, S.set(s, s, s)));
        for (let k = 0; k < 2; k++) {                        // beam: head → one of its selected rows
          const ci = sel[h * 2 + k], dx = tcx(ci) - HEAD[h][0], dy = tcy(ci) - HEAD[h][1];
          const d0 = Math.max(0.02, Math.hypot(dx, dy));
          const ln = Math.max(0.02, d0 * Math.min(1, headB * 1.9)) * nVis;
          EUL.set(0, 0, Math.atan2(dy, dx)); EQ.setFromEuler(EUL);
          P.set(HEAD[h][0] + dx / d0 * ln / 2, HEAD[h][1] + dy / d0 * ln / 2, 0.1);
          beams.setMatrixAt(h * 2 + k, M.compose(P, EQ, S.set(ln, 0.028, 0.028)));
        }
      }
      heads.instanceMatrix.needsUpdate = beams.instanceMatrix.needsUpdate = true;
      // fused table rows are injected into the host stack: travel right → left into layer 2
      const ip = (f - 0.5) / 0.2;
      pulse.visible = mode === 'ngram' && ip > 0 && ip < 1;
      if (pulse.visible) pulse.position.set(INJ_X1 + (INJ_X0 - INJ_X1) * ip, INJ_Y + 0.07, 0.22);

      // token rail: the current tile is what this layer cascade is computing; in n-gram mode the
      // hashed window covers the previous + current token ID
      for (let i = 0; i < T; i++) {
        const now = i === ti, inWin = mode === 'ngram' && i === ti - 1 && ti > 0;
        const a = now ? fade : 0;
        tiles.setMatrixAt(i, M.compose(P.set(tokX(i), RY, now ? 0.1 : 0), Q, S.set(RTW, 0.16 + 0.07 * a, 0.34)));
        tiles.setColorAt(i, tmp.copy(cIdle).lerp(cAct, a).lerp(cWin, inWin ? 0.7 : 0));
      }
      tiles.instanceMatrix.needsUpdate = true;
      if (tiles.instanceColor) tiles.instanceColor.needsUpdate = true;
      const w0 = mode === 'ngram' && ti > 0 ? ti - 1 : ti;
      const xa = tokX(w0) - RTW / 2 - 0.05, xb = tokX(ti) + RTW / 2 + 0.05;
      cursor.position.set((xa + xb) / 2, RY, 0.12);
      cursor.scale.set(Math.max(xb - xa, 0.001), 0.3, 0.42);

      // gauges
      for (let j = 0; j < 3; j++) {
        gVal[j] += (GV[mode][j] - gVal[j]) * ease(dt, 5);
        const h = Math.max(0.02, barH(gVal[j]));
        gFill[j].scale.set(1, h, 1);
        gFill[j].position.set(GX[j], GY0 + h / 2, 0);
      }

      setLab(labStack, 0.24, X0 + SPAN / 2, Y0 + DY * 3 + 0.62, 0.3);
      setLab(labRouter, 0.24, RTX, Y0 + DY * 3 + 0.62, 0.3, moeAmt);
      setLab(labTable, 0.24, tCx, GY1 + 0.42, 0.3, ngAmt);
      setLab(labHeads, 0.22, (HEAD[0][0] + HEAD[1][0]) / 2, HEAD[0][1] - 0.32, 0.3, ngAmt);
      for (let j = 0; j < 3; j++) setLab(labG[j], 0.22, GX[j], GY0 - 0.36, 0.3);

      const line = mode === 'dense' ? 'dense · every ffn block runs · capacity and compute rise together'
        : mode === 'moe' ? `moe · top-${topk} of ${NSLOT} experts per layer · stored capacity, less compute`
          : 'n-gram · hash picks a few table rows · capacity mostly as memory';
      out({ playing, mode, topk, readout: line });
    },
    action(name, arg) {
      if (name === 'play') playing = !playing;
      else if (name === 'step') {
        playing = false;
        const k = Math.floor(t / TOKT), mid = k * TOKT + TOKT * 0.62;      // land mid-token: cascade done
        t = t < mid ? mid : Math.min(T * TOKT - 0.01, mid + TOKT);
      }
      else if (name === 'mode') { mode = GV[String(arg)] ? String(arg) : 'dense'; t = 0; }
      else if (name === 'topk') topk = Math.max(1, Math.min(4, Math.round(Number(arg) || 2)));
    },
  };
}
