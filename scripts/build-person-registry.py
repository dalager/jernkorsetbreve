#!/usr/bin/env python3
"""
ADR-016 Phase B2: Build Person Registry

Creates data/person-registry.json — a disambiguated registry of all persons
mentioned in the WW1 letters, with canonical names, aliases, roles, and categories.

Reads:
  - data/entity-audit.json (confirmed persons with merges)
  - data/letter-entities-draft.json (per-letter entity mapping)
  - data/letters.csv (letter metadata for dates)

Outputs:
  - data/person-registry.json
"""

import json
import csv
import sys
from pathlib import Path
from collections import defaultdict

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"

# ---------------------------------------------------------------------------
# Domain knowledge: known persons with role/category assignments
# ---------------------------------------------------------------------------
KNOWN_PERSONS = {
    "Peter": {
        "role": "soldier, letter author",
        "category": "family",
        "extra_aliases": ["Peter", "Peterlil", "Fader", "din Mand", "Peter Mærsk",
                          "Peter Marsk", "Peters", "Peter Gefr", "Peter J.",
                          "Peter Højer", "Märsk", "Mærsk", "J. P. Marsk",
                          "J. P. Mærsk", "J. P. Marsk Roagger", "Mærsk Roagger",
                          "Mærsk Regt", "Peter Gad", "Peter Petersen"],
    },
    "Trine": {
        "role": "wife, primary recipient",
        "category": "family",
        "extra_aliases": ["Trine", "Trinelil", "Trines", "min Trine",
                          "min egen Trine", "lille Trine", "Trine Gad",
                          "Trine Gad Roagger", "Trine Gad Ravnhold",
                          "Trine G. Mærsk"],
    },
    "Mor": {
        "role": "Peter's mother",
        "category": "family",
        "extra_aliases": ["Mor", "Moer", "Moder", "Maren Mærsk"],
    },
    "Far": {
        "role": "Peter's father",
        "category": "family",
        "extra_aliases": ["Far", "Faer"],
    },
    "Konow": {
        "role": "military figure",
        "category": "military",
        "extra_aliases": ["Konow", "Konov", "Konovs", "Wilhelm Konow"],
    },
    "Uffe": {
        "role": "close comrade / friend",
        "category": "military",
        "extra_aliases": ["Uffe", "Uffes"],
    },
    "Bodil": {
        "role": "family member or close friend",
        "category": "family",
        "extra_aliases": ["Bodil"],
    },
    "Signe": {
        "role": "family member",
        "category": "family",
        "extra_aliases": ["Signe", "Signes"],
    },
    "Musse": {
        "role": "family member or pet name",
        "category": "family",
        "extra_aliases": ["Musse"],
    },
    "Petersen": {
        "role": "military associate",
        "category": "military",
        "extra_aliases": ["Petersen"],
    },
    "Poulsen": {
        "role": "military associate",
        "category": "military",
        "extra_aliases": ["Poulsen", "Poulsens"],
    },
    "Maren": {
        "role": "community member",
        "category": "community",
        "extra_aliases": ["Maren", "Maren Fog", "Maren Hansen", "Maren Bøjlesen"],
    },
    "Niels": {
        "role": "community member",
        "category": "community",
        "extra_aliases": ["Niels", "Niels Kjær", "N. Kjær", "Kjærs", "Niels Skau", "N. Skau"],
    },
    "Iver": {
        "role": "community member / acquaintance",
        "category": "community",
        "extra_aliases": ["Iver", "Ivers"],
    },
    "Braunsberg": {
        "role": "military associate",
        "category": "military",
        "extra_aliases": ["Braunsberg"],
    },
    "Madsen": {
        "role": "military associate",
        "category": "military",
        "extra_aliases": ["Madsen"],
    },
    "Anna": {
        "role": "community member",
        "category": "community",
        "extra_aliases": ["Anna"],
    },
    "Truls": {
        "role": "community member",
        "category": "community",
        "extra_aliases": ["Truls"],
    },
    "Schwartz": {
        "role": "military associate",
        "category": "military",
        "extra_aliases": ["Schwartz", "Fritz Schwarz", "Fritz Schwartz"],
    },
    "Hans Nissen": {
        "role": "community member",
        "category": "community",
        "extra_aliases": ["Hans Nissen", "H. Nissen"],
    },
    "Ellen": {
        "role": "community member",
        "category": "community",
        "extra_aliases": ["Ellen"],
    },
    "Skopnik": {
        "role": "military figure",
        "category": "military",
        "extra_aliases": ["Skopnik"],
    },
    "Henningsen": {
        "role": "military associate",
        "category": "military",
        "extra_aliases": ["Henningsen", "Walter Henningsen"],
    },
    "Maren Fog": {
        "role": "community member, friend of Trine",
        "category": "community",
        "extra_aliases": ["Maren Fog"],
    },
    "Thomas Nielsen": {
        "role": "community member",
        "category": "community",
        "extra_aliases": ["Thomas Nielsen", "Thomas"],
    },
    "Søren Møller": {
        "role": "community member",
        "category": "community",
        "extra_aliases": ["Søren Møller"],
    },
    "Dorthea": {
        "role": "community member",
        "category": "community",
        "extra_aliases": ["Dorthea"],
    },
    "Walter": {
        "role": "military associate",
        "category": "military",
        "extra_aliases": ["Walter", "Valter"],
    },
    "P. Barsballe": {
        "role": "community member",
        "category": "community",
        "extra_aliases": ["P. Barsballe", "P. Barsballes"],
    },
    "Georg Stilke": {
        "role": "community member",
        "category": "community",
        "extra_aliases": ["Georg Stilke"],
    },
    "Callesen": {
        "role": "community member",
        "category": "community",
        "extra_aliases": ["Callesen"],
    },
    "P. Jensen": {
        "role": "community member",
        "category": "community",
        "extra_aliases": ["P. Jensen"],
    },
    "Asmus": {
        "role": "community member",
        "category": "community",
        "extra_aliases": ["Asmus", "Asmus Rahr"],
    },
}

