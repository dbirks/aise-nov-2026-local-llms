import type { Slide } from '../../deck/types';

// Method A2 / A2b — an LLM writes the generator, it runs once on the CPU, the deck only
// loads the packed splats. Sources: tools/splats/a2/ · provenance: public/splats/a2/README.md.
// Every asset here is illustrative primitive geometry — no measured hardware or model data.

const A2 = {
  label: 'A2 · LLM-written Python bake',
  how: 'An LLM wrote a Python script that samples signed-distance shapes into surface Gaussians and writes a 3DGS .ply; baked once on CPU, then packed to SPZ.',
  source: 'tools/splats/a2/bake.py',
} as const;

const A2B = {
  label: 'A2b · LLM-written .mjs generator',
  how: 'An LLM wrote a generator script that splat-transform executes itself — the Gaussians are produced while the tool writes the file, no intermediate .ply.',
  source: 'tools/splats/a2/attn-mask.mjs',
} as const;

export const slides: Slide[] = [
  {
    id: 'gs-a2-gpu',
    type: 'splat',
    example: true,
    chip: 'GS — Splat lab',
    src: 'splats/a2/gpu.spz',
    caption: {
      title: 'GPU card, baked from SDFs',
      body: 'PCB slab, 8 VRAM chips, cooler fins and PCIe fingers — signed-distance shapes sampled into surface Gaussians by a Python script. Illustrative, not a real card.',
    },
    method: { ...A2, compute: 'CPU · 4.3 s · once (bake 3.0 + pack 1.3)' },
    view: { target: [0, 0, 0], radius: 30, theta: 0.62, phi: 1.02, size: 1.3 },
    spin: 0.12,
    notes: '270k splats. Luminance carries the parts: dark board, mid chips, light cooler. Bake cost is a few seconds and happens zero times at runtime.',
  },
  {
    id: 'gs-a2-layers',
    type: 'splat',
    example: true,
    chip: 'GS — Splat lab',
    src: 'splats/a2/layers.spz',
    caption: {
      title: '12 transformer layers',
      body: 'Twelve thin plates with a gap and a slow drift — one plate per block in the stack. Light faces, dark rims, same SDF shell sampler, same CPU bake.',
    },
    method: { ...A2, compute: 'CPU · 1.2 s · once (bake 0.6 + pack 0.6)' },
    view: { target: [0, 0, 0], radius: 30, theta: 0.55, phi: 1.05, size: 2.05 },
    spin: 0.1,
    notes: '150k splats. Illustrative count: twelve plates, not a claim about any specific model depth.',
  },
  {
    id: 'gs-a2-kv-blocks',
    type: 'splat',
    example: true,
    chip: 'GS — Splat lab',
    src: 'splats/a2/kv-blocks.spz',
    caption: {
      title: 'Paged KV-cache blocks',
      body: 'A 16 × 6 × 4 lattice: 58% of the blocks drawn filled (mid/dark), the rest as faint outlines. Block size and occupancy are invented for the picture.',
    },
    method: { ...A2, compute: 'CPU · 6.4 s · once (bake 5.9 + pack 0.5)' },
    view: { target: [0, 0, 0], radius: 30, theta: 0.6, phi: 1.05, size: 1.35 },
    spin: 0.09,
    notes: '127k splats. Says "paged blocks", not "the cache is always fully allocated" — the empty outlines are the point.',
  },
  {
    id: 'gs-a2-tokens',
    type: 'splat',
    example: true,
    chip: 'GS — Splat lab',
    src: 'splats/a2/tokens.spz',
    caption: {
      title: 'Token row on a rail',
      body: 'Twelve rounded token tiles, one raised bar each. The bars are decorative heights, not logits or probabilities; the rail is the position axis.',
    },
    method: { ...A2, compute: 'CPU · 1.0 s · once (bake 0.5 + pack 0.4)' },
    view: { target: [0, 0, 0], radius: 30, theta: 0.5, phi: 1.15, size: 1.15 },
    notes: '67k splats, rounded-box SDF for the tiles. Marked illustrative in the caption.',
  },
  {
    id: 'gs-a2b-attn-mask',
    type: 'splat',
    example: true,
    chip: 'GS — Splat lab',
    src: 'splats/a2/attn-mask.spz',
    caption: {
      title: 'Causal mask (.mjs generator)',
      body: 'One tile per query/key pair: attended pairs are solid slabs, future pairs are ghost outlines, the decoding row is lifted. Illustrative, not real weights.',
    },
    method: { ...A2B, compute: 'CPU · 0.5 s · once (generate + pack in one pass)' },
    view: { target: [0, 0, 0], radius: 30, theta: 0.62, phi: 0.92, size: 1.75 },
    notes: '115k splats, 0.3 MB. 26 × 26 tiles. Same pixel pipeline, different generator: here the converter runs the LLM-written code.',
  },
];
