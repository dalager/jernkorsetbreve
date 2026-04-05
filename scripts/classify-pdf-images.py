"""Interactive image classifier for extracted PDF images.

Usage:
    python scripts/classify-pdf-images.py              # Classify all uncategorized
    python scripts/classify-pdf-images.py --auto        # Auto-classify using heuristics
    python scripts/classify-pdf-images.py --review      # Review auto-classifications
    python scripts/classify-pdf-images.py --move        # Move classified files to category folders
    python scripts/classify-pdf-images.py --stats       # Show classification statistics

Categories:
    portrait  - Individual person photo
    group     - Multiple people in photo
    place     - Building, farm, landscape
    map       - Geographic map
    document  - Certificate, letter, sheet music, printed material
    historical- Historical figures, war scenes (not from Peter's personal collection)
    military  - Military scenes, fortifications, equipment
    skip      - Decorative, irrelevant, or too low quality
"""

import json
import shutil
import sys
from pathlib import Path

MANIFEST_PATH = Path("data/images/pdf-presentation/manifest.json")
PAGE_TEXTS_PATH = Path("data/images/pdf-presentation/page-texts.json")
UNCATEGORIZED = Path("data/images/pdf-presentation/uncategorized")
CATEGORIES = ["portrait", "group", "place", "map", "document", "historical", "military", "skip"]

# Known persons from person-registry.json
KNOWN_PERSONS = {
    "peter": ["Peter", "Peter Mærsk", "PM", "Peter M"],
    "trine": ["Trine", "Trine Gad", "Trine Kjems"],
    "far": ["Jes Mærsk", "Jes", "Peters far"],
    "mor": ["Maren Mærsk", "Maren og Jes", "Moder"],
    "uffe": ["Uffe", "Uffe Gad", "svoger"],
    "signe": ["Signe", "Signe Gad"],
    "konow": ["Konow", "Konov"],
    "major_beerbohm": ["Beerbohm", "Majoren", "den gamle"],
    "peter_andreas_gad": ["Peter Andreas", "Gad", "Trines far"],
    "henningsen": ["Henningsen", "Walter Henningsen"],
    "walter": ["Walter", "Walter H"],
}

# Known places
KNOWN_PLACES = {
    "oester_aabolling": ["Øster Aabølling", "Øster Åbølling", "Aabølling", "Åbølling"],
    "ravnholt": ["Ravnholt", "Ravnhold"],
    "vallekilde": ["Vallekilde"],
    "loetzen": ["Løtzen", "Lötzen", "Feste Boyen", "Fæstningen"],
    "arys": ["Arys"],
    "lyk": ["Lyk", "Lyck"],
    "kongeaaen": ["Kongeåen", "Grænsen"],
    "braunsberg": ["Braunsberg"],
    "laon": ["Laon", "Katedralen"],
    "cessieres": ["Cessieres", "Cessières"],
    "viviase": ["Viviase"],
    "grandlup": ["Grandlup"],
    "baekgaarden": ["Bækgaarden", "Bækgården"],
}


def load_manifest():
    return json.load(open(MANIFEST_PATH, encoding="utf-8"))


