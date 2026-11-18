import type { Slide } from '../../deck/types';
import { chip } from './_ch';
import { meta } from '../route/_meta';

// Variant B: agent request strips in depth + one shared KV row (variant A reuses v1 D03 / prefix-match).
export const slides: Slide[] = [{
  id: 'prefix-cache-b',
  variant: 'B',
  type: 'scene',
  scene: 'prefix-strips',
  chip: chip(6),
  caption: {
    title: 'Same first tokens, shared work',
    body: "Agents usually start with the same system prompt and tool list. The engine can reuse the cached work for that shared start and only compute what's new.",
  },
  controls: [
    { kind: 'toggle', action: 'share', label: 'prefix caching', initial: true },
    { kind: 'choice', action: 'agents', label: 'agents', options: [{ label: '2', value: 2 }, { label: '3', value: 3 }, { label: '4', value: 4 }], initial: 3 },
  ],
  notes: meta({
    id: 'prefix-cache-b',
    claim: 'Requests sharing a tokenized start can reuse that prefix KV, so the engine prefills only what differs.',
    evidence: ['MECHANISM', 'SYNTHETIC DEMO'],
    simulated: 'Toy prompt set: 12 shared tokens + a 3-token tail per agent. Prefill counts are arithmetic on that toy (12 + 3·agents shared, 15·agents not), not a measured TTFT saving.',
    not: 'Reuse is not guaranteed: eviction, block-edge quantization and slot/engine locality can all stop it, and prompts that differ early share nothing. A hit saves prefill only, not decode.',
    open: 'Real engines require whole-block hashes (vLLM, 16/64 tokens), exact-match LCP inside one llama.cpp slot, or a radix tree (SGLang); the scene shows the shared ideal, not any one engine.',
    sources: ['docs/research/v2/kv-serving.md (prefix-cache, facts 1-6)', 'https://docs.vllm.ai/en/latest/design/prefix_caching/', 'https://github.com/ggml-org/llama.cpp/blob/master/tools/server/README.md'],
  }),
}];
