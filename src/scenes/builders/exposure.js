// Scene `exposure` — teacher-forced training vs free-running serving (home-k8s #80: exposure gap).
//
// Two identical draft rails of N slots. A thin link shows *what the drafter was fed* as the
// previous token — the whole difference between the two rows.
//   top rail    (training / teacher-forced): every slot is conditioned on the TRUE previous token,
//                taken from the reference row above → a bad guess stays local, the next slot sees
//                the answer again and recovers.
//   bottom rail (serving / free-running):    every slot is conditioned on the drafter's OWN
//                previous guess → the first wrong tile poisons the link into the next one and the
//                whole tail of the draft is wrong, so the accepted run stops at the mistake.
// Dark solid tile = draft token the verifier would accept; pale tile with a dark outline = wrong
// guess (hollow = nothing there); X marks the first mistake; the dark bar under each rail is the
// accepted run. Bars/links grow left→right, hold, reset.
//
// The counts are NOT measurements: they are an illustrative draft pattern for one position of one
// request. Real serving still runs the target verifier, so a bad draft costs wasted work — it does
// not put wrong tokens in the output. Sources: home-k8s #80 (teacher-forced vs free-running gap),
// #72 (teacher-forced train/accept_len ≈ 2.0, not a speedup), Arnold et al. 1991 (teacher forcing).
import { THREE, lam, ghost, M, Q, P, S, ease, emitter } from './_kit.js';

const N = 8;                          // draft slots per rail (block-drafting length, illustrative)
const PITCH = 0.78, TILE = 0.54, TDEP = 0.3;
const X0 = -((N - 1) * PITCH) / 2;    // first slot x
const Y_REF = 1.62, Y_TOP = 0.22, Y_BOT = -1.68;   // reference row / training rail / serving rail
const XP = X0 - 0.62;                 // verified prefix (prompt) block
const Z_LINK = 0.34, Z_BACK = -TDEP / 2 - 0.07;
const LANE_Y = 0.34;                  // links run just above their rail
const SPEED = 1.0, HOLD = 2.2;        // ~8 s sweep + ~2 s hold

const xOf = i => X0 + i * PITCH;
const c01 = t => (t < 0 ? 0 : t > 1 ? 1 : t);
const ss = t => { const x = c01(t); return x * x * (3 - 2 * x); };

