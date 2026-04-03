"""
ADR-016 Task E1: Disappearance Analysis

Analyzes when persons stop being mentioned in the letters. Their
"disappearance" may signal casualties, transfers, lost contact, or
other historically significant events during WW1.

Usage:
    .venv/Scripts/python.exe scripts/adr016_e1_disappearance.py
"""

import csv
import json
from collections import defaultdict
from datetime import date, datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"

SOCIAL_NETWORK_PATH = DATA / "social-network.json"
LETTERS_CSV_PATH = DATA / "letters.csv"

# Threshold: person must be silent for > 6 months (183 days) before corpus end
SILENCE_THRESHOLD_DAYS = 183
# Minimum letter mentions to qualify as a disappearance (avoid flagging rare names)
MIN_MENTIONS = 5


def load_social_network():
    with open(SOCIAL_NETWORK_PATH, encoding="utf-8") as f:
        return json.load(f)


def find_corpus_end_date():
    """Find the date of the last letter in the corpus."""
    max_date = None
    with open(LETTERS_CSV_PATH, encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            d = row.get("date", "").strip()
            if d:
                try:
                    parsed = datetime.strptime(d, "%Y-%m-%d").date()
                    if max_date is None or parsed > max_date:
                        max_date = parsed
                except ValueError:
                    pass
    return max_date


def compute_regularity_score(years_active, first_mention, last_mention):
    """
    Ratio of years_active to the theoretical span from first to last mention.
    A score of 1.0 means the person was mentioned every year in their span.
    """
    if not years_active or not first_mention or not last_mention:
        return 0.0
    first_year = datetime.strptime(first_mention, "%Y-%m-%d").year
    last_year = datetime.strptime(last_mention, "%Y-%m-%d").year
    span = last_year - first_year + 1
    if span <= 0:
        return 1.0
    return round(min(len(years_active) / span, 1.0), 3)


def analyze_disappearances(network, corpus_end):
    """Compute disappearance metadata for each node."""
    nodes = network["nodes"]
    disappeared_persons = []

    for node in nodes:
        last_mention_str = node.get("last_mention")
        first_mention_str = node.get("first_mention")
        if not last_mention_str:
            continue

        last_mention = datetime.strptime(last_mention_str, "%Y-%m-%d").date()
        silence_duration = (corpus_end - last_mention).days

        # Regularity score
        regularity = compute_regularity_score(
            node.get("years_active", []),
            first_mention_str,
            last_mention_str,
        )

        # Disappearance flag
        letter_count = node.get("letter_count", 0)
        disappeared = (
            silence_duration > SILENCE_THRESHOLD_DAYS
            and letter_count >= MIN_MENTIONS
        )

        # Add fields to the node
        node["silence_date"] = last_mention_str
        node["silence_duration_days"] = silence_duration
        node["disappeared"] = disappeared
        node["regularity_score"] = regularity
        if disappeared:
            node["disappearance_year"] = last_mention.year
        else:
            node["disappearance_year"] = None

        if disappeared:
            disappeared_persons.append(
                {
                    "id": node["id"],
                    "canonical": node["canonical"],
                    "category": node.get("category", "unknown"),
                    "role": node.get("role", "unknown"),
                    "letter_count": letter_count,
                    "first_mention": first_mention_str,
                    "last_mention": last_mention_str,
                    "silence_duration_days": silence_duration,
                    "disappearance_year": last_mention.year,
                    "regularity_score": regularity,
                }
            )

    # Sort by silence_date (earliest disappearance first)
    disappeared_persons.sort(key=lambda p: p["last_mention"])

    # Disappearances by year
    by_year = defaultdict(int)
    for p in disappeared_persons:
        by_year[p["disappearance_year"]] += 1
    disappearance_by_year = dict(sorted(by_year.items()))

    # Military disappearances
    military = [p for p in disappeared_persons if p["category"] == "military"]

    analysis = {
        "corpus_end_date": corpus_end.isoformat(),
        "silence_threshold_days": SILENCE_THRESHOLD_DAYS,
        "min_mentions_threshold": MIN_MENTIONS,
        "total_persons": len(nodes),
        "disappeared_count": len(disappeared_persons),
        "disappeared_persons": disappeared_persons,
        "disappearance_by_year": disappearance_by_year,
        "military_disappearances": military,
        "military_disappearance_count": len(military),
        "civilian_disappearance_count": len(disappeared_persons) - len(military),
    }

    network["disappearance_analysis"] = analysis
    return network, analysis


def print_report(analysis):
    """Print a human-readable disappearance report."""
    sep = "=" * 70
    print()
    print(sep)
    print("  ADR-016 E1: DISAPPEARANCE ANALYSIS REPORT")
    print(sep)
    print()
    print(f"  Corpus end date:          {analysis['corpus_end_date']}")
    print(f"  Silence threshold:        > {analysis['silence_threshold_days']} days")
    print(f"  Min mentions threshold:   >= {analysis['min_mentions_threshold']}")
    print(f"  Total persons in network: {analysis['total_persons']}")
    print(f"  Persons who disappeared:  {analysis['disappeared_count']}")
    print()

    # Timeline
    print("-" * 70)
    print("  DISAPPEARANCE TIMELINE")
    print("-" * 70)
    for year, count in sorted(analysis["disappearance_by_year"].items()):
        bar = "#" * count
        print(f"    {year}: {bar} ({count})")
    print()

    # Military vs civilian
    print("-" * 70)
    print("  MILITARY vs CIVILIAN DISAPPEARANCES")
    print("-" * 70)
    mil = analysis["military_disappearance_count"]
    civ = analysis["civilian_disappearance_count"]
    total = analysis["disappeared_count"]
    print(f"    Military:  {mil:3d}  ({100*mil/total:.0f}%)" if total else "")
    print(f"    Civilian:  {civ:3d}  ({100*civ/total:.0f}%)" if total else "")
    print()

    # Detailed list
    print("-" * 70)
    print("  DISAPPEARED PERSONS (sorted by last mention)")
    print("-" * 70)
    print(
        f"  {'Name':<20} {'Category':<12} {'Last mention':<14} "
        f"{'Silent (d)':<12} {'Mentions':<10} {'Regularity'}"
    )
    print("  " + "-" * 80)
    for p in analysis["disappeared_persons"]:
        print(
            f"  {p['canonical']:<20} {p['category']:<12} {p['last_mention']:<14} "
            f"{p['silence_duration_days']:<12} {p['letter_count']:<10} "
            f"{p['regularity_score']:.2f}"
        )
    print()

    # Military detail
    if analysis["military_disappearances"]:
        print("-" * 70)
        print("  MILITARY DISAPPEARANCES (possible casualties / transfers)")
        print("-" * 70)
        for p in analysis["military_disappearances"]:
            print(
                f"    {p['canonical']:<20} role: {p['role']}"
            )
            print(
                f"      mentioned in {p['letter_count']} letters, "
                f"{p['first_mention']} to {p['last_mention']}, "
                f"regularity {p['regularity_score']:.2f}"
            )
            print(
                f"      silent {p['silence_duration_days']} days before corpus end"
            )
            print()

    # Notable patterns
    print("-" * 70)
    print("  NOTABLE PATTERNS")
    print("-" * 70)

    # Check for clusters (2+ disappearances in same year)
    clusters = {
        y: c for y, c in analysis["disappearance_by_year"].items() if c >= 2
    }
    if clusters:
        print("  Disappearance clusters (2+ persons in same year):")
        for year, count in sorted(clusters.items()):
            names = [
                p["canonical"]
                for p in analysis["disappeared_persons"]
                if p["disappearance_year"] == year
            ]
            print(f"    {year}: {count} persons - {', '.join(names)}")
        print()

    # High-regularity disappearances (consistent presence, then gone)
    high_reg = [
        p for p in analysis["disappeared_persons"] if p["regularity_score"] >= 0.8
    ]
    if high_reg:
        print("  High-regularity disappearances (score >= 0.80):")
        print("  These persons were consistently mentioned, then suddenly stopped.")
        for p in high_reg:
            print(
                f"    {p['canonical']:<20} regularity {p['regularity_score']:.2f}, "
                f"last seen {p['last_mention']}"
            )
        print()

    # Long-silent persons
    longest = sorted(
        analysis["disappeared_persons"],
        key=lambda p: p["silence_duration_days"],
        reverse=True,
    )[:5]
    if longest:
        print("  Longest silences:")
        for p in longest:
            years = p["silence_duration_days"] / 365.25
            print(
                f"    {p['canonical']:<20} {p['silence_duration_days']} days "
                f"({years:.1f} years)"
            )
    print()
    print(sep)
    print("  END OF REPORT")
    print(sep)


def main():
    print("Loading social-network.json ...")
    network = load_social_network()

    print("Scanning letters.csv for corpus end date ...")
    corpus_end = find_corpus_end_date()
    print(f"  Corpus end date: {corpus_end}")

    print("Computing disappearance analysis ...")
    network, analysis = analyze_disappearances(network, corpus_end)

    # Write updated network
    print(f"Writing updated social-network.json ...")
    with open(SOCIAL_NETWORK_PATH, "w", encoding="utf-8") as f:
        json.dump(network, f, indent=2, ensure_ascii=False)

    print_report(analysis)


if __name__ == "__main__":
    main()
