// Scene `agent-loop` — handoff A01 "Why bother?": one agent turn is a loop the MODEL only
// contributes text to. Everything that touches a tool happens in the harness, outside the weights.
//
// Left → right on one floor: a "you" tile · the agent harness (an outline box with a runner bar)
// · the local model (an outline GPU card holding three dark WEIGHTS slabs that never change, plus
// a text-output slot on top) · a tool rack with three boxes (web search / kubectl / git). Along the
// front runs the CONVERSATION: one tile per message — the tiles are what the harness re-sends every
// turn, so the strip visibly grows (context grows) while the weights stay byte-identical.
// Story (4 turns, a conspicuously SYNTHETIC trace, labelled "synthetic trace"):
//   1 prompt → harness → model writes text → harness runs `kubectl get pods` → result appended
//   2 model writes `kubectl logs api` → result appended
//   3 model writes an edit → the HARNESS writes the file sheet (no tool box involved)
//   4 model writes `git commit` → runs → then `git push` → runs → done
// A dark packet cube travels each hop. `where tools run` draws a dark wall around the model with
// "text in, text out" on it, brightens the two harness↔model text pipes and dims the harness→tool
// lines: the boundary is text, the tools run over there.
//
// Nothing here is a measurement: the trace, the tool names and the message counts are a designed
// toy sequence (SYNTHETIC DEMO). The only numbers drawn are turn n/4 and the count of messages on
// the strip. Mechanism: an engine returns the assistant message (text or a tool call) and the
// client/harness executes it and sends the result back
// (https://docs.vllm.ai/en/latest/features/tool_calling/). Do NOT read unrestricted access,
// a training-method proof or a success rate out of this loop.
import { THREE, lam, ghost, ease, emitter } from './_kit.js';

const FLOOR = -1.0;              // y everything stands on
const ZF = 0.98;                 // z of the conversation lane (in front of the stations)
const HAR_H = 1.05, MOD_H = 1.5, TOOL_S = 0.36, TOOL_PITCH = 0.78;
const X = { you: -1.78, har: -0.95, mod: 0.32, tool: 1.8 };
const YOU_P = [X.you, FLOOR + 0.16, 0.2];
const HAR_P = [X.har, FLOOR + HAR_H / 2, 0.05];
const MOD_P = [X.mod, FLOOR + MOD_H / 2, 0.0];
const SLOT_P = [X.mod, FLOOR + 1.34, 0.0];    // the model's text-output slot
const FILE_P = [X.har, FLOOR + 1.85, -0.1];
const TOOL_P = {
  search: [X.tool, FLOOR + 0.28, 0.05],
  kubectl: [X.tool, FLOOR + 0.28 + TOOL_PITCH, 0.05],
  git: [X.tool, FLOOR + 0.28 + 2 * TOOL_PITCH, 0.05],
};
const TILE0 = -1.75, PITCH = 0.33, TILE_Y = FLOOR + 0.13;
const tileP = i => [TILE0 + i * PITCH, TILE_Y, ZF];

const DT = 0.55;                          // seconds per hop (20 hops ≈ 11 s loop)
const clamp01 = v => (v < 0 ? 0 : v > 1 ? 1 : v);

// ── the synthetic trace ───────────────────────────────────────────────
// kind: user (flat light plate) · step (tall DARK cube = the model's own message)
//       · res (mid cube + dark outline = something the harness observed outside)
const MSGS = [
  { kind: 'user', lab: 'system + tools' },
  { kind: 'user', lab: 'prompt' },
  { kind: 'step', lab: 'model step' },
  { kind: 'res', lab: 'tool result' },
  { kind: 'step', lab: 'model step' },
  { kind: 'res', lab: 'tool result' },
  { kind: 'step', lab: 'model step' },
  { kind: 'res', lab: 'tool result' },
  { kind: 'step', lab: 'model step' },
  { kind: 'res', lab: 'tool result' },
  { kind: 'step', lab: 'model step' },
  { kind: 'res', lab: 'tool result' },
];

