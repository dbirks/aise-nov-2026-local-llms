import type { Slide } from './deck/types';
import { splatLab } from './slides/splat-lab';

// The deck, in order. Everything marked `example: true` is placeholder content to exercise the
// pipeline and the four slide types — not the final talk. Copy that is not marked example comes
// from the design handoff (design/handoff/README.md).
//
// Accuracy: scene numbers are simulated/illustrative; see AGENTS.md before writing real claims.

const TALK = 'Beyond “It Runs”';
const CH = (n: number) => `${String(n).padStart(2, '0')} / 05`;

export const slides: Slide[] = [
  {
    id: 'title',
    type: 'title',
    header: ['Engineering Local LLM Inference', 'AISE · November 2026'],
    headline: 'Beyond\n“It Runs”',
    chapters: [
      ['01', 'Choose a model'],
      ['02', 'Make it fit'],
      ['03', 'Make it fast'],
      ['04', 'Serve it'],
      ['05', 'Connect it'],
    ],
  },
  {
    id: 'premise',
    type: 'list',
    example: true,
    header: [TALK, 'Premise'],
    title: 'You ran a model. Now what?',
    items: [
      'Pick a model that fits your hardware and your task',
      'Make weights, KV cache and workspace share memory',
      'Make decode fast: bandwidth, batching, speculation',
      'Serve many requests, then connect independent hosts',
    ],
  },
  {
    id: 'choose',
    type: 'section',
    header: [TALK, CH(1)],
    number: '01',
    title: 'Choose a model',
    framing: 'Dense or mixture-of-experts, total versus active parameters, and what each costs in memory.',
    example: true,
  },
  {
    id: 'moe',
    type: 'scene',
    scene: 'moe',
    chip: '01 — Choose a model',
    caption: {
      title: 'Experts on call',
      body: 'Each token runs through a few experts per layer. Every expert stays loaded, because the next token may pick different ones.',
    },
    controls: [
      { kind: 'choice', action: 'k', label: 'top-k', options: [1, 2, 3, 4].map(v => ({ label: String(v), value: v })), initial: 2 },
      { kind: 'toggle', action: 'usage', label: 'usage heat', initial: false },
    ],
    notes: 'Routing in this scene is random (simulated). Real routers are learned, per layer.',
  },
  {
    id: 'fit',
    type: 'section',
    header: [TALK, CH(2)],
    number: '02',
    title: 'Make it fit',
    framing: 'Weights, KV cache and runtime workspace all compete for the same memory.',
  },
  {
    id: 'cmd-kv',
    type: 'command',
    example: true,
    header: ['02 — Make it fit', 'vLLM'],
    lines: [
      'vllm serve $MODEL \\',
      '  --max-model-len … \\',
      '  --kv-cache-dtype fp8 \\',
      '  --gpu-memory-utilization … \\',
      '  --max-num-seqs …',
    ],
    active: 2,
    title: 'KV cache precision',
    body: 'Set separately from weight precision. Each selected flag opens its 3D scene, then returns here.',
  },
  {
    id: 'offload',
    type: 'scene',
    scene: 'offload',
    example: true,
    chip: '02 — Make it fit',
    caption: {
      title: 'Split the layers',
      body: '-ngl decides how many layers live in VRAM. The rest run from system RAM, and activations cross the bus once per token.',
    },
    controls: [
      { kind: 'choice', action: 'ngl', label: '-ngl', options: [0, 4, 8, 9, 12].map(v => ({ label: String(v), value: v })), initial: 4 },
    ],
    notes: 'Timing ratios and the 9-layer VRAM cap are illustrative.',
  },
  {
    id: 'fast',
    type: 'section',
    header: [TALK, CH(3)],
    number: '03',
    title: 'Make it fast',
    framing: 'Decode is a memory stream. Speed comes from moving fewer bytes per useful token.',
    example: true,
  },
  {
    id: 'flow',
    type: 'scene',
    scene: 'flow',
    example: true,
    chip: '03 — Make it fast',
    caption: {
      title: 'Decode streams the weights',
      body: 'Every decode step reads all active weights. Smaller weights or wider pipes help; a batch reuses one stream.',
    },
    controls: [
      { kind: 'choice', action: 'bw', label: 'memory', options: ['RAM', 'Unified', 'VRAM'].map(v => ({ label: v, value: v })), initial: 'Unified' },
      { kind: 'choice', action: 'wt', label: 'weights', options: ['FP16', 'Q8', 'Q4'].map(v => ({ label: v, value: v })), initial: 'FP16' },
      { kind: 'choice', action: 'B', label: 'batch', options: [1, 4, 8].map(v => ({ label: String(v), value: v })), initial: 1 },
    ],
    notes: 'Bandwidth-bound intuition only; ignores compute limits and KV reads.',
  },
  {
    id: 'spec',
    type: 'scene',
    scene: 'spec',
    example: true,
    chip: '03 — Make it fast',
    caption: {
      title: 'Draft, then verify',
      body: 'A small draft proposes K tokens. One target pass keeps the accepted prefix and adds one token of its own.',
    },
    controls: [
      { kind: 'choice', action: 'K', label: 'K', options: [3, 5, 7].map(v => ({ label: String(v), value: v })), initial: 5 },
      { kind: 'choice', action: 'p', label: 'accept', options: [0.5, 0.7, 0.9].map(v => ({ label: String(v), value: v })), initial: 0.7 },
    ],
    notes: 'Fixed per-token acceptance rate; not exact speculative sampling.',
  },
  {
    id: 'sample',
    type: 'scene',
    scene: 'sample',
    example: true,
    chip: '03 — Make it fast',
    caption: {
      title: 'Temperature reshapes the terrain',
      body: 'Low temperature sharpens the peaks. Top-p floods everything below the cut-off.',
    },
    controls: [
      { kind: 'choice', action: 'T', label: 'temp', options: [0.3, 0.7, 1.0, 1.5].map(v => ({ label: String(v), value: v })), initial: 0.7 },
      { kind: 'choice', action: 'topP', label: 'top-p', options: [0.5, 0.9, 1].map(v => ({ label: String(v), value: v })), initial: 0.9 },
    ],
  },
  {
    id: 'attn',
    type: 'scene',
    scene: 'attn',
    example: true,
    chip: '02 — Make it fit',
    caption: {
      title: 'Not every layer looks back forever',
      body: 'Sliding-window layers keep a fixed window of KV. Hybrid models mix them with full-attention layers.',
    },
    controls: [
      { kind: 'choice', action: 'mode', label: 'layers', options: ['full', 'sliding', 'hybrid'].map(v => ({ label: v, value: v })), initial: 'hybrid' },
      { kind: 'choice', action: 'W', label: 'window', options: [4, 8, 16].map(v => ({ label: String(v), value: v })), initial: 8 },
    ],
    notes: 'Attention weights are synthetic.',
  },
  {
    id: 'serve',
    type: 'section',
    header: [TALK, CH(4)],
    number: '04',
    title: 'Serve it',
    framing: 'Concurrency, scheduling and resource budgets in vLLM, llama.cpp and Ollama.',
    example: true,
  },
  {
    id: 'connect',
    type: 'section',
    header: [TALK, CH(5)],
    number: '05',
    title: 'Connect it',
    framing: 'A gateway in front of models hosted on independent machines.',
    example: true,
  },
  {
    id: 'splat-lab',
    type: 'section',
    header: [TALK, 'Appendix'],
    number: 'GS',
    title: 'Splat lab',
    framing: 'Experiments: the same pixel pipeline fed by Gaussian splats made in different ways. Each slide names its method.',
    example: true,
  },
  ...splatLab,
];
