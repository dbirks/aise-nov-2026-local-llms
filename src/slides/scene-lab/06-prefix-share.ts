import type { Slide } from '../../deck/types';

// Brainstorm candidate for README "Scene R — three agent harnesses, one shared prefix".
// The three light rails (the prompts) never change; only the dark KV-storage structure under them
// does. Every size, block count and timing in the scene is illustrative geometry, not a measurement.
export const slides: Slide[] = [
  {
    id: 'lab-prefix-share',
    type: 'scene',
    scene: 'prefix-share',
    example: true,
    chip: 'LAB — Prefix sharing',
    caption: {
      title: 'One prefix, three agents',
      body: 'Same 50k prefix from three agents: vLLM shares one set of KV blocks, SGLang grows one radix trunk that branches, llama.cpp slots can each keep their own copy.',
    },
    controls: [
      {
        kind: 'choice', action: 'mode', label: 'engine',
        options: [
          { label: 'vllm blocks', value: 'vllm' },
          { label: 'sglang radix', value: 'sglang' },
          { label: 'llama.cpp slots', value: 'llamacpp' },
        ],
        initial: 'vllm',
      },
      { kind: 'toggle', action: 'diverge', label: 'diverge at token 500', initial: false },
    ],
    notes: 'Brief: README "Scene R". Three token-identical prompts, then different project histories; switch index structure while the prompts stay fixed.'
      + ' Illustrative/simulated: the 50k shared-prefix length (README keeps it illustrative — never assert a real harness prompt size), 8 drawn cells per region instead of thousands of real blocks, the divergence marker is drawn at ~24% of the prefix because 500 of 50k = 1% is invisible, arrival times and prefill speed are animation timing, and the readout counts drawn cells, not tokens or GiB.'
      + ' Mechanism shown: vLLM keys reusable completed KV blocks by a hash chain (previous block hash + tokens inside the block + extras like cache salt), so a compatible request retrieves the same block ids and raises their reference count — hence one dark block row, three cables, three stacked tick bars. Only the LONGEST matching initial prefix is reusable, so the divergence toggle cuts the shared row to a stub; the drawn cell containing the divergence point is left as a light outline (partial block = not reusable at that granularity). At vLLM\'s real default block size many full blocks before token 500 would stay reusable — the drawing compresses that scale.'
      + ' SGLang RadixAttention is a compressed radix tree over cached token ids: one trunk, one branch per conversation after the first differing token, an index/eviction strategy only. It is NOT a change to softmax(QK^T)V and NOT an EAGLE-style speculative-decoding candidate tree. llama.cpp is drawn as three slots holding separate prompt states because three simultaneously active slots can each keep their own copy; --cache-prompt / --kv-unified / --cache-ram are not a promise of one de-duplicated physical prefix across slots, and cross-slot shared KV cells are a proposal (llama.cpp discussion 30664), not mainline behaviour.'
      + ' Not shown, deliberately: block eviction and the free queue, cache salt/tenant isolation, two independent replicas not sharing KV, and hybrid models (a Mamba/DeltaNet layer needs a recurrent-state checkpoint at a compatible boundary, not 50k ordinary K/V blocks).',
  },
];
