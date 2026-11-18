import type { Slide } from '../../deck/types';
import { chip } from './_chapters';
import { meta } from './_meta';

export const slide: Slide = {
  id: 'b01',
  type: 'scene',
  scene: 'gpu-choice',
  chip: chip(1),
  caption: {
    title: 'Room vs speed vs where it plugs in',
    body: 'A DGX Spark holds far more (128 GB), an RTX 5090 moves its 32 GB much faster (rated bandwidth). I also needed it plugged into my Windows laptop, so I chose an external 5090.',
  },
  controls: [
    {
      kind: 'choice',
      action: 'budget',
      label: 'model + kv',
      options: [
        { label: '20 GB', value: 20 },
        { label: '30 GB', value: 30 },
        { label: '40 GB', value: 40 },
        { label: '90 GB', value: 90 },
      ],
      initial: 30,
    },
    {
      kind: 'toggle',
      action: 'egpu',
      label: 'laptop eGPU',
      initial: true,
    },
  ],
  notes: meta({
    id: 'B01',
    claim: 'DGX Spark and RTX 5090 solve different constraints',
    evidence: ['MANUFACTURER SPEC', 'SPEAKER OBSERVATION'],
    simulated: 'tank heights proportional to GB capacity (32 vs 128); pipe thickness proportional to sqrt(rated GB/s); 20/30/40/90 GB blocks and packet motion are illustrative',
    not: 'DGX Spark is globally slower; bandwidth ratio = tok/s ratio; the eGPU link limits decode',
    open: 'the first model/quant/context that drove 24 vs 32 GB; the dock/link and the ~20 s load conditions',
    sources: [
      'https://www.nvidia.com/en-us/geforce/graphics-cards/50-series/rtx-5090/',
      'https://docs.nvidia.com/dgx/dgx-spark/hardware.html',
    ],
  }),
};