# Entities from entity-audit that are NOT real persons (removed, reclassified,
# or NER noise). We skip these when building the registry.
SKIP_ENTITIES = {
    # Removed in audit
    "Gud", "Guds", "Regt", "Feldv", "Feldw", "Feldveblen", "Major", "Leutn",
    "Gefr", "Gefreiter", "Hejmdal",
    # Reclassified to LOC
    "Bromberg", "Roagger", "Arys", "Halle", "Hadersleben", "Laon", "Marne",
    "Løtzen", "Bakkely",
    # Not persons — military ranks/abbreviations/noise
    "Oberstl", "Oberstleutn", "Feldvebel", "Feldwebel", "Hauptm", "Feldm",
    "Thelegram", "Thelephonen", "Holst", "Holstein", "Ravnholdt", "Ravnhold",
    "Kreis Hadersleben", "Herrn", "Keks", "Offz", "Frifeldt",
    # Noise / not persons
    "j eg", "kanske", "Kanske", "aa", "lee", "fr.", "Frau", "Lieber",
    "P.", "B.", "M.", "T.", "K.", "V.C.", "P.G.", "San",
    "Titanics", "Mark", "Flieger", "Kittel",
    # Places misclassified as persons
    "Borovikischki", "Kovno", "Stendal", "Wilna", "Cessieres", "Mühlhausen",
    "Vodder", "Ålen", "Aryz", "Zollenspieker", "Varschau", "Poniewiez",
    "Ponnevittz", "Obling", "Obling pr", "Grodno", "Rønne", "Hindenborgs",
    "Hindenburg",  # ambiguous, more location than person
    # Address fragments
    "Willa Fred", "Mærsk Roagger", "hans Leutn", "Peter Gefr",
    # Duplicates that will be merged into known persons
    "Trine Gad Ravnhold", "Trine G. Mærsk", "Trine Gad", "Trine Gad Roagger",
    "Peter Mærsk", "Peter Marsk", "Peters", "Peterlil", "Trinelil", "Trines",
    "Märsk", "Mærsk", "J. P. Marsk", "J. P. Mærsk", "J. P. Marsk Roagger",
    "Mærsk Regt", "Peter Gad", "Peter Petersen", "Peter J.", "Peter Højer",
    "Jes Mærsk",  # separate person but keeping as own entry
    "Moer", "Maren Mærsk", "Faer",
    "Konov", "Konovs", "Wilhelm Konow",
    "Uffes",
    "Signes", "Ivers", "Poulsens",
    "Fritz Schwarz", "Fritz Schwartz",
    "Kjærs", "N. Kjær", "Niels Kjær", "Niels Skau", "N. Skau",
    "Hans Nissen", "H. Nissen",
    "Walter Henningsen", "Valter",
    "Maren Fog", "Maren Hansen", "Maren Bøjlesen",
    "Thomas Nielsen", "Thomas",
    "P. Barsballe", "P. Barsballes",
    "Asmus Rahr",
    "P. Gad", "P. Gads",
    "Obl. Grabovski", "Regulski",
}

