#!/usr/bin/env python3
"""Compare AFINN/Sentida legacy sentiment scores with CVP multi-scores.

Reads:
  data/sentiment_scored_letters.csv  — existing AFINN/Sentida scores
  data/cvp-letter-scores.json        — CVP multi-scores (from generate-sentiments-cvp.py)

Prints a correlation and divergence report to stdout.
"""

import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd
from scipy.stats import pearsonr, spearmanr

# ---------------------------------------------------------------------------
# Paths (relative to this script's location)
# ---------------------------------------------------------------------------
SCRIPT_DIR = Path(__file__).resolve().parent
DATA_DIR = SCRIPT_DIR.parent / "data"

AFINN_CSV = DATA_DIR / "sentiment_scored_letters.csv"
CVP_JSON = DATA_DIR / "cvp-letter-scores.json"

# Letters of special interest (known emotionally significant)
SPOTLIGHT_LETTERS = {
    87: "Near the front — early wartime letter",
    476: "Gas poisoning story",
    567: "Short postcard",
}


def load_afinn(path: Path) -> pd.DataFrame:
    """Load the legacy AFINN/Sentida scored CSV."""
    df = pd.read_csv(path)
    # Keep only columns we need
    cols = [
        "id",
        "sentiment_score",
        "affin_score_sentenceavg",
        "sentida_score_sentenceavg",
        "sentida_score",
    ]
    available = [c for c in cols if c in df.columns]
    df = df[available].copy()
    df["id"] = df["id"].astype(int)
    return df


def load_cvp(path: Path) -> pd.DataFrame:
    """Load CVP multi-scores JSON into a DataFrame."""
    with open(path, "r", encoding="utf-8") as f:
        raw = json.load(f)

    rows = []
    for letter_id, scores in raw.items():
        row = {"id": int(letter_id)}
        row.update(scores)
        rows.append(row)

    return pd.DataFrame(rows)


def normalize_min_max(series: pd.Series, target_min=-1.0, target_max=1.0) -> pd.Series:
    """Normalize a series to [target_min, target_max] using min-max scaling."""
    s_min = series.min()
    s_max = series.max()
    if s_max == s_min:
        return pd.Series(0.0, index=series.index)
    scaled = (series - s_min) / (s_max - s_min)  # [0, 1]
    return scaled * (target_max - target_min) + target_min


def print_separator(char="=", width=72):
    print(char * width)


def print_header(title: str):
    print()
    print_separator()
    print(f"  {title}")
    print_separator()
    print()


def report_correlations(merged: pd.DataFrame):
    """Print Pearson and Spearman correlations between AFINN and CVP scores."""
    print_header("CORRELATION REPORT: AFINN vs CVP")

    afinn_col = "afinn_norm"
    cvp_col = "cvp_mean"

    valid = merged[[afinn_col, cvp_col]].dropna()
    n = len(valid)
    print(f"  Letters with both AFINN and CVP scores: {n}")
    print()

    if n < 3:
        print("  Not enough data points for correlation analysis.")
        return

    r_pearson, p_pearson = pearsonr(valid[afinn_col], valid[cvp_col])
    r_spearman, p_spearman = spearmanr(valid[afinn_col], valid[cvp_col])

    print(f"  Pearson  r = {r_pearson:+.4f}  (p = {p_pearson:.2e})")
    print(f"  Spearman r = {r_spearman:+.4f}  (p = {p_spearman:.2e})")
    print()

    # Also correlate with sentida if available
    if "sentida_score_sentenceavg" in merged.columns:
        sentida_col = "sentida_norm"
        valid_s = merged[[sentida_col, cvp_col]].dropna()
        if len(valid_s) >= 3:
            r_p, p_p = pearsonr(valid_s[sentida_col], valid_s[cvp_col])
            r_s, p_s = spearmanr(valid_s[sentida_col], valid_s[cvp_col])
            print(f"  Sentida vs CVP:")
            print(f"    Pearson  r = {r_p:+.4f}  (p = {p_p:.2e})")
            print(f"    Spearman r = {r_s:+.4f}  (p = {p_s:.2e})")
            print()


def report_largest_divergences(merged: pd.DataFrame, top_n: int = 20):
    """Print the letters with the largest absolute difference between AFINN and CVP."""
    print_header(f"TOP {top_n} LARGEST DIVERGENCES (AFINN_norm vs CVP_mean)")

    valid = merged[["id", "afinn_norm", "cvp_mean"]].dropna().copy()
    valid["abs_diff"] = (valid["afinn_norm"] - valid["cvp_mean"]).abs()
    valid = valid.sort_values("abs_diff", ascending=False).head(top_n)

    print(f"  {'ID':>5s}  {'AFINN_norm':>11s}  {'CVP_mean':>9s}  {'Abs Diff':>9s}")
    print(f"  {'-----':>5s}  {'-----------':>11s}  {'---------':>9s}  {'---------':>9s}")
    for _, row in valid.iterrows():
        print(
            f"  {int(row['id']):5d}  {row['afinn_norm']:+11.4f}  {row['cvp_mean']:+9.4f}  {row['abs_diff']:9.4f}"
        )
    print()


