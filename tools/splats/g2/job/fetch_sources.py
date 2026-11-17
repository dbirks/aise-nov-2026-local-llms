#!/usr/bin/env python3
"""splat-lab g2 · fetch the pinned third-party sources without git.

`pytorch/pytorch:2.7.1-cuda12.6-cudnn9-devel` has no `git` binary, so the three pinned trees are
taken from GitHub's codeload archives over HTTPS with urllib + tarfile (extracted with
`filter="data"`, no member may escape the target directory). Each destination remembers the SHA
it was filled from in `.source-sha`, so a re-run of the Job skips the download.

    RaDe-GS is extracted with only `submodules/diff-gaussian-rasterization/**` (the rest of that
    repo is demo media we never read), and `third_party/glm` — a submodule of RaDe-GS, whose
    pinned commit we read from GitHub's contents API on 2026-11-16 — is unpacked into it.

Prints bytes downloaded and wall time per source; nothing here touches the GPU.
"""
from __future__ import annotations

import hashlib
import os
import pathlib
import shutil
import sys
import tarfile
import tempfile
import time
import urllib.request

CACHE = os.environ.get("G2_DL_DIR", "/data/cache/g2/dl")
REPO_ROOT = os.environ.get("G2_REPO_ROOT", "/data/cache/repo")
RADEGS_SHA = "d72f20792005ae1d6555a82aa2d15345f247604e"
SOURCES = [
    # repo, commit, destination, optional path prefix to keep
    ("chenguolin/DiffSplat", "a99d75707541009283bc5c073f1a07b5add41d00",
     f"{REPO_ROOT}/DiffSplat", None),
    ("BaowenZ/RaDe-GS", RADEGS_SHA,
     f"{REPO_ROOT}/RaDe-GS", "submodules/diff-gaussian-rasterization"),
    # RaDe-GS's pinned glm (header-only; auxiliary.h includes <glm/glm.hpp>)
    ("g-truc/glm", "5c46b9c07008ae65cb81ab79cd677ecc1934b903",
     f"{REPO_ROOT}/RaDe-GS/submodules/diff-gaussian-rasterization/third_party/glm", None),
]


def log(msg: str) -> None:
    print(f"[fetch] {msg}", flush=True)


def fetch(repo: str, sha: str, dest: str, only: str | None) -> None:
    d = pathlib.Path(dest)
    marker = d / ".source-sha"
    tag = f"{sha} only={only or '-'}"
    if marker.is_file() and marker.read_text().strip() == tag:
        log(f"cached  {repo} @ {sha[:12]} -> {dest}")
        return

    t0 = time.time()
    os.makedirs(CACHE, exist_ok=True)
    tar = os.path.join(CACHE, f"{repo.replace('/', '-')}-{sha}.tar.gz")
    url = f"https://codeload.github.com/{repo}/tar.gz/{sha}"
    if not os.path.exists(tar):
        tmp = tar + ".part"
        req = urllib.request.Request(url, headers={"User-Agent": "splat-lab-g2 (deck experiments)"})
        with urllib.request.urlopen(req, timeout=600) as r, open(tmp, "wb") as fh:
            shutil.copyfileobj(r, fh, length=1 << 20)
        os.replace(tmp, tar)
    digest = hashlib.sha256(open(tar, "rb").read()).hexdigest()[:16]
    size = os.path.getsize(tar) / 2**20

    work = pathlib.Path(tempfile.mkdtemp(prefix="g2-src-"))
    try:
        with tarfile.open(tar) as tf:
            members = tf.getmembers()
            top = members[0].name.split("/")[0]
            if only:
                keep = f"{top}/{only}"
                members = [m for m in members if m.name == top or m.name == keep or m.name.startswith(keep + "/")]
            tf.extractall(work, members=members, filter="data")
        src = work / top
        if d.exists():
            shutil.rmtree(d)
        d.parent.mkdir(parents=True, exist_ok=True)
        shutil.move(str(src), str(d))
    finally:
        shutil.rmtree(work, ignore_errors=True)
    marker.write_text(tag + "\n")
    log(f"ok      {repo} @ {sha[:12]}  {size:.1f} MiB tar.gz sha256:{digest}  "
        f"extracted -> {dest}  ({time.time() - t0:.1f}s)")


def main() -> int:
    failed = 0
    for repo, sha, dest, only in SOURCES:
        try:
            fetch(repo, sha, dest, only)
        except Exception as exc:
            failed += 1
            print(f"[fetch] FAILED {repo} @ {sha[:12]} -> {dest}: {type(exc).__name__}: {exc}", flush=True)
    raster = f"{REPO_ROOT}/RaDe-GS/submodules/diff-gaussian-rasterization/setup.py"
    glm = f"{REPO_ROOT}/RaDe-GS/submodules/diff-gaussian-rasterization/third_party/glm/glm/glm.hpp"
    print(f"[fetch] rasterizer source present: {os.path.exists(raster)}; glm present: {os.path.exists(glm)}",
          flush=True)
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
