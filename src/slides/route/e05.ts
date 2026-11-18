import type { Slide } from '../../deck/types';
import { chip } from './_chapters';
import { meta } from './_meta';

export const slide: Slide = {
  id: 'e05', type: 'scene', scene: 'drafter-train', chip: chip(4),
  caption: { title: 'Training my own drafter', body: 'I tried training a DSpark draft model: record the big model’s answers and hidden states, train a small model to predict them, then serve it. Training scores looked fine; served acceptance barely moved.' },
  controls: [
    { kind: 'choice', action: 'mode', label: 'evaluated', options: [{ label: 'teacher-forced', value: 'teacher' }, { label: 'free-running', value: 'free' }], initial: 'teacher' },
    { kind: 'choice', action: 'stage', label: 'show', options: [{ label: 'pipeline', value: 'pipeline' }, { label: 'results', value: 'results' }], initial: 'pipeline' },
  ],
  notes: meta({ id: 'E05', claim: 'A useful drafter needs data provenance, compatible hidden states, correct training and valid serving evaluation.', evidence: ['MEASURED ON SPEAKER SYSTEM', 'SYNTHETIC DEMO'], simulated: 'Six draft slots and their conditioning links; correctness pattern is illustrative, not a measured acceptance rate.', not: 'More agentic data alone fixes acceptance; warm start always beats data quality; AutoRound trained the drafter; a speedup number. The conversion attempt was abandoned for this checkpoint.', open: 'Which checkpoint/result does the speaker want on stage (handoff §7)?', sources: [50, 51, 59, 60, 69, 72, 80].map(n => `https://github.com/dbirks/home-k8s/issues/${n}`).concat('https://docs.vllm.ai/projects/speculators/en/latest/user_guide/tutorials/train/') }),
};
