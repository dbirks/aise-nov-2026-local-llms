# Copy fixes for src/slides.ts — 2026-11 scene audit pass

Apply these replacements to `src/slides.ts` (the orchestrator owns that file; this file only
carries the new copy). Snippets are the exact object properties to swap into each slide record.
Scenes behind these slides were updated in the same pass (`src/scenes/pixel-viz.js`,
`src/layouts/SceneLayout.tsx`), so the new actions below are already supported.

Sources: `docs/research/viz-audit.md` (§moe, §offload, §fast, §flow, §spec, §sample, Priority
list items 4, 6, 8); llama.cpp `--cpu-moe`/`--n-cpu-moe` PR ggml-org/llama.cpp#15077;
Pope et al. arXiv:2211.05102; Leviathan et al. ICML 2023 (speculative decoding).

---

## moe

Caption no longer claims experts can never leave VRAM (llama.cpp `--cpu-moe` deliberately
parks experts in system RAM). New `residency` control drives the scene's bus-hop mode; the
readout now shows the k/E active-weights fraction, so keep the chip in chapter 01.

```ts
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
notes: 'Routing is random (simulated); real routers are learned, per layer. Scale illustrative 4×8 — Qwen3-30B-A3B card: 48 layers × 128 experts, 8 active (verify against the model card on stage). “Experts in RAM” mirrors llama.cpp --cpu-moe / --n-cpu-moe (PR #15077): active ≠ resident. Equal-size expert boxes assume a balanced-MoE design (unverified).',
```

## offload

The cost of offload is weight streaming from RAM, not the activation hop over the bus; the
scene readout dropped the invented “over VRAM” cap language, so the caption should say what
-ngl really bets on.

```ts
chip: '02 — Make it fit',
caption: {
  title: 'Split the layers',
  body: '-ngl is a bet on bandwidth: every token streams the offloaded layers’ weights out of system RAM. Activations crossing the bus are the small part.',
},
controls: [
  { kind: 'choice', action: 'ngl', label: '-ngl', options: [0, 4, 8, 9, 12].map(v => ({ label: String(v), value: v })), initial: 4 },
],
notes: 'Layer count, slab sizes and timing ratios are illustrative. The 9-layer wireframe stands in for a GiB budget — real layer bytes differ (attention vs FFN, first/last) and KV cache + workspace also live in VRAM. -ngl is llama.cpp syntax; pair with the vLLM flags slide.',
```

## fast (section slide — copy only, from audit §fast)

Decode-only framing silently skips prefill, which must stay a separate axis.

```ts
framing: 'Prefill computes a prompt; decode streams a memory. Each has its own bottleneck.',
```

## flow

The scene now adds a second, thinner KV particle stream from a basin that grows each step and
resets with the loop, and the readout splits per-user vs total throughput: tokens/s ∝
bw / (weights + kv), with batch B multiplying total only. Keep the chip at chapter 03.

```ts
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
notes: 'Illustrative byte model, no measured benchmark: bytes/step ≈ W + B·KV(t), so tokens/s ∝ bandwidth / (weights + kv); the KV basin grows each step and resets with the loop. Card-number arithmetic (Qwen3-30B-A3B: 48 layers, 4 KV heads, head_dim 128 — unverified) gives ≈3.1 GB KV read per 32K sequence at f16, i.e. KV overtakes Q4 weights at B≈8 (Pope et al. arXiv:2211.05102). “all active weights” is dense-only; MoE reads selected experts (see moe). Bandwidth tiers RAM<Unified<VRAM are hardware-specific.',
```

## spec

The scene gained a `mode` action: 'sampling' draws the distribution-preserving accept test —
per draft token a bar of height min(1, p/q) and a dark marker for the uniform draw (reject when
the marker sits above the bar). Synthetic seeded p/q; geometry, reject-tail and +1-token logic
unchanged. Readout is structural (accepted/round, target passes), never tokens/s.

```ts
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
notes: 'Sampling mode: per-token p/q are synthetic (seeded); accept with probability min(1, p/q), reject when the uniform draw lands above the bar — distribution-preserving verification, not equality testing (Leviathan et al., ICML 2023). Rejection invalidates all later draft tokens (linear ancestry). This drafter is sequential AR; block (DFlash-style) and tree drafters are different machinery — do not present them as equivalent.',
```

## sample

The scene already supports `action('sample')` and the readout shows the picked word; expose a
fire button and the greedy limit. Audit verdict: temperature/top-p is **not** a “Make it fast”
mechanism — it is a serving-config dial, so propose re-chipping to `04 — Serve it` **and**
moving the slide after the `serve` section header in `src/slides.ts`. If the slide stays in
chapter 03, fall back to `{ /* chip: '03 — Make it fast' — openly framed as “the dial we set
before measuring speed” */ }` rather than the old mismatched chip.

```ts
chip: '04 — Serve it',
caption: {
  title: 'Two dials on one distribution',
  body: 'Temperature reshapes the peaks; top-p caps the mass you sample from — a cutoff drawn as a water level. Positions are an arbitrary map, not an embedding space.',
},
controls: [
  { kind: 'choice', action: 'T', label: 'temp', options: [{ label: '→0 (greedy)', value: 0.01 }, { label: '0.3', value: 0.3 }, { label: '0.7', value: 0.7 }, { label: '1.0', value: 1 }, { label: '1.5', value: 1.5 }], initial: 0.7 },
  { kind: 'choice', action: 'topP', label: 'top-p', options: [0.5, 0.9, 1].map(v => ({ label: String(v), value: v })), initial: 0.9 },
  { kind: 'toggle', action: 'sample', label: 'sample now', initial: false },
],
notes: 'Token positions are an arbitrary map, not an embedding space (kept in the body per the embedding-projection constraint). top-p is the smallest sorted prefix with cumulative mass ≥ p, drawn as a level — ties/plateaus can look off. The “sample now” toggle is a fire button: every click runs one sample; its on/off label carries no meaning (the SceneLayout control contract has no plain button kind).',
```
