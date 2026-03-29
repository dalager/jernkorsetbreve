"""
Generate national identity concept vector from corpus-specific seeds (ADR-038).

Algorithm:
  1. Load curated seed sentences from data/identity-seeds.json
  2. Match seeds to cached embeddings via text matching against cvp-sentence-scores.json
  3. Concept vector = mean(danish_embeddings) - mean(german_embeddings), normalized
  4. Validate independence against sentiment and emotion vectors
  5. Score all sentences, aggregate per letter, save outputs

Unlike emotion vectors (trained on GoEmotions), the identity vector uses corpus-
specific seeds capturing Peter's Danish social vs. German military register.

Inputs:
  data/identity-seeds.json             curated seed sentences
  data/.cache/sentence-embeddings.npy  cached 768-dim embeddings (13,577 x 768)
  data/cvp-sentence-scores.json        sentence texts for index matching
  data/cvp-concept-vector.csv          sentiment vector (independence check)
  data/cvp-{emotion}-vector.csv        emotion vectors (independence check)
  data/letters.json                    letter metadata (dates for temporal analysis)

Outputs:
  data/cvp-identity-vector.csv         768-dim concept vector
  data/cvp-identity-scores.json        per-letter aggregated identity scores
"""

import argparse
import json
import os
import sys
from collections import defaultdict

import numpy as np
import pandas as pd

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(SCRIPT_DIR, os.pardir, "data")

EMOTIONS = [
    "fear", "grief", "hope", "love", "anger",
    "gratitude", "pride", "remorse", "relief", "desire",
]

MIN_POLE_SENTENCES = 25


def resolve(path: str) -> str:
    return os.path.normpath(os.path.join(DATA_DIR, path))


# ---------------------------------------------------------------------------
# Core helpers
# ---------------------------------------------------------------------------

def load_concept_vector(path: str) -> np.ndarray:
    """Load a 768-dim concept vector from CSV and normalize."""
    cv_df = pd.read_csv(path)
    cv = cv_df.values[0].astype(np.float32)
    assert cv.shape == (768,), f"Expected 768-dim vector, got {cv.shape}"
    cv = cv / np.linalg.norm(cv)
    return cv


def save_concept_vector(cv: np.ndarray, path: str) -> None:
    """Save concept vector to CSV in same format as cvp-concept-vector.csv."""
    df = pd.DataFrame([cv], columns=[str(i) for i in range(len(cv))])
    df.to_csv(path, index=False)


def cosine_similarity(a: np.ndarray, b: np.ndarray) -> float:
    """Cosine similarity between two unit vectors."""
    return float(np.dot(a, b))


# ---------------------------------------------------------------------------
# Seed matching
# ---------------------------------------------------------------------------

def load_seeds(path: str) -> dict:
    """Load identity seeds from JSON."""
    with open(path, "r", encoding="utf-8") as f:
        seeds = json.load(f)

    danish = seeds.get("danish_pole", [])
    german = seeds.get("german_pole", [])
    excluded = seeds.get("excluded", [])

    assert len(danish) >= MIN_POLE_SENTENCES, (
        f"Need >= {MIN_POLE_SENTENCES} Danish-pole seeds, got {len(danish)}"
    )
    assert len(german) >= MIN_POLE_SENTENCES, (
        f"Need >= {MIN_POLE_SENTENCES} German-pole seeds, got {len(german)}"
    )

    return {"danish_pole": danish, "german_pole": german, "excluded": excluded}


def load_sentences(path: str) -> list[dict]:
    """Load sentence records from cvp-sentence-scores.json."""
    with open(path, "r", encoding="utf-8") as f:
        sentences = json.load(f)
    return sentences


def match_seeds_to_indices(
    seeds: list[dict], sentences: list[dict]
) -> list[int]:
    """Match each seed to its embedding index by letter_id and text."""
    lookup: dict[tuple[int, str], int] = {}
    for i, sent in enumerate(sentences):
        lookup[(sent["letter_id"], sent["text"])] = i

    indices = []
    unmatched = []
    for seed in seeds:
        idx = lookup.get((seed["letter_id"], seed["text"]))
        if idx is not None:
            indices.append(idx)
        else:
            unmatched.append(seed)

    if unmatched:
        print(f"  WARNING: {len(unmatched)} seed(s) could not be matched:")
        for s in unmatched[:5]:
            print(f"    letter_id={s['letter_id']}: {s['text'][:80]}...")

    assert len(indices) == len(seeds), (
        f"Expected all {len(seeds)} seeds to match, "
        f"but {len(seeds) - len(indices)} were unmatched"
    )
    return indices


