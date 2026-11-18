import type { Slide } from '../../deck/types';
import { chip } from './_ch';
import { meta } from '../route/_meta';

export const slides: Slide[] = [{
  id: 'setup-hardware-b', variant: 'B', type: 'scene', scene: 'mem-quadrant', chip: chip(3),
  caption: { title: 'Room on one axis, speed on the other', body: 'The big unified-memory boxes hold four times as much. The 5090 reads its memory several times faster.' },
  controls: [{ kind: 'choice', action: 'focus', label: 'compare', options: [{label:'5090 vs Spark',value:'spark'},{label:'5090 vs M4 Max',value:'m4'},{label:'all',value:'all'}], initial:'spark' }],
  notes: meta({ id:'setup-hardware-b', claim:'Rated memory capacity and bandwidth are different constraints.', evidence:['MANUFACTURER SPEC','MECHANISM'], not:'Bandwidth ratio is not model speed ratio; these are not speaker measurements and do not establish equal prices.', sources:['https://www.nvidia.com/en-us/geforce/graphics-cards/50-series/rtx-5090/','https://docs.nvidia.com/dgx/dgx-spark/hardware.html','https://support.apple.com/en-us/121553','https://www.amd.com/en/products/processors/laptop/ryzen/ai-300-series/amd-ryzen-ai-max-plus-395.html'], open:'AMD bandwidth is derived from memory speed and bus width, not AMD-published.' }),
}];
