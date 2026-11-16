// Splat-lab A3 · SyntaxSplat scene code — "Home server tower" (illustrative).
// Copied into the SyntaxSplat clone's scenes/ folder by tools/splats/a3/make.sh.
// Deterministic, no DOM, no Math.random (runs in every bake worker too).
//
// A small tower case with a slatted front, three drive sleds, a top fan grille, a power
// brick with a cable, and an antenna. Invented proportions: this is a stand-in for "the
// box a home lab sits under a desk", not a photograph of the speaker's machine.
import { prim, box, cylinder, sphere, torus, limb, curve, catmull, addPart, noise, mix3, hex } from '../engine.js';

const C = {
  case0: hex(0x3d423a), //    chassis shell          ~0.25
  case1: hex(0x575c52), //     chassis shell, lit   ~0.36
  slot: hex(0x171a14), //     vents / gaps (darkest) ~0.10
  panel: hex(0x6f746c), //    bezel, sled fronts    ~0.45
  metal: hex(0xa2a79e), //    handles, grille       ~0.65
  bright: hex(0xbcc1b6), //   top plate, brackets   ~0.76
  brick: hex(0x4a4f47), //    power brick           ~0.31
  led: hex(0xd2d8ce), //      emissive power LED    ~0.84
};

const grain = (p, lo, hi) => mix3(lo, hi, noise(p[0] * 8, p[1] * 8, p[2] * 8));

export const palette = [
  0x161812, 0x24281f, 0x3d423a, 0x4a4f45, 0x575c52, 0x636860, 0x6f746c, 0x7d827b,
  0x8f948b, 0xa2a79e, 0xb4b9af, 0xc6cbc1, 0xd2d8ce,
];

const W = 0.62, H = 1.55, D = 0.66; // chassis half-extents are half of these