def save_manifest(manifest):
    with open(MANIFEST_PATH, "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2, ensure_ascii=False)


def load_page_texts():
    pages = json.load(open(PAGE_TEXTS_PATH, encoding="utf-8"))
    return {p["page"]: p["text"] for p in pages}


def detect_persons(text):
    """Find person IDs mentioned in the page text."""
    found = []
    for pid, aliases in KNOWN_PERSONS.items():
        for alias in aliases:
            if alias in text:
                found.append(pid)
                break
    return found


def detect_places(text):
    """Find place IDs mentioned in the page text."""
    found = []
    for plid, aliases in KNOWN_PLACES.items():
        for alias in aliases:
            if alias in text:
                found.append(plid)
                break
    return found


def auto_classify_entry(entry, page_text):
    """Heuristic auto-classification based on page text and image properties."""
    text = page_text.lower() if page_text else ""
    title = entry.get("page_text", "").lower()
    w, h = entry["width"], entry["height"]

    # Detect persons and places from page text
    full_text = entry.get("page_text", "") + " " + (page_text or "")
    entry["persons"] = detect_persons(full_text)
    entry["places"] = detect_places(full_text)

    # Maps tend to be large and have geographic terms
    map_terms = ["kort", "map", "grænse", "søer", "østpreussen", "frankrig", "europa",
                 "bromberg", "hannover", "stendal", "fronten"]
    if any(t in text for t in map_terms) and w > 800 and h > 500:
        if any(t in text for t in ["kort", "grænse", "østpreussen", "søer"]):
            return "map"

    # Documents: certificates, sheet music, printed material
    doc_terms = ["sangbog", "hjemstedsbevis", "spisesettel", "meddelelser", "noder"]
    if any(t in text for t in doc_terms):
        return "document"

    # Historical figures (not personal photos)
    hist_terms = ["kejser wilhelm", "zar nikolaj", "hindenburg", "ludendorff",
                  "franz ferdinand", "bismarck", "poincaré"]
    if any(t in text for t in hist_terms) and not entry["persons"]:
        return "historical"

    # Group photos
    group_terms = ["komp.", "kammerater", "fanger", "soldater"]
    if any(t in text for t in group_terms) and w > 600:
        return "group"

    # Portraits - smaller images with person names
    if entry["persons"] and w < 800 and h > w:
        return "portrait"

    # Place photos
    place_terms = ["gården", "hjem", "barndomshjem", "kirke", "slot", "katedra",
                   "bækgaard", "ravnholt", "vallekilde", "skyttegrav"]
    if any(t in text for t in place_terms):
        return "place"

    # Military scenes
    mil_terms = ["fæstning", "kanon", "skyttegrav", "lazaret", "angreb"]
    if any(t in text for t in mil_terms):
        return "military"

    # Default: leave uncategorized for manual review
    return "uncategorized"


def auto_classify():
    """Run heuristic auto-classification on all uncategorized images."""
    manifest = load_manifest()
    page_texts = load_page_texts()

    classified = 0
    for entry in manifest:
        if entry["category"] != "uncategorized":
            continue
        page_text = page_texts.get(entry["page"], "")
        category = auto_classify_entry(entry, page_text)
        if category != "uncategorized":
            entry["category"] = category
            classified += 1
            print(f"  {entry['filename']:25s} -> {category:12s} | persons: {entry['persons']} | places: {entry['places']}")

    save_manifest(manifest)

    remaining = sum(1 for e in manifest if e["category"] == "uncategorized")
    print(f"\nAuto-classified: {classified}")
    print(f"Remaining uncategorized: {remaining}")
    print(f"Run with --review to inspect, or --interactive to classify remaining manually")


def show_stats():
    """Show classification statistics."""
    manifest = load_manifest()
    from collections import Counter
    cats = Counter(e["category"] for e in manifest)
    print("Classification statistics:")
    print("-" * 40)
    for cat in CATEGORIES + ["uncategorized"]:
        count = cats.get(cat, 0)
        if count > 0:
            print(f"  {cat:15s}: {count:3d}")
    print("-" * 40)
    print(f"  {'total':15s}: {len(manifest):3d}")

    # Person mentions
    person_counts = {}
    for e in manifest:
        for p in e.get("persons", []):
            person_counts[p] = person_counts.get(p, 0) + 1
    if person_counts:
        print("\nPerson mentions in photos:")
        for p, c in sorted(person_counts.items(), key=lambda x: -x[1]):
            print(f"  {p:20s}: {c}")

    # Place mentions
    place_counts = {}
    for e in manifest:
        for p in e.get("places", []):
            place_counts[p] = place_counts.get(p, 0) + 1
    if place_counts:
        print("\nPlace mentions in photos:")
        for p, c in sorted(place_counts.items(), key=lambda x: -x[1]):
            print(f"  {p:20s}: {c}")


def review():
    """Show auto-classified entries for review."""
    manifest = load_manifest()
    for entry in manifest:
        if entry["category"] not in ("uncategorized",):
            cat = entry["category"]
            text_preview = entry.get("page_text", "")[:100].replace("\n", " ")
            print(f"  {entry['filename']:25s} [{cat:12s}] p:{entry['persons']} l:{entry['places']} | {text_preview}")


def interactive():
    """Interactive classification of remaining uncategorized images."""
    manifest = load_manifest()
    uncategorized = [e for e in manifest if e["category"] == "uncategorized"]

    if not uncategorized:
        print("All images are classified!")
        return

    print(f"\n{len(uncategorized)} images to classify.")
    print(f"Categories: {', '.join(CATEGORIES)}")
    print("Commands: <category>, s(kip), q(uit), p(ersons), l(ocation/places)")
    print("-" * 60)

    for i, entry in enumerate(uncategorized):
        print(f"\n[{i+1}/{len(uncategorized)}] {entry['filename']} ({entry['width']}x{entry['height']}, {entry['size_bytes']//1024}KB)")
        print(f"  Page {entry['page']}: {entry.get('page_text', '')[:200]}")
        print(f"  Auto-detected persons: {entry.get('persons', [])}")
        print(f"  Auto-detected places: {entry.get('places', [])}")

        while True:
            try:
                choice = input(f"  Category [{'/'.join(CATEGORIES)}]: ").strip().lower()
            except (EOFError, KeyboardInterrupt):
                save_manifest(manifest)
                print("\nSaved progress.")
                return

            if choice == "q":
                save_manifest(manifest)
                print("Saved progress.")
                return
            elif choice == "s":
                entry["category"] = "skip"
                break
            elif choice in CATEGORIES:
                entry["category"] = choice
                break
            elif choice.startswith("p "):
                # Add persons: p peter,trine
                persons = [p.strip() for p in choice[2:].split(",")]
                entry["persons"] = persons
                print(f"  Persons set to: {persons}")
            elif choice.startswith("l "):
                # Add places: l loetzen,arys
                places = [p.strip() for p in choice[2:].split(",")]
                entry["places"] = places
                print(f"  Places set to: {places}")
            elif choice.startswith("d "):
                # Add description
                entry["description"] = choice[2:]
                print(f"  Description set.")
            else:
                print(f"  Unknown. Use: {', '.join(CATEGORIES)}, s, q, p <ids>, l <ids>, d <text>")

    save_manifest(manifest)
    print("\nAll done! Run --stats to see results, --move to organize files.")


def move_files():
    """Move classified files from uncategorized/ to category subfolders."""
    manifest = load_manifest()
    base = Path("data/images/pdf-presentation")
    moved = 0

    for entry in manifest:
        cat = entry["category"]
        if cat in ("uncategorized", "skip"):
            continue

        src = UNCATEGORIZED / entry["filename"]
        dst_dir = base / cat
        dst_dir.mkdir(exist_ok=True)
        dst = dst_dir / entry["filename"]

        if src.exists() and not dst.exists():
            shutil.copy2(str(src), str(dst))
            moved += 1

    # Handle skips
    skip_dir = base / "removed"
    skip_dir.mkdir(exist_ok=True)
    skipped = 0
    for entry in manifest:
        if entry["category"] == "skip":
            src = UNCATEGORIZED / entry["filename"]
            if src.exists():
                shutil.move(str(src), str(skip_dir / entry["filename"]))
                skipped += 1

    print(f"Copied {moved} files to category folders")
    print(f"Moved {skipped} skipped files to removed/")


if __name__ == "__main__":
    args = sys.argv[1:]

    if "--auto" in args:
        auto_classify()
    elif "--review" in args:
        review()
    elif "--stats" in args:
        show_stats()
    elif "--move" in args:
        move_files()
    elif "--interactive" in args:
        interactive()
    else:
        print("Usage:")
        print("  --auto         Auto-classify using heuristics (run this first)")
        print("  --review       Review auto-classifications")
        print("  --stats        Show classification statistics")
        print("  --interactive  Manually classify remaining images")
        print("  --move         Move files to category subfolders")
