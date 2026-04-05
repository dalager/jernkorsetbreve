"""
Build place-pages.json for place detail pages (ADR-049).

Reads:
  data/places.geojson
  data/places-enriched.json
  data/images/pdf-presentation/place-photo-links.json
  data/image-registry.json
  data/corrected-letters.json

Writes:
  data/place-pages.json
  apps/website/public/data/place-pages.json  (copy)
"""

import json
import re
import shutil
import unicodedata
from pathlib import Path

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------

BASE = Path(__file__).parent.parent
DATA = BASE / "data"
GEOJSON_PATH = DATA / "places.geojson"
ENRICHED_PATH = DATA / "places-enriched.json"
PHOTO_LINKS_PATH = DATA / "place-photo-links.json"
IMAGE_REGISTRY_PATH = DATA / "image-registry.json"
LETTERS_PATH = DATA / "corrected-letters.json"
OUTPUT_PATH = DATA / "place-pages.json"
FRONTEND_OUTPUT = BASE / "apps" / "website" / "public" / "data" / "place-pages.json"

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

SPECIAL_CHAR_MAP = {
    "ø": "o",
    "Ø": "O",
    "æ": "ae",
    "Æ": "Ae",
    "å": "aa",
    "Å": "Aa",
    "ö": "o",
    "Ö": "O",
    "ä": "a",
    "Ä": "A",
    "ü": "u",
    "Ü": "U",
    "ß": "ss",
}


def strip_diacritics(text: str) -> str:
    """Replace known special characters and strip remaining diacritics."""
    for ch, replacement in SPECIAL_CHAR_MAP.items():
        text = text.replace(ch, replacement)
    # Strip any remaining combining diacritical marks
    normalized = unicodedata.normalize("NFD", text)
    stripped = "".join(c for c in normalized if unicodedata.category(c) != "Mn")
    return stripped


def slugify(name: str) -> str:
    """Slugify a place name to a URL-safe ID.

    - Strip diacritics and special characters
    - Lowercase
    - Replace spaces, parentheses, commas, slashes and similar with underscores
    - Collapse repeated underscores
    - Strip leading/trailing underscores
    """
    s = strip_diacritics(name.strip())
    s = s.lower()
    # Replace non-alphanumeric characters (except underscores) with underscore
    s = re.sub(r"[^a-z0-9]+", "_", s)
    s = re.sub(r"_+", "_", s)
    s = s.strip("_")
    return s


def make_excerpt(text: str, max_chars: int = 200) -> str:
    """Return the first sentence or up to max_chars of text."""
    if not text:
        return ""
    # Take the first non-empty line
    first_line = next((l.strip() for l in text.splitlines() if l.strip()), "")
    if not first_line:
        return ""
    if len(first_line) <= max_chars:
        return first_line
    return first_line[:max_chars].rsplit(" ", 1)[0] + "..."


# ---------------------------------------------------------------------------
# Step 1: Ensure Ravnholt and Kongeåen are in places.geojson
# ---------------------------------------------------------------------------

def ensure_places_in_geojson():
    """Add Ravnholt and Kongeåen to places.geojson if not already present."""
    with open(GEOJSON_PATH, encoding="utf-8") as f:
        geojson = json.load(f)

    existing_names = {
        feat["properties"].get("place", "").strip().lower()
        for feat in geojson["features"]
    }

    places_to_add = [
        {
            "name": "Ravnholt",
            "lat": 55.18,
            "lng": 8.85,
            "place_id": 76,
        },
        {
            "name": "Kongeåen",
            "lat": 55.43,
            "lng": 9.28,
            "place_id": 77,
        },
    ]

    added = []
    for entry in places_to_add:
        if entry["name"].lower() not in existing_names:
            feature = {
                "type": "Feature",
                "properties": {
                    "place_id": entry["place_id"],
                    "place": entry["name"],
                },
                "geometry": {
                    "type": "Point",
                    "coordinates": [entry["lng"], entry["lat"]],
                },
            }
            geojson["features"].append(feature)
            added.append(entry["name"])
            print(f"  Added to places.geojson: {entry['name']}")

    if added:
        with open(GEOJSON_PATH, "w", encoding="utf-8") as f:
            json.dump(geojson, f, ensure_ascii=False, indent=2)
        print(f"  Saved updated places.geojson ({len(geojson['features'])} features)")
    else:
        print("  Ravnholt and Kongeåen already present in places.geojson")

    return geojson


# ---------------------------------------------------------------------------
# Step 2: Load all source data
# ---------------------------------------------------------------------------

def load_data(geojson):
    with open(ENRICHED_PATH, encoding="utf-8") as f:
        enriched = json.load(f)

    with open(PHOTO_LINKS_PATH, encoding="utf-8") as f:
        photo_links_raw = json.load(f)
    place_mapping = photo_links_raw.get("place_mapping", photo_links_raw)

    with open(IMAGE_REGISTRY_PATH, encoding="utf-8") as f:
        image_registry = json.load(f)

    with open(LETTERS_PATH, encoding="utf-8") as f:
        letters = json.load(f)

    return enriched, place_mapping, image_registry, letters


