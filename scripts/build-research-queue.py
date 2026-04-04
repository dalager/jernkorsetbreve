#!/usr/bin/env python3
"""
ADR-044: Build Research Queue for External Record Cross-Referencing

Generates data/external-records/research-queue.json from:
  - data/person-registry.json (all known persons)
  - data/social-network.json (disappearance metadata)

If an existing research-queue.json exists, preserves the 'status' field
for persons that have already been started (so that re-running the script
does not reset "in_progress" items to "not_started").

Usage:
    python scripts/build-research-queue.py
"""

import json
import sys
from datetime import date
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
OUTPUT_DIR = DATA_DIR / "external-records"

# ---------------------------------------------------------------------------
# Source recommendations per category / situation
# ---------------------------------------------------------------------------
MILITARY_DISAPPEARED_SOURCES = ["verlustlisten", "historisk_sonderjylland", "bundesarchiv"]
MILITARY_SOURCES = ["verlustlisten", "historisk_sonderjylland"]
FAMILY_SOURCES = ["ao_dk", "familysearch", "rigsarkivet"]
COMMUNITY_SURNAME_SOURCES = ["ao_dk", "familysearch"]
COMMUNITY_DISAPPEARED_SOURCES = ["ao_dk", "familysearch", "verlustlisten"]
UNKNOWN_SOURCES = ["ao_dk", "familysearch"]
UNKNOWN_DISAPPEARED_SOURCES = ["ao_dk", "familysearch", "verlustlisten"]

# Core family member IDs (Priority 2)
CORE_FAMILY_IDS = {"peter", "trine", "far", "mor", "signe", "musse", "bodil"}

# Minimum letter count for Priority 4 (unknown persons)
MIN_UNKNOWN_LETTERS = 5

# Historical context for search strategies
BATTLE_CONTEXT = {
    1915: "Second Battle of Ypres (April–May 1915)",
    1916: "Battle of the Somme (July–Nov 1916), Verdun (Feb–Dec 1916)",
    1917: "Third Battle of Ypres / Passchendaele (July–Nov 1917), Arras (April 1917)",
    1918: "Spring Offensive (March–July 1918), Hundred Days (Aug–Nov 1918)",
}


def load_json(path):
    """Load a JSON file with UTF-8 encoding."""
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def load_existing_statuses(output_path):
    """
    Load status fields from an existing research-queue.json.
    Returns a dict: person_id -> status string.
    """
    statuses = {}
    if not output_path.exists():
        return statuses
    try:
        data = load_json(output_path)
        for priority_group in data.get("priorities", []):
            for person in priority_group.get("persons", []):
                pid = person.get("person_id")
                status = person.get("status", "not_started")
                if pid and status != "not_started":
                    statuses[pid] = status
    except (json.JSONDecodeError, KeyError):
        print("Warning: could not parse existing research-queue.json, ignoring.", file=sys.stderr)
    return statuses


def build_disappearance_map(social_network):
    """
    Build a dict: person_id -> disappearance metadata from social-network.json.
    Only includes persons where disappeared == true.
    """
    dmap = {}
    for node in social_network.get("nodes", []):
        if node.get("disappeared"):
            dmap[node["id"]] = {
                "disappearance_year": node.get("disappearance_year"),
                "silence_date": node.get("silence_date"),
                "silence_duration_days": node.get("silence_duration_days"),
            }
    return dmap


def has_surname(person):
    """Check if a person has a recognizable surname (multi-word canonical or alias)."""
    if " " in person["canonical"]:
        return True
    for alias in person.get("aliases", []):
        if " " in alias and not alias.startswith("din ") and not alias.startswith("min "):
            return True
    return False


def generate_military_strategy(person, disappearance):
    """Generate search strategy for disappeared military personnel."""
    year = disappearance["disappearance_year"]
    last = person.get("last_mention", "unknown")
    context = BATTLE_CONTEXT.get(year, "")
    surname = person["canonical"]

    strategy = f"Search Verlustlisten for {surname} in lists from the period around {last}."
    if context:
        strategy += f" Date aligns with {context}."

    # Check for known aliases that might be first names
    aliases = person.get("aliases", [])
    first_names = [a for a in aliases if " " in a and a != person["canonical"]]
    if first_names:
        strategy += f" Also search as {', '.join(first_names)}."

    strategy += " Cross-ref with regiment if identified."
    return strategy


