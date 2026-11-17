import type { Slide } from '../../deck/types';

const BODY = 'One model load fills three different memories: GPU VRAM, the Linux page cache, and the WSL2 '
  + 'VM as Windows counts it. Direct I/O keeps only the middle one small.';

export const slides: Slide[] = [{
  id: 'lab-wsl-memory',
  type: 'scene',
  scene: 'wsl-memory',
  example: true,
  chip: 'LAB — WSL memory',
  caption: {
    title: '3 memories that look like one',
    body: BODY,
  },
  controls: [
    {
      kind: 'choice', action: 'loader', label: 'loader',
      options: [{ label: 'buffered', value: 'buffered' }, { label: 'direct i/o', value: 'direct' }],
      initial: 'buffered',
    },
  ],
  notes: 'Brief: README "An especially good quick anecdote: memory and WSL". '
    + 'WHAT THE SCENE KEEPS RIGHT (the mechanism): the three quantities are drawn in three separate containers and are never interchangeable — '
    + '(a) GPU VRAM (right box): its own floor and ceiling, holding weights, runtime buffers and the growing KV cache; (b) the Linux page cache '
    + '(light cubes inside the VM box): file pages the buffered read left resident; (c) WSL2 VM memory as Windows counts it (the height of the '
    + 'middle box against the dark host-limit bar in the outer box = physical host RAM). Inside the VM box the layers STACK AND SUM, so the VM '
    + 'box top is literally process memory + page cache: that is why file-cache growth shows up as host-visible VM memory, and why a loader that '
    + 'bypasses the page cache (direct I/O on that read path) leaves the same weights, the same VRAM and a much shorter VM box. The last beat has '
    + 'the light grid drain away while VRAM is untouched: cached pages are reclaimable — the pressure is that they are not free until reclaimed, '
    + 'and this scene does NOT claim cached memory is unreclaimable. The byte stream through the cache vs the front-face bypass around it is the '
    + 'only difference between the two loader settings. '
    + 'ILLUSTRATIVE / SIMULATED: every height is an illustrative fraction of its own container, NOT a GiB reading, and the % readout counts those '
    + 'heights — it is not memory reported by hyper-v, WSL or any tool. The buffered/direct ratio is the mechanism; the split between weights, '
    + 'buffers and KV, the fixed "windows + apps" strip, the number of cache cells, the load-path routing and all timings are schematic. The '
    + 'host-side→VRAM hop is shown as a copy across a gap, not a modelled PCIe transfer. '
    + 'NOT CLAIMED: any real measurement, model, checkpoint format, loader, flag name or engine from the speaker\'s setup (README: record the '
    + 'precise loader, flag, format, OS/WSL settings and memory readings before recommending any command); that WSL terminated here — the speaker '
    + 'reports a sudden termination in this situation, and this scene only shows pressure rising toward the limit, no simulated crash; that direct '
    + 'I/O disables all caching (it applies to the load path shown, and other paths can still cache); that page cache makes loading slower or '
    + 'faster — nothing about speed is shown.',
}];