# ---------------------------------------------------------------------------
# Step 3: Build place-id mapping from photo-links keys
# ---------------------------------------------------------------------------

def build_place_id_map(geojson_features, place_mapping):
    """Return a dict mapping geojson place name -> short place ID.

    Priority:
    1. place_mapping entries that:
       - have a geojson_key matching this feature, AND
       - are primary place entries (NOT named locations with aliases+letter_references)
    2. place_mapping entries whose short key matches the slugified geojson name
       (handles cases like kongeaaen where geojson_key is null)
    3. Slugified geojson name as fallback
    """
    # Index: geojson_key -> photo-links short key (primary entries only)
    geojson_key_to_short = {}
    for short_key, entry in place_mapping.items():
        # Skip named-location sub-entries (they have both aliases and letter_references)
        if "aliases" in entry and "letter_references" in entry:
            continue
        gk = entry.get("geojson_key")
        if gk:
            geojson_key_to_short[gk.strip()] = short_key

    # Build set of all place_mapping short keys for slug-based matching
    pm_short_keys = set(place_mapping.keys())

    place_id_map = {}  # geojson name -> short id
    for feat in geojson_features:
        name = feat["properties"].get("place", "").strip()
        if name in geojson_key_to_short:
            place_id_map[name] = geojson_key_to_short[name]
        else:
            slug = slugify(name)
            # Check if the slug matches a place_mapping key directly
            if slug in pm_short_keys:
                place_id_map[name] = slug
            else:
                place_id_map[name] = slug

    return place_id_map


# ---------------------------------------------------------------------------
# Step 4: Build image lookup by place short-id
# ---------------------------------------------------------------------------

def build_image_lookup(image_registry):
    """Return dict: place_short_id -> list of image objects."""
    lookup = {}
    for img in image_registry:
        for place_id in img.get("places", []):
            lookup.setdefault(place_id, []).append(img)
    return lookup


# ---------------------------------------------------------------------------
# Step 5: Build letter lookup by geojson place name
# ---------------------------------------------------------------------------

def build_letter_lookup(letters):
    """Return dict: letter place value -> list of letters (keyed by original place string)."""
    lookup = {}
    for letter in letters:
        place = (letter.get("place") or "").strip()
        if place:
            lookup.setdefault(place, []).append(letter)
    return lookup


def collect_letters_for_place(name, aliases, letter_lookup):
    """Collect all letters matching a geojson place name or any of its aliases.

    Uses both exact matching and slugified matching to handle minor
    spelling differences (e.g. Gizycko vs Giżycko).
    """
    matched = {}  # letter_id -> letter (dedup)

    # Build a set of candidate keys: exact name, aliases, and slug-normalized forms
    candidates = {name}
    for alias in aliases:
        candidates.add(alias.strip())

    name_slug = slugify(name)

    for letter_place, letters in letter_lookup.items():
        if letter_place in candidates:
            for l in letters:
                matched[l["id"]] = l
        elif slugify(letter_place) == name_slug:
            for l in letters:
                matched[l["id"]] = l

    return list(matched.values())


# ---------------------------------------------------------------------------
# Step 6: Find named locations (sub-entries in place_mapping)
# ---------------------------------------------------------------------------

def build_named_locations_for_geojson_key(place_mapping, geojson_name):
    """Return list of named_location objects for entries that:
    - have the same geojson_key as geojson_name
    - have both aliases and letter_references fields
    - are NOT the primary place entry (i.e. are named locations within the place)
    """
    named_locations = []
    for short_key, entry in place_mapping.items():
        gk = (entry.get("geojson_key") or "").strip()
        if gk != geojson_name:
            continue
        if "aliases" not in entry or "letter_references" not in entry:
            continue
        loc = {
            "name": short_key.replace("_", " ").title(),
            "aliases": entry.get("aliases", []),
            "description": entry.get("description", ""),
            "date_range": entry.get("date_range", ""),
        }
        # Use a nicer name from description or keep slug-derived
        named_locations.append(loc)
    return named_locations


# ---------------------------------------------------------------------------
# Step 7: Build a single place page object
# ---------------------------------------------------------------------------

