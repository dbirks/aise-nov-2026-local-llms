import type { Slide } from '../../deck/types';
import { chip } from './_ch';
import { meta } from '../route/_meta';

export const slides: Slide[] = [{
  id: 'setup-egpu-a',
  variant: 'A',
  type: 'scene',
  scene: 'egpu-box',
  chip: chip(3),
  caption: {
    title: 'My work laptop has to stay my work laptop',
    body: 'Client work runs in Windows and WSL, and the data can’t leave the laptop. So the GPU sits in an external enclosure on Thunderbolt 4.',
  },
  controls: [
    { kind: 'toggle', action: 'boundary', label: 'data boundary', initial: true },
  ],
  notes: meta({
    id: 'setup-egpu',
    claim: 'Client work runs in Windows + WSL on the work laptop and data cannot leave it, so the GPU sits in an external enclosure over Thunderbolt 4.',
    evidence: ['SPEAKER OBSERVATION'],
    not: 'the eGPU is as fast as an internal slot for every workload; data leaves the laptop; numbers measured unless labelled',
    sources: ['speaker observation', 'docs/research/v2/setup.md'],
  }),
}];