# ---------------------------------------------------------------------------
# Validation
# ---------------------------------------------------------------------------

def print_similarity_matrix(vectors: dict[str, np.ndarray]) -> None:
    """Print a cosine similarity matrix between all concept vectors."""
    names = list(vectors.keys())
    n = len(names)

    col_width = max(len(name) for name in names) + 2
    header = " " * col_width + "".join(name.rjust(col_width) for name in names)
    print(header)

    for i in range(n):
        row = names[i].ljust(col_width)
        for j in range(n):
            sim = cosine_similarity(vectors[names[i]], vectors[names[j]])
            row += f"{sim:>{col_width}.4f}"
        print(row)


def validate_independence(
    identity_cv: np.ndarray,
    sentiment_path: str,
    emotion_names: list[str],
) -> bool:
    """Check cosine similarity of identity vector against existing vectors.

    Returns True if all checks pass, False otherwise.
    """
    all_ok = True
    vectors: dict[str, np.ndarray] = {"identity": identity_cv}

    # Load sentiment vector
    if os.path.exists(sentiment_path):
        sentiment_cv = load_concept_vector(sentiment_path)
        vectors["sentiment"] = sentiment_cv
        sim = cosine_similarity(identity_cv, sentiment_cv)
        status = "PASS" if abs(sim) < 0.15 else "FAIL"
        if status == "FAIL":
            all_ok = False
        print(f"  identity vs sentiment: {sim:+.4f}  [{status}, threshold <0.15]")
    else:
        print(f"  WARNING: Sentiment vector not found at {sentiment_path}")

    # Load emotion vectors
    for emotion in emotion_names:
        path = resolve(f"cvp-{emotion}-vector.csv")
        if os.path.exists(path):
            emotion_cv = load_concept_vector(path)
            vectors[emotion] = emotion_cv
            sim = cosine_similarity(identity_cv, emotion_cv)
            status = "PASS" if abs(sim) < 0.30 else "FAIL"
            if status == "FAIL":
                all_ok = False
            print(f"  identity vs {emotion}: {sim:+.4f}  [{status}, threshold <0.30]")

    # Print full matrix
    if len(vectors) > 1:
        print("\n--- Concept Vector Cosine Similarity Matrix ---")
        print_similarity_matrix(vectors)

    return all_ok


# ---------------------------------------------------------------------------
# Scoring and aggregation
# ---------------------------------------------------------------------------

def score_all_sentences(
    embeddings: np.ndarray, identity_cv: np.ndarray
) -> np.ndarray:
    """Project all sentence embeddings onto the identity concept vector."""
    return embeddings @ identity_cv


def aggregate_letter_scores(
    sentences: list[dict], scores: np.ndarray
) -> dict:
    """Aggregate per-sentence identity scores to per-letter statistics."""
    by_letter: dict[int, list[float]] = defaultdict(list)
    for i, sent in enumerate(sentences):
        by_letter[sent["letter_id"]].append(float(scores[i]))

    result = {}
    for letter_id, letter_scores in sorted(by_letter.items()):
        arr = np.array(letter_scores)
        result[str(letter_id)] = {
            "mean": round(float(np.mean(arr)), 4),
            "p10": round(float(np.percentile(arr, 10)), 4),
            "p90": round(float(np.percentile(arr, 90)), 4),
        }

    return result


# ---------------------------------------------------------------------------
# Temporal analysis
# ---------------------------------------------------------------------------

def load_letter_dates(path: str) -> dict[int, str]:
    """Load letter dates from letters.json.  Returns {letter_id: "YYYY"}."""
    with open(path, "r", encoding="utf-8") as f:
        letters = json.load(f)
    dates: dict[int, str] = {}
    for i, letter in enumerate(letters):
        date_str = letter.get("LetterDate", "")
        if date_str:
            dates[i + 1] = date_str[:4]  # letter_id is 1-based
    return dates


