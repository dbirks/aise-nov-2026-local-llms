// Splat proc: `fable-gpu` — an exploded graphics card, written by hand as Spark procedural splats
// (method A1: LLM-written generator, runs in the browser on every load, no file, no bake).
//
// Illustrative geometry, not a real board. What each part is:
//   - PCB slab (y = PCB_Y) with a central GPU die, 8 VRAM packages around it on three sides, a VRM
//     column (inductors, MOSFETs, capacitors), a power socket, display-port cans and an I/O bracket.
//   - PCIe edge connector: a tab on the +z long edge with bright contact fingers and a key notch.
//   - Cooler, lifted off the board: cold plate + heat pipes, a stack of real fin planes with bright
//     edges, a dark shroud with three fan openings, and three fans (rim ring, hub, 9 swept blades).
//
// Design for the monochrome dither: splats are unlit, so a Lambert term is baked into each
// splat's grey (top lightest, +z front mid, sides dark). Surfaces are flat discs aligned to the
// face (thin third scale) at ~0.016 unit pitch so they read as solid; only the "explode" guide
// lines are tiny round dots. Fans are separate SplatMeshes so they can spin by object transform.
import type * as THREE_NS from 'three';
import type { PackedSplats } from '@sparkjsdev/spark';
import type { SplatProc } from './index';

type T = typeof THREE_NS;

const THIN = 0.0025;                 // third scale of a surface disc
const LIGHT: [number, number, number] = [0.34, 0.8, 0.5];

interface QuadOpts {
  /** sample pitch along u and v (world units) */
  s?: number;
  sv?: number;
  /** disc sigma as a fraction of the pitch */
  k?: number;
  alpha?: number;
  /** skip the baked Lambert term */
  flat?: boolean;
  /** per-sample tone override: return a grey, or null to leave a hole. a/b are distances along u/v. */
  fn?: (a: number, b: number) => number | null;
}

