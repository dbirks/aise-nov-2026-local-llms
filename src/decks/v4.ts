import type { Slide } from '../deck/types';

// Deck v4, started 2026-11-18: slimmed down, built slide by slide from the speaker's list.
// Each slide is a heading or one short phrase. No animation by default.
// Served at the root and at /4/. Archives: v3 /3/, v2 /2/, v1 /1/.
// List lines are phrases: no full stop at the end, Oxford comma.

/** A heading with optional phrase bullets (header and page number are filled in below). */
const page = (id: string, title: string, items: string[], subs?: Record<number, string[]>): Slide =>
  ({ id, type: 'list', header: ['', ''], title, items, ...(subs && { subs }) });

const TITLE: Slide = {
  id: 'title',
  type: 'title',
  header: ['', 'AISE · November 2026'],
  headline: 'Configuring\nLocal LLMs',
  headlineSize: 215,
  chapters: [],
};

/** Sections in order; the deck below is built from these. */
const SECTIONS: { title: string; slides: Slide[] }[] = [
  {
    title: 'Why run things locally?',
    slides: [
      {
        id: 'pricing',
        type: 'list',
        header: ['', ''],
        title: 'Pricing',
        items: [
          'The pricing model won’t change underneath you',
          'Heavily subsidized tokens can’t last forever',
        ],
        subs: { 0: ['GitHub Copilot switching from request-based to usage-based billing'] },
        notes: 'evidence: SPEAKER OPINION (line 2). Copilot moved to token-based GitHub AI Credits from 2026-06-01 (github.blog, 2026-04-27).',
      },
      page('stability', 'Stability', [
        'The quantization level won’t switch out from underneath you',
        'Theoretically less downtime',
      ]),
      page('fun', 'Fun', []),
      page('hosted-good', 'Hosted models are really good', [
        'Subscriptions are a great deal right now',
        'They’re called frontier models for a reason',
      ]),
      page('largest', 'The largest model isn’t always necessary', []), // bullets to come
    ],
  },
  {
    title: 'Getting started',
    slides: [
      page('train-infer', 'Training and inference', ['Training', 'Inference'], {
        0: ['Learning patterns from large amounts of text, code, and other data', 'Requires enormous amounts of compute'],
        1: ['Running the trained model to generate responses', 'Requires much less compute than training'],
      }),
      page('engine', 'What is an inference engine?', [
        'Download model weights, often from Hugging Face',
        'Load the model into GPU memory',
        'Process prompts and generate tokens',
        'Serve requests through an API',
      ], { 0: ['GGUF or safetensors'] }),
    ],
  },
  {
    title: 'Fitting a model into VRAM',
    slides: [
      page('what-fits', 'What needs to fit?', ['Model weights', 'KV cache for the conversation']),
      page('quant', 'Quantization', ['Reducing the precision of the model’s weights', 'Examples'], {
        1: ['Q8, Q5, Q4', 'W4A16', 'NVFP4'],
      }),
      page('dense-moe', 'Dense vs. Mixture of Experts', [
        'Dense example: Qwen3.8-27B',
        'MoE example: Qwen3.6-35B-A3B',
      ]),
      // --n-cpu-moe N: expert tensors of the first N MoE layers stay on CPU (llama.cpp tools/server/README.md)
      page('moe-offload', 'MoE offloading', ['Move some expert weights into CPU RAM', 'llama.cpp: `--n-cpu-moe 6`']),
      // Vendor specs (checked 2026-11-18): nvidia.com RTX 5090; docs.nvidia.com DGX Spark; apple.com Mac Studio
      // (M5 Max 614 GB/s is the 40-core GPU config; M5 Ultra ~1.2 TB/s); amd.com R9700 (20 Gbps × 256-bit).
      {
        ...page('hardware', 'Choosing hardware', ['Memory bandwidth'], {
          0: [
            'RTX 5090 — 32 GB at 1,792 GB/s',
            'DGX Spark — 128 GB at 273 GB/s',
            'M5 Max — up to 128 GB at 614 GB/s',
            'M5 Ultra — up to 512 GB at 1,200 GB/s',
            'AMD R9700 — 32 GB at 640 GB/s',
          ],
        }),
      } as Slide,
    ],
  },
  {
    title: 'More context',
    slides: [
      // Speaker's wording "each new message"; strictly it's each new token (see docs/v4-slide-copy-handoff.md).
      // Flag values are illustrative, not an equal-capacity comparison.
      page('kv-cache', 'KV cache', ['Without this, each new message has to recompute all that came before'], {
        0: ['llama.cpp: `--ctx-size 32768 --parallel 4`', 'vLLM: `--max-model-len 32768 --kv-cache-memory-bytes 8G`'],
      }),
      page('kv-quant', 'Quantizing the KV cache', ['It’s possible to quantize the KV cache as well'], {
        0: ['llama.cpp: `--cache-type-k q8_0 --cache-type-v q8_0`', 'vLLM: `--kv-cache-dtype fp8`'],
      }),
    ],
  },
  {
    title: 'Running requests in parallel',
    slides: [
      page('parallel', 'Running requests in parallel', ['One agent is nice, but two is nicer'], {
        0: ['llama.cpp: `--parallel 4`', 'vLLM: `--max-num-seqs 4`'],
      }),
      // Speaker's wording; strictly, prefix caching reuses already computed K/V for an identical token prefix.
      // --cache-ram is MiB.
      page('prefix-cache', 'Prefix caching', ['Not having to recompute the KV cache'], {
        0: ['llama.cpp: `--cache-prompt --cache-ram 8192`', 'vLLM: `--enable-prefix-caching`'],
      }),
    ],
  },
  {
    title: 'Making things faster',
    slides: [
      // Native MTP isn't always a separate model; verification isn't a plain equality check when sampling.
      page('spec-decode', 'Speculative decoding', [
        'A small drafter model tries to predict the next several upcoming tokens',
        'The main model still has to accept the predictions',
        'Different types: MTP, DFlash, DSpark, DFlash2',
      ]),
      page('own-drafter', 'Training your own drafter', ['Recommended library: `vllm-project/speculators`']),
    ],
  },
  {
    title: 'Sharing local models',
    slides: [
      // Public-safe summary only: no hosts, keys, inventory, or pooled-VRAM claims.
      page('collective', 'LLM Collective', [
        'Models running at different people’s homes',
        'A small Go binary runs at home and phones home to a central gateway',
        'The gateway handles API keys and sends requests to the right machine',
      ]),
    ],
  },
  {
    title: 'Things to watch',
    slides: [
      page('watch', 'Things to watch', [
        'N-gram weights',
        'Custom inference engines like NInfer, Radiance, and Strata',
      ]),
      page('questions', 'Questions?', []),
    ],
  },
];

const deck: Slide[] = [
  TITLE,
  ...SECTIONS.flatMap((sec, i) => {
    const n = String(i + 1).padStart(2, '0');
    const divider: Slide = { id: `ch${n}`, type: 'section', header: ['', ''], number: n, title: sec.title, framing: '' };
    const label = `${n} — ${sec.title}`;
    return [divider, ...sec.slides.map(s => ('header' in s ? { ...s, header: [label, ''] } : { ...s, chip: label }) as Slide)];
  }),
];

/** Page numbers top right, square list markers. */
export const slides: Slide[] = deck.map((s, i) => {
  if (s.type === 'title') return s;
  const page = `${i + 1} / ${deck.length}`;
  const out = { ...s } as Slide & { header?: [string, string] };
  if (out.header) out.header = [out.header[0], page];
  else out.page = page;
  if (out.type === 'list') out.marker = 'square';
  return out as Slide;
});
