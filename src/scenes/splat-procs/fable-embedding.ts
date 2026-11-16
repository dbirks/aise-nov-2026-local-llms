// Splat proc: `fable-embedding` — an ILLUSTRATIVE "embedding cloud" (method A1: LLM-written Spark
// code, built in the browser on every load).
//
// NOT a projection of real embeddings: every point is drawn from a seeded random generator. Six
// hand-placed synthetic clusters (blob, tight core, arc, dumbbell, sheet, satellite) plus a thin
// haze, 40 000 particles in total. Four "query" markers sit just outside a cluster; each is joined
// to its 7 nearest cluster particles — a real brute-force k-NN, but over the synthetic points.
//
// Design for the monochrome dither:
//   - particles are tiny round Gaussians (dust); each cluster has its own grey, darker in the
//     core and paler at the fringe, so clusters separate by tone as well as by position;
//   - queries are black beads with a three-axis jack so they read as markers from any angle;
//   - filaments are thin elongated splats. The background is the lightest tone of the ramp, so
//     the filaments are dark hairlines (bright ones would vanish against it);
//   - a dotted floor with soft flat "shadow" discs under the clusters gives the depth cue that
//     unlit splats cannot.
import type { SplatProc } from './index';

function mulberry(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const FLOOR_Y = -1.72;
const K = 7;
const G = 0.9;                       // global scale: keeps the turning cloud inside ~4 units

const proc: SplatProc = ({ spark, THREE }) => new spark.SplatMesh({
  constructSplats: splats => {
    const rand = mulberry(20261116);
    const gauss = () => { let u = 0; while (!u) u = rand(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rand()); };

    const c = new THREE.Vector3(), sc = new THREE.Vector3(), q = new THREE.Quaternion(), ID = new THREE.Quaternion(), col = new THREE.Color();
    const m = new THREE.Matrix4(), U = new THREE.Vector3(), V = new THREE.Vector3(), N = new THREE.Vector3();
    const put = (x: number, y: number, z: number, sx: number, sy: number, sz: number, grey: number, alpha: number, quat = ID) => {
      c.set(x * G, y * G, z * G); sc.set(sx * G, sy * G, sz * G);
      const g = Math.min(1, Math.max(0, grey)); col.setRGB(g, g, g);
      splats.pushSplat(c, sc, quat, alpha, col);
    };

    // ── floor: dotted grid (drawn first; it is the palest thing in the scene) ──
    const FL = 2.0;
    for (let i = -4; i <= 4; i++) {
      const a = (i / 4) * FL, major = i % 2 === 0;
      for (let t = -FL; t <= FL + 1e-6; t += major ? 0.05 : 0.1) {
        put(a, FLOOR_Y, t, 0.007, 0.002, 0.007, major ? 0.5 : 0.62, 0.9);
        put(t, FLOOR_Y, a, 0.007, 0.002, 0.007, major ? 0.5 : 0.62, 0.9);
      }
    }

    // ── synthetic clusters ────────────────────────────────────────────────
    const P: number[] = [];                           // xyz of every cluster particle, for the k-NN below
    const shadows: number[] = [];
    /** push one particle; `d` ≈ distance from the cluster core in sigmas (drives tone and size) */
    const particle = (x: number, y: number, z: number, d: number, tone: number, knn = true) => {
      if (y < FLOOR_Y + 0.05) y = FLOOR_Y + 0.05 + rand() * 0.05;
      const fringe = Math.min(1, d / 2.6);
      const r = 0.011 + 0.006 * rand() + 0.006 * (1 - fringe) * (1 - tone);
      put(x, y, z, r, r, r, tone + (0.7 - tone) * fringe * fringe * fringe * 0.6 + (rand() - 0.5) * 0.05, 0.95);
      if (knn) P.push(x, y, z);
      if (rand() < 0.3) shadows.push(x, z);
    };

    // A · big diffuse blob (mid grey)
    for (let i = 0; i < 11000; i++) {
      const a = gauss(), b = gauss(), g = gauss();
      particle(-0.45 + a * 0.5 + b * 0.12, 0.25 + b * 0.4, -0.45 + g * 0.46 - a * 0.1, Math.hypot(a, b, g), 0.5);
    }
    // B · tight dense core (near black)
    for (let i = 0; i < 6000; i++) {
      const a = gauss(), b = gauss(), g = gauss();
      particle(1.15 + a * 0.19, 0.95 + b * 0.21 + a * 0.05, 0.25 + g * 0.19, Math.hypot(a, b, g), 0);
    }
    // C · arc: a curved 1-D manifold with a thin tube around it
    for (let i = 0; i < 7000; i++) {
      const t = (rand() - 0.5) * 2.5, R = 0.95;
      const a = gauss(), b = gauss(), g = gauss();
      const taper = 0.1 + 0.05 * Math.cos(t * 1.2);
      particle(0.25 + Math.sin(t) * R + a * taper, -1.2 + Math.cos(t) * R * 0.75 + b * taper, 0.95 - Math.abs(t) * 0.22 + g * taper * 1.2,
        Math.hypot(a, b, g), 0.17);
    }
    // D · dumbbell: two lobes and a sparse bridge
    for (let i = 0; i < 5500; i++) {
      const a = gauss(), b = gauss(), g = gauss(), w = rand();
      const t = w < 0.46 ? 0 : w < 0.92 ? 1 : rand();
      const s = t === 0 || t === 1 ? 0.19 : 0.07;
      particle(-1.45 + t * 0.5 + a * s, 1.0 + t * 0.55 + b * s, 0.65 - t * 0.8 + g * s, Math.hypot(a, b, g), 0.3);
    }
    // E · sheet: a tilted, nearly flat pancake
    for (let i = 0; i < 5500; i++) {
      const a = gauss(), b = gauss(), g = gauss();
      const x = a * 0.5, y = b * 0.055, z = g * 0.38;
      particle(1.2 + x * 0.92 - y * 0.38, -0.55 + x * 0.38 + y * 0.92 + z * 0.2, -0.85 + z, Math.hypot(a, b, g), 0.07);
    }
    // F · small satellite (black)
    for (let i = 0; i < 2500; i++) {
      const a = gauss(), b = gauss(), g = gauss();
      particle(-1.5 + a * 0.13, -0.75 + b * 0.15, 0.95 + g * 0.13, Math.hypot(a, b, g), 0);
    }
    // haze · sparse pale outliers everywhere
    for (let i = 0; i < 2500; i++) {
      particle(gauss() * 0.85, 0.1 + gauss() * 0.75, gauss() * 0.85, 2.6, 0.55, false);
    }

    // soft floor shadows: flat, wide, very transparent discs that add up under dense regions
    for (let i = 0; i < shadows.length; i += 2) {
      if (Math.abs(shadows[i]) > FL || Math.abs(shadows[i + 1]) > FL) continue;
      put(shadows[i], FLOOR_Y + 0.004, shadows[i + 1], 0.034, 0.002, 0.034, 0.5, 0.07);
    }

    // ── queries: bead + jack + drop line, joined to their K nearest particles ──
    const strokeTo = (ax: number, ay: number, az: number, bx: number, by: number, bz: number, width: number, grey: number, alpha: number, pitch = 0.03) => {
      const dx = bx - ax, dy = by - ay, dz = bz - az, len = Math.hypot(dx, dy, dz), n = Math.max(1, Math.round(len / pitch));
      U.set(dx, dy, dz).normalize();
      V.set(0, 1, 0); if (Math.abs(U.y) > 0.9) V.set(1, 0, 0);
      N.crossVectors(U, V).normalize(); V.crossVectors(N, U);
      m.makeBasis(U, V, N); q.setFromRotationMatrix(m);
      for (let i = 0; i < n; i++) {
        const t = (i + 0.5) / n;
        put(ax + dx * t, ay + dy * t, az + dz * t, (len / n) * 0.75, width, width, grey, alpha, q);
      }
    };

    /** the K nearest cluster particles to a point (brute force over the synthetic data) */
    const nearest = (qx: number, qy: number, qz: number) => {
      const best: { d: number; i: number }[] = [];
      for (let i = 0; i < P.length; i += 3) {
        const d = (P[i] - qx) ** 2 + (P[i + 1] - qy) ** 2 + (P[i + 2] - qz) ** 2;
        if (best.length < K) { best.push({ d, i }); best.sort((a, b) => a.d - b.d); }
        else if (d < best[K - 1].d) { best[K - 1] = { d, i }; best.sort((a, b) => a.d - b.d); }
      }
      return best;
    };

    // Each query starts at a cluster core and walks outwards along a hand-picked direction until
    // its nearest particle is CLEAR units away, so the filaments are long enough to see.
    const CLEAR = 0.42;
    const rays: [number[], number[]][] = [
      [[1.15, 0.95, 0.25], [0.6, -0.5, 0.62]],      // off the tight core B
      [[-1.5, -0.75, 0.95], [0.75, 0.4, 0.5]],      // off the satellite F
      [[1.2, -0.55, -0.85], [-0.62, 0.45, -0.64]],  // between sheet E and blob A
      [[-1.45, 1.0, 0.65], [0.35, -0.25, 0.9]],     // off the dumbbell D
    ];
    for (const [o, dir] of rays) {
      const dl = Math.hypot(dir[0], dir[1], dir[2]);
      let qx = o[0], qy = o[1], qz = o[2], best = nearest(qx, qy, qz);
      for (let step = 0; step < 60 && best[0].d < CLEAR * CLEAR; step++) {
        qx += (dir[0] / dl) * 0.05; qy += (dir[1] / dl) * 0.05; qz += (dir[2] / dl) * 0.05;
        best = nearest(qx, qy, qz);
      }
      for (const { i } of best) {
        strokeTo(qx, qy, qz, P[i], P[i + 1], P[i + 2], 0.0065, 0.05, 0.95);
        put(P[i], P[i + 1], P[i + 2], 0.026, 0.026, 0.026, 0, 1);            // the retrieved neighbour
      }
      // bead
      put(qx, qy, qz, 0.05, 0.05, 0.05, 0, 1);
      put(qx, qy, qz, 0.05, 0.05, 0.05, 0, 1);
      // three-axis jack
      const J = 0.17;
      strokeTo(qx - J, qy, qz, qx + J, qy, qz, 0.011, 0, 1, 0.04);
      strokeTo(qx, qy - J, qz, qx, qy + J, qz, 0.011, 0, 1, 0.04);
      strokeTo(qx, qy, qz - J, qx, qy, qz + J, 0.011, 0, 1, 0.04);
      // dotted drop line to a ring on the floor, so the eye can place the query in depth
      for (let y = qy - 0.24; y > FLOOR_Y + 0.03; y -= 0.07) put(qx, y, qz, 0.008, 0.016, 0.008, 0.25, 0.95);
      for (let j = 0; j < 40; j++) {
        const a = (j / 40) * 2 * Math.PI;
        put(qx + Math.cos(a) * 0.1, FLOOR_Y + 0.006, qz + Math.sin(a) * 0.1, 0.011, 0.002, 0.011, 0.12, 1);
      }
    }
  },
});

export default proc;
