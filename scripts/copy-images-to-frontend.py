#!/usr/bin/env python3
"""
Copy classified images from data/images/ to apps/website/public/images/letters/
for static serving by Next.js.

Reads image-registry.json to determine what images exist and their paths, then copies
them incrementally. Skips files that already exist with matching size.

Usage:
    python scripts/copy-images-to-frontend.py              # Copy new/changed files
    python scripts/copy-images-to-frontend.py --clean      # Delete and re-copy everything
"""

import json
import shutil
import sys
from pathlib import Path
from typing import Dict, List, Tuple


def load_registry(registry_path: Path) -> List[Dict]:
    """Load and parse the image registry JSON."""
    if not registry_path.exists():
        print(f"Error: Registry file not found at {registry_path}")
        sys.exit(1)

    with open(registry_path, encoding='utf-8') as f:
        return json.load(f)


def copy_images(
    source_dir: Path,
    dest_dir: Path,
    registry: List[Dict],
    clean: bool = False
) -> Tuple[int, int, int]:
    """
    Copy images from source to destination based on registry.

    Returns:
        (copied, skipped, errors)
    """
    copied = 0
    skipped = 0
    errors = 0

    # Clean destination if requested
    if clean and dest_dir.exists():
        print(f"Cleaning {dest_dir}...")
        shutil.rmtree(dest_dir)

    dest_dir.mkdir(parents=True, exist_ok=True)

    for entry in registry:
        rel_path = entry.get("path")
        if not rel_path:
            print(f"Warning: Entry missing 'path' field: {entry.get('id', 'unknown')}")
            continue

        src_file = source_dir / rel_path
        dest_file = dest_dir / rel_path

        # Create category subdirectories
        dest_file.parent.mkdir(parents=True, exist_ok=True)

        # Check if file exists and has same size
        if dest_file.exists():
            src_size = src_file.stat().st_size if src_file.exists() else -1
            dest_size = dest_file.stat().st_size

            if src_size == dest_size:
                skipped += 1
                continue

        # Copy the file
        if src_file.exists():
            try:
                shutil.copy2(src_file, dest_file)
                copied += 1
                print(f"Copied: {rel_path}")
            except Exception as e:
                errors += 1
                print(f"Error copying {rel_path}: {e}")
        else:
            errors += 1
            print(f"Error: Source file not found: {src_file}")

    return copied, skipped, errors


def copy_data_files(
    source_dir: Path,
    dest_dir: Path
) -> Tuple[bool, bool]:
    """
    Copy letter-images.json and image-registry.json to public/data/.

    Returns:
        (letter_images_ok, registry_ok)
    """
    dest_dir.mkdir(parents=True, exist_ok=True)

    files_ok = [True, True]

    # Copy letter-images.json
    src = source_dir / "letter-images.json"
    dst = dest_dir / "letter-images.json"
    try:
        if src.exists():
            shutil.copy2(src, dst)
            print(f"Copied: {dst.relative_to(source_dir.parent.parent.parent)}")
        else:
            print(f"Warning: {src} not found")
            files_ok[0] = False
    except Exception as e:
        print(f"Error copying letter-images.json: {e}")
        files_ok[0] = False

    # Copy image-registry.json
    src = source_dir / "image-registry.json"
    dst = dest_dir / "image-registry.json"
    try:
        if src.exists():
            shutil.copy2(src, dst)
            print(f"Copied: {dst.relative_to(source_dir.parent.parent.parent)}")
        else:
            print(f"Warning: {src} not found")
            files_ok[1] = False
    except Exception as e:
        print(f"Error copying image-registry.json: {e}")
        files_ok[1] = False

    return tuple(files_ok)


def main():
    """Main entry point."""
    clean = "--clean" in sys.argv

    # Resolve paths relative to script location
    script_dir = Path(__file__).parent
    project_root = script_dir.parent

    source_images = project_root / "data" / "images"
    dest_images = project_root / "apps" / "website" / "public" / "images" / "letters"
    dest_data = project_root / "apps" / "website" / "public" / "data"
    registry_path = project_root / "data" / "image-registry.json"
    source_data = project_root / "data"

    # Validate source directory
    if not source_images.exists():
        print(f"Error: Source directory not found: {source_images}")
        sys.exit(1)

    print(f"Source: {source_images}")
    print(f"Destination: {dest_images}")

    # Load registry
    print("\nLoading image registry...")
    registry = load_registry(registry_path)
    print(f"Found {len(registry)} images in registry")

    # Copy images
    print(f"\nCopying images {'(--clean mode)' if clean else '(incremental)'}...")
    copied, skipped, errors = copy_images(source_images, dest_images, registry, clean)

    # Copy data files
    print("\nCopying data files...")
    letter_images_ok, registry_ok = copy_data_files(source_data, dest_data)

    # Print summary
    print("\n" + "=" * 60)
    print("SUMMARY")
    print("=" * 60)
    print(f"Images copied:     {copied}")
    print(f"Images skipped:    {skipped}")
    print(f"Errors:            {errors}")
    print(f"Total processed:   {copied + skipped + errors}")
    if letter_images_ok and registry_ok:
        print("Data files:        OK")
    else:
        print("Data files:        PARTIAL")
    print("=" * 60)

    if errors > 0:
        sys.exit(1)


if __name__ == "__main__":
    main()
