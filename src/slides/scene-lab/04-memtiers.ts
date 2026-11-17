import type { Slide } from '../../deck/types';

export const slides: Slide[] = [{
  id: 'lab-memtiers',
  type: 'scene',
  scene: 'memtiers',
  example: true,
  chip: 'LAB — Memory tiers',
  caption: {
    title: 'Size, speed and access pattern',
    body: 'One word, three axes: shelf width = capacity (log scale), pipe thickness = the measured rate printed under it, packets = transfer size and access pattern. The rate’s benchmark is in the readout.',
  },
  controls: [
    {
      kind: 'choice', action: 'ram', label: 'system ram', initial: 'ddr5',
      options: [{ label: 'ddr3', value: 'ddr3' }, { label: 'ddr4', value: 'ddr4' }, { label: 'ddr5', value: 'ddr5' }],
    },
    {
      kind: 'choice', action: 'access', label: 'nvme access', initial: 'seq',
      options: [{ label: 'sequential', value: 'seq' }, { label: 'random 4k', value: 'rnd' }],
    },
  ],
  notes: 'Brief: README "Scene M" + the measured bandwidth table. Rates are the table’s own observations with their benchmark labels: RTX PRO 6000 96 GB GPU copy 1466.75 GB/s (Boston Ltd) — an ON-DEVICE copy, not GPU↔CPU; DDR3-1600/DDR4-3200/DDR5-5600 dual-channel read 20.5/41.5/78.0 GB/s (moc-memory-stream-v4, small platform-specific samples, not STREAM Triad); Crucial P510 1 TB CrystalDiskMark SEQ1M Q8T1 10.97 GB/s vs RND4K Q1T1 0.0748 GB/s (review unit, radically different access patterns). Different benchmarks/platforms/queue depths: order-of-magnitude examples, never a controlled shootout, never convertible to tokens/s. '
    + 'Illustrative: the hardware profile (96 GB VRAM = RTX PRO 6000, ~46 GB host RAM from the README, 1 TB = the P510 review unit — not a single real machine), all encodings are non-linear (width ∝ log2 GB with the tick ruler, pipe thickness ∝ √GB/s, packet speed ∝ ∛GB/s, cube size ∝ transfer granularity, 1-6 packets in flight), and the GPU core shading tracks packet arrivals, not SM occupancy. '
    + 'The shared host rail (staging/PCIe) carries no number because the table has none — RAM/SSD rates are memory-side/disk-side benchmarks, not end-to-end feed rates; CPU rows are 2-channel consumer samples (8–12 channel servers reach 332–500 GB/s STREAM Triad), and an eGPU link can bottleneck host↔GPU transfers.',
}];
