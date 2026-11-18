// Deck v3 wording, keyed by slide id. Anything not listed here keeps its v2 text (src/slides/v2/).
// Source: docs/wording-review-handoff-2026-11-18.md. Title is approved; everything else is a draft
// for the speaker to edit. Scene slides patch `caption`; list slides patch `title` / `items`.

export interface Patch {
  title?: string;
  items?: string[];
  caption?: { title: string; body: string };
  notes?: string;
}

export const COPY: Record<string, Patch> = {
  // 00 — Opening
  open: {
    title: 'A grab bag of local LLM terms, tips, and settings',
    items: [
      'A few definitions, settings I’ve found useful, and things I’ve picked up along the way.',
      'Roughly in the order I learned them, with examples from llama.cpp and vLLM.',
    ],
  },

  // 01 — Why run a local model?
  'why-objection': {
    title: 'Hosted models are really good',
    items: ['Subscriptions are a great deal right now.', 'They’re called frontier models for a reason.'],
  },
  'why-good-enough': {
    title: 'You don’t always need the biggest model',
    items: ['Plenty of work doesn’t need a frontier model.'],
  },
  'why-cost': {
    title: 'Pricing and limits can change',
    items: [
      'GitHub Copilot’s switch from per-request billing to token-based credits',
      'Heavily subsidized tokens are unlikely to last forever',
    ],
    notes: 'evidence: SPEAKER OPINION (line 2) + documented product change (line 1). Copilot moved to token-based GitHub AI Credits from 2026-06-01 (github.blog, 2026-04-27; docs.github.com copilot billing). Do not imply the client plan switched that day.',
  },
  'why-independence': {
    title: 'Know exactly what you’re running',
    items: [
      'With local models, you choose the weights, the level of quantization, and when they change.',
      'You also know for certain your data isn’t being used for training.',
    ],
  },
  'why-fun': {
    title: 'And it’s fun',
    items: ['It’s really fun being able to tinker and play with settings.'],
  },

  // 02 — Getting started
  'train-vs-infer-b': {
    caption: {
      title: 'Training produces the weights. Inference uses them.',
      body: 'Training repeatedly adjusts the model’s numbers. Once the model is trained and loaded for inference, those weights stay fixed while it produces responses.',
    },
  },
  engines: {
    title: 'The inference engine runs the model',
    items: [
      'Ollama, llama.cpp, vLLM, and SGLang are inference engines that load the weights, manage the context, and generate responses',
      'GGUF and safetensors are file formats for storing model tensors.',
    ],
  },
};

/** Slide ids cut from v3 (variants the speaker picked against, or slides dropped). */
export const DROP = new Set(['train-vs-infer-a', 'params', 'setup-egpu-b', 'setup-slow-link-b', 'setup-hardware-c']);
