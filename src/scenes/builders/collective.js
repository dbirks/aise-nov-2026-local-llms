// Scene `collective` (G01) — "Sharing without a VPN" (handoff §1 ch.06, §3 G01, §4.6).
// Public-safe mechanism: independent home machines dial OUT (outbound WSS) to a gateway in k8s.
// Inbound internet attempts hit a solid firewall wall (no open home port, no VPN).
// Requests multiplex as thin Yamux streams inside the already-open outbound WSS tubes;
// token packets return up the same stream to the client. Homes share no GPU/VRAM/KV.
//
// Everything shown (2 homes, 3 generic catalog entries, packet timing) is illustrative;
// no throughput, latency, hostnames, keys or private topology are shown.
import { THREE, lam, ghost, ease, emitter } from './_kit.js';

const BEATS = [2.4, 4.0, 3.8];
const TOTAL = BEATS.reduce((a, b) => a + b, 0);
const clamp01 = v => (v < 0 ? 0 : v > 1 ? 1 : v);
const seg = (v, a, b) => clamp01((v - a) / (b - a));
const beatStart = i => BEATS.slice(0, i).reduce((a, x) => a + x, 0);
const cTmp1 = new THREE.Color(), cTmp2 = new THREE.Color();

const X_A = -2.15;
const X_B = 2.15;

/** Light sticker sprite with bold >=64px canvas text — legible over dark or light geometry. */
function mkLabel(text, h, scene, opts = {}) {
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthWrite: false, depthTest: false }));
  const draw = (t, muted = false) => {
    const cv = document.createElement('canvas'), g = cv.getContext('2d');
    const font = 'bold 64px ui-monospace, "DejaVu Sans Mono", monospace';
    g.font = font;
    const padX = opts.padX ?? 14;
    const w = Math.max(32, Math.ceil(g.measureText(t).width)) + padX * 2;
    const ch = 84;
    cv.width = w; cv.height = ch;
    g.fillStyle = muted ? '#d6d6d0' : '#ecece6';
    g.fillRect(0, 0, w, ch);
    g.strokeStyle = muted ? '#a5a59e' : '#7c7c76';
    g.lineWidth = 3;
    g.strokeRect(1.5, 1.5, w - 3, ch - 3);
    g.font = font;
    g.fillStyle = muted ? '#72726d' : '#131313';
    g.textBaseline = 'middle';
    g.fillText(t, padX, ch / 2 + 2);
    if (muted && opts.strike) {
      g.strokeStyle = '#62625d';
      g.lineWidth = 5;
      g.beginPath(); g.moveTo(padX - 4, ch / 2); g.lineTo(w - padX + 4, ch / 2); g.stroke();
    }
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    sp.material.map?.dispose();
    sp.material.map = tex;
    sp.material.needsUpdate = true;
    sp.scale.set(h * (w / ch), h, 1);
  };
  draw(text, false);
  scene.add(sp);
  return { sprite: sp, set: draw };
}

function mkBox(w, h, d, color, edgeColor, scene) {
  const mat = lam(color);
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  if (edgeColor !== null) {
    mesh.add(new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(w, h, d)),
      new THREE.LineBasicMaterial({ color: edgeColor }),
    ));
  }
  scene.add(mesh);
  return mesh;
}

/** Polyline helper with uniform arc-length sampling and segment transforms. */
function mkPath(pts) {
  const vecs = pts.map(p => new THREE.Vector3(...p));
  const segs = [];
  let total = 0;
  for (let i = 0; i < vecs.length - 1; i++) {
    const a = vecs[i], b = vecs[i + 1];
    const dir = b.clone().sub(a);
    const len = dir.length();
    const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
    segs.push({ a, b, len, from: total, quat });
    total += len;
  }
  const at = u => {
    const d = clamp01(u) * total;
    for (const s of segs) {
      if (d <= s.from + s.len || s === segs[segs.length - 1]) {
        const f = s.len ? clamp01((d - s.from) / s.len) : 0;
        return new THREE.Vector3().lerpVectors(s.a, s.b, f);
      }
    }
    return vecs[vecs.length - 1].clone();
  };
  const quatAt = u => {
    const d = clamp01(u) * total;
    for (const s of segs) if (d <= s.from + s.len) return s.quat;
    return segs[segs.length - 1].quat;
  };
  return { segs, total, at, quatAt };
}

