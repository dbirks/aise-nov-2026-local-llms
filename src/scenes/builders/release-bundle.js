// Scene `release-bundle` — a model release is no longer one download; it is a serving bundle
// (LAB brainstorm, README "Model releases increasingly include a matched drafter").
//
// The dark crate up-left is the release, labelled with the model's own name. It opens and the
// artifacts drop into a row, each with a role label:
//   target weights  the big slab — the dominant download
//   tokenizer       the thin card (tokenizer + chat template travel with the weights)
//   no mtp          a column of heads wired into the slab's side. NONE of the three official
//                   releases below documents native MTP heads, so by default this is only a light
//                   outline + "no mtp" chip; the toggle draws the heads and the readout marks it
//                   as illustrative. MTP heads belong to the target — that is the contrast with…
//   dflash          …a SEPARATE small tower with a deliberate gap to the slab: a separately
//                   downloaded, specifically trained companion checkpoint. Plate count = the
//                   drafter layer count where the official card states one (Laguna S 2.1: 6
//                   sliding-attention layers, Laguna XS 2.1: 5); the comb of light cubes above it
//                   is the draft block (16 positions for Laguna S, ≤15 proposals for Laguna XS —
//                   from the cards; the Muse assistant's numbers are not documented → illustrative).
// Below the row, loader rails run from BOTH the slab and the drafter into one dark verifier plate,
// then a short row of verified tokens: one serving process, two checkpoints, and the drafter is
// not free — it costs its own load time, memory and compute.
// Beats: in the box → unpacking → one download each → loading both → one verifier → back.
// Accuracy (README): do NOT imply third-party drafting is impossible, that every model ships a
// drafter (see the companion toggle), or that DFlash and native MTP heads are one mechanism.
// Runtime support varies by version; some upstream integrations had not landed at publication.

import { THREE, lam, M, Q, P, S, ease, emitter } from './_kit.js';

// ── the three releases named in the research notes ──────────────────────────
const REL = {
  muse: { tag: 'muse glimmer 30b', drafter: 'official dflash assistant', layers: 4, k: 8 },
  'laguna-s': { tag: 'laguna s 2.1', drafter: 'dflash · 6 layers · 16-position block', layers: 6, k: 16, note: 'check runtime' },
  'laguna-xs': { tag: 'laguna xs 2.1', drafter: 'dflash · 5 layers · ≤15 proposals', layers: 5, k: 15, note: 'check runtime' },
};

// crate
const CR = 0.8, CXR = -1.45, CYR = 2.3, CZR = -1.15;
// target slab
const XT = -0.45, TW = 1.4, TY0 = -0.35, TY1 = 1.35, TD = 0.8, PLATES = 4;
// tokenizer card
const XC = 0.72, CW = 0.55, CYB = -0.05, CYT = 1.05, N_TPL = 6;
// drafter tower + draft block
const XD = 1.53, DW = 0.65, DY0 = -0.35, DP = 0.2, DPH = 0.12, MAXL = 6, DZ = 0.3;
// rails / verifier / tokens
const Y_RAIL = -0.95, XV = -0.18, Y_MERGE = -1.35, VW = 1.45, VY = -1.58, VYH = 0.45;
const XO0 = 0.85, ODX = 0.21, YO = -1.6, N_OUT = 5;
// native MTP heads (attached to the slab's left face; lighter tone so they read on the dark slab)
const XM = -1.72, YM = [0.15, 0.5, 0.85], C_MTP = 0x606060;
const RZ = 0.08;                              // rail plane, just in front of the slab centre
const BEATS = [1.8, 2.8, 2.4, 3.4, 1.6];
const PHASE = ['in the box', 'unpacking', 'one download each', 'loading both', 'one verifier'];
const TOTAL = BEATS.reduce((a, b) => a + b, 0);

const clamp01 = v => (v < 0 ? 0 : v > 1 ? 1 : v);
const seg = (v, a, b) => clamp01((v - a) / (b - a));
const c1 = new THREE.Color(), c2 = new THREE.Color();