def report_distributions(merged: pd.DataFrame):
    """Print summary distribution statistics for both methods."""
    print_header("DISTRIBUTION STATISTICS")

    for label, col in [
        ("AFINN (normalized to [-1,1])", "afinn_norm"),
        ("Sentida (normalized to [-1,1])", "sentida_norm"),
        ("CVP mean", "cvp_mean"),
        ("CVP p10", "cvp_p10"),
        ("CVP p90", "cvp_p90"),
        ("CVP range", "cvp_range"),
        ("Negative ratio", "negative_ratio"),
    ]:
        if col not in merged.columns:
            continue
        s = merged[col].dropna()
        if s.empty:
            continue
        print(f"  {label}:")
        print(f"    count  = {len(s)}")
        print(f"    mean   = {s.mean():+.4f}")
        print(f"    std    = {s.std():.4f}")
        print(f"    min    = {s.min():+.4f}")
        print(f"    25%    = {s.quantile(0.25):+.4f}")
        print(f"    50%    = {s.median():+.4f}")
        print(f"    75%    = {s.quantile(0.75):+.4f}")
        print(f"    max    = {s.max():+.4f}")
        print()


def report_spotlight_letters(merged: pd.DataFrame):
    """Print details for specific letters known to be emotionally significant."""
    print_header("SPOTLIGHT LETTERS")

    for letter_id, description in SPOTLIGHT_LETTERS.items():
        row = merged[merged["id"] == letter_id]
        print(f"  Letter {letter_id}: {description}")
        if row.empty:
            print("    (not found in merged data)")
        else:
            r = row.iloc[0]
            for col_label, col_name in [
                ("AFINN raw", "sentiment_score"),
                ("AFINN norm", "afinn_norm"),
                ("AFINN sentenceavg", "affin_score_sentenceavg"),
                ("Sentida sentenceavg", "sentida_score_sentenceavg"),
                ("CVP mean", "cvp_mean"),
                ("CVP min", "cvp_min"),
                ("CVP p10", "cvp_p10"),
                ("CVP p90", "cvp_p90"),
                ("CVP range", "cvp_range"),
                ("Negative ratio", "negative_ratio"),
                ("Sentence count", "sentence_count"),
            ]:
                if col_name in r.index and pd.notna(r[col_name]):
                    val = r[col_name]
                    if col_name == "sentence_count":
                        print(f"    {col_label:22s} = {int(val)}")
                    else:
                        print(f"    {col_label:22s} = {val:+.4f}")
                else:
                    print(f"    {col_label:22s} = (missing)")
        print()


def main():
    # ------------------------------------------------------------------
    # Load data
    # ------------------------------------------------------------------
    if not AFINN_CSV.exists():
        print(f"ERROR: AFINN scores not found at {AFINN_CSV}", file=sys.stderr)
        sys.exit(1)

    if not CVP_JSON.exists():
        print(f"ERROR: CVP scores not found at {CVP_JSON}", file=sys.stderr)
        print(
            "  Run 'python scripts/generate-sentiments-cvp.py' first.",
            file=sys.stderr,
        )
        sys.exit(1)

    afinn_df = load_afinn(AFINN_CSV)
    cvp_df = load_cvp(CVP_JSON)

    print(f"Loaded {len(afinn_df)} letters from AFINN CSV")
    print(f"Loaded {len(cvp_df)} letters from CVP JSON")

    # ------------------------------------------------------------------
    # Merge on letter id
    # ------------------------------------------------------------------
    merged = pd.merge(afinn_df, cvp_df, on="id", how="outer")
    both = merged.dropna(subset=["sentiment_score", "cvp_mean"])
    print(f"Merged: {len(merged)} total, {len(both)} with both scores")

    # ------------------------------------------------------------------
    # Normalize AFINN scores to [-1, 1]
    # ------------------------------------------------------------------
    if "sentiment_score" in merged.columns:
        merged["afinn_norm"] = normalize_min_max(
            merged["sentiment_score"], target_min=-1.0, target_max=1.0
        )

    if "sentida_score_sentenceavg" in merged.columns:
        merged["sentida_norm"] = normalize_min_max(
            merged["sentida_score_sentenceavg"], target_min=-1.0, target_max=1.0
        )

    # ------------------------------------------------------------------
    # Reports
    # ------------------------------------------------------------------
    report_correlations(merged)
    report_largest_divergences(merged)
    report_distributions(merged)
    report_spotlight_letters(merged)

    print_separator()
    print("  Comparison complete.")
    print_separator()


if __name__ == "__main__":
    main()
