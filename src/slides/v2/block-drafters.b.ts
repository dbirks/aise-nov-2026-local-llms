import type { Slide } from '../../deck/types';
import { chip } from './_ch';
import { meta } from '../route/_meta';
export const slides: Slide[] = [{
 id:'block-drafters-b',variant:'B',type:'scene',scene:'block-deps',chip:chip(7),
 caption:{title:'Who waits for whom',body:'An autoregressive drafter writes one guess after another. DFlash fills a whole block in one pass, and DSpark adds a light sequential head on top.'},
 controls:[{kind:'choice',action:'lane',label:'focus',options:[{label:'EAGLE-3',value:'EAGLE-3'},{label:'DFlash',value:'DFlash'},{label:'DSpark',value:'DSpark'},{label:'DFlash2',value:'DFlash2'},{label:'all',value:'all'}],initial:'all'}],
 notes:meta({id:'block-drafters',claim:'Draft architectures differ in their sequential and parallel dependencies.',evidence:['MECHANISM','OPEN / VERSION-DEPENDENT'],simulated:'Six slots illustrate dependency and pass counts.',not:'These methods are identical, skip target verification, or DFlash2 has a published paper.',open:'DFlash2 selector training is experimental and version-dependent.',sources:['https://arxiv.org/abs/2503.01840','https://arxiv.org/abs/2602.06036','https://arxiv.org/abs/2607.05147','https://inco.ai/blog/dflash2/']})
}];
