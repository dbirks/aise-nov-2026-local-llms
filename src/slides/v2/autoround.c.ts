import type { Slide } from '../../deck/types';
import { chip } from './_ch';
import { meta } from '../route/_meta';

export const slides: Slide[] = [{
  id: 'autoround-c', variant: 'C', type: 'scene', scene: 'autoround-layers', chip: chip(4),
  caption: { title: 'Not every layer gets 4 bits', body: 'In my Qwen3.8-27B quant, the big linear layers went to 4 bits. A few small, touchy ones stayed at 16, like the output head and the vision tower.' },
  controls: [{ kind: 'choice', action: 'recipe', label: 'recipe', options: [{ label: 'all 4-bit', value: 'all' }, { label: 'my recipe', value: 'mine' }], initial: 'mine' }],
  notes: meta({ id: 'autoround-c', claim: 'In the speaker’s Qwen3.8-27B AutoRound checkpoints the large linear projections are 4-bit while the delta-net gates, output head, vision tower and MTP head stay at 16 bits.', evidence: ['MECHANISM', 'SYNTHETIC DEMO', 'SPEAKER OBSERVATION'], simulated: 'Layer footprints are toy relative sizes; the bar is bits × toy size, not a file size. No quality or drift number is shown.', not: 'AutoRound retrains the model; the BF16-kept layers are an unfinished job; the toy percentages are measured sizes; a quality gain from the exceptions is shown or measured.', open: 'Why each exception was chosen (which test), and the exact AutoRound iters/nsamples used.', sources: ['https://huggingface.co/dbirks/Qwen3.8-27B-NVFP4-AutoRound', 'https://huggingface.co/dbirks/Qwen3.8-27B-W4A16-AutoRound', 'https://github.com/intel/auto-round', 'https://arxiv.org/abs/2309.05516'] }),
}];
