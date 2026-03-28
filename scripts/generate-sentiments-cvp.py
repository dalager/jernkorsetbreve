"""
CVP (Concept Vector Projection) sentiment scoring for WW1 Danish letters.

Algorithm:
  1. Load a pre-computed 768-dim concept vector from CSV
  2. Embed sentences with paraphrase-multilingual-mpnet-base-v2
  3. score = embedding dot concept_vector_normalized

Inputs:
  data/cvp-concept-vector.csv       768-dim concept vector
  data/normalized-sentences.json    sentence objects

Outputs:
  data/cvp-sentence-scores.json     per-sentence scores
  data/cvp-letter-scores.json       per-letter aggregated scores
  data/sentiment-meta.json          skip-logic metadata
"""

import argparse
import hashlib
import json
import os
import sys
from datetime import datetime, timezone

import numpy as np
import pandas as pd

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(SCRIPT_DIR, os.pardir, "data")
MODEL_NAME = "paraphrase-multilingual-mpnet-base-v2"


def resolve(path: str) -> str:
    return os.path.normpath(os.path.join(DATA_DIR, path))


# ---------------------------------------------------------------------------
# Skip logic (ADR-029)
# ---------------------------------------------------------------------------

def compute_file_hash(path: str) -> str:
    return hashlib.sha256(open(path, "rb").read()).hexdigest()


def should_skip(sentences_path: str, vector_path: str, meta_path: str) -> bool:
    current = {
        "sentences_hash": compute_file_hash(sentences_path),
        "vector_hash": compute_file_hash(vector_path),
        "script_hash": compute_file_hash(__file__),
    }
    if not os.path.exists(meta_path):
        return False
    with open(meta_path, "r", encoding="utf-8") as f:
        existing = json.load(f)
    return all(existing.get(k) == v for k, v in current.items())


# ---------------------------------------------------------------------------
# Core
# ---------------------------------------------------------------------------

def load_concept_vector(path: str) -> np.ndarray:
    cv_df = pd.read_csv(path)
    cv = cv_df.values[0].astype(np.float32)
    assert cv.shape == (768,), f"Expected 768-dim vector, got {cv.shape}"
    cv = cv / np.linalg.norm(cv)
    return cv


def load_sentences(path: str) -> list[dict]:
    with open(path, "r", encoding="utf-8") as f:
        sentences = json.load(f)
    assert len(sentences) >= 5000, (
        f"Expected >= 5000 sentences, got {len(sentences)}"
    )
    return sentences


def embed_sentences(texts: list[str]) -> np.ndarray:
    from sentence_transformers import SentenceTransformer

    print(f"Loading model {MODEL_NAME}...")
    model = SentenceTransformer(MODEL_NAME)
    print(f"Embedding {len(texts)} sentences...")
    embeddings = model.encode(texts, batch_size=32, show_progress_bar=True)
    return embeddings.astype(np.float32)


def score_sentences(embeddings: np.ndarray, cv: np.ndarray) -> np.ndarray:
    print("Scoring...")
    return embeddings @ cv


def aggregate_letter_scores(sentence_records: list[dict]) -> dict:
    from collections import defaultdict

    by_letter: dict[int, list[dict]] = defaultdict(list)
    for rec in sentence_records:
        by_letter[rec["letter_id"]].append(rec)

    assert len(by_letter) >= 600, (
        f"Expected >= 600 letters, got {len(by_letter)}"
    )

    result = {}
    for letter_id, sents in sorted(by_letter.items()):
        all_scores = np.array([s["score"] for s in sents])
        substantive = [s for s in sents if not s["is_formulaic"]]

        # Fall back to all sentences if every sentence is formulaic
        if substantive:
            sub_scores = np.array([s["score"] for s in substantive])
        else:
            sub_scores = all_scores

        result[str(letter_id)] = {
            "cvp_mean": round(float(np.mean(sub_scores)), 4),
            "cvp_min": round(float(np.min(sub_scores)), 4),
            "cvp_p10": round(float(np.percentile(sub_scores, 10)), 4),
            "cvp_p90": round(float(np.percentile(sub_scores, 90)), 4),
            "cvp_range": round(float(np.max(sub_scores) - np.min(sub_scores)), 4),
            "negative_ratio": round(
                float(np.sum(sub_scores < -0.05) / len(sub_scores)), 4
            ),
            "sentence_count": len(sents),
            "sentence_count_substantive": len(substantive),
        }

    return result


