import type { Slide } from '../../deck/types';

// Method D — real-world captures: photogrammetry-style 3DGS trained from many photographs of a
// real object, by somebody else, on somebody else's GPU. Only public assets with an explicit
// per-file licence are used (all three CC BY 4.0, credited). Provenance, measured timings and
// the exact re-timing commands: public/splats/d/README.md, tools/splats/d/build.sh.
//
// Nothing on these slides is a performance claim: the splat counts and file sizes are measured
// with `splat-transform --stats`; the geometry/crop is real, the pose is fitted from the point
// cloud (see README).

const CHIP = 'GS — Splat lab';
const LABEL = 'D · real capture (superspl.at, CC BY)';
const HOW =
  'Photogrammetry-style 3DGS: the author photographed a real object from many angles and trained Gaussians on it; we download the licensed result, strip higher spherical-harmonic bands, crop, centre and scale it to a 4-unit box (CPU, splat-transform).';

export const slides: Slide[] = [
  {
    id: 'gs-d-millipede',
    type: 'splat',
    example: true,
    chip: CHIP,
    src: 'splats/d/millipede.spz',
    view: { target: [0, 0, 0], radius: 8, theta: 0.35, phi: 1.25, size: 2.4 },
    spin: 0.12,
    caption: {
      title: 'Millipede, 116k splats',
      body: 'A real millipede specimen, photographed from many angles and trained into 116,374 Gaussians (Fabian Plum, CC BY). Captured, not generated.',
    },
    method: {
      label: LABEL,
      how: HOW,
      compute: 'CPU · 0.9 s re-time of 116k splats · once; the photo training ran upstream',
      source: 'tools/splats/d/build.sh',
    },
    notes:
      'Macro capture of a specimen: 116,374 Gaussians, 1.8 MB SPZ (SH bands stripped). Body axis fitted onto x with the leg side down. CC BY 4.0, Fabian Plum, superspl.at/scene/3d5482d4.',
  },
  {
    id: 'gs-d-lion',
    type: 'splat',
    example: true,
    chip: CHIP,
    src: 'splats/d/lion.spz',
    view: { target: [0, 0, 0], radius: 8, theta: 0.85, phi: 1.3, size: 2.4 },
    spin: 0.15,
    caption: {
      title: 'Lion head, 195k splats',
      body: 'A lion-head model captured from photos by Renaud (CC BY): 195,099 Gaussians, 2.9 MB. Stored upside down; the 180° upright flip is baked in.',
    },
    method: {
      label: LABEL,
      how: HOW,
      compute: 'CPU · 2.0 s re-time of 195k splats · once; the photo training ran upstream',
      source: 'tools/splats/d/build.sh',
    },
    notes:
      'Same asset three.js loads in its WebGPU splat example; that example rotates it by Euler(PI,0,0), so the inversion is in the file. 195,099 Gaussians after -H 0, 2.9 MB SPZ. CC BY 4.0, Renaud, superspl.at/scene/56155c3f.',
  },
  {
    id: 'gs-d-tomatoes',
    type: 'splat',
    example: true,
    chip: CHIP,
    src: 'splats/d/tomatoes.spz',
    view: { target: [0, 0, 0], radius: 8, theta: -0.45, phi: 1.0, size: 2.6 },
    spin: 0.1,
    caption: {
      title: 'Tomatoes, 11k of 445k',
      body: 'Two heirloom tomatoes from a home-built turntable rig, trained from photos by Grail (CC BY). Cropped and halo-filtered: 11,454 of 445,409 splats.',
    },
    method: {
      label: LABEL,
      how: HOW,
      compute: 'CPU · 2.6 s crop + re-time, 445k → 11.5k splats · once; trained upstream',
      source: 'tools/splats/d/build.sh',
    },
    notes:
      'Shows what cleaning a capture costs: the 445k-splat scene is mostly turntable plate plus soft halo splats, so 11.5k survive the box crop and an opacity cut. Saturated red fruit and dark plate land on nearly the same luminance tone here. CC BY 4.0, Grail, superspl.at/scene/2826d2c0.',
  },
];
