// Variant B (engines-cache-b): Three engines side by side fed the same three toy prompts (R1, R2, R3).
// Computes hits per engine in JS from the toy token lists:
//   S = 8 shared tokens; R1 = S + 4 'a'; R2 = S + 4 'b'; R3 = first 3 of S + 5 'c'.
//   vLLM: full matching hashed blocks of size 4 only (toy block 4; real default 16 / 64 in v0.34).
//   SGLang: longest token prefix in the radix tree (page size 1).
//   llama.cpp: per-slot LCP with that slot's previous prompt (2 slots; control selects R2 slot).
import { THREE, lam, ghost, ease, emitter } from './_kit.js';

const S_TOKS = ['s0', 's1', 's2', 's3', 's4', 's5', 's6', 's7'];
const REQS = [
  { id: 'R1', tokens: [...S_TOKS, 'a0', 'a1', 'a2', 'a3'] },
  { id: 'R2', tokens: [...S_TOKS, 'b0', 'b1', 'b2', 'b3'] },
  { id: 'R3', tokens: ['s0', 's1', 's2', 'c0', 'c1', 'c2', 'c3', 'c4'] },
];
const BLOCK_SIZE = 4;

/** Compute per-request hit token counts and per-token hit masks in JS from the toy token lists. */
function computeEngineHits(r2SlotMode) {
  // 1. vLLM: chained block hashes over full blocks of BLOCK_SIZE (4)
  const vllmCache = new Set();
  const vllmHits = [];
  const vllmMasks = [];
  for (const req of REQS) {
    let parent = '0';
    let hits = 0;
    let prefixMatch = true;
    const mask = new Array(req.tokens.length).fill(false);
    const numBlocks = Math.floor(req.tokens.length / BLOCK_SIZE);
    for (let b = 0; b < numBlocks; b++) {
      const slice = req.tokens.slice(b * BLOCK_SIZE, (b + 1) * BLOCK_SIZE);
      const h = `${parent}|${slice.join(',')}`;
      if (prefixMatch && vllmCache.has(h)) {
        hits += BLOCK_SIZE;
        for (let k = 0; k < BLOCK_SIZE; k++) mask[b * BLOCK_SIZE + k] = true;
      } else {
        prefixMatch = false;
        vllmCache.add(h);
      }
      parent = h;
    }
    vllmHits.push(hits);
    vllmMasks.push(mask);
  }

  // 2. SGLang: radix tree over token sequences (page_size = 1)
  const sglangTreeSeqs = [];
  const sglangHits = [];
  const sglangMasks = [];
  for (const req of REQS) {
    let bestLcp = 0;
    for (const prev of sglangTreeSeqs) {
      let lcp = 0;
      while (lcp < req.tokens.length && lcp < prev.length && req.tokens[lcp] === prev[lcp]) lcp++;
      if (lcp > bestLcp) bestLcp = lcp;
    }
    sglangHits.push(bestLcp);
    sglangMasks.push(req.tokens.map((_, i) => i < bestLcp));
    sglangTreeSeqs.push(req.tokens);
  }

  // 3. llama.cpp: 2 slots, LCP against that slot's previous prompt only
  const slots = [[], []];
  const slotAssign = [0, r2SlotMode === 'same' ? 0 : 1, 0];
  const llamaHits = [];
  const llamaMasks = [];
  for (let r = 0; r < REQS.length; r++) {
    const req = REQS[r];
    const sIdx = slotAssign[r];
    const prev = slots[sIdx];
    let lcp = 0;
    while (lcp < req.tokens.length && lcp < prev.length && req.tokens[lcp] === prev[lcp]) lcp++;
    llamaHits.push(lcp);
    llamaMasks.push(req.tokens.map((_, i) => i < lcp));
    slots[sIdx] = req.tokens;
  }

  return {
    vllm: { hits: vllmHits, masks: vllmMasks },
    sglang: { hits: sglangHits, masks: sglangMasks },
    llama: { hits: llamaHits, masks: llamaMasks, slotAssign },
  };
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

/** 3D block that can switch between HIT (solid dark) and MISS/RECOMPUTED (light + dark edges + diagonal hatch bars). */
function makeStateBox(parent, w, h, d, x, y, z, stripes = 3) {
  const group = new THREE.Group();
  group.position.set(x, y, z);
  parent.add(group);

  const geo = new THREE.BoxGeometry(w, h, d);
  const mat = lam(0xd6d6d6);
  const mesh = new THREE.Mesh(geo, mat);
  group.add(mesh);

  const edgeMat = new THREE.LineBasicMaterial({ color: 0x181818 });
  const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geo), edgeMat);
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
    // mode: 'hit' | 'miss' | 'empty'
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
  const headLen = Math.min(0.16, len * 0.38);
  const shaftLen = Math.max(0.02, len - headLen);
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, shaftLen, 8), mat);
  shaft.position.y = shaftLen / 2;
  const head = new THREE.Mesh(new THREE.ConeGeometry(0.075, headLen, 10), mat);
  head.position.y = shaftLen + headLen / 2;
  group.add(shaft, head);
  group.position.set(x0, y0, z0);
  group.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
  parent.add(group);
  return group;
}

