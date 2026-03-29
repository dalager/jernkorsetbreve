"""
CVP (Concept Vector Projection) multi-emotion scoring for WW1 Danish letters (ADR-015).

Algorithm:
  1. Load emotion concept vectors from data/cvp-{emotion}-vector.csv
  2. Embed sentences with paraphrase-multilingual-mpnet-base-v2
  3. score = embedding dot concept_vector_normalized (for each emotion)
  4. Aggregate per letter: mean, p10, p90 (excluding formulaic sentences)

Inputs:
  data/cvp-fear-vector.csv             768-dim concept vector
  data/cvp-grief-vector.csv            768-dim concept vector
  data/cvp-hope-vector.csv             768-dim concept vector
  data/cvp-love-vector.csv             768-dim concept vector
  data/cvp-anger-vector.csv            768-dim concept vector
  data/cvp-gratitude-vector.csv        768-dim concept vector
  data/cvp-pride-vector.csv            768-dim concept vector
  data/cvp-remorse-vector.csv          768-dim concept vector
  data/cvp-relief-vector.csv           768-dim concept vector
  data/cvp-desire-vector.csv           768-dim concept vector
  data/normalized-sentences.json       sentence objects

Outputs:
  data/cvp-emotion-sentence-scores.json   per-sentence emotion scores
  data/cvp-emotion-scores.json            per-letter aggregated emotion scores
  data/emotion-meta.json                  skip-logic metadata
"""

import argparse
import hashlib
import json
import os
import sys
from collections import defaultdict
from datetime import datetime, timezone

import numpy as np
import pandas as pd

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(SCRIPT_DIR, os.pardir, "data")
MODEL_NAME = "paraphrase-multilingual-mpnet-base-v2"

EMOTIONS = ["fear", "grief", "hope", "love", "anger", "gratitude", "pride", "remorse", "relief", "desire"]


def resolve(path: str) -> str:
    return os.path.normpath(os.path.join(DATA_DIR, path))


# ---------------------------------------------------------------------------
# Skip logic (ADR-029)
# ---------------------------------------------------------------------------

def compute_file_hash(path: str) -> str:
    return hashlib.sha256(open(path, "rb").read()).hexdigest()


def should_skip(
    sentences_path: str,
    vector_paths: dict[str, str],
    meta_path: str,
) -> bool:
    """Check if outputs are up-to-date based on input hashes."""
    current = {
        "sentences_hash": compute_file_hash(sentences_path),
        "script_hash": compute_file_hash(__file__),
    }
    for emotion, vpath in sorted(vector_paths.items()):
        current[f"vector_hash_{emotion}"] = compute_file_hash(vpath)

    if not os.path.exists(meta_path):
        return False
    with open(meta_path, "r", encoding="utf-8") as f:
        existing = json.load(f)
    return all(existing.get(k) == v for k, v in current.items())


# ---------------------------------------------------------------------------
# Core
# ---------------------------------------------------------------------------

def load_concept_vector(path: str) -> np.ndarray:
    """Load a 768-dim concept vector from CSV and normalize."""
    cv_df = pd.read_csv(path)
    cv = cv_df.values[0].astype(np.float32)
    assert cv.shape == (768,), f"Expected 768-dim vector, got {cv.shape}"
    cv = cv / np.linalg.norm(cv)
    return cv


def load_concept_vectors(emotions: list[str]) -> dict[str, np.ndarray]:
    """Load all emotion concept vectors."""
    vectors = {}
    for emotion in emotions:
        path = resolve(f"cvp-{emotion}-vector.csv")
        if not os.path.exists(path):
            print(f"Error: Concept vector not found: {path}", file=sys.stderr)
            print("  Run generate-emotion-vectors.py first.", file=sys.stderr)
            sys.exit(1)
        vectors[emotion] = load_concept_vector(path)
        print(f"  Loaded {emotion} vector from {path}")
    return vectors


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


def score_sentences(
    embeddings: np.ndarray, vectors: dict[str, np.ndarray]
) -> dict[str, np.ndarray]:
    """Project embeddings onto each concept vector."""
    print("Scoring across emotions...")
    # Stack vectors into a matrix: (num_emotions, 768)
    emotion_names = sorted(vectors.keys())
    cv_matrix = np.stack([vectors[e] for e in emotion_names], axis=0)
    # scores: (num_sentences, num_emotions)
    scores_matrix = embeddings @ cv_matrix.T
    return {e: scores_matrix[:, i] for i, e in enumerate(emotion_names)}


