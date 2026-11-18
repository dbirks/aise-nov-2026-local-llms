// Deck v2 `prefix-cache` variant B — agent request strips stacked in depth, one shared KV row.
//
// Mechanism (docs/research/v2/kv-serving.md §prefix-cache): requests that start with the same
// tokenized run can reuse the KV already computed for it, so the engine only prefills what differs.
// Toy prompt set: shared start = 12 tokens (system prompt + tools), each agent's own tail = 3 tokens.
// Prefill work (tokens) = 12 + 3·agents with caching, 15·agents without — the drawing's counter is
// that arithmetic, nothing measured. x = token position, z = the separate agents, y = stacking.
// Strips (request tokens) are flat tiles; KV is a taller block with a light cap; arrows say
// "this strip's work lives in that block".
import { THREE, lam, ghost, M, Q, P, S, emitter } from './_kit.js';

const SHARED = 12, TAIL = 3, TOTAL = 15, MAXN = 4;
const PITCH = 0.33;
const xs = i => (i - (TOTAL - 1) / 2) * PITCH;
const GAP = 2.7;                    // seconds between agent arrivals
const RISE = 0.45;                  // strip fade-in
const PT = 0.1;                     // seconds of screen time per prefilled token
const HOLD = 2.8;

const clamp01 = v => Math.max(0, Math.min(1, v));
const TH = 0.48, PHI = 1.12;   // camera angles, mirrored by the screen-space label placement
const RV = new THREE.Vector3(Math.cos(TH), 0, -Math.sin(TH));
const DV = new THREE.Vector3(Math.sin(PHI) * Math.sin(TH), Math.cos(PHI), Math.sin(PHI) * Math.cos(TH));
const UV = new THREE.Vector3().crossVectors(DV, RV);
const TGT = new THREE.Vector3(0.2, 0.7, 0);   // view target, kept in sync with `view` below

