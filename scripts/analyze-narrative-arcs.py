"""
Narrative arc analysis for WW1 Danish letters (ADR-015).

Analyzes emotional trajectory both within individual letters (arc shape
classification) and across the full correspondence (smoothed trend,
change points, emotional velocity).

Inputs:
  data/cvp-sentence-scores.json    per-sentence CVP scores with is_formulaic
  data/cvp-letter-scores.json      per-letter aggregated CVP scores
  data/letters.csv                 letter metadata (id, date, sender, ...)

Outputs:
  data/letter-narrative-arcs.json  within-letter arcs, across-letter trajectory,
                                   change points, and velocity transitions
"""

import argparse
import csv
import json
import os
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
# Data loading
# ---------------------------------------------------------------------------

def load_sentence_scores(path: str) -> list[dict]:
    with open(path, "r", encoding="utf-8") as f:
        sentences = json.load(f)
    assert len(sentences) >= 5000, (
        f"Expected >= 5000 sentences, got {len(sentences)}"
    )
    return sentences


def load_letter_scores(path: str) -> dict:
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def load_letters_csv(path: str) -> dict[str, dict]:
    """Return dict keyed by letter ID string with date and other metadata."""
    letters = {}
    with open(path, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            letters[row["id"]] = {
                "date": row["date"],
                "sender": row["sender"],
                "recipient": row["recipient"],
            }
    return letters


# ---------------------------------------------------------------------------
# Within-letter arc analysis
# ---------------------------------------------------------------------------

def classify_arc(scores: list[float]) -> str:
    """Classify the emotional arc shape of a letter from its sentence scores.

    Splits the sentence scores into three equal thirds and compares their
    means to determine the arc type.
    """
    n = len(scores)
    if n < 3:
        return "flat"

    third = n // 3
    first = np.mean(scores[:third])
    middle = np.mean(scores[third:2 * third])
    last = np.mean(scores[2 * third:])

    threshold = 0.1

    # Valley: middle dips below both ends
    if middle < min(first, last) - threshold:
        return "valley"

    # Peak: middle rises above both ends
    if middle > max(first, last) + threshold:
        return "peak"

    # Rising: end higher than start
    if last > first + threshold:
        return "rising"

    # Falling: start higher than end
    if first > last + threshold:
        return "falling"

    return "flat"


def analyze_within_letter(sentences: list[dict]) -> dict:
    """Analyze the emotional arc within each letter.

    Groups sentences by letter_id, filters to substantive (non-formulaic)
    sentences, and classifies the arc shape.
    """
    by_letter: dict[int, list[dict]] = defaultdict(list)
    for s in sentences:
        by_letter[s["letter_id"]].append(s)

    results = {}
    for letter_id, sents in sorted(by_letter.items()):
        # Sort by sentence index within the letter
        sents.sort(key=lambda x: x["index"])

        # Filter to substantive sentences
        substantive = [s for s in sents if not s["is_formulaic"]]
        if not substantive:
            substantive = sents

        scores = [s["score"] for s in substantive]
        n = len(scores)

        if n == 0:
            continue

        arc_type = classify_arc(scores)

        # Arc asymmetry: mean(second_half) - mean(first_half)
        mid = n // 2
        if mid > 0:
            asymmetry = float(np.mean(scores[mid:])) - float(np.mean(scores[:mid]))
        else:
            asymmetry = 0.0

        # Sentiment range
        sentiment_range = float(max(scores)) - float(min(scores))

        results[str(letter_id)] = {
            "arc_type": arc_type,
            "arc_asymmetry": round(asymmetry, 4),
            "sentiment_range": round(sentiment_range, 4),
            "sentence_count_substantive": n,
        }

    return results


# ---------------------------------------------------------------------------
# Across-letter arc analysis
# ---------------------------------------------------------------------------

def rolling_average(values: list[float], window: int = 15) -> list[float]:
    """Simple rolling average smoothing with symmetric window."""
    n = len(values)
    smoothed = []
    half = window // 2
    for i in range(n):
        start = max(0, i - half)
        end = min(n, i + half + 1)
        smoothed.append(float(np.mean(values[start:end])))
    return smoothed


def detect_change_points(values: list[float], threshold: float = 1.5) -> list[dict]:
    """Simple CUSUM change point detection.

    Returns a list of dicts with index and direction for each change point.
    """
    mean = np.mean(values)
    std = np.std(values)
    if std == 0:
        return []

    cusum_pos = np.zeros(len(values))
    cusum_neg = np.zeros(len(values))
    change_points = []

    for i in range(1, len(values)):
        cusum_pos[i] = max(0, cusum_pos[i - 1] + (values[i] - mean) / std - 0.5)
        cusum_neg[i] = max(0, cusum_neg[i - 1] - (values[i] - mean) / std - 0.5)

        if cusum_pos[i] > threshold:
            change_points.append({"index": i, "direction": "positive"})
            cusum_pos[i] = 0
            cusum_neg[i] = 0
        elif cusum_neg[i] > threshold:
            change_points.append({"index": i, "direction": "negative"})
            cusum_pos[i] = 0
            cusum_neg[i] = 0

    return change_points


def compute_velocity(values: list[float]) -> list[float]:
    """Emotional velocity: absolute difference between consecutive values."""
    return [abs(values[i + 1] - values[i]) for i in range(len(values) - 1)]


def analyze_across_letters(
    letter_scores: dict,
    letters_meta: dict[str, dict],
) -> dict:
    """Analyze emotional trajectory across the full correspondence.

    Orders letters by date, applies smoothing, detects change points,
    and identifies the highest-velocity transitions.
    """
    # Build ordered list of (letter_id, date, cvp_mean)
    ordered = []
    for lid, scores in letter_scores.items():
        meta = letters_meta.get(lid)
        if meta is None:
            continue
        ordered.append({
            "letter_id": int(lid),
            "date": meta["date"],
            "cvp_mean": scores["cvp_mean"],
        })

    # Sort by date, then by letter ID for stable ordering
    ordered.sort(key=lambda x: (x["date"], x["letter_id"]))

    if not ordered:
        return {
            "smoothed_trajectory": [],
            "change_points": [],
            "top_velocity_transitions": [],
        }

    values = [entry["cvp_mean"] for entry in ordered]
    smoothed = rolling_average(values, window=15)

    # Smoothed trajectory
    trajectory = []
    for i, entry in enumerate(ordered):
        trajectory.append({
            "letter_id": entry["letter_id"],
            "date": entry["date"],
            "cvp_mean": round(entry["cvp_mean"], 4),
            "smoothed": round(smoothed[i], 4),
        })

    # Change points
    raw_cps = detect_change_points(values)
    change_points = []
    for cp in raw_cps:
        idx = cp["index"]
        change_points.append({
            "index": idx,
            "letter_id": ordered[idx]["letter_id"],
            "date": ordered[idx]["date"],
            "direction": cp["direction"],
        })

    # Emotional velocity and top transitions
    velocities = compute_velocity(values)
    transitions = []
    for i, vel in enumerate(velocities):
        transitions.append({
            "from_id": ordered[i]["letter_id"],
            "to_id": ordered[i + 1]["letter_id"],
            "velocity": round(vel, 4),
            "from_date": ordered[i]["date"],
            "to_date": ordered[i + 1]["date"],
        })

    # Top 10 highest-velocity transitions
    transitions.sort(key=lambda x: x["velocity"], reverse=True)
    top_transitions = transitions[:10]

    return {
        "smoothed_trajectory": trajectory,
        "change_points": change_points,
        "top_velocity_transitions": top_transitions,
    }


# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------

def print_summary(within: dict, across: dict, distribution: dict) -> None:
    print("\n--- Narrative Arc Summary ---")
    print(f"  Letters analyzed (within): {len(within)}")
    print(f"  Letters analyzed (across): {len(across['smoothed_trajectory'])}")
    print(f"  Change points detected:   {len(across['change_points'])}")
    print()
    print("  Arc type distribution:")
    for arc_type, count in sorted(distribution.items(), key=lambda x: -x[1]):
        print(f"    {arc_type:>8s}: {count}")
    print()

    if across["top_velocity_transitions"]:
        top = across["top_velocity_transitions"][0]
        print(
            f"  Largest emotional jump: {top['velocity']:.4f} "
            f"(letter {top['from_id']} -> {top['to_id']}, "
            f"{top['from_date']} -> {top['to_date']})"
        )

    if across["change_points"]:
        print(f"  First change point: letter {across['change_points'][0]['letter_id']} "
              f"({across['change_points'][0]['date']}, "
              f"{across['change_points'][0]['direction']})")
    print()


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    parser = argparse.ArgumentParser(
        description="Narrative arc analysis for WW1 Danish letters (ADR-015)"
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
    letter_path = resolve("cvp-letter-scores.json")
    csv_path = resolve("letters.csv")
    output_path = resolve("letter-narrative-arcs.json")

    # Validate inputs
    for label, path in [
        ("Sentence scores", sentence_path),
        ("Letter scores", letter_path),
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
    letter_scores = load_letter_scores(letter_path)
    letters_meta = load_letters_csv(csv_path)

    # Within-letter analysis
    print("Analyzing within-letter arcs...")
    within = analyze_within_letter(sentences)

    # Arc type distribution
    distribution: dict[str, int] = defaultdict(int)
    for entry in within.values():
        distribution[entry["arc_type"]] += 1

    # Across-letter analysis
    print("Analyzing across-letter trajectory...")
    across = analyze_across_letters(letter_scores, letters_meta)

    # Summary
    print_summary(within, across, dict(distribution))

    if args.dry_run:
        print("Dry run — no files written.")
        sys.exit(0)

    # Build output
    output = {
        "within_letter": within,
        "across_letters": across,
        "arc_type_distribution": dict(distribution),
    }

    print(f"Writing {output_path}...")
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    print(f"Wrote {output_path}")


if __name__ == "__main__":
    main()
