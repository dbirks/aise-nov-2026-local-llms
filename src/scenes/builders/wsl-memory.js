// Scene `wsl-memory` — "3 memories that look like one" (scene-lab brainstorm; README section
// "An especially good quick anecdote: memory and WSL").
//
// Three DIFFERENT quantities, drawn as three different places:
//   1. WSL2 VM memory as Windows counts it  → the height of the middle box, measured against the
//      dark host-limit bar at the top of the outer box (the outer box = physical host RAM).
//   2. Linux page cache                     → the light cube grid inside the VM box. It stacks ON
//      TOP of process memory, so it contributes to (1) while it is resident.
//   3. GPU VRAM                             → the separate box on the right: weights / runtime
//      buffers / KV cache stacked from its own floor. Nothing crosses into the host box.
// Heights inside each box are additive (y = bytes, one shared scale per box), so the VM box top is
// the sum of what is inside it — that is the whole point of the scene.
//
// Story loop (~11 s): read the checkpoint → (buffered) bytes pass through the page cache, the light
// grid grows and the VM box swells toward the host limit; (direct) the byte stream takes the
// front-face bypass and the light grid stays a stub. Then offload to VRAM → decode grows KV →
// pressure → the kernel reclaims the cache and the VM box drops back (cache is reclaimable, it is
// just not free until it is reclaimed).
//
// Accuracy: heights are ILLUSTRATIVE fractions of each container, not GiB; the ratio between the
// buffered and direct footprints is the mechanism, the absolute numbers are not. No measured
// readings, no flag names, no claim that Linux cached memory is unreclaimable, and direct I/O is
// shown only for this one load path (it is not "disable all caching"). The termination the speaker
// reports is shown as pressure rising toward the limit, not as a simulated crash.
import { THREE, lam, ghost, M, Q, P, S, ease, emitter } from './_kit.js';

// ── host box (physical RAM as Windows sees it) ──────────────────────────────
const HX0 = -3.05, HX1 = 0.55, HY0 = -1.95, HY1 = 1.92, HZ0 = -0.95, HZ1 = 0.95;
const OS_H = 0.26;                                  // windows + other apps (fixed share)
const B = HY0 + OS_H;                               // WSL2 VM base
const LIM = HY1 - 0.12;                             // host limit bar
const CAP = LIM - B;                                // room available to the VM
const VX0 = HX0 + 0.17, VX1 = HX1 - 0.17, VZ0 = HZ0 + 0.16, VZ1 = HZ1 - 0.16;
const PROC = 0.16 * CAP;                            // loader process + its buffers
const CACHE_BUF = 0.72 * CAP, CACHE_DIR = 0.10 * CAP;
const ROWS = 8, COLS = 11, ZN = 3;                  // light cache cells, row-major bottom-up
const CZ = [0.44, 0, -0.44];                        // cell depth rows, front first
const NCELL = ROWS * COLS * ZN, PERROW = COLS * ZN;
const CROW = CACHE_BUF / ROWS, CCOL = (VX1 - VX0) / COLS;

// ── gpu box (its own memory, separate container) ────────────────────────────
const GX0 = 1.72, GX1 = 4.05, GZ0 = HZ0 + 0.06, GZ1 = HZ1 - 0.06;
const GB = HY0 + 0.1, GC = (HY1 - 0.1) - GB;
const W_MAX = 0.44 * GC, BF_MAX = 0.07 * GC, KV_MAX = 0.34 * GC;
const GXm = (GX0 + GX1) / 2, VXm = (VX0 + VX1) / 2;

const BEATS = [['idle', 1], ['reading file', 2.4], ['offloading', 2], ['decoding', 2.4],
  ['near the limit', 1.6], ['reclaiming', 1.8]];
const START = [];
let accT = 0;
for (const [, d] of BEATS) { START.push(accT); accT += d; }
const TOTAL = accT;
const ss = x => { const u = Math.max(0, Math.min(1, x)); return u * u * (3 - 2 * u); };

/** dark text sprite (h = line height); chip=true puts a light plate behind it so it reads on dark slabs */
function mkLabel(text, h = 0.22, chip = false) {
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthWrite: false, depthTest: false }));
  const font = 'bold 56px ui-monospace, "DejaVu Sans Mono", monospace';
  const cv = document.createElement('canvas'), g = cv.getContext('2d');
  g.font = font;
  const w = Math.max(24, Math.ceil(g.measureText(text).width)) + (chip ? 26 : 14);
  cv.width = w; cv.height = 76;
  g.font = font;
  if (chip) { g.fillStyle = '#d8d8d8'; g.fillRect(0, 6, w, 64); }
  g.fillStyle = '#141414'; g.textBaseline = 'middle';
  g.fillText(text, chip ? 13 : 7, 40);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  sp.material.map = tex; sp.material.needsUpdate = true;
  sp.scale.set(h * (w / 76), h, 1);
  return sp;
}

