import type { Slide } from '../../deck/types';
import { chip } from './_ch';
import { meta } from '../route/_meta';

export const slides: Slide[] = [{
  id: 'setup-egpu-b',
  variant: 'B',
  type: 'scene',
  scene: 'egpu-pipes',
  chip: chip(3),
  caption: {
    title: 'A thin cable, a very fast card',
    body: "Thunderbolt 4 carries a few gigabytes per second, while the GPU reads its own memory at well over a thousand. That's fine, because the weights cross the cable once.",
  },
  controls: [
    {
      kind: 'choice',
      action: 'link',
      label: 'link',
      options: [
        { label: 'Thunderbolt 4', value: 'tb4' },
        { label: 'Thunderbolt 5', value: 'tb5' },
      ],
      initial: 'tb4',
    },
  ],
  notes: meta({
    id: 'setup-egpu-b',
    claim: 'Thunderbolt 4 PCIe tunneling peaks at 32 Gb/s (~4 GB/s theoretical max; TB5 64 Gb/s or ~8 GB/s), two orders of magnitude slower than an RTX 5090’s 1,792 GB/s GDDR7 memory bandwidth, which works when weights load across the cable once.',
    evidence: ['MANUFACTURER SPEC', 'MECHANISM'],
    simulated: 'Pipe cross-section area scales as sqrt(GB/s) so the thin cable stays visible; cube flow rates are exact 4 : 8 : 1,792 proportions.',
    not: 'the link speed limits token generation once weights are loaded; measured on the speaker\'s machine',
    sources: [
      'https://www.thunderbolttechnology.net/sites/default/files/intel-thunderbolt4-announcement-press-deck.pdf',
      'https://www.intel.com/content/dam/www/central-libraries/us/en/documents/2023-09/thunderbolt-5-technology-brief.pdf',
      'https://www.nvidia.com/en-us/geforce/graphics-cards/50-series/rtx-5090/',
      'docs/research/v2/setup.md',
    ],
  }),
}];
