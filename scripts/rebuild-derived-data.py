"""Rebuild all derived data files (pages + image links) and copy to frontend.

Usage:
    python scripts/rebuild-derived-data.py          # Rebuild everything
    python scripts/rebuild-derived-data.py --quick   # Skip image copy (data only)

Run this after editing:
  - data/image-registry.json
  - data/place-photo-links.json
  - data/person-registry.json
"""

import subprocess
import sys
import time
from pathlib import Path

PYTHON = sys.executable
SCRIPTS = [
    ("Letter-image links", "scripts/build-letter-images.py"),
    ("Person pages", "scripts/build-person-pages-data.py"),
    ("Place pages", "scripts/build-place-pages-data.py"),
]
COPY_SCRIPT = ("Copy to frontend", "scripts/copy-images-to-frontend.py")


def run(label, script):
    print(f"\n{'='*50}")
    print(f"  {label}")
    print(f"{'='*50}")
    result = subprocess.run(
        [PYTHON, script],
        capture_output=False,
        text=True,
    )
    if result.returncode != 0:
        print(f"  FAILED (exit code {result.returncode})")
        return False
    return True


def main():
    quick = "--quick" in sys.argv
    start = time.time()
    failed = []

    for label, script in SCRIPTS:
        if not run(label, script):
            failed.append(label)

    if not quick:
        if not run(*COPY_SCRIPT):
            failed.append(COPY_SCRIPT[0])

    elapsed = time.time() - start
    print(f"\n{'='*50}")
    if failed:
        print(f"  DONE with errors: {', '.join(failed)}")
    else:
        steps = len(SCRIPTS) + (0 if quick else 1)
        print(f"  ALL DONE — {steps} steps in {elapsed:.1f}s")
    print(f"{'='*50}")


if __name__ == "__main__":
    main()
