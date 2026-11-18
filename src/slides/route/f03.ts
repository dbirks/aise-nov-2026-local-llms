import type { Slide } from '../../deck/types';
import { chip } from './_chapters';
import { meta } from './_meta';
import { slides as base } from '../scene-lab/05-ssd-access';

// F03 — reuses an existing builder with route copy (handoff §3 F03).
export const slide: Slide = {
  ...(base[0] as Extract<Slide, { type: 'scene' }>),
  id: 'f03',
  example: false,
  chip: chip(5),
  caption: {
    title: "The table lives on the SSD",
    body: "Pennyroyal keeps Qwen3.8-Flash-Next’s ~47.68 GiB n-gram table (PLE) on NVMe and fetches only the rows each token needs. The rest of the model stays on the GPU.",
  },
  notes: meta({
    id: "F03",
    claim: "a large n-gram weight table can live cold on NVMe and be read sparsely",
    evidence: ["MECHANISM", "MEASURED ON SPEAKER SYSTEM"],
    simulated: "32-row table, cache hit ratios",
    not: "MoE expert offload; scanning the whole table per token; zero-latency random I/O; tok/s numbers",
    reuses: "ssd-access (scene lab)",
    sources: ["https://huggingface.co/Qwen/Qwen3.8-Flash-Next", "https://github.com/dbirks/home-k8s/issues/135", "https://github.com/dbirks/home-k8s/blob/main/apps/pennyroyal-flashnext.yaml"],
  }),
};
