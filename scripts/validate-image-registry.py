"""Validate the canonical image registry at data/image-registry.json.

Usage:
    python scripts/validate-image-registry.py           # Validate
    python scripts/validate-image-registry.py --fix     # Auto-fix what can be fixed

Checks:
  1. Schema validation      — required fields, types, allowed values
  2. File existence         — data/images/{path} on disk
  3. Orphan detection       — images on disk not in registry
  4. Person ID validation   — persons[] ids exist in person-registry.json
  5. Place ID validation    — places[] ids exist in place-photo-links or place-image-lookup
  6. Completeness report    — description_da, date_sort, empty persons, empty places
  7. Summary                — pass/fail with counts
"""

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
IMAGES_DIR = DATA / "images"
REGISTRY_PATH = DATA / "image-registry.json"
PERSON_REG_PATH = DATA / "person-registry.json"
PLACE_LINKS_PATH = DATA / "place-photo-links.json"
PLACE_LOOKUP_PATH = DATA / "place-image-lookup.json"

VALID_CATEGORIES = {"portrait", "group", "place", "map", "document", "historical", "military"}
REQUIRED_FIELDS = {
    "id": str,
    "filename": str,
    "path": str,
    "category": str,
    "persons": list,
    "places": list,
    "description": str,
    "source": str,
    "width": int,
    "height": int,
    "size_bytes": int,
}


def load_json(path: Path) -> object:
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def load_registry():
    if not REGISTRY_PATH.exists():
        print(f"ERROR: registry not found at {REGISTRY_PATH}")
        sys.exit(1)
    return load_json(REGISTRY_PATH)


def load_known_person_ids() -> set:
    if not PERSON_REG_PATH.exists():
        print(f"WARNING: person-registry not found at {PERSON_REG_PATH}")
        return set()
    persons = load_json(PERSON_REG_PATH)
    return {p["id"] for p in persons}


def load_known_place_ids() -> set:
    ids = set()
    if PLACE_LINKS_PATH.exists():
        data = load_json(PLACE_LINKS_PATH)
        ids.update(data.get("place_mapping", {}).keys())
    if PLACE_LOOKUP_PATH.exists():
        data = load_json(PLACE_LOOKUP_PATH)
        ids.update(data.keys())
    return ids


def validate_schema(entries: list) -> list[str]:
    errors = []
    for i, entry in enumerate(entries):
        label = entry.get("id", f"entry[{i}]")
        # Required fields with correct types
        for field, expected_type in REQUIRED_FIELDS.items():
            if field not in entry:
                errors.append(f"{label}: missing required field '{field}'")
            elif not isinstance(entry[field], expected_type):
                errors.append(
                    f"{label}: field '{field}' has type {type(entry[field]).__name__}, expected {expected_type.__name__}"
                )
        # id prefix
        entry_id = entry.get("id", "")
        if entry_id and not entry_id.startswith("img_"):
            errors.append(f"{label}: id '{entry_id}' does not start with 'img_'")
        # category
        cat = entry.get("category", "")
        if cat and cat not in VALID_CATEGORIES:
            errors.append(f"{label}: category '{cat}' not in allowed set {VALID_CATEGORIES}")
        # description non-empty
        desc = entry.get("description", "")
        if isinstance(desc, str) and desc.strip() == "":
            errors.append(f"{label}: description is empty")
    return errors


def check_file_existence(entries: list) -> list[str]:
    missing = []
    for entry in entries:
        path = entry.get("path", "")
        if not path:
            continue
        full_path = IMAGES_DIR / path
        if not full_path.exists():
            missing.append(f"{entry.get('id', '?')}: file not found at data/images/{path}")
    return missing


def find_orphans(entries: list) -> list[str]:
    registered_paths = {entry["path"] for entry in entries if "path" in entry}
    orphans = []
    for category in VALID_CATEGORIES:
        cat_dir = IMAGES_DIR / category
        if not cat_dir.is_dir():
            continue
        for img_file in sorted(cat_dir.glob("*.png")):
            rel_path = f"{category}/{img_file.name}"
            if rel_path not in registered_paths:
                orphans.append(rel_path)
    return orphans


def validate_person_ids(entries: list, known_ids: set) -> list[str]:
    errors = []
    for entry in entries:
        label = entry.get("id", "?")
        for pid in entry.get("persons", []):
            if pid not in known_ids:
                errors.append(f"{label}: unknown person id '{pid}'")
    return errors


