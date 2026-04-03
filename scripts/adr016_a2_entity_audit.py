"""
ADR-016 Task A2: Entity Quality Audit and Cleanup

Reads NER_entities_grouped.csv, applies known corrections (remove false
persons, reclassify PER->LOC, merge duplicates, flag ambiguous), scans for
additional suspicious patterns, and writes entity-audit.json.
"""

import csv
import json
from pathlib import Path
from collections import defaultdict

# ---------------------------------------------------------------------------
# Configuration: correction lists (easy to extend)
# ---------------------------------------------------------------------------

# Entities to REMOVE — not actual persons
REMOVE_FALSE_PER: dict[str, str] = {
    "Gud": "not_a_person — Danish for God",
    "Guds": "not_a_person — Danish possessive of God",
    "Regt": "military_abbreviation — Regiment",
    "Feldv": "military_rank — Feldvebel abbreviation",
    "Feldw": "military_rank — Feldvebel abbreviation",
    "Feldveblen": "military_rank — Feldvebel",
    "Major": "military_rank",
    "Leutn": "military_rank — Leutnant abbreviation",
    "Gefr": "military_rank — Gefreiter abbreviation",
    "Gefreiter": "military_rank",
    "Hejmdal": "not_a_person — newspaper name",
}

# Entities to RECLASSIFY from PER to LOC
RECLASSIFY_PER_TO_LOC: dict[str, str] = {
    "Bromberg": "city_in_prussia",
    "Roagger": "village — Roager",
    "Arys": "military_camp_east_prussia",
    "Halle": "city_in_germany",
    "Hadersleben": "city — Haderslev",
    "Laon": "city_in_france",
    "Marne": "river_and_region_in_france",
    "Løtzen": "city_in_east_prussia",
    "Bakkely": "place_name",
}

# Merge groups: canonical name -> list of aliases (including canonical)
MERGE_GROUPS: dict[str, list[str]] = {
    "Konow": ["Konov", "Konow", "Konovs"],
    "Trine": ["Trine", "Trinelil", "Trines"],
    "Peter": ["Peter", "Peterlil"],
    "Mor": ["Mor", "Moer"],
}

