// Splat-lab A3 · SyntaxSplat scene code — "Transformer layer stack" (illustrative).
// Copied into the SyntaxSplat clone's scenes/ folder by tools/splats/a3/make.sh.
// Deterministic, no DOM, no Math.random (the scene runs again in every bake worker).
//
// Eight blocks climbing a rail; each block is two plates (an attention slab and a
// feed-forward slab) with four small head tiles on the lower one. The block count is a
// picture, not a claim about any model's depth, and the "staircase" drift is decorative.
// Colour is a luminance ladder — the talk's renderer keeps only luminance.
import { prim, box, cylinder, limb, addPart, noise, mix3, hex, mulberry32 } from '../engine.js';

const C = {
  rail: hex(0x2c3128), //     spine, pallet        ~0.19
  rim: hex(0x43483f), //      slab rims            ~0.28
  head: hex(0x6b706a), //     head tiles           ~0.44
  attn0: hex(0x7d827b), //    attention slab       ~0.51
  attn1: hex(0xa8ada4),
  ffn0: hex(0x949990), //     feed-forward slab    ~0.60
  ffn1: hex(0xc6cbc1), //      ... grading lighter ~0.79
  pin: hex(0x8b8e7c), //      connector pads       ~0.56
  led: hex(0xd2d8ce), //      emissive marker      ~0.83
};

const grain = (p, lo, hi) => mix3(lo, hi, noise(p[0] * 6, p[1] * 6, p[2] * 6));

// Lit ramp (dark → light) for the pixel-art pass; also read by the offline snap.
export const palette = [
  0x1b1e18, 0x2c3128, 0x3a3f36, 0x43483f, 0x545a50, 0x6b706a, 0x7d827b, 0x8d9389,
  0x9aa095, 0xa8ada4, 0xb7bcb2, 0xc6cbc1, 0xd2d8ce,
];

const N = 8; // blocks in the stack
const GAP = 0.26; // between the two plates of one block
const STEP = 0.44; // between blocks
const rng = mulberry32(20261116);

export default function build() {
  // Pallet and cap: dark plates that frame the stack and give it a base.
  addPart({
    name: 'pallet', size: 0.033, band: 0.028, coverage: 3, k: 0.02,
    prims: [
      prim(box(1.45, 0.06, 1.05, 0.03), { pos: [0, -0.34, 0] }),
      prim(box(1.45, 0.06, 1.05, 0.03), { pos: [0.9, (N - 1) * STEP + 0.66, 0] }),
      prim(cylinder(0.07, 0.09), { pos: [-1.2, -0.46, -0.8] }),
      prim(cylinder(0.07, 0.09), { pos: [1.2, -0.46, -0.8] }),
      prim(cylinder(0.07, 0.09), { pos: [-1.2, -0.46, 0.8] }),
      prim(cylinder(0.07, 0.09), { pos: [1.2, -0.46, 0.8] }),
    ],
    colorFn: (p) => grain(p, C.rail, C.rim),
  });

  // Residual spine: one ribbed limb beside the stack with a stub into every block.
  {
    const prims = [limb([-1.78, -0.3, 0], [-1.78 + 0.9, (N - 1) * STEP + 0.7, 0], 0.06, 0.06, { tag: 'spine', rib: 0.2, freq: 30 })];
    for (let i = 0; i < N; i++) prims.push(limb([-1.7 + i * 0.11, i * STEP + 0.08, 0], [-1.02 + i * 0.11, i * STEP + 0.08, 0], 0.032, 0.032, { tag: 'tap' }));
    addPart({
      name: 'residual', size: 0.020, band: 0.014, coverage: 3.5, k: 0.014, prims,
      colorFn: (p, n, q) => (q.tag === 'tap' ? grain(p, C.pin, C.attn1) : grain(p, C.rim, C.pin)),
    });
  }

  // One part per block: the engine wants a rigid body per moving/graded piece, and it
  // lets every block sit a little further along its own luminance ramp.
  for (let i = 0; i < N; i++) {
    const y = i * STEP;
    const x = -0.55 + i * 0.155; // the staircase drift
    const z = 0.18 * Math.sin(i * 1.1);
    const g = i / (N - 1); // grade the whole block lighter as it climbs
    const heads = [];
    for (let h = 0; h < 4; h++) heads.push(prim(box(0.12, 0.05, 0.5, 0.02), { pos: [x - 0.55 + h * 0.37, y + 0.09, z], tag: 'head' }));
    addPart({
      name: `block${i}`, size: 0.022, band: 0.016, coverage: 3.2, k: 0.006,
      prims: [
        prim(box(1.15, 0.035, 0.85, 0.012), { pos: [x, y, z], tag: 'attn' }),
        prim(box(1.15, 0.035, 0.85, 0.012), { pos: [x + 0.09, y + GAP, z - 0.05], tag: 'ffn' }),
        prim(box(1.17, 0.014, 0.87, 0.008), { pos: [x, y - 0.045, z], tag: 'rim' }),
        prim(box(1.17, 0.014, 0.87, 0.008), { pos: [x + 0.09, y + GAP - 0.045, z - 0.05], tag: 'rim' }),
        ...heads,
      ],
      colorFn: (p, n, q) => {
        if (q.tag === 'attn') return grain(p, C.attn0, mix3(C.attn1, C.ffn1, g));
        if (q.tag === 'ffn') return grain(p, C.ffn0, mix3(C.ffn1, C.led, g * 0.45));
        if (q.tag === 'head') return grain(p, C.head, mix3(C.pin, C.ffn1, g));
        return grain(p, C.rail, C.rim);
      },
    });
  }

  // Emissive marker beside the top of the stack: the one bright accent. It skips the
  // light bake, so it stays the brightest thing in the file without clipping to 1.
  addPart({
    name: 'marker', size: 0.024, band: 0.02, coverage: 3, count: 1500,
    prims: [prim(box(0.17, 0.17, 0.17, 0.06), { pos: [1.62, (N - 1) * STEP + 0.95, 0.4], color: mix3(C.led, [1, 1, 1], rng() * 0.05), emissive: 0.62 })],
  });

  const sun = [-0.3, 0.88, 0.36], sl = Math.hypot(...sun);
  return {
    palette: palette.map(hex),
    bgTop: hex(0xdfe5d8), bgBottom: hex(0xcfd7c8),
    sun: { dir: sun.map((v) => v / sl), col: [0.82, 0.82, 0.79], reach: 9 },
    sky: [0.6, 0.62, 0.64], ground: [0.3, 0.31, 0.3], aoMin: 0.45,
    lights: [],
    fog: { col: hex(0xdfe5d8), density: 0, start: 20 },
    rim: [0, 0, 0],
    camera: { pos: [5.4, 4.2, 6.6], target: [0.2, 1.6, 0] },
  };
}
