// Splat proc: `qwen-embedding` — an illustrative "embedding cloud", built live in the browser from
// Spark procedural splats (PackedSplats.pushSplat). No file, no bake: regenerated on every mount.
//
// What this is, honestly: a decorative particle picture that EVOKES the idea of tokens living in a
// high-dimensional space and a query pulling up its nearest neighbours. It is NOT a projection of
// any real model's embeddings — no model, no layer, no token vectors, no t-SNE/UMAP here. Real
// static-embedding relationships do not generalise to contextual residual streams, so this slide is
// labelled illustrative in its caption and must never be read as measured geometry.
//
// Encodings (luminance only — the post shader drops hue). The sage post shader maps 0=dark→bg page
// is light, so a DARKER cloud reads as a mass and light/dark accents read on top of it:
//   ~5 soft clusters ... dust splats (round, scale ≈0.03), mid-dark grey (≈0.40); Gaussian density
//                        makes a solid core that dissolves to the light page at the edges, and the
//                        clusters are spread far enough apart that light gaps separate them.
//   query points ....... a few DARK splats (0.03) ringed by a bright halo so they pop off the cloud.
//   filaments .......... thin BRIGHT (0.95) threads of splats from each query to its nearest cluster
//                        centre — reads as a faint light string: a decorative "nearest neighbour".
import type { SplatProc } from './index';
import type { PackedSplats } from '@sparkjsdev/spark';

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Clouds spread across a ~4-unit extent, centred on the origin, y-up. Sigmas kept tight and
// centres far apart so the light page shows between the clusters.
const CLUSTERS = [
  { c: [-1.5, 0.9, 0.55], s: 0.52, n: 9000 },
  { c: [1.55, 0.8, -0.65], s: 0.54, n: 8400 },
  { c: [-1.0, -1.25, -0.9], s: 0.5, n: 8200 },
  { c: [1.15, -1.05, 0.95], s: 0.5, n: 8400 },
  { c: [0.15, 0.1, -0.05], s: 0.36, n: 5000 },
];

// A few "queries": [x,y,z]. Each pulls a bright thread toward the nearest cluster centre.
const QUERIES = [
  [-1.95, 1.7, 1.1],
  [2.1, 1.75, -1.35],
  [0.55, -1.95, 1.7],
  [-1.35, -1.95, -1.7],
];

const DUST = 0.028; // round splat radius for cloud dust
const DUST_GRAY = 0.4; // mid-dark so the cloud body reads against the light page

const proc: SplatProc = ({ spark, THREE }) => {
  const center = new THREE.Vector3();
  const scales = new THREE.Vector3();
  const q = new THREE.Quaternion();
  const color = new THREE.Color();
  const rand = rng(24601);

  const gauss = () => {
    let u = 0, v = 0;
    while (u === 0) u = rand();
    while (v === 0) v = rand();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };

  const push = (splats: PackedSplats, x: number, y: number, z: number, gray: number, r: number, op: number) => {
    center.set(x, y, z);
    scales.set(r, r, r);
    color.setRGB(gray, gray, gray);
    splats.pushSplat(center, scales, q, op, color);
  };

  return new spark.SplatMesh({
    constructSplats: splats => {
      // 1 · Soft clusters of dust. Density concentrates a core; splats thin out toward the edges.
      for (const cl of CLUSTERS) {
        for (let i = 0; i < cl.n; i++) {
          // pull a little toward the centre so the core reads solid
          const bias = 0.75 + rand() * 0.45;
          push(
            splats,
            cl.c[0] + gauss() * cl.s * bias,
            cl.c[1] + gauss() * cl.s * bias,
            cl.c[2] + gauss() * cl.s * bias,
            DUST_GRAY + (rand() - 0.5) * 0.06,
            DUST * (0.75 + rand() * 0.6),
            0.5,
          );
        }
      }

      // 2 · Queries + 3 · bright filaments to the nearest cluster centre.
      for (const [qx, qy, qz] of QUERIES) {
        let best = CLUSTERS[0], bd = Infinity;
        for (const cl of CLUSTERS) {
          const d = (cl.c[0] - qx) ** 2 + (cl.c[1] - qy) ** 2 + (cl.c[2] - qz) ** 2;
          if (d < bd) { bd = d; best = cl; }
        }

        // bright thread: dense run of small splats from the query toward the cluster core
        const ex = best.c[0], ey = best.c[1], ez = best.c[2];
        const steps = 70;
        for (let k = 0; k <= steps; k++) {
          const f = k / steps;
          const taper = Math.sin(Math.min(1, f * 1.15) * Math.PI * 0.5); // fade as it enters the cloud
          push(
            splats,
            qx + (ex - qx) * f,
            qy + (ey - qy) * f,
            qz + (ez - qz) * f,
            0.95,
            0.024 - 0.01 * f,
            0.55 + 0.4 * taper,
          );
        }

        // the query point itself: darkest, largest, plus a bright halo ring so it reads as a marker
        push(splats, qx, qy, qz, 0.03, 0.11, 1.0);
        const HR = 0.17;
        const ringN = 16;
        for (let i = 0; i < ringN; i++) {
          const a = (i / ringN) * Math.PI * 2;
          push(splats, qx + Math.cos(a) * HR, qy + Math.sin(a) * HR, qz, 0.96, 0.02, 0.9);
        }
      }
    },
  });
};

export default proc;