export default function build(scene, emit) {
  const out = emitter(emit);
  const COL_X = [-3.35, 0.0, 3.35];

  // Subtle column plates & divider lines
  for (let c = 0; c < 3; c++) {
    const plate = new THREE.Mesh(new THREE.BoxGeometry(2.95, 5.45, 0.03), ghost(0x3a3a3a, 0.08));
    plate.position.set(COL_X[c], -0.1, -0.35);
    scene.add(plate);
  }
  for (const divX of [-1.68, 1.68]) {
    const div = new THREE.Mesh(new THREE.BoxGeometry(0.025, 5.7, 0.04), ghost(0x222222, 0.22));
    div.position.set(divX, 0.0, -0.2);
    scene.add(div);
  }

  // Column Titles & Subtitles
  makeLabel(scene, 'vLLM', COL_X[0], 2.95, 0, 0.42);
  makeLabel(scene, 'SGLang', COL_X[1], 2.95, 0, 0.42);
  makeLabel(scene, 'llama.cpp', COL_X[2], 2.95, 0, 0.42);

  makeLabel(scene, 'toy block 4 (real: 16, or 64 from v0.34)', COL_X[0], 2.48, 0, 0.32);
  makeLabel(scene, 'radix tree · page 1', COL_X[1], 2.48, 0, 0.32);
  makeLabel(scene, '2 slots · per-slot LCP', COL_X[2], 2.48, 0, 0.32);

  // Top request strips (R1, R2, R3) arriving in sequence in every column
  const REQ_Y = [1.98, 1.62, 1.26];
  makeLabel(scene, 'R1', -4.74, REQ_Y[0], 0, 0.33);
  makeLabel(scene, 'R2', -4.74, REQ_Y[1], 0, 0.33);
  makeLabel(scene, 'R3', -4.74, REQ_Y[2], 0, 0.33);

  // Active request pointer on the far left
  const reqPointer = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.24, 0.24), lam(0x111111));
  reqPointer.position.set(-4.98, REQ_Y[1], 0.1);
  scene.add(reqPointer);

  const stripTiles = [[], [], []]; // [col][req][tokIdx]
  const stripTags = [[], [], []];  // [col][req]
  const TILE_DX = 0.18;

  for (let c = 0; c < 3; c++) {
    const startX = COL_X[c] - 1.12;
    for (let r = 0; r < 3; r++) {
      const req = REQS[r];
      const rowTiles = [];
      for (let t = 0; t < req.tokens.length; t++) {
        const tile = makeStateBox(
          scene,
          0.148,
          0.22,
          0.16,
          startX + t * TILE_DX,
          REQ_Y[r],
          0,
          1
        );
        rowTiles.push(tile);
      }
      stripTiles[c].push(rowTiles);
      const tag = makeLabel(scene, '0', startX + 12 * TILE_DX + 0.22, REQ_Y[r], 0, 0.32);
      stripTags[c].push(tag);
    }
  }

  // ── Column 0: vLLM chain of hashed block cubes ─────────────────────────────
  const vllmB0 = makeStateBox(scene, 0.92, 0.50, 0.48, COL_X[0] - 0.76, 0.32, 0, 3);
  const vllmB1 = makeStateBox(scene, 0.92, 0.50, 0.48, COL_X[0] + 0.76, 0.32, 0, 3);
  makeArrow(scene, COL_X[0] - 0.26, 0.32, 0, COL_X[0] + 0.26, 0.32, 0);

  // Sub-block grid ticks on B0 and B1 to show 4 tokens per block
  for (const bx of [COL_X[0] - 0.76, COL_X[0] + 0.76]) {
    for (let k = 0; k < 4; k++) {
      const pip = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.07, 0.18), lam(0x555555));
      pip.position.set(bx - 0.30 + k * 0.20, 0.61, 0);
      scene.add(pip);
    }
  }

  makeLabel(scene, 'h1 = H(0, s0..3)', COL_X[0] - 0.76, 0.84, 0, 0.32);
  makeLabel(scene, 'h2 = H(h1, toks)', COL_X[0] + 0.62, -0.08, 0, 0.32);

  // Suffix blocks for R1 ('a') and R2 ('b') chained from h2
  const vllmB2a = makeStateBox(scene, 0.86, 0.38, 0.40, COL_X[0] - 0.78, -0.72, 0, 3);
  const vllmB2b = makeStateBox(scene, 0.86, 0.38, 0.40, COL_X[0] + 0.78, -0.72, 0, 3);
  makeArrow(scene, COL_X[0] + 0.35, -0.24, 0, COL_X[0] - 0.45, -0.50, 0, 0x444444);
  makeArrow(scene, COL_X[0] + 0.78, -0.24, 0, COL_X[0] + 0.78, -0.50, 0, 0x444444);
  makeLabel(scene, 'R1: h3a', COL_X[0] - 0.78, -1.10, 0, 0.32);
  makeLabel(scene, 'R2: h3b', COL_X[0] + 0.78, -1.10, 0, 0.32);

  // R3 partial block at boundary (3 shared + 1 diff inside one 4-token block -> recomputed)
  const partialGroup = new THREE.Group();
  partialGroup.position.set(COL_X[0], -1.64, 0);
  scene.add(partialGroup);
  const pFrame = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(1.75, 0.44, 0.44)),
    new THREE.LineBasicMaterial({ color: 0x111111 })
  );
  partialGroup.add(pFrame);
  const partialSubTiles = [];
  for (let k = 0; k < 4; k++) {
    const st = makeStateBox(partialGroup, 0.36, 0.32, 0.34, -0.60 + k * 0.40, 0, 0, 2);
    st.userData.setMode('miss');
    partialSubTiles.push(st);
  }
  makeLabel(scene, 'partial block: recomputed', COL_X[0], -2.08, 0, 0.32);

  // ── Column 1: SGLang radix tree ────────────────────────────────────────────
  // Trunk 'S (8)' splits at 3 when R3 arrives, and splits into two leaves for R1 and R2 at 8.
  const sgTrunkTop = makeStateBox(scene, 0.94, 0.42, 0.44, COL_X[1] - 0.38, 0.48, 0, 3);
  const sgTrunkBot = makeStateBox(scene, 0.94, 0.46, 0.44, COL_X[1] - 0.38, -0.36, 0, 3);
  makeLabel(scene, 'S (8)', COL_X[1] - 0.38, 0.88, 0, 0.35);

  // Split marker at token 3 on the trunk + R3 branch
  const sgSplitPlate = new THREE.Mesh(new THREE.BoxGeometry(1.08, 0.08, 0.52), lam(0x111111));
  sgSplitPlate.position.set(COL_X[1] - 0.38, 0.07, 0);
  scene.add(sgSplitPlate);
  const sgR3Arrow = makeArrow(scene, COL_X[1] + 0.14, 0.07, 0, COL_X[1] + 0.62, -0.22, 0);
  const sgR3Leaf = makeStateBox(scene, 0.84, 0.40, 0.40, COL_X[1] + 0.82, -0.48, 0, 3);
  sgR3Leaf.userData.setMode('miss');
  makeLabel(scene, 'split @ 3', COL_X[1] + 0.82, 0.24, 0, 0.32);
  makeLabel(scene, 'R3: c (5)', COL_X[1] + 0.82, -0.92, 0, 0.32);

  // Two leaves under S (8) for R1 and R2
  makeArrow(scene, COL_X[1] - 0.48, -0.60, 0, COL_X[1] - 0.74, -1.32, 0);
  makeArrow(scene, COL_X[1] - 0.02, -0.60, 0, COL_X[1] + 0.38, -1.32, 0);
  const sgR1Leaf = makeStateBox(scene, 0.88, 0.42, 0.42, COL_X[1] - 0.76, -1.58, 0, 3);
  const sgR2Leaf = makeStateBox(scene, 0.88, 0.42, 0.42, COL_X[1] + 0.44, -1.58, 0, 3);
  sgR1Leaf.userData.setMode('miss');
  sgR2Leaf.userData.setMode('miss');
  makeLabel(scene, 'R1: a (4)', COL_X[1] - 0.76, -2.04, 0, 0.32);
  makeLabel(scene, 'R2: b (4)', COL_X[1] + 0.44, -2.04, 0, 0.32);

  // ── Column 2: llama.cpp two slot lanes ─────────────────────────────────────
  const SLOT_Y = [0.22, -1.42];
  makeLabel(scene, 'slot 0', COL_X[2] - 0.96, 0.70, 0, 0.34);
  const slot0Status = makeLabel(scene, 'reuse 8', COL_X[2] + 0.46, 0.70, 0, 0.32);

  makeLabel(scene, 'slot 1', COL_X[2] - 0.96, -0.94, 0, 0.34);
  const slot1Status = makeLabel(scene, 'empty', COL_X[2] + 0.46, -0.94, 0, 0.32);

  const slotTiles = [[], []];
  for (let s = 0; s < 2; s++) {
    const tray = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(2.48, 0.54, 0.44)),
      new THREE.LineBasicMaterial({ color: 0x333333 })
    );
    tray.position.set(COL_X[2], SLOT_Y[s], 0);
    scene.add(tray);

    const startX = COL_X[2] - 1.06;
    for (let t = 0; t < 12; t++) {
      const tile = makeStateBox(scene, 0.16, 0.38, 0.32, startX + t * 0.192, SLOT_Y[s], 0, 1);
      slotTiles[s].push(tile);
    }
  }

  const routeLabel = makeLabel(scene, 'same slot → reuse 8', COL_X[2], -0.38, 0, 0.32);
  makeLabel(scene, 'no cross-slot share', COL_X[2], -2.08, 0, 0.32);

  // Bottom reuse summary badges + legend
  const sumVllm = makeLabel(scene, 'R2: 8 · R3: 0 reused', COL_X[0], -2.62, 0, 0.33);
  const sumSglang = makeLabel(scene, 'R2: 8 · R3: 3 reused', COL_X[1], -2.62, 0, 0.33);
  const sumLlama = makeLabel(scene, 'R2: 8 · R3: 3 reused', COL_X[2], -2.62, 0, 0.33);

  makeLabel(scene, 'dark = cache hit · hatched = recomputed', 0.0, -3.08, 0, 0.32);

  // ── Animation & State ──────────────────────────────────────────────────────
  let slotMode = 'same';
  let playing = true;
  let beat = 1; // 0 = R1, 1 = R2 (shows the R2 slot contrast immediately), 2 = R3, 3 = all 3 summary
  let clock = 0;
  let splitAnim = 0;
  let slot1Anim = 0;

  return {
    view: { target: [-0.15, 0.0, 0], radius: 40, theta: 0.12, phi: 1.22, size: 4.1 },
    update(dt) {
      if (playing) {
        clock += dt;
        if (clock >= 2.8) {
          clock = 0;
          beat = (beat + 1) % 4;
        }
      }
      const k = ease(dt, 7);
      const res = computeEngineHits(slotMode);

      // Update request pointer
      const activeReq = beat < 3 ? beat : 1;
      reqPointer.position.y += (REQ_Y[activeReq] - reqPointer.position.y) * k;

      // Update top request strips in all 3 columns
      const cols = [res.vllm, res.sglang, res.llama];
      for (let c = 0; c < 3; c++) {
        for (let r = 0; r < 3; r++) {
          const shown = beat === 0 ? r === 0 : true;
          const isCurrent = beat === r;
          const mask = cols[c].masks[r];
          const hits = cols[c].hits[r];
          stripTags[c][r].userData.setText(`${hits}/${REQS[r].tokens.length}`);
          for (let t = 0; t < stripTiles[c][r].length; t++) {
            const tile = stripTiles[c][r][t];
            tile.userData.setMode(!shown ? 'empty' : mask[t] ? 'hit' : 'miss');
            const targetZ = isCurrent ? 0.14 : 0;
            tile.position.z += (targetZ - tile.position.z) * k;
          }
        }
      }

      // 1. vLLM column state: B0 and B1 become solid dark HITs once R2 arrives (beat >= 1)
      const r2Arrived = beat >= 1;
      const r3Arrived = beat >= 2;
      vllmB0.userData.setMode(r2Arrived ? 'hit' : 'miss');
      vllmB1.userData.setMode(r2Arrived ? 'hit' : 'miss');
      vllmB2a.userData.setMode('miss');
      vllmB2b.userData.setMode(r2Arrived ? 'miss' : 'empty');
      partialGroup.position.z += ((r3Arrived ? 0.14 : 0) - partialGroup.position.z) * k;

      // 2. SGLang column state: trunk 'S (8)' lights dark on R2, splits at 3 on R3
      sgTrunkTop.userData.setMode(r2Arrived ? 'hit' : 'miss');
      sgTrunkBot.userData.setMode(r2Arrived ? 'hit' : 'miss');
      splitAnim += ((r3Arrived ? 1 : 0) - splitAnim) * k;
      sgTrunkTop.position.y = 0.40 + splitAnim * 0.08;
      sgTrunkBot.position.y = -0.30 - splitAnim * 0.08;
      sgSplitPlate.scale.set(1, Math.max(0.15, splitAnim), 1);
      sgR3Leaf.userData.setMode(r3Arrived ? 'miss' : 'empty');
      sgR3Arrow.visible = r3Arrived;
      sgR2Leaf.userData.setMode(r2Arrived ? 'miss' : 'empty');

      // 3. llama.cpp column state: slot 0 vs slot 1 depending on slotMode and beat
      slot1Anim += ((slotMode === 'other' ? 1 : 0) - slot1Anim) * k;
      if (slotMode === 'same') {
        routeLabel.userData.setText('same slot → reuse 8');
        slot0Status.userData.setText(beat === 0 ? 'R1 prefill 12' : beat === 2 ? 'R3 reuse 3' : 'R2 reuse 8');
        slot1Status.userData.setText('idle · empty');
        for (let t = 0; t < 12; t++) {
          if (beat === 0) {
            slotTiles[0][t].userData.setMode('miss');
          } else if (beat === 2) {
            slotTiles[0][t].userData.setMode(t < 3 ? 'hit' : t < 8 ? 'miss' : 'empty');
          } else {
            slotTiles[0][t].userData.setMode(t < 8 ? 'hit' : 'miss');
          }
          slotTiles[1][t].userData.setMode('empty');
        }
      } else {
        routeLabel.userData.setText('other slot → full prefill');
        slot0Status.userData.setText(beat === 2 ? 'R3 reuse 3' : 'slot 0: R1');
        slot1Status.userData.setText(r2Arrived ? 'R2 cold: 0 reused' : 'idle · empty');
        for (let t = 0; t < 12; t++) {
          if (beat === 2) {
            slotTiles[0][t].userData.setMode(t < 3 ? 'hit' : t < 8 ? 'miss' : 'empty');
          } else {
            slotTiles[0][t].userData.setMode('miss');
          }
          slotTiles[1][t].userData.setMode(r2Arrived ? 'miss' : 'empty');
        }
      }

      sumVllm.userData.setText(`R2: ${res.vllm.hits[1]} · R3: ${res.vllm.hits[2]} reused`);
      sumSglang.userData.setText(`R2: ${res.sglang.hits[1]} · R3: ${res.sglang.hits[2]} reused`);
      sumLlama.userData.setText(`R2: ${res.llama.hits[1]} · R3: ${res.llama.hits[2]} reused`);

      const slotDesc = slotMode === 'same' ? 'same slot' : 'other slot';
      const readout = `simulated · R2 reuse: vllm ${res.vllm.hits[1]} · sglang ${res.sglang.hits[1]} · llama.cpp ${res.llama.hits[1]} (${slotDesc})`;
      out({ playing, readout });
    },
    action(name, arg) {
      if (name === 'play') {
        playing = typeof arg === 'boolean' ? arg : !playing;
      } else if (name === 'step') {
        playing = false;
        beat = (beat + (Number(arg) || 1) + 4) % 4;
        clock = 0;
      } else if (name === 'slot' && (arg === 'same' || arg === 'other')) {
        slotMode = arg;
        if (beat === 0) beat = 1;
      }
    },
  };
}