// one hop = one packet travelling `from` → `to`; `show` = conversation tile appended by the
// harness at the end of that hop; `hi` = what lights up.
const BEATS = [];
const hop = (turn, from, to, txt, show, hi) => BEATS.push({ turn, from, to, txt, show, hi });
// turn 1
hop(1, YOU_P, HAR_P, 'you send the prompt', -1, 'harness');
hop(1, HAR_P, MOD_P, 'harness sends the conversation', -1, 'model');
hop(1, SLOT_P, HAR_P, 'model writes: kubectl get pods', 2, 'slot');
hop(1, HAR_P, TOOL_P.kubectl, 'harness runs: kubectl get pods', -1, 'kubectl');
hop(1, TOOL_P.kubectl, tileP(3), 'tool result appended', 3, 'strip');
// turn 2
hop(2, HAR_P, MOD_P, 'harness sends it back', -1, 'model');
hop(2, SLOT_P, HAR_P, 'model writes: kubectl logs api', 4, 'slot');
hop(2, HAR_P, TOOL_P.kubectl, 'harness runs: kubectl logs api', -1, 'kubectl');
hop(2, TOOL_P.kubectl, tileP(5), 'tool result appended', 5, 'strip');
// turn 3 (the harness performs the edit; no tool box is involved)
hop(3, HAR_P, MOD_P, 'harness sends it back', -1, 'model');
hop(3, SLOT_P, HAR_P, 'model writes: edit api.yaml', 6, 'slot');
hop(3, HAR_P, FILE_P, 'harness writes the file', -1, 'file');
hop(3, FILE_P, tileP(7), 'result appended', 7, 'strip');
// turn 4 — two tool calls, in order, from two separate model decisions
hop(4, HAR_P, MOD_P, 'harness feeds the result back', -1, 'model');
hop(4, SLOT_P, HAR_P, 'model writes: git commit', 8, 'slot');
hop(4, HAR_P, TOOL_P.git, 'harness runs: git commit', -1, 'git');
hop(4, TOOL_P.git, tileP(9), 'result appended', 9, 'strip');
hop(4, HAR_P, MOD_P, 'harness feeds the result back', -1, 'model');
hop(4, SLOT_P, HAR_P, 'model writes: git push', 10, 'slot');
hop(4, HAR_P, TOOL_P.git, 'harness runs: git push', -1, 'git');
hop(4, TOOL_P.git, tileP(11), 'done · pushed', 11, 'strip');
const NB = BEATS.length;
// tiles on the strip when each hop begins (the first two — system + prompt — are there from t=0)
const VIS0 = BEATS.map((b, i) => 2 + BEATS.slice(0, i).reduce((n, p) => n + (p.show >= 0 ? 1 : 0), 0));
const TURN0 = [1, 2, 3, 4].map(n => BEATS.findIndex(b => b.turn === n));   // first hop of each turn

