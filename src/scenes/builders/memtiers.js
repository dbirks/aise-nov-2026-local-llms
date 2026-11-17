// Scene `memtiers` — "size, speed and access pattern" (scene-lab brainstorm, README "Scene M").
//
// y = tier (VRAM top, system RAM middle, NVMe bottom), x = capacity axis (log2 scale), z = depth.
// Each shelf is a slab whose WIDTH is its capacity on that log2 scale; a pipe runs from every shelf
// into the GPU cores block on the right, whose THICKNESS is that tier's measured benchmark rate on
// a √ scale, and dark cubes (cube size = transfer granularity) ride along the top of the pipe at
// speed ∝ ∛(measured GB/s), so fast pipes stream and slow pipes trickle. The measured rate is
// printed under each pipe; the tier name + capacity above each shelf.
// RAM and NVMe traffic funnels through one shared host rail (staging / PCIe). The rail is drawn
// WITHOUT a number because the README table has none: the RAM/SSD rates are memory-side and
// disk-side benchmarks, not end-to-end GPU feed rates, and the 1466.75 GB/s row is an on-device GPU
// copy, not GPU↔CPU. Focus sweeps VRAM → RAM → NVMe every ~2.6 s; the readout always names the
// exact benchmark behind the number on screen. Core shading is illustrative — it follows packet
// arrivals, not real SM occupancy. Nothing here is tokens/s.
//
// Sources (README "Actual observed bandwidth numbers" table): RTX PRO 6000 Blackwell 96 GB,
// 1466.75 GB/s GPU copy (Boston Ltd); DDR3-1600 / DDR4-3200 / DDR5-5600 dual-channel read
// 20.5 / 41.5 / 78.0 GB/s (moc-memory-stream-v4); Crucial P510 1 TB CrystalDiskMark SEQ1M Q8T1
// 10.97 GB/s vs RND4K Q1T1 0.0748 GB/s. Different benchmarks, platforms and queue depths — these
// are order-of-magnitude examples, not a controlled side-by-side shootout.
import { THREE, lam, M, Q, P, S, ease, emitter } from './_kit.js';

const XL = -3.05;                       // all shelves share this left edge (capacity baseline)
const SLAB_H = 0.58, SLAB_D = 1.12;
const ROW = { vram: 1.62, ram: 0.0, nvme: -1.62 };
const CAP = { vram: 96, ram: 128, nvme: 2000 };   // 96 GB from the table row; RAM/NVMe = illustrative profile
const RX = 1.72, RAIL_D = 0.9;          // shared host rail (staging / PCIe)
const RAIL_TOP = 1.15;                  // its link runs straight into the block, clear of the VRAM pipe
const GX0 = 2.06, GX1 = 2.90;           // GPU cores block (its near face catches the incoming runs)

const wOf = c => 0.45 + 0.42 * Math.log2(c / 8);          // shelf width: log2 GB
const thick = g => 0.05 + 0.0115 * Math.sqrt(g);          // pipe thickness: √(measured GB/s)
const speed = g => 0.30 * Math.cbrt(g);                   // packet speed: ∛(measured GB/s)

const RAMS = {
  ddr3: { g: 20.5, tag: '20.5 gb/s', line: 'sys ram 128 gb · ddr3-1600 2ch read 20.5 gb/s (moc-memory-stream-v4)' },
  ddr4: { g: 41.5, tag: '41.5 gb/s', line: 'sys ram 128 gb · ddr4-3200 2ch read 41.5 gb/s (moc-memory-stream-v4)' },
  ddr5: { g: 78.0, tag: '78.0 gb/s', line: 'sys ram 128 gb · ddr5-5600 2ch read 78.0 gb/s (moc-memory-stream-v4)' },
};
const NVME = {
  seq: { g: 10.97, tag: '10.97 gb/s', line: 'nvme 2 tb · p510 seq1m q8t1 10.97 gb/s (crystaldiskmark)' },
  rnd: { g: 0.0748, tag: '0.0748 gb/s', line: 'nvme 2 tb · p510 rnd4k q1t1 0.0748 gb/s (crystaldiskmark)' },
};
const VRAM_LINE = 'vram 96 gb · gpu copy 1466.75 gb/s (boston ltd, on-device copy)';

