# Deck v3 — Configuring Local LLMs

Started 2026-11-18 from [the wording-review handoff](wording-review-handoff-2026-11-18.md).

## Where things live

| URL | Deck | Code |
| --- | --- | --- |
| `/` and `/3/` | v3 (current) | `src/decks/v3.ts` |
| `/2/` | v2 (archived) | `src/decks/v2.ts` |
| `/1/` | v1 (archived) | `src/decks/route-v1.ts` |

- v3 reuses the v2 slide files and 3D scenes (`src/slides/v2/`). It sets each slide's header and chip to the v3 chapter.
- v3 wording lives in `src/slides/v3/copy.ts`, keyed by slide id. A slide not listed there keeps its v2 text.
- New v3-only slides live in `src/slides/v3/extra.ts`.
- `scripts/subpaths.mjs` copies `index.html` into `dist/1`, `dist/2` and `dist/3`. `src/main.tsx` picks the deck from the path.

## What changed from v2

- The title is **Configuring Local LLMs** (approved).
- The chapters are now audience questions (handoff table):
  - 00 Opening
  - 01 Why run a local model?
  - 02 Getting started: from Ollama to inference engines
  - 03 How do you fit a useful model on your GPU?
  - 04 How do you give it more context?
  - 05 How do you run several agents at once?
  - 06 How do you make generation faster?
  - 07 What else is worth experimenting with?
  - 08 Sharing local models
  - 09 Close
- 00–02 use the handoff's draft wording (open, why-*, train-vs-infer A/B, engines).
- `setup-path` moved into 02. The eGPU and hardware slides moved into 03.
- `setup-why` is cut because it repeated the Copilot story in `why-cost`.
- New slides (draft wording):
  - `params`: a parameter is one learned number (02).
  - `param-count`: why a 4-bit 27B model shows up as 15B (03).
  - `autoround-tool` (03).
  - `speculators-tool` (06).
- Section framings for 02–09 are lightly reworded from v2, still in draft.

## Still to review with the speaker (not applied)

- The wording for 03–09 is unchanged from v2.
- The copy risks from the handoff:
  - "each word" should be "each token".
  - The KV cache "one small step" wording.
  - Batching "costs little extra".
  - "The drafter needs its own full KV".
  - The two PLE variants show different designs under one name.
  - Rated 5090 bandwidth vs measured eGPU speed.
- `param-count` probably wants a 3D packing scene: logical weights vs storage elements vs bytes.
- The handoff's open questions: the hybrid Opus/pi/local workflow diagram, and the Qwen4 wording.
