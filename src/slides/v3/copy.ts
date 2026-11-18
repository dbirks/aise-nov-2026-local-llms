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
    items: ['The models are capable, and subscriptions can be a great deal.', 'I use them too.'],
  },
  'why-good-enough': {
    title: 'You don’t always need the biggest model',
    items: [
      'A useful model is one that reliably does the work you ask it to do.',
      'Even with hosted models, I’ve found I don’t always need the most expensive option.',
    ],
  },
  'why-cost': {
    title: 'Pricing and limits can change',
    items: [
      'GitHub Copilot’s switch from per-request billing to token-based credits made me think harder about long agent sessions.',
      'I still use hosted models, but I wanted another option if pricing or limits changed.',
    ],
    notes: 'evidence: SPEAKER OBSERVATION + documented product change. Copilot moved to token-based GitHub AI Credits from 2026-06-01 (github.blog, 2026-04-27; docs.github.com copilot billing). Do not imply the client plan switched that day.',
  },
  'why-independence': {
    title: 'Know exactly what you’re running',
    items: [
      'With a local model, I choose the weights, the quantization, and when to change them.',
      'For work that has to stay on my machine, I can keep inference local.',
    ],
  },
  'why-fun': {
    title: 'And it’s fun',
    items: [
      'There are a lot of settings to try, and I like seeing what each one changes.',
      'You might have completely different reasons, and that’s fine too.',
    ],
  },

  // 02 — Getting started
  'train-vs-infer-a': {
    caption: {
      title: 'Training produces the weights. Inference uses them.',
      body: 'During training, a model’s numbers are adjusted using lots of examples, including text and code. Inference uses those learned weights to process a prompt and predict the next token.',
    },
  },
  'train-vs-infer-b': {
    caption: {
      title: 'Training produces the weights. Inference uses them.',
      body: 'Training repeatedly adjusts the model’s numbers. Once the model is trained and loaded for inference, those weights stay fixed while it produces responses.',
    },
  },
  engines: {
    title: 'An inference engine runs the model',
    items: [
      'llama.cpp, vLLM, and SGLang are engines that load weights and compute responses. Ollama makes local models easier to download and run.',
      'GGUF and safetensors are file formats for storing model tensors. They’re not inference engines.',
    ],
  },
};
