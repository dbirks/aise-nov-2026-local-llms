// Variant C (engines-cache-c): One shared token strip along x for the three requests (R1, R2, R3).
// A toggle swaps the index structure drawn above it (vLLM blocks, SGLang radix tree, llama.cpp slots),
// while hit/miss markers per request below the strip are recomputed in JS for the chosen engine.
import { THREE, lam, ghost, ease, emitter } from './_kit.js';

const S_TOKS = ['s0', 's1', 's2', 's3', 's4', 's5', 's6', 's7'];
const REQS = [
  { id: 'R1', tokens: [...S_TOKS, 'a0', 'a1', 'a2', 'a3'] },
  { id: 'R2', tokens: [...S_TOKS, 'b0', 'b1', 'b2', 'b3'] },
  { id: 'R3', tokens: ['s0', 's1', 's2', 'c0', 'c1', 'c2', 'c3', 'c4'] },
];
const BLOCK_SIZE = 4;

/** Compute hits and per-token hit boolean masks for each engine in JS from the toy token lists. */
function computeHitsForEngine(engine) {
  if (engine === 'vllm') {
    const cache = new Set();
    const hits = [];
    const masks = [];
    for (const req of REQS) {
      let parent = '0';
      let count = 0;
      let prefixOk = true;
      const mask = new Array(req.tokens.length).fill(false);
      const nBlocks = Math.floor(req.tokens.length / BLOCK_SIZE);
      for (let b = 0; b < nBlocks; b++) {
        const blockToks = req.tokens.slice(b * BLOCK_SIZE, (b + 1) * BLOCK_SIZE);
        const h = `${parent}|${blockToks.join(',')}`;
        if (prefixOk && cache.has(h)) {
          count += BLOCK_SIZE;
          for (let k = 0; k < BLOCK_SIZE; k++) mask[b * BLOCK_SIZE + k] = true;
        } else {
          prefixOk = false;
          cache.add(h);
        }
        parent = h;
      }
      hits.push(count);
      masks.push(mask);
    }
    return { hits, masks };
  }

  if (engine === 'sglang') {
    const treeSeqs = [];
    const hits = [];
    const masks = [];
    for (const req of REQS) {
      let best = 0;
      for (const prev of treeSeqs) {
        let lcp = 0;
        while (lcp < req.tokens.length && lcp < prev.length && req.tokens[lcp] === prev[lcp]) lcp++;
        if (lcp > best) best = lcp;
      }
      hits.push(best);
      masks.push(req.tokens.map((_, i) => i < best));
      treeSeqs.push(req.tokens);
    }
    return { hits, masks };
  }

  // llama.cpp (same slot 0 for sequential requests R1 -> R2 -> R3)
  let slotTokens = [];
  const hits = [];
  const masks = [];
  for (const req of REQS) {
    let lcp = 0;
    while (lcp < req.tokens.length && lcp < slotTokens.length && req.tokens[lcp] === slotTokens[lcp]) lcp++;
    hits.push(lcp);
    masks.push(req.tokens.map((_, i) => i < lcp));
    slotTokens = req.tokens;
  }
  return { hits, masks };
}

function makeLabel(parent, text, x, y, z, height = 0.33) {
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthWrite: false, depthTest: false }));
  sp.renderOrder = 20;
  const setText = t => {
    if (sp.userData.text === t) return;
    sp.userData.text = t;
    const canvas = document.createElement('canvas');
    const g = canvas.getContext('2d');
    const font = 'bold 68px sans-serif';
    g.font = font;
    const w = Math.max(24, Math.ceil(g.measureText(t).width)) + 18;
    canvas.width = w;
    canvas.height = 94;
    g.font = font;
    g.fillStyle = '#111111';
    g.textBaseline = 'middle';
    g.fillText(t, 9, 48);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    sp.material.map?.dispose();
    sp.material.map = tex;
    sp.material.needsUpdate = true;
    sp.scale.set(height * (w / 94), height, 1);
  };
  setText(text);
  sp.position.set(x, y, z);
  parent.add(sp);
  sp.userData.setText = setText;
  return sp;
}