/** straight polyline rail (byte streams follow kinks, not splines) + arc-length table */
function rail(pts) {
  const p2 = pts.map(p => new THREE.Vector3(p[0], p[1], p[2]));
  const len = [0];
  let L = 0;
  for (let i = 1; i < p2.length; i++) { L += p2[i].distanceTo(p2[i - 1]); len.push(L); }
  return { pts: p2, len, L };
}
function onRail(r, u, out) {
  const d = Math.max(0, Math.min(1, u)) * r.L;
  let i = 1;
  while (i < r.len.length - 1 && r.len[i] < d) i++;
  const seg = r.len[i] - r.len[i - 1];
  const t = seg > 1e-6 ? (d - r.len[i - 1]) / seg : 0;
  return out.copy(r.pts[i - 1]).lerp(r.pts[i], t);
}
function railLine(r, c, o) {
  const g = new THREE.BufferGeometry().setFromPoints(r.pts);
  return new THREE.Line(g, new THREE.LineBasicMaterial({ color: c, transparent: true, opacity: o }));
}

export default function build(scene, emit) {
  const out = emitter(emit);

  // ── host container ───────────────────────────────────────────────────────
  const hostFill = new THREE.Mesh(new THREE.BoxGeometry(HX1 - HX0, HY1 - HY0, HZ1 - HZ0), ghost(0xf2f2f2, 0.06));
  hostFill.position.set((HX0 + HX1) / 2, (HY0 + HY1) / 2, 0);
  const hostEdge = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(HX1 - HX0, HY1 - HY0, HZ1 - HZ0)),
    new THREE.LineBasicMaterial({ color: 0x111111 }));
  hostEdge.position.copy(hostFill.position);
  const osStrip = new THREE.Mesh(new THREE.BoxGeometry(HX1 - HX0 - 0.1, OS_H, HZ1 - HZ0 - 0.1), lam(0x4a4a4a));
  osStrip.position.set((HX0 + HX1) / 2, HY0 + OS_H / 2 + 0.01, 0);
  // the limit bar the VM swells toward: a stripe on the container wall, not a lid
  const limitBar = new THREE.Mesh(new THREE.BoxGeometry(HX1 - HX0 - 0.5, 0.07, 0.2), lam(0x141414));
  limitBar.position.set((HX0 + HX1) / 2, LIM, HZ1 - 0.12);
  scene.add(hostFill, hostEdge, osStrip, limitBar);

  // ── WSL2 VM box: height = everything inside it ───────────────────────────
  const vw = VX1 - VX0, vd = VZ1 - VZ0;
  const vmFill = new THREE.Mesh(new THREE.BoxGeometry(vw, 1, vd), ghost(0xdadada, 0.1));
  const vmEdge = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(vw, 1, vd)),
    new THREE.LineBasicMaterial({ color: 0x1a1a1a }));
  scene.add(vmFill, vmEdge);

  const proc = new THREE.Mesh(new THREE.BoxGeometry(vw - 0.12, 1, vd - 0.12), lam(0x1c1c1c));
  proc.position.set(VXm, B, 0);
  const cacheEdge = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(vw - 0.06, 1, vd - 0.04)),
    new THREE.LineBasicMaterial({ color: 0x2a2a2a }));
  scene.add(proc, cacheEdge);

  // light page-cache cells
  const cells = new THREE.InstancedMesh(new THREE.BoxGeometry(CCOL - 0.045, CROW - 0.06, 0.2), lam(0xe6e6e6), NCELL);
  cells.frustumCulled = false;
  scene.add(cells);
  const cellX = [], cellZ = [];
  for (let xi = 0; xi < COLS; xi++) cellX.push(VX0 + CCOL * (xi + 0.5));
  for (let zi = 0; zi < ZN; zi++) cellZ.push(CZ[zi]);

  // pressure band between the VM top and the host limit
  const pressFill = new THREE.Mesh(new THREE.BoxGeometry(vw - 0.06, 1, vd - 0.04), ghost(0x161616, 0));
  const pressEdge = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(vw - 0.06, 1, vd - 0.04)),
    new THREE.LineBasicMaterial({ color: 0x111111, transparent: true, opacity: 0 }));
  scene.add(pressFill, pressEdge);

  // ── GPU VRAM box (separate container, own floor and ceiling) ─────────────
  const gw = GX1 - GX0, gd = GZ1 - GZ0;
  const gpuFill = new THREE.Mesh(new THREE.BoxGeometry(gw, HY1 - HY0, gd), ghost(0xf2f2f2, 0.06));
  gpuFill.position.set(GXm, (HY0 + HY1) / 2, 0);
  const gpuEdge = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(gw, HY1 - HY0, gd)),
    new THREE.LineBasicMaterial({ color: 0x111111 }));
  gpuEdge.position.copy(gpuFill.position);
  const weights = new THREE.Mesh(new THREE.BoxGeometry(gw - 0.12, 1, gd - 0.12), lam(0x141414));
  const bufs = new THREE.Mesh(new THREE.BoxGeometry(gw - 0.12, 1, gd - 0.12), lam(0x8f8f8f));
  const kv = new THREE.Mesh(new THREE.BoxGeometry(gw - 0.12, 1, gd - 0.12), lam(0x5c5c5c));
  const kvEdge = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(gw - 0.06, 1, gd - 0.02)),
    new THREE.LineBasicMaterial({ color: 0x111111, transparent: true, opacity: 0.55 }));
  scene.add(gpuFill, gpuEdge, weights, bufs, kv, kvEdge);

  // ── checkpoint on disk ───────────────────────────────────────────────────
  const fx = -3.8;
  for (let i = 0; i < 3; i++) {
    const sheet = new THREE.Mesh(new THREE.BoxGeometry(0.7 - i * 0.04, 0.05, 0.78 - i * 0.04), lam([0xb4, 0xc8, 0xdc][i]));
    sheet.position.set(fx, HY0 + 0.06 + i * 0.055, 0);
    scene.add(sheet);
  }
  const fileEdge = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(0.8, 0.24, 0.9)),
    new THREE.LineBasicMaterial({ color: 0x111111 }));
  fileEdge.position.set(fx, HY0 + 0.11, 0);
  scene.add(fileEdge);

  // ── load paths: through the page cache, or past it (direct I/O) ──────────
  const yProc = B + PROC / 2, yCache = B + PROC + CACHE_BUF * 0.5;
  const RAILS = {
    // buffered: in through the wall, UP THROUGH the page-cache band, then down into the loader
    buffered: rail([[fx + 0.12, -1.74, 0], [HX0 + 0.02, -1.56, 0], [VX0 + 0.28, -0.9, 0],
      [VX0 + 0.6, yCache + 0.2, 0], [VXm, yCache + 0.2, 0], [VXm + 0.35, yProc + 0.03, 0], [VXm, yProc, 0.12]]),
    // direct i/o: the same bytes, routed along the front face below the cache band
    direct: rail([[fx + 0.12, -1.74, 0], [HX0 + 0.02, -1.62, 0.32], [VX0 + 0.22, yProc - 0.02, VZ1 - 0.08],
      [VXm + 0.35, yProc - 0.02, VZ1 - 0.08], [VXm, yProc, 0.12]]),
  };
  const RAILS_LINES = {};
  for (const k of Object.keys(RAILS)) scene.add(RAILS_LINES[k] = railLine(RAILS[k], 0x2a2a2a, 0.14));
  const RAIL_B = rail([[VX1 - 0.05, yProc, 0], [0.95, yProc - 0.04, 0], [1.35, -1.62, 0],
    [GX0 + 0.2, -1.72, 0], [GXm - 0.3, -1.74, 0]]);
  scene.add(railLine(RAIL_B, 0x2a2a2a, 0.16));

  const mkStream = (n, c) => {
    const m = new THREE.InstancedMesh(new THREE.BoxGeometry(0.115, 0.115, 0.115), lam(c), n);
    m.frustumCulled = false;
    scene.add(m);
    return m;
  };
  const streamA = mkStream(11, 0x161616), streamB = mkStream(9, 0x161616);
  const tokCubes = mkStream(3, 0x111111);

  // ── labels ───────────────────────────────────────────────────────────────
  const lHost = mkLabel('windows host', 0.24);
  lHost.position.set(-2.5, HY1 + 0.26, 0);
  const lLimit = mkLabel('host limit', 0.2);
  lLimit.position.set(1.3, LIM + 0.16, HZ1 - 0.14);
  const lVm = mkLabel('wsl2 vm', 0.23);          // tracks the vm fill line, outside the box
  const lCache = mkLabel('page cache', 0.21);
  const lProc = mkLabel('process memory', 0.2, true);
  const lGpu = mkLabel('gpu vram', 0.24);
  lGpu.position.set(3.2, HY1 + 0.26, 0);
  const lW = mkLabel('weights', 0.2, true), lB = mkLabel('buffers', 0.19, true), lKV = mkLabel('kv cache', 0.2, true);
  const lFile = mkLabel('checkpoint', 0.2, true);
  lFile.position.set(fx, HY0 - 0.3, 0);
  scene.add(lHost, lLimit, lVm, lCache, lProc, lGpu, lW, lB, lKV, lFile);

  // ── state ────────────────────────────────────────────────────────────────
  let mode = 'buffered', playing = true, t = 0, stepReq = false;
  let cacheH = 0, procH = 0, wH = 0, kvH = 0, bfH = 0, press = 0, cellF = 0;
  const cLimHot = new THREE.Color(0x111111), cLimCool = new THREE.Color(0x8f8f8f);

  function beatOf(x) {
    let i = 0;
    for (let k = 0; k < BEATS.length; k++) if (x >= START[k]) i = k;
    return i;
  }

  return {
    view: { target: [0.05, -0.08, 0], radius: 40, theta: 0.48, phi: 1.16, size: 3.35 },
    update(dt) {
      if (playing) t = (t + dt) % TOTAL;
      if (stepReq) { stepReq = false; playing = false; t = START[(beatOf(t) + 1) % BEATS.length] + 0.002; }
      const bi = beatOf(t), p = (t - START[bi]) / BEATS[bi][1];

      // targets: cache height is the fraction of *this loader's* footprint
      const cm = mode === 'buffered' ? CACHE_BUF : CACHE_DIR;
      let tc = 0, tp = 0, tw = 0, tk = 0, tb = 0, tpr = 0;
      if (bi === 1) { tc = ss(p); tp = ss(p * 1.1 - 0.08); }
      else if (bi === 2) { tc = 1; tp = 1; tw = ss(p); tb = ss(p); }
      else if (bi === 3) { tc = 1; tp = 1; tw = 1; tb = 1; tk = ss(p); }
      else if (bi === 4) { tc = 1; tp = 1; tw = 1; tb = 1; tk = 1; tpr = ss(p * 1.5); }
      else if (bi === 5) {
        const q = ss(p);
        tc = 1 - q; tp = 1 - ss(p * 1.2 - 0.15); tw = 1 - q; tb = 1 - q; tk = 1 - ss(p * 1.7);
      }

      const k = ease(dt, 6);
      cacheH += (tc * cm - cacheH) * k;
      procH += (tp * PROC - procH) * k;
      wH += (tw * W_MAX - wH) * k;
      kvH += (tk * KV_MAX - kvH) * k;
      bfH += (tb * BF_MAX - bfH) * k;
      press += (tpr - press) * ease(dt, 4);
      cellF += (cacheH / CROW * PERROW - cellF) * ease(dt, 8);

      const vmH = Math.max(0.02, procH + cacheH), vmTop = B + vmH, frac = vmH / CAP;

      // vm box + contents
      for (const o of [vmFill, vmEdge]) { o.scale.set(1, vmH, 1); o.position.set(VXm, B + vmH / 2, 0); }
      proc.scale.set(1, Math.max(0.002, procH), 1);
      proc.position.set(VXm, B + procH / 2, 0);
      const ch = Math.max(0.002, cacheH);
      cacheEdge.scale.set(1, ch, 1);
      cacheEdge.position.set(VXm, B + procH + ch / 2, 0);
      for (let i = 0; i < NCELL; i++) {              // fill front row first, bottom row first
        const s = Math.max(0.001, Math.min(1, cellF - i));
        P.set(cellX[i % COLS], B + procH + CROW * (Math.floor(i / PERROW) + 0.5), cellZ[Math.floor(i / COLS) % ZN]);
        S.set(s, s, s);
        cells.setMatrixAt(i, M.compose(P, Q, S));
      }
      cells.instanceMatrix.needsUpdate = true;

      // pressure band between the vm top and the host limit
      const po = Math.max(0, (frac - 0.68) / 0.3) * (0.55 + 0.45 * press) * (bi === 5 ? Math.max(0, 1 - ss(p * 1.4)) : 1);
      const ph = Math.max(0.002, LIM - vmTop);
      pressFill.scale.set(1, ph, 1); pressFill.position.set(VXm, vmTop + ph / 2, 0);
      pressEdge.scale.copy(pressFill.scale); pressEdge.position.copy(pressFill.position);
      pressFill.material.opacity = 0.14 * po;
      pressEdge.material.opacity = 0.9 * po;
      limitBar.material.color.copy(cLimCool).lerp(cLimHot, Math.max(0, Math.min(1, (frac - 0.6) / 0.35)));

      // labels that track their band
      lVm.position.set(-3.78, Math.max(B + 0.34, vmTop + 0.13), 0);
      lCache.position.set(VXm, B + procH + Math.max(ch, CROW) / 2, 0.12);
      lCache.visible = cacheH > CROW * 0.7;
      lProc.position.set(VXm, B + procH / 2, 0.1);
      lProc.visible = procH > PROC * 0.6;

      // gpu stack
      weights.scale.set(1, Math.max(0.002, wH), 1); weights.position.set(GXm, GB + wH / 2, 0);
      bufs.scale.set(1, Math.max(0.002, bfH), 1); bufs.position.set(GXm, GB + wH + bfH / 2, 0);
      const kvBase = GB + wH + bfH;
      kv.scale.set(1, Math.max(0.002, kvH), 1); kv.position.set(GXm, kvBase + kvH / 2, 0);
      kvEdge.scale.set(1, Math.max(0.002, kvH), 1); kvEdge.position.copy(kv.position);
      kvEdge.visible = kvH > 0.05;
      lW.position.set(GXm, GB + wH / 2, 0.1); lW.visible = wH > 0.35;
      lB.position.set(GXm, GB + wH + bfH / 2, 0.1); lB.visible = bfH > 0.16;
      lKV.position.set(GXm, kvBase + kvH / 2, 0.1); lKV.visible = kvH > 0.3;

      // load streams
      const fade = (cond) => (cond ? 1 : 0.001);
      const aVis = fade(bi === 1), bVis = fade(bi === 2);
      RAILS_LINES.buffered.material.opacity = mode === 'buffered' ? 0.36 : 0.06;
      RAILS_LINES.direct.material.opacity = mode === 'direct' ? 0.36 : 0.06;
      for (let i = 0; i < streamA.count; i++) {
        const u = ((p * 2.6 + i / streamA.count) % 1);
        onRail(RAILS[mode], u, P);
        const s = Math.max(0.001, aVis * Math.min(1, Math.sin(u * Math.PI) * 2.5));
        S.set(s, s, s);
        streamA.setMatrixAt(i, M.compose(P, Q, S));
      }
      streamA.instanceMatrix.needsUpdate = true;
      for (let i = 0; i < streamB.count; i++) {
        const u = ((p * 2.2 + i / streamB.count) % 1);
        onRail(RAIL_B, u, P);
        const s = Math.max(0.001, bVis * Math.min(1, Math.sin(u * Math.PI) * 2.5));
        S.set(s, s, s);
        streamB.setMatrixAt(i, M.compose(P, Q, S));
      }
      streamB.instanceMatrix.needsUpdate = true;
      for (let i = 0; i < tokCubes.count; i++) {           // new tokens landing in the kv stack
        const u = ((t / 1.15 + i / tokCubes.count) % 1);
        const s = Math.max(0.001, fade(bi === 3) * Math.min(1, Math.sin(u * Math.PI) * 2.2));
        P.set(GXm + 0.75 * (1 - u), HY1 + 0.1 - u * (HY1 + 0.1 - kvBase - kvH), 0.5 * (1 - u));
        S.set(s, s, s);
        tokCubes.setMatrixAt(i, M.compose(P, Q, S));
      }
      tokCubes.instanceMatrix.needsUpdate = true;

      const pct = Math.round(frac * 100), cp = vmH > 1e-4 ? Math.round(cacheH / vmH * 100) : 0;
      const vp = Math.round((wH + bfH + kvH) / GC * 100);
      out({
        playing, mode, beat: BEATS[bi][0],
        readout: `${BEATS[bi][0]} · vm ${pct}% of host limit · cache ${cp}% of vm · vram ${vp}%`,
      });
    },
    action(name, arg) {
      if (name === 'play') { playing = !playing; }
      else if (name === 'step') { playing = false; stepReq = true; }
      else if (name === 'loader') { mode = String(arg) === 'direct' ? 'direct' : 'buffered'; }
    },
  };
}
