import type { Slide } from '../../deck/types';
import { chip } from './_chapters';
import { meta } from './_meta';

export const slide: Slide = {
  id: 'f04',
  type: 'scene',
  scene: 'ngram-timeline',
  chip: chip(5),
  caption: {
    title: 'From paper to shipped models',
    body: 'A research idea, learned n-gram lookup memory, showed up in shipped models within months, implemented differently by each vendor. Same family of idea, not the same code.',
  },
  controls: [
    { kind: 'choice', action: 'focus', label: 'focus', options: [
      { label: 'paper', value: 'paper' }, { label: 'v4', value: 'v4' },
      { label: 'qwen', value: 'qwen' }, { label: 'v4.1', value: 'v41' },
    ], initial: 'paper' },
    { kind: 'toggle', action: 'scale', label: 'table sizes', initial: true },
  ],
  notes: meta({
    id: 'F04', claim: 'Learned n-gram lookup memory appears in distinct shipped architectures after the Engram paper',
    evidence: ['MECHANISM'],
    simulated: 'Schematic machines and equal-spaced chronology; table height is proportional to the square root of card-reported parameters.',
    not: 'DeepSeek V4 launched with Engram; Qwen cloned DeepSeek; first-ever claims',
    open: 'Model dates are repository creation dates, not independently verified announcement dates.',
    sources: [
      'https://arxiv.org/abs/2601.07372 (submitted January 2026)',
      'https://huggingface.co/deepseek-ai/DeepSeek-V4-Flash (created April 2026)',
      'https://huggingface.co/Qwen/Qwen3.8-Flash-Next (created August 2026; 51B n-gram parameters)',
      'https://huggingface.co/deepseek-ai/DeepSeek-V4.1-Flash (created September 2026; 196B Engram parameters)',
    ],
  }),
};
