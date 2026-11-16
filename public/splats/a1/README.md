# Splat lab · method A1 — LLM-written Spark code (qwen3-8-flash-next)

Every splat set here is **procedural**: an LLM (qwen3-8-flash-next) wrote JavaScript generators
against Spark's procedural-splat API (`PackedSplats.pushSplat`). They run **in the browser on every
page load** — there is no `.ply`/`.spz` file and no CPU bake for this method. That is the whole
point of the A1 row in the lab: cost is a few ms at mount, zero once baked.

- Contract type: `SplatProc = (ctx: { spark, THREE }) => Object3D | Promise<Object3D>`
  (see `src/scenes/splat-procs/index.ts`).
- Slides: `src/slides/splat-lab/a1-qwen.ts` (`proc` = generator file name without `.ts`).
- API reference used: <https://sparkjs.dev/docs/procedural-splats/> and
  `node_modules/@sparkjsdev/spark/dist/types/` (`PackedSplats.pushSplat/setSplat`, `SplatMesh`
  `onFrame`, `numSplats`). Spark `@sparkjsdev/spark@2.4.0`, three `^0.187.0`.
- Render path: Spark writes into the deck's low-res target; the deck's post shader keeps **only
  luminance** and maps it to a 6-tone sage ramp with dither. Everything below is designed in grey.
- Splat counts below were read from the live slide readout (`SplatLayout` → `state.count`).

> **No external inputs / no measured data.** No source images, no model weights, no scans, no
> benchmarks. All geometry is illustrative primitive shapes. Per AGENTS.md these slides must not be
> read as claims about real hardware, real embeddings, or a real engine's cache.

---

## qwen-gpu — a graphics card
- File: `src/scenes/splat-procs/qwen-gpu.ts` · slide `gs-a1-q-gpu`.
- What it is: a stylised graphics card — dark PCB, a bright PCIe edge-connector comb, a finned
  heatsink (parallel strips), eight VRAM packages ringing a brightest raised central logic die, and
  two axial fans (blades + bright housing ring + dark hub). Illustrative shape, not a real card.
- How made: LLM-written TS, deterministic PRNG (mulberry32, seed 1337) so the render is identical on
  every load. Disc splats are flat (thin Gaussian axis ≈ 0.022) lying on each surface's plane so
  they read as solid plate; luminance separates the parts (board 0.12 · fins 0.58 · fingers 0.72 ·
  die 0.95).
- Splat count: **9,287**. Compute: browser, every load (~ms at mount; not timed — see task rule).
- Sources: Spark procedural-splat docs above. No third-party assets.

## qwen-embedding — an illustrative embedding cloud
- File: `src/scenes/splat-procs/qwen-embedding.ts` · slide `gs-a1-q-embedding`.
- What it is: ~40k round "dust" splats in 5 soft Gaussian clusters spread across a ~4-unit extent;
  4 dark "query" points (each ringed by a bright halo) with faint bright threads to the nearest
  cluster centre.
- **Illustrative only.** No model, no layer, no token vectors, no t-SNE/UMAP. This is NOT a
  projection of any real model's embeddings, and static-embedding relationships do not generalise to
  contextual residual streams (AGENTS.md). Caption says so.
- How made: LLM-written TS; Box–Muller gaussians (PRNG seed 24601). Cluster dust mid-dark (≈0.40) so
  the cloud body reads against the light page; queries 0.03, filaments 0.95 for luminance contrast.
- Splat count: **39,352**. Compute: browser, every load.
- Sources: Spark procedural-splat docs. No third-party assets.

## qwen-kvcache — a growing paged KV cache (animated)
- File: `src/scenes/splat-procs/qwen-kvcache.ts` · slide `gs-a1-q-kvcache`.
- What it is: a ribbon of paged blocks. Rows = 8 model layers (y); columns along x = blocks of 16
  tokens each (16 blocks). Filled pages are drawn **dark** (solid cuboids); allocated-but-empty
  pages are **faint light outlines** — so "long context" ≠ "the whole cache is occupied" (AGENTS.md).
  Illustrative block count/size/occupancy — no real engine numbers.
- Animation: two `SplatMesh`es share one `onFrame` clock. Filled splats are stored in growth order so
  revealing a **prefix** (setting `packedSplats.numSplats`) advances the dark frontier along x; the
  outline splats are stored in reverse order so shrinking their prefix leaves only the pages ahead of
  the frontier. Each frame sets two integers — O(1), no re-push, no re-bake. Frontier ping-pongs
  between 4 and 15 filled columns (period 11 s) so the picture always shows both filled and empty.
- How made: LLM-written TS (PRNG seed 90210). Filled block = light top / mid front / dark side
  cuboid (80 splats); empty page = a 28-splat top wireframe ring at luminance 0.82.
- Splat count: **13,824** built (live visible count varies with the frontier). Compute: browser,
  every load, animated.
- Sources: Spark procedural-splat + `SplatMesh.onFrame` types. No third-party assets.