def aggregate_letter_scores(
    sentence_records: list[dict], emotions: list[str]
) -> dict:
    """Aggregate per-sentence scores to per-letter statistics."""
    by_letter: dict[int, list[dict]] = defaultdict(list)
    for rec in sentence_records:
        by_letter[rec["letter_id"]].append(rec)

    assert len(by_letter) >= 600, (
        f"Expected >= 600 letters, got {len(by_letter)}"
    )

    result = {}
    for letter_id, sents in sorted(by_letter.items()):
        substantive = [s for s in sents if not s["is_formulaic"]]
        # Fall back to all sentences if every sentence is formulaic
        pool = substantive if substantive else sents

        entry = {}
        for emotion in emotions:
            scores = np.array([s[emotion] for s in pool])
            entry[f"{emotion}_mean"] = round(float(np.mean(scores)), 4)
            entry[f"{emotion}_p10"] = round(float(np.percentile(scores, 10)), 4)
            entry[f"{emotion}_p90"] = round(float(np.percentile(scores, 90)), 4)

        entry["sentence_count"] = len(sents)
        entry["sentence_count_substantive"] = len(substantive)

        result[str(letter_id)] = entry

    return result


def print_summary(
    sentence_records: list[dict],
    letter_scores: dict,
    emotions: list[str],
) -> None:
    print("\n--- Summary ---")
    print(f"  Sentences:  {len(sentence_records)}")
    print(f"  Letters:    {len(letter_scores)}")

    for emotion in emotions:
        scores = np.array([r[emotion] for r in sentence_records])
        print(f"\n  {emotion}:")
        print(f"    Mean:  {scores.mean():.4f}")
        print(f"    Std:   {scores.std():.4f}")
        print(f"    Min:   {scores.min():.4f}")
        print(f"    Max:   {scores.max():.4f}")

        # Most extreme letters
        sorted_letters = sorted(
            letter_scores.items(),
            key=lambda x: x[1][f"{emotion}_mean"],
        )
        lo = sorted_letters[0]
        hi = sorted_letters[-1]
        print(f"    Lowest  letter: {lo[0]} (mean={lo[1][f'{emotion}_mean']:.4f})")
        print(f"    Highest letter: {hi[0]} (mean={hi[1][f'{emotion}_mean']:.4f})")

    print()


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    parser = argparse.ArgumentParser(
        description="CVP multi-emotion scoring for WW1 Danish letters (ADR-015)"
    )
    parser.add_argument(
        "--force", action="store_true",
        help="Skip the skip-logic check",
    )
    parser.add_argument(
        "--dry-run", action="store_true",
        help="Compute and print stats but do not write output",
    )
    args = parser.parse_args()

    sentences_path = resolve("normalized-sentences.json")
    meta_path = resolve("emotion-meta.json")
    sentence_out = resolve("cvp-emotion-sentence-scores.json")
    letter_out = resolve("cvp-emotion-scores.json")

    # Validate inputs exist
    if not os.path.exists(sentences_path):
        print(f"Error: Sentences not found at {sentences_path}", file=sys.stderr)
        sys.exit(1)

    # Load concept vectors
    print("Loading concept vectors...")
    vectors = load_concept_vectors(EMOTIONS)
    vector_paths = {e: resolve(f"cvp-{e}-vector.csv") for e in EMOTIONS}

    # Skip logic
    if not args.force and should_skip(sentences_path, vector_paths, meta_path):
        print("Emotion scores up to date, skipping.")
        sys.exit(0)

    # Load sentences
    sentences = load_sentences(sentences_path)
    texts = [s["text"] for s in sentences]

    # Embed
    embeddings = embed_sentences(texts)

    # Score
    emotion_scores = score_sentences(embeddings, vectors)

    # Build per-sentence output
    sentence_records = []
    for i, sent in enumerate(sentences):
        record = {
            "letter_id": sent["letter_id"],
            "index": sent["index"],
            "text": sent["text"],
            "is_formulaic": sent["is_formulaic"],
        }
        for emotion in EMOTIONS:
            record[emotion] = round(float(emotion_scores[emotion][i]), 4)
        sentence_records.append(record)

    # Aggregate per letter
    letter_scores = aggregate_letter_scores(sentence_records, EMOTIONS)

    # Summary
    print_summary(sentence_records, letter_scores, EMOTIONS)

    if args.dry_run:
        print("Dry run -- no files written.")
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
        "script_hash": compute_file_hash(__file__),
        "model": MODEL_NAME,
        "emotions": EMOTIONS,
        "letter_count": len(letter_scores),
        "sentence_count": len(sentence_records),
    }
    for emotion in EMOTIONS:
        meta[f"vector_hash_{emotion}"] = compute_file_hash(
            resolve(f"cvp-{emotion}-vector.csv")
        )
    with open(meta_path, "w", encoding="utf-8") as f:
        json.dump(meta, f, ensure_ascii=False, indent=2)

    print(f"Wrote {sentence_out}")
    print(f"Wrote {letter_out}")
    print(f"Wrote {meta_path}")


if __name__ == "__main__":
    main()
