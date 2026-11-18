import type { Slide } from '../../deck/types';
import { chip } from './_chapters';
import { meta } from './_meta';
import { slides as base } from '../scene-lab/10-quant';

// C02 — reuses an existing builder with route copy (handoff §3 C02).
export const slide: Slide = {
  ...(base[0] as Extract<Slide, { type: 'scene' }>),
  id: 'c02',
  example: false,
  chip: chip(2),
  caption: {
    title: "Four bits is not one format",
    body: "A 4-bit number can only take a few values, so blocks of weights share a stored scale. INT4 spaces its levels evenly, NVFP4 (E2M1) does not, and weights, activations and KV each get their own precision.",
  },
  // weights dial labelled by weight format only: activation precision is its own dial (W4A16 vs W4A4 = both dials).
  controls: (base[0] as Extract<Slide, { type: 'scene' }>).controls?.map(c => c.kind === 'choice' && c.action === 'weights'
    ? { ...c, options: [{ label: 'fp16', value: 'fp16' }, { label: 'int4', value: 'int4' }, { label: 'nvfp4', value: 'nvfp4' }] }
    : c),
  notes: meta({
    id: "C02",
    claim: "code values and scale metadata differ between INT4 and NVFP4; weight/activation/KV precisions are independent",
    evidence: ["MECHANISM", "SYNTHETIC DEMO"],
    simulated: "fixed fake weights/activations; 8 INT4 magnitudes drawn; block boundaries schematic",
    not: "4 bits per parameter in total storage (scales add bytes); any speedup or memory saving in GiB; weight NVFP4 = KV NVFP4",
    open: "which real Qwen3.8 tensors stayed BF16 (AutoRound exceptions) for a V3 exception overlay",
    reuses: "quant (scene lab)",
    sources: ["https://docs.nvidia.com/deeplearning/transformer-engine/features/low_precision_training/nvfp4/nvfp4.html", "OCP Microscaling Formats spec", "https://docs.vllm.ai/en/latest/features/quantization/quantized_kvcache/"],
  }),
};
