import type { Slide } from '../../deck/types';

// Method G2 — DiffSplat (ICLR 2025, MIT): a fine-tuned SD1.5 U-Net that writes 3D Gaussian
// splats directly, in one feed-forward pass, from a text prompt. Generated in a k8s Job on the
// cluster's GTX 1070 (Pascal sm_61, 5000 MiB HAMi slice) — fp16, 20 sde-dpmsolver++ steps,
// CFG 7.5, seed 0, 4 views at 256². Measured times/VRAM and the upstream bugs we hit:
// public/splats/g2/README.md. Offline preview renders: tools/splats/g2/preview/.
//
// Nothing here is a real object: geometry comes from the words in the prompt only, and the
// 1-2 s headline number in the paper belongs to an A100, not to this card.

const HOW =
  'DiffSplat (SD1.5 variant, 859.5 M params, fp16) run as k8s Job splat-lab-diffsplat-3 on dave-droid’s GTX 1070: one feed-forward pass writes 4 views × 65 536 Gaussians from a text prompt, then a CPU pass drops opacity ≤ 0.02, crops to a robust box, centres it and scales the largest extent to 4 units.';

const COMPUTE = 'GPU · 53.4 s · once · 2.82 GiB peak (GTX 1070, fp16)';

export const slides: Slide[] = [
  {
    id: 'gs-g2-gpu-cooler',
    type: 'splat',
    example: true,
    chip: 'GS — Splat lab',
    src: 'splats/g2/gpu-cooler.spz',
    spin: 0.05,
    caption: {
      title: 'Words → splats, one pass',
      body: 'DiffSplat’s SD1.5 U-Net wrote 262 144 Gaussians from “a graphics card with a large cooler”. 53.4 s on a GTX 1070 in fp16 — no per-object training.',
    },
    method: {
      label: 'G2 · DiffSplat on our GTX 1070 (k8s Job)',
      how: HOW,
      compute: COMPUTE,
      source: 'tools/splats/g2/job/run.py',
    },
    notes:
      'Feed-forward splat generation, ICLR 2025 (arXiv:2501.16764). The paper quotes 1–2 s per object; that is an A100 in fp32. Here it is a 2016 Pascal card with no tensor cores, 5000 MiB enforced by HAMi, so the U-Net runs fp16 (upstream defaults: fp32, or bf16 — which Pascal has no hardware support for). The axial-fan “X” is the model’s idea of a cooler; no real card was measured. Seed 0, CFG 7.5, 20 steps — a different seed gives a different object.',
  },
  {
    id: 'gs-g2-server-tower',
    type: 'splat',
    example: true,
    chip: 'GS — Splat lab',
    src: 'splats/g2/server-tower.spz',
    spin: 0.03,
    caption: {
      title: 'A server that never was',
      body: 'Prompt “a small home server tower”: 50 915 splats kept after dropping the near-transparent ones. The silhouette is soft because 4 views paint the same volume.',
    },
    method: {
      label: 'G2 · DiffSplat on our GTX 1070 (k8s Job)',
      how: HOW,
      compute: 'GPU · 53.4 s · once · 2.82 GiB peak (GTX 1070, fp16)',
      source: 'tools/splats/g2/job/run.py',
    },
    notes:
      'One view-lift per azimuth (0/90/180/270°) at elevation 10°, camera radius 1.4 — the generator’s training camera, so orbiting past the painted shells opens double walls. Opacity mean after filtering is 0.18, the lowest of the three: this asset is the ghostliest when lit by the deck’s luminance ramp. Absolute scale is meaningless — the asset is normalised to a 4-unit extent. Framing note for the orchestrator: this is the one asset whose largest axis is Y (4.0 × 2.11 × 2.10), so with the default camera its top slides under the caption card — a smaller `view.size` or a raised target would clear it.',
  },
  {
    id: 'gs-g2-books',
    type: 'splat',
    example: true,
    chip: 'GS — Splat lab',
    src: 'splats/g2/books.spz',
    spin: 0.05,
    caption: {
      title: 'Not a scan, not a CAD',
      body: '“A stack of books”, generated in 53.5 s: 59 579 Gaussians, 2.82 GiB VRAM peak. Same command as the others — only the prompt changed.',
    },
    method: {
      label: 'G2 · DiffSplat on our GTX 1070 (k8s Job)',
      how: HOW,
      compute: 'GPU · 53.5 s · once · 2.82 GiB peak (GTX 1070, fp16)',
      source: 'tools/splats/g2/job/run.py',
    },
    notes:
      'The clearest of the three: two volumes with visible page faces. Same command as the others, only the prompt changed — that is the point of a feed-forward generator versus per-scene optimisation. Rasterizer footnote: DiffSplat’s own preview render is broken against today’s RaDe-GS main (its render() passes require_coord=, which that NamedTuple no longer has); the sm_61 build itself compiles and imports, and the splat export never touches it.',
  },
];
