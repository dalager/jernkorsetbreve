"""
Audience divergence analysis comparing Peter's letters to Trine vs. parents (ADR-015).

Algorithm:
  1. Load letters.csv and classify each letter by audience (trine / parents / unknown)
  2. Load CVP letter scores and (optionally) psycholinguistic metrics
  3. Compute quarterly divergence: JSD on word frequencies, Wasserstein on sentiment,
     and Cohen's-d-style metric divergence for each psycholinguistic metric
  4. Identify same-date letter pairs for direct censorship analysis
  5. Output data/letter-audience-divergence.json

Inputs:
  data/letters.csv                    letter metadata and full text
  data/cvp-letter-scores.json         per-letter CVP sentiment scores
  data/letter-psycholinguistics.json   per-letter psycholinguistic metrics (optional)

Outputs:
  data/letter-audience-divergence.json  divergence analysis results
  data/audience-divergence-meta.json    skip-logic metadata
"""

import argparse
import csv
import hashlib
import json
import math
import os
import sys
from collections import Counter, defaultdict
from datetime import datetime, timezone

import numpy as np
from scipy.spatial.distance import jensenshannon
from scipy.stats import wasserstein_distance

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(SCRIPT_DIR, os.pardir, "data")


def resolve(path: str) -> str:
    return os.path.normpath(os.path.join(DATA_DIR, path))


# ---------------------------------------------------------------------------
# Skip logic (ADR-029)
# ---------------------------------------------------------------------------

def compute_file_hash(path: str) -> str:
    return hashlib.sha256(open(path, "rb").read()).hexdigest()


def should_skip(input_paths: list[str], meta_path: str) -> bool:
    """Check whether output is up to date based on input file hashes."""
    current = {"script_hash": compute_file_hash(__file__)}
    for p in input_paths:
        key = os.path.basename(p) + "_hash"
        current[key] = compute_file_hash(p)
    if not os.path.exists(meta_path):
        return False
    with open(meta_path, "r", encoding="utf-8") as f:
        existing = json.load(f)
    return all(existing.get(k) == v for k, v in current.items())


# ---------------------------------------------------------------------------
# Recipient classification
# ---------------------------------------------------------------------------

def classify_recipient(recipient: str) -> str:
    """Classify recipient as 'trine' or 'parents' or 'unknown'."""
    r = recipient.lower().strip()
    if "trine" in r:
        return "trine"
    elif any(w in r for w in ["forældre", "mor", "far", "moder", "fader", "hjem"]):
        return "parents"
    else:
        return "unknown"


# ---------------------------------------------------------------------------
# Quarter helpers
# ---------------------------------------------------------------------------

def date_to_quarter(date_str: str) -> str:
    """Convert ISO date string to quarter label, e.g. '1914-Q3'."""
    try:
        dt = datetime.strptime(date_str, "%Y-%m-%d")
    except ValueError:
        return "unknown"
    q = (dt.month - 1) // 3 + 1
    return f"{dt.year}-Q{q}"


# ---------------------------------------------------------------------------
# Word frequency divergence
# ---------------------------------------------------------------------------

def build_shared_vocab(texts_a: list[str], texts_b: list[str], top_n: int = 200) -> list[str]:
    """Build shared vocabulary from the union of two text collections."""
    combined = Counter()
    for text in texts_a + texts_b:
        words = text.lower().split()
        combined.update(words)
    return [word for word, _ in combined.most_common(top_n)]


def word_freq_distribution(texts: list[str], vocab: list[str]) -> np.ndarray:
    """Compute normalized word frequency distribution over vocab."""
    total = Counter()
    for text in texts:
        words = text.lower().split()
        total.update(words)
    freqs = np.array([total.get(w, 0) for w in vocab], dtype=float)
    freqs += 1e-10  # smoothing for JSD
    return freqs / freqs.sum()


# ---------------------------------------------------------------------------
# Metric divergence (Cohen's d style)
# ---------------------------------------------------------------------------

def metric_divergence(values_a: list[float], values_b: list[float]) -> float:
    """Compute abs(mean_a - mean_b) / pooled_std. Returns 0.0 if std is zero."""
    if not values_a or not values_b:
        return 0.0
    mean_a = np.mean(values_a)
    mean_b = np.mean(values_b)
    var_a = np.var(values_a, ddof=1) if len(values_a) > 1 else 0.0
    var_b = np.var(values_b, ddof=1) if len(values_b) > 1 else 0.0
    n_a = len(values_a)
    n_b = len(values_b)
    pooled_var = ((n_a - 1) * var_a + (n_b - 1) * var_b) / max(n_a + n_b - 2, 1)
    pooled_std = math.sqrt(pooled_var) if pooled_var > 0 else 0.0
    if pooled_std == 0.0:
        return 0.0
    return abs(float(mean_a) - float(mean_b)) / pooled_std


