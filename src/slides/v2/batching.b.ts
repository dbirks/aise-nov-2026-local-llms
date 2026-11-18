import type { Slide } from '../../deck/types';
import { chip } from './_ch';
import { meta } from '../route/_meta';

// Variant B: one weight slab + B request lanes (variant A reuses v1 D02 / roofline).
export const slides: Slide[] = [{
  id: 'batching-b',
  variant: 'B',
  type: 'scene',
  scene: 'batch-read',
  chip: chip(6),
  caption: {
    title: 'One read of the weights, several requests',
    body: "Each decode step reads every weight from memory anyway. Adding more requests to that step reuses the same read, so total throughput rises even when each user doesn't get faster.",
  },
  controls: [
    { kind: 'choice', action: 'b', label: 'requests', options: [{ label: '1', value: 1 }, { label: '4', value: 4 }, { label: '16', value: 16 }], initial: 4 },
  ],
  notes: meta({
    id: 'batching-b',
    claim: 'A decode step streams every resident weight once whatever the batch, so the weight traffic lands on B tokens instead of one.',
    evidence: ['MECHANISM', 'SYNTHETIC DEMO'],
    simulated: 'Toy weight set of 20 units, one read per step; the per-token figure is 20 ÷ B arithmetic on that toy, with no bandwidth, time or tok/s.',
    not: 'Throughput does not scale forever, per-user speed does not improve, and KV reads are not free: once B×KV or compute dominates the step, per-user speed falls.',
    open: 'No measured tok/s vs batch curve from the speaker box; the ridge batch needs a verified peak-FLOPs figure (research packet, batching open questions).',
    sources: ['docs/research/v2/kv-serving.md (batching, facts 1-5, 9)', 'https://developer.nvidia.com/blog/co-designing-ai-model-attention-for-fast-interactive-long-context-inference/', 'https://www.usenix.org/conference/osdi22/presentation/yu'],
  }),
}];