export default function build(scene, emit) {
  const out = emitter(emit);

  // ── rail tracks ────────────────────────────────────────────────────────
  const span = (N - 1) * PITCH + TILE + 0.28;
  for (const y of [Y_TOP, Y_BOT]) {
    const g = new THREE.BoxGeometry(span, 0.05, TDEP + 0.4);
    const track = new THREE.Mesh(g, ghost(0x8a8a8a, 0.16));
    track.position.set(0, y - TILE / 2 - 0.09, 0);
    const edge = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(span, 0.1, TDEP + 0.4)),
      new THREE.LineBasicMaterial({ color: 0x9f9f9f }));
    edge.position.copy(track.position);
    scene.add(track, edge);
  }

  // ── verified prefix the first draft token of each rail is conditioned on ──────
  const prompts = [];
  for (const y of [Y_REF, Y_BOT]) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(TILE * 0.78, TILE * 0.78, TDEP), lam(0x171717));
    b.position.set(XP, y, 0);
    scene.add(b); prompts.push(b);
  }

  // ── reference row: the target model's true tokens (the answer key) ────────────
  const refs = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), lam(0x3f3f3f), N);
  refs.frustumCulled = false;
  scene.add(refs);

  // ── draft tiles: dark solid = accepted, pale + outline = wrong (hollow) ───────
  const tiles = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), lam(0xffffff), 2 * N);
  tiles.frustumCulled = false;
  scene.add(tiles);
  const cOk = new THREE.Color(0x151515), cBad = new THREE.Color(0xdbdbdb), cTmp = new THREE.Color();

  const outlines = [];
  for (let i = 0; i < 2 * N; i++) {
    const o = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(TILE * 1.1, TILE * 1.1, TDEP * 1.12)),
      new THREE.LineBasicMaterial({ color: 0x141414 }));
    o.scale.setScalar(0.001);
    o.visible = false;
    scene.add(o); outlines.push(o);
  }

  // ── conditioning links (one per slot per rail) ────────────────────────────────
  const linkGeo = new THREE.BoxGeometry(1, 1, 1);
  const links = [[], []];
  for (let r = 0; r < 2; r++) {
    for (let i = 0; i < N; i++) {
      const m = new THREE.Mesh(linkGeo, lam(0x1b1b1b));
      m.scale.set(0.001, 0.001, 0.001);
      scene.add(m); links[r].push(m);
    }
  }
  /** grow a thin bar from A toward B (source→target = what conditions on what) */
  function bar(mesh, ax, ay, bx, by, thick, grow, z = Z_LINK) {
    const dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy) || 1;
    const ux = dx / len, uy = dy / len, L = Math.max(len * grow, 0.001);
    mesh.position.set(ax + ux * L / 2, ay + uy * L / 2, z);
    mesh.rotation.z = Math.atan2(dy, dx);
    mesh.scale.set(L, thick, 0.05);
  }

  // ── accepted runs: bar under the serving rail, ticks under each correct training slot ──
  const RUN_Y = { top: Y_TOP - TILE / 2 - 0.3, bot: Y_BOT - TILE / 2 - 0.3 };
  const runBar = new THREE.Mesh(new THREE.BoxGeometry(1, 0.11, 0.24), lam(0x141414));
  const runTrack = new THREE.Mesh(new THREE.BoxGeometry(span, 0.07, 0.2), ghost(0x8f8f8f, 0.14));
  runTrack.position.set(0, RUN_Y.bot, 0);
  const ticks = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), lam(0x2a2a2a), N);
  ticks.frustumCulled = false;
  scene.add(runTrack, runBar, ticks);

  // ── first mistake: X on the serving tile + a post up to the same slot in training ─────
  const mark = new THREE.Group();
  const crossMat = lam(0x101010);
  for (const a of [0.79, -0.79]) {
    const c = new THREE.Mesh(new THREE.BoxGeometry(TILE * 1.5, 0.075, 0.06), crossMat);
    c.rotation.z = a; mark.add(c);
  }
  mark.position.set(X0, Y_BOT, TDEP / 2 + 0.12);
  mark.scale.setScalar(0.001);
  scene.add(mark);
  const post = new THREE.Mesh(new THREE.BoxGeometry(0.055, 1, 0.05), lam(0x1f1f1f));
  scene.add(post);

  // ── labels (short; the rest of the labelling is in the readout) ───────────────
  const mkLabel = (text, x, y, h = 0.3) => {
    const cv = document.createElement('canvas'), g = cv.getContext('2d');
    const font = 'bold 54px ui-monospace, "DejaVu Sans Mono", monospace';
    g.font = font;
    const w = Math.max(24, Math.ceil(g.measureText(text).width)) + 14;
    cv.width = w; cv.height = 72;
    g.font = font; g.fillStyle = '#151515'; g.textBaseline = 'middle';
    g.fillText(text, 7, 40);
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, depthTest: false }));
    sp.scale.set(h * (w / 72), h, 1);
    sp.position.set(x, y, Z_LINK + 0.2);
    scene.add(sp);
    return sp;
  };
  mkLabel('target', xOf(N - 1) + 0.92, Y_REF, 0.28);
  mkLabel('training', xOf(N - 1) + 1.02, Y_TOP, 0.28);
  mkLabel('serving', xOf(N - 1) + 1.02, Y_BOT, 0.28);

  // ── state ──────────────────────────────────────────────────────────────
  let playing = true, p = 0, hold = 0, stepReq = false;
  let err = 2, showRefs = true;
  const cur = {
    tile: new Float32Array(2 * N).fill(0.001),
    link: new Float32Array(2 * N).fill(0.001),
    out: new Float32Array(2 * N).fill(0.001),
    ref: new Float32Array(N).fill(1),
    tick: new Float32Array(N).fill(0.001),
    run: 0.001, mark: 0.001, post: 0.001, refs: 1,
  };

  // which slots are wrong *given the true prefix*: the first serving mistake (f) + one later
  // intrinsic drafting miss (slot 5). Teacher-forced accept = N - 2 = 6/8 for every f here.
  const TF_MISS = 5;
  const fOf = () => err - 1;
  const okTop = i => { const f = fOf(); return i !== f && i !== TF_MISS; };
  const okBot = i => i < fOf();                 // everything after the first mistake is wrong
  const tfAccept = () => N - (fOf() === TF_MISS ? 1 : 2);

  return {
    view: { target: [0, -0.05, 0], radius: 40, theta: 0.17, phi: 1.45, size: 3.3 },
    update(dt) {
      if (stepReq) { stepReq = false; playing = false; p = Math.min(N, Math.floor(p + 1e-6) + 1); hold = 0; }
      if (playing) {
        if (p < N) p = Math.min(N, p + dt * SPEED);
        else { hold += dt; if (hold >= HOLD) { hold = 0; p = 0; } }
      }
      const f = fOf();
      const k = ease(dt, 9);

      // reference row (answer key) visibility
      cur.refs += ((showRefs ? 1 : 0.001) - cur.refs) * ease(dt, 7);
      for (let i = 0; i < N; i++) {
        cur.ref[i] += (cur.refs - cur.ref[i]) * k;
        const s = Math.max(cur.ref[i], 0.001);
        P.set(xOf(i), Y_REF, 0); S.set(TILE * 0.9 * s, 0.14 * s, TDEP * 0.9 * s);
        refs.setMatrixAt(i, M.compose(P, Q, S));
      }
      refs.instanceMatrix.needsUpdate = true;

      for (let r = 0; r < 2; r++) {
        const y = r === 0 ? Y_TOP : Y_BOT;
        for (let i = 0; i < N; i++) {
          const ok = (r === 0 ? okTop(i) : okBot(i));
          const oIdx = r * N + i;
          const gT = ss((p - i - 0.42) / 0.55);                 // tile after its link has drawn
          const gL = ss((p - i) / 0.5);
          cur.tile[oIdx] += (gT - cur.tile[oIdx]) * k;
          cur.link[oIdx] += (gL - cur.link[oIdx]) * k;
          const s = Math.max(cur.tile[oIdx], 0.001);
          P.set(xOf(i), y, 0); S.set(TILE * s, TILE * s, TDEP * s);
          tiles.setMatrixAt(oIdx, M.compose(P, Q, S));
          tiles.setColorAt(oIdx, cTmp.copy(ok ? cOk : cBad));

          // outline only on wrong tiles (hollow = the draft token is not the one the target took)
          const oTgt = ok ? 0.001 : Math.max(gT, 0.001);
          cur.out[oIdx] += (oTgt - cur.out[oIdx]) * k;
          const os = Math.max(cur.out[oIdx], 0.001);
          const o = outlines[oIdx];
          o.visible = os > 0.02; o.scale.setScalar(os); o.position.set(xOf(i), y, 0);

          // conditioning link: top rail fed by the reference row, serving rail fed by itself
          const src = i === 0 ? XP : xOf(i - 1);
          const link = links[r][i];
          if (r === 0) {
            const vis = showRefs ? 1 : 0;
            bar(link, src + 0.14, Y_REF - 0.13, xOf(i) - 0.14, y + LANE_Y, 0.055,
              Math.max(0.001, cur.link[oIdx] * vis), Z_LINK);
            link.visible = cur.link[oIdx] * vis > 0.02;
          } else {
            bar(link, src + 0.24, y + LANE_Y, xOf(i) - 0.24, y + LANE_Y, 0.055, cur.link[oIdx]);
            link.visible = cur.link[oIdx] > 0.02;
            // a link coming out of a wrong guess carries garbage, not a token
            link.material.color.set(i > f ? 0x8f8f8f : 0x1b1b1b);
          }
        }
      }
      tiles.instanceMatrix.needsUpdate = true;
      if (tiles.instanceColor) tiles.instanceColor.needsUpdate = true;

      // accepted run under the serving rail: stops dead at the first wrong tile
      const nRun = c01(Math.min(p, f));
      const wRun = nRun > 0.02 ? nRun * PITCH - 0.14 : 0.001;
      cur.run += (wRun - cur.run) * k;
      const rw = Math.max(cur.run, 0.001);
      runBar.scale.set(rw, 1, 1);
      runBar.position.set(X0 - TILE / 2 + 0.07 + rw / 2, RUN_Y.bot, 0);

      // teacher-forced rail: ticks mark correct slots (no cascade — each sees the true prefix)
      for (let i = 0; i < N; i++) {
        const t = okTop(i) ? ss((p - i - 0.42) / 0.55) : 0.001;
        cur.tick[i] += (t - cur.tick[i]) * k;
        const s = Math.max(cur.tick[i], 0.001);
        P.set(xOf(i), RUN_Y.top, 0); S.set(TILE * 0.7 * s, 0.12 * s, 0.26 * s);
        ticks.setMatrixAt(i, M.compose(P, Q, S));
      }
      ticks.instanceMatrix.needsUpdate = true;

      // the first mistake, and how the same slot behaves in training
      const gm = ss((p - f - 0.5) / 0.5);
      cur.mark += (gm - cur.mark) * k;
      mark.scale.setScalar(Math.max(cur.mark, 0.001));
      mark.position.x = xOf(f);
      const gp = ss((p - f - 0.65) / 0.6);
      cur.post += (gp - cur.post) * k;
      const ps = Math.max(cur.post, 0.001);
      const pyA = Y_TOP - TILE / 2 - 0.02, pyB = Y_BOT + TILE / 2 + 0.02;
      post.scale.set(1, Math.max(0.001, (pyA - pyB) * ps), 1);
      post.position.set(xOf(f), pyB + (pyA - pyB) * ps / 2, Z_BACK);

      out({
        playing, error: err, refs: showRefs, accept_tf: tfAccept(), accept_fr: f,
        readout: `teacher-forced accept ${tfAccept()}/${N} · free-running accept ${f}/${N} (illustrative)`,
      });
    },
    action(name, arg) {
      if (name === 'play') { playing = !playing; hold = 0; }
      else if (name === 'step') { stepReq = true; }
      else if (name === 'error') { err = [1, 2, 4].includes(Number(arg)) ? Number(arg) : 2; p = 0; hold = 0; }
      else if (name === 'refs') { showRefs = !!arg; }
      else if (name === 'reset') { p = 0; hold = 0; }
    },
  };
}
