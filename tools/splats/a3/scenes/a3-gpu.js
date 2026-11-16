// Splat-lab A3 · SyntaxSplat scene code — "GPU card" (illustrative).
// Copied into the SyntaxSplat clone's scenes/ folder by tools/splats/a3/make.sh.
// Runs on the page AND in every bake worker: deterministic, no DOM, no Math.random.
// See docs/AUTHORING.md in the clone for the scene API.
//
// Nothing here is a real card: proportions, fin and chip counts are invented for the
// picture. Colour is designed as a LUMINANCE ladder, because the talk's renderer keeps
// only luminance and snaps it to a 6-tone ramp — hue is decoration.
import { prim, box, cylinder, torus, limb, addPart, noise, mix3, hex } from '../engine.js';

const C = {
  board: hex(0x2f332f), //   PCB laminate        luma ~0.20
  boardHi: hex(0x42473f), //  PCB laminate, lit  ~0.28
  back: hex(0x23271f), //     backplate          ~0.15
  chip: hex(0x5c615a), //     VRAM / packages    ~0.38
  gold: hex(0x8b8e7c), //     edge-connector pads ~0.56
  metalD: hex(0x7d827b), //   cold plate, shroud ~0.51
  metalM: hex(0xa6aba2), //   heat pipes, fan    ~0.66
  metalL: hex(0xc4c9bf), //   cooler fins        ~0.79
  led: hex(0xd2d8ce), //      emissive strip     ~0.84 (kept below the page colour)
};

// Two-scale grain so a flat plate never reads as one flat tone.
const grain = (p, lo, hi) => mix3(lo, hi, noise(p[0] * 7, p[1] * 5, p[2] * 7));

// Lit palette entries for the pixel-art pass: nine steps, ~0.09 apart in luma, so the
// posterisation survives the talk renderer's own 6-tone ramp. Also read back offline by
// pack.py, which re-applies this pass to the exported splat colours (see its docstring).
export const palette = [
  0x121410, 0x23271f, 0x34392f, 0x4a5045, 0x616658, 0x797e70, 0x92978a, 0xadb2a6, 0xc8cdc3,
];

