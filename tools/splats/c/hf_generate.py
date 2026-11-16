# /// script
# requires-python = ">=3.11"
# dependencies = ["gradio_client==1.14.0", "plyfile", "numpy", "pillow"]
# ///
"""Call public Hugging Face Spaces that generate 3D Gaussian splats, download the .ply.

Usage:
  uv run tools/splats/c/hf_generate.py --list
  uv run tools/splats/c/hf_generate.py --job lgmmini_gpu --image tools/splats/c/inputs/<file>.jpg

Every job records wall time (including queue), raw splat count and error text in
tools/splats/c/manifest.json (append/merge by job name). Nothing here is private:
inputs are CC0/public-domain photos and short object prompts.
"""
from __future__ import annotations

import argparse
import json
import os
import shutil
import sys
import tempfile
import time
import traceback
from pathlib import Path

from gradio_client import Client, handle_file

# gradio_client 2.x (gradio 6) silently breaks file uploads against these
# gradio 5.x spaces (AppError on every image endpoint); 1.14.0 works.

REPO = Path(__file__).resolve().parents[3]
OUT = Path(tempfile.gettempdir()) / "splat-c"
MANIFEST = Path(__file__).resolve().parent / "manifest.json"

# Spaces used (checked Running on 2026-11-16 via https://huggingface.co/api/spaces/<id>)
SPACES = {
    "lgmmini": {
        "space": "dylanebert/LGM-mini",
        "url": "https://dylanebert-lgm-mini.hf.space",
        "model": "LGM (Large Multi-View Gaussian Model) mini",
        "license": "MIT (space + LGM code); see repo",
    },
    "trellis": {
        "space": "trellis-community/TRELLIS",
        "url": "https://trellis-community-trellis.hf.space",
        "model": "TRELLIS (Microsoft, 3D Rectified Flow, SLAT→Gaussians)",
        "license": "MIT (space); TRELLIS base model MIT",
    },
    "lgm": {
        "space": "ashawkey/LGM",
        "url": "https://ashawkey-lgm.hf.space",
        "model": "LGM (multi-view, text- or image-conditioned)",
        "license": "MIT",
    },
}


def log(msg: str) -> None:
    print(f"[{time.strftime('%H:%M:%S')}] {msg}", flush=True)


def load_manifest() -> dict:
    if MANIFEST.exists():
        return json.loads(MANIFEST.read_text())
    return {}


def save_manifest(m: dict) -> None:
    MANIFEST.write_text(json.dumps(m, indent=2, sort_keys=True) + "\n")


def record(job: str, **kw) -> None:
    m = load_manifest()
    e = m.get(job, {})
    e.update(kw)
    m[job] = e
    save_manifest(m)


def splat_count(ply: Path) -> int:
    from plyfile import PlyData

    return len(PlyData.read(str(ply)).elements[0].data)


def call_with_retry(fn, tries: int = 3, wait: int = 45):
    """ZeroGPU anonymous quota is tiny; retry a few times, then give up."""
    last = None
    for i in range(1, tries + 1):
        try:
            return fn(i)
        except Exception as exc:  # noqa: BLE001 - we want every failure mode verbatim
            last = exc
            text = f"{type(exc).__name__}: {exc}"
            log(f"  attempt {i} failed: {text[:400]}")
            record("last_error", text=text[:1500], attempts=i, at=time.strftime("%Y-%m-%dT%H:%M:%S"))
            if i < tries:
                time.sleep(wait * i)
    raise last  # type: ignore[misc]


def client_for(sp: dict) -> Client:
    # Long generations exceed httpx's default read timeout, which looks like a
    # network error but is really just the ZeroGPU queue + render time.
    import httpx

    return Client(sp["url"], verbose=False, download_files=tempfile.mkdtemp(prefix="splat-c-"),
                  httpx_kwargs={"timeout": httpx.Timeout(1800.0, connect=30.0)})


def job_lgmmini(image: str, seed: int = 42) -> dict:
    sp = SPACES["lgmmini"]
    out: dict = {"space": sp["space"], "space_url": sp["url"], "model": sp["model"], "input": image}

    def run(_attempt: int):
        with tempfile.TemporaryDirectory() as dl:
            c = Client(sp["url"], verbose=False, download_files=dl)
            t0 = time.time()
            res = c.predict(handle_file(image), seed, api_name="/run")
            dt = time.time() - t0
            local = res if isinstance(res, str) else res.get("path")
            dest = OUT / f"{CURRENT}.raw.ply"
            shutil.copy(local, dest)
            return dest, dt

    dest, dt = call_with_retry(run)
    out |= {"wall_seconds": round(dt, 1), "raw_ply": str(dest), "raw_bytes": dest.stat().st_size,
            "splats": splat_count(dest), "seed": seed, "api": "POST /run(image, seed) -> ply"}
    return out


