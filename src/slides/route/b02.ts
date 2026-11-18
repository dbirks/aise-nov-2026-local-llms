import type { Slide } from '../../deck/types';
import { chip } from './_chapters';
import { meta } from './_meta';
import { slides as base } from '../scene-lab/04-memtiers';

// B02 — reuses an existing builder with route copy (handoff §3 B02).
export const slide: Slide = {
  ...(base[0] as Extract<Slide, { type: 'scene' }>),
  id: 'b02',
  example: false,
  chip: chip(1),
  caption: {
    title: "Size, speed, access pattern",
    body: "VRAM, system RAM and an NVMe drive are three shelves with different sizes, speeds and favourite ways to be read. Capacity, bandwidth and latency are three separate numbers.",
  },
  notes: meta({
    id: "B02",
    claim: "size, bandwidth and latency are separate constraints per memory tier",
    evidence: ["MECHANISM", "MANUFACTURER SPEC"],
    simulated: "shelf widths are log-scale illustrative; pipe rates carry the README benchmark labels",
    not: "an eGPU link does not throttle every VRAM read; peak specs and benchmark rates are not on one comparable scale; no tok/s",
    open: "speaker STREAM/CUDA/fio measurements to replace published reference numbers",
    reuses: "memtiers (scene lab)",
    sources: ["README bandwidth table (benchmark labels kept in the scene)", "https://www.nvidia.com/en-us/geforce/graphics-cards/50-series/rtx-5090/", "https://docs.nvidia.com/dgx/dgx-spark/hardware.html"],
  }),
};
