import type { Slide } from '../../deck/types';
import { chip } from './_ch';
import { meta } from '../route/_meta';

export const slides: Slide[] = [{
  id:'spec-decode-c', variant:'C', type:'scene', scene:'spec-accept', chip:chip(7),
  caption:{ title:'Keep the guess with probability p over q', body:"If the big model likes the guess at least as much as the drafter did, keep it. Otherwise keep it with probability p/q, and on a miss resample from what's left over." },
  controls:[
    {kind:'choice', action:'word', label:'drafted word', options:[{label:'the',value:'the'},{label:'cat',value:'cat'},{label:'dog',value:'dog'}], initial:'the'},
    {kind:'toggle', action:'greedy', label:'greedy', initial:false},
  ],
  notes:meta({id:'spec-decode-c',claim:'Accept a draft with probability min(1,p/q); on rejection sample the normalized positive residual.',evidence:['MECHANISM','SYNTHETIC DEMO'],simulated:'Six-word distributions and selected draft.',not:'Stochastic verification is merely equality, rejected descendants survive, output distribution changes, or high-batch speedups are guaranteed.',sources:['https://arxiv.org/abs/2211.17192','https://arxiv.org/abs/2302.01318','https://arxiv.org/abs/2406.16858','https://arxiv.org/abs/2503.01840']}),
}];
