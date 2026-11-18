import type { Slide } from '../../deck/types';
import { slide as v1 } from '../route/g01';
import { chip } from './_ch';

// Variant A reuses v1 G01. Public-safe: no hosts, keys or topology.
export const slides: Slide[] = [{
  ...v1,
  id: "collective-a",
  variant: 'A',
  chip: chip(9),
  caption: {
    title: "LLM Collective: phone home, no VPN",
    body: "Each home machine runs a small agent that dials out to a gateway and keeps a tunnel open. Nothing at home is exposed to the internet.",
  },
  notes: "v2 collective · reuses v1 G01. " + (v1.notes ?? ''),
} as Slide];
