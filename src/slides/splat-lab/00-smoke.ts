import type { Slide } from '../../deck/types';

/**
 * S0 · smoke test: proves the `type: 'splat'` path end to end — Spark's Splats rendered into the
 * deck's own low-res target, so the luminance/dither/sage post shader is what you actually see.
 * The grid is procedural (src/scenes/splat-procs/test-grid.ts): 8000 grey Gaussians on a lattice,
 * dark at the bottom and light at the top. If the pipeline is intact the output is a band of sage
 * tones, never a colour photograph.
 *
 * Not included: a file-backed twin of this slide (`src: 'splats/smoke/butterfly.spz'`). Spark's
 * sample splat has no clear redistribution licence (see public/splats/smoke/README.md), so the deck
 * ships only the procedural slide. The `.spz` loader itself was checked with a throwaway copy of
 * that file: 177,132 splats loaded, rendered in the same 15 sage tones.
 */
export const slides: Slide[] = [
  {
    id: 'gs-smoke-proc',
    type: 'splat',
    example: true,
    chip: 'GS · splat lab',
    caption: {
      title: 'Splats, same pixel pipeline',
      body: '8000 procedural Gaussians in a 4-unit cube, dark→light with height. Spark writes them into the deck’s low-res target, so the only colours on screen are the six sage tones of the post shader.',
    },
    method: {
      label: 'S0 · smoke test',
      how: 'Browser builds a PackedSplats lattice with pushSplat at page load — no training, no file.',
      compute: 'browser · ~8k splats · once per mount',
      source: 'src/scenes/splat-procs/test-grid.ts',
    },
    proc: 'test-grid',
    view: { target: [0, 0, 0], radius: 40, theta: 0.6, phi: 1.1, size: 4 },
    spin: 0.35,
    notes: 'Verify the dither looks identical to the other scenes. Drag to orbit: the ramp must stay a ramp (sorting is view-dependent, colour is not).',
  },
];
