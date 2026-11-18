import type { Slide } from '../../deck/types';
import { chip } from './_chapters';
import { meta } from './_meta';

export const slide: Slide = {
  id: 'd03', type: 'scene', scene: 'prefix-match', chip: chip(3),
  caption: { title: 'Same first tokens, reused work', body: 'If a new request starts with exactly the same tokens as an earlier one, the server can reuse that work instead of recomputing it: prefix caching. One changed token early on ends the match there.' },
  controls: [
    { kind: 'choice', action: 'change', label: 'request B differs at', options: [{ label: 'nowhere', value: -1 }, { label: 'token 3', value: 3 }, { label: 'token 9', value: 9 }], initial: -1 },
    { kind: 'toggle', action: 'evict', label: 'evicted', initial: false },
  ],
  notes: meta({ id: 'D03', claim: 'Repeated exact initial tokens can reuse computed KV; vLLM reuses full blocks only.', evidence: ['MECHANISM', 'SYNTHETIC DEMO'], simulated: 'Block size 4, 16 tokens; the 50K system prompt is a hypothetical scale.', not: 'Reuse can resume after a mismatch; all harness prompts match; separate hosts share cache; partial blocks are reused (vLLM).', open: 'cache_salt is a tenant-isolation knob; verify configuration for the installed version.', sources: ['https://docs.vllm.ai/en/latest/design/prefix_caching/'] }),
};
