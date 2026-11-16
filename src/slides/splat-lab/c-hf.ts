import type { Slide } from '../../deck/types';

// Method C — generative 3D Gaussian models produced on someone else's GPU: public
// Hugging Face Spaces (ZeroGPU). Provenance + generator: public/splats/c/README.md,
// tools/splats/c/hf_generate.py.

const CHIP = 'GS — Splat lab';

export const slides: Slide[] = [
  {
    id: 'gs-c-lgm-gpu',
    type: 'splat',
    example: true,
    chip: CHIP,
    src: 'splats/c/lgm-gpu.spz',
    caption: {
      title: 'Hosted GPU: LGM splat',
      body: '3D Gaussians of a public-domain graphics-card photo, generated once by the LGM-mini Space on a shared Hugging Face ZeroGPU A10G, then centred and scaled.',
    },
    method: {
      label: 'C · LGM-mini on a hosted GPU (HF Space)',
      how: 'A public-domain photo was uploaded to the LGM-mini Space, whose multi-view diffusion + LGM head returned 39,646 3D Gaussians; 33,372 survived an opacity filter and were re-centred and scaled, unshaded, to a 4-unit box.',
      compute: 'hosted ZeroGPU A10G · 4.7 s incl. queue · once',
      source: 'https://huggingface.co/spaces/dylanebert/LGM-mini',
    },
    view: { target: [0, 0, 0], radius: 40, theta: 0.9, phi: 1.15, size: 2.6 },
    spin: 0.35,
  },
];
