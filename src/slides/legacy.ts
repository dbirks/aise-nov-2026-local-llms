import type { Slide } from '../deck/types';
import { maybe } from './talk';

// Legacy deck, in order. Everything marked `example: true` is placeholder content to exercise the
// pipeline and the four slide types — not the final talk. Copy that is not marked example comes
// from the design handoff (design/handoff/README.md).
//
// Accuracy: scene numbers are simulated/illustrative; see AGENTS.md before writing real claims.

const TALK = 'Beyond “It Runs”';
const CH = (n: number) => `${String(n).padStart(2, '0')} / 05`;

// The first-draft talk (2026-11-16), now the appendix after the handoff route. Ids unchanged except the title.
export const legacy: Slide[] = [
  {
    id: 'old-title',
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
      body: 'Each token runs k of E experts per layer. The rest are idle but still occupy memory — unless you park them in RAM and pay the bandwidth.',
    },
    controls: [
      { kind: 'choice', action: 'k', label: 'top-k', options: [1, 2, 3, 4].map(v => ({ label: String(v), value: v })), initial: 2 },
      { kind: 'choice', action: 'residency', label: 'experts', options: [{ label: 'resident', value: 'resident' }, { label: 'in RAM', value: 'ram' }], initial: 'resident' },
      { kind: 'toggle', action: 'usage', label: 'usage heat', initial: false },
    ],
    notes: 'Routing is random (simulated); real routers are learned, per layer. Scale illustrative 4×8 — Qwen3-30B-A3B card: 48 layers × 128 experts, 8 active (verify). “Experts in RAM” mirrors llama.cpp --cpu-moe / --n-cpu-moe (PR #15077): active ≠ resident.',
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
  ...maybe('kvcache'),
  ...maybe('kvledger'),
  {
    id: 'offload',
    type: 'scene',
    scene: 'offload',
    example: true,
    chip: '02 — Make it fit',
    caption: {
      title: 'Split the layers',
      body: '-ngl is a bet on bandwidth: every token streams the offloaded layers’ weights out of system RAM. Activations crossing the bus are the small part.',
    },
    controls: [
      { kind: 'choice', action: 'ngl', label: '-ngl', options: [0, 4, 8, 9, 12].map(v => ({ label: String(v), value: v })), initial: 4 },
    ],
    notes: 'Layer count, slab sizes and timing ratios are illustrative. The 9-layer wireframe stands in for a GiB budget — real layer bytes differ and KV cache + workspace also live in VRAM. -ngl is llama.cpp syntax.',
  },
  {
    id: 'fast',
    type: 'section',
    header: [TALK, CH(3)],
    number: '03',
    title: 'Make it fast',
    framing: 'Prefill computes a prompt; decode streams a memory. Each has its own bottleneck.',
    example: true,
  },
  ...maybe('prefill'),
  {
    id: 'flow',
    type: 'scene',
    scene: 'flow',
    example: true,
    chip: '03 — Make it fast',
    caption: {
      title: 'Weights once, KV per sequence',
      body: 'A decode step streams all active weights once — but KV for every sequence. Batch B multiplies total tok/s, not yours.',
    },
    controls: [
      { kind: 'choice', action: 'bw', label: 'memory', options: ['RAM', 'Unified', 'VRAM'].map(v => ({ label: v, value: v })), initial: 'Unified' },
      { kind: 'choice', action: 'wt', label: 'weights', options: ['FP16', 'Q8', 'Q4'].map(v => ({ label: v, value: v })), initial: 'FP16' },
      { kind: 'choice', action: 'B', label: 'batch', options: [1, 4, 8].map(v => ({ label: String(v), value: v })), initial: 1 },
    ],
    notes: 'Illustrative byte model: bytes/step ≈ W + B·KV(t), tokens/s ∝ bandwidth / (weights + kv). “All active weights” is dense-only; MoE reads selected experts. Pope et al. arXiv:2211.05102.',
  },
  {
    id: 'spec',
    type: 'scene',
    scene: 'spec',
    example: true,
    chip: '03 — Make it fast',
    caption: {
      title: 'Draft, then verify',
      body: 'A draft proposes K tokens. One target pass keeps the accepted prefix, corrects the first rejection and adds one token — verified by min(1, p/q), not top-token equality.',
    },
    controls: [
      { kind: 'choice', action: 'K', label: 'K', options: [3, 5, 7].map(v => ({ label: String(v), value: v })), initial: 5 },
      { kind: 'choice', action: 'p', label: 'accept', options: [0.5, 0.7, 0.9].map(v => ({ label: String(v), value: v })), initial: 0.7 },
      { kind: 'choice', action: 'mode', label: 'verify', options: [{ label: 'greedy', value: 'greedy' }, { label: 'sampling', value: 'sampling' }], initial: 'greedy' },
    ],
    notes: 'Sampling mode: synthetic seeded p/q; accept with probability min(1, p/q) (Leviathan et al., ICML 2023). Rejection invalidates later draft tokens. Block (DFlash) and tree drafters are different machinery.',
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
  ...maybe('scheduler'),
  {
    id: 'sample',
    type: 'scene',
    scene: 'sample',
    example: true,
    chip: '04 — Serve it',
    caption: {
      title: 'Two dials on one distribution',
      body: 'Temperature reshapes the peaks; top-p caps the mass you sample from — a cutoff drawn as a water level. Positions are an arbitrary map, not an embedding space.',
    },
    controls: [
      { kind: 'choice', action: 'T', label: 'temp', options: [{ label: '→0', value: 0.01 }, { label: '0.3', value: 0.3 }, { label: '0.7', value: 0.7 }, { label: '1.0', value: 1 }, { label: '1.5', value: 1.5 }], initial: 0.7 },
      { kind: 'choice', action: 'topP', label: 'top-p', options: [0.5, 0.9, 1].map(v => ({ label: String(v), value: v })), initial: 0.9 },
      { kind: 'toggle', action: 'sample', label: 'sample now', initial: false },
    ],
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
  // Retired from the route by the viz audit (attention weights ≠ KV memory); replaced by `kvledger`.
  // Kept reachable at the end of the appendix as #/attn.
  {
    id: 'attn',
    type: 'scene',
    scene: 'attn',
    example: true,
    chip: 'Retired — attention arcs',
    caption: {
      title: 'Attention arcs (retired)',
      body: 'Kept for reference: draws synthetic attention weights, not KV memory. The KV ledger scene replaces it in chapter 02.',
    },
    controls: [
      { kind: 'choice', action: 'mode', label: 'layers', options: ['full', 'sliding', 'hybrid'].map(v => ({ label: v, value: v })), initial: 'hybrid' },
      { kind: 'choice', action: 'W', label: 'window', options: [4, 8, 16].map(v => ({ label: String(v), value: v })), initial: 8 },
    ],
  },
];
