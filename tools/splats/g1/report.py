#!/usr/bin/env python3
"""splat-lab g1 — collect the per-stage metrics into $OUT/RESULTS.json (+ a log summary).

Nothing here measures anything itself: it merges the JSON files written by mvgen.py and
lgm2ply.py, adds the input manifest, the Job identity (pod, node, image, LGM commit) and the
peak of the `nvidia-smi` sampler rows that run.sh logged, so the deck's provenance README can
quote one number per claim.
"""

import argparse
import datetime
import glob
import json
import os
import re
import socket
import subprocess
import sys


def log(msg):
    print(f"[report {datetime.datetime.utcnow():%H:%M:%S}] {msg}", flush=True)


def smi_peak(out_dir: str):
    """Highest memory.used seen in the nvidia-smi sampler lines of this run's logs (MiB)."""
    best = None
    pat = re.compile(r"nvidia-smi (\d+) MiB, (\d+) MiB")
    for path in glob.glob(os.path.join(out_dir, "run-*.log")):
        with open(path, errors="replace") as f:
            for line in f:
                m = pat.search(line)
                if m:
                    used = int(m.group(1))
                    best = used if best is None else max(best, used)
    return best


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", required=True)
    ap.add_argument("--scripts", default="/scripts")
    ap.add_argument("--start-ts", type=int, default=0)
    ap.add_argument("--stage", default="report")
    args = ap.parse_args()

    result = {
        "job": {
            "slug": "g1-lgm",
            "pod": os.environ.get("HOSTNAME", socket.gethostname()),
            "node": os.environ.get("NODE_NAME", ""),
            "image": os.environ.get("IMAGE", ""),
            "lgm_commit": os.environ.get("LGM_REV", ""),
            "out": args.out,
            "stage": args.stage,
            "utc": datetime.datetime.utcnow().isoformat(timespec="seconds") + "Z",
        },
        "env": {k: v for k, v in sorted(os.environ.items())
                if k in ("SUBJECTS", "STEPS", "GUIDANCE", "ELEVATION", "SEED", "MATTE", "CONFIG",
                         "CKPT", "INPUT_SIZE", "LGM_EXTRA", "VIEWS_BASE", "HF_HOME", "U2NET_HOME")},
        "subjects": {},
    }

    try:
        with open(os.path.join(args.out, "inputs-manifest.json")) as f:
            result["inputs"] = json.load(f)
    except OSError as e:
        result["inputs"] = f"missing: {e}"

    for name in [os.path.splitext(os.path.basename(p))[0] for p in glob.glob(os.path.join(args.out, "*.ply"))]:
        per = {}
        for stage, fname in (("mvgen", "metrics_mvgen.json"), ("lgm2ply", "metrics_lgm2ply.json")):
            for cand in (os.path.join(args.out, name, fname), os.path.join(args.out, fname)):
                if os.path.exists(cand):
                    with open(cand) as f:
                        per[stage] = json.load(f)
                    break
        per["ply_path"] = os.path.join(args.out, name + ".ply")
        per["ply_bytes"] = os.path.getsize(per["ply_path"])
        lgm = per.get("lgm2ply", {})
        if lgm.get("ply"):
            per["ply_count"] = lgm["ply"]["count"]
        peak = [p["peak_cuda_alloc_mib"] for p in per.values() if isinstance(p, dict) and "peak_cuda_alloc_mib" in p]
        per["peak_cuda_alloc_mib"] = max(peak) if peak else None
        wall = [p["wall_s"] for p in per.values() if isinstance(p, dict) and "wall_s" in p]
        per["sum_stage_wall_s"] = round(sum(wall), 1) if wall else None
        result["subjects"][name] = per

    peak = smi_peak(args.out)
    if peak is not None:
        result["nvidia_smi_peak_used_mib"] = peak
    if args.start_ts:
        result["job"]["script_wall_s"] = int(datetime.datetime.now().timestamp() - args.start_ts)

    try:
        result["gpu"] = subprocess.run(
            ["nvidia-smi", "--query-gpu=name,memory.total,driver_version", "--format=csv,noheader"],
            capture_output=True, text=True, timeout=30).stdout.strip()
    except Exception as e:  # pragma: no cover
        result["gpu"] = f"nvidia-smi failed: {e}"

    dest = os.path.join(args.out, "RESULTS.json")
    with open(dest, "w") as f:
        json.dump(result, f, indent=2, sort_keys=True)

    log(f"===== {os.path.basename(args.out)} =====")
    for name, per in result["subjects"].items():
        mv, lgm = per.get("mvgen", {}), per.get("lgm2ply", {})
        log(f"{name}: views={mv.get('diffusion_s')}s cutout={mv.get('cutout_s')}s "
            f"| forward={lgm.get('forward_s')}s weights={lgm.get('weights_mib')}MiB "
            f"| splats={per.get('ply_count')} | peak={per.get('peak_cuda_alloc_mib')}MiB "
            f"| ply={per.get('ply_bytes')}")
        if lgm.get("ply"):
            log(f"    bounds {lgm['ply']['bounds_min']} .. {lgm['ply']['bounds_max']} "
                f"extent={lgm['ply']['extent']} centre={lgm['ply']['centre']}")
        if lgm.get("state_dict") and (lgm["state_dict"]["missing_keys"] or lgm["state_dict"]["unexpected_keys"]):
            log(f"    WARN state_dict mismatch: {lgm['state_dict']}")
    log(f"nvidia-smi peak used: {result.get('nvidia_smi_peak_used_mib')} MiB; "
        f"script wall {result['job'].get('script_wall_s')}s -> {dest}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
