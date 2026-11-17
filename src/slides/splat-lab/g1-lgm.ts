import type { Slide } from '../../deck/types';

// Method G1 — LGM (Large Multi-View Gaussian Model, ECCV 2024, MIT) run as a GitOps k8s Job on
// the cluster's own GTX 1070: image → ImageDream multi-view diffusion → feed-forward U-Net →
// Gaussians. Job `splat-lab-lgm-2` on dave-droid; scripts in tools/splats/g1/, provenance and
// every measured number in public/splats/g1/README.md.
//
// These are generated objects, not scans: LGM never saw the back of either device, so the
// unseen faces are the diffusion's invention. Both slides say so.

const LABEL = 'G1 · LGM on our GTX 1070 (k8s Job)';
const HOW =
  'LGM (ECCV 2024, github.com/3DTopia/LGM, arXiv:2402.05054): one photograph → rembg cut-out → ImageDream multi-view diffusion (fp16, 30 steps, 4 views at 90°, elevation 0, seed 42) → the LGM `big` U-Net in one forward pass → 4 × 128² = 65,536 Gaussians → .ply. Ran inside Flux-applied k8s Job splat-lab-lgm-2 on node dave-droid.';

export const slides: Slide[] = [
  {
    id: 'gs-g1-lgm-gpu',
    type: 'splat',
    example: true,
    chip: 'GS — Splat lab',
    src: 'splats/g1/gpu.spz',
    caption: {
      title: 'One photo → 4 views → 3D',
      body: 'LGM dreamed four views of a public-domain GTX 1070 photo, then one U-Net pass placed 65,536 Gaussians (22,988 kept). The card’s back is invented.',
    },
    method: {
      label: LABEL,
      how: HOW,
      compute: 'GPU · 97.9 s · once (0.59 s cut-out + 96.6 s diffusion + 0.58 s U-Net) · 3870 MiB peak of a 5000 MiB slice',
      source: 'tools/splats/g1/mvgen.py',
    },
    view: { target: [0, 0, 0], radius: 35, theta: 0.72, phi: 1.16, size: 2.35 },
    spin: 0.12,
    notes: 'The talk’s own GPU, reconstructed by the model that generated it. LGM’s README budgets ~10 GB for this pipeline; it ran in a 5000 MiB HAMi vGPU slice because the diffusion and the U-Net are separate processes (their fp16 weights never coexist) and the CLIP-ViT-H image encoder is dropped to CPU after one forward — peak torch allocation 3870 MiB, device peak 4943 MiB. Nothing compiled: xformers (SM70+ only) is an SDPA shim and diff-gaussian-rasterization is a stub, because we save the .ply and never render LGM’s preview video. 65,536 → 29,299 after LGM’s opacity ≥ 0.005 prune → 22,988 after the deck’s alpha ≥ 0.05 filter; 330 KB SPZ.',
  },
  {
    id: 'gs-g1-lgm-server',
    type: 'splat',
    example: true,
    chip: 'GS — Splat lab',
    src: 'splats/g1/server.spz',
    caption: {
      title: 'Home server, 108 s on a 1070',
      body: 'Same Job, a CC0 mini-PC photo: 108 s on our Pascal card, 20,019 splats, 283 KB SPZ. Flat like the photo; the side and rear panels are invented.',
    },
    method: {
      label: LABEL,
      how: HOW,
      compute: 'GPU · 108 s wall · once (98.0 s of it the 30 diffusion steps) · 3870 MiB peak of a 5000 MiB slice',
      source: 'tools/splats/g1/lgm2ply.py',
    },
    view: { target: [0, 0, 0], radius: 35, theta: 0.46, phi: 1.20, size: 2.35 },
    spin: 0.12,
    notes: '65,536 Gaussians → 26,981 after LGM’s prune → 20,019 shipped. Orientation evidence: the kept cloud spans 0.996 × 0.400 × 0.741 LGM units, i.e. thin along +Y, which is the flat box in the photo — so +Y really is up and nothing was flipped. The 30 diffusion steps are ~90% of the per-object wall time: the feed-forward U-Net that actually emits the Gaussians needs 0.56 s and 1330 MiB on this card, while generating its four input views costs 98 s and 3870 MiB. Same weights, same seed, different hardware: only the seconds change. The cold run also spent ≈468 s + ≈115 s fetching 4.5 GB of diffusion weights and the 830 MB LGM checkpoint onto the PVC (468.8 s → 0.6 s and 119.1 s → 3.9 s between the two objects) — cached now, so a re-run is ~108 s per object.',
  },
];
