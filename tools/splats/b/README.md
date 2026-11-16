# tools/splats/b — method B generators

| file | what it does |
|---|---|
| `fetch.sh` | downloads the three Wikimedia Commons photos into `inputs/` (curl, descriptive UA). Inputs are ~1024–1280 px thumbs; the baker resizes to ≤ 768 px. |
| `bake_depth.py` | `uv` inline-script: photo → Depth Anything V2 Small relative depth (CPU) → 2.5D pinhole lift → 3DGS binary `.ply`, centred, y-up, largest extent 4. Prints/ writes measured timings + peak RSS. |
| `run-all.sh` | full rebuild: bake all three, convert `.ply` → `.spz` into `public/splats/b/`, print `--stats`. |
| `inputs/*.jpg` | licensed source photos (see `public/splats/b/README.md` for URL + licence per file). |
| `metrics/*.json` | measured output of the last `run-all.sh` (timings, splat counts, extents, polarity check). |

Runtime notes:

- `uv run --index https://download.pytorch.org/whl/cpu --extra-index-url https://pypi.org/simple`
  keeps torch on the CPU wheel (~200 MB) — no CUDA, no GPU.
- 4 torch threads, 8-core box shared with other workers; peak RSS ≈ 0.75 GB.
- `--flip no` is the default because Depth Anything V2 relative output is disparity-like
  (larger = closer). The `core`/`ring` means recorded in `metrics/*.json` show why a
  "border = background" heuristic must **not** auto-polarise an aisle/corridor photo
  (rack: core 0.78 < ring 4.85 while the borders are genuinely the nearest objects).
- Intermediate `.ply` files (5.6–7.1 MB) are written to `/tmp/splats-b/` on purpose and are
  not committed.
