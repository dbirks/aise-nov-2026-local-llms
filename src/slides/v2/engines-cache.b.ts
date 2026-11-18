import type { Slide } from '../../deck/types';
import { chip } from './_ch';
import { meta } from '../route/_meta';

export const slides: Slide[] = [{
  id: 'engines-cache-b',
  variant: 'B',
  type: 'scene',
  scene: 'cache-three',
  chip: chip(6),
  caption: {
    title: 'Three engines, three ways to find a shared start',
    body: 'The same three requests go to each engine. vLLM matches whole hashed blocks, SGLang walks a tree of tokens, and llama.cpp only reuses what is already in that slot.',
  },
  controls: [
    {
      kind: 'choice',
      action: 'slot',
      label: 'R2 lands on',
      options: [
        { label: 'same slot', value: 'same' },
        { label: 'other slot', value: 'other' },
      ],
      initial: 'same',
    },
  ],
  notes: meta({
    id: 'engines-cache-b',
    claim: 'vLLM chained block hashes, SGLang RadixAttention token tree, and llama.cpp per-slot LCP reuse shared prefixes with different granularity and slot rules',
    evidence: ['MECHANISM', 'OPEN / VERSION-DEPENDENT'],
    simulated: 'Toy prompts: S = 8 tokens, R1 = S + 4a, R2 = S + 4b, R3 = 3 of S + 5c; vLLM toy block 4 (real default 16 through v0.33, 64 in v0.34); SGLang page size 1; llama.cpp 2 slots',
    not: 'one engine is best; the three are the same cache drawn three ways (for B); llama.cpp shares across slots by default; --cache-reuse is free',
    open: 'vLLM default block size changed 16 → 64 in v0.34.0 (2026-11-16); SGLang default schedule policy is fcfs (since 2026-08-11); confirm speaker vLLM version and llama.cpp -np slot setup',
    sources: [
      'https://docs.vllm.ai/en/latest/design/prefix_caching/',
      'https://github.com/vllm-project/vllm/blob/main/vllm/v1/core/kv_cache_utils.py',
      'https://github.com/sgl-project/sglang/blob/main/python/sglang/srt/mem_cache/radix_cache.py',
      'https://arxiv.org/abs/2312.07104',
      'https://github.com/ggml-org/llama.cpp/blob/master/tools/server/README.md',
      'https://github.com/ggml-org/llama.cpp/blob/master/tools/server/server-context.cpp',
    ],
  }),
}];
