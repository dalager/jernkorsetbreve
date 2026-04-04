#!/usr/bin/env python3
"""
ADR-042: Person Registry Disambiguation

Analyzes letter-entities-draft.json and letters.csv to find co-occurrence
evidence proving that conflated person entries (Maren, Niels) are in fact
different people. Builds temporal profiles and attempts bare-name assignment.

Reads:
  - data/letter-entities-draft.json (per-letter entity mapping)
  - data/letters.csv (letter metadata for dates/sender/recipient)

Outputs:
  - data/disambiguation-evidence.json
"""

import json
import csv
from pathlib import Path
from collections import defaultdict

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"

# ---------------------------------------------------------------------------
# Conflated groups to disambiguate
# ---------------------------------------------------------------------------
CONFLATED_GROUPS = {
    "Maren": {
        "surname_variants": {
            "Maren Fog": ["Maren Fog"],
            "Maren Hansen": ["Maren Hansen"],
            "Maren Bøjlesen": ["Maren Bøjlesen"],
        },
        "bare_names": ["Maren"],
    },
    "Niels": {
        "surname_variants": {
            "Niels Kjær": ["Niels Kjær", "N. Kjær", "Kjærs", "N. Kjærs",
                           "N.Kjærs.", "Niels Kjaers"],
            "Niels Skau": ["Niels Skau", "N. Skau", "N.Skau,",
                           "M. Skau Semmested"],
        },
        "bare_names": ["Niels", "Niels og", "Niels's", "Niels'"],
    },
}


def load_letter_entities():
    """Load per-letter entity mapping."""
    with open(DATA_DIR / "letter-entities-draft.json", "r", encoding="utf-8") as f:
        return json.load(f)