# Ambiguous entities — flag for human review
AMBIGUOUS: dict[str, str] = {
    "Hindenburg": "could_be_person_or_location — von Hindenburg or Hindenburg city",
    "Holst": "could_be_person_surname_or_other",
    "Marsk": "could_be_person_surname_or_other",
}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def load_entities(csv_path: Path) -> list[dict]:
    """Load the NER CSV into a list of dicts with text, type, counts."""
    rows = []
    with open(csv_path, encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            rows.append({
                "text": row["text"],
                "type": row["type"],
                "count": int(row["counts"]),
            })
    return rows


def aggregate_counts(rows: list[dict], names: list[str]) -> int:
    """Sum counts across all type variants for the given entity names."""
    return sum(r["count"] for r in rows if r["text"] in names)


def per_count(rows: list[dict], name: str) -> int:
    """Sum PER-typed counts for a given entity name."""
    return sum(r["count"] for r in rows if r["text"] == name and r["type"] == "PER")


# ---------------------------------------------------------------------------
# Main audit logic
# ---------------------------------------------------------------------------

def run_audit(csv_path: Path) -> dict:
    rows = load_entities(csv_path)

    # Index: text -> list of (type, count) pairs
    entity_index: dict[str, list[tuple[str, int]]] = defaultdict(list)
    for r in rows:
        entity_index[r["text"]].append((r["type"], r["count"]))

    # Sets to track which entities are handled
    handled_texts: set[str] = set()

    # 1. Removed entities
    removed = []
    for text, reason in REMOVE_FALSE_PER.items():
        total = aggregate_counts(rows, [text])
        if total > 0:
            # Gather all original types
            orig_types = [f"{t}({c})" for t, c in entity_index.get(text, [])]
            removed.append({
                "text": text,
                "count": total,
                "reason": reason,
                "original_types": ", ".join(orig_types),
            })
            handled_texts.add(text)

    # 2. Reclassified entities (PER -> LOC)
    reclassified = []
    for text, reason in RECLASSIFY_PER_TO_LOC.items():
        per_c = per_count(rows, text)
        total = aggregate_counts(rows, [text])
        if per_c > 0:
            reclassified.append({
                "text": text,
                "count": per_c,
                "total_all_types": total,
                "from": "PER",
                "to": "LOC",
                "reason": reason,
            })
        handled_texts.add(text)

    # 3. Merge groups -> confirmed persons
    confirmed_persons = []
    for canonical, aliases in MERGE_GROUPS.items():
        total = aggregate_counts(rows, aliases)
        confirmed_persons.append({
            "canonical": canonical,
            "aliases": aliases,
            "total_count": total,
            "action": "merge" if len(aliases) > 1 else "keep",
        })
        handled_texts.update(aliases)

    # 4. Ambiguous
    ambiguous = []
    for text, reason in AMBIGUOUS.items():
        total = aggregate_counts(rows, [text])
        if total > 0:
            types_detail = [f"{t}({c})" for t, c in entity_index.get(text, [])]
            ambiguous.append({
                "text": text,
                "count": total,
                "reason": reason,
                "types_observed": ", ".join(types_detail),
            })
            handled_texts.add(text)

    # 5. Remaining PER entities that are not yet handled -> confirmed persons
    remaining_per: dict[str, int] = defaultdict(int)
    for r in rows:
        if r["type"] == "PER" and r["text"] not in handled_texts:
            remaining_per[r["text"]] += r["count"]

    for text, count in sorted(remaining_per.items(), key=lambda x: -x[1]):
        confirmed_persons.append({
            "canonical": text,
            "aliases": [text],
            "total_count": count,
            "action": "keep",
        })

    # Sort confirmed_persons by total_count descending
    confirmed_persons.sort(key=lambda x: -x["total_count"])

    # 6. Scan for additional suspicious patterns
    suspicious_extra = []

    # 6a. Single-character entities
    for text, pairs in entity_index.items():
        if len(text) == 1:
            total = sum(c for _, c in pairs)
            suspicious_extra.append({
                "text": text,
                "count": total,
                "reason": "single_character_entity",
            })

    # 6b. Entities that appear as both PER and LOC
    for text, pairs in entity_index.items():
        if text in handled_texts:
            continue
        types_set = {t for t, _ in pairs}
        if "PER" in types_set and "LOC" in types_set:
            total = sum(c for _, c in pairs)
            types_detail = [f"{t}({c})" for t, c in pairs]
            suspicious_extra.append({
                "text": text,
                "count": total,
                "reason": "appears_as_both_PER_and_LOC",
                "types_observed": ", ".join(types_detail),
            })

    # 6c. PER entities with count < 2
    for text, pairs in entity_index.items():
        if text in handled_texts:
            continue
        for t, c in pairs:
            if t == "PER" and c < 2:
                suspicious_extra.append({
                    "text": text,
                    "count": c,
                    "reason": "PER_entity_count_below_2",
                })

    # De-duplicate suspicious_extra by (text, reason)
    seen_suspicious = set()
    deduped_suspicious = []
    for s in suspicious_extra:
        key = (s["text"], s["reason"])
        if key not in seen_suspicious:
            seen_suspicious.add(key)
            deduped_suspicious.append(s)
    suspicious_extra = sorted(deduped_suspicious, key=lambda x: -x["count"])

    # Add suspicious findings to ambiguous list
    ambiguous.extend(suspicious_extra)

    # Build summary
    summary = {
        "total_rows_in_csv": len(rows),
        "unique_entity_texts": len(entity_index),
        "confirmed_persons": len(confirmed_persons),
        "removed": len(removed),
        "reclassified": len(reclassified),
        "ambiguous": len(ambiguous),
    }

    return {
        "confirmed_persons": confirmed_persons,
        "removed": removed,
        "reclassified": reclassified,
        "ambiguous": ambiguous,
        "summary": summary,
    }


def main():
    base = Path(__file__).resolve().parent.parent
    csv_path = base / "data" / "NER_entities_grouped.csv"
    out_path = base / "data" / "entity-audit.json"

    if not csv_path.exists():
        raise FileNotFoundError(f"Input not found: {csv_path}")

    result = run_audit(csv_path)

    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(result, f, indent=2, ensure_ascii=False)

    # Print summary
    s = result["summary"]
    print("=== Entity Audit Summary ===")
    print(f"  Total rows in CSV:      {s['total_rows_in_csv']}")
    print(f"  Unique entity texts:    {s['unique_entity_texts']}")
    print(f"  Confirmed persons:      {s['confirmed_persons']}")
    print(f"  Removed (false PER):    {s['removed']}")
    print(f"  Reclassified (PER->LOC): {s['reclassified']}")
    print(f"  Ambiguous / suspicious: {s['ambiguous']}")
    print(f"\nOutput written to: {out_path}")


if __name__ == "__main__":
    main()