def print_summary(scores: np.ndarray, letter_scores: dict) -> None:
    print("\n--- Summary ---")
    print(f"  Sentences:  {len(scores)}")
    print(f"  Letters:    {len(letter_scores)}")
    print(f"  Mean score: {scores.mean():.4f}")
    print(f"  Std:        {scores.std():.4f}")
    print(f"  Min:        {scores.min():.4f}")
    print(f"  Max:        {scores.max():.4f}")

    # Most positive / negative letters by cvp_mean
    sorted_letters = sorted(letter_scores.items(), key=lambda x: x[1]["cvp_mean"])
    most_neg = sorted_letters[0]
    most_pos = sorted_letters[-1]
    print(f"  Most negative letter: {most_neg[0]} (mean={most_neg[1]['cvp_mean']:.4f})")
    print(f"  Most positive letter: {most_pos[0]} (mean={most_pos[1]['cvp_mean']:.4f})")
    print()


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    parser = argparse.ArgumentParser(
        description="CVP sentiment scoring for WW1 Danish letters"
    )
    parser.add_argument(
        "--concept-vector",
        default=resolve("cvp-concept-vector.csv"),
        help="Path to concept vector CSV (768-dim)",
    )
    parser.add_argument("--force", action="store_true", help="Skip the skip-logic check")
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Compute and print stats but do not write output",
    )
    args = parser.parse_args()

    sentences_path = resolve("normalized-sentences.json")
    vector_path = os.path.abspath(args.concept_vector)
    meta_path = resolve("sentiment-meta.json")
    sentence_out = resolve("cvp-sentence-scores.json")
    letter_out = resolve("cvp-letter-scores.json")

    # Validate inputs exist
    for label, path in [("Sentences", sentences_path), ("Concept vector", vector_path)]:
        if not os.path.exists(path):
            print(f"Error: {label} not found at {path}", file=sys.stderr)
            sys.exit(1)

    # Skip logic
    if not args.force and should_skip(sentences_path, vector_path, meta_path):
        print("Sentiment scores up to date, skipping.")
        sys.exit(0)

    # Load inputs
    cv = load_concept_vector(vector_path)
    sentences = load_sentences(sentences_path)
    texts = [s["text"] for s in sentences]

    # Embed and score
    embeddings = embed_sentences(texts)
    scores = score_sentences(embeddings, cv)

    # Build per-sentence output
    sentence_records = []
    for i, sent in enumerate(sentences):
        sentence_records.append(
            {
                "letter_id": sent["letter_id"],
                "index": sent["index"],
                "text": sent["text"],
                "score": round(float(scores[i]), 4),
                "is_formulaic": sent["is_formulaic"],
            }
        )

    # Aggregate per letter
    letter_scores = aggregate_letter_scores(sentence_records)

    # Summary
    print_summary(scores, letter_scores)

    if args.dry_run:
        print("Dry run — no files written.")
        sys.exit(0)

    # Write outputs
    print("Writing output...")
    with open(sentence_out, "w", encoding="utf-8") as f:
        json.dump(sentence_records, f, ensure_ascii=False, indent=2)

    with open(letter_out, "w", encoding="utf-8") as f:
        json.dump(letter_scores, f, ensure_ascii=False, indent=2)

    # Write skip-logic meta
    meta = {
        "generated": datetime.now(timezone.utc).isoformat(),
        "sentences_hash": compute_file_hash(sentences_path),
        "vector_hash": compute_file_hash(vector_path),
        "script_hash": compute_file_hash(__file__),
        "model": MODEL_NAME,
        "letter_count": len(letter_scores),
        "sentence_count": len(sentence_records),
    }
    with open(meta_path, "w", encoding="utf-8") as f:
        json.dump(meta, f, ensure_ascii=False, indent=2)

    print(f"Wrote {sentence_out}")
    print(f"Wrote {letter_out}")
    print(f"Wrote {meta_path}")


if __name__ == "__main__":
    main()