# Entities that are actually separate persons we keep as-is even though
# their canonical overlaps with SKIP
KEEP_DESPITE_SKIP = {
    "Jes Mærsk", "Peter Højer",
}


def load_entity_audit():
    """Load confirmed persons from the entity audit."""
    with open(DATA_DIR / "entity-audit.json", "r", encoding="utf-8") as f:
        audit = json.load(f)
    return audit


def load_letter_entities():
    """Load per-letter entity mapping."""
    with open(DATA_DIR / "letter-entities-draft.json", "r", encoding="utf-8") as f:
        return json.load(f)


def load_letters_csv():
    """Load letter metadata for dates."""
    letters = {}
    with open(DATA_DIR / "letters.csv", "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            letters[str(row["id"])] = row
    return letters


def build_alias_to_canonical_map(known_persons):
    """Build a mapping from alias text -> canonical name for known persons."""
    alias_map = {}
    for canonical, info in known_persons.items():
        for alias in info["extra_aliases"]:
            alias_map[alias] = canonical
    return alias_map


def compute_letter_stats(letter_entities, letters_csv, alias_map, confirmed_canonicals):
    """
    For each canonical person, compute:
      - letter_count: number of distinct letters mentioning them
      - first_mention: earliest letter date
      - last_mention: latest letter date
    """
    # canonical -> set of letter_ids
    person_letters = defaultdict(set)

    for letter_id, entities in letter_entities.items():
        persons = entities.get("persons", [])
        for person_text in persons:
            # Try alias map first (for known persons)
            canonical = alias_map.get(person_text)
            if canonical and canonical in confirmed_canonicals:
                person_letters[canonical].add(letter_id)
            # Also try exact match against confirmed canonicals
            elif person_text in confirmed_canonicals:
                person_letters[person_text].add(letter_id)

    # Compute date ranges
    stats = {}
    for canonical, letter_ids in person_letters.items():
        dates = []
        for lid in letter_ids:
            if lid in letters_csv and letters_csv[lid].get("date"):
                dates.append(letters_csv[lid]["date"])
        dates.sort()
        stats[canonical] = {
            "letter_count": len(letter_ids),
            "first_mention": dates[0] if dates else None,
            "last_mention": dates[-1] if dates else None,
        }
    return stats


def main():
    print("=" * 60)
    print("ADR-016 Phase B2: Building Person Registry")
    print("=" * 60)

    # Load data
    audit = load_entity_audit()
    letter_entities = load_letter_entities()
    letters_csv = load_letters_csv()

    confirmed = audit["confirmed_persons"]
    print(f"\nLoaded {len(confirmed)} confirmed person entries from entity-audit.json")
    print(f"Loaded {len(letter_entities)} letters from letter-entities-draft.json")
    print(f"Loaded {len(letters_csv)} letters from letters.csv")

    # Build alias map for known persons
    alias_map = build_alias_to_canonical_map(KNOWN_PERSONS)

    # Build set of canonical names we want in the registry.
    # Start with known persons, then add unknown confirmed persons with count >= 3.
    # We need to figure out which confirmed persons map to which known person.

    # First, collect all confirmed canonicals and their aliases
    # Map: confirmed canonical -> all aliases from audit
    audit_persons = {}
    for entry in confirmed:
        c = entry["canonical"]
        audit_persons[c] = {
            "aliases": entry["aliases"],
            "total_count": entry["total_count"],
            "action": entry["action"],
        }

    # Determine which confirmed entries are covered by known persons
    # (via alias map) and which are independent
    covered_by_known = set()
    for entry in confirmed:
        c = entry["canonical"]
        if c in alias_map:
            covered_by_known.add(c)
        for a in entry["aliases"]:
            if a in alias_map:
                covered_by_known.add(c)

    # Also add items in SKIP_ENTITIES
    for entry in confirmed:
        c = entry["canonical"]
        if c in SKIP_ENTITIES and c not in KEEP_DESPITE_SKIP:
            covered_by_known.add(c)

    # Build the registry
    registry = []
    MIN_MENTIONS = 3

    # 1. Add known persons
    # Compute letter stats using alias map
    # We need the set of canonical names that will be in the registry
    known_canonicals = set(KNOWN_PERSONS.keys())

    # For unknown persons (not covered by known, not skipped), with count >= 3
    unknown_persons = {}
    excluded_count = 0
    for entry in confirmed:
        c = entry["canonical"]
        if c in covered_by_known:
            continue
        if c in SKIP_ENTITIES:
            continue
        if entry["total_count"] >= MIN_MENTIONS:
            unknown_persons[c] = entry
        else:
            excluded_count += 1

    all_canonicals = known_canonicals | set(unknown_persons.keys())

    # Compute letter stats
    stats = compute_letter_stats(letter_entities, letters_csv, alias_map, all_canonicals)

    # Build known person entries
    for canonical, info in KNOWN_PERSONS.items():
        s = stats.get(canonical, {"letter_count": 0, "first_mention": None, "last_mention": None})

        # Collect all aliases that actually appear in the data
        # Start with the known aliases, filter to those in the audit
        all_aliases = set(info["extra_aliases"])
        # Also add aliases from audit entries that map to this canonical
        for entry in confirmed:
            for a in entry["aliases"]:
                if alias_map.get(a) == canonical:
                    all_aliases.add(a)
            if entry["canonical"] in alias_map and alias_map[entry["canonical"]] == canonical:
                all_aliases.update(entry["aliases"])

        # Sort aliases: canonical first, then alphabetical
        alias_list = sorted(all_aliases)
        if canonical in alias_list:
            alias_list.remove(canonical)
            alias_list.insert(0, canonical)

        entry_obj = {
            "id": canonical.lower().replace(" ", "_").replace(".", ""),
            "canonical": canonical,
            "aliases": alias_list,
            "role": info["role"],
            "category": info["category"],
            "letter_count": s["letter_count"],
            "first_mention": s["first_mention"],
            "last_mention": s["last_mention"],
        }
        registry.append(entry_obj)

    # Build unknown person entries
    for canonical, entry in unknown_persons.items():
        s = stats.get(canonical, {"letter_count": 0, "first_mention": None, "last_mention": None})
        entry_obj = {
            "id": canonical.lower().replace(" ", "_").replace(".", ""),
            "canonical": canonical,
            "aliases": entry["aliases"],
            "role": "unknown",
            "category": "unknown",
            "letter_count": s["letter_count"],
            "first_mention": s["first_mention"],
            "last_mention": s["last_mention"],
        }
        registry.append(entry_obj)

    # Sort by letter_count descending, then canonical name
    registry.sort(key=lambda x: (-x["letter_count"], x["canonical"]))

    # Write output
    output_path = DATA_DIR / "person-registry.json"
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(registry, f, ensure_ascii=False, indent=2)

    # Print summary
    print(f"\n{'=' * 60}")
    print("SUMMARY")
    print(f"{'=' * 60}")
    print(f"Total persons in registry: {len(registry)}")

    categories = defaultdict(int)
    for entry in registry:
        categories[entry["category"]] += 1
    print(f"\nBreakdown by category:")
    for cat, count in sorted(categories.items(), key=lambda x: -x[1]):
        print(f"  {cat}: {count}")

    print(f"\nPersons excluded by threshold (count < {MIN_MENTIONS}): {excluded_count}")

    # Also count how many confirmed entries with count >= 3 were skipped as noise
    noise_skipped = 0
    for entry in confirmed:
        c = entry["canonical"]
        if c in SKIP_ENTITIES and c not in KEEP_DESPITE_SKIP and entry["total_count"] >= MIN_MENTIONS:
            noise_skipped += 1
    print(f"Entities with count >= {MIN_MENTIONS} filtered as non-persons/noise: {noise_skipped}")

    print(f"\nTop 20 persons by letter count:")
    for entry in registry[:20]:
        print(f"  {entry['canonical']:25s}  letters={entry['letter_count']:4d}  "
              f"category={entry['category']:10s}  role={entry['role']}")

    print(f"\nOutput written to: {output_path}")


if __name__ == "__main__":
    main()
