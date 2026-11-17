#!/usr/bin/env python3
"""splat-lab g1 — download + verify the input pictures for the LGM run.

Reads inputs.json (same folder), keeps every file in $DATA/in/g1/<name>.<ext> so re-runs are
free, and writes a provenance manifest (resolved path, sha256, crop, licence, credit, source
URL) to $OUT/inputs-manifest.json. A sha256 mismatch is a warning, not a failure: Wikimedia
re-renders the /thumb/ URLs occasionally, and the recorded digest in the manifest is what the
README quotes.

Used by run.sh; runnable by hand with the same env:
    IN_DIR=/data/in/g1 OUT=/data/out/g1-1 python fetch_inputs.py
"""

import datetime
import hashlib
import json
import os
import sys
import time

import requests

HERE = os.path.dirname(os.path.abspath(__file__))
UA = "Mozilla/5.0 (X11; Linux x86_64) splat-lab-lgm/1.0 (research asset fetch)"


def log(msg: str) -> None:
    print(f"[inputs {datetime.datetime.utcnow():%H:%M:%S}] {msg}", file=sys.stderr, flush=True)


def sha256_file(path: str) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def main() -> int:
    in_dir = os.environ.get("IN_DIR", "/data/in/g1")
    out = os.environ.get("OUT", "/tmp/g1-inputs")
    spec = os.environ.get("INPUTS_JSON", os.path.join(HERE, "inputs.json"))
    want_tsv = "--tsv" in sys.argv
    os.makedirs(in_dir, exist_ok=True)
    os.makedirs(out, exist_ok=True)

    with open(spec) as f:
        cfg = json.load(f)

    manifest = []
    for item in cfg["inputs"]:
        name = item["name"]
        url = item["url"]
        ext = os.path.splitext(url)[1] or ".jpg"
        path = os.path.join(in_dir, name + ext)
        if os.path.exists(path) and os.path.getsize(path) > 0:
            log(f"{name}: cached {path} ({os.path.getsize(path) / 2**10:.0f} KiB)")
        else:
            t0 = time.perf_counter()
            r = requests.get(url, headers={"User-Agent": UA}, timeout=120)
            r.raise_for_status()
            with open(path + ".part", "wb") as f:
                f.write(r.content)
            os.replace(path + ".part", path)
            log(f"{name}: downloaded {len(r.content) / 2**10:.0f} KiB in "
                f"{time.perf_counter() - t0:.1f}s -> {path}")

        got = sha256_file(path)
        want = item.get("sha256")
        ok = (got == want)
        if not ok:
            log(f"WARN {name}: sha256 {got[:16]}… != recorded {str(want)[:16]}… "
                f"(source re-rendered? recording the measured digest)")
        manifest.append({
            "name": name,
            "path": path,
            "bytes": os.path.getsize(path),
            "sha256": got,
            "sha256_matches_record": ok,
            "url": url,
            "page": item.get("page"),
            "license": item.get("license"),
            "artist": item.get("artist"),
            "credit": item.get("credit"),
            "note": item.get("note"),
            "crop": item.get("crop"),
        })
        log(f"{name}: {got[:16]}… ok={ok} license={item.get('license')} crop={item.get('crop')}")

    dest = os.path.join(out, "inputs-manifest.json")
    with open(dest, "w") as f:
        json.dump({"fetched_utc": datetime.datetime.utcnow().isoformat(timespec="seconds") + "Z",
                   "inputs": manifest}, f, indent=2)
    log(f"wrote {dest}")

    # run.sh needs the paths as shell variables and this image has no awk: write assignments for it.
    env_path = os.path.join(out, "inputs.env")
    with open(env_path, "w") as f:
        f.write("# written by fetch_inputs.py — sourced by run.sh (single-quoted, no escaping games)\n")
        for m in manifest:
            if not m["name"].replace("_", "a", 1).isidentifier():
                raise SystemExit(f"input name {m['name']!r} is not a shell identifier suffix")
            crop = ",".join(str(c) for c in m["crop"]) if m["crop"] else ""
            f.write(f"IN_{m['name']}='{m['path']}'\nCROP_{m['name']}='{crop}'\n")
    log(f"wrote {env_path}")

    if want_tsv:  # provenance table in the log: name<TAB>path<TAB>crop(or empty)
        for m in manifest:
            print(f"{m['name']}\t{m['path']}\t"
                  f"{','.join(str(c) for c in m['crop']) if m['crop'] else ''}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