/** Builds one independent home machine behind a solid firewall wall. */
function mkHome(cx, tag, scene) {
  const frame = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(2.15, 2.34, 1.48)),
    new THREE.LineBasicMaterial({ color: 0x707070 }),
  );
  frame.position.set(cx, -1.96, -0.05);
  scene.add(frame);

  mkBox(2.15, 0.12, 1.48, 0xcacaca, 0x222222, scene).position.set(cx, -3.09, -0.05);

  // Solid firewall wall across the front edge (no hole!)
  const wall = mkBox(2.24, 0.72, 0.16, 0x3b3b3b, 0x111111, scene);
  wall.position.set(cx, -2.72, 0.84);
  for (const dy of [-0.14, 0.14]) {
    const seam = new THREE.Mesh(new THREE.BoxGeometry(2.25, 0.025, 0.17), lam(0x161616));
    seam.position.set(cx, -2.72 + dy, 0.84);
    scene.add(seam);
  }

  // Inside the home (behind the wall): contributor, local model server, GPU + KV
  const contrib = mkBox(0.86, 0.36, 0.44, 0x1e1e1e, 0x101010, scene);
  contrib.position.set(cx, -1.10, -0.22);

  const server = mkBox(1.36, 0.42, 0.48, 0x2c2c2c, 0x101010, scene);
  server.position.set(cx, -1.76, -0.22);

  // GPU + KV block: distinct static weight slab + dynamic KV cell stack
  const gpuWeights = mkBox(0.72, 0.42, 0.44, 0x1b1b1b, 0x101010, scene);
  gpuWeights.position.set(cx - 0.34, -2.42, -0.22);
  const kvCells = [];
  for (let i = 0; i < 4; i++) {
    const cell = mkBox(0.22, 0.17, 0.34, 0x626262, 0x141414, scene);
    cell.position.set(cx + 0.18 + (i % 2) * 0.26, -2.51 + Math.floor(i / 2) * 0.20, -0.22);
    kvCells.push(cell);
  }

  // Internal localhost link connecting contributor <-> local model server <-> GPU
  const localLink = mkBox(0.08, 1.32, 0.08, 0x242424, null, scene);
  localLink.position.set(cx, -1.76, -0.22);

  mkLabel('contributor', 0.33, scene, { padX: 10 }).sprite.position.set(cx, -1.10, 0.16);
  mkLabel('local model server', 0.33, scene, { padX: 8 }).sprite.position.set(cx, -1.76, 0.18);
  mkLabel('GPU + KV', 0.33, scene, { padX: 10 }).sprite.position.set(cx, -2.40, 0.18);
  mkLabel('firewall', 0.33, scene, { padX: 10 }).sprite.position.set(cx, -2.76, 1.02);
  mkLabel(tag, 0.35, scene, { padX: 12 }).sprite.position.set(cx, -3.46, 0.45);

  return { contrib, server, gpuWeights, kvCells, localLink, wall };
}

