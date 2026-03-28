#!/usr/bin/env python3
"""Enrich places.geojson with Wikidata information (ADR-032).

Queries Wikidata SPARQL endpoint using coordinate-based radius searches
to find matching settlements, then writes enriched place data to JSON.
"""

import argparse
import io
import json
import os
import sys
import time
import unicodedata

# Fix Windows console encoding for Unicode place names
if sys.stdout.encoding != "utf-8":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
if sys.stderr.encoding != "utf-8":
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, SCRIPT_DIR)
from wikidata_client import WikiDataClient

DATA_DIR = os.path.join(SCRIPT_DIR, os.pardir, "data")
CACHE_DIR = os.path.join(DATA_DIR, ".cache", "wikidata-places")

INPUT_FILE = os.path.join(DATA_DIR, "places.geojson")
OUTPUT_FILE = os.path.join(DATA_DIR, "places-enriched.json")

SPARQL_QUERY_TEMPLATE = """
SELECT ?place ?placeLabel ?coord ?dist ?article ?articleDa ?countryLabel WHERE {{
  SERVICE wikibase:around {{
    ?place wdt:P625 ?coord .
    bd:serviceParam wikibase:center "Point({lng} {lat})"^^geo:wktLiteral .
    bd:serviceParam wikibase:radius "{radius}" .
    bd:serviceParam wikibase:distance ?dist .
  }}
  ?place wdt:P31/wdt:P279* wd:Q486972 .
  OPTIONAL {{ ?place wdt:P17 ?country . }}
  OPTIONAL {{
    ?article schema:about ?place ;
             schema:isPartOf <https://en.wikipedia.org/> .
  }}
  OPTIONAL {{
    ?articleDa schema:about ?place ;
               schema:isPartOf <https://da.wikipedia.org/> .
  }}
  SERVICE wikibase:label {{ bd:serviceParam wikibase:language "en,de,da,pl,ru,fr,lt" . }}
}}
ORDER BY ASC(?dist)
LIMIT 5
"""

RATE_LIMIT_SECONDS = 1.5


def normalize_name(name):
    """Normalize a place name for fuzzy comparison.

    Strips diacritics, lowercases, and removes parenthetical suffixes.
    """
    # Remove parenthetical parts e.g. "Arys (Orzysz)" -> "arys"
    base = name.split("(")[0].strip()
    # Strip diacritics
    nfkd = unicodedata.normalize("NFKD", base)
    ascii_name = "".join(c for c in nfkd if not unicodedata.combining(c))
    return ascii_name.lower().strip()


def get_all_name_variants(feature):
    """Return a list of normalized name variants for a GeoJSON feature."""
    props = feature["properties"]
    variants = [normalize_name(props["place"])]
    for alias in props.get("aliases", []):
        variants.append(normalize_name(alias))
    return variants


def extract_qid(uri):
    """Extract Wikidata QID from entity URI."""
    # e.g. "http://www.wikidata.org/entity/Q83419" -> "Q83419"
    return uri.rsplit("/", 1)[-1] if uri else None


def parse_sparql_results(raw_results):
    """Parse SPARQL JSON results into a list of candidate dicts."""
    candidates = []
    if not raw_results or "results" not in raw_results:
        return candidates

    for binding in raw_results["results"]["bindings"]:
        candidate = {
            "qid": extract_qid(binding.get("place", {}).get("value")),
            "label": binding.get("placeLabel", {}).get("value", ""),
            "distance_km": float(binding.get("dist", {}).get("value", 999)),
            "country": binding.get("countryLabel", {}).get("value"),
            "wikipedia_url": binding.get("article", {}).get("value"),
            "wikipedia_da_url": binding.get("articleDa", {}).get("value"),
        }
        if candidate["qid"]:
            candidates.append(candidate)

    return candidates


def pick_best_candidate(candidates, name_variants):
    """Select the best candidate from SPARQL results.

    If exactly one candidate, accept it. If multiple, prefer the one
    whose label best matches our place name variants (substring check).
    Falls back to the closest by distance.
    """
    if not candidates:
        return None

    if len(candidates) == 1:
        return candidates[0]

    # Try substring matching against our name variants
    for candidate in candidates:
        candidate_normalized = normalize_name(candidate["label"])
        for variant in name_variants:
            if variant in candidate_normalized or candidate_normalized in variant:
                return candidate

    # Fallback: closest by distance (already sorted by ASC(dist))
    return candidates[0]


