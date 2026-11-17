import type { Slide } from '../../deck/types';

// Brainstorm candidate for README "Scene N — 'fit the model' versus 'keep the agents fast'".
// Nothing here is a measurement: bar heights are relative shapes, the block counts are drawn counts,
// and the eviction order is an illustrative LRU-like policy, not a verified engine policy.
export const slides: Slide[] = [
  {
    id: 'lab-agent-eviction',
    type: 'scene',
    scene: 'agent-eviction',
    example: true,
    chip: 'LAB — Agent eviction',
    caption: {
      title: 'Model fits, cache doesn’t',
      body: 'The weights fit. Each agent’s retained prefix takes pool blocks too — until a turn returns to find its prefix evicted and reprefills.',
    },
    controls: [
      {
        kind: 'choice', action: 'agents', label: 'concurrent agents',
        options: [
          { label: '1', value: 1 },
          { label: '4', value: 4 },
          { label: '8', value: 8 },
          { label: '24', value: 24 },
        ],
        initial: 8,
      },
      {
        kind: 'choice', action: 'dtype', label: 'kv precision',
        options: [{ label: 'fp8', value: 'fp8' }, { label: 'nvfp4', value: 'nvfp4' }],
        initial: 'fp8',
      },
    ],
    notes: 'Brief: README "Scene N — fit the model versus keep the agents fast" + prefix caching / quantized KV (README 196-204, 559-567). '
      + 'Turns arrive one at a time (chatty agents more often); a turn whose prefix run is still in the pool is a small TTFT tick, one whose run had been pushed past the capacity post is a tall spike — the whole prefix is re-prefilled, block by block. The light outline behind a bar is the worst TTFT that agent has paid. '
      + 'ILLUSTRATIVE / SIMULATED, not measurements: the 68/32 weights-vs-pool split of the budget bar, the 30-block fp8 pool and 49-block nvfp4 pool (49/30 ≈ 1.63, chosen to echo the ONE dated observation in the README — a vLLM FP8 KV pool of 741,032 tokens becoming 1,225,765 under NVFP4; configuration-specific, not a universal scaling factor, and not quality-matched here), '
      + 'the 3-8 block prefix sizes and per-agent turn cadence (a fixed scripted workload: 4 agents = 24 blocks fit both precisions, 8 agents = 44 blocks overflow fp8 but fit nvfp4, 24 agents = 132 blocks overflow both), and every bar height — relative shapes, no ms, no tok/s, no GiB. '
      + 'Eviction is an LRU-like drop of whole least-recently-used prefixes, drawn that way for legibility: do NOT read it as the eviction/preemption algorithm of vLLM, llama.cpp or Ollama (verify per engine and version). '
      + 'Do not imply: that cache precision changes decode throughput, that quantized KV is free (it needs a matched-quality test), that a full pool silently keeps everyone admitted (admission, preemption and recompute are engine/version-specific), or that fp8/nvfp4 KV is available on every backend — it depends on GPU, kernel and engine support. '
      + 'Deliberately not shown: decode tok/s, prompt preemption/resume, hybrid recurrent state, host-offloaded prefix space, and the model-size/quant axis of Scene N — this is view A, "model fits, cache doesn’t", with the nvfp4 toggle as the on-ramp to view B.',
  },
];