function makeStateBox(parent, w, h, d, x, y, z, stripes = 3) {
  const group = new THREE.Group();
  group.position.set(x, y, z);
  parent.add(group);

  const geo = new THREE.BoxGeometry(w, h, d);
  const mat = lam(0xd6d6d6);
  const mesh = new THREE.Mesh(geo, mat);
  group.add(mesh);

  const edges = new THREE.LineSegments(
    new THREE.EdgesGeometry(geo),
    new THREE.LineBasicMaterial({ color: 0x181818 })
  );
  group.add(edges);

  const hatchGroup = new THREE.Group();
  const barLen = Math.min(w, h) * 0.88;
  const barThick = Math.max(0.032, Math.min(w, h) * 0.11);
  const barGeo = new THREE.BoxGeometry(barThick, barLen, 0.025);
  const barMat = lam(0x1e1e1e);
  for (let i = 0; i < stripes; i++) {
    const frac = stripes === 1 ? 0 : (i / (stripes - 1) - 0.5) * (w * 0.62);
    const bar = new THREE.Mesh(barGeo, barMat);
    bar.position.set(frac, 0, d / 2 + 0.014);
    bar.rotation.z = -0.58;
    hatchGroup.add(bar);
  }
  group.add(hatchGroup);

  group.userData.setMode = mode => {
    if (mode === 'hit') {
      mat.color.setHex(0x171717);
      hatchGroup.visible = false;
      mesh.visible = true;
    } else if (mode === 'miss') {
      mat.color.setHex(0xd8d8d8);
      hatchGroup.visible = true;
      mesh.visible = true;
    } else {
      mat.color.setHex(0xebebeb);
      hatchGroup.visible = false;
      mesh.visible = false;
    }
  };
  group.userData.setMode('miss');
  return group;
}

function makeArrow(parent, x0, y0, z0, x1, y1, z1, color = 0x1a1a1a) {
  const dir = new THREE.Vector3(x1 - x0, y1 - y0, z1 - z0);
  const len = dir.length();
  const group = new THREE.Group();
  const mat = lam(color);
  const headLen = Math.min(0.18, len * 0.38);
  const shaftLen = Math.max(0.02, len - headLen);
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, shaftLen, 8), mat);
  shaft.position.y = shaftLen / 2;
  const head = new THREE.Mesh(new THREE.ConeGeometry(0.085, headLen, 10), mat);
  head.position.y = shaftLen + headLen / 2;
  group.add(shaft, head);
  group.position.set(x0, y0, z0);
  group.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
  parent.add(group);
  return group;
}

