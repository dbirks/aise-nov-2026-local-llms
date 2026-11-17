import type { Slide } from '../../deck/types';

export const slides: Slide[] = [{
  id: 'lab-ssd-access',
  type: 'scene',
  scene: 'ssd-access',
  example: true,
  chip: 'LAB — SSD access',
  caption: {
    title: 'Sparse rows, not a weight stream',
    body: 'NVMe suits PLE lookups: hashes pick a few rows per token, hopping via staging. Rereading all weights each token starves the GPU. Rates are p510 crystaldiskmark scenarios.',
  },
  controls: [
    {
      kind: 'choice', action: 'mode', label: 'access', initial: 'sparse',
      options: [{ label: 'sparse rows', value: 'sparse' }, { label: 'dense reread', value: 'dense' }],
    },
    { kind: 'toggle', action: 'prefetch', label: 'prefetch', initial: true },
    {
      kind: 'choice', action: 'hit', label: 'cache hit', initial: 50,
      options: [{ label: '0%', value: 0 }, { label: '50%', value: 50 }, { label: '90%', value: 90 }],
    },
  ],
  notes: 'Brief: README "Scene O". Everything animated is illustrative and simulated: a 32-row toy PLE table, 3–4 hashed rows per token, all hop/block durations, the 4-slot staging buffer, the token-counter wrap, and the dense block "squeezing" through the staging plate (a metaphor for the capacity mismatch, not a modelled transfer). The readout names the rates as a LABELLED SCENARIO from the Crucial P510 1 TB review unit (CrystalDiskMark SEQ1M Q8T1 10.97 GB/s vs RND4K Q1T1 74.75 MB/s) — radically different access patterns on one review unit; do NOT claim the real Pennyroyal PLE workload hits these numbers (it may batch, coalesce, use OS caching and prefetch) and do NOT convert them to tokens/s. What the scene argues accurately: an NVMe-resident hashed table works because reads are sparse, indexed and prefetchable, while re-streaming dense weights every decode step leaves the GPU idle; prefetch hides per-row latency by issuing reads one beat early; a cache hit skips the disk hop entirely; hit ratio, queue depth and prefetch, not sequential-marketing GB/s, decide whether SSD placement works. Not modelled: separate host-buffer vs PCIe staging tiers, queue depth, page size, n-gram lookup counts, hybrid state, and any direct SSD↔GPU path (traffic always passes the staging buffer).',
}];