const XE = { vram: XL + wOf(CAP.vram), ram: XL + wOf(CAP.ram), nvme: XL + wOf(CAP.nvme) };
const PATHS = {
  vram: [[XE.vram, ROW.vram, 0], [GX0, ROW.vram, 0]],
  ram: [[XE.ram, ROW.ram, 0.2], [RX, ROW.ram, 0.2], [RX, RAIL_TOP, 0.2], [GX0, RAIL_TOP, 0.2]],
  nvme: [[XE.nvme, ROW.nvme, -0.2], [RX, ROW.nvme, -0.2], [RX, RAIL_TOP, -0.2], [GX0, RAIL_TOP, -0.2]],
};
const INFL = { vram: 6, ram: 4, nvme: 3 };   // packets in flight (queue depth, illustrative)
const PSZ = { vram: 0.19, ram: 0.14, nvme: 0.13 };   // cube size ≈ transfer granularity
const NMAX = 6;
const K = ['vram', 'ram', 'nvme'];
const BEAT = 2.6;

/** short dark-on-transparent text sprite; set() redraws in place */
function mkLabel(text, h = 0.32) {
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthWrite: false, depthTest: false }));
  const set = t => {
    const cv = document.createElement('canvas'), g = cv.getContext('2d');
    const font = 'bold 56px ui-monospace, "DejaVu Sans Mono", monospace';
    g.font = font;
    const w = Math.max(24, Math.ceil(g.measureText(t).width)) + 14;
    cv.width = w; cv.height = 72;
    g.font = font; g.fillStyle = '#131313'; g.textBaseline = 'middle';
    g.fillText(t, 7, 38);
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    sp.material.map?.dispose();
    sp.material.map = tex; sp.material.needsUpdate = true;
    sp.scale.set(h * (w / 72), h, 1);
  };
  set(text);
  return { sprite: sp, set };
}

