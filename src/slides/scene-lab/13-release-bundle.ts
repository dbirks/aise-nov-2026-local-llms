import type { Slide } from '../../deck/types';

const BODY = 'Target weights, tokenizer/chat template, maybe native MTP heads, and a matched drafter: '
  + 'separate downloads, one verifier, all of it costing memory and compute.';

export const slides: Slide[] = [{
  id: 'lab-release-bundle',
  type: 'scene',
  scene: 'release-bundle',
  example: true,
  chip: 'LAB — Release bundle',
  caption: {
    title: 'A release is now a bundle',
    body: BODY,
  },
  controls: [
    {
      kind: 'choice', action: 'release', label: 'release', initial: 'muse',
      options: [
        { label: 'Muse Glimmer 30B', value: 'muse' },
        { label: 'Laguna S 2.1', value: 'laguna-s' },
        { label: 'Laguna XS 2.1', value: 'laguna-xs' },
      ],
    },
    { kind: 'toggle', action: 'companion', label: 'companion drafter', initial: true },
    { kind: 'toggle', action: 'mtp', label: 'native MTP heads', initial: false },
  ],
  notes: 'Brief: README companion drafters. WHAT IS REAL: the three releases are the upstream examples in the '
    + 'research notes — meta-models/Muse-Glimmer-30B with the official Muse-Glimmer-30B-assistant DFlash companion '
    + '(official GGUF release also has quantized drafts; the assistant’s parameter/layer/block sizes are not in our notes), '
    + 'poolside/Laguna-S-2.1 with Laguna-S-2.1-DFlash (6 sliding-attention layers, 16-position draft blocks), '
    + 'poolside/Laguna-XS-2.1 with Laguna-XS-2.1-DFlash (5-layer drafter, up to 15 proposals per block). '
    + 'The drafter is a separately downloaded, specifically trained checkpoint — drawn with a visible gap to the target slab, '
    + 'not embedded in it — and it still costs load time, memory and compute. Runtime support varies by version: the XS drafter '
    + 'card warned that some upstream serving integrations had not landed at publication, hence "check runtime"; verify against '
    + 'installed vLLM / llama.cpp versions before any live command. '
    + 'DO NOT IMPLY: that third-party drafting is impossible, that every model ships a drafter (the toggle shows a target-only '
    + 'bundle), or that DFlash and native MTP heads are the same mechanism — the MTP chips are drawn as heads wired into the side of '
    + 'the target slab, the companion is a separate tower across a gap. None of these three releases documents native MTP heads, so '
    + 'that slot is a light outline with a "no mtp" chip by default and the readout marks the toggle as illustrative. '
    + 'ILLUSTRATIVE / SIMULATED: the crate, the plate counts (4 target plates are not the real layer count), artifact sizes and '
    + 'positions, the Muse drafter’s 4 plates / 8 draft slots, the packet flow and the 5 verified output ticks; the light label chips '
    + '("target weights", "tokenizer", "dflash", "verifier", "tokens") are role names, not file names. No measured '
    + 'download sizes, load times, accept rates or speedups are shown, and none should be inferred.',
}];