export default function build(scene, emit) {
  const out = emitter(emit);

  /** short camera-facing label (dark text on transparent: the background is the lightest tone) */
  const label = (text, h) => {
    const fpx = 60, f = `bold ${fpx}px ui-monospace, monospace`;
    const cv = document.createElement('canvas'), g0 = cv.getContext('2d');
    g0.font = f;
    cv.width = Math.ceil(Math.max(g0.measureText(text).width, text.length * fpx * 0.84)) + 28;
    cv.height = fpx + 18;
    const g = cv.getContext('2d');
    g.font = f; g.fillStyle = '#151515'; g.textBaseline = 'middle';
    g.fillText(text, 14, cv.height / 2 + 1);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, depthWrite: false, depthTest: false }));
    sp.renderOrder = 10;
    sp.userData.h = h; sp.userData.ar = cv.width / cv.height;
    sp.scale.set(0.001, 0.001, 1);
    scene.add(sp);
    return sp;
  };
  const at = (sp, x, y, z, on = 1) => {
    sp.scale.set(Math.max(sp.userData.h * on * sp.userData.ar, 0.001), Math.max(sp.userData.h * on, 0.001), 1);
    sp.position.set(x, y, z);
  };
  const box = (w, h, d, c) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), lam(c));
    scene.add(m); return m;
  };
  const cage = (w, h, d, x, y, z, c = 0x111111) => {
    const e = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(w, h, d)),
      new THREE.LineBasicMaterial({ color: c }));
    e.position.set(x, y, z); scene.add(e); return e;
  };
  const tube = (from, to, r, mat) => {
    const a = new THREE.Vector3(...from), b = new THREE.Vector3(...to);
    const d = b.clone().sub(a), len = d.length();
    const m = new THREE.Mesh(new THREE.BoxGeometry(r, r, 1), mat);
    m.position.copy(a).add(b).multiplyScalar(0.5);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), d.normalize());
    m.scale.z = len; scene.add(m); return m;
  };

  // ── floor: one plane for the stations, a separate lane in front for the conversation ──
  const floor = new THREE.Mesh(new THREE.BoxGeometry(4.0, 0.03, 1.4), ghost(0x2f2f2f, 0.11));
  floor.position.set(0.3, FLOOR - 0.015, -0.1);
  const lane = new THREE.Mesh(new THREE.BoxGeometry(4.0, 0.03, 0.42), ghost(0x2f2f2f, 0.15));
  lane.position.set(0.12, FLOOR + 0.015, ZF);
  scene.add(floor, lane);

  // ── you ─────────────────────────────────────────────────────────────
  const you = box(0.3, 0.3, 0.22, 0x1b1b1b);
  you.position.set(...YOU_P);
  const labYou = label('you', 0.22), labHar = label('harness', 0.22);
  const labMod = label('local model', 0.22), labW = label('weights', 0.2);
  const labSlot = label('text out', 0.2), labFile = label('file', 0.2);
  const labConv = label('conversation', 0.19), labSyn = label('synthetic trace', 0.18);
  const labTools = ['search', 'kubectl', 'git'].map(t => label(t === 'search' ? 'web search' : t, 0.17));
  const labWall = label('text in, text out', 0.24);

  // ── the harness: outline box + the runner bar that is DARK only while it executes ──
  cage(0.9, HAR_H, 0.68, ...HAR_P);
  const harFill = new THREE.Mesh(new THREE.BoxGeometry(0.9, HAR_H, 0.68), ghost(0xbdbdbd, 0.09));
  harFill.position.set(...HAR_P); scene.add(harFill);
  const runner = box(0.46, 0.1, 0.4, 0xd0d0d0);          // DARK only while the harness executes
  runner.position.set(X.har, FLOOR + 0.28, 0.05);

  // ── the local model: an outline GPU card, dark static weights, text-output slot on top ──
  cage(1.35, MOD_H, 0.8, ...MOD_P);
  const modFill = new THREE.Mesh(new THREE.BoxGeometry(1.35, MOD_H, 0.8), ghost(0xbdbdbd, 0.07));
  modFill.position.set(...MOD_P); scene.add(modFill);
  const weights = [0, 1, 2].map(i => {
    const w = box(0.8, 0.06, 0.16, 0x101010);          // STATIC: nothing ever touches these
    w.position.set(X.mod, FLOOR + 0.4 + i * 0.21, 0.0);
    return w;
  });
  const slot = box(0.66, 0.05, 0.38, 0xc4c4c4);
  slot.position.set(...SLOT_P);

  // ── the tool rack: three idle light boxes that go dark only while the harness runs them ──
  const rack = new THREE.Mesh(new THREE.BoxGeometry(0.05, 2.2, 0.14), ghost(0x3a3a3a, 0.16));
  rack.position.set(X.tool + 0.3, FLOOR + 1.1, -0.1); scene.add(rack);
  const tools = {};
  for (const k of ['search', 'kubectl', 'git']) {
    const p = TOOL_P[k];
    const shelf = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.03, 0.44), ghost(0x2f2f2f, 0.16));
    shelf.position.set(p[0], p[1] - TOOL_S / 2 - 0.02, p[2]); scene.add(shelf);
    tools[k] = box(TOOL_S, TOOL_S, TOOL_S * 0.9, 0xc9c9c9);
    tools[k].position.set(...p);
  }
  // the file sheet the harness writes (turn 3) — a light plate with ruled lines
  const sheet = box(0.3, 0.38, 0.03, 0xd6d6d6);
  sheet.position.set(...FILE_P);
  const lines = [0, 1, 2].map(i => {
    const l = box(0.2, 0.028, 0.02, 0xd6d6d6);
    l.position.set(FILE_P[0] - 0.02, FILE_P[1] + 0.1 - i * 0.1, FILE_P[2] + 0.03);
    return l;
  });

  // ── lines: two text pipes harness↔model, three harness→tool lines (dimmed by the toggle) ──
  const mText = new THREE.MeshBasicMaterial({ color: 0x8f8f8f, transparent: true, opacity: 0.3 });
  const mTool = new THREE.MeshBasicMaterial({ color: 0x6b6b6b, transparent: true, opacity: 0.22 });
  const pipeIn = tube([X.har + 0.46, FLOOR + 0.66, 0.05], [X.mod - 0.68, FLOOR + 0.86, 0.0], 0.045, mText);
  const pipeOut = tube([X.har + 0.46, FLOOR + 0.36, 0.05], [X.mod - 0.68, FLOOR + 0.5, 0.0], 0.045, mText.clone());
  const toolLines = ['search', 'kubectl', 'git'].map(k =>
    tube([X.har + 0.46, FLOOR + 0.16, 0.05], [TOOL_P[k][0] - 0.2, TOOL_P[k][1] - 0.1, TOOL_P[k][2]], 0.03, mTool.clone()));

  // ── the wall drawn by `where tools run` ─────────────────────────────
  const wall = cage(1.55, 1.66, 1.0, X.mod, FLOOR + 0.75, 0.0, 0x111111);
  const wallFace = new THREE.Mesh(new THREE.PlaneGeometry(1.55, 1.66), ghost(0x161616, 0));
  wallFace.position.set(X.mod, FLOOR + 0.75, 0.5); scene.add(wallFace);

  // ── conversation tiles ──────────────────────────────────────────────
  const KIND = {
    user: { w: 0.24, h: 0.1, d: 0.2, c: 0x9f9f9f, edge: false },
    step: { w: 0.24, h: 0.24, d: 0.18, c: 0x151515, edge: false },
    res: { w: 0.22, h: 0.16, d: 0.2, c: 0x6f6f6f, edge: true },
  };
  const tiles = MSGS.map((m, i) => {
    const k = KIND[m.kind];
    const mesh = box(k.w, k.h, k.d, k.c);
    mesh.position.set(...tileP(i));
    mesh.scale.setScalar(0.001); mesh.visible = false;
    let edge = null;
    if (k.edge) {
      edge = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(k.w + 0.03, k.h + 0.03, k.d + 0.03)),
        new THREE.LineBasicMaterial({ color: 0x141414 }));
      edge.position.set(...tileP(i));
      edge.scale.setScalar(0.001); edge.visible = false; scene.add(edge);
    }
    return { mesh, edge, grow: 0 };
  });
  const kindLabs = {
    user: label('prompt', 0.2), step: label('model step', 0.2), res: label('tool result', 0.2),
  };

  // ── the travelling packet (a trail of dark cubes) ──────────────────
  const TRAIL = 8;
  const pk = new THREE.InstancedMesh(new THREE.BoxGeometry(0.13, 0.13, 0.13), lam(0x141414), TRAIL);
  pk.frustumCulled = false; scene.add(pk);
  const PP = new THREE.Vector3(), PQ = new THREE.Quaternion(), PS = new THREE.Vector3();
  const MM = new THREE.Matrix4();
  const vA = new THREE.Vector3(), vB = new THREE.Vector3();

  // ── state ───────────────────────────────────────────────────────────
  let bi = 0, bt = 0, playing = true, stepReq = false, revealOn = false, rv = 0, clock = 0;
  const gl = { harness: 0, model: 0, slot: 0, strip: 0, file: 0, search: 0, kubectl: 0, git: 0 };
  gl.harness = 1;
  const cIdle = new THREE.Color(0xd0d0d0), cOn = new THREE.Color(0x131313);
  const cToolIdle = new THREE.Color(0xc9c9c9), cBox = new THREE.Color();

  function enter(i) { gl[BEATS[i].hi] = 1; }

  return {
    view: { target: [0.2, -0.25, 0], radius: 40, theta: 0.34, phi: 1.02, size: 1.75 },

    update(dt) {
      clock += dt;
      if (stepReq) { stepReq = false; playing = false; bi = (bi + 1) % NB; bt = 1; enter(bi); }
      if (playing) {
        bt += dt / DT;
        while (bt >= 1) { bt -= 1; bi = (bi + 1) % NB; enter(bi); }
      }
      const b = BEATS[bi];
      const shown = VIS0[bi] + (b.show >= 0 && bt > 0.55 ? 1 : 0);

      for (const k in gl) gl[k] += (0 - gl[k]) * ease(dt, 1.6);
      rv += ((revealOn ? 1 : 0) - rv) * ease(dt, 7);

      // stations
      at(labYou, X.you, FLOOR + 0.48, 0.2);
      at(labHar, X.har, FLOOR + 1.42, 0.1);
      at(labMod, X.mod, FLOOR + 2.0 - 0.6 * rv, 0.1, 1 - rv);
      at(labW, X.mod, FLOOR + 1.13 - 0.35 * rv, 0.19, 1 - rv);
      at(labSlot, X.mod + 0.35, FLOOR + 1.56, 0.2, 1 - rv * 0.5);
      at(labFile, FILE_P[0], FILE_P[1] + 0.3, FILE_P[2]);
      at(labConv, -0.72, FLOOR - 0.34, ZF);
      at(labSyn, 1.0, FLOOR - 0.32, ZF);
      at(labWall, X.mod, FLOOR + 2.05, 0.3, rv);
      labTools.forEach((sp, i) => at(sp, X.tool, TOOL_P[['search', 'kubectl', 'git'][i]][1] + TOOL_S / 2 + 0.42, 0.05));

      // the harness runner bar: dark ONLY while the harness is doing work (never while the model "thinks")
      const busy = Math.max(gl.kubectl, gl.git, gl.file, gl.search, gl.harness * 0.5, rv * 0.35);
      runner.material.color.copy(cIdle).lerp(cOn, Math.min(1, busy * 1.6 + rv * 0.25));
      harFill.material.opacity = 0.09 + 0.05 * busy;

      // the model box: lights while it writes text; the weights never do
      modFill.material.opacity = 0.07 + 0.1 * Math.min(1, (gl.model + gl.slot) * 1.2);
      slot.material.color.copy(cIdle).lerp(cOn, Math.min(1, gl.slot * 1.4));
      for (const w of weights) w.material.color.setHex(0x101010);      // visibly, stubbornly static

      // tool boxes go dark while the harness runs them; "web search" is idle for the whole trace
      for (const k of ['search', 'kubectl', 'git']) {
        const t = tools[k];
        t.material.color.copy(cToolIdle).lerp(cOn, Math.min(1, gl[k] * 1.5));
        const s = 1 + 0.12 * gl[k];
        t.scale.set(s, s, s);
      }
      // the file sheet darkens as the harness writes it (its ruled lines ink in)
      sheet.material.color.copy(cIdle).lerp(cOn, Math.min(1, gl.file * 1.2));
      lines.forEach((l, i) => l.material.color.copy(cIdle).lerp(cOn,
        Math.min(1, Math.max(0, gl.file * 3 - i * 0.7))));

      // the toggle: wall + text pipes up, harness→tool lines down
      wallFace.material.opacity = 0.17 * rv;
      wall.visible = rv > 0.02;
      mText.opacity = 0.3 + 0.45 * rv;
      pipeOut.material.opacity = mText.opacity;
      for (const t of toolLines) t.material.opacity = 0.2 * (1 - 0.8 * rv);
      harFill.material.opacity += 0.06 * rv;

      // conversation: the strip grows; the newest tile carries its kind label
      tiles.forEach((t, i) => {
        const want = i < shown ? 1 : 0;
        t.grow += (want - t.grow) * ease(dt, i === shown - 1 ? 9 : 12);
        const pop = i === shown - 1 && bt > 0.55 ? 1 + 0.25 * Math.max(0, 1 - (bt - 0.55) * 4) : 1;
        const s = Math.max(t.grow, 0.001) * pop;
        t.mesh.scale.setScalar(s);
        t.mesh.visible = t.grow > 0.02;
        if (t.edge) { t.edge.scale.setScalar(s); t.edge.visible = t.grow > 0.02; }
      });
      const newest = Math.max(1, shown - 1);
      const nk = MSGS[newest].kind, nl = kindLabs[nk], np = tileP(newest);
      at(nl, np[0] + 0.04, FLOOR - 0.68, ZF + 0.06);
      for (const k in kindLabs) if (k !== nk) at(kindLabs[k], 0, -99, 0, 0.0001);

      // the packet: a dark cube (with a short trail) walking this hop's segment
      vA.set(...b.from); vB.set(...b.to);
      const p = clamp01(bt / 0.9);
      for (let i = 0; i < TRAIL; i++) {
        const u = p - i * 0.07;
        if (u <= 0 || p >= 0.99) { PP.set(0, -99, 0); pk.setMatrixAt(i, MM.compose(PP, PQ, PS.setScalar(0.001))); continue; }
        PP.copy(vA).lerp(vB, u);
        PP.y += 0.16 * Math.sin(Math.PI * u);
        pk.setMatrixAt(i, MM.compose(PP, PQ, PS.setScalar(Math.max(0.02, (1 - i / TRAIL) * 1.0) * (i === 0 ? 1.25 : 1))));
      }
      pk.instanceMatrix.needsUpdate = true;

      out({
        playing, turn: b.turn, hop: bi + 1, of: NB, messages: shown, reveal: revealOn,
        readout: `turn ${b.turn} of 4 · ${rv > 0.5 ? 'text in, text out · harness runs tools' : b.txt} · context ${shown} messages`,
      });
    },

    action(name, arg) {
      if (name === 'play') { playing = typeof arg === 'boolean' ? arg : !playing; if (playing && bt >= 1) { bt = 0; bi = (bi + 1) % NB; enter(bi); } }
      else if (name === 'step') stepReq = true;
      else if (name === 'turn') {
        const n = Math.min(4, Math.max(1, Number(arg) || 1));
        bi = TURN0[n - 1]; bt = 0; playing = true; enter(bi);
      } else if (name === 'reveal') revealOn = arg === true;
    },
  };
}