/** light "sticker" chip with dark text — stays legible over dark geometry */
function mkLabel(text, h, scene) {
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthWrite: false, depthTest: false }));
  const set = t => {
    const cv = document.createElement('canvas'), g = cv.getContext('2d');
    const font = 'bold 56px ui-monospace, "DejaVu Sans Mono", monospace';
    g.font = font;
    const w = Math.max(30, Math.ceil(g.measureText(t).width)) + 34;
    cv.width = w; cv.height = 72;
    g.fillStyle = '#e9e9e4'; g.fillRect(0, 0, w, 72);
    g.strokeStyle = '#9a9a94'; g.lineWidth = 3; g.strokeRect(1.5, 1.5, w - 3, 69);
    g.font = font; g.fillStyle = '#131313'; g.textBaseline = 'middle';
    g.fillText(t, 17, 39);
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    sp.material.map?.dispose();
    sp.material.map = tex; sp.material.needsUpdate = true;
    sp.scale.set(h * (w / 72), h, 1);
  };
  set(text);
  scene.add(sp);
  return { sprite: sp, set };
}

/** axis-aligned loader rail; drawn with progress p, sampled with at(f) */
function mkRail(pts, thick, depth, mat, segs = []) {
  let total = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const [x1, y1] = pts[i], [x2, y2] = pts[i + 1];
    const len = Math.abs(x2 - x1) + Math.abs(y2 - y1);
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), mat);
    mesh.visible = false;
    segs.push({ x1, y1, x2, y2, len, from: total, mesh });
    total += len;
  }
  return {
    segs, total,
    at(f) {
      const d = clamp01(f) * total;
      for (const s of segs) if (d <= s.from + s.len) {
        const u = s.len ? (d - s.from) / s.len : 0;
        return [s.x1 + (s.x2 - s.x1) * u, s.y1 + (s.y2 - s.y1) * u];
      }
      const s = segs[segs.length - 1];
      return [s.x2, s.y2];
    },
    draw(p) {
      for (const s of segs) {
        const u = seg(p * total, s.from, s.from + s.len);
        const horiz = Math.abs(s.x2 - s.x1) > Math.abs(s.y2 - s.y1);
        const ln = Math.max(s.len * u, 0.001);
        s.mesh.visible = u > 0.003;
        s.mesh.scale.set(horiz ? ln : thick, horiz ? thick : ln, depth);
        s.mesh.position.set(s.x1 + (s.x2 - s.x1) * u / 2, s.y1 + (s.y2 - s.y1) * u / 2, RZ);
      }
    },
  };
}