def build_enrichment(candidate, match_method):
    """Build an enrichment dict from a matched candidate."""
    result = {
        "wikidata_id": candidate["qid"],
        "wikipedia_url": candidate.get("wikipedia_url"),
        "wikipedia_da_url": candidate.get("wikipedia_da_url"),
        "modern_name": candidate["label"],
        "country": candidate.get("country"),
        "match_method": match_method,
        "match_distance_km": round(candidate["distance_km"], 1),
    }
    # Remove None values for cleaner output
    return {k: v for k, v in result.items() if v is not None}


def fetch_manual_override(qid, client):
    """Fetch Wikidata entity details for a manual override QID."""
    query = f"""
    SELECT ?place ?placeLabel ?coord ?article ?articleDa ?countryLabel WHERE {{
      BIND(wd:{qid} AS ?place)
      ?place wdt:P625 ?coord .
      OPTIONAL {{ ?place wdt:P17 ?country . }}
      OPTIONAL {{
        ?article schema:about ?place ;
                 schema:isPartOf <https://en.wikipedia.org/> .
      }}
      OPTIONAL {{
        ?articleDa schema:about ?place ;
                   schema:isPartOf <https://da.wikipedia.org/> .
      }}
      SERVICE wikibase:label {{ bd:serviceParam wikibase:language "en,de,da,pl,ru,fr,lt" . }}
    }}
    LIMIT 1
    """
    try:
        raw = client.query(query)
        candidates = parse_sparql_results(raw)
        if candidates:
            candidates[0]["distance_km"] = 0.0
            return candidates[0]
    except Exception as e:
        print(f"  WARNING: Failed to fetch override {qid}: {e}")
    return None


def load_cache(place_id):
    """Load cached query result for a place, or return None."""
    cache_file = os.path.join(CACHE_DIR, f"{place_id}.json")
    if os.path.exists(cache_file):
        with open(cache_file, "r", encoding="utf-8") as f:
            return json.load(f)
    return None


