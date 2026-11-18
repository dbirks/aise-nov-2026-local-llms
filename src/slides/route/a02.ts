import type { Slide } from '../../deck/types';
import { chip } from './_chapters';
import { meta } from './_meta';

// A02 — training writes the weights, inference only reads them (handoff §3 A02).
export const slide: Slide = {
  id: 'a02',
  type: 'scene',
  scene: 'weights-fixed',
  chip: chip(0),
  caption: {
    title: 'Training writes, inference reads',
    body: 'Training slowly adjusts billions of numbers, the weights, then saves them to a file. Running the model only reads those numbers: your prompts never change them.',
  },
  controls: [
    {
      kind: 'choice', action: 'mode', label: 'phase',
      options: [{ label: 'training', value: 'training' }, { label: 'inference', value: 'inference' }],
      initial: 'inference',
    },
    {
      kind: 'choice', action: 'artifact', label: 'saved as',
      options: [{ label: 'safetensors', value: 'safetensors' }, { label: 'GGUF', value: 'gguf' }],
      initial: 'safetensors',
    },
  ],
  notes: meta({
    id: 'A02',
    claim: 'a serving engine loads learned weights and reuses them; inference is not training',
    evidence: ['MECHANISM', 'SYNTHETIC DEMO'],
    simulated: '6×6 toy weight matrix (36 seeded values), 4 prompt tokens, 6 logits bars; heights and shades are illustrative, not a real checkpoint',
    not: 'training downloads web text per question; GGUF is an engine; prompts fine-tune the model',
    sources: [
      'https://github.com/ggml-org/llama.cpp/blob/master/docs/models.md',
      'https://github.com/ggml-org/ggml/blob/master/docs/gguf.md',
      'https://huggingface.co/docs/safetensors',
    ],
  }),
};
