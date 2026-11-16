import type { Slide } from '../../deck/types';

// Method A1 (Fable 5.2) — an LLM writes Spark procedural-splat code; the browser runs it on every
// page load. No file, no bake: the generators are src/scenes/splat-procs/fable-*.ts.
// Everything here is illustrative geometry — no measured hardware, embedding or cache data.

const A1 = {
  label: 'A1 · LLM-written Spark code (Fable 5.2)',
  how: 'An LLM wrote TypeScript that pushes every Gaussian with Spark’s PackedSplats.pushSplat; the browser runs it on each load — no file, no bake.',
} as const;

export const slides: Slide[] = [
  {
    id: 'gs-a1-f-gpu',
    type: 'splat',
    example: true,
    chip: 'GS — Splat lab',
    proc: 'fable-gpu',
    caption: {
      title: 'GPU card, exploded',
      body: 'Board with a die and 8 VRAM chips, PCIe fingers, and a lifted cooler: fins, shroud, three fans. Flat discs with baked shading. Illustrative, not a real card.',
    },
    method: { ...A1, compute: 'browser · every load · 161k splats', source: 'src/scenes/splat-procs/fable-gpu.ts' },
    view: { target: [-0.6, 0.42, 0.45], radius: 30, theta: 0.62, phi: 0.9, size: 2.5 },
    notes: 'Splats are unlit, so the generator bakes a Lambert term into each grey. Fans are separate SplatMeshes turned by object rotation.',
  },
  {
    id: 'gs-a1-f-embedding',
    type: 'splat',
    example: true,
    chip: 'GS — Splat lab',
    proc: 'fable-embedding',
    caption: {
      title: 'Embedding cloud',
      body: 'Illustrative, not a real embedding projection: 40k seeded-random dust splats in six clusters; four dark queries joined to their 7 nearest points.',
    },
    method: { ...A1, compute: 'browser · every load · 54k splats', source: 'src/scenes/splat-procs/fable-embedding.ts' },
    view: { target: [-0.82, 0.42, 0.58], radius: 30, theta: 0.62, phi: 1.05, size: 2.75 },
    spin: 0.08,
    notes: 'Synthetic points only. The k-NN is computed for real, but over made-up data. 3D projections distort high-dimensional similarity — say so.',
  },
  {
    id: 'gs-a1-f-kvcache',
    type: 'splat',
    example: true,
    chip: 'GS — Splat lab',
    proc: 'fable-kvcache',
    caption: {
      title: 'KV cache, paged',
      body: 'Illustrative: 8 layer rows grow along the token axis in 16-token blocks. Dark slab = filled, outline = allocated, dots = not allocated. Rewritten per frame.',
    },
    method: { ...A1, compute: 'browser · every load · 34k splats', source: 'src/scenes/splat-procs/fable-kvcache.ts' },
    view: { target: [-0.72, 0.5, 0.5], radius: 30, theta: 0.62, phi: 0.95, size: 2.3 },
    notes: 'Every token writes K/V in all layers, so the write front is a straight line. Blocks are allocated as the sequence reaches them — context length is not pre-allocated memory. Sizes are made up.',
  },
];
