import type { Slide } from '../../deck/types';
import { chip } from './_ch';
import { meta } from '../route/_meta';

export const slides: Slide[] = [{
  id: 'engines-cache-c',
  variant: 'C',
  type: 'scene',
  scene: 'cache-lens',
  chip: chip(6),
  caption: {
    title: 'Same prompts, different bookkeeping',
    body: 'One stream of requests, three ways to index it. What gets reused depends on block edges, tree branches or which slot you land on.',
  },
  controls: [
    {
      kind: 'choice',
      action: 'engine',
      label: 'index',
      options: [
        { label: 'vLLM blocks', value: 'vllm' },
        { label: 'SGLang tree', value: 'sglang' },
        { label: 'llama.cpp slots', value: 'llama' },
      ],
      initial: 'vllm',
    },
  ],
  notes: meta({
    id: 'engines-cache-c',
    claim: 'Indexing the same request stream by fixed hash blocks, a token radix tree, or per-slot buffers changes which prefix tokens can be reused',
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
