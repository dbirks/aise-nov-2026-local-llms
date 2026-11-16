// Splat proc: `qwen-gpu` — a stylised graphics card built live in the browser from Spark
// procedural splats (PackedSplats.pushSplat). No file, no bake: it is regenerated on every mount.
//
// Mechanism this stands for: a "local LLM" box is really a power + board + memory budget. The
// recognisable card silhouette carries the parts that decide what fits: the board, a finned
// cooler, the central logic die ringed by VRAM packages (the memory that caps model size), the
// PCIe edge connector, and two axial fans.
//
// Encodings: the post shader keeps only luminance, so shape is carried by grey level + density.
//   PCB board ............... darkest (0.12) so everything else reads against it
//   PCIe fingers ............ light (0.72), bright comb on the front edge
//   Cooler fins ............. mid-light (0.58) parallel strips = the finned heatsink
//   VRAM packages ........... mid (0.35), eight boxes ringing the die
//   Logic die ............... brightest (0.95) raised island: the focal point
//   Fan rings / blades / hub  light ring (0.72) · mid blades (0.46) · dark hub (0.16)
// Flat disc splats (thin axis ≈ 0.022) lie on their surface's plane so they read as solid plate.
//
// Illustrative primitive geometry: not a real card, no measured specs, no brand.
// Axes: x = board length (PCIe fingers run along the front -z edge), z = board depth, y = up.
import type { SplatProc } from './index';
import type { PackedSplats } from '@sparkjsdev/spark';

// Deterministic PRNG so the render is identical on every load (mulberry32).
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const THICK = 0.022; // disc half-thickness: the "thin" Gaussian axis of a surface splat

