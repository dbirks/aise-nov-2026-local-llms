import type { Slide } from '../../deck/types';

const BODY = 'Weight bits, activation bits and KV bits are separate choices. 4-bit weights still carry block '
  + 'scales, and every coarser grid costs reconstruction accuracy.';

export const slides: Slide[] = [
  {
    id: 'lab-quant',
    type: 'scene',
    scene: 'quant',
    example: true,
    chip: 'LAB — Quantization',
    caption: {
      title: 'Three precision dials',
      body: BODY,
    },
    controls: [
      {
        kind: 'choice', action: 'weights', label: 'weights',
        options: [{ label: 'fp16', value: 'fp16' }, { label: 'int4 w4a16', value: 'int4' }, { label: 'nvfp4 w4a4', value: 'nvfp4' }],
        initial: 'fp16',
      },
      {
        kind: 'choice', action: 'acts', label: 'activations',
        options: [{ label: 'fp16', value: 'fp16' }, { label: 'fp8', value: 'fp8' }, { label: 'fp4', value: 'fp4' }],
        initial: 'fp16',
      },
      {
        kind: 'choice', action: 'kv', label: 'kv cache',
        options: [{ label: 'fp16', value: 'fp16' }, { label: 'fp8', value: 'fp8' }, { label: 'nvfp4', value: 'nvfp4' }],
        initial: 'fp16',
      },
    ],
    notes: 'Brief: README "don\'t conflate weight bits, activation bits and KV bits". '
      + 'WHAT IS REAL (mechanism): quantisation rounds each element to the nearest level of a finite grid, so heights snap to a staircase; '
      + 'each block shares a stored scale, so 4-bit storage is 4-bit data PLUS scale metadata; the FP4 E2M1 magnitude grid is non-uniform '
      + '(fine near zero, coarse at the top) while INT4 magnitudes are evenly spaced; KV-cache precision is an independent choice from weight bits '
      + '(vLLM lists fp8 and nvfp4 cache dtypes); the dark cap on each cube is that weight\'s own reconstruction error, so the bar tracks show '
      + 'bits/element while the caps show what those bits cost. NVFP4 = FP4 E2M1 data with an FP8-E4M3 scale per 16-element block '
      + '(OCP Microscaling Formats; Chhugani et al., arXiv:2409.12517). '
      + 'ILLUSTRATIVE / SIMULATED: the weight and activation values are a fixed fake sample, not a checkpoint; the drawn block boundaries '
      + '(2–3 columns) are schematic — the 4.25 bits/param assumes one FP16 scale+zero per 128-group (4 + 32/128) and 4.5 assumes 4 + 8/16; '
      + 'only 8 INT4 magnitude levels are drawn so the steps are visible on screen; KV plate thickness ratios and the fp16 reference outline are '
      + 'relative byte sizes, not GiB. The "w err" number is computed from this fake grid, so it is not a model\'s accuracy loss. '
      + 'DO NOT IMPLY: any speedup, memory saving in GiB, measured model comparison, or that these kernels are available — nvfp4 needs supported '
      + 'hardware and fp8/fp4 accuracy depends on scaling and calibration; real recipes quantise selectively (bypassed layers), not every tensor; '
      + 'fp16 here means the fp16/bf16 baseline. Clicking a dial pauses the tour; ▶ replays it.',
  },
];
