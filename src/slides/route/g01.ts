import type { Slide } from '../../deck/types';
import { chip } from './_chapters';
import { meta } from './_meta';

export const slide: Slide = {
  id: 'g01',
  type: 'scene',
  scene: 'collective',
  chip: chip(6),
  caption: {
    title: 'Sharing without a VPN',
    body: 'Each contributor’s machine runs its own whole model and dials OUT to a gateway, so nobody opens a home port or joins a VPN. Requests come back down that same connection.',
  },
  controls: [
    { kind: 'toggle', action: 'drop', label: 'contributor b offline', initial: false },
    { kind: 'toggle', action: 'inbound', label: 'show inbound', initial: false },
  ],
  notes: meta({
    id: 'G01',
    claim: 'independently hosted model endpoints can be contributed without VPN membership or inbound home ports',
    evidence: ['MECHANISM'],
    simulated: '2 independent home machines, 3 generic catalog entries (model a, b, c), illustrative packet timing',
    not: 'pooled VRAM, cross-host tensor parallelism or shared KV; a VPN; local-only data (requests leave your laptop for a contributor\'s machine)',
    sources: ['docs/presentation-production-handoff.md §1 ch.06 + §4.6 (public-safe summary of the private implementation)'],
  }),
};