const proc: SplatProc = ({ spark, THREE }) => {
  const center = new THREE.Vector3();
  const scales = new THREE.Vector3();
  const q = new THREE.Quaternion(); // identity: discs are axis-aligned; orientation is picked by which axis is thin
  const color = new THREE.Color();
  const rand = rng(1337);

  // One flat disc splat. `normal` = world axis (0=x,1=y,2=z) the disc is thin along.
  const disc = (
    splats: PackedSplats,
    x: number, y: number, z: number,
    r1: number, r2: number, normal: 0 | 1 | 2,
    gray: number, opacity: number,
  ) => {
    const inPlane = normal === 0 ? [1, 2] : normal === 1 ? [0, 2] : [0, 1];
    scales.set(0, 0, 0);
    scales.setComponent(inPlane[0], r1);
    scales.setComponent(inPlane[1], r2);
    scales.setComponent(normal, THICK);
    center.set(x, y, z);
    color.setRGB(gray, gray, gray);
    splats.pushSplat(center, scales, q, opacity, color);
  };

  // Fill a rectangle on a horizontal plane (normal=y) with jittered discs.
  const plate = (
    splats: PackedSplats,
    x0: number, x1: number, z0: number, z1: number, y: number,
    step: number, gray: number, opacity: number,
  ) => {
    const nx = Math.max(1, Math.round((x1 - x0) / step));
    const nz = Math.max(1, Math.round((z1 - z0) / step));
    const dx = (x1 - x0) / nx, dz = (z1 - z0) / nz;
    const r = Math.max(dx, dz) * 0.62;
    for (let i = 0; i < nx; i++) {
      for (let j = 0; j < nz; j++) {
        const px = x0 + (i + 0.5) * dx + (rand() - 0.5) * dx * 0.7;
        const pz = z0 + (j + 0.5) * dz + (rand() - 0.5) * dz * 0.7;
        disc(splats, px, y, pz, r, r, 1, gray, opacity);
      }
    }
  };

  // A ring of discs (fan housing / fan ring).
  const ring = (
    splats: PackedSplats,
    cx: number, cz: number, y: number, radius: number, tube: number,
    gray: number, opacity: number,
  ) => {
    const n = Math.max(10, Math.round((2 * Math.PI * radius) / (tube * 1.15)));
    for (let i = 0; i < n; i++) {
      const t = (i / n) * Math.PI * 2;
      disc(splats, cx + Math.cos(t) * radius, y, cz + Math.sin(t) * radius, tube, tube, 1, gray, opacity);
    }
  };

  // Radial fan blades: nb spokes swept (with a curl) from inner..outer.
  const blades = (
    splats: PackedSplats,
    cx: number, cz: number, y: number, inner: number, outer: number, nb: number,
    gray: number, opacity: number,
  ) => {
    const len = outer - inner;
    const steps = Math.max(4, Math.round(len / 0.032));
    for (let s = 0; s < nb; s++) {
      const ang = (s / nb) * Math.PI * 2;
      for (let k = 0; k <= steps; k++) {
        const f = k / steps;
        const rr = inner + f * len;
        const a2 = ang + f * 0.55; // curl
        disc(splats, cx + Math.cos(a2) * rr, y, cz + Math.sin(a2) * rr, 0.032, 0.024, 1, gray, opacity);
      }
    }
  };

  return new spark.SplatMesh({
    constructSplats: splats => {
      // 1 · PCB board — the darkest plane everything else sits on.
      plate(splats, -2.0, 2.0, -1.0, 1.0, 0.0, 0.036, 0.12, 1.0);

      // 2 · PCIe edge connector — bright comb of vertical tabs on the front (-z) long edge.
      {
        const tabs = 18;
        for (let i = 0; i < tabs; i++) {
          const px = -1.9 + (i / (tabs - 1)) * 3.3;
          disc(splats, px, -0.13, -1.03, 0.028, 0.12, 2, 0.72, 1.0); // thin along z, tall in y
        }
      }

      // 3 · Finned heatsink — parallel bright strips running along z, stacked in x.
      {
        const x0 = -1.72, x1 = 1.72, z0 = -0.86, z1 = 0.86;
        const gap = 0.115;
        const steps = Math.round((z1 - z0) / 0.036);
        for (let fx = x0; fx <= x1 + 1e-6; fx += gap) {
          for (let k = 0; k <= steps; k++) {
            const pz = z0 + (k / steps) * (z1 - z0);
            disc(splats, fx + (rand() - 0.5) * 0.008, 0.11, pz, 0.022, 0.022, 1, 0.58, 1.0);
          }
        }
      }

      // 4 · Central logic die — brightest, raised island, with a hard bright rim.
      plate(splats, -0.23, 0.23, -0.23, 0.23, 0.235, 0.028, 0.95, 1.0);
      ring(splats, 0, 0, 0.24, 0.2, 0.018, 0.99, 0.85);

      // 5 · VRAM packages — eight mid-grey chips ringing the die (diagonal ring, clear of the fans).
      {
        const RX = 0.78, RZ = 0.44, w = 0.085;
        for (let i = 0; i < 8; i++) {
          const t = (i / 8) * Math.PI * 2 + Math.PI / 8;
          const cx = Math.cos(t) * RX, cz = Math.sin(t) * RZ;
          plate(splats, cx - w, cx + w, cz - w, cz + w, 0.175, 0.03, 0.35, 1.0);
        }
      }

      // 6 · Two axial fans sitting above the fins.
      for (const cx of [-1.05, 1.05]) {
        blades(splats, cx, 0, 0.27, 0.12, 0.56, 9, 0.46, 1.0);
        ring(splats, cx, 0, 0.31, 0.63, 0.038, 0.72, 1.0);   // bright housing ring
        ring(splats, cx, 0, 0.31, 0.5, 0.018, 0.6, 0.9);      // inner ring
        plate(splats, cx - 0.14, cx + 0.14, -0.14, 0.14, 0.33, 0.028, 0.16, 1.0); // dark hub
      }

      // 7 · I/O bracket — light vertical strip standing on the far -x end (faces -x).
      for (let k = 0; k < 22; k++) {
        const py = -0.05 + (k / 21) * 0.42;
        disc(splats, -2.02, py, -0.5 + (k % 2) * 0.03, 0.03, 0.03, 0, 0.68, 1.0); // thin along x
      }
    },
  });
};

export default proc;
