import type { Slide } from '../../deck/types';

// Method G3 — a real Gaussian-splat training run, not a bake. Brush v0.3.0 (Rust/Burn over
// wgpu/Vulkan, so no CUDA compile) in home-k8s Job splat-lab-train-4 on dave-droid's GTX 1070,
// trained on 251 Tanks and Temples "truck" photos. Provenance + licences: public/splats/g3/README.md.
// Every number in these captions is measured from that Job's own log (PSNR/SSIM are Brush's
// held-out-view eval on 31 of the 251 images), and both assets are the SAME run at different steps.

const G3 = {
  label: 'G3 · 3DGS training on our GTX 1070 (k8s Job)',
  how: 'Brush 0.3.0 (Rust + Burn over wgpu/Vulkan — no CUDA, no sm_61 compile) fitted classic 3D Gaussian Splatting to 251 public photos in a Flux-synced k8s Job on the cluster\'s Pascal card.',
  compute: 'GPU · 404 s · once (15k steps, GTX 1070) + 2.1 s CPU crop/pack',
  source: 'tools/splats/g3/pack.sh',
} as const;

export const slides: Slide[] = [
  {
    id: 'gs-g3-truck',
    type: 'splat',
    example: true,
    chip: 'GS — Splat lab',
    src: 'splats/g3/truck.spz',
    caption: {
      title: 'Toy truck, trained in 404 s',
      body: 'Real 3DGS training, not a bake: 251 Tanks and Temples photos of a toy pickup, 15,000 steps by Brush over Vulkan on our GTX 1070, then cropped to the subject.',
    },
    method: G3,
    view: { target: [0, 0, 0], radius: 30, theta: 0.62, phi: 1.2, size: 2.05 },
    spin: 0.1,
    notes: '93,540 splats after cropping a 789,747-splat scene (1.50 MB SPZ, 0 SH bands). Held-out eval: PSNR 26.71, SSIM 0.923 on 31 unseen views. Card VRAM peaked 3.83 GiB of 8 GiB with the ASR service running beside it — Brush itself wanted ~1.06 GiB. Talking points: (1) Pascal is dead to CUDA 13 but Vulkan/wgpu still trains there; (2) it is a k8s Job, GitOps-applied, one file, no SSH; (3) HAMi caps CUDA only — a Vulkan job has to size itself honestly.',
  },
  {
    id: 'gs-g3-truck-grow',
    type: 'splat',
    example: true,
    chip: 'GS — Splat lab',
    src: 'splats/g3/truck-grow.spz',
    caption: {
      title: 'Step 2,500 of the same run',
      body: 'Same training run, same crop and camera, 2,500 steps in: 63,551 splats instead of 93,540, PSNR 25.3 vs 26.7. Densification is still filling in the surfaces.',
    },
    method: G3,
    view: { target: [0, 0, 0], radius: 30, theta: 0.62, phi: 1.2, size: 2.05 },
    spin: 0.1,
    notes: '1.00 MB SPZ. Compare against gs-g3-truck: the early splats are rounder and fainter (opacity median 0.27 vs 0.22 but max 0.97 vs 1.00) and the gaps between surfaces are still open — Brush clones/splits where the gradient says, then prunes low-opacity ones. Growth stops at step 11,250 of 15,000; after that only positions, scales, colours and opacities move. Same camera and same crop transform on both slides so the pair reads as one scene at two times.',
  },
];
