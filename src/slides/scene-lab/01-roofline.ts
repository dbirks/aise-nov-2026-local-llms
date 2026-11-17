import type { Slide } from '../../deck/types';

export const slides: Slide[] = [
  {
    id: 'lab-roofline',
    type: 'scene',
    scene: 'roofline',
    example: true,
    chip: 'LAB — Roofline',
    caption: {
      title: 'Is it bandwidth or compute?',
      body: 'Throughput is min(peak compute, bandwidth × flop per byte). Decode at batch 1 sits on the ramp; prefill rides the flat roof. Batch and fewer weight bytes move it right.',
    },
    controls: [
      { kind: 'choice', action: 'batch', label: 'decode batch', options: [1, 8, 64].map(v => ({ label: String(v), value: v })), initial: 1 },
      { kind: 'choice', action: 'prompt', label: 'prefill prompt', options: [{ label: '128', value: 128 }, { label: '2k', value: 2048 }], initial: 128 },
      { kind: 'choice', action: 'weights', label: 'weights', options: [{ label: 'fp16', value: 'fp16' }, { label: '4-bit', value: '4-bit' }], initial: 'fp16' },
    ],
    notes: 'Brief: README "Scene H" + roofline notes (Williams/Paterson/Waterman, CACM 2009; NVIDIA prefill/decode blog). '
      + 'ILLUSTRATIVE ROOF: the peak, the ridge (≈32 flop/byte) and both axis ranges are invented for legibility, not a measured GPU — the roof stays fixed at every setting. '
      + 'Marker intensities follow README §2\'s idealized weight-only example (B token vectors reusing one weight tile ≈ B flop/byte; a prefill chunk ≈ its token count, capped at 512 here). '
      + 'They ignore KV reads, activations, output writes, quant scales, padding and kernel efficiency, so real markers sit lower and move less. '
      + 'A longer prompt means MORE PASSES under the same roof, not more headroom. 4-bit is drawn as ~4× fewer weight bytes per flop and nothing else: it also changes kernel choice, dequant work and hardware support, '
      + 'and a marker already on the roof gains nothing from cheaper bytes. Memory-bound here means "bytes set the height", not "the GPU is idle" — and "100% busy" does not prove compute-bound. '
      + 'The x axis is log2-spaced (ticks 1/8/64/512); the light column above a marker is throughput that intensity cannot reach.',
  },
];
