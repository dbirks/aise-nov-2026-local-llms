import type { Slide } from '../../deck/types';
import { chip } from './_chapters';
import { meta } from './_meta';

export const slide: Slide = {
  id: 'f01', type: 'scene', scene: 'engine-map', chip: chip(5),
  caption: {
    title: 'Fast here, missing there',
    body: 'Some engines are tuned for one GPU and one model family, and can beat general engines on exactly that pair. Move one cell over and the support may simply not exist.',
  },
  controls: [
    { kind: 'choice', action: 'engine', label: 'engine', initial: 'all', options: [
      { label: 'all', value: 'all' }, { label: 'llama.cpp', value: 'llamacpp' },
      { label: 'vLLM', value: 'vllm' }, { label: 'SGLang', value: 'sglang' },
      { label: 'NInfer', value: 'ninfer' }, { label: 'Radiance', value: 'radiance' },
      { label: 'Pennyroyal', value: 'pennyroyal' },
    ] },
    { kind: 'toggle', action: 'unknown', label: 'show unverified', initial: true },
  ],
  notes: meta({
    id: 'F01', claim: 'A specialized engine can be fast for a particular GPU and model while other combinations lack documented support.',
    evidence: ['MECHANISM', 'SPEAKER OBSERVATION', 'OPEN / VERSION-DEPENDENT'],
    simulated: 'Board is a selective source map, not a complete compatibility matrix; pillar heights encode evidence, not performance. Cell sources: llama.cpp 5090 CUDA/RPC, PRO 6000 CUDA, R9700 Vulkan discussion, Apple Metal, CPU: llama.cpp build and RPC docs; vLLM 5090 and PRO 6000 CUDA, Apple Metal plugin, CPU: vLLM installation; SGLang 5090 and PRO 6000 CUDA, CPU: SGLang installation/hardware docs; NInfer 5090: NInfer README; Pennyroyal PRO 6000: project README; Radiance R9700: speaker report. All other cells: no source recorded.',
    not: 'universal ranking; empty means unsupported or slow; Radiance is CUDA; runtimes were entirely AI-written; NInfer covers all Blackwell',
    open: 'speaker benchmark conditions for NInfer/Pennyroyal; coworker permission to cite Radiance; versions, model and backend compatibility',
    sources: ['https://github.com/dbirks/ninfer (speaker fork, public)', 'https://github.com/ggml-org/llama.cpp/blob/master/docs/build.md', 'https://github.com/ggml-org/llama.cpp/tree/master/tools/rpc', 'https://github.com/ggml-org/llama.cpp/discussions/10879', 'https://docs.vllm.ai/en/latest/getting_started/installation/gpu/', 'https://docs.vllm.ai/en/latest/getting_started/installation/cpu/', 'https://docs.sglang.io/docs/get-started/install', 'https://docs.sglang.io/docs/platforms/cpu', 'https://github.com/Neroued/ninfer', 'https://github.com/jpezzulli/sglang-rtxpro6000'],
  }),
};