def validate_place_ids(entries: list, known_ids: set) -> list[str]:
    errors = []
    for entry in entries:
        label = entry.get("id", "?")
        for plid in entry.get("places", []):
            if plid not in known_ids:
                errors.append(f"{label}: unknown place id '{plid}'")
    return errors


def completeness_report(entries: list) -> dict:
    total = len(entries)
    with_desc_da = sum(1 for e in entries if e.get("description_da", "").strip())
    with_date_sort = sum(1 for e in entries if e.get("date_sort", "").strip())
    empty_persons = sum(1 for e in entries if not e.get("persons"))
    empty_places = sum(1 for e in entries if not e.get("places"))
    return {
        "total": total,
        "with_description_da": with_desc_da,
        "without_description_da": total - with_desc_da,
        "with_date_sort": with_date_sort,
        "without_date_sort": total - with_date_sort,
        "empty_persons": empty_persons,
        "empty_places": empty_places,
    }


def fix_missing_paths(entries: list) -> int:
    """Auto-fix entries where path is wrong but file exists under category dir."""
    fixed = 0
    for entry in entries:
        path = entry.get("path", "")
        if not path:
            continue
        full_path = IMAGES_DIR / path
        if full_path.exists():
            continue
        # Try to find the file by filename under category dir
        filename = entry.get("filename", "")
        category = entry.get("category", "")
        if filename and category:
            candidate = IMAGES_DIR / category / filename
            if candidate.exists():
                old_path = path
                entry["path"] = f"{category}/{filename}"
                print(f"  FIX {entry['id']}: path {old_path!r} -> {entry['path']!r}")
                fixed += 1
    return fixed


def save_registry(entries: list):
    with open(REGISTRY_PATH, "w", encoding="utf-8") as f:
        json.dump(entries, f, indent=2, ensure_ascii=False)


def print_section(title: str, items: list, limit: int = 20):
    print(f"\n--- {title} ({len(items)}) ---")
    for item in items[:limit]:
        print(f"  {item}")
    if len(items) > limit:
        print(f"  ... and {len(items) - limit} more")


def main():
    parser = argparse.ArgumentParser(description="Validate data/image-registry.json")
    parser.add_argument("--fix", action="store_true", help="Auto-fix what can be fixed")
    args = parser.parse_args()

    entries = load_registry()
    known_person_ids = load_known_person_ids()
    known_place_ids = load_known_place_ids()

    print(f"Validating {REGISTRY_PATH.relative_to(ROOT)}")
    print(f"  {len(entries)} entries")
    print(f"  {len(known_person_ids)} known person ids")
    print(f"  {len(known_place_ids)} known place ids")

    if args.fix:
        fixed = fix_missing_paths(entries)
        if fixed:
            save_registry(entries)
            print(f"\nFixed {fixed} path(s) and saved registry.")
            # Reload after fix
            entries = load_registry()

    schema_errors = validate_schema(entries)
    missing_files = check_file_existence(entries)
    orphans = find_orphans(entries)
    person_errors = validate_person_ids(entries, known_person_ids)
    place_errors = validate_place_ids(entries, known_place_ids)
    report = completeness_report(entries)

    if schema_errors:
        print_section("SCHEMA ERRORS", schema_errors)
    if missing_files:
        print_section("MISSING FILES", missing_files)
    if orphans:
        print_section("ORPHAN FILES (on disk, not in registry)", orphans)
    if person_errors:
        print_section("UNKNOWN PERSON IDs", person_errors)
    if place_errors:
        print_section("UNKNOWN PLACE IDs", place_errors)

    print("\n--- COMPLETENESS ---")
    print(f"  Total entries:          {report['total']}")
    print(f"  With description_da:    {report['with_description_da']} / {report['total']}")
    print(f"  Without description_da: {report['without_description_da']}")
    print(f"  With date_sort:         {report['with_date_sort']} / {report['total']}")
    print(f"  Without date_sort:      {report['without_date_sort']}")
    print(f"  Empty persons array:    {report['empty_persons']}")
    print(f"  Empty places array:     {report['empty_places']}")

    all_errors = schema_errors + missing_files + person_errors + place_errors
    total_warnings = len(orphans)

    print("\n--- SUMMARY ---")
    if all_errors:
        print(f"  FAIL — {len(all_errors)} error(s), {total_warnings} warning(s)")
        sys.exit(1)
    else:
        print(f"  PASS — 0 errors, {total_warnings} warning(s)")


if __name__ == "__main__":
    main()
