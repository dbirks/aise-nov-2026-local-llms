import type { Slide } from '../../deck/types';
import { chip } from './_ch';
import { meta } from '../route/_meta';

export const slides: Slide[] = [{
  id: 'my-drafter-b', variant: 'B', type: 'scene', scene: 'drafter-funnel', chip: chip(7),
  caption: { title: 'I trained my own drafter', body: 'I collected what the model actually says, trained a small drafter on its hidden states, then converted and served it. If you want to try it: vLLM’s speculators.' },
  controls: [
    { kind: 'choice', action: 'run', label: 'run', options: [{ label: '#72', value: 72 }, { label: '#80', value: 80 }], initial: 80 },
  ],
  notes: meta({ id: 'my-drafter-b', claim: 'The speaker trained a drafter on the target model’s own hidden states via the speculators pipeline (regenerate → hidden states → train → convert → serve in vLLM); run #72 was ~546k rows in 2 days 16 h, run #80 served at acceptance length 1.617 vs a ~1.66 baseline.', evidence: ['SPEAKER OBSERVATION', 'MEASURED ON SPEAKER SYSTEM'], simulated: 'The funnel is a schematic of the speculators pipeline; only the run-card figures are real, and they are specific to the speaker’s home-k8s hardware and corpus.', not: 'my drafter beat the baseline (1.617 < ~1.66); these numbers generalise', sources: ['https://github.com/vllm-project/speculators/blob/main/README.md', 'docs/presentation-production-handoff.md E05', 'src/scenes/builders/drafter-train.js L46–77', 'docs/research/v2/spec.md'] }),
}];