export default function build(scene, emit) {
  const out = emitter(emit);
  const box = new THREE.BoxGeometry(1, 1, 1);

  // ── labels ──
  // Labels sit at z = 0 and are placed by SCREEN height (world units above the view target): the
  // camera is elevated and turned, so scene depth drifts down-left and world-y text would collide.
  function label(text, sx, sy, h = 0.34) {
    const cv = document.createElement('canvas');
    const g = cv.getContext('2d');
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.minFilter = THREE.LinearFilter;
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false }));
    sp.renderOrder = 10;
    sp.position.set(x, y, z);
    scene.add(sp);
    const rec = {
      sp,
      text: '',
      set(t) {
        rec.text = String(t);
        const font = 'bold 72px "Jersey 15", ui-monospace, monospace';
        const lines = rec.text.split('\n');
        g.font = font;
        cv.width = Math.ceil(Math.max(...lines.map(l => g.measureText(l).width)) + 16);
        const lh = 88;
        cv.height = Math.ceil(lines.length * lh);
        g.font = font;
        g.textBaseline = 'middle';
        g.fillStyle = '#0d0d0d';
        lines.forEach((l, i) => g.fillText(l, 8, i * lh + lh / 2));
        tex.needsUpdate = true;
        sp.scale.set((h * cv.width) / cv.height, h, 1);
      },
    };
    rec.at = (sx, sy) => sp.position.copy(TGT).addScaledVector(RV, sx).addScaledVector(UV, sy);
    rec.set(text);
    rec.at(sx, sy);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => rec.set(rec.text)).catch(() => {});
    return rec;
  }

  // ── strips: shared start = dark cubes, own tail = light diamonds (different shape, not shade alone) ──
  const sharedTile = new THREE.InstancedMesh(box, lam(0x1e1e1e), MAXN * SHARED);
  const tailTile = new THREE.InstancedMesh(box, lam(0xd2d2d2), MAXN * TAIL);
  scene.add(sharedTile, tailTile);
  const QD = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.PI / 4, 0));

  // ── KV: one shared row (z = 0, high) + one copy row per agent (share off) + per-agent tail KV ──
  const kvMat = lam(0x131313), capMat = lam(0x9a9a9a);
  const mkKv = n => {
    const body = new THREE.InstancedMesh(box, kvMat, n), cap = new THREE.InstancedMesh(box, capMat, n);
    body.frustumCulled = false; cap.frustumCulled = false;
    scene.add(body, cap);
    return { body, cap };
  };
  const hide = m => m.setMatrixAt(0, M.compose(P.set(0, -60, 0), Q, S.set(0.001, 0.001, 0.001)));
  const kvShared = mkKv(SHARED);
  const kvCopies = mkKv(MAXN * SHARED);
  const kvTails = mkKv(MAXN * TAIL);
  for (let i = 0; i < SHARED; i++) hide(kvShared.body), hide(kvShared.cap);
  for (let i = 0; i < MAXN * SHARED; i++) hide(kvCopies.body), hide(kvCopies.cap);
  for (let i = 0; i < MAXN * TAIL; i++) hide(kvTails.body), hide(kvTails.cap);

  // ── arrows: strip → the KV it lives in ──
  const arrowMat = lam(0x2a2a2a);
  const UP = new THREE.Vector3(0, 1, 0);
  const arrows = [];
  for (let a = 0; a < MAXN * 2; a++) {
    const grp = new THREE.Group();
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 1, 8), arrowMat);
    const head = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.2, 10), arrowMat);
    grp.add(shaft, head);
    grp.visible = false;
    scene.add(grp);
    arrows.push({ grp, shaft, head });
  }
  function setArrow(g, from, to) {
    const dir = new THREE.Vector3(to[0] - from[0], to[1] - from[1], to[2] - from[2]);
    const len = dir.length();
    if (len < 0.05) { g.grp.visible = false; return; }
    g.grp.visible = true;
    dir.normalize();
    g.grp.position.set(from[0], from[1], from[2]);
    g.grp.quaternion.setFromUnitVectors(UP, dir);
    g.shaft.scale.set(1, Math.max(0.02, len - 0.2), 1);
    g.shaft.position.y = (len - 0.2) / 2;
    g.head.position.y = len - 0.1;
  }

  // ── prefill work bar per agent (drawn just under its own strip) ──
  const bars = [];
  for (let a = 0; a < MAXN; a++) {
    const m = new THREE.Mesh(box, lam(0x171717));
    m.visible = false;
    scene.add(m);
    bars.push(m);
  }

  // ── counter panel ──
  const topLab = label('shared KV blocks', 0, 2.4);
  const usedLab = label('used by 3', 2.6, 1.74, 0.3);
  label('system prompt + tools', -1.25, -1.0);
  label('own question', 2.05, -1.0);
  const workLab = label('prefill work: 21 tokens', 1.3, -1.55, 0.36);
  const meterTrack = new THREE.Mesh(box, ghost(0x5a5a5a, 0.26));
  meterTrack.scale.set(3.0, 0.04, 0.14);
  meterTrack.position.set(1.45, -1.5, 0);
  const meterBar = new THREE.Mesh(box, lam(0x141414));
  meterBar.scale.set(1, 0.16, 0.22);
  meterBar.position.set(0.5, -1.5, 0);
  scene.add(meterTrack, meterBar);

  let share = true, n = 3, playing = true, clock = 0, stepReq = false;

  function agentTime(a) { return (share && a > 0 ? TAIL : TOTAL) * PT; }
  function agentProg(a, t) { return clamp01((t - (a * GAP + RISE)) / agentTime(a)); }
  function workFront(a, t) {
    const p = agentProg(a, t);
    const from = (share && a > 0 ? xs(SHARED) : xs(0)) - PITCH;
    return from + (xs(TOTAL - 1) + PITCH * 1.2 - from) * p;
  }

  return {
    view: { target: [0.2, 0.7, 0], radius: 40, theta: TH, phi: PHI, size: 2.5 },
    update(dt) {
      const loop = n * GAP + HOLD;
      if (playing) { clock += dt; if (clock >= loop) clock -= loop; }
      if (stepReq) {
        stepReq = false; playing = false;
        const a = Math.floor(clock / GAP) + 1;
        clock = a * GAP >= loop ? 0 : Math.min(loop - 0.05, a * GAP + RISE + agentTime(Math.min(a, n - 1)));
      }
      let totalWork = 0, arrived = 0;

      for (let a = 0; a < MAXN; a++) {
        const on = a < n;
        const rise = on ? clamp01((clock - a * GAP) / RISE) : 0;
        const zc = (a - (n - 1) / 2) * 0.8;
        const front = workFront(a, clock);
        const work = agentProg(a, clock) * ((share && a > 0) ? TAIL : TOTAL);
        totalWork += work;
        if (rise > 0.5) arrived++;

        for (let j = 0; j < SHARED; j++) {
          const s = rise * (0.2 + 0.8 * clamp01((front - xs(j)) / PITCH + 1));
          const w = Math.max(0.001, 0.26 * (on ? s : 0.001));
          sharedTile.setMatrixAt(a * SHARED + j, M.compose(P.set(xs(j), 0.72, on ? zc : -60), Q, S.set(w, w, 0.22 * s)));
        }
        for (let j = 0; j < TAIL; j++) {
          const s = rise * (0.2 + 0.8 * clamp01((front - xs(SHARED + j)) / PITCH + 1));
          const w = Math.max(0.001, 0.24 * (on ? s : 0.001));
          tailTile.setMatrixAt(a * TAIL + j, M.compose(P.set(xs(SHARED + j), 0.72, on ? zc : -60), QD, S.set(w, w, 0.2 * s)));
        }
        // own tail KV blocks
        for (let j = 0; j < TAIL; j++) {
          const g = clamp01((front - xs(SHARED + j)) / PITCH);
          const id = a * TAIL + j;
          if (!on || g <= 0) { kvTails.body.setMatrixAt(id, HIDE); kvTails.cap.setMatrixAt(id, HIDE); continue; }
          kvTails.body.setMatrixAt(id, M.compose(P.set(xs(SHARED + j), 1.62, zc), Q, S.set(0.24, 0.34 * g, 0.24)));
          kvTails.cap.setMatrixAt(id, M.compose(P.set(xs(SHARED + j), 1.62 + 0.17 * g + 0.05, zc), Q, S.set(0.28, 0.05, 0.28)));
        }
        // prefill bar: only over what this agent actually computed
        const bar = bars[a];
        bar.visible = on && rise > 0.2;
        if (bar.visible) {
          const x0 = share && a > 0 ? xs(SHARED) - PITCH * 0.6 : xs(0) - PITCH * 0.6;
          const w = Math.max(0.002, (front - x0));
          bar.scale.set(w, 0.08, 0.1);
          bar.position.set(x0 + w / 2, 0.4, zc);
        }
        // arrows
        const a0 = arrows[a * 2], a1 = arrows[a * 2 + 1];
        if (!(on && rise > 0.6)) { a0.grp.visible = false; a1.grp.visible = false; }
        else {
          const ay = share ? 2.42 : 1.12, az = share ? 0 : zc;
          setArrow(a0, [xs(1), 0.9, zc], [xs(1), ay, az]);
          setArrow(a1, [xs(SHARED - 2), 0.9, zc], [xs(SHARED - 2), ay, az]);
        }

        // own copies of the shared part when caching is off
        for (let j = 0; j < SHARED; j++) {
          const g = share ? 0 : clamp01((front - xs(j)) / PITCH);
          const id = a * SHARED + j;
          if (!on || g <= 0) { kvCopies.body.setMatrixAt(id, HIDE); kvCopies.cap.setMatrixAt(id, HIDE); continue; }
          kvCopies.body.setMatrixAt(id, M.compose(P.set(xs(j), 1.28, zc), Q, S.set(0.24, 0.28 * g, 0.22)));
          kvCopies.cap.setMatrixAt(id, M.compose(P.set(xs(j), 1.28 + 0.14 * g + 0.045, zc), Q, S.set(0.27, 0.045, 0.25)));
        }
      }
      [sharedTile, tailTile, kvTails.body, kvTails.cap, kvCopies.body, kvCopies.cap].forEach(m => { m.instanceMatrix.needsUpdate = true; });

      // the shared row exists only while caching is on; it grows with the first agent
      const f0 = workFront(0, clock);
      for (let j = 0; j < SHARED; j++) {
        const g = share ? clamp01((f0 - xs(j)) / PITCH) : 0;
        if (g <= 0) { kvShared.body.setMatrixAt(j, HIDE); kvShared.cap.setMatrixAt(j, HIDE); continue; }
        kvShared.body.setMatrixAt(j, M.compose(P.set(xs(j), 2.62, 0), Q, S.set(0.24, 0.38 * g, 0.24)));
        kvShared.cap.setMatrixAt(j, M.compose(P.set(xs(j), 2.62 + 0.19 * g + 0.05, 0), Q, S.set(0.28, 0.05, 0.28)));
      }
      kvShared.body.instanceMatrix.needsUpdate = true;
      kvShared.cap.instanceMatrix.needsUpdate = true;

      const total = Math.round(totalWork);
      const cold = TOTAL * n, warm = SHARED + TAIL * n;
      topLab.set(share ? 'shared KV blocks' : 'one copy per agent');
      // when the copies sit low, name them from just above the back strip instead of the empty top
      topLab.at(0, share ? 2.4 : 1.55);
      usedLab.sp.visible = share;
      if (share) usedLab.set(`used by ${Math.max(1, arrived)}`);
      const frac = total / cold;
      meterBar.scale.set(Math.max(0.002, 3.0 * frac), 0.16, 0.22);
      meterBar.position.set(1.45 - 1.5 + (3.0 * frac) / 2, -1.5, 0);
      workLab.set(`prefill work: ${total} tokens`);

      out({
        playing, share, n,
        readout: `simulated · ${n} agents · prefill ${share ? warm : cold} tokens`
          + `${share ? ` (vs ${cold} without)` : ` (${warm} if shared)`}`,
      });
    },
    action(name, arg) {
      if (name === 'play') playing = typeof arg === 'boolean' ? arg : !playing;
      else if (name === 'step') stepReq = true;
      else if (name === 'share') { share = typeof arg === 'boolean' ? arg : !share; }
      else if (name === 'agents') { const v = Number(arg); if (v === 2 || v === 3 || v === 4) n = v; }
    },
  };
}

const HIDE = M.compose(P.set(0, -60, 0), Q, S.set(0.001, 0.001, 0.001));
