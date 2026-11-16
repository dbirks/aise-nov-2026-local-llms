// Pixel-rendered three.js scenes for the local-LLM talk (examples 2a–2c, 3a–3c).
// Ported from the Claude Design handoff (design/handoff/pixel-scenes). See NOTES.md there for the
// render pipeline, options and per-scene API. Only change from the handoff: `three` comes from npm.
import * as THREE from 'three';

// Sage palettes, dark → light. Scene luminance is quantized onto these.
const PAL = {
  6: ['#1C2419', '#34412E', '#56684B', '#83957A', '#B3C1A5', '#DCE3D2'],
  4: ['#243020', '#5A6C4F', '#9DAE8E', '#DCE3D2'],
};
const hex3 = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255);

function rng(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const gaussFn = r => () => { let u = 0; while (!u) u = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * r()); };

function makePost() {
  const pal = Array.from({ length: 6 }, () => new THREE.Vector3());
  return new THREE.ShaderMaterial({
    uniforms: { tDiffuse: { value: null }, pal: { value: pal }, n: { value: 6 }, dither: { value: 1 } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }`,
    fragmentShader: `
      uniform sampler2D tDiffuse; uniform vec3 pal[6]; uniform float n; uniform float dither;
      vec3 ramp(float t){ float x = t * 5.0; vec3 c = pal[0];
        for (int i = 0; i < 5; i++) { float f = clamp(x - float(i), 0.0, 1.0); c = mix(c, pal[i+1], f); } return c; }
      varying vec2 vUv;
      float b2(vec2 a){ return 2.0*a.x + 3.0*a.y - 4.0*a.x*a.y; }
      float bayer4(vec2 p){ p = mod(floor(p), 4.0); return (4.0*b2(mod(p,2.0)) + b2(floor(p/2.0))) / 16.0; }
      void main(){
        vec3 c = texture2D(tDiffuse, vUv).rgb;
        float l = pow(clamp(dot(c, vec3(0.299, 0.587, 0.114)), 0.0, 1.0), 1.0/2.2);
        if (n > 1.5) {
          l = clamp(l + (bayer4(gl_FragCoord.xy) - 0.5) * dither / (n - 1.0), 0.0, 1.0);
          l = floor(l * (n - 1.0) + 0.5) / (n - 1.0);
        }
        gl_FragColor = vec4(ramp(l), 1.0);
      }`,
    depthTest: false, depthWrite: false,
  });
}

class Orbit {
  constructor(cam, el, v, iso) {
    this.cam = cam; this.iso = iso; this.def = v;
    this.target = new THREE.Vector3(...v.target);
    this.theta = this.tTheta = v.theta; this.phi = v.phi; this.r = v.radius;
    this.zoom = 1; this.idle = 99; this.auto = v.auto ?? 0;
    let drag = null;
    el.addEventListener('pointerdown', e => { drag = { x: e.clientX, y: e.clientY }; el.setPointerCapture(e.pointerId); el.style.cursor = 'grabbing'; this.idle = 0; });
    el.addEventListener('pointermove', e => {
      if (!drag) return;
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag = { x: e.clientX, y: e.clientY };
      this.tTheta -= dx * 0.01; this.theta = this.tTheta;
      this.phi = Math.min(1.5, Math.max(0.12, this.phi - dy * 0.01)); this.idle = 0;
    });
    const up = () => { drag = null; el.style.cursor = 'grab'; };
    el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
    el.addEventListener('wheel', e => {
      e.preventDefault();
      const f = Math.exp(e.deltaY * 0.0012);
      if (iso) this.zoom = Math.min(4, Math.max(0.4, this.zoom / f));
      else this.r = Math.min(v.radius * 3, Math.max(v.radius * 0.35, this.r * f));
      this.idle = 0;
    }, { passive: false });
  }
  reset() { this.tTheta = this.def.theta; this.phi = this.def.phi; this.r = this.def.radius; this.zoom = 1; this.idle = 0; }
  update(dt) {
    this.idle += dt;
    if (this.idle > 4 && this.auto) this.tTheta += dt * this.auto;
    this.theta += (this.tTheta - this.theta) * Math.min(1, dt * 8);
    const { r, phi, theta, target: t } = this;
    this.cam.position.set(t.x + r * Math.sin(phi) * Math.sin(theta), t.y + r * Math.cos(phi), t.z + r * Math.sin(phi) * Math.cos(theta));
    this.cam.lookAt(t);
    if (this.iso && this.cam.zoom !== this.zoom) { this.cam.zoom += (this.zoom - this.cam.zoom) * Math.min(1, dt * 10); this.cam.updateProjectionMatrix(); }
  }
}

const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), P = new THREE.Vector3(), S = new THREE.Vector3();
const lam = (c, extra = {}) => new THREE.MeshLambertMaterial({ color: c, ...extra });

// ── 2a: mixture-of-experts routing ─────────────────────────────
function buildMoE(scene, emit) {
  const L = 4, E = 8, DY = 1.8, SP = 1.5, RX = -4.2, STEP = 0.75, r = rng(23);
  const ePos = (l, e) => new THREE.Vector3((e % 4) * SP - 1.5 * SP + 0.8, l * DY, (Math.floor(e / 4) - 0.5) * SP);
  const rPos = l => new THREE.Vector3(RX, l * DY, 0);
  const ex = new THREE.InstancedMesh(new THREE.BoxGeometry(1.1, 0.5, 1.1), lam(0xffffff), L * E);
  const routers = new THREE.InstancedMesh(new THREE.BoxGeometry(0.62, 0.62, 0.62), lam(0x333333), L);
  const beams = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 0.1, 0.1), lam(0x111111), L * 4);
  const tok = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), lam(0x0a0a0a));
  const plateMat = new THREE.MeshBasicMaterial({ color: 0xd0d0d0, transparent: true, opacity: 0.14, depthWrite: false });
  scene.add(ex, routers, beams, tok);
  for (let l = 0; l < L; l++) {
    const p = new THREE.Mesh(new THREE.BoxGeometry(8.8, 0.04, 3.4), plateMat); p.position.set(-0.45, l * DY - 0.3, 0); scene.add(p);
    routers.setMatrixAt(l, M.compose(rPos(l), Q, S.setScalar(1)));
    for (let e = 0; e < E; e++) ex.setMatrixAt(l * E + e, M.compose(ePos(l, e), Q, S.setScalar(1)));
  }
  const cLight = new THREE.Color(0xeaeaea), cUse = new THREE.Color(0x8a8a8a), cAct = new THREE.Color(0x141414), tmp = new THREE.Color();
  const X = new THREE.Vector3(1, 0, 0), dir = new THREE.Vector3(), q = new THREE.Quaternion();
  const cnt = new Float32Array(L * E), act = new Float32Array(L * E), bg = new Float32Array(L * 4);
  let k = 2, playing = true, usage = false, tokIdx = 0, t = 0, choice = [], counted = -1, tokY = -1.2, last = '';
  function route() {
    choice = [];
    for (let l = 0; l < L; l++) {
      const s = Array.from({ length: E }, (_, e) => ({ e, s: r() })).sort((a, b) => b.s - a.s);
      choice.push(s.slice(0, k).map(o => o.e).sort((a, b) => a - b));
    }
  }
  function next() { tokIdx++; t = 0; counted = -1; route(); tokY = -1.2; }
  next();
  return {
    view: { target: [-0.4, 2.6, 0], radius: 40, theta: 0.6, phi: 1.1, size: 5.2 },
    update(dt) {
      if (playing) t += dt;
      const done = t >= L * STEP, cl = Math.min(L - 1, Math.floor(t / STEP)), live = !done && t - cl * STEP > 0.2;
      if (live && counted !== cl) { counted = cl; choice[cl].forEach(e => cnt[cl * E + e]++); }
      tokY += ((done ? L * DY - 0.4 : cl * DY) - tokY) * Math.min(1, dt * 10);
      tok.position.set(RX - 1.0, tokY, 0);
      tok.scale.setScalar(done ? Math.max(0.001, 1 - (t - L * STEP) / 0.3) : 1);
      let maxC = 1; for (let i = 0; i < L * E; i++) maxC = Math.max(maxC, cnt[i]);
      for (let l = 0; l < L; l++) for (let e = 0; e < E; e++) {
        const i = l * E + e, on = live && l === cl && choice[l].includes(e);
        act[i] += ((on ? 1 : 0) - act[i]) * Math.min(1, dt * (on ? 12 : 4));
        tmp.copy(cLight); if (usage) tmp.lerp(cUse, cnt[i] / maxC);
        ex.setColorAt(i, tmp.lerp(cAct, act[i]));
      }
      for (let l = 0; l < L; l++) for (let j = 0; j < 4; j++) {
        const b = l * 4 + j, on = live && l === cl && j < choice[l].length;
        bg[b] += ((on ? 1 : 0) - bg[b]) * Math.min(1, dt * (on ? 9 : 14));
        if (j < choice[l].length && bg[b] > 0.01) {
          const from = rPos(l); dir.copy(ePos(l, choice[l][j])).sub(from);
          const len = dir.length(); dir.normalize(); q.setFromUnitVectors(X, dir);
          P.copy(from).addScaledVector(dir, len * bg[b] / 2); S.set(len * bg[b], 1, 1);
          beams.setMatrixAt(b, M.compose(P, q, S));
        } else beams.setMatrixAt(b, M.compose(P.set(0, -50, 0), Q, S.setScalar(0.001)));
      }
      ex.instanceColor.needsUpdate = true; beams.instanceMatrix.needsUpdate = true;
      if (playing && t > L * STEP + 0.5) next();
      const st = { token: tokIdx, layer: live ? cl + 1 : 0, chosen: live ? choice[cl] : [], k, playing, usage, L, E };
      const key = JSON.stringify(st); if (key !== last) { last = key; emit(st); }
    },
    action(name, arg) {
      if (name === 'play') playing = !playing;
      if (name === 'k') { k = arg; route(); counted = -1; }
      if (name === 'usage') usage = arg;
      if (name === 'step') {
        playing = false;
        const cl = Math.floor(t / STEP);
        if (t >= L * STEP) { next(); t = 0.25; }
        else if (t - cl * STEP < 0.2) t = cl * STEP + 0.25;
        else t = cl + 1 < L ? (cl + 1) * STEP + 0.25 : L * STEP;
      }
    },
  };
}

// ── 2b: speculative decoding, linear draft + verify ────────────
function buildSpec(scene, emit) {
  const T = 18, DX = 0.82, PR = 4, KMAX = 7, YD = -2.1, YT = 2.4, r = rng(31);
  const x0 = -(T - 1) * DX / 2, xOf = i => x0 + i * DX;
  const box = new THREE.BoxGeometry(0.62, 0.62, 0.62);
  const row = new THREE.InstancedMesh(box, lam(0xffffff), T), dr = new THREE.InstancedMesh(box, lam(0xffffff), KMAX);
  const ghost = o => new THREE.MeshBasicMaterial({ color: 0x222222, transparent: true, opacity: o, depthWrite: false });
  const tslab = new THREE.Mesh(new THREE.BoxGeometry(1, 1.0, 1.6), ghost(0.2));
  const dslab = new THREE.Mesh(new THREE.BoxGeometry(0.74, 0.16, 1.2), ghost(0.4));
  scene.add(row, dr, tslab, dslab);
  [0, YD].forEach(y => { const m = new THREE.Mesh(new THREE.BoxGeometry(T * DX + 0.6, 0.04, 1.4), new THREE.MeshBasicMaterial({ color: 0x9a9a9a, transparent: true, opacity: 0.22, depthWrite: false })); m.position.y = y - 0.4; scene.add(m); });
  const cPrompt = new THREE.Color(0x9a9a9a), cAcc = new THREE.Color(0x3c3c3c), cTgt = new THREE.Color(0x0a0a0a), cDraft = new THREE.Color(0xdedede), cRej = new THREE.Color(0x6e6e6e);
  const rowBorn = new Float32Array(T), rowFrom = new Float32Array(T), rowCol = Array(T).fill(cPrompt);
  const d = Array.from({ length: KMAX }, () => ({ y: YD, ty: YD, s: 0, ts: 0, st: 0 }));
  const q = new THREE.Quaternion(), eu = new THREE.Euler();
  let n, K = 5, p = 0.7, phase, pt = 0, a = 0, playing = true, clock = 0, rounds = 0, stepReq = false, last = '';
  function start() {
    pt = 0;
    if (n + K + 1 > T) { phase = 'full'; return; }
    phase = 'draft'; a = K;
    for (let i = 0; i < K; i++) if (r() > p) { a = i; break; }
    d.forEach(o => { o.y = o.ty = YD; o.s = o.ts = 0; o.st = 0; });
  }
  function reset() {
    rowBorn.fill(-1);
    for (let i = 0; i < PR; i++) { rowBorn[i] = clock + i * 0.04; rowFrom[i] = 0; rowCol[i] = cPrompt; }
    n = PR; rounds = 0; start();
  }
  const dur = () => ({ draft: K * 0.22 + 0.15, lift: 0.4, verify: 0.6, check: (Math.min(a, K - 1) + 1) * 0.22 + 0.35, commit: 0.7, full: 2.2 })[phase];
  reset();
  return {
    view: { target: [0, 0.1, 0], radius: 40, theta: 0.18, phi: 1.2, size: 5.2 },
    update(dt) {
      clock += dt; if (playing) pt += dt;
      if (stepReq) { pt = Math.max(pt, dur()); stepReq = false; }
      if (phase === 'draft') {
        for (let i = 0; i < K; i++) if (pt >= i * 0.22) d[i].ts = 1;
        dslab.visible = pt < K * 0.22; dslab.position.set(xOf(n + Math.min(K - 1, Math.floor(pt / 0.22))), YD - 0.5, 0);
      } else dslab.visible = false;
      if (phase === 'lift') for (let i = 0; i < K; i++) d[i].ty = 0;
      tslab.visible = phase === 'verify' || phase === 'check';
      if (tslab.visible) {
        const f = phase === 'verify' ? Math.min(1, pt / 0.45) : 1, e = 1 - (1 - f) ** 3;
        tslab.scale.x = (K + 1) * DX + 0.2; tslab.position.set(xOf(n) + K * DX / 2, YT * (1 - e), 0);
      }
      if (phase === 'check') for (let i = 0; i < K; i++) {
        if (pt < Math.min(i, a) * 0.22 + 0.1) continue;
        if (i < a) d[i].st = 1; else { d[i].st = i === a ? 2 : 3; d[i].ty = YD - 1.4; d[i].ts = 0; }
      }
      if (pt >= dur()) {
        if (phase === 'draft') { phase = 'lift'; pt = 0; }
        else if (phase === 'lift') { phase = 'verify'; pt = 0; }
        else if (phase === 'verify') { phase = 'check'; pt = 0; }
        else if (phase === 'check') {
          for (let i = 0; i < a; i++) { rowBorn[n + i] = clock - 1; rowFrom[n + i] = 0; rowCol[n + i] = cAcc; d[i].s = d[i].ts = 0; }
          rowBorn[n + a] = clock; rowFrom[n + a] = YT; rowCol[n + a] = cTgt;
          n += a + 1; rounds++; phase = 'commit'; pt = 0;
        }
        else if (phase === 'commit') start();
        else if (phase === 'full') reset();
      }
      for (let i = 0; i < KMAX; i++) {
        const o = d[i];
        o.y += (o.ty - o.y) * Math.min(1, dt * (o.st >= 2 ? 4 : 9)); o.s += (o.ts - o.s) * Math.min(1, dt * (o.st >= 2 ? 3 : 12));
        q.setFromEuler(eu.set(0, 0, o.st >= 2 ? (o.y - 0) * 0.5 : 0));
        P.set(xOf(n + i), o.y, 0); S.setScalar(Math.max(o.s, 0.001));
        if (phase === 'commit' || phase === 'full') S.setScalar(0.001);
        dr.setMatrixAt(i, M.compose(P, q, S));
        dr.setColorAt(i, [cDraft, cAcc, cRej, cRej][o.st]);
      }
      for (let i = 0; i < T; i++) {
        const b = rowBorn[i], f = b < 0 || clock < b ? 0 : Math.min(1, (clock - b) / 0.3);
        P.set(xOf(i), rowFrom[i] * (1 - f) ** 2, 0); S.setScalar(f > 0 ? 1 : 0.001);
        row.setMatrixAt(i, M.compose(P, Q, S)); row.setColorAt(i, rowCol[i]);
      }
      row.instanceMatrix.needsUpdate = dr.instanceMatrix.needsUpdate = row.instanceColor.needsUpdate = dr.instanceColor.needsUpdate = true;
      const st = { phase, K, p, a, rounds, gen: n - PR, playing };
      const key = JSON.stringify(st); if (key !== last) { last = key; emit(st); }
    },
    action(name, arg) {
      if (name === 'play') playing = !playing;
      if (name === 'step') { playing = false; stepReq = true; }
      if (name === 'restart') { reset(); playing = true; }
      if (name === 'K') { K = arg; reset(); }
      if (name === 'p') { p = arg; reset(); }
    },
  };
}

// ── 2c: partial GPU offload (-ngl) ─────────────────────────────
function buildOffload(scene, emit) {
  const NL = 12, CAP = 9, DY = 0.44, CX = -4.3, GX = 4.3, ZA = 1.45;
  [[CX, 0xb8b8b8], [GX, 0x6a6a6a]].forEach(([x, c]) => { const m = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.3, 3.2), lam(c)); m.position.set(x, -0.38, 0); scene.add(m); });
  const bus = new THREE.Mesh(new THREE.BoxGeometry(GX - CX - 3.6, 0.14, 0.5), lam(0x3a3a3a)); bus.position.set(0, -0.38, ZA);
  const capBox = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(3.0, CAP * DY, 2.6)), new THREE.LineBasicMaterial({ color: 0x111111 }));
  capBox.position.set(GX, CAP * DY / 2 - 0.2, 0);
  const slabs = new THREE.InstancedMesh(new THREE.BoxGeometry(2.7, 0.3, 2.3), lam(0xffffff), NL);
  const actv = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.42, 0.42), lam(0x0a0a0a));
  scene.add(bus, capBox, slabs, actv);
  const cCPU = new THREE.Color(0xdadada), cGPU = new THREE.Color(0x8a8a8a), cOver = new THREE.Color(0xf6f6f6), cFl = new THREE.Color(0x101010), tmp = new THREE.Color();
  const sx = new Float32Array(NL), sy = new Float32Array(NL), fl = new Float32Array(NL);
  let ngl = 4, playing = true, route = [], seg = 0, st = 0, from = [0, 0, 0], last = '';
  const onG = i => i >= NL - ngl, gi = i => i - (NL - ngl);
  const tgt = i => onG(i) ? [GX, gi(i) * DY] : [CX, i * DY];
  for (let i = 0; i < NL; i++) [sx[i], sy[i]] = tgt(i);
  function build() {
    route = [];
    for (let i = 0; i < NL; i++) {
      const [x, y] = tgt(i);
      if (i > 0 && onG(i) && !onG(i - 1)) { const [px] = tgt(i - 1); route.push({ p: [px, -0.1, ZA], d: 0.18 }, { p: [x, -0.1, ZA], d: 0.55 }); }
      route.push({ p: [x, y, ZA], d: onG(i) ? 0.05 : 0.1 }, { p: [x, y, ZA], d: onG(i) ? 0.05 : 0.34, layer: i });
    }
    route.push({ p: route[route.length - 1].p, d: 0.45, end: true });
    seg = 0; st = 0; const [x0, y0] = tgt(0); from = [x0, y0 - 0.6, ZA];
  }
  build();
  return {
    view: { target: [0, 2.0, 0], radius: 40, theta: 0.42, phi: 1.12, size: 4.6 },
    update(dt) {
      if (playing) st += dt;
      const s = route[seg], f = Math.min(1, st / s.d);
      actv.position.set(...from.map((v, j) => v + (s.p[j] - v) * f));
      actv.scale.setScalar(s.end ? Math.max(0.001, 1 - f) : 1);
      if (s.layer !== undefined) fl[s.layer] = 1;
      if (st >= s.d) { st -= s.d; from = s.p.slice(); seg++; if (seg >= route.length) { const [x0, y0] = tgt(0); seg = 0; from = [x0, y0 - 0.6, ZA]; } }
      const k = Math.min(1, dt * 6);
      for (let i = 0; i < NL; i++) {
        const [tx, ty] = tgt(i); sx[i] += (tx - sx[i]) * k; sy[i] += (ty - sy[i]) * k;
        const hop = Math.abs(tx - sx[i]) > 0.05 ? Math.sin(Math.PI * Math.min(1, Math.abs(tx - sx[i]) / (GX - CX))) * 1.2 : 0;
        P.set(sx[i], sy[i] + hop, 0); slabs.setMatrixAt(i, M.compose(P, Q, S.setScalar(1)));
        fl[i] = Math.max(0, fl[i] - dt * 3);
        tmp.copy(onG(i) ? (gi(i) >= CAP ? cOver : cGPU) : cCPU).lerp(cFl, fl[i]);
        slabs.setColorAt(i, tmp);
      }
      slabs.instanceMatrix.needsUpdate = slabs.instanceColor.needsUpdate = true;
      const o = { ngl, NL, CAP, cpu: NL - ngl, over: Math.max(0, ngl - CAP), playing };
      const key = JSON.stringify(o); if (key !== last) { last = key; emit(o); }
    },
    action(name, arg) {
      if (name === 'play') playing = !playing;
      if (name === 'ngl') { ngl = Math.max(0, Math.min(NL, arg)); build(); }
    },
  };
}

// ── shared: soft gaussian splat points (constant pixel size, for ortho cameras) ──
function splatMat(alpha) {
  return new THREE.ShaderMaterial({
    uniforms: { uSize: { value: 6 } }, transparent: true, depthWrite: false,
    vertexShader: `uniform float uSize; void main(){ gl_PointSize = uSize; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }`,
    fragmentShader: `void main(){ vec2 d = gl_PointCoord - 0.5; float a = exp(-dot(d,d) * 14.0); if (a < 0.03) discard; gl_FragColor = vec4(vec3(0.05), a * ${alpha.toFixed(2)}); }`,
  });
}

// ── 3a: sampling landscape (temperature + top-p) ───────────────
function buildSample(scene, emit) {
  const WORDS = ['GPU','laptop','Mac','server','single','phone','desktop','budget','CPU','cluster','Pi','consumer','workstation','home','NUC','Jetson','modest','spare','mini','gaming','used','cheap','small','local'];
  const Z = [5.0,4.3,4.0,3.6,3.1,2.9,2.7,2.4,2.2,2.0,1.8,1.6,1.4,1.2,1.0,0.9,0.7,0.6,0.4,0.3,0.2,0.1,0,-0.2];
  const NT = WORDS.length, SZ = 14, SEG = 110, SIG2 = 0.75, HS = 6, r = rng(41);
  const pts = [];
  while (pts.length < NT) { const x = (r() - 0.5) * (SZ - 3), z = (r() - 0.5) * (SZ - 3); if (pts.every(p => (p[0] - x) ** 2 + (p[1] - z) ** 2 > 2.8)) pts.push([x, z]); }
  const geo = new THREE.PlaneGeometry(SZ, SZ, SEG, SEG); geo.rotateX(-Math.PI / 2);
  const pa = geo.attributes.position, V = pa.count, G = new Float32Array(V * NT), PG = new Float32Array(NT * NT);
  for (let v = 0; v < V; v++) { const x = pa.getX(v), z = pa.getZ(v); for (let i = 0; i < NT; i++) G[v * NT + i] = Math.exp(-((x - pts[i][0]) ** 2 + (z - pts[i][1]) ** 2) / SIG2); }
  for (let i = 0; i < NT; i++) for (let j = 0; j < NT; j++) PG[i * NT + j] = Math.exp(-((pts[i][0] - pts[j][0]) ** 2 + (pts[i][1] - pts[j][1]) ** 2) / SIG2);
  const land = new THREE.Mesh(geo, lam(0xe2e2e2));
  const water = new THREE.Mesh(new THREE.PlaneGeometry(SZ + 0.6, SZ + 0.6).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x2a2a2a, transparent: true, opacity: 0.32, depthWrite: false }));
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.32, 16, 12), lam(0x111111));
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.06, 6, 32).rotateX(Math.PI / 2), lam(0x111111));
  scene.add(land, water, ball, ring);
  const amp = new Float32Array(NT), tgt = new Float32Array(NT);
  let T = 0.7, topP = 0.9, probs = [], kept = [], wl = -0.5, wlT = -0.5, playing = true, timer = 1.2, pick = -1, by = 8, vy = 0, landed = false, last = '', dirty = true;
  const hAt = i => { let h = 0; for (let j = 0; j < NT; j++) h += amp[j] * PG[i * NT + j]; return h * HS; };
  function compute() {
    const m = Math.max(...Z), e = Z.map(z => Math.exp((z - m) / T)), s = e.reduce((a, b) => a + b, 0);
    probs = e.map(v => v / s); probs.forEach((v, i) => tgt[i] = v);
    const ord = probs.map((_, i) => i).sort((a, b) => probs[b] - probs[a]);
    let c = 0; kept = [];
    for (const i of ord) { kept.push(i); c += probs[i]; if (c >= topP - 1e-9) break; }
    const k = kept.length;
    wlT = k < NT ? Math.min(HS * probs[ord[k]] + 0.12, HS * probs[ord[k - 1]] * 0.85) : -0.5;
    if (pick >= 0 && !kept.includes(pick)) { pick = -1; landed = false; }
    dirty = true;
  }
  function sample() {
    const tot = kept.reduce((a, i) => a + probs[i], 0); let u = r() * tot; pick = kept[kept.length - 1];
    for (const i of kept) { u -= probs[i]; if (u <= 0) { pick = i; break; } }
    by = 8; vy = 0; landed = false;
  }
  compute();
  return {
    view: { target: [0, 0.8, 0], radius: 40, theta: 0.7, phi: 0.98, size: 6.0 },
    update(dt) {
      let moving = false;
      for (let i = 0; i < NT; i++) { const d = tgt[i] - amp[i]; if (Math.abs(d) > 1e-4) { amp[i] += d * Math.min(1, dt * 5); moving = true; } }
      if (moving || dirty) {
        for (let v = 0; v < V; v++) { let h = 0; const o = v * NT; for (let i = 0; i < NT; i++) h += amp[i] * G[o + i]; pa.setY(v, h * HS); }
        pa.needsUpdate = true; geo.computeVertexNormals(); dirty = false;
      }
      wl += (wlT - wl) * Math.min(1, dt * 4); water.position.y = wl; water.visible = wl > -0.3;
      if (playing) { timer += dt; if (timer > 2.0) { timer = 0; sample(); } }
      ball.visible = pick >= 0; ring.visible = pick >= 0 && landed;
      if (pick >= 0) {
        const floor = hAt(pick) + 0.32;
        vy -= 28 * dt; by += vy * dt;
        if (by < floor) { by = floor; vy = Math.abs(vy) > 1.5 ? -vy * 0.35 : 0; landed = true; }
        ball.position.set(pts[pick][0], by, pts[pick][1]);
        ring.position.set(pts[pick][0], floor - 0.42, pts[pick][1]);
      }
      const tot = kept.reduce((a, i) => a + probs[i], 0);
      const st = { T, topP, k: kept.length, NT, list: kept.slice(0, 5).map(i => [WORDS[i], Math.round(probs[i] / tot * 100)]), more: Math.max(0, kept.length - 5), word: pick >= 0 && landed ? WORDS[pick] : null, playing };
      const key = JSON.stringify(st); if (key !== last) { last = key; emit(st); }
    },
    action(name, arg) {
      if (name === 'play') playing = !playing;
      if (name === 'sample') { sample(); timer = 0; }
      if (name === 'T') { T = arg; compute(); }
      if (name === 'topP') { topP = arg; compute(); }
    },
  };
}

// ── 3b: attention arcs (full vs sliding window vs hybrid) ──────
function buildAttn(scene, emit) {
  const N = 32, DX = 0.5, KEY = [6, 13, 21], x0 = -(N - 1) * DX / 2, xOf = i => x0 + i * DX;
  const arcMat = lam(0x2a2a2a), railMat = lam(0xbdbdbd);
  const winMat = new THREE.MeshBasicMaterial({ color: 0x555555, transparent: true, opacity: 0.18, depthWrite: false, side: THREE.DoubleSide });
  const lanes = [0, 1].map(() => {
    const g = new THREE.Group(), arcs = new THREE.Group();
    const dots = new THREE.InstancedMesh(new THREE.SphereGeometry(0.17, 12, 8), lam(0xffffff), N);
    const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, N * DX + 0.4, 6).rotateZ(Math.PI / 2), railMat); rail.position.y = -0.2;
    const band = new THREE.Mesh(new THREE.PlaneGeometry(1, 1.1).rotateX(-Math.PI / 2), winMat); band.position.y = -0.22;
    g.add(dots, arcs, rail, band); scene.add(g);
    return { g, arcs, dots, band, win: false, on: false };
  });
  const cQ = new THREE.Color(0x0a0a0a), cIn = new THREE.Color(0x5e5e5e), cOut = new THREE.Color(0xd4d4d4), cFut = new THREE.Color(0xeeeeee);
  let mode = 'hybrid', W = 8, q = 12, playing = true, t = 0, hold = 0, grow = 1, last = '';
  function layout() {
    const cfg = mode === 'full' ? [false] : mode === 'sliding' ? [true] : [false, true];
    lanes.forEach((L, i) => { L.on = i < cfg.length; L.win = !!cfg[i]; L.g.visible = L.on; L.g.position.z = cfg.length === 2 ? (i ? 1.6 : -1.6) : 0; });
  }
  function rebuild() {
    lanes.forEach(L => {
      L.arcs.children.slice().forEach(m => { m.geometry.dispose(); L.arcs.remove(m); });
      if (!L.on) return;
      const lo = L.win ? Math.max(0, q - W + 1) : 0, s = [];
      for (let j = lo; j <= q; j++) s.push(2.2 * Math.exp(-(q - j) / 3) + (j === 0 ? 1.8 : 0) + (KEY.includes(j) ? 1.1 : 0));
      const m = Math.max(...s), e = s.map(v => Math.exp(v - m)), tot = e.reduce((a, b) => a + b, 0), wmax = Math.max(...e) / tot;
      for (let j = lo; j < q; j++) {
        const w = e[j - lo] / tot, d = q - j, h = 0.25 + 0.8 * Math.sqrt(d);
        const c = new THREE.QuadraticBezierCurve3(new THREE.Vector3(xOf(j), 0, 0), new THREE.Vector3((xOf(j) + xOf(q)) / 2, h * 2, 0), new THREE.Vector3(xOf(q), 0, 0));
        L.arcs.add(new THREE.Mesh(new THREE.TubeGeometry(c, Math.max(8, Math.min(28, d * 2)), 0.02 + 0.12 * w / wmax, 5), arcMat));
      }
      L.band.visible = L.win; L.band.scale.x = (q - lo + 1) * DX; L.band.position.x = (xOf(lo) + xOf(q)) / 2;
    });
    grow = 0;
  }
  layout(); rebuild();
  return {
    view: { target: [0, 1.6, 0], radius: 40, theta: 0.5, phi: 1.12, size: 4.6 },
    update(dt) {
      if (playing) {
        if (q >= N - 1) { hold += dt; if (hold > 1.6) { hold = 0; q = 1; rebuild(); } }
        else { t += dt; if (t > 0.55) { t = 0; q++; rebuild(); } }
      }
      grow = Math.min(1, grow + dt * 5);
      lanes.forEach(L => {
        if (!L.on) return;
        L.arcs.scale.y = Math.max(0.001, 1 - (1 - grow) ** 3);
        const lo = L.win ? Math.max(0, q - W + 1) : 0;
        for (let j = 0; j < N; j++) {
          const fut = j > q, inC = j >= lo && j <= q;
          P.set(xOf(j), 0, 0); S.setScalar(j === q ? 1.5 : fut ? 0.45 : inC ? 1 : 0.7);
          L.dots.setMatrixAt(j, M.compose(P, Q, S)); L.dots.setColorAt(j, j === q ? cQ : fut ? cFut : inC ? cIn : cOut);
        }
        L.dots.instanceMatrix.needsUpdate = L.dots.instanceColor.needsUpdate = true;
      });
      const st = { mode, W, q: q + 1, N, win: Math.min(W, q + 1), playing };
      const key = JSON.stringify(st); if (key !== last) { last = key; emit(st); }
    },
    action(name, arg) {
      if (name === 'play') playing = !playing;
      if (name === 'step') { playing = false; q = q >= N - 1 ? 1 : q + 1; rebuild(); }
      if (name === 'mode') { mode = arg; layout(); rebuild(); }
      if (name === 'W') { W = arg; rebuild(); }
    },
  };
}

// ── 3c: decode is a memory stream ──────────────────────────────
function buildFlow(scene, emit) {
  const BW = { RAM: 1, Unified: 3, VRAM: 7 }, SZW = { FP16: 4, Q8: 2.1, Q4: 1.15 };
  let bw = 'Unified', wt = 'FP16', B = 1, playing = true, prog = 0, last = '';
  const rr = rng(7), g = gaussFn(rr), CORE = new THREE.Vector3(4.4, 1.6, 0), RCX = -4.6;
  const basin = new THREE.Mesh(new THREE.CylinderGeometry(2.3, 2.5, 0.4, 48), lam(0xc4c4c4)); basin.position.set(RCX, -0.2, 0);
  const NR = 2400, rp = new Float32Array(NR * 3), ra = new Float32Array(NR), rd = new Float32Array(NR), ry = new Float32Array(NR);
  for (let i = 0; i < NR; i++) { rd[i] = 0.15 + 2.0 * Math.sqrt(rr()); ra[i] = rr() * 6.283; ry[i] = 0.1 + Math.abs(g()) * 0.35; }
  const rGeo = new THREE.BufferGeometry(); rGeo.setAttribute('position', new THREE.BufferAttribute(rp, 3));
  const rMat = splatMat(0.26), rPts = new THREE.Points(rGeo, rMat); rPts.frustumCulled = false;
  const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(-2.5, 0.4, 0), new THREE.Vector3(-1, 2.3, 0), new THREE.Vector3(1.8, 2.5, 0), new THREE.Vector3(3.3, 1.7, 0)]);
  const NSmp = 160, cp = curve.getSpacedPoints(NSmp), fr = curve.computeFrenetFrames(NSmp, false);
  const NS = 1600, su = new Float32Array(NS), sa = new Float32Array(NS), sf = new Float32Array(NS), sp = new Float32Array(NS * 3);
  for (let i = 0; i < NS; i++) { su[i] = rr(); sa[i] = rr() * 6.283; sf[i] = Math.sqrt(rr()); }
  const sGeo = new THREE.BufferGeometry(); sGeo.setAttribute('position', new THREE.BufferAttribute(sp, 3));
  const sMat = splatMat(0.45), sPts = new THREE.Points(sGeo, sMat); sPts.frustumCulled = false;
  const tubeMat = new THREE.MeshBasicMaterial({ color: 0x9a9a9a, transparent: true, opacity: 0.16, depthWrite: false });
  const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.85, 0), lam(0x6a6a6a, { flatShading: true })); core.position.copy(CORE);
  const NRING = 36, ring = new THREE.InstancedMesh(new THREE.SphereGeometry(0.09, 8, 6), lam(0xffffff), NRING);
  for (let i = 0; i < NRING; i++) { const a = Math.PI / 2 - i / NRING * Math.PI * 2; ring.setMatrixAt(i, M.compose(P.set(CORE.x + Math.cos(a) * 1.45, CORE.y + Math.sin(a) * 1.45, 0), Q, S.setScalar(1))); }
  const NO = 128, orbs = new THREE.InstancedMesh(new THREE.SphereGeometry(0.17, 12, 8), lam(0x111111), NO);
  const ox = new Float32Array(NO * 3), ov = new Float32Array(NO * 3), ol = new Float32Array(NO);
  scene.add(basin, rPts, sPts, core, ring, orbs);
  const cOn = new THREE.Color(0x1a1a1a), cOff = new THREE.Color(0xe0e0e0);
  let tube = null, curR = 0;
  const radOf = () => 0.12 + 0.11 * BW[bw];
  function spawn() {
    for (let j = 0; j < NO; j++) if (ol[j] <= 0) {
      ox[j * 3] = CORE.x; ox[j * 3 + 1] = CORE.y; ox[j * 3 + 2] = 0;
      ov[j * 3] = 0.5 + rr() * 1.3; ov[j * 3 + 1] = 1.4 + rr() * 1.6; ov[j * 3 + 2] = (rr() - 0.5) * 1.6; ol[j] = 1.8; return;
    }
  }
  return {
    view: { target: [0, 1.1, 0], radius: 40, theta: 0.3, phi: 1.2, size: 4.4 },
    resize(W, H) { rMat.uniforms.uSize.value = sMat.uniforms.uSize.value = Math.max(3, H * 0.012); },
    update(dt) {
      const tR = radOf();
      if (Math.abs(tR - curR) > 0.003) {
        curR += (tR - curR) * Math.min(1, dt * 4);
        if (tube) { scene.remove(tube); tube.geometry.dispose(); }
        tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 64, curR, 14), tubeMat); scene.add(tube);
      }
      const nr = Math.round(NR * SZW[wt] / 4); rGeo.setDrawRange(0, nr);
      for (let i = 0; i < nr; i++) {
        if (playing) ra[i] += dt * 0.5 / (0.5 + rd[i]);
        rp[i * 3] = RCX + Math.cos(ra[i]) * rd[i]; rp[i * 3 + 1] = ry[i]; rp[i * 3 + 2] = Math.sin(ra[i]) * rd[i];
      }
      rGeo.attributes.position.needsUpdate = true;
      const ns = Math.round(NS * BW[bw] / 7); sGeo.setDrawRange(0, ns);
      for (let i = 0; i < ns; i++) {
        if (playing) { su[i] += dt * 0.45; su[i] -= Math.floor(su[i]); }
        if (!(su[i] >= 0)) su[i] = 0;
        const k = Math.min(cp.length - 1, fr.normals.length - 1, Math.floor(su[i] * NSmp)), p = cp[k], n = fr.normals[k], b = fr.binormals[k];
        const o = sf[i] * curR * 0.85, c = Math.cos(sa[i]) * o, s = Math.sin(sa[i]) * o;
        sp[i * 3] = p.x + n.x * c + b.x * s; sp[i * 3 + 1] = p.y + n.y * c + b.y * s; sp[i * 3 + 2] = p.z + n.z * c + b.z * s;
      }
      sGeo.attributes.position.needsUpdate = true;
      if (playing) {
        prog += dt * BW[bw] / (SZW[wt] * 1.6);
        if (prog >= 1) { prog -= 1; for (let j = 0; j < B; j++) spawn(); }
        core.rotation.y += dt * (0.3 + BW[bw] * 0.15); core.rotation.x += dt * 0.2;
      }
      const lit = Math.floor(prog * NRING);
      for (let i = 0; i < NRING; i++) ring.setColorAt(i, i < lit ? cOn : cOff);
      ring.instanceColor.needsUpdate = true;
      for (let j = 0; j < NO; j++) {
        if (ol[j] > 0) {
          ol[j] -= dt; ov[j * 3 + 1] -= 0.8 * dt;
          for (let a = 0; a < 3; a++) ox[j * 3 + a] += ov[j * 3 + a] * dt;
        }
        P.set(ox[j * 3], ox[j * 3 + 1], ox[j * 3 + 2]); S.setScalar(ol[j] > 0 ? Math.min(1, ol[j] / 0.4) : 0.001);
        orbs.setMatrixAt(j, M.compose(P, Q, S));
      }
      orbs.instanceMatrix.needsUpdate = true;
      const st = { bw, wt, B, rel: Math.round((BW[bw] / SZW[wt]) * 4 * 10) / 10, playing };
      const key = JSON.stringify(st); if (key !== last) { last = key; emit(st); }
    },
    action(name, arg) {
      if (name === 'play') playing = !playing;
      if (name === 'bw') bw = arg;
      if (name === 'wt') wt = arg;
      if (name === 'B') B = arg;
    },
  };
}

const BUILD = { moe: buildMoE, spec: buildSpec, offload: buildOffload, sample: buildSample, attn: buildAttn, flow: buildFlow };

export function mount(el, kind, opts = {}, onState = () => {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  const cv = renderer.domElement;
  Object.assign(cv.style, { width: '100%', height: '100%', display: 'block', imageRendering: 'pixelated', touchAction: 'pan-y', cursor: 'grab' });
  el.appendChild(cv);
  const rt = new THREE.WebGLRenderTarget(4, 4, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, samples: 4 });
  const post = makePost(), pscene = new THREE.Scene(), pcam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), post); quad.frustumCulled = false; pscene.add(quad);
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0xffffff);
  scene.add(new THREE.AmbientLight(0xffffff, 1.15));
  const dl = new THREE.DirectionalLight(0xffffff, 2.8); dl.position.set(4, 8, 5); scene.add(dl);
  const viz = BUILD[kind](scene, onState);
  const iso = !!viz.view.size;
  const cam = iso ? new THREE.OrthographicCamera(-1, 1, 1, -1, -100, 200) : new THREE.PerspectiveCamera(32, 1, 0.1, 500);
  const orbit = new Orbit(cam, cv, viz.view, iso);
  let o = { pixel: 1.5, tones: 16, dither: true, ...opts };
  function resize() {
    // Layout size (ignores ancestor CSS transforms), so a scene inside a scaled 1920×1080 slide
    // renders at slide resolution and doesn't need re-measuring when the slide is rescaled.
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = Math.max(16, Math.round(el.clientWidth * dpr / o.pixel)), H = Math.max(16, Math.round(el.clientHeight * dpr / o.pixel));
    renderer.setSize(W, H, false); rt.setSize(W, H);
    // `cx` = horizontal position of the view target as a fraction of the canvas width (0.5 = centred),
    // `fit` > 1 zooms out. Slides use these to frame the scene beside the caption card.
    if (iso) { const a = W / H, s = viz.view.size * (o.fit ?? 1), w = 2 * s * a, cx = o.cx ?? 0.5; Object.assign(cam, { left: -w * cx, right: w * (1 - cx), top: s, bottom: -s }); } else cam.aspect = W / H;
    cam.updateProjectionMatrix(); viz.resize && viz.resize(W, H);
  }
  function applyOpts() {
    post.uniforms.n.value = o.tones === 'smooth' ? 0 : Number(o.tones) || 16;
    post.uniforms.dither.value = o.dither ? 1 : 0;
    PAL[6].forEach((h, i) => post.uniforms.pal.value[i].set(...hex3(h)));
    resize();
  }
  applyOpts();
  let visible = true, raf, last = performance.now();
  const io = new IntersectionObserver(es => { visible = es[0].isIntersecting; }); io.observe(el);
  const ro = new ResizeObserver(resize); ro.observe(el);
  function frame(now) {
    if (now !== undefined) raf = requestAnimationFrame(frame);
    now = now ?? performance.now();
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    viz.update(dt); orbit.update(dt);
    renderer.setRenderTarget(rt); renderer.render(scene, cam);
    post.uniforms.tDiffuse.value = rt.texture;
    renderer.setRenderTarget(null); renderer.render(pscene, pcam);
  }
  raf = requestAnimationFrame(frame);
  // fallback when rAF is throttled (background/preview frames)
  const tick = setInterval(() => { if (performance.now() - last > 200) frame(); }, 100);
  return {
    setOpts(n) { o = { ...o, ...n }; applyOpts(); },
    action(name, arg) {
      if (name === 'view') orbit.reset();
      else if (name === 'rotate') { orbit.tTheta += arg * Math.PI / 2; orbit.idle = 0; }
      else viz.action && viz.action(name, arg);
    },
    dispose() { cancelAnimationFrame(raf); clearInterval(tick); io.disconnect(); ro.disconnect(); renderer.dispose(); cv.remove(); },
  };
}
