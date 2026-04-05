"""Remove duplicate and background images from the PDF extraction.

Usage:
    python scripts/dedup-pdf-images.py

Identifies exact-duplicate images (by MD5 hash) and removes copies,
keeping only the first occurrence. Moves removed files to a 'removed/' subfolder.
Updates manifest.json accordingly.
"""

import hashlib
import json
import shutil
from pathlib import Path

MANIFEST_PATH = Path("data/images/pdf-presentation/manifest.json")
UNCATEGORIZED = Path("data/images/pdf-presentation/uncategorized")
REMOVED_DIR = Path("data/images/pdf-presentation/removed")


def dedup():
    REMOVED_DIR.mkdir(exist_ok=True)

    manifest = json.load(open(MANIFEST_PATH, encoding="utf-8"))

    # Hash all images
    hashes = {}
    for entry in manifest:
        fp = UNCATEGORIZED / entry["filename"]
        if not fp.exists():
            continue
        h = hashlib.md5(fp.read_bytes()).hexdigest()
        hashes.setdefault(h, []).append(entry)

    keep = []
    removed = []

    for h, entries in hashes.items():
        if len(entries) == 1:
            keep.append(entries[0])
            continue

        # Check if this is the slide background (720x540, ~236KB)
        first = entries[0]
        is_background = first["width"] == 720 and first["height"] == 540 and first["size_bytes"] < 250000

        if is_background:
            # Remove ALL copies of the background
            for entry in entries:
                fp = UNCATEGORIZED / entry["filename"]
                if fp.exists():
                    shutil.move(str(fp), str(REMOVED_DIR / entry["filename"]))
                entry["category"] = "removed_background"
                removed.append(entry)
            print(f"Removed {len(entries)} slide backgrounds (md5:{h[:8]})")
        else:
            # Keep first, remove duplicates
            keep.append(entries[0])
            for entry in entries[1:]:
                fp = UNCATEGORIZED / entry["filename"]
                if fp.exists():
                    shutil.move(str(fp), str(REMOVED_DIR / entry["filename"]))
                entry["category"] = "removed_duplicate"
                entry["duplicate_of"] = entries[0]["filename"]
                removed.append(entry)
            print(f"Kept {entries[0]['filename']}, removed {len(entries)-1} duplicate(s) (md5:{h[:8]})")

    # Save updated manifest (only kept images)
    with open(MANIFEST_PATH, "w", encoding="utf-8") as f:
        json.dump(keep, f, indent=2, ensure_ascii=False)

    # Save removed log
    removed_log = Path("data/images/pdf-presentation/removed.json")
    with open(removed_log, "w", encoding="utf-8") as f:
        json.dump(removed, f, indent=2, ensure_ascii=False)

    print(f"\nKept: {len(keep)} unique images")
    print(f"Removed: {len(removed)} ({sum(1 for r in removed if r['category']=='removed_background')} backgrounds, "
          f"{sum(1 for r in removed if r['category']=='removed_duplicate')} duplicates)")


if __name__ == "__main__":
    dedup()
