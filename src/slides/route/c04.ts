import type { Slide } from '../../deck/types';
import { chip } from './_chapters';
import { meta } from './_meta';
import { slides as base } from '../scene-lab/15-decode-pass';

// C04 — reuses an existing builder with route copy (handoff §3 C04).
const baseSlide = base[0] as Extract<Slide, { type: 'scene' }>;

export const slide: Slide = {
  ...baseSlide,
  id: 'c04',
  example: false,
  chip: chip(2),
  caption: {
    title: "One token, one forward pass",
    body: "Each new token climbs every layer: the learned weights stay put in VRAM and attention reads the stored keys and values. Nothing is re-downloaded from disk per token.",
  },
  controls: (baseSlide.controls ?? []).map(c =>
    c.kind === 'choice' && c.action === 'arch'
      ? { ...c, options: [...c.options, { label: 'hybrid', value: 'hybrid' }] }
      : c,
  ),
  notes: meta({
    id: "C04",
    claim: "learned matrices are applied to each new position layer by layer; weights stay resident",
    evidence: ["MECHANISM", "SYNTHETIC DEMO"],
    simulated: "6 layers (hybrid places 2 full-attention layers at 3:1 spacing with 4 Gated DeltaNet fixed-state layers), tile counts and timing",
    not: "one giant copy of the model moves per token; all layers process a token in parallel; every layer is a classic attention block (hybrid DeltaNet layers keep a fixed recurrent state)",
    reuses: "decode-pass (scene lab)",
    sources: ["https://arxiv.org/abs/2309.06180", "https://huggingface.co/Qwen/Qwen3.8-27B", "model cards for dense vs MoE layer layouts"],
  }),
};