function painter(splats: PackedSplats, THREE: T) {
  const c = new THREE.Vector3(), sc = new THREE.Vector3(), q = new THREE.Quaternion(), col = new THREE.Color();
  const m = new THREE.Matrix4(), U = new THREE.Vector3(), V = new THREE.Vector3(), N = new THREE.Vector3();
  const ll = Math.hypot(...LIGHT);
  const lambert = (nx: number, ny: number, nz: number) =>
    0.4 + 0.66 * Math.max(0, (nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2]) / ll);

  /** one splat with an explicit frame (u, v in-plane, n = u × v) */
  function put(x: number, y: number, z: number, su: number, sv: number, sn: number, grey: number, alpha = 1) {
    c.set(x, y, z); sc.set(su, sv, sn);
    const g = Math.min(1, Math.max(0, grey));
    col.setRGB(g, g, g);
    splats.pushSplat(c, sc, q, alpha, col);
  }
  function frame(ux: number, uy: number, uz: number, vx: number, vy: number, vz: number) {
    U.set(ux, uy, uz).normalize(); V.set(vx, vy, vz);
    N.crossVectors(U, V).normalize(); V.crossVectors(N, U).normalize();
    m.makeBasis(U, V, N); q.setFromRotationMatrix(m);
    return N;
  }

  /** parallelogram of surface discs: origin o, edges u and v */
  function quad(o: number[], u: number[], v: number[], tone: number, opts: QuadOpts = {}) {
    const s = opts.s ?? 0.016, sv = opts.sv ?? s, k = opts.k ?? 0.62;
    const lu = Math.hypot(u[0], u[1], u[2]), lv = Math.hypot(v[0], v[1], v[2]);
    const nu = Math.max(1, Math.round(lu / s)), nv = Math.max(1, Math.round(lv / sv));
    const n = frame(u[0], u[1], u[2], v[0], v[1], v[2]);
    const lit = opts.flat ? 1 : lambert(n.x, n.y, n.z);
    const du = lu / nu, dv = lv / nv;
    for (let i = 0; i < nu; i++) {
      const a = (i + 0.5) / nu;
      for (let j = 0; j < nv; j++) {
        const b = (j + 0.5) / nv;
        let g = tone;
        if (opts.fn) { const r = opts.fn(a * lu, b * lv); if (r === null) continue; g = r; }
        put(o[0] + u[0] * a + v[0] * b, o[1] + u[1] * a + v[1] * b, o[2] + u[2] * a + v[2] * b,
          du * k, dv * k, THIN, g * lit, opts.alpha ?? 1);
      }
    }
  }

  /** axis-aligned box; faces: t(op) f(ront +z) k(back -z) r(ight +x) l(eft -x) b(ottom) */
  function box(x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, tone: number, faces = 'tfkrl', opts: QuadOpts = {}) {
    const dx = x1 - x0, dy = y1 - y0, dz = z1 - z0;
    if (faces.includes('t')) quad([x0, y1, z1], [dx, 0, 0], [0, 0, -dz], tone, opts);
    if (faces.includes('b')) quad([x0, y0, z0], [dx, 0, 0], [0, 0, dz], tone, opts);
    if (faces.includes('f')) quad([x0, y0, z1], [dx, 0, 0], [0, dy, 0], tone, opts);
    if (faces.includes('k')) quad([x1, y0, z0], [-dx, 0, 0], [0, dy, 0], tone, opts);
    if (faces.includes('r')) quad([x1, y0, z1], [0, 0, -dz], [0, dy, 0], tone, opts);
    if (faces.includes('l')) quad([x0, y0, z0], [0, 0, dz], [0, dy, 0], tone, opts);
  }

  /** horizontal annulus / disc (normal +y), sampled in polar coordinates so the edge is a clean circle */
  function ring(cx: number, cy: number, cz: number, r0: number, r1: number, tone: number, s = 0.016, flat = false) {
    const lit = flat ? 1 : lambert(0, 1, 0);
    const nr = Math.max(1, Math.round((r1 - r0) / s)), dr = (r1 - r0) / nr;
    for (let i = 0; i < nr; i++) {
      const r = r0 + (i + 0.5) * dr;
      const na = Math.max(6, Math.round((2 * Math.PI * r) / s));
      for (let j = 0; j < na; j++) {
        const a = ((j + (i % 2) * 0.5) / na) * 2 * Math.PI, ca = Math.cos(a), sa = Math.sin(a);
        frame(ca, 0, -sa, -sa, 0, -ca);     // u radial, v tangential → n = +y
        put(cx + ca * r, cy, cz - sa * r, dr * 0.62, ((2 * Math.PI * r) / na) * 0.62, THIN, tone * lit);
      }
    }
  }

  /** upright cylinder wall, shaded by its radial normal */
  function wall(cx: number, cz: number, y0: number, y1: number, r: number, tone: number, s = 0.016) {
    const na = Math.max(8, Math.round((2 * Math.PI * r) / s)), ny = Math.max(1, Math.round((y1 - y0) / s));
    for (let j = 0; j < na; j++) {
      const a = (j / na) * 2 * Math.PI, ca = Math.cos(a), sa = Math.sin(a);
      frame(-sa, 0, -ca, 0, 1, 0);           // n = radial (ca, 0, -sa)
      for (let i = 0; i < ny; i++) {
        put(cx + ca * r, y0 + ((i + 0.5) / ny) * (y1 - y0), cz - sa * r,
          ((2 * Math.PI * r) / na) * 0.62, ((y1 - y0) / ny) * 0.62, THIN, tone * lambert(ca, 0, -sa));
      }
    }
  }

  /** thin flat stroke on a horizontal plane (traces, contact fingers, fin edges) */
  function stroke(x0: number, z0: number, x1: number, z1: number, y: number, width: number, tone: number, pitch = 0.03) {
    const len = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.round(len / pitch));
    frame(x1 - x0, 0, z1 - z0, -(z1 - z0), 0, x1 - x0);
    if (N.y < 0) frame(x0 - x1, 0, z0 - z1, -(z1 - z0), 0, x1 - x0);
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n;
      put(x0 + (x1 - x0) * t, y, z0 + (z1 - z0) * t, (len / n) * 0.7, width * 0.5, THIN, tone);
    }
  }

  /** round dust dots along a segment (explode guides) */
  function dots(a: number[], b: number[], tone: number, pitch = 0.055, r = 0.008) {
    const len = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]), n = Math.max(2, Math.round(len / pitch));
    q.identity();
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      put(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t, r, r, r, tone);
    }
  }

  return { put, frame, quad, box, ring, wall, stroke, dots, lambert };
}