export default function build(scene, emit) {
  const out = emitter(emit);
  const xPos = i => -3.52 + i * 0.64; // 12 token positions: -3.52 .. +3.52

  // ── 1. Middle Zone: ONE shared token strip along x (shared prefix tiles dark) ──
  const STRIP_Y = -0.22;
  const stripPlate = new THREE.Mesh(new THREE.BoxGeometry(8.2, 0.56, 0.56), ghost(0x2a2a2a, 0.12));
  stripPlate.position.set(0, STRIP_Y, -0.05);
  scene.add(stripPlate);

  makeLabel(scene, 'tokens', -4.45, STRIP_Y, 0, 0.34);

  const stripTiles = [];
  for (let i = 0; i < 12; i++) {
    const tBox = makeStateBox(scene, 0.48, 0.38, 0.38, xPos(i), STRIP_Y, 0, 2);
    // Shared prefix tiles (0..7 = S) are solid dark; suffix tiles (8..11) are hatched
    tBox.userData.setMode(i < 8 ? 'hit' : 'miss');
    stripTiles.push(tBox);
  }

  // Divergence ticks on the token strip (token 3 for R3, token 8 for R1/R2)
  const xDiv3 = (xPos(2) + xPos(3)) / 2; // -1.92
  const xDiv8 = (xPos(7) + xPos(8)) / 2; // +0.64
  for (const dx of [xDiv3, xDiv8]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.50, 0.46), lam(0x111111));
    post.position.set(dx, STRIP_Y, 0);
    scene.add(post);
  }

  makeLabel(scene, 'S[0..2] (R1,R2,R3)', -2.65, -0.74, 0, 0.32);
  makeLabel(scene, 'S[3..7] (R1,R2)', -0.45, -0.74, 0, 0.32);
  makeLabel(scene, 'suffix a / b', 2.56, -0.74, 0, 0.32);

  // ── 2. Top Zone: Swappable Index Structures above the token strip ────────────
  // (A) vLLM blocks: 3 cubes grouped by 4 tokens + hash arrows
  const vllmGroup = new THREE.Group();
  scene.add(vllmGroup);
  makeLabel(vllmGroup, 'vLLM: hashed blocks · toy block 4; real default 16', 0.0, 2.86, 0, 0.34);

  const blockCenters = [-2.56, 0.0, 2.56];
  const vllmCubes = [];
  for (let b = 0; b < 3; b++) {
    const cx = blockCenters[b];
    const cube = makeStateBox(vllmGroup, 2.18, 0.58, 0.50, cx, 1.25, 0, 4);
    cube.userData.setMode(b < 2 ? 'hit' : 'miss');
    vllmCubes.push(cube);

    // Bracket legs connecting each 4-token block to its 4 tiles on the token strip
    for (const side of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.85, 0.04), lam(0x333333));
      leg.position.set(cx + side * 1.02, 0.52, 0);
      vllmGroup.add(leg);
    }
  }
  makeArrow(vllmGroup, -1.42, 1.25, 0, -1.12, 1.25, 0);
  makeArrow(vllmGroup, 1.12, 1.25, 0, 1.42, 1.25, 0);

  makeLabel(vllmGroup, 'h1 = H(0, s0..3)', -2.56, 0.70, 0, 0.32);
  makeLabel(vllmGroup, 'h2 = H(h1, s4..7)', 0.0, 0.70, 0, 0.32);
  makeLabel(vllmGroup, 'h3 = H(h2, suffix)', 2.56, 0.70, 0, 0.32);

  // Partial block callout above Block 0 for R3
  const r3PartialBox = makeStateBox(vllmGroup, 2.18, 0.34, 0.40, -2.56, 1.94, 0, 4);
  r3PartialBox.userData.setMode('miss');
  makeLabel(vllmGroup, 'R3: 3 < block 4 → partial block recomputed', -0.85, 2.46, 0, 0.32);

  // (B) SGLang radix tree: trunk + branches at y = branch point
  const sglangGroup = new THREE.Group();
  scene.add(sglangGroup);
  makeLabel(sglangGroup, 'SGLang: RadixAttention tree · page size 1', 0.0, 2.86, 0, 0.34);

  // Trunk segment 0..2 (x from -3.76 to -1.92)
  const sgTrunk0 = makeStateBox(sglangGroup, 1.80, 0.50, 0.48, -2.84, 1.05, 0, 3);
  sgTrunk0.userData.setMode('hit');
  makeLabel(sglangGroup, 'trunk S[0..2] (3)', -2.84, 0.54, 0, 0.32);

  // Branch point 1 at xDiv3 = -1.92 (token 3)
  const sgNode3 = new THREE.Mesh(new THREE.BoxGeometry(0.14, 1.15, 0.54), lam(0x111111));
  sgNode3.position.set(xDiv3, 1.55, 0);
  sglangGroup.add(sgNode3);

  // R3 branch at y = 2.08 (tokens 3..7 = 5 tokens)
  const sgBranchR3 = makeStateBox(sglangGroup, 2.75, 0.42, 0.42, -0.48, 2.08, 0, 4);
  sgBranchR3.userData.setMode('miss');
  makeLabel(sglangGroup, 'R3 branch @ 3: c (5)', -0.48, 2.50, 0, 0.32);

  // Trunk segment 3..7 (x from -1.92 to +0.64)
  const sgTrunk1 = makeStateBox(sglangGroup, 2.48, 0.50, 0.48, -0.64, 1.05, 0, 3);
  sgTrunk1.userData.setMode('hit');
  makeLabel(sglangGroup, 'trunk S[3..7] (+5 = 8)', -0.64, 1.50, 0, 0.32);

  // Branch point 2 at xDiv8 = +0.64 (token 8)
  const sgNode8 = new THREE.Mesh(new THREE.BoxGeometry(0.14, 1.25, 0.54), lam(0x111111));
  sgNode8.position.set(xDiv8, 1.30, 0);
  sglangGroup.add(sgNode8);

  // Leaves for R1 (y = 1.82) and R2 (y = 0.78) spanning tokens 8..11
  const sgLeafR1 = makeStateBox(sglangGroup, 2.95, 0.40, 0.42, 2.22, 1.82, 0, 4);
  sgLeafR1.userData.setMode('miss');
  makeLabel(sglangGroup, 'R1 leaf: a (4)', 2.22, 2.24, 0, 0.32);

  const sgLeafR2 = makeStateBox(sglangGroup, 2.95, 0.40, 0.42, 2.22, 0.78, 0, 4);
  sgLeafR2.userData.setMode('miss');
  makeLabel(sglangGroup, 'R2 leaf: b (4)', 2.22, 0.36, 0, 0.32);

  // (C) llama.cpp slots: two horizontal slot lanes above the strip
  const llamaGroup = new THREE.Group();
  scene.add(llamaGroup);
  makeLabel(llamaGroup, 'llama.cpp: 2 slots · exact LCP within same slot', 0.0, 2.86, 0, 0.34);

  makeLabel(llamaGroup, 'slot 0', -4.35, 1.82, 0, 0.34);
  makeLabel(llamaGroup, 'same slot: R2 LCP = 8 · R3 LCP = 3', -0.64, 2.34, 0, 0.32);
  const slot0Tray = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(7.75, 0.50, 0.46)),
    new THREE.LineBasicMaterial({ color: 0x222222 })
  );
  slot0Tray.position.set(0, 1.82, 0);
  llamaGroup.add(slot0Tray);
  for (let i = 0; i < 12; i++) {
    const sb = makeStateBox(llamaGroup, 0.46, 0.36, 0.36, xPos(i), 1.82, 0, 2);
    sb.userData.setMode(i < 8 ? 'hit' : 'miss');
  }

  makeLabel(llamaGroup, 'slot 1', -4.35, 0.85, 0, 0.34);
  makeLabel(llamaGroup, 'other slot buffer: no cross-slot prefix share', 0.0, 0.38, 0, 0.32);
  const slot1Tray = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(7.75, 0.50, 0.46)),
    new THREE.LineBasicMaterial({ color: 0x666666 })
  );
  slot1Tray.position.set(0, 0.85, 0);
  llamaGroup.add(slot1Tray);
  for (let i = 0; i < 12; i++) {
    const sb = makeStateBox(llamaGroup, 0.46, 0.32, 0.32, xPos(i), 0.85, 0, 2);
    sb.userData.setMode('empty');
  }

  // ── 3. Bottom Zone: Row of Hit/Miss Markers per Request below the strip ─────
  const ROW_Y = [-1.28, -1.94, -2.60];
  const markerRows = [[], [], []];
  const rowHitLabels = [];

  for (let r = 0; r < 3; r++) {
    const req = REQS[r];
    makeLabel(scene, req.id, -4.35, ROW_Y[r], 0, 0.34);
    for (let i = 0; i < req.tokens.length; i++) {
      const m = makeStateBox(scene, 0.46, 0.34, 0.32, xPos(i), ROW_Y[r], 0, 2);
      markerRows[r].push(m);
    }
    const hLab = makeLabel(scene, '0 reused', 4.48, ROW_Y[r], 0, 0.32);
    rowHitLabels.push(hLab);
  }

  const r3ReasonLabel = makeLabel(scene, '3 < block 4 → 0', 2.38, ROW_Y[2], 0, 0.32);
  makeLabel(scene, 'dark = reused KV · hatched = recomputed', 0.0, -3.08, 0, 0.32);

  // ── Animation & State ───────────────────────────────────────────────────────
  let engine = 'vllm';
  let playing = true;
  let clock = 0;
  let pulseReq = 1; // highlights R1, R2, R3 in sequence
  let aV = 1, aS = 0, aL = 0;

  return {
    view: { target: [-0.15, 0.0, 0], radius: 40, theta: 0.14, phi: 1.20, size: 4.05 },
    update(dt) {
      if (playing) {
        clock += dt;
        if (clock >= 3.0) {
          clock = 0;
          pulseReq = (pulseReq + 1) % 3;
        }
      }
      const k = ease(dt, 7);

      // Animate index structure swap above the strip
      aV += ((engine === 'vllm' ? 1 : 0) - aV) * k;
      aS += ((engine === 'sglang' ? 1 : 0) - aS) * k;
      aL += ((engine === 'llama' ? 1 : 0) - aL) * k;

      const applySwap = (grp, amt) => {
        grp.visible = amt > 0.04;
        const s = Math.max(0.01, amt);
        grp.scale.set(1, s, s);
        grp.position.y = (1 - amt) * 0.35;
      };
      applySwap(vllmGroup, aV);
      applySwap(sglangGroup, aS);
      applySwap(llamaGroup, aL);

      // Recompute hit/miss markers per request for the active engine
      const { hits, masks } = computeHitsForEngine(engine);
      for (let r = 0; r < 3; r++) {
        rowHitLabels[r].userData.setText(`${hits[r]} / ${REQS[r].tokens.length} hit`);
        const isActive = pulseReq === r;
        for (let i = 0; i < markerRows[r].length; i++) {
          const box = markerRows[r][i];
          box.userData.setMode(masks[r][i] ? 'hit' : 'miss');
          const targetZ = isActive ? 0.12 : 0;
          box.position.z += (targetZ - box.position.z) * k;
        }
      }

      if (engine === 'vllm') {
        r3ReasonLabel.userData.setText('3 < block 4 → 0');
      } else if (engine === 'sglang') {
        r3ReasonLabel.userData.setText('tree split @ 3 → 3');
      } else {
        r3ReasonLabel.userData.setText('same-slot LCP → 3');
      }

      const engineName =
        engine === 'vllm' ? 'vllm blocks' : engine === 'sglang' ? 'sglang tree' : 'llama.cpp slots';
      const readout = `simulated · ${engineName} · R1 ${hits[0]} · R2 ${hits[1]} · R3 ${hits[2]} reused`;
      out({ playing, readout });
    },
    action(name, arg) {
      if (name === 'play') {
        playing = typeof arg === 'boolean' ? arg : !playing;
      } else if (name === 'step') {
        playing = false;
        const order = ['vllm', 'sglang', 'llama'];
        engine = order[(order.indexOf(engine) + 1) % order.length];
        clock = 0;
      } else if (name === 'engine' && ['vllm', 'sglang', 'llama'].includes(String(arg))) {
        engine = String(arg);
      }
    },
  };
}