def save_cache(place_id, data):
    """Save query result to cache."""
    os.makedirs(CACHE_DIR, exist_ok=True)
    cache_file = os.path.join(CACHE_DIR, f"{place_id}.json")
    with open(cache_file, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def query_place(client, lng, lat, radius_km):
    """Run SPARQL coordinate query and return parsed candidates."""
    query = SPARQL_QUERY_TEMPLATE.format(lng=lng, lat=lat, radius=radius_km)
    raw = client.query(query)
    return parse_sparql_results(raw)


def enrich_place(client, feature, force=False, manual_overrides=None):
    """Enrich a single place feature. Returns (place_name, enrichment_dict)."""
    props = feature["properties"]
    place_id = props["place_id"]
    place_name = props["place"]
    coords = feature["geometry"]["coordinates"]
    lng, lat = coords[0], coords[1]
    name_variants = get_all_name_variants(feature)

    # Check manual overrides first
    if manual_overrides and place_name in manual_overrides:
        override_qid = manual_overrides[place_name]
        # Try cache for overrides too
        cached = load_cache(f"{place_id}_override") if not force else None
        if cached:
            print(f"  [cache] Manual override {override_qid}")
            return place_name, cached

        print(f"  Fetching manual override {override_qid}...")
        candidate = fetch_manual_override(override_qid, client)
        time.sleep(RATE_LIMIT_SECONDS)
        if candidate:
            enrichment = build_enrichment(candidate, "manual_override")
            save_cache(f"{place_id}_override", enrichment)
            return place_name, enrichment
        else:
            # Couldn't fetch override details, store QID at minimum
            enrichment = {
                "wikidata_id": override_qid,
                "match_method": "manual_override",
            }
            save_cache(f"{place_id}_override", enrichment)
            return place_name, enrichment

    # Check cache
    if not force:
        cached = load_cache(place_id)
        if cached is not None:
            qid = cached.get("wikidata_id", "unmatched")
            method = cached.get("match_method", "cached")
            print(f"  [cache] {qid} ({method})")
            return place_name, cached

    # Query with 5 km radius
    try:
        candidates = query_place(client, lng, lat, 5)
        time.sleep(RATE_LIMIT_SECONDS)
    except Exception as e:
        print(f"  WARNING: SPARQL error: {e}")
        enrichment = {"match_method": "unmatched", "error": str(e)}
        save_cache(place_id, enrichment)
        return place_name, enrichment

    best = pick_best_candidate(candidates, name_variants)
    if best:
        match_method = "coordinate_5km"
        enrichment = build_enrichment(best, match_method)
        label = best["label"]
        dist = best["distance_km"]
        print(f"  {best['qid']} ({label}, {dist:.1f} km)")
        save_cache(place_id, enrichment)
        return place_name, enrichment

    # Retry with 15 km radius
    print(f"  No results at 5 km, retrying at 15 km...")
    try:
        candidates = query_place(client, lng, lat, 15)
        time.sleep(RATE_LIMIT_SECONDS)
    except Exception as e:
        print(f"  WARNING: SPARQL error on retry: {e}")
        enrichment = {"match_method": "unmatched", "error": str(e)}
        save_cache(place_id, enrichment)
        return place_name, enrichment

    best = pick_best_candidate(candidates, name_variants)
    if best:
        match_method = "coordinate_15km"
        enrichment = build_enrichment(best, match_method)
        label = best["label"]
        dist = best["distance_km"]
        print(f"  {best['qid']} ({label}, {dist:.1f} km)")
        save_cache(place_id, enrichment)
        return place_name, enrichment

    # Unmatched
    print(f"  UNMATCHED")
    enrichment = {"match_method": "unmatched"}
    save_cache(place_id, enrichment)
    return place_name, enrichment


def print_summary(enriched):
    """Print enrichment summary statistics."""
    total = len(enriched)
    auto_matched = sum(
        1
        for e in enriched.values()
        if e.get("match_method", "").startswith("coordinate_")
    )
    manual_matched = sum(
        1
        for e in enriched.values()
        if e.get("match_method") == "manual_override"
    )
    unmatched = sum(
        1 for e in enriched.values() if e.get("match_method") == "unmatched"
    )
    wikipedia_urls = sum(1 for e in enriched.values() if e.get("wikipedia_url"))

    print()
    print("--- Enrichment Summary ---")
    print(f"  Total places: {total}")
    print(f"  Matched (auto): {auto_matched}")
    print(f"  Matched (manual override): {manual_matched}")
    print(f"  Unmatched: {unmatched}")
    print(f"  Wikipedia URLs found: {wikipedia_urls}")


def main():
    parser = argparse.ArgumentParser(
        description="Enrich places.geojson with Wikidata information (ADR-032)."
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Re-query all places, ignoring cache.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Query and print results but don't write output file.",
    )
    parser.add_argument(
        "--manual-overrides",
        type=str,
        default=None,
        help="Path to JSON file with pre-assigned QIDs: {\"place_name\": \"Q12345\"}.",
    )
    args = parser.parse_args()

    # Load input GeoJSON
    input_path = os.path.normpath(INPUT_FILE)
    if not os.path.exists(input_path):
        print(f"ERROR: Input file not found: {input_path}")
        sys.exit(1)

    with open(input_path, "r", encoding="utf-8") as f:
        geojson = json.load(f)

    features = geojson.get("features", [])
    print(f"Loaded {len(features)} places from {input_path}")

    # Load manual overrides if provided
    manual_overrides = None
    if args.manual_overrides:
        overrides_path = os.path.normpath(args.manual_overrides)
        if not os.path.exists(overrides_path):
            print(f"ERROR: Manual overrides file not found: {overrides_path}")
            sys.exit(1)
        with open(overrides_path, "r", encoding="utf-8") as f:
            manual_overrides = json.load(f)
        print(f"Loaded {len(manual_overrides)} manual overrides")

    # Ensure cache directory exists
    os.makedirs(CACHE_DIR, exist_ok=True)

    # Initialize Wikidata client
    client = WikiDataClient()

    # Enrich each place
    enriched = {}
    total = len(features)
    for i, feature in enumerate(features, 1):
        place_name = feature["properties"]["place"]
        print(f"[{i}/{total}] Querying {place_name}...", end=" ")
        name, data = enrich_place(
            client, feature, force=args.force, manual_overrides=manual_overrides
        )
        enriched[name] = data

    # Print summary
    print_summary(enriched)

    # Write output
    if args.dry_run:
        print("\n(dry-run: output file not written)")
    else:
        output_path = os.path.normpath(OUTPUT_FILE)
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(enriched, f, ensure_ascii=False, indent=2)
        print(f"\nWrote enriched data to {output_path}")


if __name__ == "__main__":
    main()
