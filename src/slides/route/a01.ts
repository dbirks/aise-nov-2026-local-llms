import type { Slide } from '../../deck/types';
import { chip } from './_chapters';
import { meta } from './_meta';

// A01 — "Why bother?": one agent loop, shown as a swimlane the model only contributes text to.
export const slide: Slide = {
  id: 'a01',
  type: 'scene',
  scene: 'agent-loop',
  chip: chip(0),
  caption: {
    title: 'The model picks, the harness acts',
    body: 'A coding agent is a loop: the model reads the conversation and writes its next step, and the harness runs that tool and feeds the result back. The model never runs tools itself.',
  },
  controls: [
    {
      kind: 'choice', action: 'turn', label: 'turn', initial: 1,
      options: [{ label: '1', value: 1 }, { label: '2', value: 2 }, { label: '3', value: 3 }, { label: '4', value: 4 }],
    },
    { kind: 'toggle', action: 'reveal', label: 'where tools run', initial: false },
  ],
  notes: meta({
    id: 'A01',
    claim: 'local model capability matters when it makes useful decisions in a real loop',
    evidence: ['SYNTHETIC DEMO', 'SPEAKER OBSERVATION'],
    simulated: 'the whole 4-turn trace is synthetic (handoff V1: "conspicuously synthetic"); the only numbers drawn are turn n/4 and the count of message tiles on the strip',
    not: 'the model has unrestricted access or executes tools; remembering to commit proves a training method; a measured success rate',
    open: 'sanitized real trace from the speaker (handoff §7)',
    sources: ['docs/presentation-production-handoff.md §1 ch.00', 'https://docs.vllm.ai/en/latest/features/tool_calling/'],
  }),
};