/** Builds an outbound WSS thick tube + rings + outbound chevrons + inner Yamux stream + token cubes. */
function mkTunnel(pts, scene) {
  const path = mkPath(pts);

  // Thick outer WSS tube (translucent so the inner thin Yamux line is clearly visible inside)
  const outerMeshes = path.segs.map(s => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, s.len, 14, 1, true), ghost(0x282828, 0.24));
    m.quaternion.copy(s.quat);
    scene.add(m);
    return { m, s };
  });
  const elbowJoint = new THREE.Mesh(new THREE.SphereGeometry(0.18, 12, 10), ghost(0x282828, 0.24));
  elbowJoint.position.copy(path.segs[0].b);
  scene.add(elbowJoint);

  // Dark collar rings along the outer tube
  const RING_U = [0.14, 0.34, 0.54, 0.74, 0.90];
  const rings = RING_U.map(u => {
    const r = new THREE.Mesh(new THREE.TorusGeometry(0.185, 0.016, 8, 18), lam(0x161616));
    r.position.copy(path.at(u));
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 1, 0));
    r.quaternion.copy(path.quatAt(u)).multiply(q);
    scene.add(r);
    return { r, u };
  });

  // Outbound arrowheads sliding Home -> Gateway along the outer wall
  const chevrons = [0, 1, 2].map(i => {
    const c = new THREE.Mesh(new THREE.ConeGeometry(0.095, 0.24, 8), lam(0x141414));
    scene.add(c);
    return { c, phase: i / 3 };
  });

  // Faint baseline control thread (stream 1) inside the tube
  const ctrlMeshes = path.segs.map(s => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, s.len, 8), ghost(0x3a3a3a, 0.5));
    m.quaternion.copy(s.quat);
    scene.add(m);
    return { m, s };
  });

  // Active thin Yamux stream (stream 2) inside the tube, growing Gateway -> Home
  const revPath = mkPath([...pts].reverse());
  const streamMeshes = revPath.segs.map(s => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.042, s.len, 10), lam(0x101010));
    m.quaternion.copy(s.quat);
    m.visible = false;
    scene.add(m);
    return { m, s };
  });

  // Token cubes returning Home -> Gateway along the active inner stream
  const tokens = Array.from({ length: 4 }, (_, i) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.13, 0.13), lam(0x111111));
    m.visible = false;
    scene.add(m);
    return { m, offset: i * 0.24 };
  });

  const drawTube = (p, clock) => {
    const activeDist = clamp01(p) * path.total;
    for (const { m, s } of outerMeshes) {
      const f = clamp01((activeDist - s.from) / s.len);
      m.visible = f > 0.01;
      if (m.visible) {
        m.scale.set(1, f, 1);
        m.position.copy(s.a).lerp(s.b, f * 0.5);
      }
    }
    for (const { m, s } of ctrlMeshes) {
      const f = clamp01((activeDist - s.from) / s.len);
      m.visible = f > 0.01;
      if (m.visible) {
        m.scale.set(1, f, 1);
        m.position.copy(s.a).lerp(s.b, f * 0.5);
      }
    }
    elbowJoint.visible = activeDist > path.segs[0].len;
    for (const { r, u } of rings) r.visible = p > u + 0.03;
    for (const ch of chevrons) {
      const u = (ch.phase + clock * 0.26) % 1;
      ch.c.visible = p > 0.2 && u < p - 0.04;
      if (ch.c.visible) {
        ch.c.position.copy(path.at(u)).add(new THREE.Vector3(0, 0, 0.23));
        ch.c.quaternion.copy(path.quatAt(u));
      }
    }
  };

  const drawStream = q => {
    const activeDist = clamp01(q) * revPath.total;
    for (const { m, s } of streamMeshes) {
      const f = clamp01((activeDist - s.from) / s.len);
      m.visible = f > 0.01;
      if (m.visible) {
        m.scale.set(1, f, 1);
        m.position.copy(s.a).lerp(s.b, f * 0.5);
      }
    }
  };

  const drawTokens = (active, flowT) => {
    for (const tk of tokens) {
      if (active <= 0.02) { tk.m.visible = false; continue; }
      const u = (flowT + tk.offset) % 1;
      tk.m.visible = true;
      tk.m.position.copy(path.at(u));
      tk.m.scale.setScalar(0.65 + 0.35 * active);
    }
  };

  return { path, drawTube, drawStream, drawTokens };
}

