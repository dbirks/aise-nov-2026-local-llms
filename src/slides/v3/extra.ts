import type { Slide } from '../../deck/types';

// Slides new in v3 (draft wording from docs/wording-review-handoff-2026-11-18.md). Headers are set by the deck.
const list = (id: string, title: string, items: string[], notes: string): Slide =>
  ({ id, type: 'list', header: ['', ''], title, items, notes }) as Slide;

export const EXTRA: Record<string, Slide> = {
  // no title on purpose: the divider just asked the question
  'why-summary': list(
    'why-summary',
    '',
    [
      'Pricing: no per-token bill or shifting limits.',
      'Stability: an older model you depend on won’t be taken away.',
      'Fewer surprises: the quantization won’t change under the hood without you knowing',
    ],
    'evidence: SPEAKER OPINION. Overview of chapter 01; the slides after it take each point in turn.',
  ),
  params: list(
    'params',
    'A parameter is one learned number',
    [
      'Qwen3.8-27B has about 27 billion of them, spread across its weight matrices and other learned tensors.',
      'Each token’s hidden state is 5,120 numbers wide. That’s the model’s width, not its parameter count.',
    ],
    'evidence: MECHANISM + model config. 27,781,427,952 logical params per huggingface.co/derikn/Qwen3.8-27B-AWQ-INT4; hidden_size 5120 per Qwen3.8-27B config. Hyperparameters (learning rate, depth…) are the recipe, not the weights: say it out loud if needed.',
  ),
  'param-count': list(
    'param-count',
    'Why a 4-bit 27B model can show up as 15B',
    [
      'Hugging Face counts stored tensor elements, and packed formats put several 4-bit weights in one element.',
      'Eight INT4 weights fit in one INT32, and two NVFP4 weights in one byte. The model still has 27B parameters.',
    ],
    'evidence: MODEL CARDS. huggingface.co/derikn/Qwen3.8-27B-AWQ-INT4 (8×INT4 per INT32), huggingface.co/Percivio/Qwen3.8-27B-NVFP4-all (2 per U8, shows ~15B). Exact displayed count depends on which tensors stay unpacked. Visual idea: logical weights vs storage elements vs bytes counters.',
  ),
  'autoround-tool': list(
    'autoround-tool',
    'If you want to quantize weights yourself: I used AutoRound',
    [
      'It tunes how each weight rounds instead of just rounding to the nearest level.',
      'That’s a separate step from training a drafter.',
    ],
    'evidence: SPEAKER EXPERIENCE (home-k8s #84, #110). Some AutoRound exports match the LLM Compressor format (#109). Never say speculators does quantization.',
  ),
  'speculators-tool': list(
    'speculators-tool',
    'If you want to train a drafter: I used vLLM’s speculators library',
    [
      'Pull hidden states from the target model, train the drafter, convert it, then measure acceptance.',
      'My target model was an NVFP4 checkpoint, but quantizing it was a separate step.',
    ],
    'evidence: SPEAKER EXPERIENCE (home-k8s #59, #60, #72, #80; vllm-project/speculators, patched fork). Target unsloth/Qwen3.6-27B-NVFP4.',
  ),
};
