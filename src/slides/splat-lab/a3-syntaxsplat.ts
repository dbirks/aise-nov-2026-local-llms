import type { Slide } from '../../deck/types';

// Method A3 — scene-as-code in the browser tool SyntaxSplat (SDF parts → surface splats
// with the light baked in → its own "Export .ply"), baked once and packed to SPZ.
// Scenes: tools/splats/a3/scenes/ · provenance: public/splats/a3/README.md.
// Every asset here is illustrative primitive geometry built from invented proportions.

const HOW =
  'Scene code for the browser tool SyntaxSplat: SDF prims grouped into rigid parts, covered with brush splats whose colour is sun + sky + ambient occlusion baked once. A headless page clicked its "Export .ply"; the file was then centred, scaled and packed to SPZ.';

const A3 = 'A3 · SyntaxSplat scene code';

export const slides: Slide[] = [
  {
    id: 'gs-a3-gpu',
    type: 'splat',
    example: true,
    chip: 'GS — Splat lab',
    src: 'splats/a3/gpu.spz',
    caption: {
      title: 'GPU card from scene code',
      body: 'PCB, 15-fin heatsink with two ribbed heat pipes, one fan, gold edge pads. Written as SDF parts in ~150 lines of JS; SyntaxSplat sampled and lit them.',
    },
    method: { label: A3, how: HOW, compute: 'browser · 5.7 s · once (5.0 bake + 0.04 align + 0.65 pack)', source: 'tools/splats/a3/scenes/a3-gpu.js' },
    view: { target: [0, 0, 0], radius: 30, theta: 0.62, phi: 1.10, size: 1.7 },
    spin: 0.1,
    notes: '75k splats, 0.79 MB. Soft mode: the tool exports the baked gradient, its palette pass never reaches the .ply. Invented proportions, not a real card.',
  },
  {
    id: 'gs-a3-gpu-palette',
    type: 'splat',
    example: true,
    chip: 'GS — Splat lab',
    src: 'splats/a3/gpu-palette.spz',
    caption: {
      title: 'Same card, palette pass on',
      body: 'Identical splats, colours snapped to the scene palette with the same ordered dither — flat posterised light instead of a baked gradient.',
    },
    method: { label: `${A3} + palette pass`, how: 'SyntaxSplat does its pixel-art snap in a screen-space post shader, so its .ply export never carries it. pack.py applies the same maths per splat after the export: Bayer 4x4 dither at 0.07, then the nearest palette entry under the post shader weights (0.3/0.59/0.11) 0.3/0.59/0.11 weights.', compute: 'browser · 6.0 s · once (shares the 5.0 s bake + 0.24 snap + 0.72 pack)', source: 'tools/splats/a3/pack.py' },
    view: { target: [0, 0, 0], radius: 30, theta: 0.62, phi: 1.10, size: 1.7 },
    spin: 0.1,
    notes: '75k splats, 0.72 MB. Same geometry as gs-a3-gpu: compare the shading on the fins — banded here, continuous there. Screen-space dither phase cannot survive as splat data; per-splat dither instead.',
  },
  {
    id: 'gs-a3-layers',
    type: 'splat',
    example: true,
    chip: 'GS — Splat lab',
    src: 'splats/a3/layers.spz',
    caption: {
      title: 'Eight blocks, one rail',
      body: 'A block = attention plate + feed-forward plate + four head tiles, graded lighter as the stack climbs, with a ribbed residual spine beside it. Twelve SDF parts.',
    },
    method: { label: A3, how: HOW, compute: 'browser · 13.6 s · once (11.1 bake + 0.18 align + 2.29 pack)', source: 'tools/splats/a3/scenes/a3-layers.js' },
    view: { target: [0, 0.1, 0], radius: 30, theta: 0.55, phi: 1.20, size: 2.3 },
    spin: 0.09,
    notes: '316k splats, 3.0 MB — the heaviest asset in the lab. Eight blocks is a picture, not a claim about any model depth.',
  },
  {
    id: 'gs-a3-server',
    type: 'splat',
    example: true,
    chip: 'GS — Splat lab',
    src: 'splats/a3/server.spz',
    caption: {
      title: 'Home server tower',
      body: 'Tower case, slatted bezel, three drive sleds, fan grille, antenna, power brick with a cable run. Same scene-code pipeline, one part per piece.',
    },
    method: { label: A3, how: HOW, compute: 'browser · 3.6 s · once (3.0 bake + 0.04 align + 0.57 pack)', source: 'tools/splats/a3/scenes/a3-server.js' },
    view: { target: [0, 0.1, 0], radius: 30, theta: 0.6, phi: 1.15, size: 2.1 },
    spin: 0.12,
    notes: '66k splats, 0.68 MB. Stand-in for "the box a home lab sits under a desk" — not a photograph of the speaker rig.',
  },
];
