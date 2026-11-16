import type { Slide } from '../../deck/types';

// Method A1 — an LLM writes Spark procedural-splat code that runs in the browser on EVERY page
// load. No .ply, no .spz, no bake step: the Gaussians are computed with PackedSplats.pushSplat
// when the slide mounts. Label: "A1 · LLM-written Spark code (qwen3-8-flash-next)".
// Generators live in src/scenes/splat-procs/qwen-*.ts; every subject is illustrative primitive
// geometry — no measured hardware, model, or topology data.

const A1 = {
  label: 'A1 · LLM-written Spark code (qwen3-8-flash-next)',
  how: 'An LLM wrote a JavaScript generator against Spark’s procedural-splat API (pushSplat). It runs in the browser and rebuilds the Gaussians on every page load — nothing is baked to disk.',
} as const;

export const slides: Slide[] = [
  {
    id: 'gs-a1-q-gpu',
    type: 'splat',
    example: true,
    chip: 'GS — Splat lab',
    proc: 'qwen-gpu',
    caption: {
      title: 'GPU card, coded in-browser',
      body: 'Dark PCB, bright PCIe fingers, a finned cooler, eight VRAM chips ringing a glowing die, two fans. Spark builds it from pushSplat on load. Illustrative shape, not a real card.',
    },
    method: { ...A1, compute: 'browser · every load · ~9k splats', source: 'src/scenes/splat-procs/qwen-gpu.ts' },
    view: { target: [0, 0.08, 0], radius: 30, theta: 0.62, phi: 1.02, size: 1.85 },
    spin: 0.12,
    notes: 'Luminance carries the parts: darkest board, mid fins, brightest central die. Zero CPU bake cost — construction is ~10 ms at mount.',
  },
  {
    id: 'gs-a1-q-embedding',
    type: 'splat',
    example: true,
    chip: 'GS — Splat lab',
    proc: 'qwen-embedding',
    caption: {
      title: 'Embedding cloud (illustrative)',
      body: '~40k dust splats in five soft clusters, dark query points with faint bright threads to the nearest cluster. Purely illustrative — NOT a projection of any real model’s embeddings.',
    },
    method: { ...A1, compute: 'browser · every load · ~40k splats', source: 'src/scenes/splat-procs/qwen-embedding.ts' },
    view: { target: [0, 0, 0], radius: 30, theta: 0.55, phi: 1.15, size: 2.5 },
    spin: 0.08,
    notes: 'Density = cluster mass; the dark cores and thin bright filaments are decorative. Per AGENTS.md: static embedding relationships do not generalise to contextual residual streams — do not read real geometry here.',
  },
  {
    id: 'gs-a1-q-kvcache',
    type: 'splat',
    example: true,
    chip: 'GS — Splat lab',
    proc: 'qwen-kvcache',
    caption: {
      title: 'Paged KV cache, growing',
      body: 'Eight layer-rows of token-blocks fill with dark pages from the left; faint outlines are allocated-but-empty. Grows, holds, loops via per-frame onFrame — no re-bake. Illustrative.',
    },
    method: { ...A1, compute: 'browser · every load · ~14k splats · animated', source: 'src/scenes/splat-procs/qwen-kvcache.ts' },
    view: { target: [0, 0, 0], radius: 30, theta: 0.5, phi: 1.12, size: 2.05 },
    notes: 'Shows pages/blocks, not an always-full cache — the empty outlines are the point. Animation sets two integer splat counts per frame (prefix reveal), so it costs nothing to grow.',
  },
];
