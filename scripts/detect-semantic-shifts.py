"""
Semantic shift detection for WW1 Danish letters (ADR-015).

Detects how specific words shift in contextual meaning across Peter's
correspondence by tracking the sentiment context (CVP scores) of sentences
containing each target word, grouped by year.

Inputs:
  data/cvp-sentence-scores.json    per-sentence CVP scores with text
  data/letters.csv                 letter metadata (id, date, ...)

Outputs:
  data/semantic-shifts.json        per-word yearly CVP stats, drift,
                                   fossilization indices, and rankings
"""

import argparse
import csv
import json
import os
import re
import sys
from collections import defaultdict

import numpy as np

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(SCRIPT_DIR, os.pardir, "data")


def resolve(path: str) -> str:
    return os.path.normpath(os.path.join(DATA_DIR, path))


# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

TARGET_WORDS = [
    "godt", "hjem", "glad", "stille", "arbejde",
    "vel", "ellers", "nok", "bedre", "kære",
]

# ---------------------------------------------------------------------------
# Data loading
# ---------------------------------------------------------------------------

def load_sentence_scores(path: str) -> list[dict]:
    with open(path, "r", encoding="utf-8") as f:
        sentences = json.load(f)
    assert len(sentences) >= 5000, (
        f"Expected >= 5000 sentences, got {len(sentences)}"
    )
    return sentences