def print_temporal_analysis(
    letter_scores: dict, letter_dates: dict[int, str]
) -> None:
    """Print mean identity score per year and check for temporal confound."""
    by_year: dict[str, list[float]] = defaultdict(list)
    for lid_str, entry in letter_scores.items():
        year = letter_dates.get(int(lid_str))
        if year:
            by_year[year].append(entry["mean"])

    print("\n--- Temporal Analysis: Mean Identity Score per Year ---")
    for year in sorted(by_year.keys()):
        scores = by_year[year]
        print(f"  {year}: mean={np.mean(scores):+.4f}  (n={len(scores)} letters)")

    # Per-letter correlation check (R^2)
    all_years, all_scores = [], []
    for lid_str, entry in letter_scores.items():
        year = letter_dates.get(int(lid_str))
        if year:
            all_years.append(int(year))
            all_scores.append(entry["mean"])

    if len(all_years) >= 10:
        x = np.array(all_years, dtype=np.float64)
        y = np.array(all_scores, dtype=np.float64)
        corr = np.corrcoef(x, y)[0, 1]
        r_squared = corr ** 2
        print(f"\n  Correlation (letter date vs identity score):")
        print(f"    r = {corr:+.4f}, R^2 = {r_squared:.4f}")
        if r_squared > 0.5:
            print("    WARNING: R^2 > 0.5 — vector may capture time, "
                  "not identity. Investigate seed temporal balance.")
        else:
            print("    OK: No strong temporal confound detected.")


# ---------------------------------------------------------------------------
# Validation report
# ---------------------------------------------------------------------------

def print_seed_statistics(
    danish_indices: list[int],
    german_indices: list[int],
    scores: np.ndarray,
) -> None:
    """Print statistics for seed pole sentences."""
    dk_scores = scores[danish_indices]
    de_scores = scores[german_indices]

    print("\n--- Seed Pole Statistics ---")
    print(f"  Danish pole:  n={len(dk_scores)}, "
          f"mean={np.mean(dk_scores):+.4f}, std={np.std(dk_scores):.4f}")
    print(f"  German pole:  n={len(de_scores)}, "
          f"mean={np.mean(de_scores):+.4f}, std={np.std(de_scores):.4f}")

    if np.mean(dk_scores) <= 0:
        print("  WARNING: Danish-pole mean score is not positive!")
    if np.mean(de_scores) >= 0:
        print("  WARNING: German-pole mean score is not negative!")


