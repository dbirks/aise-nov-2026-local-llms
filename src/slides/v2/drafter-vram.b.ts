import type { Slide } from '../../deck/types';
import { chip } from './_ch';
import { meta } from '../route/_meta';

export const slides: Slide[] = [{
  id: 'drafter-vram-b', variant: 'B', type: 'scene', scene: 'drafter-budget', chip: chip(7),
  caption: { title: 'The drafter needs room too', body: 'Its weights and its own cache come out of the same VRAM as the big model. A sliding window keeps the drafter’s cache from growing with the whole context.' },
  controls: [
    { kind: 'choice', action: 'ctx', label: 'context', options: [{ label: '8k', value: 8 }, { label: '32k', value: 32 }, { label: '128k', value: 128 }], initial: 32 },
    { kind: 'toggle', action: 'window', label: 'drafter window', initial: true },
  ],
  notes: meta({ id: 'drafter-vram-b', claim: 'Drafter weights and the drafter’s own KV cache are reserved from the same VRAM budget as the target weights and target KV; sliding-window attention caps the drafter’s KV at long context.', evidence: ['MECHANISM', 'SYNTHETIC DEMO'], simulated: 'All sizes are toy units in a 32-unit column (weights 10+3, KV linear at ctx/4, window cap 5); not GiB, not a measured model. Real arithmetic (e.g. DFlash2 3.58 GiB weights + 20 KiB/tok capped at 40 MiB/seq by window 2048) is in the research packet.', not: 'these are real GB; the drafter is free', sources: ['https://github.com/vllm-project/speculators/blob/main/README.md', 'https://github.com/vllm-project/vllm/blob/main/vllm/v1/worker/gpu/spec_decode/dflash/speculator.py', 'docs/research/v2/spec.md'] }),
}];
