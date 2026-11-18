import type { Slide } from '../../deck/types';
import { chip } from './_ch';
import { meta } from '../route/_meta';

export const slides: Slide[] = [{
  id: 'spec-decode-b', variant: 'B', type: 'scene', scene: 'spec-tree', chip: chip(7),
  caption: { title: 'Check a tree of guesses at once', body: 'Instead of one line of guesses, the drafter can propose a small tree. Each guess may only look at its own ancestors, so the big model checks every branch in one pass.' },
  controls: [
    { kind: 'choice', action: 'draft', label: 'draft', options: [{label:'line',value:'line'},{label:'tree',value:'tree'}], initial:'tree' },
    { kind: 'choice', action: 'accept', label: 'accepted path', options: [{label:'top',value:'top'},{label:'bottom',value:'bottom'}], initial:'top' },
  ],
  notes: meta({ id:'spec-decode-b', claim:'Tree verification uses an ancestor-only attention mask.', evidence:['MECHANISM','SYNTHETIC DEMO'], simulated:'Toy words, tree and accepted path.', not:'Equality alone verifies stochastic samples; rejected descendants survive; speedup is guaranteed or output distribution changes.', sources:['https://arxiv.org/abs/2211.17192','https://arxiv.org/abs/2302.01318','https://arxiv.org/abs/2406.16858','https://arxiv.org/abs/2503.01840'] }),
}];