def load_letter_dates(path: str) -> dict[int, str]:
    """Return dict mapping integer letter ID to date string."""
    dates = {}
    with open(path, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            dates[int(row["id"])] = row["date"]
    return dates


# ---------------------------------------------------------------------------
# Analysis
# ---------------------------------------------------------------------------

def extract_year(date_str: str) -> str:
    """Extract year from a date string like '1914-08-15'."""
    return date_str[:4]


def word_in_text(word: str, text: str) -> bool:
    """Check if word appears in text as a whole word (case-insensitive)."""
    pattern = r"\b" + re.escape(word) + r"\b"
    return bool(re.search(pattern, text, re.IGNORECASE))


def fossilization_index(std_by_year: list[float]) -> float:
    """Negative slope of std over time = fossilization.

    A word becoming more fixed in usage (decreasing variability in its
    sentiment context) has a negative fossilization index.
    """
    if len(std_by_year) < 2:
        return 0.0
    x = np.arange(len(std_by_year))
    slope = np.polyfit(x, std_by_year, 1)[0]
    return round(float(slope), 6)


def analyze_word(
    word: str,
    sentences: list[dict],
    letter_dates: dict[int, str],
) -> dict:
    """Analyze a single target word across the full correspondence.

    Finds all sentences containing the word, groups by year, and computes
    yearly CVP statistics, drift between consecutive years, and the
    fossilization index.
    """
    # Find all sentences containing the word
    matching = []
    for s in sentences:
        if word_in_text(word, s["text"]):
            date = letter_dates.get(s["letter_id"])
            if date:
                matching.append({
                    "score": s["score"],
                    "year": extract_year(date),
                })

    total_occurrences = len(matching)

    # Group by year
    by_year: dict[str, list[float]] = defaultdict(list)
    for m in matching:
        by_year[m["year"]].append(m["score"])

    # Compute per-year stats
    yearly_stats = {}
    sorted_years = sorted(by_year.keys())
    for year in sorted_years:
        scores = by_year[year]
        yearly_stats[year] = {
            "count": len(scores),
            "mean_cvp": round(float(np.mean(scores)), 4),
            "std_cvp": round(float(np.std(scores)), 4),
        }

    # Drift: difference between consecutive year means
    drift = []
    for i in range(1, len(sorted_years)):
        prev_year = sorted_years[i - 1]
        curr_year = sorted_years[i]
        delta = yearly_stats[curr_year]["mean_cvp"] - yearly_stats[prev_year]["mean_cvp"]
        drift.append({
            "from": prev_year,
            "to": curr_year,
            "delta_mean": round(delta, 4),
        })

    # Fossilization index from std values over time
    std_values = [yearly_stats[y]["std_cvp"] for y in sorted_years]
    fossil_idx = fossilization_index(std_values)

    return {
        "total_occurrences": total_occurrences,
        "by_year": yearly_stats,
        "drift": drift,
        "fossilization_index": fossil_idx,
    }


def rank_words(word_results: dict[str, dict]) -> tuple[list[str], list[str]]:
    """Rank words by fossilization (most negative slope) and by total drift.

    Returns (most_fossilized, most_shifted) — each a list of up to 3 words.
    """
    # Most fossilized: most negative fossilization_index
    fossilized = sorted(
        word_results.items(),
        key=lambda x: x[1]["fossilization_index"],
    )
    most_fossilized = [w for w, _ in fossilized[:3]]

    # Most shifted: largest total absolute drift
    def total_drift(entry: dict) -> float:
        return sum(abs(d["delta_mean"]) for d in entry["drift"])

    shifted = sorted(
        word_results.items(),
        key=lambda x: total_drift(x[1]),
        reverse=True,
    )
    most_shifted = [w for w, _ in shifted[:3]]

    return most_fossilized, most_shifted


# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------

def print_summary(
    word_results: dict[str, dict],
    most_fossilized: list[str],
    most_shifted: list[str],
) -> None:
    print("\n--- Semantic Shift Summary ---")
    print(f"  Target words analyzed: {len(word_results)}")
    print()
    print("  Per-word occurrences:")
    for word in sorted(word_results.keys()):
        entry = word_results[word]
        years = sorted(entry["by_year"].keys())
        year_range = f"{years[0]}-{years[-1]}" if years else "n/a"
        print(
            f"    {word:>10s}: {entry['total_occurrences']:>4d} occurrences "
            f"({year_range}), fossilization={entry['fossilization_index']:+.6f}"
        )
    print()
    print(f"  Most fossilized: {', '.join(most_fossilized)}")
    print(f"  Most shifted:    {', '.join(most_shifted)}")
    print()


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    parser = argparse.ArgumentParser(
        description="Semantic shift detection for WW1 Danish letters (ADR-015)"
    )
    parser.add_argument(
        "--force", action="store_true",
        help="Force regeneration even if output exists",
    )
    parser.add_argument(
        "--dry-run", action="store_true",
        help="Compute and print stats but do not write output",
    )
    args = parser.parse_args()

    sentence_path = resolve("cvp-sentence-scores.json")
    csv_path = resolve("letters.csv")
    output_path = resolve("semantic-shifts.json")

    # Validate inputs
    for label, path in [
        ("Sentence scores", sentence_path),
        ("Letters CSV", csv_path),
    ]:
        if not os.path.exists(path):
            print(f"Error: {label} not found at {path}", file=sys.stderr)
            sys.exit(1)

    # Skip if output already exists (unless --force)
    if not args.force and os.path.exists(output_path):
        print(f"Output already exists at {output_path}. Use --force to regenerate.")
        sys.exit(0)

    # Load data
    print("Loading data...")
    sentences = load_sentence_scores(sentence_path)
    letter_dates = load_letter_dates(csv_path)

    # Analyze each target word
    print(f"Analyzing {len(TARGET_WORDS)} target words...")
    word_results = {}
    for word in TARGET_WORDS:
        word_results[word] = analyze_word(word, sentences, letter_dates)

    # Rankings
    most_fossilized, most_shifted = rank_words(word_results)

    # Summary
    print_summary(word_results, most_fossilized, most_shifted)

    if args.dry_run:
        print("Dry run — no files written.")
        sys.exit(0)

    # Build output
    output = {
        "target_words": word_results,
        "most_fossilized": most_fossilized,
        "most_shifted": most_shifted,
    }

    print(f"Writing {output_path}...")
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    print(f"Wrote {output_path}")


if __name__ == "__main__":
    main()
