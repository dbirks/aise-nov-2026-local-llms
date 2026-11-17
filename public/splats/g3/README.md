# Splat lab · method G3 — real 3DGS training on our GTX 1070 (k8s Job)

These are **actual trained Gaussian splats**: a classic Gaussian-splatting model fitted to real
multi-view photographs on the cluster's Pascal card, then cropped to the subject. Not synthetic,
not a downloaded scan, not illustrative. The photographs are third-party (licence below).

| file | slide | what it is | splats | size |
|---|---|---|---|---|
| `truck.spz` | `gs-g3-truck` | Tanks and Temples **"truck"** (a toy pickup on a table), after 15,000 training steps, cropped to the subject + a lip of table | 93,540 | 1.50 MB |
| `truck-grow.spz` | `gs-g3-truck-grow` | the **same scene, same crop, at step 2,500** — early refinement: fewer, rounder, fainter splats | 63,551 | 1.00 MB |

Total 2.6 MB (per-file cap 8 MB, method cap 25 MB). Both are centred on the origin, y-up
(`-r 180,0,0` from COLMAP's y-down world), largest extent 4.0 units, SPZ v4, 0 SH bands
(trained with `--sh-degree 0`, so there is no view-dependent term to lose in the conversion).

## How they were made

**Trainer** [Brush v0.3.0](https://github.com/ArthurBrussee/brush) (Apache-2.0, Google's
`brush_splat` fork) — Rust + [Burn](https://github.com/tracel-ai/burn) over **wgpu/Vulkan**, so
there is **no CUDA toolchain and no sm_61 kernel compile anywhere** in this pipeline. That is the
whole reason a Pascal card can still train 3DGS in 2026 while CUDA 13 images refuse to start on it.
Binary: `brush-app-x86_64-unknown-linux-gnu.tar.xz` from the v0.3.0 release, sha256
`4f0f9a8785d1951c62df26aae247c02c5bba32b00f40b06df4e1c9b867399e20` (verified in the Job; the
archive calls the binary `brush_app`). It prints `brush-cli 0.3.0`.

**Where it ran** — home-k8s Job `splat-lab-train-4`
([`apps/splat-lab-train.yaml`](https://github.com/dbirks/home-k8s/blob/main/apps/splat-lab-train.yaml)),
node `dave-droid`, `runtimeClassName: nvidia`, `limits: nvidia.com/gpu 1 + nvidia.com/gpumem 5000`,
`NVIDIA_DRIVER_CAPABILITIES=all` + `VK_ICD_FILENAMES=/etc/vulkan/icd.d/nvidia_icd.json` (the same
Vulkan-on-Pascal injection as `apps/qwen3-asr.yaml`), image
`pytorch/pytorch:2.7.1-cuda12.6-cudnn9-runtime` — only for its python + apt; torch is never used.

```sh
# exact training command (from the ConfigMap in that file)
brush <truck dataset dir> \
  --total-steps 15000 --max-resolution 600 --sh-degree 0 --max-splats 1200000 \
  --growth-stop-iter 11250 --seed 7 \
  --eval-split-every 8 --eval-every 5000 --eval-save-to-disk \
  --export-every 2500 --export-path /data/out/train-4 --export-name "truck_{iter}.ply"
```

| measured | value |
|---|---|
| photos / resolution used | 251 images, 979×546 as released → **600 px longest side** inside Brush (600×335, ≈0.61× of the release, ≈0.37× of the 1600 px originals) |
| training wall time | **404 s** for 15,000 steps; 427 s for the whole Job (dataset + binary were already cached on the PVC) |
| splats in the final scene | 789,747 (growth stopped at 11,250 of 15,000 steps) |
| held-out quality | PSNR/SSIM on 31 eval views (every 8th image): **25.35 / 0.898** @5k, 26.27 / 0.918 @10k, **26.71 / 0.923** @15k (brush's own `Eval iter` log lines) |
| VRAM | `nvidia-smi` inside the container is **HAMi-patched** (reports the 5000 MiB quota, counts CUDA only → useless for a Vulkan process, and it has no `torch` here). Card-level truth from the cluster metrics (`gpu_device_memory_used_bytes` on `gpu-vram-exporter-dave-droid`, 60 s steps): idle baseline 2742 MiB, **peak 3830 MiB** during the run → **≈1.06 GiB for Brush** of the 8 GiB card. Far under the 4.9 GiB a Job may ask for. |
| CPU-side pack | crop 0.75 s + `splat-transform` 0.53 s (`truck.spz`); crop 0.35 s + pack 0.50 s (`truck-grow.spz`) — 2.1 s of tool time, **3.0 s wall** for the whole `pack.sh` including `uv`/`pnpx` start-up, on this 8-core box shared with other workers |

**Crop / normalise** — the scene also contains a background wall and distant floaters from the
COLMAP points, so `tools/splats/g3/pack.sh` runs `crop.py` (box in the capture frame, opacity floor
0.10 → 202,831 → 93,540 splats), centres on the bbox midpoint and scales the longest axis to 4.0
units, then `splat-transform -r 180,0,0` turns COLMAP's y-down world into the deck's y-up frame.
`truck-grow.spz` re-uses the **final** asset's crop transform (`--shift/--scale`) so the two
assets describe the same framed subject and only differ by how far training had got.

Rebuild:

```sh
kubectl cp default/$SPLAT_LAB_FILES_POD:/data/out/train-4 /tmp/train-4
bash tools/splats/g3/pack.sh /tmp/train-4            # GROW_ITER=2500 by default
pnpx @playcanvas/splat-transform@3.11.2 public/splats/g3/truck.spz --stats null
```

Helper tools in `tools/splats/g3/`: `poses.py` (reads COLMAP `.bin` files with no COLMAP: camera
model, capture scale, and the gravity estimate that proved −y is up), `probe.py` (stats + an
orthographic contact sheet of a `.ply`, used to choose the crop box and check the flip without a
renderer), `crop.py` (crop + centre + scale), `pack.sh` (the driver).

## Inputs and licences

* **Photographs**: Tanks and Temples, scene `truck` — Knapitsch, Park, Zhou & Koltun, *Tanks and
  Temples: A Big-scale, Accurate & Novel View-Shifted Benchmark for Local 3D Reconstruction*,
  SIGGRAPH 2017. <https://tanksandtemples.org/>, dataset page for this scene
  <https://huggingface.co/datasets/nvs-bench/tanksandtemples> (folder `truck/`: `images/` 251 jpg +
  COLMAP `sparse/0/`, 187 MB, downloaded with `tools`/`fetch_hf.py` in the Job).
  **Licence, as recorded 2026-11-16:** the T&T licence page
  (<https://tanksandtemples.org/license/>) declares the benchmark data **CC BY 4.0** and *also*
  states in "License Grant" that the free right is for **non-commercial scientific research** and
  that "any use for commercial purposes… including production of other artefacts" is prohibited.
  The Hugging Face mirror carries a repo-level `license: mit` tag, which cannot relicense the
  photographs themselves. → **Flagged for the speaker**: a community meetup talk showing a rendered
  result with attribution is within the spirit of the CC BY 4.0 grant, but if AISE is treated as a
  commercial event, or if these assets ship in a public repo, confirm with the organisers / the
  dataset owners. Attribution + citation to the paper is required either way and is on the slide.
* **Trainer**: Brush v0.3.0, Apache-2.0. Method: 3D Gaussian Splatting (Huang et al., SIGGRAPH
  2023, <https://repo-sam.inria.fr/fungraph/3d-gaussian-splatting/>) with Brush's own MCMC-flavoured
  densification ("splats grow first where they are needed, yet explore the scene"), see
  <https://github.com/ArthurBrussee/brush/releases/tag/v0.3.0>.
* **Converter**: [playcanvas/splat-transform](https://github.com/playcanvas/splat-transform)
  v3.11.2 (MIT); SPZ container: [nianticlabs/spz](https://github.com/nianticlabs/spz).
* GPU cluster manifests: <https://github.com/dbirks/home-k8s> (`apps/splat-lab*.yaml`).

## Accuracy constraints — what these assets must NOT imply

* The **truck is not "a 3D model"**: it is ~800k anisotropic Gaussians fitted to 251 photographs by
  differentiable rendering. Nothing here encodes a real vehicle's dimensions (it is a toy on a table
  at an arbitrary COLMAP scale — the capture's own units, ~4.4 of them across the subject).
* PSNR/SSIM above are **held-out-view reconstruction metrics for this one scene**, not a comparison
  of trainers, and not "3DGS quality". No cross-method or cross-hardware claim is being made.
* 404 s on a GTX 1070 says nothing about A100/4090 throughput, and this scene is 251 tiny images at
  600 px with SH degree 0 and a 1.2 M splat cap — a deliberately small configuration. Do not present
  it as "3DGS training takes 7 minutes".
* Both assets are the **same training run** at different steps; the visual difference is Brush's
  refine/densify schedule, not a different algorithm.
* `sh_degree 0` means the asset has **no view-dependent appearance** — a real 3DGS scene at SH 3
  would carry 16 more coefficient triplets per splat and cost more memory and file size. Say
  "simplified" if asked why the truck has no specular highlights.
* The scene keeps a strip of the **table** it stands on; it is not segmented to the object alone.
* Unknown / to confirm: the exact provenance and downscale factor applied by the `nvs-bench` HF
  mirror (it ships 979×546 images; the official T&T release for this scene is larger). The COLMAP
  model came with the mirror and was **not** re-run here. Eval renders (32 PNGs each for steps
  5k/10k/15k) live in the Job's `/data/out/train-4/eval_*/` on the cluster PVC, not in this repo.