/** Dashed attempted inbound arrow from the internet stopping against the firewall wall. */
function mkInboundArrow(startVec, hitVec, scene) {
  const start = new THREE.Vector3(...startVec);
  const hit = new THREE.Vector3(...hitVec);
  const dir = hit.clone().sub(start).normalize();
  const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);

  const dashes = [];
  for (let i = 0; i < 6; i++) {
    const d = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.20, 0.075), lam(0x1b1b1b));
    d.quaternion.copy(quat);
    d.visible = false;
    scene.add(d);
    dashes.push(d);
  }
  const head = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.26, 8), lam(0x111111));
  head.position.copy(hit).addScaledVector(dir, -0.15);
  head.quaternion.copy(quat);
  head.visible = false;
  scene.add(head);

  const barA = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.065, 0.065), lam(0x111111));
  const barB = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.065, 0.065), lam(0x111111));
  barA.position.copy(hit); barB.position.copy(hit);
  barA.rotation.z = Math.PI / 4; barB.rotation.z = -Math.PI / 4;
  barA.visible = barB.visible = false;
  scene.add(barA, barB);

  return (vis, clock) => {
    const on = vis > 0.05;
    head.visible = on;
    barA.visible = barB.visible = on;
    const pulse = 0.88 + 0.16 * Math.sin(clock * 6);
    barA.scale.setScalar(vis * pulse);
    barB.scale.setScalar(vis * pulse);
    head.scale.setScalar(vis);
    const shift = (clock * 0.45) % 1;
    for (let i = 0; i < dashes.length; i++) {
      const u = clamp01(((i + shift) / dashes.length) * 0.88);
      dashes[i].visible = on;
      dashes[i].position.lerpVectors(start, hit, u);
      dashes[i].scale.setScalar(vis);
    }
  };
}