# ---------------------------------------------------------------------------
# Same-date pair analysis
# ---------------------------------------------------------------------------

def find_same_date_pairs(letters_by_date: dict[str, list[dict]]) -> list[dict]:
    """Find dates where Peter wrote to both Trine and parents."""
    pairs = []
    for date, letters in sorted(letters_by_date.items()):
        trine_letters = [l for l in letters if l["audience"] == "trine"]
        parent_letters = [l for l in letters if l["audience"] == "parents"]
        if trine_letters and parent_letters:
            pairs.append({
                "date": date,
                "trine_ids": [l["id"] for l in trine_letters],
                "parent_ids": [l["id"] for l in parent_letters],
            })
    return pairs


# ---------------------------------------------------------------------------
# Core analysis
# ---------------------------------------------------------------------------

PSYCHOLINGUISTIC_METRICS = [
    "hedging_rate",
    "first_person_singular_rate",
    "mattr",
    "mean_sentence_length",
    "german_density",
    "reassurance_count",
    "sentiment_volatility",
]


def load_letters(csv_path: str) -> list[dict]:
    """Load letters from CSV and classify by audience."""
    letters = []
    with open(csv_path, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            letter_id = row["id"].strip()
            audience = classify_recipient(row.get("recipient", ""))
            letters.append({
                "id": letter_id,
                "date": row.get("date", "").strip(),
                "sender": row.get("sender", "").strip(),
                "recipient": row.get("recipient", "").strip(),
                "audience": audience,
                "text": row.get("text", ""),
                "quarter": date_to_quarter(row.get("date", "").strip()),
            })
    return letters


def compute_quarterly_divergence(
    letters: list[dict],
    cvp_scores: dict,
    psycho_metrics: dict | None,
) -> list[dict]:
    """Compute divergence metrics per quarter."""
    # Group by quarter and audience
    quarters: dict[str, dict[str, list[dict]]] = defaultdict(lambda: defaultdict(list))
    for letter in letters:
        q = letter["quarter"]
        a = letter["audience"]
        if q == "unknown" or a == "unknown":
            continue
        quarters[q][a].append(letter)

    results = []
    for quarter in sorted(quarters.keys()):
        groups = quarters[quarter]
        trine_letters = groups.get("trine", [])
        parent_letters = groups.get("parents", [])

        if not trine_letters or not parent_letters:
            continue

        trine_texts = [l["text"] for l in trine_letters]
        parent_texts = [l["text"] for l in parent_letters]

        # JSD on word frequency distributions
        vocab = build_shared_vocab(trine_texts, parent_texts, top_n=200)
        dist_trine = word_freq_distribution(trine_texts, vocab)
        dist_parents = word_freq_distribution(parent_texts, vocab)
        jsd = float(jensenshannon(dist_trine, dist_parents))

        # Wasserstein distance on CVP sentiment distributions
        trine_cvp = [
            cvp_scores[l["id"]]["cvp_mean"]
            for l in trine_letters
            if l["id"] in cvp_scores
        ]
        parent_cvp = [
            cvp_scores[l["id"]]["cvp_mean"]
            for l in parent_letters
            if l["id"] in cvp_scores
        ]
        w_dist = 0.0
        if trine_cvp and parent_cvp:
            w_dist = float(wasserstein_distance(trine_cvp, parent_cvp))

        # Psycholinguistic metric divergence
        metric_div = {}
        if psycho_metrics is not None:
            for metric_name in PSYCHOLINGUISTIC_METRICS:
                trine_vals = [
                    psycho_metrics[l["id"]][metric_name]
                    for l in trine_letters
                    if l["id"] in psycho_metrics
                    and metric_name in psycho_metrics[l["id"]]
                ]
                parent_vals = [
                    psycho_metrics[l["id"]][metric_name]
                    for l in parent_letters
                    if l["id"] in psycho_metrics
                    and metric_name in psycho_metrics[l["id"]]
                ]
                metric_div[metric_name] = round(
                    metric_divergence(trine_vals, parent_vals), 4
                )

        entry = {
            "quarter": quarter,
            "trine_count": len(trine_letters),
            "parent_count": len(parent_letters),
            "jsd_words": round(jsd, 4),
            "wasserstein_sentiment": round(w_dist, 4),
        }
        if metric_div:
            entry["metric_divergence"] = metric_div

        results.append(entry)

    return results


def compute_same_date_comparisons(
    pairs: list[dict],
    letters_by_id: dict[str, dict],
    cvp_scores: dict,
    psycho_metrics: dict | None,
) -> list[dict]:
    """Compute detailed comparisons for same-date letter pairs."""
    comparisons = []

    for pair in pairs:
        for trine_id in pair["trine_ids"]:
            for parent_id in pair["parent_ids"]:
                comp: dict = {
                    "date": pair["date"],
                    "trine_id": int(trine_id),
                    "parent_id": int(parent_id),
                }

                # CVP mean difference
                trine_cvp = cvp_scores.get(trine_id, {}).get("cvp_mean")
                parent_cvp = cvp_scores.get(parent_id, {}).get("cvp_mean")
                if trine_cvp is not None and parent_cvp is not None:
                    comp["cvp_mean_diff"] = round(abs(trine_cvp - parent_cvp), 4)
                else:
                    comp["cvp_mean_diff"] = None

                # Psycholinguistic metric differences
                if psycho_metrics is not None:
                    trine_psycho = psycho_metrics.get(trine_id, {})
                    parent_psycho = psycho_metrics.get(parent_id, {})
                    for metric_name in ["hedging_rate", "reassurance_count"]:
                        t_val = trine_psycho.get(metric_name)
                        p_val = parent_psycho.get(metric_name)
                        diff_key = metric_name.replace("_rate", "").replace("_count", "") + "_diff"
                        if t_val is not None and p_val is not None:
                            comp[diff_key] = round(abs(t_val - p_val), 4)
                        else:
                            comp[diff_key] = None

                # Word count difference
                trine_text = letters_by_id.get(trine_id, {}).get("text", "")
                parent_text = letters_by_id.get(parent_id, {}).get("text", "")
                trine_wc = len(trine_text.split())
                parent_wc = len(parent_text.split())
                comp["word_count_diff"] = abs(trine_wc - parent_wc)

                comparisons.append(comp)

    return comparisons


def compute_overall_metric_means(
    letters: list[dict],
    cvp_scores: dict,
    psycho_metrics: dict | None,
) -> dict[str, dict]:
    """Compute overall means per audience for all tracked metrics."""
    audience_values: dict[str, dict[str, list[float]]] = {
        "trine": defaultdict(list),
        "parents": defaultdict(list),
    }

    for letter in letters:
        a = letter["audience"]
        if a not in audience_values:
            continue
        lid = letter["id"]

        # CVP metrics
        if lid in cvp_scores:
            audience_values[a]["cvp_mean"].append(cvp_scores[lid]["cvp_mean"])

        # Psycholinguistic metrics
        if psycho_metrics is not None and lid in psycho_metrics:
            for metric_name in PSYCHOLINGUISTIC_METRICS:
                val = psycho_metrics[lid].get(metric_name)
                if val is not None:
                    audience_values[a][metric_name].append(val)

    result = {}
    for audience, metrics in audience_values.items():
        result[audience] = {}
        for metric_name, values in sorted(metrics.items()):
            if values:
                result[audience][metric_name] = round(float(np.mean(values)), 4)
    return result


# ---------------------------------------------------------------------------
# Summary printing
# ---------------------------------------------------------------------------

def print_summary(summary: dict, quarterly: list[dict], comparisons: list[dict]) -> None:
    print("\n--- Audience Divergence Summary ---")
    print(f"  Trine letters:       {summary['trine_count']}")
    print(f"  Parent letters:      {summary['parent_count']}")
    print(f"  Unknown recipients:  {summary['unknown_count']}")
    print(f"  Same-date pairs:     {summary['same_date_pairs']}")
    print(f"  Quarters with both:  {summary['quarters_with_both']}")

    if quarterly:
        jsd_values = [q["jsd_words"] for q in quarterly]
        ws_values = [q["wasserstein_sentiment"] for q in quarterly]
        print(f"\n  JSD (words)   — mean: {np.mean(jsd_values):.4f}, "
              f"min: {min(jsd_values):.4f}, max: {max(jsd_values):.4f}")
        print(f"  Wasserstein   — mean: {np.mean(ws_values):.4f}, "
              f"min: {min(ws_values):.4f}, max: {max(ws_values):.4f}")

    if comparisons:
        diffs = [c["cvp_mean_diff"] for c in comparisons if c.get("cvp_mean_diff") is not None]
        if diffs:
            print(f"\n  Same-date CVP diff — mean: {np.mean(diffs):.4f}, "
                  f"max: {max(diffs):.4f}")

    print()


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    parser = argparse.ArgumentParser(
        description="Audience divergence analysis: Trine vs. parents (ADR-015)"
    )
    parser.add_argument("--force", action="store_true", help="Skip the skip-logic check")
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Compute and print stats but do not write output",
    )
    args = parser.parse_args()

    # Resolve paths
    letters_path = resolve("letters.csv")
    cvp_path = resolve("cvp-letter-scores.json")
    psycho_path = resolve("letter-psycholinguistics.json")
    output_path = resolve("letter-audience-divergence.json")
    meta_path = resolve("audience-divergence-meta.json")

    # Validate required inputs
    for label, path in [("Letters CSV", letters_path), ("CVP scores", cvp_path)]:
        if not os.path.exists(path):
            print(f"Error: {label} not found at {path}", file=sys.stderr)
            sys.exit(1)

    # Check optional psycholinguistic metrics
    has_psycho = os.path.exists(psycho_path)
    if not has_psycho:
        print(f"Warning: {psycho_path} not found — skipping psycholinguistic metrics.",
              file=sys.stderr)

    # Skip logic (ADR-029)
    input_paths = [letters_path, cvp_path]
    if has_psycho:
        input_paths.append(psycho_path)

    if not args.force and should_skip(input_paths, meta_path):
        print("Audience divergence analysis up to date, skipping.")
        sys.exit(0)

    # Load data
    print("Loading letters...")
    letters = load_letters(letters_path)

    # Filter to Peter's letters only
    letters = [l for l in letters if l["sender"] == "Peter Mærsk"]

    print(f"Loading CVP scores from {cvp_path}...")
    with open(cvp_path, "r", encoding="utf-8") as f:
        cvp_scores = json.load(f)

    psycho_metrics: dict | None = None
    if has_psycho:
        print(f"Loading psycholinguistic metrics from {psycho_path}...")
        with open(psycho_path, "r", encoding="utf-8") as f:
            psycho_metrics = json.load(f)

    # Build lookup structures
    letters_by_id = {l["id"]: l for l in letters}
    letters_by_date: dict[str, list[dict]] = defaultdict(list)
    for letter in letters:
        if letter["date"]:
            letters_by_date[letter["date"]].append(letter)

    # Classify counts
    trine_count = sum(1 for l in letters if l["audience"] == "trine")
    parent_count = sum(1 for l in letters if l["audience"] == "parents")
    unknown_count = sum(1 for l in letters if l["audience"] == "unknown")

    print(f"  Trine: {trine_count}, Parents: {parent_count}, Unknown: {unknown_count}")

    # Same-date pairs
    print("Finding same-date pairs...")
    same_date_pairs = find_same_date_pairs(letters_by_date)

    # Quarterly divergence
    print("Computing quarterly divergence...")
    quarterly = compute_quarterly_divergence(letters, cvp_scores, psycho_metrics)

    # Same-date comparisons
    print("Computing same-date comparisons...")
    comparisons = compute_same_date_comparisons(
        same_date_pairs, letters_by_id, cvp_scores, psycho_metrics
    )

    # Overall metric means
    print("Computing overall metric means...")
    overall_means = compute_overall_metric_means(letters, cvp_scores, psycho_metrics)

    # Build summary
    summary = {
        "trine_count": trine_count,
        "parent_count": parent_count,
        "unknown_count": unknown_count,
        "same_date_pairs": len(same_date_pairs),
        "quarters_with_both": len(quarterly),
    }

    # Assemble output
    output = {
        "summary": summary,
        "quarterly_divergence": quarterly,
        "same_date_comparisons": comparisons,
        "overall_metric_means": overall_means,
    }

    print_summary(summary, quarterly, comparisons)

    if args.dry_run:
        print("Dry run — no files written.")
        sys.exit(0)

    # Write output
    print("Writing output...")
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    # Write skip-logic meta
    meta: dict = {
        "generated": datetime.now(timezone.utc).isoformat(),
        "script_hash": compute_file_hash(__file__),
    }
    for p in input_paths:
        key = os.path.basename(p) + "_hash"
        meta[key] = compute_file_hash(p)
    meta["trine_count"] = trine_count
    meta["parent_count"] = parent_count
    meta["quarters_with_both"] = len(quarterly)
    meta["same_date_pairs"] = len(same_date_pairs)

    with open(meta_path, "w", encoding="utf-8") as f:
        json.dump(meta, f, ensure_ascii=False, indent=2)

    print(f"Wrote {output_path}")
    print(f"Wrote {meta_path}")


if __name__ == "__main__":
    main()