export default function build() {
  // ---- chassis: a hollowed box (rawPrim: outer box minus an inner box on the +x face,
  // so the open side reads as an off side panel), with four feet.
  const outer = box(W, H, D, 0.06);
  addPart({
    name: 'case', size: 0.026, band: 0.026, coverage: 3.5,
    prims: [
      prim(outer, { tag: 'shell' }),
      prim(box(0.06, 0.09, 0.09, 0.02), { pos: [W - 0.06, -H + 0.06, D - 0.1], tag: 'foot' }),
      prim(box(0.06, 0.09, 0.09, 0.02), { pos: [-W + 0.06, -H + 0.06, D - 0.1], tag: 'foot' }),
      prim(box(0.06, 0.09, 0.09, 0.02), { pos: [W - 0.06, -H + 0.06, -D + 0.1], tag: 'foot' }),
      prim(box(0.06, 0.09, 0.09, 0.02), { pos: [-W + 0.06, -H + 0.06, -D + 0.1], tag: 'foot' }),
      prim(box(0.5, 0.03, 0.03, 0.01), { pos: [0, H - 0.03, D - 0.02], tag: 'trim' }),
    ],
    colorFn: (p, n, q) => {
      if (q.tag === 'foot') return grain(p, C.slot, C.case0);
      if (q.tag === 'trim') return grain(p, C.metal, C.bright);
      return grain(p, C.case0, C.case1);
    },
  });

  // Front bezel with a slatted vent field, made from thin boxes rather than a boolean:
  // cheaper to sample and it reads as a grille from any angle.
  {
    const prims = [prim(box(0.58, 1.48, 0.03, 0.05), { pos: [0, -0.03, D + 0.02], tag: 'bezel' })];
    for (let i = 0; i < 9; i++) prims.push(prim(box(0.44, 0.018, 0.028, 0.006), { pos: [0, 0.62 - i * 0.115, D + 0.05], tag: 'slat' }));
    addPart({
      name: 'bezel', size: 0.015, band: 0.014, coverage: 4, k: 0.008, prims,
      colorFn: (p, n, q) => (q.tag === 'slat' ? grain(p, C.slot, C.case0) : grain(p, C.panel, C.metal)),
    });
  }

  // Three hot-swap sleds in the lower front, each with a handle.
  {
    const prims = [];
    for (let i = 0; i < 3; i++) {
      const y = -1.12 + i * 0.3;
      prims.push(prim(box(0.5, 0.11, 0.05, 0.02), { pos: [0, y, D + 0.055], tag: 'sled' }));
      prims.push(prim(box(0.16, 0.035, 0.045, 0.012), { pos: [0.3, y, D + 0.1], tag: 'handle' }));
    }
    addPart({
      name: 'sleds', size: 0.014, band: 0.013, coverage: 4, k: 0.012, prims,
      colorFn: (p, n, q) => (q.tag === 'handle' ? grain(p, C.metal, C.bright) : grain(p, C.panel, C.metal)),
    });
  }

  // Top: a fan grille (ring + seven spokes) and two vent slots.
  {
    const prims = [
      prim(torus(0.24, 0.028), { pos: [0, H + 0.02, 0.06], tag: 'grille' }),
      prim(cylinder(0.06, 0.03), { pos: [0, H + 0.02, 0.06], tag: 'grille' }),
      prim(box(0.44, 0.02, 0.035, 0.01), { pos: [0, H + 0.02, -0.24], tag: 'vent' }),
      prim(box(0.44, 0.02, 0.035, 0.01), { pos: [0, H + 0.02, -0.34], tag: 'vent' }),
    ];
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI;
      prims.push(limb([-Math.cos(a) * 0.24, H + 0.02, 0.06 - Math.sin(a) * 0.24], [Math.cos(a) * 0.24, H + 0.02, 0.06 + Math.sin(a) * 0.24], 0.012, 0.012, { tag: 'spoke' }));
    }
    addPart({
      name: 'top', size: 0.0135, band: 0.012, coverage: 4, k: 0.01, prims,
      colorFn: (p, n, q) => (q.tag === 'vent' ? grain(p, C.slot, C.case0) : grain(p, C.metal, C.bright)),
    });
  }

  // Antenna at the back top corner.
  addPart({
    name: 'antenna', size: 0.013, band: 0.012, coverage: 4, k: 0.02,
    prims: [
      limb([W - 0.12, H + 0.02, -D + 0.14], [W - 0.06, H + 0.72, -D + 0.2], 0.045, 0.014, { tag: 'whip' }),
      prim(sphere(0.05), { pos: [W - 0.06, H + 0.75, -D + 0.2], tag: 'tip' }),
    ],
    colorFn: (p, n, q) => (q.tag === 'tip' ? grain(p, C.bright, C.led) : grain(p, C.case1, C.metal)),
  });

  // Power brick on the floor with a cable that runs to the back of the case.
  addPart({
    name: 'brick', size: 0.019, band: 0.02, coverage: 3.5, k: 0.03,
    prims: [
      prim(box(0.24, 0.075, 0.16, 0.03), { pos: [1.1, -H + 0.09, 0.1], tag: 'brick' }),
      ...curve(catmull([[0.88, -H + 0.12, 0.1], [0.78, -H + 0.06, 0.02], [0.6, -H + 0.05, -0.2], [0.42, -H + 0.22, -D - 0.05], [0.2, -H + 0.5, -D - 0.02]], 4), 0.028, 0.028, { tag: 'cable' }),
    ],
    colorFn: (p, n, q) => (q.tag === 'cable' ? grain(p, C.slot, C.panel) : grain(p, C.brick, C.panel)),
  });

  // Emissive power LED: the brightest single strip in the file, and the only thing that
  // skips the light bake.
  addPart({
    name: 'led', size: 0.016, band: 0.014, coverage: 3, count: 900,
    prims: [prim(box(0.028, 0.11, 0.02, 0.008), { pos: [-0.42, 0.9, D + 0.06], color: C.led, emissive: 0.8 })],
  });

  const sun = [-0.55, 0.66, 0.5], sl = Math.hypot(...sun);
  return {
    palette: palette.map(hex),
    bgTop: hex(0xdfe5d8), bgBottom: hex(0xcfd7c8),
    sun: { dir: sun.map((v) => v / sl), col: [0.8, 0.8, 0.77], reach: 9 },
    sky: [0.58, 0.6, 0.62], ground: [0.28, 0.29, 0.28], aoMin: 0.45,
    lights: [],
    fog: { col: hex(0xdfe5d8), density: 0, start: 20 },
    rim: [0, 0, 0],
    camera: { pos: [4.6, 3.4, 5.6], target: [0.2, 0.2, 0] },
  };
}