export default function build(scene, emit) {
  const out = emitter(emit);

  // ── shelves: width = capacity on a log2 scale ──────────────────────────
  const slabs = {};
  for (const k of K) {
    const w = wOf(CAP[k]);
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, SLAB_H, SLAB_D), lam(0xffffff));
    m.position.set(XL + w / 2, ROW[k], 0);
    scene.add(m); slabs[k] = m;
  }

  // ── shared host rail (staging / PCIe, no measured number) + GPU cores block ──
  const rail = new THREE.Mesh(new THREE.BoxGeometry(0.24, RAIL_TOP - ROW.nvme + 0.16, RAIL_D), lam(0xffffff));
  rail.position.set(RX, (RAIL_TOP + ROW.nvme) / 2, 0);
  const gpu = new THREE.Mesh(new THREE.BoxGeometry(GX1 - GX0, 3.62, 0.95), lam(0x4f4f4f));
  gpu.position.set((GX0 + GX1) / 2, 0.24, 0);
  scene.add(rail, gpu);
  const CORES = 14;
  const cores = new THREE.InstancedMesh(new THREE.BoxGeometry(0.13, 0.31, 0.1), lam(0xffffff), CORES);
  const coreX = [GX0 + 0.17, GX1 - 0.17];
  for (let i = 0; i < CORES; i++) {
    P.set(coreX[i % 2], -1.28 + Math.floor(i / 2) * 0.5, 0.5);
    cores.setMatrixAt(i, M.compose(P, Q, S.setScalar(1)));
  }
  scene.add(cores);

  // ── pipes: one box per axis-aligned path segment, thickness animated ────
  const paths = {}, segs = {};
  const XAX = new THREE.Vector3(1, 0, 0);
  for (const k of K) {
    const pts = PATHS[k].map(a => new THREE.Vector3(...a));
    const seg = []; let total = 0;
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], dir = pts[i + 1].clone().sub(a), len = dir.length();
      dir.normalize();
      const m = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), lam(0xffffff));
      m.position.copy(a).addScaledVector(dir, len / 2);
      m.quaternion.setFromUnitVectors(XAX, dir);
      scene.add(m);
      seg.push({ a, dir, len, from: total }); total += len;
      (segs[k] ??= []).push(m);
    }
    paths[k] = { seg, total };
  }
  // point on the path, plus the segment index (0 = horizontal run, 1 = up the rail, …)
  const at = (k, u, v) => {
    const seg = paths[k].seg; let i = 0;
    for (let j = 0; j < seg.length; j++) if (u <= seg[j].from + seg[j].len) { i = j; break; }
    const s = seg[i];
    v.copy(s.a).addScaledVector(s.dir, Math.max(0, Math.min(u - s.from, s.len)));
    return i;
  };
  // packets ride the visible face of whatever they travel on: top of a horizontal pipe, front of
  // the vertical host rail (ram / nvme lanes offset in x so they never stack on the same pixel)
  const ride = (k, i, v, thk, psz) => {
    const seg = paths[k].seg[i];
    if (Math.abs(seg.dir.y) > 0.5) {
      v.z = RAIL_D / 2 + psz / 2 + 0.015;
      v.x = RX + (k === 'ram' ? -0.07 : 0.07);
    } else {
      v.y += thk / 2 + psz / 2 + 0.015;
    }
  };

  // ── packets ────────────────────────────────────────────────────────────
  const pk = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), lam(0xffffff), K.length * NMAX);
  pk.frustumCulled = false;
  scene.add(pk);

  // ── labels: tier names, the measured rate on each pipe, block names ────
  const add = (t, x, y, h = 0.32) => { const l = mkLabel(t, h); l.sprite.position.set(x, y, 0); scene.add(l.sprite); return l; };
  add('vram 96 gb', XL + 1.0, ROW.vram + 0.78);
  add('sys ram 128 gb', XL + 1.35, ROW.ram + 0.78);
  add('nvme 2 tb', XL + 0.9, ROW.nvme + 0.78);
  add('gpu cores', (GX0 + GX1) / 2, 2.42);
  const lblBw = {
    vram: add('1466.75 gb/s', 0.3, ROW.vram - thick(1466.75) / 2 - 0.4, 0.28),
    ram: add(RAMS.ddr5.tag, 0.3, ROW.ram - thick(78) / 2 - 0.4, 0.28),
    nvme: add(NVME.seq.tag, 0.3, ROW.nvme - thick(10.97) / 2 - 0.4, 0.28),
  };

  // ── state ──────────────────────────────────────────────────────────────
  let playing = true, focus = 0, focusT = 0, gen = 'ddr5', access = 'seq';
  const th = { vram: thick(1466.75), ram: thick(78), nvme: thick(10.97) };
  const sp = { vram: speed(1466.75), ram: speed(78), nvme: speed(10.97) };
  const fo = { vram: 1, ram: 0, nvme: 0 };
  const nAmt = { vram: 6, ram: 4, nvme: 3 };
  const pSz = { ...PSZ }, phase = { vram: 0, ram: 0.35, nvme: 0.7 }, busy = { vram: 0, ram: 0, nvme: 0 };
  const bwOf = k => k === 'vram' ? 1466.75 : k === 'ram' ? RAMS[gen].g : NVME[access].g;
  const nOf = k => (k === 'nvme' && access === 'rnd') ? 1 : INFL[k];
  const psOf = k => (k === 'nvme' && access === 'rnd') ? 0.06 : PSZ[k];

  const cDark = new THREE.Color(0x2b2b2b), cMid = new THREE.Color(0x9f9f9f), cInk = new THREE.Color(0x101010);
  const cSoft = new THREE.Color(0x5f5f5f), cPipeIdle = new THREE.Color(0xa9a9a9), cRail = new THREE.Color(0x8d8d8d);
  const tmp = new THREE.Color(), v = new THREE.Vector3(), scl = new THREE.Vector3();
  const setSeg = (m, len, t) => { m.scale.set(len, t, t); };

  return {
    view: { target: [0.05, 0.12, 0], radius: 40, theta: 0.62, phi: 1.12, size: 2.9 },
    update(dt) {
      if (playing) {
        focusT += dt;
        if (focusT >= BEAT) { focusT -= BEAT; focus = (focus + 1) % K.length; }
      }
      let n = 0;
      for (const k of K) {
        const g = bwOf(k);
        th[k] += (thick(g) - th[k]) * ease(dt, 5);
        sp[k] += (speed(g) - sp[k]) * ease(dt, 5);
        fo[k] += ((K[focus] === k ? 1 : 0) - fo[k]) * ease(dt, 7);
        nAmt[k] += (nOf(k) - nAmt[k]) * ease(dt, 6);
        pSz[k] += (psOf(k) - pSz[k]) * ease(dt, 6);
        const total = paths[k].total;
        if (playing) phase[k] = (phase[k] + dt * sp[k] / total) % 1;
        // illustrative "the GPU waits on this tier": cores shade with packet arrivals
        busy[k] += (Math.min(1, (nAmt[k] * sp[k] / total) / 4.5) - busy[k]) * ease(dt, 5);
        segs[k].forEach((m, i) => {
          setSeg(m, paths[k].seg[i].len, th[k]);
          m.material.color.copy(cPipeIdle).lerp(cDark, fo[k]);
        });
        const cnt = Math.max(1, Math.round(nAmt[k]));
        for (let i = 0; i < NMAX; i++) {
          const idx = n++;
          if (i >= cnt) { pk.setMatrixAt(idx, M.compose(P.set(0, -9, 0), Q, S.setScalar(0.001))); continue; }
          const s = Math.max(pSz[k], 0.02);
          ride(k, at(k, ((phase[k] + i / cnt) % 1) * total, v), v, th[k], s);
          pk.setMatrixAt(idx, M.compose(v, Q, scl.setScalar(s)));
          pk.setColorAt(idx, tmp.copy(cSoft).lerp(cInk, 0.4 + 0.6 * fo[k]));
        }
      }
      pk.instanceMatrix.needsUpdate = true;
      if (pk.instanceColor) pk.instanceColor.needsUpdate = true;

      for (const k of K) slabs[k].material.color.copy(cMid).lerp(cDark, fo[k]);
      rail.material.color.copy(cRail).lerp(cDark, Math.max(fo.ram, fo.nvme) * 0.75);
      const level = Math.max(fo.vram * busy.vram, fo.ram * busy.ram, fo.nvme * busy.nvme) * CORES;
      for (let i = 0; i < CORES; i++) {
        cores.setColorAt(i, tmp.copy(cMid).lerp(cInk, Math.max(0, Math.min(1, level - i * 0.55))));
      }
      if (cores.instanceColor) cores.instanceColor.needsUpdate = true;

      const line = K[focus] === 'vram' ? VRAM_LINE : K[focus] === 'ram' ? RAMS[gen].line : NVME[access].line;
      out({ playing, tier: K[focus], ram: gen, access, readout: line });
    },
    action(name, arg) {
      if (name === 'play') { playing = !playing; focusT = 0; }
      else if (name === 'step') { playing = false; focusT = 0; focus = (focus + 1) % K.length; }
      else if (name === 'tier') { const i = K.indexOf(String(arg)); if (i >= 0) { focus = i; focusT = 0; } }
      else if (name === 'ram') { if (RAMS[arg]) { gen = arg; lblBw.ram.set(RAMS[gen].tag); } }
      else if (name === 'access') { if (NVME[arg]) { access = arg; lblBw.nvme.set(NVME[access].tag); } }
    },
  };
}
