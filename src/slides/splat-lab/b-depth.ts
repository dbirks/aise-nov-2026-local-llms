import type { Slide } from '../../deck/types';

// Method B — photo → monocular depth on CPU → Gaussian splats. One real photo per
// asset, no training and no multi-view capture: Depth Anything V2 Small reads a
// relative depth map, each 2×2 pixel block is pinhole-unprojected into one Gaussian.
// Sources, licences and measured timings: public/splats/b/README.md.
// Generator: tools/splats/b/bake_depth.py (uv, CPU only).

const HOW =
  'One Wikimedia Commons photo → Depth Anything V2 Small (24.8M, Apache-2.0) relative depth on CPU → pinhole unprojection at ~50° FOV → one Gaussian per 2×2 pixel block, farthest 5% dropped.';

export const slides: Slide[] = [
  {
    id: 'gs-b-gpu',
    type: 'splat',
    example: true,
    chip: 'GS — Splat lab',
    src: 'splats/b/gpu.spz',
    spin: 0.05,
    caption: {
      title: 'GPU from one photo',
      body: 'A CPU depth model read the distance of every pixel in one product shot; each 2×2 block became a Gaussian. 2.5D relief — nothing behind the card exists.',
    },
    method: {
      label: 'B · photo + CPU depth → splats',
      how: HOW,
      compute: 'CPU · 2.1 s depth + 0.1 s bake · once · 0.75 GB peak',
      source: 'tools/splats/b/bake_depth.py',
    },
    notes:
      'Relative (disparity-like) depth, not metric: the order of surfaces is the model’s, the distances are ours (z = near + (1−d_norm)·range). Discs are fronto-parallel to the camera, so grazing faces are inaccurate and orbiting past ~±60° opens the shell. Photo: Evan-Amos, public domain.',
  },
  {
    id: 'gs-b-rack',
    type: 'splat',
    example: true,
    chip: 'GS — Splat lab',
    src: 'splats/b/rack.spz',
    spin: 0.03,
    caption: {
      title: 'Aisle, one shot',
      body: 'Same CPU bake on a real server-room photo: near rack fronts pull forward, the far end is cut as background. You stand inside the relief, not beside an object.',
    },
    method: {
      label: 'B · photo + CPU depth → splats',
      how: HOW,
      compute: 'CPU · 1.8 s depth + 0.1 s bake · once · 0.79 GB peak',
      source: 'tools/splats/b/bake_depth.py',
    },
    notes:
      'A room is the worst case for a single-view lift: the depth map is a smooth disparity ramp, so this reads as the inside of a box with a hole where the vanishing point was cut. Illustrative geometry, not a measured room. Photo: The National Archives (UK), CC BY 3.0 — attribution required.',
  },
  {
    id: 'gs-b-desktop',
    type: 'splat',
    example: true,
    chip: 'GS — Splat lab',
    src: 'splats/b/desktop.spz',
    spin: 0.05,
    caption: {
      title: 'Home rig, panel off',
      body: 'Board, tower cooler and the GPU hanging over them separate by estimated depth. 24.8M parameters, ~1.6 s of CPU: no scanner, no multi-view capture, no training.',
    },
    method: {
      label: 'B · photo + CPU depth → splats',
      how: HOW,
      compute: 'CPU · 1.6 s depth + 0.1 s bake · once · 0.73 GB peak',
      source: 'tools/splats/b/bake_depth.py',
    },
    notes:
      'Portrait source (576×768 lift), so the 4-unit extent lands on Y. The red shroud reads mid-dark because the post shader keeps luminance only. Photo: Kurt Kaiser, CC0.',
  },
];