export default function build(scene, emit) {
  const out = emitter(emit);

  // ── release crate: closed dark box → light empty shell, lid dissolves ──────
  const crateMat = lam(0x2d2d2d, { transparent: true });
  const crate = new THREE.Mesh(new THREE.BoxGeometry(CR, CR, CR), crateMat);
  crate.position.set(CXR, CYR, CZR);
  crate.add(new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(CR, CR, CR)),
    new THREE.LineBasicMaterial({ color: 0x111111 })));
  const lidMat = lam(0x1a1a1a, { transparent: true });
  const lid = new THREE.Mesh(new THREE.BoxGeometry(CR + 0.12, 0.13, CR + 0.12), lidMat);
  scene.add(crate, lid);

  // ── target weights: four plates growing out of the crate ──────────────────
  const tGap = 0.08, tH = (TY1 - TY0 - (PLATES - 1) * tGap) / PLATES;
  const tPlates = [];
  for (let i = 0; i < PLATES; i++) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), lam(0x222222));
    m.scale.setScalar(0.001);
    scene.add(m);
    tPlates.push({ m, y: TY0 + tH / 2 + i * (tH + tGap) });
  }

  // ── tokenizer / chat-template card ───────────────────────────────────────
  const card = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), lam(0x3c3c3c));
  card.scale.setScalar(0.001);
  scene.add(card);

  // ── native MTP heads, or the light outline of "not in this release" ───────
  const mtpParts = [];
  for (const y of YM) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.26, 0.26), lam(C_MTP));
    b.position.set(XM, y, 0);
    b.scale.setScalar(0.001);
    scene.add(b); mtpParts.push(b);
  }
  const mtpSpine = new THREE.Mesh(new THREE.BoxGeometry(0.05, YM[2] - YM[0], 0.05), lam(C_MTP));
  mtpSpine.position.set(XM, (YM[0] + YM[2]) / 2, 0);
  const mtpStub = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.05, 0.05), lam(C_MTP));
  mtpStub.position.set(XM + 0.35, YM[1], 0);
  for (const m of [mtpSpine, mtpStub]) { m.scale.setScalar(0.001); scene.add(m); mtpParts.push(m); }
  const mtpGhost = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(0.36, 1.0, 0.3)),
    new THREE.LineBasicMaterial({ color: 0x767676 }));
  mtpGhost.position.set(XM, (YM[0] + YM[2]) / 2, 0);
  scene.add(mtpGhost);

  // ── companion drafter: separate small tower, visible gap to the slab ──────
  const dPlates = [];
  for (let i = 0; i < MAXL; i++) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), lam(0x2b2b2b));
    m.scale.setScalar(0.001);
    scene.add(m);
    dPlates.push({ m, y: DY0 + DPH / 2 + i * DP });
  }

  // ── instanced small cubes: template slots, draft-block comb, verified output ─
  const N = N_TPL + 16 + N_OUT;
  const tiles = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), lam(0xffffff), N);
  tiles.frustumCulled = false;
  scene.add(tiles);
  const cTpl = new THREE.Color(0x1a1a1a), cSlot = new THREE.Color(0x6a6a6a), cOut = new THREE.Color(0x121212);

  // ── loader rails into one verifier ───────────────────────────────────────
  const railT = mkRail([[XT, TY0], [XT, Y_RAIL], [XV, Y_RAIL], [XV, Y_MERGE]], 0.075, 0.1, lam(0x1c1c1c));
  const railD = mkRail([[XD, DY0], [XD, Y_RAIL], [XV, Y_RAIL], [XV, Y_MERGE]], 0.06, 0.1, lam(0x2a2a2a));
  for (const r of [railT, railD]) for (const s of r.segs) { scene.add(s.mesh); }

  const verMat = lam(0xa8a8a8, { transparent: true });
  const ver = new THREE.Mesh(new THREE.BoxGeometry(VW, VYH, 0.5), verMat);
  ver.position.set(XV, VY, 0);
  ver.add(new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(VW, VYH, 0.5)),
    new THREE.LineBasicMaterial({ color: 0x111111 })));
  scene.add(ver);

  const pkT = [], pkD = [];
  for (let i = 0; i < 3; i++) {
    const a = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.13, 0.13), lam(0x141414));
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), lam(0x383838));
    for (const m of [a, b]) { m.scale.setScalar(0.001); scene.add(m); }
    pkT.push(a); pkD.push(b);
  }

  // ── chips ────────────────────────────────────────────────────────────────
  const lblCrate = mkLabel(REL.muse.tag, 0.38, scene);
  const lblTgt = mkLabel('target weights', 0.38, scene);
  const lblMtp = mkLabel('no mtp', 0.34, scene);
  const lblCard = mkLabel('tokenizer', 0.34, scene);
  const lblDra = mkLabel('dflash', 0.36, scene);
  const lblVer = mkLabel('verifier', 0.38, scene);
  const lblOut = mkLabel('tokens', 0.34, scene);
  const CHIPS = [lblCrate, lblTgt, lblMtp, lblCard, lblDra, lblVer, lblOut];
  for (const c of CHIPS) c.sprite.material.opacity = 0;

  // ── state ────────────────────────────────────────────────────────────────
  let release = 'muse', comp = true, mtp = false;
  let playing = true, t = 0, clock = 0, jump = false;
  let open = 0, railP = 0, pulse = 0, compA = 1, mtpA = 0;
  let layerN = REL.muse.layers, kN = REL.muse.k;

  const beatIdx = () => {
    let a = 0;
    for (let i = 0; i < BEATS.length; i++) { if (t < a + BEATS[i]) return i; a += BEATS[i]; }
    return BEATS.length - 1;
  };
  const beatStart = b => BEATS.slice(0, b).reduce((a, x) => a + x, 0);

  function setRelease(r) {
    release = REL[r] ? r : 'muse';
    layerN = REL[release].layers; kN = REL[release].k;
    lblCrate.set(REL[release].tag);
  }
  setRelease('muse');

  return {
    view: { target: [0.15, 0.3, 0], radius: 40, theta: 0.5, phi: 1.16, size: 3.0 },
    update(dt) {
      clock += dt;
      if (playing) t = (t + dt) % TOTAL;
      if (jump) {
        jump = false; playing = false;
        const a = beatStart(beatIdx() + 1);
        t = a >= TOTAL - 0.01 ? 0 : a + 0.001;
      }
      const beat = beatIdx(), bt = t - beatStart(beat);

      open += ((beat === 0 ? 0 : 1) - open) * ease(dt, 4);
      railP += ((beat >= 2 ? 1 : 0) - railP) * ease(dt, 4.5);
      pulse += ((beat === 3 ? 1 : 0) - pulse) * ease(dt, 5);
      compA += ((comp ? 1 : 0) - compA) * ease(dt, 6);
      mtpA += ((mtp ? 1 : 0) - mtpA) * ease(dt, 6);
      const load = beat >= 4 ? 1 : beat === 3 ? seg(bt, 0.7, 2.5) : 0;
      const dTop = DY0 + layerN * DP;                       // top of the drawn drafter tower

      // crate / lid
      c1.setHex(0x2d2d2d).lerp(c2.setHex(0xb0b0b0), open);
      crateMat.color.copy(c1);
      crateMat.opacity = 1 - open * 0.5;
      crate.scale.set(1, 1 - open * 0.8, 1);
      crate.position.y = CYR - CR / 2 + 0.06 - open * (CR * 0.4 - 0.06);
      lid.position.set(CXR, CYR + CR / 2 + 0.08 + open * 0.7, CZR);
      lidMat.opacity = Math.max(0.001, 1 - open * 1.6);
      lid.scale.setScalar(Math.max(0.001, 1 - open * 0.6));

      // artifacts fan out of the crate, downward-right into the row
      for (let i = 0; i < PLATES; i++) {
        const pl = tPlates[i], u = seg(open, 0.02 + i * 0.05, 0.52 + i * 0.05);
        pl.m.scale.set(TW * Math.max(u, 0.001), tH * Math.max(u, 0.001), TD * Math.max(u, 0.001));
        pl.m.position.set(CXR + (XT - CXR) * u, pl.y, CZR + (0 - CZR) * u);
      }
      {
        const u = seg(open, 0.2, 0.72);
        card.scale.set(CW * Math.max(u, 0.001), (CYT - CYB) * Math.max(u, 0.001), 0.1 * Math.max(u, 0.001));
        card.position.set(CXR + (XC - CXR) * u, (CYB + CYT) / 2, 0);
      }
      for (let i = 0; i < MAXL; i++) {
        const pl = dPlates[i], u = seg(open, 0.24 + i * 0.03, 0.66 + i * 0.03) * compA;
        pl.m.scale.set(DW * Math.max(u, 0.001), DPH * Math.max(u, 0.001), 0.5 * Math.max(u, 0.001));
        pl.m.position.set(CXR + (XD - CXR) * u, pl.y, DZ);
      }
      const uM = seg(open, 0.3, 0.78);
      for (const m of mtpParts) m.scale.setScalar(Math.max(0.001, uM * mtpA));
      mtpGhost.scale.set(Math.max(0.001, uM * (1 - mtpA)), Math.max(0.001, uM * (1 - mtpA)), Math.max(0.001, uM * (1 - mtpA)));

      // rails, packets, verifier
      railT.draw(railP);
      railD.draw(railP * compA);
      c1.setHex(0xa8a8a8).lerp(c2.setHex(0x171717), load);
      verMat.color.copy(c1);
      for (let i = 0; i < 3; i++) {
        const [ax, ay] = railT.at((clock * 0.38 + i / 3) % 1);
        pkT[i].position.set(ax, ay, RZ + 0.09);
        pkT[i].scale.setScalar(Math.max(0.001, pulse * railP));
        const [bx, by] = railD.at((clock * 0.52 + i / 3) % 1);
        pkD[i].position.set(bx, by, RZ + 0.09);
        pkD[i].scale.setScalar(Math.max(0.001, pulse * railP * compA));
      }

      // small cubes
      let ti = 0;
      const put = (x, y, z, w, h, d, c) => {
        P.set(x, y, z); S.set(Math.max(w, 0.001), Math.max(h, 0.001), Math.max(d, 0.001));
        tiles.setMatrixAt(ti, M.compose(P, Q, S)); tiles.setColorAt(ti, c); ti++;
      };
      const uC = seg(open, 0.2, 0.72);
      for (let i = 0; i < N_TPL; i++) put(XC - 0.14 + (i % 2) * 0.28, CYT - 0.16 - Math.floor(i / 2) * 0.3, 0.07,
        0.22 * uC, 0.07 * uC, 0.04, cTpl);
      for (let i = 0; i < 16; i++) {
        const on = (i < kN ? seg(open, 0.34, 0.8) : 0) * compA;
        put(XD - (kN - 1) * 0.0375 + i * 0.075, dTop + 0.26, DZ, 0.055 * on, 0.22 * on, 0.055 * on, cSlot);
      }
      for (let i = 0; i < N_OUT; i++) put(XO0 + i * ODX, YO, 0.1,
        0.13 * load, 0.13 * load, 0.13 * load, cOut);
      for (; ti < N; ti++) put(0, -40, 0, 0.001, 0.001, 0.001, cTpl);
      tiles.instanceMatrix.needsUpdate = true;
      if (tiles.instanceColor) tiles.instanceColor.needsUpdate = true;

      // chips
      const seen = seg(open, 0.55, 0.95);
      lblCrate.sprite.material.opacity = 1 - open * 0.35;
      lblTgt.sprite.material.opacity = seen;
      lblCard.sprite.material.opacity = seen;
      lblDra.sprite.material.opacity = seen * compA;
      lblMtp.sprite.material.opacity = seen;
      lblVer.sprite.material.opacity = seg(open, 0.6, 1);
      lblOut.sprite.material.opacity = load;
      lblCrate.sprite.position.set(CXR, CYR + CR / 2 + 0.48, CZR);
      lblTgt.sprite.position.set(XT, TY1 + 0.42, 0.4);
      lblCard.sprite.position.set(XC - 0.12, CYT + 0.4, 0.15);
      lblDra.sprite.position.set(XD + 0.02, dTop + 0.56, DZ);
      lblMtp.sprite.position.set(XM + 0.55, YM[0] - 0.62, 0);
      lblVer.sprite.position.set(XV + 0.03, VY - VYH / 2 - 0.6, 0);
      lblOut.sprite.position.set(XO0 + 2 * ODX, YO - 0.5, 0.1);

      // readout (≤ 75 chars; least important tail parts drop first)
      const r = REL[release];
      // priority order: the MTP disclosure outranks the drafter detail, so it survives truncation
      const parts = [PHASE[beat], r.tag];
      if (mtp) parts.push('mtp shown · illustrative');
      parts.push(comp ? r.drafter : 'target weights only');
      if (r.note && comp) parts.push(r.note);
      let txt = parts.join(' · ');
      while (txt.length > 75 && parts.length > 2) { parts.pop(); txt = parts.join(' · '); }
      out({ playing, release, comp, mtp, beat: PHASE[beat], readout: txt });
    },
    action(name, arg) {
      if (name === 'play') playing = !playing;
      else if (name === 'step') jump = true;
      else if (name === 'release') setRelease(String(arg));
      else if (name === 'companion') comp = !!arg;
      else if (name === 'mtp') { mtp = !!arg; lblMtp.set(mtp ? 'mtp heads' : 'no mtp'); }
    },
  };
}
