import type { Slide } from '../../deck/types';
import { chip } from './_chapters';
import { meta } from './_meta';

// A03 — closing audience check (handoff §3 A03): no universal best setup, the workload decides.
export const slide: Slide = {
  id: 'a03',
  type: 'scene',
  scene: 'profiles',
  chip: chip(7),
  caption: {
    title: 'No best setup, only your workload',
    body: 'Every choice in this talk bought something by spending something else. Pick the workload first, then see which limits you actually hit. What are you running?',
  },
  controls: [{
    kind: 'choice', action: 'profile', label: 'workload', initial: 'coding',
    options: [
      { label: 'coding agent', value: 'coding' },
      { label: 'private / offline', value: 'private' },
      { label: 'cheap chat', value: 'chat' },
      { label: 'long context', value: 'long' },
    ],
  }],
  notes: meta({
    id: 'A03',
    claim: 'there is no universal best local setup; the workload decides which limits matter',
    evidence: ['HYPOTHESIS / OPINION'],
    simulated: 'emphasis levels (low/med/high) are the speaker’s framing of his own chapters, not measurements; the four profiles are illustrative workloads',
    not: 'a ranking of setups or hardware, or that one profile “wins”; any Mac / MLX performance claim; that emphasis height maps to a measured quantity',
    open: 'invite Apple Silicon / MLX / oMLX experiences from the audience (the speaker has tried a Mac once); speaker may swap in his own workloads live',
    sources: ['docs/presentation-production-handoff.md §1 chapter 07', 'docs/presentation-production-handoff.md §3 A03'],
  }),
};
