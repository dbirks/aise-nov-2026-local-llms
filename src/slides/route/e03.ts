import type { Slide } from '../../deck/types';
import { chip } from './_chapters';
import { meta } from './_meta';
import { slides as base } from '../scene-lab/09-drafters';

// E03 — reuses an existing builder with route copy (handoff §3 E03).
export const slide: Slide = {
  ...(base[0] as Extract<Slide, { type: 'scene' }>),
  id: 'e03',
  example: false,
  chip: chip(4),
  caption: {
    title: "Drafting a whole block",
    body: "DFlash fills a block of masked positions in one draft pass. DSpark adds neighbour links and a confidence score, DFlash2 adds a local convolution and a candidate picker: three different computations.",
  },
  controls: [{ kind: 'choice', action: 'drafter', label: 'drafter', options: [{ label: 'DFlash', value: 'dflash' }, { label: 'DSpark', value: 'dspark' }, { label: 'DFlash2', value: 'dflash2' }], initial: 'dflash' }, { kind: 'choice', action: 'k', label: 'block', options: [{ label: '4', value: 4 }, { label: '8', value: 8 }], initial: 8 }],
  notes: meta({
    id: "E03",
    claim: "DFlash, DSpark and DFlash2 improve a block-parallel drafter in different ways",
    evidence: ["MECHANISM", "SYNTHETIC DEMO", "OPEN / VERSION-DEPENDENT"],
    simulated: "accept pattern, confidence values",
    not: "DFlash2 is DSpark v2; adaptive verification happens without runtime support; DFlash2 tooling is stable (docs call it experimental)",
    reuses: "drafters (scene lab), dflash2 family added for the route",
    sources: ["https://docs.vllm.ai/projects/speculators/en/latest/user_guide/algorithms/dspark/", "https://docs.vllm.ai/projects/speculators/en/latest/user_guide/algorithms/dflash2/"],
  }),
};
