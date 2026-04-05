#!/usr/bin/env python3
"""
Optimize images for web: convert PNG → WebP at two sizes (thumb + full).

Reads image-registry.json, processes each image from data/images/ and writes
optimized WebP files to apps/website/public/images/letters/.

Output structure:
    apps/website/public/images/letters/thumb/<category>/<filename>.webp  (400px wide)
    apps/website/public/images/letters/full/<category>/<filename>.webp   (1200px wide)

Usage:
    python scripts/optimize-images-for-web.py              # Incremental (skip existing)
    python scripts/optimize-images-for-web.py --clean      # Re-process everything
    python scripts/optimize-images-for-web.py --dry-run    # Show what would be done
"""

import json
import shutil
import sys
from pathlib import Path
from PIL import Image

THUMB_MAX_WIDTH = 400
FULL_MAX_WIDTH = 1200
WEBP_QUALITY = 82


def load_registry(registry_path: Path) -> list[dict]:
    if not registry_path.exists():
        print(f"Error: Registry file not found at {registry_path}")
        sys.exit(1)
    with open(registry_path, encoding="utf-8") as f:
        return json.load(f)


def convert_image(src: Path, dst: Path, max_width: int) -> bool:
    """Resize and convert a single image to WebP. Returns True on success."""
    try:
        with Image.open(src) as img:
            # Convert to RGB if necessary (e.g. RGBA PNGs)
            if img.mode in ("RGBA", "P"):
                img = img.convert("RGB")

            # Only downscale, never upscale
            if img.width > max_width:
                ratio = max_width / img.width
                new_size = (max_width, int(img.height * ratio))
                img = img.resize(new_size, Image.LANCZOS)

            dst.parent.mkdir(parents=True, exist_ok=True)
            img.save(dst, "WEBP", quality=WEBP_QUALITY, method=4)
        return True
    except Exception as e:
        print(f"  Error processing {src}: {e}")
        return False


def process_images(
    source_dir: Path,
    dest_dir: Path,
    registry: list[dict],
    clean: bool = False,
    dry_run: bool = False,
) -> dict:
    stats = {"thumb_created": 0, "full_created": 0, "skipped": 0, "errors": 0}

    if clean and not dry_run:
        for subdir in ("thumb", "full"):
            target = dest_dir / subdir
            if target.exists():
                print(f"Cleaning {target}...")
                shutil.rmtree(target)

    for entry in registry:
        rel_path = entry.get("path")
        if not rel_path:
            continue

        src_file = source_dir / rel_path
        if not src_file.exists():
            stats["errors"] += 1
            print(f"  Missing: {src_file}")
            continue

        # Change extension to .webp
        webp_rel = Path(rel_path).with_suffix(".webp")
        thumb_dst = dest_dir / "thumb" / webp_rel
        full_dst = dest_dir / "full" / webp_rel

        # Skip if both already exist (incremental mode)
        if not clean and thumb_dst.exists() and full_dst.exists():
            stats["skipped"] += 1
            continue

        if dry_run:
            print(f"  Would process: {rel_path}")
            stats["thumb_created"] += 1
            stats["full_created"] += 1
            continue

        # Generate thumb
        if clean or not thumb_dst.exists():
            if convert_image(src_file, thumb_dst, THUMB_MAX_WIDTH):
                stats["thumb_created"] += 1
            else:
                stats["errors"] += 1

        # Generate full
        if clean or not full_dst.exists():
            if convert_image(src_file, full_dst, FULL_MAX_WIDTH):
                stats["full_created"] += 1
            else:
                stats["errors"] += 1

    return stats


def copy_data_files(data_dir: Path, dest_data: Path):
    """Copy JSON data files needed by the frontend."""
    dest_data.mkdir(parents=True, exist_ok=True)
    for name in ("letter-images.json", "image-registry.json"):
        src = data_dir / name
        dst = dest_data / name
        if src.exists():
            shutil.copy2(src, dst)
            print(f"  Copied: {name}")


def main():
    clean = "--clean" in sys.argv
    dry_run = "--dry-run" in sys.argv

    script_dir = Path(__file__).parent
    project_root = script_dir.parent

    source_images = project_root / "data" / "images"
    dest_images = project_root / "apps" / "website" / "public" / "images" / "letters"
    dest_data = project_root / "apps" / "website" / "public" / "data"
    registry_path = project_root / "data" / "image-registry.json"

    if not source_images.exists():
        print(f"Error: Source directory not found: {source_images}")
        sys.exit(1)

    print("Loading image registry...")
    registry = load_registry(registry_path)
    print(f"Found {len(registry)} images in registry\n")

    mode = "dry-run" if dry_run else ("clean" if clean else "incremental")
    print(f"Processing images ({mode})...")
    print(f"  Source:  {source_images}")
    print(f"  Output:  {dest_images}/{{thumb,full}}/")
    print(f"  Thumb:   {THUMB_MAX_WIDTH}px, WebP q{WEBP_QUALITY}")
    print(f"  Full:    {FULL_MAX_WIDTH}px, WebP q{WEBP_QUALITY}\n")

    stats = process_images(source_images, dest_images, registry, clean, dry_run)

    if not dry_run:
        print("\nCopying data files...")
        copy_data_files(project_root / "data", dest_data)

    # Summary
    print("\n" + "=" * 50)
    print("SUMMARY")
    print("=" * 50)
    print(f"  Thumbnails created: {stats['thumb_created']}")
    print(f"  Full-size created:  {stats['full_created']}")
    print(f"  Skipped (exist):    {stats['skipped']}")
    print(f"  Errors:             {stats['errors']}")

    # Show output size
    if not dry_run:
        total_bytes = 0
        for subdir in ("thumb", "full"):
            d = dest_images / subdir
            if d.exists():
                size = sum(f.stat().st_size for f in d.rglob("*") if f.is_file())
                total_bytes += size
                print(f"  {subdir}/ size:          {size / 1024 / 1024:.1f} MB")
        print(f"  Total WebP size:    {total_bytes / 1024 / 1024:.1f} MB")

    print("=" * 50)

    if stats["errors"] > 0:
        sys.exit(1)


if __name__ == "__main__":
    main()