def print_extreme_sentences(
    sentences: list[dict], scores: np.ndarray, n: int = 10
) -> None:
    """Print top N most Danish-leaning and German-leaning sentences."""
    sorted_indices = np.argsort(scores)

    print(f"\n--- Top {n} Most Danish-Leaning Sentences ---")
    for idx in sorted_indices[-n:][::-1]:
        sent = sentences[idx]
        print(f"  {scores[idx]:+.4f}  [letter {sent['letter_id']}] "
              f"{sent['text'][:100]}")

    print(f"\n--- Top {n} Most German/Military-Leaning Sentences ---")
    for idx in sorted_indices[:n]:
        sent = sentences[idx]
        print(f"  {scores[idx]:+.4f}  [letter {sent['letter_id']}] "
              f"{sent['text'][:100]}")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    parser = argparse.ArgumentParser(
        description="Generate national identity concept vector from corpus seeds (ADR-038)"
    )
    parser.add_argument(
        "--force", action="store_true",
        help="Regenerate even if output files already exist",
    )
    parser.add_argument(
        "--dry-run", action="store_true",
        help="Compute and print stats but do not write output",
    )
    args = parser.parse_args()

    # Paths
    seeds_path = resolve("identity-seeds.json")
    embeddings_path = resolve(".cache/sentence-embeddings.npy")
    sentences_path = resolve("cvp-sentence-scores.json")
    sentiment_path = resolve("cvp-concept-vector.csv")
    letters_path = resolve("letters.json")
    vector_out = resolve("cvp-identity-vector.csv")
    scores_out = resolve("cvp-identity-scores.json")

    # Check if outputs already exist
    if not args.force:
        if os.path.exists(vector_out) and os.path.exists(scores_out):
            print("Identity vector and scores already exist. "
                  "Use --force to regenerate.")
            sys.exit(0)

    # Validate inputs exist
    for label, path in [
        ("Identity seeds", seeds_path),
        ("Sentence embeddings", embeddings_path),
        ("Sentence scores", sentences_path),
        ("Letters", letters_path),
    ]:
        if not os.path.exists(path):
            print(f"Error: {label} not found at {path}", file=sys.stderr)
            sys.exit(1)

    # --- 1. Load inputs ---
    print("Loading identity seeds...")
    seeds = load_seeds(seeds_path)
    danish_seeds = seeds["danish_pole"]
    german_seeds = seeds["german_pole"]
    excluded_seeds = seeds["excluded"]
    print(f"  Danish pole:  {len(danish_seeds)} seeds")
    print(f"  German pole:  {len(german_seeds)} seeds")
    print(f"  Excluded:     {len(excluded_seeds)} seeds")

    print("\nLoading cached sentence embeddings...")
    embeddings = np.load(embeddings_path).astype(np.float32)
    print(f"  Shape: {embeddings.shape}")

    print("\nLoading sentence records...")
    sentences = load_sentences(sentences_path)
    print(f"  Loaded {len(sentences)} sentences")

    assert embeddings.shape[0] == len(sentences), (
        f"Embedding count ({embeddings.shape[0]}) does not match "
        f"sentence count ({len(sentences)})"
    )

    # --- 2. Match seeds to embedding indices ---
    print("\nMatching Danish-pole seeds to embeddings...")
    danish_indices = match_seeds_to_indices(danish_seeds, sentences)
    print(f"  Matched {len(danish_indices)} Danish-pole seeds")

    print("\nMatching German-pole seeds to embeddings...")
    german_indices = match_seeds_to_indices(german_seeds, sentences)
    print(f"  Matched {len(german_indices)} German-pole seeds")

    # --- 3. Compute identity concept vector ---
    print("\nComputing identity concept vector...")
    dk_emb = embeddings[danish_indices].mean(axis=0)
    de_emb = embeddings[german_indices].mean(axis=0)
    identity_cv = dk_emb - de_emb
    identity_cv = identity_cv / np.linalg.norm(identity_cv)
    identity_cv = identity_cv.astype(np.float32)
    print(f"  norm={np.linalg.norm(identity_cv):.6f}, "
          f"min={identity_cv.min():.6f}, max={identity_cv.max():.6f}")

    # --- 4. Validate independence ---
    print("\n--- Independence Validation ---")
    independence_ok = validate_independence(
        identity_cv, sentiment_path, EMOTIONS
    )
    if not independence_ok:
        print("\n  WARNING: Some independence checks failed. "
              "Review seed curation.")

    # --- 5. Score all sentences ---
    print("\nScoring all sentences...")
    scores = score_all_sentences(embeddings, identity_cv)
    print(f"  Mean:  {scores.mean():+.4f}")
    print(f"  Std:   {scores.std():.4f}")
    print(f"  Min:   {scores.min():+.4f}")
    print(f"  Max:   {scores.max():+.4f}")

    # --- 6. Validation report ---
    print_seed_statistics(danish_indices, german_indices, scores)

    # Excluded (tension) sentences
    if excluded_seeds:
        print("\n--- Excluded (Tension) Sentence Scores ---")
        excluded_indices = []
        for seed in excluded_seeds:
            key = (seed["letter_id"], seed["text"])
            for i, sent in enumerate(sentences):
                if sent["letter_id"] == key[0] and sent["text"] == key[1]:
                    excluded_indices.append(i)
                    break
        for idx in excluded_indices:
            sent = sentences[idx]
            print(f"  {scores[idx]:+.4f}  [letter {sent['letter_id']}] "
                  f"{sent['text'][:100]}")

    # Top extreme sentences from full corpus
    print_extreme_sentences(sentences, scores)

    # Aggregate per letter
    letter_scores = aggregate_letter_scores(sentences, scores)
    print(f"\n  Aggregated scores for {len(letter_scores)} letters")

    # Temporal analysis
    letter_dates = load_letter_dates(letters_path)
    print_temporal_analysis(letter_scores, letter_dates)

    # --- 7. Write outputs ---
    if args.dry_run:
        print("\nDry run -- no files written.")
        sys.exit(0)

    print("\nWriting output...")
    save_concept_vector(identity_cv, vector_out)
    print(f"  Wrote {vector_out}")

    with open(scores_out, "w", encoding="utf-8") as f:
        json.dump(letter_scores, f, ensure_ascii=False, indent=2)
    print(f"  Wrote {scores_out}")

    print("\nDone.")


if __name__ == "__main__":
    main()
