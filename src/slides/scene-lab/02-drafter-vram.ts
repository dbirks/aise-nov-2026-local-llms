import type { Slide } from '../../deck/types';

// Brainstorm candidate for README "Scene I — Drafter VRAM budget and what you give up".
// Every height, block count and acceptance number in the scene is illustrative/simulated.
export const slides: Slide[] = [
  {
    id: 'lab-drafter-vram',
    type: 'scene',
    scene: 'drafter-vram',
    example: true,
    chip: 'LAB — Drafter VRAM',
    caption: {
      title: 'A drafter rents your KV space',
      body: 'Draft weights, state and workspaces come out of the same budget as KV blocks: fewer sequential target passes, less room for long prefixes and concurrent agents.',
    },
    controls: [
      {
        kind: 'choice', action: 'mode', label: 'drafter',
        options: [
          { label: 'target-only', value: 'target-only' },
          { label: 'MTP', value: 'mtp' },
          { label: 'EAGLE-3', value: 'eagle3' },
          { label: 'DFlash', value: 'dflash' },
        ],
        initial: 'target-only',
      },
      { kind: 'choice', action: 'accept', label: 'acceptance', options: [{ label: 'low', value: 'low' }, { label: 'high', value: 'high' }], initial: 'high' },
    ],
    notes: 'Brief: README "Scene I". Memory-for-computation trade of speculative decoding. ALL numbers are illustrative geometry / simulated: band heights, the 120 → 96 → 72 → 48 block counts, the draft-block widths and the scripted accepted lengths (per-candidate p = 0.45 low / 0.8 high, spread evenly) are not measured specs, model comparisons, speedups or throughput. MTP is drawn smallest because its heads are part of the target checkpoint; EAGLE-3 and DFlash-family drafters keep separate weights plus feature/state buffers, and those costs differ by method — do not imply every drafter reserves a full independent KV cache. The pass row shows fewer sequential target passes per 12 generated tokens, not tokens/sec, TTFT or ITL: extra drafter compute can reduce aggregate throughput at high batch even when acceptance rises. Fewer KV blocks is a real cost (less cached-prefix retention, fewer concurrent sequences), so the scene has no "better" state — pick per workload. Verify real drafter footprints/K values against engine configs before quoting numbers.',
  },
];
