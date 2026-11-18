import type { Slide } from '../../deck/types';
import { chip } from './_chapters';
import { meta } from './_meta';
import { slides as base } from '../scene-lab/13-release-bundle';

// E06 — reuses an existing builder with route copy (handoff §3 E06).
export const slide: Slide = {
  ...(base[0] as Extract<Slide, { type: 'scene' }>),
  id: 'e06',
  example: false,
  chip: chip(4),
  caption: {
    title: "Model plus matched drafter",
    body: "Some releases now ship a matched draft model beside the main one, like Muse Glimmer 30B or Laguna 2.1 with DFlash. It is a separate download, and not every engine can run it.",
  },
  notes: meta({
    id: "E06",
    claim: "creators release main models with separately trained companion drafters",
    evidence: ["MECHANISM"],
    simulated: "artifact sizes are relative",
    not: "downloading the model installs the drafter; every drafter works with any quant or engine",
    reuses: "release-bundle (scene lab)",
    sources: ["https://huggingface.co/meta-models/Muse-Glimmer-30B-assistant", "https://huggingface.co/poolside/Laguna-S-2.1-DFlash", "https://huggingface.co/poolside/Laguna-XS-2.1-DFlash"],
  }),
};