export default function build() {
  // ---- board
  addPart({
    name: 'pcb', size: 0.03, band: 0.026, coverage: 3.5,
    prims: [prim(box(1.5, 0.045, 0.55, 0.012))],
    colorFn: (p, n, q, rng) => (rng() < 0.012 ? C.gold : grain(p, C.board, C.boardHi)),
  });

  addPart({
    name: 'backplate', size: 0.028, band: 0.022, coverage: 3,
    prims: [prim(box(1.44, 0.018, 0.5, 0.01), { pos: [0, -0.075, 0] })],
    colorFn: (p) => grain(p, C.back, C.board),
  });

  // PCIe edge connector: gold pads along one edge, with the keying notch left empty.
  {
    const prims = [];
    for (let i = 0; i < 12; i++) {
      const x = -0.98 + i * 0.145;
      if (x > -0.12 && x < 0.06) continue; // the notch
      prims.push(prim(box(0.052, 0.012, 0.15, 0.004), { pos: [x, -0.052, -0.45], tag: 'pad' }));
    }
    addPart({ name: 'fingers', size: 0.016, band: 0.012, coverage: 4, prims, colorFn: (p) => grain(p, C.gold, C.metalM) });
  }

  // I/O bracket and its three display ports.
  addPart({
    name: 'bracket', size: 0.016, band: 0.014, coverage: 3.5, k: 0.012,
    prims: [
      prim(box(0.016, 0.36, 0.5, 0.008), { pos: [-1.56, 0.02, 0], tag: 'plate' }),
      prim(box(0.05, 0.014, 0.52, 0.006), { pos: [-1.56, 0.4, 0], tag: 'plate' }),
      prim(box(0.024, 0.05, 0.08, 0.008), { pos: [-1.56, -0.02, -0.24], tag: 'port' }),
      prim(box(0.024, 0.05, 0.08, 0.008), { pos: [-1.56, -0.02, -0.02], tag: 'port' }),
      prim(box(0.024, 0.05, 0.08, 0.008), { pos: [-1.56, -0.02, 0.2], tag: 'port' }),
    ],
    colorFn: (p, n, q) => (q.tag === 'port' ? mix3(C.chip, C.back, 0.55) : grain(p, C.metalD, C.metalM)),
  });

  // ---- cooler: contact plate, fin stack with two heat pipes, one axial fan
  addPart({
    name: 'coldplate', size: 0.021, band: 0.022, coverage: 3.5, k: 0.015,
    prims: [prim(box(0.66, 0.04, 0.66, 0.03), { pos: [0, 0.115, 0] })],
    colorFn: (p) => grain(p, C.metalD, C.metalM),
  });

  {
    const prims = [];
    for (let i = 0; i < 15; i++) prims.push(prim(box(0.017, 0.15, 0.48, 0.004), { pos: [-0.93 + i * 0.112, 0.315, 0], tag: 'fin' }));
    prims.push(limb([-1.25, 0.2, -0.2], [1.25, 0.2, -0.2], 0.032, 0.032, { tag: 'pipe', rib: 0.12, freq: 26 }));
    prims.push(limb([-1.25, 0.2, 0.2], [1.25, 0.2, 0.2], 0.032, 0.032, { tag: 'pipe', rib: 0.12, freq: 26 }));
    addPart({ name: 'heatsink', size: 0.0145, band: 0.011, coverage: 3.5, prims, colorFn: (p) => grain(p, C.metalM, C.metalL) });
  }

  {
    const prims = [
      prim(torus(0.3, 0.042), { pos: [1.12, 0.34, 0], tag: 'ring' }),
      prim(cylinder(0.075, 0.055), { pos: [1.12, 0.34, 0], tag: 'hub' }),
    ];
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2;
      prims.push(prim(box(0.115, 0.009, 0.055, 0.003), {
        pos: [1.12 + Math.cos(a) * 0.185, 0.34, Math.sin(a) * 0.185],
        rot: [0.42, -a, 0], tag: 'blade',
      }));
    }
    addPart({
      name: 'fan', size: 0.0135, band: 0.011, coverage: 3.5, k: 0.006, prims,
      colorFn: (p, n, q) => (q.tag === 'ring' ? grain(p, C.metalD, C.metalM) : grain(p, C.chip, C.metalD)),
    });
  }

  // ---- small parts
  {
    const prims = [];
    for (const sx of [-0.68, 0.68]) for (const sz of [-0.42, -0.18, 0.18, 0.42]) prims.push(prim(box(0.1, 0.03, 0.14, 0.012), { pos: [sx, 0.075, sz] }));
    addPart({ name: 'vram', size: 0.016, band: 0.016, coverage: 4, prims, colorFn: (p) => grain(p, C.chip, mix3(C.chip, C.metalM, 0.5)) });
  }

  addPart({
    name: 'power', size: 0.016, band: 0.016, coverage: 3.5, k: 0.01,
    prims: [
      prim(box(0.11, 0.055, 0.14, 0.012), { pos: [1.42, 0.1, 0.34], tag: 'plug' }),
      prim(box(0.07, 0.02, 0.05, 0.006), { pos: [1.42, 0.16, 0.34], tag: 'clip' }),
    ],
    colorFn: (p, n, q) => (q.tag === 'clip' ? C.metalM : grain(p, C.boardHi, C.chip)),
  });

  // Emissive accent strip: skips the light bake, so it is the brightest thing in the
  // file without clipping into the page colour.
  addPart({
    name: 'strip', size: 0.016, band: 0.012, coverage: 3, count: 1800,
    prims: [prim(box(0.44, 0.008, 0.014, 0.004), { pos: [-1.0, 0.052, 0.535], color: C.led, emissive: 0.8 })],
  });

  const sun = [-0.5, 0.72, 0.48], sl = Math.hypot(...sun);
  return {
    palette: palette.map(hex),
    bgTop: hex(0xdfe5d8), bgBottom: hex(0xcfd7c8),
    sun: { dir: sun.map((v) => v / sl), col: [0.78, 0.78, 0.75], reach: 8 },
    sky: [0.54, 0.56, 0.58], ground: [0.26, 0.27, 0.26], aoMin: 0.4,
    lights: [],
    fog: { col: hex(0xdfe5d8), density: 0, start: 20 },
    rim: [0, 0, 0],
    camera: { pos: [4.2, 3.0, 5.2], target: [0, 0.35, 0] },
  };
}