def load_letters_csv():
    """Load letter metadata for dates, sender, recipient."""
    letters = {}
    with open(DATA_DIR / "letters.csv", "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            letters[str(row["id"])] = row
    return letters


def find_alias_matches(person_text, aliases):
    """Check if a person text matches any of the given aliases."""
    return person_text in aliases


def find_variant_in_letter(persons, surname_variants):
    """Return which surname variants appear among a letter's person list."""
    found = {}
    for variant_name, aliases in surname_variants.items():
        for person in persons:
            if person in aliases:
                found.setdefault(variant_name, []).append(person)
    return found


def build_co_occurrence_evidence(letter_entities, letters_csv, group_name,
                                 group_config):
    """
    Find letters where two or more surname variants from the same conflated
    group co-occur, proving they are different people.
    """
    evidence = []
    surname_variants = group_config["surname_variants"]

    for letter_id, entities in sorted(letter_entities.items(),
                                      key=lambda x: int(x[0])):
        persons = entities.get("persons", [])
        found = find_variant_in_letter(persons, surname_variants)
        if len(found) >= 2:
            date = letters_csv.get(letter_id, {}).get("date", None)
            sender = letters_csv.get(letter_id, {}).get("sender", None)
            evidence.append({
                "letter_id": int(letter_id),
                "date": date,
                "sender": sender,
                "co_occurring_variants": {
                    k: v for k, v in found.items()
                },
                "all_persons_in_letter": persons,
            })
    return evidence


def build_temporal_profiles(letter_entities, letters_csv, group_config):
    """
    For each surname variant, build a temporal profile: which letters and
    dates it appears in.
    """
    profiles = {}
    surname_variants = group_config["surname_variants"]

    for variant_name, aliases in surname_variants.items():
        mentions = []
        for letter_id, entities in sorted(letter_entities.items(),
                                          key=lambda x: int(x[0])):
            persons = entities.get("persons", [])
            matched_aliases = [p for p in persons if p in aliases]
            if matched_aliases:
                date = letters_csv.get(letter_id, {}).get("date", None)
                sender = letters_csv.get(letter_id, {}).get("sender", None)
                mentions.append({
                    "letter_id": int(letter_id),
                    "date": date,
                    "sender": sender,
                    "matched_as": matched_aliases,
                })
        dates = [m["date"] for m in mentions if m["date"]]
        dates.sort()
        profiles[variant_name] = {
            "mention_count": len(mentions),
            "first_mention": dates[0] if dates else None,
            "last_mention": dates[-1] if dates else None,
            "mentions": mentions,
        }
    return profiles


def assign_bare_names(letter_entities, letters_csv, group_config, profiles):
    """
    Attempt to assign bare first-name mentions to a specific surname variant
    based on:
      1. Sender identity (if sender includes the surname)
      2. Temporal proximity to surname-qualified mentions
      3. Co-occurring persons in the same letter
    If unresolvable, mark as ambiguous.
    """
    bare_names = group_config["bare_names"]
    surname_variants = group_config["surname_variants"]
    assignments = []

    # Build a date->variant map for temporal proximity
    date_variant_map = defaultdict(set)
    for variant_name, profile in profiles.items():
        for mention in profile["mentions"]:
            if mention["date"]:
                date_variant_map[mention["date"]].add(variant_name)

    for letter_id, entities in sorted(letter_entities.items(),
                                      key=lambda x: int(x[0])):
        persons = entities.get("persons", [])
        bare_matches = [p for p in persons if p in bare_names]
        if not bare_matches:
            continue

        date = letters_csv.get(letter_id, {}).get("date", None)
        sender = letters_csv.get(letter_id, {}).get("sender", "")

        # Strategy 1: Check if sender name resolves the identity
        assigned_variant = None
        confidence = 0.0
        method = None

        for variant_name, aliases in surname_variants.items():
            # Check if sender contains a surname from this variant
            for alias in aliases:
                if alias in sender:
                    assigned_variant = variant_name
                    confidence = 0.95
                    method = "sender_identity"
                    break
            if assigned_variant:
                break

        # Strategy 2: Check if a surname variant co-occurs in same letter
        if not assigned_variant:
            found = find_variant_in_letter(persons, surname_variants)
            if len(found) == 1:
                assigned_variant = list(found.keys())[0]
                confidence = 0.7
                method = "same_letter_co_occurrence"

        # Strategy 3: Temporal proximity — same date has a surname mention
        if not assigned_variant and date:
            variants_on_date = date_variant_map.get(date, set())
            if len(variants_on_date) == 1:
                assigned_variant = list(variants_on_date)[0]
                confidence = 0.5
                method = "temporal_same_date"

        # Strategy 4: Temporal proximity — nearest date with a surname
        if not assigned_variant and date:
            best_variant = None
            best_distance = None
            for variant_name, profile in profiles.items():
                for mention in profile["mentions"]:
                    if mention["date"]:
                        distance = abs(_date_diff(date, mention["date"]))
                        if best_distance is None or distance < best_distance:
                            best_distance = distance
                            best_variant = variant_name
            if best_variant and best_distance is not None and best_distance <= 30:
                assigned_variant = best_variant
                confidence = max(0.3, 0.5 - best_distance * 0.01)
                method = f"temporal_nearest_{best_distance}d"

        assignment = {
            "letter_id": int(letter_id),
            "date": date,
            "sender": sender,
            "bare_name_forms": bare_matches,
            "assigned_to": assigned_variant,
            "confidence": round(confidence, 2),
            "method": method if assigned_variant else "unresolvable",
            "is_ambiguous": assigned_variant is None,
        }
        assignments.append(assignment)

    return assignments


def _date_diff(date_a, date_b):
    """Compute approximate day difference between two ISO date strings."""
    try:
        parts_a = date_a.split("-")
        parts_b = date_b.split("-")
        days_a = int(parts_a[0]) * 365 + int(parts_a[1]) * 30 + int(parts_a[2])
        days_b = int(parts_b[0]) * 365 + int(parts_b[1]) * 30 + int(parts_b[2])
        return days_a - days_b
    except (IndexError, ValueError):
        return 9999


def main():
    print("=" * 60)
    print("ADR-042: Person Registry Disambiguation")
    print("=" * 60)

    letter_entities = load_letter_entities()
    letters_csv = load_letters_csv()

    print(f"Loaded {len(letter_entities)} letters from letter-entities-draft.json")
    print(f"Loaded {len(letters_csv)} letters from letters.csv")

    output = {}

    for group_name, group_config in CONFLATED_GROUPS.items():
        print(f"\n--- Analyzing conflated group: {group_name} ---")

        # Co-occurrence evidence
        co_occurrences = build_co_occurrence_evidence(
            letter_entities, letters_csv, group_name, group_config
        )
        print(f"  Co-occurrence proof: {len(co_occurrences)} letter(s)")
        for co in co_occurrences:
            variants = list(co["co_occurring_variants"].keys())
            print(f"    Letter {co['letter_id']} ({co['date']}): "
                  f"{' + '.join(variants)}")

        # Temporal profiles
        profiles = build_temporal_profiles(
            letter_entities, letters_csv, group_config
        )
        for variant_name, profile in profiles.items():
            print(f"  {variant_name}: {profile['mention_count']} mentions "
                  f"({profile['first_mention']} to {profile['last_mention']})")

        # Bare name assignments
        assignments = assign_bare_names(
            letter_entities, letters_csv, group_config, profiles
        )
        assigned = [a for a in assignments if not a["is_ambiguous"]]
        ambiguous = [a for a in assignments if a["is_ambiguous"]]
        print(f"  Bare name mentions: {len(assignments)} total")
        print(f"    Assigned: {len(assigned)}")
        print(f"    Ambiguous: {len(ambiguous)}")

        output[group_name] = {
            "conflated_variants": list(group_config["surname_variants"].keys()),
            "co_occurrence_evidence": co_occurrences,
            "temporal_profiles": profiles,
            "bare_name_assignments": assignments,
            "summary": {
                "total_bare_mentions": len(assignments),
                "assigned_count": len(assigned),
                "ambiguous_count": len(ambiguous),
                "co_occurrence_proof_count": len(co_occurrences),
            },
        }

    # Write output
    output_path = DATA_DIR / "disambiguation-evidence.json"
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    print(f"\n{'=' * 60}")
    print(f"Output written to: {output_path}")
    print(f"{'=' * 60}")


if __name__ == "__main__":
    main()
