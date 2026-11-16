# splats/smoke — reserved for a file-backed splat smoke test

Nothing is vendored here yet, so `gs-smoke-file` does not exist in the deck. The `src:` loading
path (`new SplatMesh({ url: BASE_URL + src })` in `src/scenes/pixel-viz.js`) is therefore still
unverified by a screenshot.

## Why the sample was not checked in (checked 2026-11-16)

The obvious candidate was Spark's own demo asset, referenced by their README/`examples/assets.json`:

- `https://sparkjs.dev/assets/splats/butterfly.spz` — HTTP 200, `access-control-allow-origin: *`,
  ~4.0 MB (`content-length: 0x3d6d04`).
- `https://sparkjs-assets.vercel.app/butterfly.spz` — **404** (`DEPLOYMENT_NOT_FOUND`); do not use.

License check came back **unclear**, so per the task rule ("if no clear license, use only the proc
slide") the file stays out of the repo:

- `@sparkjsdev/spark@2.4.0` npm package: `LICENSE` = MIT, © 2025 World Labs Technologies — that
  covers the **code**, not the sample data.
- `github.com/sparkjsdev/spark` README badge: MIT (repository code).
- `https://sparkjs.dev/assets/` (the asset index the examples read, `examples/assets.json`) lists
  **credits only, no license grant**: "3D model of anvil adapted from Avil Nature Morte by seenoise;
  **Butterfly textures adapted from https://civitai.com/images/27197216 and
  https://civitai.com/images/7069048**; Food scans by Tipatat; Dali environment by Reem Chalak".
  The butterfly's source textures come from Civitai, whose uploads carry per-upload terms that are
  usually non-commercial — i.e. redistribution in a conference deck is not clearly permitted.
- Spark's `scripts/download-assets.js`, docs pages (`overview`, `spark-renderer`,
  `loading-splats`, `procedural-splats`) and `docs/docs/community-resources.md` contain no asset
  license statement.

## To enable the file slide later

1. Get written clearance from World Labs / Spark for one sample splat (or use a self-trained or
   CC0 asset — e.g. a scan the speaker makes, or a clearly licensed `.spz` from Hugging Face), then
   record the exact permission here with date and source URL.
2. Save it as `public/splats/smoke/<name>.spz` and add `gs-smoke-file` to
   `src/slides/splat-lab/00-smoke.ts` with `src: 'splats/smoke/<name>.spz'` — the same
   `method.label: 'S0 · smoke test'`, with `how`/`compute` reworded for "file · downloaded at page
   load". No other code change is needed; `pixel-viz.js` already handles `.spz .ply .splat .ksplat
   .sog`.
3. Loader status, measured 2026-11-16 with a **temporary local copy** of the file (deleted again
   after the check, so nothing licensed-unclear stays in the tree): pointing `src:` at
   `splats/smoke/butterfly.spz` loaded **177,132 splats**, the readout showed
   `177,132 splats`, and the canvas contained only the 15 sage ramp colours — i.e. the `src` branch
   of `buildSplat` and the post shader both work on a real capture. Only the slide entry is missing.
4. Note for the deck's accuracy rules: any real captured scene must be described as a capture of a
   real object, not as simulated demo data, and its origin must be cited on the slide.