def build_place_page(feat, place_id, enriched, place_mapping, image_lookup, letter_lookup):
    name = feat["properties"].get("place", "").strip()
    geojson_aliases = feat["properties"].get("aliases", [])
    coords = feat["geometry"]["coordinates"]
    lng, lat = coords[0], coords[1]

    # Enrichment data (keyed by geojson name)
    enrich = enriched.get(name, {})

    # Description: prefer place_mapping description over enriched
    # Find the primary place_mapping entry for this place (not a named-location sub-entry)
    description = ""
    for short_key, pm_entry in place_mapping.items():
        gk = (pm_entry.get("geojson_key") or "").strip()
        is_named_location = "aliases" in pm_entry and "letter_references" in pm_entry
        if is_named_location:
            continue
        # Match by geojson_key or by the short key equaling the place_id
        if gk == name or short_key == place_id:
            description = pm_entry.get("description", "")
            break

    # Collect photos from image registry using this place's short ID and the
    # IDs of any named-location sub-entries that share the same geojson_key
    photo_ids_to_check = {place_id}
    for short_key, pm_entry in place_mapping.items():
        gk = (pm_entry.get("geojson_key") or "").strip()
        if gk == name:
            photo_ids_to_check.add(short_key)

    seen_img_ids = set()
    photos = []
    for pid in photo_ids_to_check:
        for img in image_lookup.get(pid, []):
            if img.get("id") not in seen_img_ids:
                seen_img_ids.add(img.get("id"))
                photo = {
                    "image_id": img.get("id", ""),
                    "path": img.get("path", ""),
                    "description_da": img.get("description_da", ""),
                    "description": img.get("description", ""),
                    "date_estimate": img.get("date_estimate", ""),
                    "category": img.get("category", ""),
                }
                photos.append(photo)

    # Letters matching this geojson name (uses slug-normalized matching + aliases)
    matched_letters = collect_letters_for_place(name, geojson_aliases, letter_lookup)
    # Sort by date for stable output
    matched_letters.sort(key=lambda l: l.get("date") or "")
    letter_summaries = []
    for letter in matched_letters:
        text = letter.get("text_corrected") or letter.get("text_source") or ""
        summary = {
            "letter_id": letter.get("id"),
            "date": letter.get("date", ""),
            "sender": letter.get("sender", ""),
            "recipient": letter.get("recipient", ""),
            "excerpt": make_excerpt(text),
        }
        letter_summaries.append(summary)

    # Named locations (sub-places like Villa Vinterhistorie)
    named_locations = build_named_locations_for_geojson_key(place_mapping, name)

    page = {
        "id": place_id,
        "name": name,
        "modern_name": enrich.get("modern_name", ""),
        "country": enrich.get("country", ""),
        "lat": round(lat, 6),
        "lng": round(lng, 6),
        "wikidata_id": enrich.get("wikidata_id", ""),
        "wikipedia_url": enrich.get("wikipedia_url", enrich.get("wikipedia_da_url", "")),
        "description": description,
        "letter_count": len(matched_letters),
        "photos": photos,
        "letters": letter_summaries,
        "named_locations": named_locations,
    }

    return page


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    print("=== build-place-pages-data.py ===")

    # Step 1: ensure geojson has Ravnholt and Kongeåen
    print("\n[1] Checking places.geojson for required entries...")
    geojson = ensure_places_in_geojson()

    # Step 2: load source data
    print("\n[2] Loading source data...")
    enriched, place_mapping, image_registry, letters = load_data(geojson)
    print(f"  Enriched places: {len(enriched)}")
    print(f"  Photo-link entries: {len(place_mapping)}")
    print(f"  Images: {len(image_registry)}")
    print(f"  Letters: {len(letters)}")

    # Step 3: build ID map
    print("\n[3] Building place ID map...")
    place_id_map = build_place_id_map(geojson["features"], place_mapping)

    # Step 4: build lookups
    image_lookup = build_image_lookup(image_registry)
    letter_lookup = build_letter_lookup(letters)

    # Step 5: build place pages
    print("\n[4] Building place pages...")
    place_pages = []
    for feat in geojson["features"]:
        name = feat["properties"].get("place", "").strip()
        place_id = place_id_map.get(name, slugify(name))
        page = build_place_page(
            feat,
            place_id,
            enriched,
            place_mapping,
            image_lookup,
            letter_lookup,
        )
        place_pages.append(page)

    # Sort by name for stable output
    place_pages.sort(key=lambda p: p["name"].lower())

    # Step 6: write output
    print(f"\n[5] Writing {len(place_pages)} place pages to {OUTPUT_PATH}...")
    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(place_pages, f, ensure_ascii=False, indent=2)

    # Copy to frontend
    if FRONTEND_OUTPUT.parent.exists():
        shutil.copy2(OUTPUT_PATH, FRONTEND_OUTPUT)
        print(f"  Copied to {FRONTEND_OUTPUT}")
    else:
        print(f"  WARNING: Frontend output directory not found: {FRONTEND_OUTPUT.parent}")

    # Step 7: print stats
    total = len(place_pages)
    with_photos = sum(1 for p in place_pages if p["photos"])
    with_letters = sum(1 for p in place_pages if p["letters"])
    total_letter_refs = sum(p["letter_count"] for p in place_pages)

    print("\n=== Stats ===")
    print(f"  Total places:           {total}")
    print(f"  Places with photos:     {with_photos}")
    print(f"  Places with letters:    {with_letters}")
    print(f"  Total letter references:{total_letter_refs}")


if __name__ == "__main__":
    main()