def generate_family_strategy(person):
    """Generate search strategy for core family members."""
    canonical = person["canonical"]
    aliases = person.get("aliases", [])

    if person["id"] == "peter":
        return ("Search Roagger kirkebog for Peter Mærsk/Marsk born ~1885–1895. "
                "Confirm regiment from letter addresses. Search Standesamt Roager. "
                "Build deployment timeline from letter metadata.")
    elif person["id"] == "trine":
        return ("Search Roagger kirkebog for Trine Gad born ~1885–1895. "
                "Look for marriage to Peter Mærsk/Marsk. Also search Ravnhold address.")
    elif person["id"] == "far":
        return ("Identify Peter's father via kirkebog entry for Peter's birth in "
                "Roagger parish. Search folketælling for Mærsk/Marsk households ~1900–1906.")
    elif person["id"] == "mor":
        return ("Identify Peter's mother via kirkebog entry for Peter's birth. "
                "Alias 'Maren Mærsk' suggests first name Maren.")
    else:
        return (f"Search Roagger kirkebog and census for {canonical} in the "
                f"Mærsk/Gad family. Determine relationship to Peter and Trine.")


def generate_community_strategy(person, disappearance):
    """Generate search strategy for community members."""
    canonical = person["canonical"]
    surname = has_surname(person)

    if surname:
        strategy = f"Search Roagger kirkebog and folketælling for {canonical}."
    else:
        strategy = (f"Search Roagger census for {canonical}. "
                    f"Common name — additional context from letters needed.")

    if disappearance:
        year = disappearance["disappearance_year"]
        strategy += f" Disappeared {year} — check Verlustlisten if military age."

    return strategy


def generate_unknown_strategy(person, disappearance):
    """Generate search strategy for unknown-category persons."""
    canonical = person["canonical"]
    surname = has_surname(person)

    if surname:
        strategy = f"Search Roagger area records for {canonical}."
    else:
        strategy = f"Search Roagger census for {canonical}. May need letter context for identification."

    if disappearance:
        year = disappearance["disappearance_year"]
        strategy += f" Disappeared {year} — check Verlustlisten."

    return strategy


def build_person_entry(person, disappearance, strategy, sources, existing_statuses):
    """Build a single person entry for the research queue."""
    entry = {
        "person_id": person["id"],
        "canonical": person["canonical"],
        "letter_count": person.get("letter_count", 0),
    }

    if person.get("last_mention"):
        entry["last_mention"] = person["last_mention"]

    entry["category"] = person.get("category", "unknown")

    if disappearance:
        entry["disappearance_year"] = disappearance.get("disappearance_year")

    entry["search_strategy"] = strategy
    entry["recommended_sources"] = sources

    # Preserve existing status if not "not_started"
    entry["status"] = existing_statuses.get(person["id"], "not_started")

    return entry