def job_trellis(image: str, seed: int = 42) -> dict:
    """TRELLIS community app: preprocess → generate (SLAT→gaussian+mesh) → extract gaussian .ply."""
    sp = SPACES["trellis"]
    out: dict = {"space": sp["space"], "space_url": sp["url"], "model": sp["model"], "input": image}

    def run(_attempt: int):
        with tempfile.TemporaryDirectory() as dl:
            c = client_for(sp)
            timings: dict[str, float] = {}
            t0 = time.time()
            s1 = time.time()
            prep = c.predict(handle_file(image), api_name="/preprocess_image")
            timings["preprocess"] = round(time.time() - s1, 1)
            prepped = prep.get("path") if isinstance(prep, dict) else prep
            # generate_and_extract_glb(image, multiimages, seed, ss_guidance, ss_steps,
            #                           slat_guidance, slat_steps, multiimage_algo, mesh_simplify, texture_size)
            s1 = time.time()
            res = c.predict(
                prepped, None, seed, 1.0, 12, 1.0, 10, "stochastic", 0.95, 512,
                api_name="/generate_and_extract_glb",
            )
            timings["generate"] = round(time.time() - s1, 1)
            video, glb, state = res
            s1 = time.time()
            ply = c.predict(state, api_name="/extract_gaussian")
            timings["extract_gaussian"] = round(time.time() - s1, 1)
            dt = time.time() - t0
            OUTS["trellis_seconds"] = timings
            ply_local = ply.get("path") if isinstance(ply, dict) else ply
            dest = OUT / f"{CURRENT}.raw.ply"
            shutil.copy(ply_local, dest)
            return dest, dt

    dest, dt = call_with_retry(run)
    out |= {"wall_seconds": round(dt, 1), "raw_ply": str(dest), "raw_bytes": dest.stat().st_size,
            "splats": splat_count(dest), "seed": seed, "steps": OUTS.get("trellis_seconds"),
            "api": "/preprocess_image → /generate_and_extract_glb → /extract_gaussian"}
    return out


def job_lgm(image: str | None, prompt: str = "a graphics card with a large cooler", seed: int = 42) -> dict:
    """ashawkey/LGM: /process(input_image, prompt, prompt_neg, elevation, steps, seed) → grid, video, ply.
    With input_image=None this is a real text→3D-Gaussian run (SD multiview + LGM)."""
    sp = SPACES["lgm"]
    out: dict = {"space": sp["space"], "space_url": sp["url"], "model": sp["model"],
                 "input": image or f"text prompt: {prompt!r}"}

    def run(_attempt: int):
        with tempfile.TemporaryDirectory() as dl:
            c = client_for(sp)
            t0 = time.time()
            res = c.predict(handle_file(image) if image else None, prompt, "", 0, 30, seed,
                            api_name="/process")
            dt = time.time() - t0
            grid, video, ply = res
            ply_local = ply.get("path") if isinstance(ply, dict) else ply
            dest = OUT / f"{CURRENT}.raw.ply"
            shutil.copy(ply_local, dest)
            return dest, dt

    dest, dt = call_with_retry(run)
    out |= {"wall_seconds": round(dt, 1), "raw_ply": str(dest), "raw_bytes": dest.stat().st_size,
            "splats": splat_count(dest), "seed": seed,
            "api": "POST /process(input_image, prompt, prompt_neg, elevation, steps, seed) -> ply"}
    return out


CURRENT = ""
OUTS: dict = {}

JOBS = {
    "lgmmini_gpu": lambda: job_lgmmini(str(REPO / "tools/splats/c/inputs/gpu-gigabyte.jpg")),
    "lgmmini_rack": lambda: job_lgmmini(str(REPO / "tools/splats/c/inputs/server-rack.jpg")),
    "trellis_gpu": lambda: job_trellis(str(REPO / "tools/splats/c/inputs/gpu-gigabyte.jpg")),
    "trellis_rack": lambda: job_trellis(str(REPO / "tools/splats/c/inputs/server-rack.jpg")),
    "lgm_text_robot": lambda: job_lgm(None, "a cute robot reading a book, studio photo"),
}


def main() -> int:
    global CURRENT
    ap = argparse.ArgumentParser()
    ap.add_argument("--job")
    ap.add_argument("--list", action="store_true")
    a = ap.parse_args()
    if a.list:
        for k in JOBS:
            print(k)
        return 0
    if not a.job:
        ap.error("--job required")
    OUT.mkdir(parents=True, exist_ok=True)
    CURRENT = a.job
    try:
        info = JOBS[a.job]()
    except Exception as exc:  # noqa: BLE001
        text = f"{type(exc).__name__}: {exc}"
        log(f"JOB {a.job} FAILED: {text[:600]}")
        record(a.job, status="failed", error=text[:1500], traceback=traceback.format_exc()[-2500:])
        return 1
    record(a.job, status="ok", **info)
    log(f"JOB {a.job} OK {json.dumps(info, default=str)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
