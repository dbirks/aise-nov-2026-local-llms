import type { Slide } from '../../deck/types';
import { chip } from './_ch';
import { meta } from '../route/_meta';

export const slides: Slide[] = [{
  id:'setup-hardware-c', variant:'C', type:'scene', scene:'mem-fill', chip:chip(3),
  caption:{ title:'Will it fit, and how fast can it be read?', body:"Pour the same model into each machine's memory. What fits is set by capacity; how fast every weight can be read is set by bandwidth." },
  controls:[{kind:'choice',action:'model',label:'model size',options:[{label:'20 GB',value:20},{label:'60 GB',value:60},{label:'110 GB',value:110}],initial:20}],
  notes:meta({id:'setup-hardware-c',claim:'Capacity determines fit; size divided by rated bandwidth is an ideal read-time lower bound.',evidence:['MANUFACTURER SPEC','MECHANISM'],simulated:'Model sizes are illustrative; fit excludes other runtime memory.',not:'Read-time ratios are not model speed ratios; these are not speaker measurements and do not establish equal prices.',sources:['https://www.nvidia.com/en-us/geforce/graphics-cards/50-series/rtx-5090/','https://docs.nvidia.com/dgx/dgx-spark/hardware.html']}),
}];
