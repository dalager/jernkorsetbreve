#!/usr/bin/env python3
"""One-time migration: extract human-curated enrichments from person-registry.json.

Reads data/person-registry.json and produces data/person-registry-enrichments.json
containing all fields that the NLP pipeline should never overwrite.

This script is idempotent but intended to run once during the ADR-057 migration.
"""

import json
import sys
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
REGISTRY_PATH = ROOT / "data" / "person-registry.json"
OUTPUT_PATH = ROOT / "data" / "person-registry-enrichments.json"

# Fields that are always included when present (all persons have role/category)
ALWAYS_FIELDS = {"role", "category"}

# Fields included only when non-null / non-empty
OPTIONAL_FIELDS = {"full_name", "birth_date", "death_date", "biographical", "enrichment_source"}

# Photos: included only when non-empty list


def is_manual_person(person: dict) -> bool:
    """A manual person has letter_count 0 and no first_mention (not from NER)."""
    return person.get("letter_count", 0) == 0 and person.get("first_mention") is None


def build_enrichment_entry(person: dict) -> dict:
    """Build an enrichment record for a single person."""
    entry = {}

    # Always include role and category
    for field in ALWAYS_FIELDS:
        if field in person:
            entry[field] = person[field]

    # Include optional fields only when non-null
    for field in OPTIONAL_FIELDS:
        value = person.get(field)
        if value is not None:
            entry[field] = value

    # Photos: include only if non-empty
    photos = person.get("photos", [])
    if photos:
        entry["photos"] = photos

    # add_aliases: empty array — future manual aliases go here
    entry["add_aliases"] = []

    return entry


def main():
    if not REGISTRY_PATH.exists():
        print(f"ERROR: {REGISTRY_PATH} not found", file=sys.stderr)
        sys.exit(1)

    with open(REGISTRY_PATH, "r", encoding="utf-8") as f:
        persons = json.load(f)

    enrichments = {
        "_meta": {
            "description": "Human-curated enrichments for person registry. NEVER overwritten by NLP pipeline.",
            "last_extracted": str(date.today()),
        }
    }
    manual_persons = []
    enriched_count = 0

    for person in persons:
        pid = person["id"]

        if is_manual_person(person):
            # Full record for manual-only persons
            manual_persons.append(person)
            continue

        # Build enrichment entry — every person gets one (all have translated roles)
        entry = build_enrichment_entry(person)
        enrichments[pid] = entry
        enriched_count += 1

    enrichments["_manual_persons"] = manual_persons

    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(enrichments, f, ensure_ascii=False, indent=2)
        f.write("\n")

    print(f"Extracted enrichments for {enriched_count} pipeline persons")
    print(f"Extracted {len(manual_persons)} manual-only persons")
    print(f"Written to {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
