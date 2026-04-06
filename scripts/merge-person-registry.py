#!/usr/bin/env python3
"""Merge pipeline-computed person data with human-curated enrichments.

Loads:
  - data/person-registry-computed.json  (NLP pipeline output)
  - data/person-registry-enrichments.json  (human curation)
Writes:
  - data/person-registry.json  (merged result)

Ownership rules:
  - Pipeline owns: letter_count, first_mention, last_mention
  - Human owns: role, category, full_name, birth_date, death_date,
                biographical, photos, enrichment_source
  - aliases: union of computed aliases + enrichment add_aliases
  - id, canonical: from computed (pipeline is authoritative for identity)
"""

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
COMPUTED_PATH = ROOT / "data" / "person-registry-computed.json"
ENRICHMENTS_PATH = ROOT / "data" / "person-registry-enrichments.json"
OUTPUT_PATH = ROOT / "data" / "person-registry.json"

PIPELINE_OWNED = {"letter_count", "first_mention", "last_mention"}
HUMAN_OWNED = {
    "role", "category", "full_name", "birth_date", "death_date",
    "biographical", "photos", "enrichment_source",
}


def load_json(path: Path) -> dict | list | None:
    if not path.exists():
        return None
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def merge_person(computed: dict, enrichment: dict | None) -> dict:
    """Merge a single person record. Computed is the base; enrichment overlays."""
    merged = {
        "id": computed["id"],
        "canonical": computed["canonical"],
    }

    # Aliases: union of computed + add_aliases from enrichment
    aliases = list(computed.get("aliases", []))
    if enrichment:
        for alias in enrichment.get("add_aliases", []):
            if alias not in aliases:
                aliases.append(alias)
    merged["aliases"] = aliases

    # Human-owned fields: enrichment wins if present, else fall back to computed
    for field in HUMAN_OWNED:
        if enrichment and field in enrichment:
            merged[field] = enrichment[field]
        elif field in computed:
            merged[field] = computed[field]
        # Some fields may not exist on either side; omit them

    # Pipeline-owned fields: always from computed
    for field in PIPELINE_OWNED:
        if field in computed:
            merged[field] = computed[field]

    return merged


def main():
    enrichments_data = load_json(ENRICHMENTS_PATH)
    if enrichments_data is None:
        print("ERROR: enrichments file not found at", ENRICHMENTS_PATH, file=sys.stderr)
        sys.exit(1)

    computed_data = load_json(COMPUTED_PATH)

    if computed_data is None:
        # Fallback: reconstruct from current person-registry.json
        print("WARNING: computed file not found, using current person-registry.json as base",
              file=sys.stderr)
        fallback = load_json(OUTPUT_PATH)
        if fallback is None:
            print("ERROR: no computed file and no existing person-registry.json", file=sys.stderr)
            sys.exit(1)
        # Filter out manual persons (they come from enrichments)
        manual_ids = {p["id"] for p in enrichments_data.get("_manual_persons", [])}
        computed_data = [p for p in fallback if p["id"] not in manual_ids]

    # Index computed persons by id
    computed_by_id = {p["id"]: p for p in computed_data}

    # Merge
    merged = []
    merged_count = 0
    computed_only = 0

    for pid, computed in computed_by_id.items():
        enrichment = enrichments_data.get(pid)
        person = merge_person(computed, enrichment)
        merged.append(person)
        if enrichment:
            merged_count += 1
        else:
            computed_only += 1

    # Append manual persons not already in computed
    manual_persons = enrichments_data.get("_manual_persons", [])
    manual_added = 0
    for mp in manual_persons:
        if mp["id"] not in computed_by_id:
            merged.append(mp)
            manual_added += 1

    # Sort: letter_count desc, then canonical asc
    merged.sort(key=lambda p: (-p.get("letter_count", 0), p.get("canonical", "")))

    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(merged, f, ensure_ascii=False, indent=2)
        f.write("\n")

    print(f"Merged: {merged_count} enriched, {computed_only} computed-only, {manual_added} manual-only")
    print(f"Total: {len(merged)} persons written to {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
