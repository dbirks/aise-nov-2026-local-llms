# /// script
# requires-python = ">=3.11"
# dependencies = ["pyyaml"]
# ///
"""splat-lab g2 · regenerate the GitOps file for the DiffSplat GPU Job.

The canonical copies of the Job's scripts live here in the deck repo (they are reviewed with the
deck); the home-k8s ConfigMap is generated from them so the two cannot drift:

    uv run tools/splats/g2/render_job_yaml.py \
        --job splat-lab-diffsplat-1 --out /home/david/dev/home-k8s/apps/splat-lab-diffsplat.yaml

Re-running the Job means a new name (Jobs are immutable): pass `--job splat-lab-diffsplat-2`,
commit that, and Flux prunes the old Job because this file only ever carries one Job block.
The script refuses to write if the generated manifest does not parse back to exactly two
documents with the expected names.
"""
from __future__ import annotations

import argparse
import pathlib
import sys

import yaml

HERE = pathlib.Path(__file__).resolve().parent
JOB_FILES = ["requirements.txt", "prompts.tsv", "fetch_sources.py", "apply_patches.py", "setup.sh", "run.py"]

HEADER = """\
# splat-lab g2 · DiffSplat (SD1.5, 0.86 B params) text -> 3D Gaussian splats on dave-droid's
# GTX 1070 (Pascal sm_61, HAMi slice 5000 MiB). Generated 2026-11-16 — DO NOT EDIT BY HAND:
# the ConfigMap is rendered from tools/splats/g2/job/ in https://github.com/dbirks/aise-nov-2026-local-llms
# by tools/splats/g2/render_job_yaml.py (see that file for the re-run recipe).
#
# What the Job does (log: /data/out/<dir>/setup.log + run.log, both also echoed to pod logs):
#   1. cached venv on the PVC (diffusers 0.32.2 etc. — torch stays the image's 2.7.1+cu126),
#   2. pinned sources fetched over HTTPS with urllib+tarfile (this image has no git):
#      DiffSplat a99d75707541009283bc5c073f1a07b5add41d00 (MIT),
#      RaDe-GS d72f20792005ae1d6555a82aa2d15345f247604e (its 3DGS rasterizer fork) + that fork's
#      pinned glm 5c46b9c07008ae65cb81ab79cd677ecc1934b903,
#   3. three import-graph patches so the SD1.5 text->splat path loads without the
#      training/metrics/video stack (job/apply_patches.py; originals kept as *.upstream),
#   4. builds the rasterizer for sm_61 (TORCH_CUDA_ARCH_LIST=6.1) and caches the wheel; if that
#      fails a pure-python stub is used — the .ply export never calls the rasterizer, only the
#      optional verification contact sheets do, so a stub just costs us the previews,
#   5. cached HF weights: DiffSplat SD1.5 text-cond UNet-EMA (3.28 GB fp32) + GSVAE (SD).
#      GSRecon (160 MB) is not fetched: upstream states only its rendering function is used at
#      inference, and run.py redoes that math itself,
#   6. generates three splats from text prompts in **fp16** (upstream's `--half_precision` is
#      bf16, which PyTorch refuses on Pascal; upstream's default fp32 UNet alone is 3.3 GB and
#      does not fit next to the rest in a 4.9 GiB slice), writes
#      /data/out/<dir>/raw/<slug>.ply + raw/<slug>.json + metrics.json with measured wall time,
#      peak torch allocation and a device-wide nvidia-smi peak.
#
# Copy results out with:
#   kubectl cp default/<splat-lab-files pod>:/data/out/<dir> ./out
# This Job is never deleted by TTL (Flux would re-create and re-run it); to re-run, bump the
# name and the OUT path together.
"""


def clean(path: pathlib.Path) -> str:
    text = path.read_text(encoding="utf-8")
    text = "\n".join(line.rstrip() for line in text.split("\n"))
    return text.rstrip("\n") + "\n"


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--job", default="splat-lab-diffsplat-1", help="Job name (bump the trailing n to re-run)")
    ap.add_argument("--cm", default="splat-lab-diffsplat-scripts", help="ConfigMap name")
    ap.add_argument("--out", required=True, help="path of the YAML to write (home-k8s/apps/…)")
    args = ap.parse_args()

    if not args.job.startswith("splat-lab-"):
        sys.exit("--job must start with splat-lab-")
    out_dir = args.job[len("splat-lab-"):]

    data = {}
    for name in JOB_FILES:
        path = HERE / "job" / name
        if not path.is_file():
            sys.exit(f"missing {path}")
        data[name] = clean(path)

    def str_presenter(dumper, value):
        style = "|" if "\n" in value else None
        return dumper.represent_scalar("tag:yaml.org,2002:str", value, style=style)

    dumper = yaml.SafeDumper
    dumper.add_representer(str, str_presenter)

    cm = {
        "apiVersion": "v1",
        "kind": "ConfigMap",
        "metadata": {
            "name": args.cm,
            "namespace": "default",
            "labels": {"app": "splat-lab-diffsplat", "app.kubernetes.io/part-of": "splat-lab"},
            "annotations": {
                "splat-lab.aise/deck-source": "tools/splats/g2/job",
                "splat-lab.aise/regenerate": "uv run tools/splats/g2/render_job_yaml.py",
            },
        },
        "data": data,
    }
    template = (HERE / "job" / "job-manifest.tpl.yaml").read_text(encoding="utf-8")
    job_text = (template.replace("{{JOB_NAME}}", args.job)
                       .replace("{{CM_NAME}}", args.cm)
                       .replace("{{OUT_DIR}}", out_dir))

    # allow_unicode keeps the literal block style (PyYAML drops to double-quoted escapes for
    # any scalar with non-ASCII, which would make a 40 KiB script unreadable in review).
    text = HEADER + "---\n" + yaml.dump(cm, Dumper=dumper, sort_keys=False, allow_unicode=True,
                                        width=10_000) + "---\n" + job_text

    docs = list(yaml.safe_load_all(text))
    if len(docs) != 2:
        sys.exit(f"generated manifest parses to {len(docs)} documents, expected 2")
    got_cm, got_job = docs
    if got_cm["kind"] != "ConfigMap" or got_cm["metadata"]["name"] != args.cm:
        sys.exit("ConfigMap round-trip mismatch")
    if got_job["kind"] != "Job" or got_job["metadata"]["name"] != args.job:
        sys.exit("Job round-trip mismatch")
    if set(got_cm["data"].keys()) != set(JOB_FILES):
        sys.exit(f"ConfigMap keys mismatch: {sorted(got_cm['data'])}")
    if got_cm["data"]["run.py"] != clean(HERE / "job" / "run.py"):
        sys.exit("run.py did not round-trip through YAML")

    out = pathlib.Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(text, encoding="utf-8")
    size = out.stat().st_size
    print(f"wrote {out}: job={args.job} out=/data/out/{out_dir} configmap={args.cm} "
          f"({len(data)} keys, {size/1024:.1f} KiB, round-trip ok)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
