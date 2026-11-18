import type { Slide } from '../../deck/types';
import { chip } from './_ch';
import { meta } from '../route/_meta';
export const slides: Slide[] = [{
 id:'mtp-b', variant:'B', type:'scene', scene:'mtp-modules', chip:chip(7),
 caption:{title:'MTP: extra layers trained with the model',body:'The main model predicts the next token, and a small extra block reuses its hidden state to guess the one after. Serving engines can run that block a few times to draft several tokens.'},
 controls:[{kind:'choice',action:'steps',label:'draft steps',options:[{label:'1',value:1},{label:'2',value:2},{label:'3',value:3}],initial:1}],
 notes:meta({id:'mtp',claim:'A native MTP module can be reused sequentially to draft tokens.',evidence:['MECHANISM','OPEN / VERSION-DEPENDENT'],simulated:'Six trunk slabs and one to three draft steps are illustrative.',not:'Independent parallel heads, zero extra weights, or unverified tokens as final output.',open:'Exact engine behavior depends on version and model.',sources:['https://arxiv.org/abs/2412.19437','https://github.com/vllm-project/vllm/blob/main/vllm/v1/worker/gpu/spec_decode/mtp/speculator.py']})
}];