export default function build(scene, emit) {
  const out = emitter(emit);

  // ── top tier: client -> gateway (k8s) -> model catalog ────────────────────
  const client = mkBox(0.92, 0.68, 0.60, 0x222222, 0x101010, scene);
  client.position.set(-2.55, 2.35, 0);
  mkBox(0.24, 0.14, 0.04, 0xd8d8d8, 0x111111, scene).position.set(-2.55, 2.35, 0.32);

  const gw = mkBox(1.70, 1.04, 0.76, 0x2d2d2d, 0x101010, scene);
  gw.position.set(0.15, 2.35, 0);

  // Client <-> Gateway rail & Gateway <-> Catalog link
  mkBox(1.40, 0.05, 0.05, 0x777777, null, scene).position.set(-1.38, 2.35, 0);
  mkBox(0.76, 0.06, 0.06, 0x555555, null, scene).position.set(1.38, 2.35, 0.02);

  // Model catalog panel (3 generic entries: model a, model b, model c)
  const catPanel = mkBox(1.36, 1.24, 0.24, 0xd6d6d6, 0x111111, scene);
  catPanel.position.set(2.48, 2.35, 0.04);
  const catRows = ['model a', 'model b', 'model c'].map((name, idx) => {
    const y = 2.68 - idx * 0.33;
    const dot = mkBox(0.12, 0.14, 0.06, 0x181818, 0x101010, scene);
    dot.position.set(1.96, y, 0.18);
    const lbl = mkLabel(name, 0.30, scene, { padX: 10, strike: true });
    lbl.sprite.position.set(2.56, y, 0.22);
    return { name, dot, lbl };
  });

  // Top labels (well separated horizontally)
  mkLabel('client', 0.36, scene, { padX: 14 }).sprite.position.set(-2.55, 2.98, 0);
  mkLabel('gateway (k8s)', 0.36, scene, { padX: 12 }).sprite.position.set(0.15, 3.16, 0);
  mkLabel('model catalog', 0.35, scene, { padX: 12 }).sprite.position.set(2.48, 3.20, 0.04);
  const lblUnavail = mkLabel('unavailable', 0.36, scene, { padX: 14 });
  lblUnavail.sprite.position.set(0.15, 1.50, 0.52);
  lblUnavail.sprite.material.opacity = 0;

  // ── bottom tier: two clearly separated homes (no shared vram) ─────────────
  const homeA = mkHome(X_A, 'home a', scene);
  const homeB = mkHome(X_B, 'home b', scene);
  mkLabel('no shared vram', 0.33, scene, { padX: 10 }).sprite.position.set(0, -2.40, 0.12);

  // ── outbound WSS tubes + Yamux inner streams ──────────────────────────────
  const tunA = mkTunnel([[X_A, -0.92, -0.22], [X_A, 0.34, -0.20], [-0.30, 1.82, -0.10]], scene);
  const tunB = mkTunnel([[X_B, -0.92, -0.22], [X_B, 0.34, -0.20], [0.60, 1.82, -0.10]], scene);

  const lblWssA = mkLabel('outbound wss', 0.34, scene, { padX: 10 });
  lblWssA.sprite.position.set(-2.65, 0.58, 0);
  const lblWssB = mkLabel('outbound wss', 0.34, scene, { padX: 10 });
  lblWssB.sprite.position.set(2.68, 0.65, 0);
  const lblYamux = mkLabel('yamux stream', 0.34, scene, { padX: 10 });
  lblYamux.sprite.position.set(2.68, 0.08, 0);
  lblYamux.sprite.material.opacity = 0;

  // ── inbound attempted arrows (when `inbound` toggle is on) ────────────────
  const inbA = mkInboundArrow([-3.35, -0.95, 1.95], [X_A - 0.15, -2.66, 0.94], scene);
  const inbB = mkInboundArrow([0.45, -0.55, 2.05], [X_B - 0.15, -2.66, 0.94], scene);
  const lblInbound = mkLabel('no inbound port needed', 0.35, scene, { padX: 12 });
  lblInbound.sprite.position.set(0, 0.05, 0.85);
  lblInbound.sprite.material.opacity = 0;

  // ── client <-> gateway request/response packet cubes ─────────────────────
  const reqB = mkBox(0.14, 0.14, 0.14, 0x111111, null, scene);
  const reqA = mkBox(0.14, 0.14, 0.14, 0x111111, null, scene);
  const respB = mkBox(0.12, 0.12, 0.12, 0x111111, null, scene);
  const respA = mkBox(0.12, 0.12, 0.12, 0x111111, null, scene);
  for (const m of [reqB, reqA, respB, respA]) m.visible = false;

  // ── simulation state (matches slide control initials) ─────────────────────
  let drop = false;
  let inbound = false;
  let playing = true;
  let t = 0;
  let clock = 0;
  let bOnline = 1;
  let inbVis = 0;
  let bGreyed = false;

  const beatIdx = time => {
    let a = 0;
    for (let i = 0; i < BEATS.length; i++) {
      if (time < a + BEATS[i]) return i;
      a += BEATS[i];
    }
    return BEATS.length - 1;
  };

  function setDropVisual(off) {
    if (bGreyed === off) return;
    bGreyed = off;
    catRows[1].lbl.set('model b', off);
    catRows[1].dot.material.color.setHex(off ? 0xb2b2b2 : 0x181818);
  }

  return {
    view: { target: [0.05, -0.10, 0], radius: 40, theta: 0.22, phi: 1.18, size: 3.4 },

    update(dt) {
      clock += dt;
      if (playing) t = (t + dt) % TOTAL;

      bOnline += ((drop ? 0 : 1) - bOnline) * ease(dt, 6);
      inbVis += ((inbound ? 1 : 0) - inbVis) * ease(dt, 7);
      setDropVisual(drop);

      const beat = beatIdx(t);
      const bt = t - beatStart(beat);

      cTmp1.setHex(0x1e1e1e).lerp(cTmp2.setHex(0xa8a8a8), 1 - bOnline);
      homeB.contrib.material.color.copy(cTmp1);
      cTmp1.setHex(0x2c2c2c).lerp(cTmp2.setHex(0xb4b4b4), 1 - bOnline);
      homeB.server.material.color.copy(cTmp1);

      tunA.drawTube(1, clock);
      tunB.drawTube(bOnline, clock);
      lblWssB.sprite.material.opacity = bOnline;

      const bReqFly = beat === 1 ? seg(bt, 0.05, 0.70) : 0;
      const bReject = drop && beat === 1 ? seg(bt, 0.85, 1.75) : 0;
      const bStreamGrow = !drop && (beat === 1 ? seg(bt, 0.65, 1.45) : beat === 2 ? 1 - seg(bt, 2.0, 2.8) : 0);
      const bTokFlow = !drop && (beat === 1 ? seg(bt, 1.40, 2.0) : beat === 2 ? 1 - seg(bt, 1.8, 2.6) : 0);

      const aReqFly = beat === 2 ? seg(bt, 0.05, 0.70) : 0;
      const aStreamGrow = beat === 2 ? seg(bt, 0.65, 1.40) : 0;
      const aTokFlow = beat === 2 ? seg(bt, 1.35, 2.0) : 0;

      tunB.drawStream(bStreamGrow * bOnline);
      tunB.drawTokens(bTokFlow * bOnline, clock * 0.85);
      tunA.drawStream(aStreamGrow);
      tunA.drawTokens(aTokFlow, clock * 0.85);

      lblYamux.sprite.material.opacity = clamp01(Math.max(bStreamGrow * bOnline, aStreamGrow * 0.9));

      reqB.visible = beat === 1 && bt < 0.75;
      if (reqB.visible) reqB.position.set(-2.1 + 1.65 * bReqFly, 2.35, 0.25);

      reqA.visible = beat === 2 && bt < 0.75;
      if (reqA.visible) reqA.position.set(-2.1 + 1.65 * aReqFly, 2.35, 0.25);

      respB.visible = (bTokFlow > 0.1 && !drop) || (bReject > 0.02 && bReject < 0.98);
      if (respB.visible) {
        const rx = drop ? (-0.45 - 1.65 * bReject) : (-0.45 - 1.65 * ((clock * 0.85) % 1));
        respB.position.set(rx, 2.48, 0.25);
      }

      respA.visible = aTokFlow > 0.1;
      if (respA.visible) {
        const rx = -0.45 - 1.65 * ((clock * 0.85 + 0.5) % 1);
        respA.position.set(rx, 2.22, 0.25);
      }

      catRows[0].dot.material.color.setHex(beat === 2 ? 0x101010 : 0x3a3a3a);
      if (!drop) catRows[1].dot.material.color.setHex(beat === 1 ? 0x101010 : 0x3a3a3a);

      const showUnavail = drop && (beat === 1 || beat === 2) ? 1 : 0;
      lblUnavail.sprite.material.opacity += (showUnavail - lblUnavail.sprite.material.opacity) * ease(dt, 8);

      inbA(inbVis, clock);
      inbB(inbVis, clock);
      lblInbound.sprite.material.opacity = inbVis;

      let readout;
      if (beat === 0) {
        if (drop && inbound) readout = 'wss a ready · contributor b offline · inbound blocked';
        else if (drop) readout = 'wss a ready · contributor b offline · model b unavailable';
        else if (inbound) readout = 'outbound wss ready · inbound blocked at firewall';
        else readout = 'outbound wss ready · catalog: model a, b, c · no inbound port';
      } else if (beat === 1) {
        if (drop && inbound) readout = 'request → model b · unavailable · inbound blocked at firewall';
        else if (drop) readout = 'request → model b · gateway: unavailable (contributor b offline)';
        else if (inbound) readout = 'request → model b · stream 2 in wss b · inbound blocked';
        else readout = 'request → model b · gateway → contributor b · stream 2 in wss b';
      } else {
        if (drop && inbound) readout = 'model b unavailable · model a via wss a · inbound blocked';
        else if (drop) readout = 'model b unavailable · model a active via stream 2 in wss a';
        else if (inbound) readout = 'parallel: wss a + wss b · inbound blocked at firewall';
        else readout = 'parallel: model b (wss b) + model a (wss a) · no shared vram';
      }

      out({ playing, drop, inbound, beat, readout });
    },

    action(name, arg) {
      if (name === 'play') {
        playing = typeof arg === 'boolean' ? arg : !playing;
      } else if (name === 'step') {
        playing = false;
        const next = (beatIdx(t) + 1) % BEATS.length;
        t = beatStart(next) + BEATS[next] * 0.58;
      } else if (name === 'back') {
        playing = false;
        const prev = (beatIdx(t) - 1 + BEATS.length) % BEATS.length;
        t = beatStart(prev) + BEATS[prev] * 0.58;
      } else if (name === 'drop') {
        drop = typeof arg === 'boolean' ? arg : !drop;
      } else if (name === 'inbound') {
        inbound = typeof arg === 'boolean' ? arg : !inbound;
      }
    },
  };
}
