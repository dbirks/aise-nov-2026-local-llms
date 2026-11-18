import type { Slide } from '../../deck/types';
import { chip } from './_chapters';
import { meta } from './_meta';

export const slide: Slide = {
  id: 'b04',
  type: 'scene',
  scene: 'moe-offload',
  chip: chip(1),
  caption: {
    title: 'Experts parked in system RAM',
    body: 'If the experts don’t fit on the GPU, llama.cpp can keep some in system RAM. Each token that picks one of those pays a trip over the slower link, so a cache of hot experts helps.',
  },
  controls: [
    {
      kind: 'choice', action: 'place', label: 'cpu experts',
      options: [{ label: 'compute on cpu', value: 'cpu' }, { label: 'copy to gpu', value: 'copy' }],
      initial: 'cpu',
    },
    {
      kind: 'choice', action: 'cache', label: 'hot slots',
      options: [{ label: '0', value: 0 }, { label: '2', value: 2 }, { label: '4', value: 4 }],
      initial: 2,
    },
  ],
  notes: meta({
    id: 'B04',
    claim: 'expert weights kept in system RAM still run when routed to; a miss either sends the activation over the link or uploads the expert, and a hot-expert cache removes that trip',
    evidence: ['MECHANISM', 'OPEN / VERSION-DEPENDENT', 'SYNTHETIC DEMO'],
    simulated: '8 experts in one MoE layer, 6 tokens × 2 picks (fixed synthetic routing with a repeating hot set), hot cache drawn as 0/2/4 slots; hits, misses, expert copies and activation trips are counted from that toy model',
    not: "PLE's single-row n-gram hash lookups; that offloaded experts are unused weights; that CPU and GPU experts run at equal speed; any tok/s figure",
    open: 'speaker’s actual --cpu-moe / -ot settings and --moe-cache-mib size',
    sources: ['https://github.com/ggml-org/llama.cpp/blob/master/docs/moe-cache.md', 'https://github.com/ggml-org/llama.cpp/blob/master/tools/server/README.md'],
  }),
};