def main():
    print("=" * 60)
    print("ADR-044: Building Research Queue")
    print("=" * 60)

    # Load data
    registry = load_json(DATA_DIR / "person-registry.json")
    social_network = load_json(DATA_DIR / "social-network.json")

    print(f"Loaded {len(registry)} persons from person-registry.json")
    print(f"Loaded {len(social_network.get('nodes', []))} nodes from social-network.json")

    # Build lookup structures
    disappearance_map = build_disappearance_map(social_network)
    print(f"Found {len(disappearance_map)} disappeared persons in social-network.json")

    # Load existing statuses to preserve
    output_path = OUTPUT_DIR / "research-queue.json"
    existing_statuses = load_existing_statuses(output_path)
    if existing_statuses:
        print(f"Preserving {len(existing_statuses)} non-default statuses from existing queue")

    # Build person lookup by id
    persons_by_id = {p["id"]: p for p in registry}

    # ---------------------------------------------------------------------------
    # Priority 1: Disappeared military personnel
    # ---------------------------------------------------------------------------
    priority1_persons = []
    for person in registry:
        pid = person["id"]
        if person.get("category") == "military" and pid in disappearance_map:
            disappearance = disappearance_map[pid]
            strategy = generate_military_strategy(person, disappearance)
            sources = MILITARY_DISAPPEARED_SOURCES
            entry = build_person_entry(person, disappearance, strategy, sources, existing_statuses)
            entry["notes"] = (f"Disappeared {disappearance['disappearance_year']}. "
                              f"Silence duration: {disappearance['silence_duration_days']} days.")
            priority1_persons.append(entry)

    # Sort by letter_count descending
    priority1_persons.sort(key=lambda x: -x["letter_count"])

    # ---------------------------------------------------------------------------
    # Priority 2: Core family identification
    # ---------------------------------------------------------------------------
    priority2_persons = []
    for pid in CORE_FAMILY_IDS:
        if pid not in persons_by_id:
            continue
        person = persons_by_id[pid]
        disappearance = disappearance_map.get(pid)
        strategy = generate_family_strategy(person)
        sources = FAMILY_SOURCES[:]
        # Peter also needs military sources
        if pid == "peter":
            sources = ["ao_dk", "familysearch", "rigsarkivet", "verlustlisten", "bundesarchiv"]
        entry = build_person_entry(person, disappearance, strategy, sources, existing_statuses)
        priority2_persons.append(entry)

    # Sort by letter_count descending
    priority2_persons.sort(key=lambda x: -x["letter_count"])

    # ---------------------------------------------------------------------------
    # Priority 3: Community members with surnames (+ non-disappeared military)
    # Also includes family members not in core family, and community without surnames
    # ---------------------------------------------------------------------------
    priority3_persons = []
    already_queued = (
        {e["person_id"] for e in priority1_persons}
        | {e["person_id"] for e in priority2_persons}
    )

    for person in registry:
        pid = person["id"]
        if pid in already_queued:
            continue
        cat = person.get("category", "unknown")
        if cat == "unknown":
            continue  # handled in Priority 4

        disappearance = disappearance_map.get(pid)

        if cat == "military":
            strategy = (f"Search Verlustlisten and Historisk Sønderjylland for "
                        f"{person['canonical']}.")
            sources = MILITARY_SOURCES
        elif cat == "community":
            strategy = generate_community_strategy(person, disappearance)
            sources = COMMUNITY_DISAPPEARED_SOURCES if disappearance else COMMUNITY_SURNAME_SOURCES
        elif cat == "family":
            strategy = generate_family_strategy(person)
            sources = FAMILY_SOURCES
        else:
            continue

        entry = build_person_entry(person, disappearance, strategy, sources, existing_statuses)
        if disappearance:
            entry["notes"] = f"Disappeared {disappearance['disappearance_year']}."
        priority3_persons.append(entry)

    priority3_persons.sort(key=lambda x: -x["letter_count"])

    # ---------------------------------------------------------------------------
    # Priority 4: Unknown persons with >= MIN_UNKNOWN_LETTERS mentions
    # ---------------------------------------------------------------------------
    priority4_persons = []
    for person in registry:
        pid = person["id"]
        if pid in already_queued:
            continue
        if person.get("category") != "unknown":
            continue
        if person.get("letter_count", 0) < MIN_UNKNOWN_LETTERS:
            continue

        disappearance = disappearance_map.get(pid)
        strategy = generate_unknown_strategy(person, disappearance)
        sources = UNKNOWN_DISAPPEARED_SOURCES if disappearance else UNKNOWN_SOURCES

        entry = build_person_entry(person, disappearance, strategy, sources, existing_statuses)
        if disappearance:
            entry["notes"] = f"Disappeared {disappearance['disappearance_year']}."
        priority4_persons.append(entry)

    priority4_persons.sort(key=lambda x: -x["letter_count"])

    # ---------------------------------------------------------------------------
    # Assemble output
    # ---------------------------------------------------------------------------
    output = {
        "generated_from": "data/person-registry.json + data/social-network.json",
        "generated_at": date.today().isoformat(),
        "description": ("Prioritized research queue for cross-referencing persons "
                        "against external historical records. "
                        "Generated by scripts/build-research-queue.py."),
        "priorities": [
            {
                "priority": 1,
                "label": "Disappeared military personnel",
                "rationale": ("Verlustlisten can definitively confirm casualties; "
                              "highest information gain"),
                "persons": priority1_persons,
            },
            {
                "priority": 2,
                "label": "Core family identification",
                "rationale": ("Fills biographical picture; Roagger parish records "
                              "should have them"),
                "persons": priority2_persons,
            },
            {
                "priority": 3,
                "label": "Community members and other identified persons",
                "rationale": ("Surnames and known roles make them searchable in "
                              "parish records and census"),
                "persons": priority3_persons,
            },
            {
                "priority": 4,
                "label": "Unknown persons with 5+ mentions",
                "rationale": ("May be identifiable with census or church records"),
                "persons": priority4_persons,
            },
        ],
    }

    # Write output
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    # Print summary
    total = sum(len(p["persons"]) for p in output["priorities"])
    print(f"\n{'=' * 60}")
    print("SUMMARY")
    print(f"{'=' * 60}")
    print(f"Total persons in research queue: {total}")
    for p in output["priorities"]:
        count = len(p["persons"])
        print(f"  Priority {p['priority']}: {p['label']} — {count} persons")

    preserved = sum(1 for p in output["priorities"]
                    for person in p["persons"]
                    if person["status"] != "not_started")
    if preserved:
        print(f"\nPreserved {preserved} non-default statuses from previous run")

    print(f"\nOutput written to: {output_path}")


if __name__ == "__main__":
    main()