// ── layout (world units; x = card length, z = card width, y = up) ─────────────
const PCB_Y = -1.0, PCB_T = 0.04, PCB_TOP = PCB_Y + PCB_T;
const X0 = -1.9, X1 = 1.94, Z0 = -0.8, Z1 = 0.8;
const DIE_X = -0.3, DIE_Z = -0.02;
const COOL_Y = 0.24;                  // underside of the fin stack (exploded gap above the PCB)
const FIN_H = 0.4, FIN_TOP = COOL_Y + FIN_H;
const SHROUD_TOP = FIN_TOP + 0.09;
const FAN_R = 0.56;
const FAN_X = [-1.21, 0.04, 1.29];

const proc: SplatProc = ({ spark, THREE }) => {
  const group = new THREE.Group();

  const card = new spark.SplatMesh({
    constructSplats: splats => {
      const p = painter(splats, THREE);

      // ── PCB ───────────────────────────────────────────────────────────────
      const PCB = 0.36;
      p.box(X0, X1, PCB_Y, PCB_TOP, Z0, Z1, PCB, 'tfkrl');
      // PCIe edge tab with key notch
      const TAB0 = -1.5, TAB1 = 0.34, TABZ = Z1 + 0.19, NOTCH0 = -1.2, NOTCH1 = -1.13;
      for (const [a, b] of [[TAB0, NOTCH0], [NOTCH1, TAB1]]) {
        p.box(a, b, PCB_Y, PCB_TOP, Z1, TABZ, 0.16, 'tfrl');
        // contact fingers: bright strokes across a dark tab
        for (let x = a + 0.03; x < b - 0.02; x += 0.046) p.stroke(x, Z1 + 0.035, x, TABZ - 0.012, PCB_TOP + 0.004, 0.024, 0.98, 0.024);
        for (let x = a + 0.03; x < b - 0.02; x += 0.046) {
          p.frame(1, 0, 0, 0, 1, 0);
          p.put(x, PCB_Y + PCB_T / 2, TABZ + 0.003, 0.012, PCB_T * 0.45, THIN, 0.8);
        }
      }

      // traces (drawn before parts so the parts sit on top of them)
      const TR = 0.52, ty = PCB_TOP + 0.003;
      for (let i = -7; i <= 7; i++) {           // die → PCIe fan-out
        const x = DIE_X + i * 0.035;
        p.stroke(x, DIE_Z + 0.36, x, DIE_Z + 0.5, ty, 0.011, TR);
        p.stroke(x, DIE_Z + 0.5, x - 0.25 + i * 0.03, Z1 - 0.06, ty, 0.011, TR);
      }
      for (let i = -5; i <= 5; i++) {           // VRM → die power lanes
        const z = DIE_Z + i * 0.085;
        p.stroke(DIE_X + 0.82, z * 0.55, 0.78, z, ty, 0.03, 0.46);
      }
      for (let i = 0; i < 9; i++) {             // bracket-side signal bundle
        const z = -0.6 + i * 0.15;
        p.stroke(-1.55, z, -1.12, z * 0.5, ty, 0.011, TR);
      }

      // ── GPU package: substrate, dark stiffener frame, bright die ──────────
      p.box(DIE_X - 0.34, DIE_X + 0.34, PCB_TOP, PCB_TOP + 0.025, DIE_Z - 0.34, DIE_Z + 0.34, 0.6);
      p.box(DIE_X - 0.235, DIE_X + 0.235, PCB_TOP + 0.025, PCB_TOP + 0.04, DIE_Z - 0.235, DIE_Z + 0.235, 0.07);
      p.box(DIE_X - 0.18, DIE_X + 0.18, PCB_TOP + 0.04, PCB_TOP + 0.065, DIE_Z - 0.18, DIE_Z + 0.18, 1.1);
      // cooler mounting holes
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
        p.ring(DIE_X + sx * 0.46, PCB_TOP + 0.004, DIE_Z + sz * 0.46, 0, 0.022, 0.05, 0.012);
        p.ring(DIE_X + sx * 0.46, PCB_TOP + 0.004, DIE_Z + sz * 0.46, 0.026, 0.048, 0.9, 0.012);
      }

      // ── 8 VRAM packages on three sides of the die ─────────────────────────
      const vram = (cx: number, cz: number, alongX: boolean) => {
        const hx = alongX ? 0.15 : 0.105, hz = alongX ? 0.105 : 0.15, y1 = PCB_TOP + 0.045;
        p.box(cx - hx, cx + hx, PCB_TOP, y1, cz - hz, cz + hz, 0.035);
        // pale label bar + pin-1 dot so a chip is not just a black hole
        if (alongX) p.stroke(cx - 0.08, cz + 0.02, cx + 0.08, cz + 0.02, y1 + 0.003, 0.03, 0.42);
        else p.stroke(cx + 0.02, cz - 0.08, cx + 0.02, cz + 0.08, y1 + 0.003, 0.03, 0.42);
        p.ring(cx - hx + 0.035, y1 + 0.003, cz + hz - 0.035, 0, 0.014, 0.75, 0.01);
      };
      for (const dz of [-0.36, 0, 0.36]) { vram(DIE_X - 0.6, DIE_Z + dz, false); vram(DIE_X + 0.6, DIE_Z + dz, false); }
      for (const dx of [-0.19, 0.19]) vram(DIE_X + dx, DIE_Z - 0.6, true);

      // ── VRM: inductors, MOSFETs, capacitors ───────────────────────────────
      for (let i = 0; i < 7; i++) {
        const z = -0.6 + i * 0.2;
        p.box(0.82, 0.98, PCB_TOP, PCB_TOP + 0.12, z - 0.075, z + 0.075, 0.62);          // inductor
        p.box(0.855, 0.945, PCB_TOP + 0.12, PCB_TOP + 0.123, z - 0.04, z + 0.04, 0.3, 't'); // its label inset
        p.box(1.07, 1.17, PCB_TOP, PCB_TOP + 0.03, z - 0.06, z + 0.06, 0.06);            // MOSFET
        p.wall(1.34, z, PCB_TOP, PCB_TOP + 0.14, 0.052, 0.22, 0.014);                     // capacitor can
        p.ring(1.34, PCB_TOP + 0.14, z, 0, 0.052, 1.05, 0.012);
        p.stroke(1.305, z, 1.375, z, PCB_TOP + 0.143, 0.01, 0.3, 0.02);                   // vent score
      }
      // power socket on the back edge, 2 × 6 pins
      p.box(1.42, 1.86, PCB_TOP, PCB_TOP + 0.2, Z0 + 0.03, Z0 + 0.25, 0.06);
      for (let i = 0; i < 6; i++) for (let j = 0; j < 2; j++) {
        p.box(1.455 + i * 0.066, 1.495 + i * 0.066, PCB_TOP + 0.2, PCB_TOP + 0.203, Z0 + 0.065 + j * 0.085, Z0 + 0.115 + j * 0.085, 0.8, 't', { s: 0.012 });
      }
      // small passives sprinkled in rows (reads as "populated board")
      for (let i = 0; i < 16; i++) {
        const x = 1.5 + (i % 4) * 0.1, z = -0.1 + Math.floor(i / 4) * 0.17;
        p.box(x, x + 0.05, PCB_TOP, PCB_TOP + 0.02, z, z + 0.03, i % 3 ? 0.75 : 0.08, 'tf', { s: 0.012 });
      }

      // ── I/O bracket + display-port cans ───────────────────────────────────
      const BX = X0 - 0.035, BY0 = PCB_Y - 0.12, BY1 = PCB_Y + 0.74;
      const ports = [-0.58, -0.2, 0.18, 0.56];
      const bracketFace = (a: number, b: number) => {          // a along z from Z0-0.04, b along y from BY0
        const z = Z0 - 0.04 + a, y = BY0 + b;
        for (const pz of ports) if (Math.abs(z - pz) < 0.13 && y > PCB_TOP + 0.03 && y < PCB_TOP + 0.15) return 0.05;
        // vent slots above the ports
        if (y > PCB_TOP + 0.26 && y < BY1 - 0.08 && Math.abs(z) < 0.7 && (((z + 2) / 0.085) % 1) < 0.45 && (((y + 2) / 0.19) % 1) < 0.72) return 0.1;
        return 0.84;
      };
      p.quad([BX, BY0, Z0 - 0.04], [0, 0, 1.68], [0, BY1 - BY0, 0], 0.84, { fn: bracketFace });                       // inner face (+x)
      p.quad([BX - 0.02, BY0, Z0 - 0.04], [0, 0, 1.68], [0, BY1 - BY0, 0], 0.84, { fn: bracketFace, flat: true });   // outer face
      p.quad([BX - 0.02, BY1, Z1 + 0.04], [0.02, 0, 0], [0, 0, -1.68], 0.9, { s: 0.01, sv: 0.016 });                  // top edge
      for (const pz of ports) p.box(BX, BX + 0.3, PCB_TOP, PCB_TOP + 0.16, pz - 0.14, pz + 0.14, 0.58, 'tfkr');

      // ── cooler: cold plate + heat pipes ───────────────────────────────────
      p.box(DIE_X - 0.32, DIE_X + 0.32, COOL_Y - 0.14, COOL_Y - 0.03, DIE_Z - 0.32, DIE_Z + 0.32, 0.7, 'tfkrlb');
      for (const z of [-0.36, -0.12, 0.12, 0.36]) {
        // a pipe = short rings of surface discs around the x axis
        const R = 0.036, NA = 10;
        for (let x = X0 + 0.25; x < X1 - 0.15; x += 0.026) {
          for (let j = 0; j < NA; j++) {
            const a = (j / NA) * 2 * Math.PI, ny = Math.cos(a), nz = Math.sin(a);
            p.frame(1, 0, 0, 0, -nz, ny);
            p.put(x, COOL_Y - 0.035 + ny * R, DIE_Z + z + nz * R, 0.017, R * 0.42, THIN, 0.66 * p.lambert(0, ny, nz));
          }
        }
      }
      // base plate closing the underside of the fin stack (what you see in the gaps between fins)
      p.quad([X0 + 0.12, COOL_Y, Z1 - 0.05], [X1 - X0 - 0.18, 0, 0], [0, 0, -(Z1 - Z0 - 0.1)], 0.07, { s: 0.022, flat: true });

      // ── fin stack: real planes, dark faces, bright edges ──────────────────
      const FZ0 = Z0 + 0.05, FZ1 = Z1 - 0.05, PITCH = 0.074;
      for (let x = X0 + 0.14; x <= X1 - 0.08; x += PITCH) {
        // the face is authored unlit: dark, slightly lighter towards the top so depth reads
        p.quad([x, COOL_Y, FZ1], [0, 0, FZ0 - FZ1], [0, FIN_H, 0], 0.2, {
          s: 0.03, sv: 0.03, flat: true, fn: (_a, b) => 0.1 + 0.2 * (b / FIN_H),
        });
        p.stroke(x, FZ0, x, FZ1, FIN_TOP, 0.02, 0.5, 0.035);                 // top edge
        for (const z of [FZ0, FZ1]) {                                           // front + back edge
          p.frame(1, 0, 0, 0, 1, 0);
          for (let i = 0; i < 12; i++) p.put(x, COOL_Y + ((i + 0.5) / 12) * FIN_H, z, 0.011, (FIN_H / 12) * 0.7, THIN, z > 0 ? 0.8 : 0.55);
        }
      }

      // ── shroud: dark top plate with three fan openings, skirts, end caps ──
      const SH = 0.3, SKIRT = 0.13, SX0 = X0 + 0.06, SX1 = X1 + 0.02, SK = FIN_TOP - 0.1;
      const hole = (x: number, z: number) => FAN_X.some(fx => Math.hypot(x - fx, z) < FAN_R + 0.026);
      p.quad([SX0, SHROUD_TOP, Z1], [SX1 - SX0, 0, 0], [0, 0, Z0 - Z1], SH, {
        s: 0.014,
        fn: (a, b) => {
          const x = SX0 + a, z = Z1 - b;
          if (hole(x, z)) return null;
          // dark seams in the webs between the fans and a dark pinstripe inside both long edges
          for (const mx of [-0.585, 0.665]) if (Math.abs(x - mx) < 0.014 && Math.abs(z) > 0.3) return 0.08;
          if (Math.abs(Math.abs(z) - 0.735) < 0.012) return 0.08;
          return SH;
        },
      });
      p.quad([SX0, SK, Z1], [SX1 - SX0, 0, 0], [0, SHROUD_TOP - SK, 0], SKIRT + 0.05, {                 // front skirt
        fn: (a, b) => (Math.abs(a - (SX1 - SX0) / 2) < 0.62 && Math.abs(b - 0.085) < 0.022 ? 1.25 : SKIRT + 0.05),   // light bar
      });
      p.quad([SX1, SK, Z0], [SX0 - SX1, 0, 0], [0, SHROUD_TOP - SK, 0], SKIRT);                       // back skirt
      p.quad([SX1, COOL_Y + 0.1, Z1], [0, 0, Z0 - Z1], [0, SHROUD_TOP - COOL_Y - 0.1, 0], SKIRT + 0.12); // +x end cap
      p.quad([SX0, COOL_Y + 0.1, Z0], [0, 0, Z1 - Z0], [0, SHROUD_TOP - COOL_Y - 0.1, 0], SKIRT);     // -x end cap
      // bevel highlights on the two shroud edges that face the default camera
      p.stroke(SX0, Z1 - 0.004, SX1, Z1 - 0.004, SHROUD_TOP + 0.004, 0.02, 0.62, 0.03);
      p.stroke(SX1 - 0.004, Z0, SX1 - 0.004, Z1, SHROUD_TOP + 0.004, 0.02, 0.5, 0.03);
      // fan bezels: a pale ring around each opening gives the three circles a hard edge
      for (const fx of FAN_X) {
        p.ring(fx, SHROUD_TOP + 0.006, 0, FAN_R - 0.025, FAN_R + 0.04, 1.1, 0.01);
        p.wall(fx, 0, FIN_TOP + 0.01, SHROUD_TOP, FAN_R - 0.025, 0.12, 0.02);
      }

      // ── explode guides: dotted verticals from the board corners to the cooler ──
      for (const x of [X0 + 0.14, X1 - 0.1]) for (const z of [Z0 + 0.05, Z1 - 0.05]) {
        p.dots([x, PCB_TOP + 0.02, z], [x, COOL_Y - 0.02, z], 0.4);
      }
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
        p.dots([DIE_X + sx * 0.3, PCB_TOP + 0.08, DIE_Z + sz * 0.3], [DIE_X + sx * 0.3, COOL_Y - 0.16, DIE_Z + sz * 0.3], 0.3, 0.045);
      }
    },
  });
  group.add(card);

  // ── fans: one SplatMesh each, spun slowly by object rotation ────────────────
  const last = FAN_X.map(() => performance.now()), smooth = FAN_X.map(() => 0.25);
  FAN_X.forEach((fx, fi) => {
    const fan = new spark.SplatMesh({
      constructSplats: splats => {
        const p = painter(splats, THREE);
        const BLADES = 7, R0 = 0.15, R1 = FAN_R - 0.05, CHORD = 0.6, SWEEP = 0.55;
        for (let k = 0; k < BLADES; k++) {
          const a0 = (k / BLADES) * 2 * Math.PI;
          const nr = 26;
          for (let i = 0; i < nr; i++) {
            const u = (i + 0.5) / nr, r = R0 + u * (R1 - R0);
            const arc = r * CHORD, nt = Math.max(3, Math.round(arc / 0.014));
            for (let j = 0; j < nt; j++) {
              const t = (j + 0.5) / nt;
              const a = a0 + SWEEP * u * u + (t - 0.5) * CHORD * (0.75 + 0.25 * Math.sin(u * Math.PI));
              const ca = Math.cos(a), sa = Math.sin(a);
              // pitched blade: leading edge high and light, trailing edge low and dark
              p.frame(ca, 0, -sa, -sa, 0.22, -ca);
              p.put(ca * r, (t - 0.5) * 0.07, -sa * r, ((R1 - R0) / nr) * 0.66, (arc / nt) * 0.66, THIN, t < 0.12 ? 0.3 : 0.72 + 0.3 * t);
            }
          }
        }
        p.wall(0, 0, -0.04, 0.05, R0 + 0.01, 0.2, 0.014);
        p.ring(0, 0.05, 0, 0, R0 + 0.01, 0.1, 0.012);
        p.ring(0, 0.053, 0, 0.055, 0.085, 1.1, 0.01);       // hub sticker ring
              },
      // Spin only while frames are fast. Spark re-sorts splats asynchronously, so on a slow
      // (software-GL) renderer a turning fan would be drawn with a stale depth order and its
      // blades would sink behind the fins; there the fans simply stand still.
      onFrame: ({ mesh }) => {
        const now = performance.now(), dt = Math.min(0.25, (now - last[fi]) / 1000);
        last[fi] = now;
        smooth[fi] += (dt - smooth[fi]) * 0.1;
        if (smooth[fi] < 0.034) mesh.rotation.y -= dt * 0.6;
      },
    });
    fan.rotation.y = fi * 0.5;
    fan.position.set(fx, FIN_TOP + 0.075, 0);
    group.add(fan);
  });

  return group;
};

export default proc;
