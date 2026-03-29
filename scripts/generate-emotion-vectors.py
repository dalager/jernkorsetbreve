"""
Generate emotion concept vectors from GoEmotions dataset (ADR-015).

Algorithm:
  1. Load GoEmotions dataset from HuggingFace
  2. For each target emotion, filter positive/negative pole sentences
  3. Embed both poles with paraphrase-multilingual-mpnet-base-v2
  4. Concept vector = mean(positive) - mean(negative), normalized to unit length
  5. Save to data/cvp-{emotion}-vector.csv

Target emotions:
  fear:      labels fear + nervousness        vs neutral
  grief:     labels grief + sadness           vs neutral
  hope:      label  optimism                  vs disappointment + sadness
  love:      labels love + caring             vs neutral
  anger:     labels anger + annoyance         vs neutral
  gratitude: label  gratitude                 vs neutral
  pride:     label  pride                     vs neutral
  remorse:   label  remorse                   vs neutral
  relief:    label  relief                    vs neutral
  desire:    label  desire                    vs neutral

Inputs:
  google-research-datasets/go_emotions (HuggingFace)
  data/cvp-concept-vector.csv          existing sentiment vector (for comparison)

Outputs:
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
"""

import argparse
import os
import sys

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
# GoEmotions label mapping
# ---------------------------------------------------------------------------

LABEL_IDS = {
    "admiration": 0, "amusement": 1, "anger": 2, "annoyance": 3,
    "approval": 4, "caring": 5, "confusion": 6, "curiosity": 7,
    "desire": 8, "disappointment": 9, "disapproval": 10, "disgust": 11,
    "embarrassment": 12, "excitement": 13, "fear": 14, "gratitude": 15,
    "grief": 16, "joy": 17, "love": 18, "nervousness": 19,
    "optimism": 20, "pride": 21, "realization": 22, "relief": 23,
    "remorse": 24, "sadness": 25, "surprise": 26, "neutral": 27,
}

# Emotion definitions: (positive_label_names, negative_label_names)
EMOTION_DEFS = {
    "fear": {
        "positive": ["fear", "nervousness"],
        "negative": ["neutral"],
    },
    "grief": {
        "positive": ["grief", "sadness"],
        "negative": ["neutral"],
    },
    "hope": {
        "positive": ["optimism"],
        "negative": ["disappointment", "sadness"],
    },
    "love": {
        "positive": ["love", "caring"],
        "negative": ["neutral"],
    },
    "anger": {
        "positive": ["anger", "annoyance"],
        "negative": ["neutral"],
    },
    "gratitude": {
        "positive": ["gratitude"],
        "negative": ["neutral"],
    },
    "pride": {
        "positive": ["pride"],
        "negative": ["neutral"],
    },
    "remorse": {
        "positive": ["remorse"],
        "negative": ["neutral"],
    },
    "relief": {
        "positive": ["relief"],
        "negative": ["neutral"],
    },
    "desire": {
        "positive": ["desire"],
        "negative": ["neutral"],
    },
}

# ---------------------------------------------------------------------------
# Validation sentences (Danish WW1 context)
# ---------------------------------------------------------------------------

VALIDATION_SENTENCES = {
    "fear": [
        "Jeg er bange for hvad der vil ske.",          # I'm afraid of what will happen
        "Granaterne falder tæt på os.",                # Shells are falling close to us
        "Alt er roligt og fredeligt her.",              # Everything is calm and peaceful (LOW)
    ],
    "grief": [
        "Min ven er faldet i kamp.",                   # My friend fell in combat
        "Vi mistede tre kammerater i dag.",             # We lost three comrades today
        "Vi fejrede hans fødselsdag.",                  # We celebrated his birthday (LOW)
    ],
    "hope": [
        "Snart er krigen forbi og vi ses igen.",       # Soon the war is over and we'll see each other
        "Jeg drømmer om vores fremtid sammen.",        # I dream of our future together
        "Det er håbløst og vil aldrig ende.",           # It's hopeless and will never end (LOW)
    ],
    "love": [
        "Min egen kære Trine, jeg savner dig.",        # My own dear Trine, I miss you
        "Jeg elsker dig af hele mit hjerte.",           # I love you with all my heart
        "Regt. marcherede 30 kilometer i dag.",        # Regt. marched 30 km today (LOW)
    ],
    "anger": [
        "Det er nu en hel forbistret en den Oberst, så man skal passe grulig på der.",  # That colonel is a real nuisance (HIGH)
        "Jeg syntes det var næsten for galt, som de morede dem i den strenge tid.",      # Almost too much, amusing themselves in hard times (HIGH)
        "Vi havde det helt godt den eftermiddag.",                                       # We had a nice afternoon (LOW)
    ],
    "gratitude": [
        "Jeg kan ikke nok takke Gud for den gode plads, jeg har.",                      # I cannot thank God enough for my good position (HIGH)
        "Og jeg takker Gud for det.",                                                    # And I thank God for it (HIGH)
        "I morgen skal vi marchere igen.",                                                # Tomorrow we march again (LOW)
    ],
    "pride": [
        "Det er en af de bedste Korporalskaber, jeg har haft.",                          # One of the best corporalships I've had (HIGH)
        "Og mange af vor komp. får nok også Jernkorset.",                                 # Many of our company will get the Iron Cross (HIGH)
        "Vi fik suppe til middag.",                                                       # We had soup for lunch (LOW)
    ],
    "remorse": [
        "Men jeg var så ked af det, for du kunne jo tro noget helt andet.",              # I was so sorry, you could think something else (HIGH)
        "Ja du må undskylde mig, fordi jeg narrede dig med Turen til Lundsmark.",        # You must excuse me for tricking you about the trip (HIGH)
        "Vejret er fint i dag.",                                                          # The weather is fine today (LOW)
    ],
    "relief": [
        "Ja nu Gud ske lov og tak at jeg er levende.",                                   # Thank God I am alive (HIGH)
        "Men Gud ske lov, at det gik som det gik.",                                      # Thank God it went as it did (HIGH)
        "Vi skal op kl. 5 i morgen.",                                                     # We must be up at 5 tomorrow (LOW)
    ],
    "desire": [
        "Jeg længes i hver fald forfærdelig efter dig kære Trine.",                      # I long terribly for you dear Trine (HIGH)
        "Å gid jeg også havde haft min - Jeg længes sådan efter at se og tale med dig.", # Oh if only I had mine - I long to see and talk with you (HIGH)
        "Der er kommet nye forsyninger i dag.",                                            # New supplies arrived today (LOW)
    ],
}

MIN_POLE_SENTENCES = 100


# ---------------------------------------------------------------------------
# Core
# ---------------------------------------------------------------------------

def load_goemotions():
    """Load GoEmotions dataset from HuggingFace."""
    from datasets import load_dataset

    print("Loading GoEmotions dataset from HuggingFace...")
    ds = load_dataset("google-research-datasets/go_emotions", "simplified")
    # Combine all splits for maximum coverage
    all_texts = []
    all_labels = []
    for split in ["train", "validation", "test"]:
        for row in ds[split]:
            all_texts.append(row["text"])
            all_labels.append(row["labels"])
    print(f"  Loaded {len(all_texts)} examples across all splits.")
    return all_texts, all_labels


def filter_poles(
    all_texts: list[str],
    all_labels: list[list[int]],
    positive_names: list[str],
    negative_names: list[str],
) -> tuple[list[str], list[str]]:
    """Filter sentences into positive and negative poles."""
    pos_ids = {LABEL_IDS[n] for n in positive_names}
    neg_ids = {LABEL_IDS[n] for n in negative_names}

    positive_texts = []
    negative_texts = []

    for text, labels in zip(all_texts, all_labels):
        label_set = set(labels)
        if label_set & pos_ids:
            positive_texts.append(text)
        elif label_set & neg_ids:
            # Only include in negative pole if it does NOT also have a
            # positive label (avoid contamination)
            if not (label_set & pos_ids):
                negative_texts.append(text)

    return positive_texts, negative_texts


def embed_texts(texts: list[str], model) -> np.ndarray:
    """Embed a list of texts using the loaded model."""
    embeddings = model.encode(texts, batch_size=32, show_progress_bar=True)
    return embeddings.astype(np.float32)


def compute_concept_vector(
    pos_embeddings: np.ndarray, neg_embeddings: np.ndarray
) -> np.ndarray:
    """Compute and normalize a concept vector from positive/negative poles."""
    cv = pos_embeddings.mean(axis=0) - neg_embeddings.mean(axis=0)
    cv = cv / np.linalg.norm(cv)
    return cv.astype(np.float32)


def save_concept_vector(cv: np.ndarray, path: str) -> None:
    """Save concept vector to CSV in same format as cvp-concept-vector.csv."""
    df = pd.DataFrame([cv], columns=[str(i) for i in range(len(cv))])
    df.to_csv(path, index=False)


def load_concept_vector(path: str) -> np.ndarray:
    """Load a concept vector from CSV."""
    cv_df = pd.read_csv(path)
    cv = cv_df.values[0].astype(np.float32)
    assert cv.shape == (768,), f"Expected 768-dim vector, got {cv.shape}"
    cv = cv / np.linalg.norm(cv)
    return cv


def cosine_similarity(a: np.ndarray, b: np.ndarray) -> float:
    """Cosine similarity between two unit vectors."""
    return float(np.dot(a, b))


def print_similarity_matrix(vectors: dict[str, np.ndarray]) -> None:
    """Print a cosine similarity matrix between all concept vectors."""
    names = list(vectors.keys())
    n = len(names)

    # Header
    col_width = max(len(name) for name in names) + 2
    header = " " * col_width + "".join(name.rjust(col_width) for name in names)
    print(header)

    for i in range(n):
        row = names[i].ljust(col_width)
        for j in range(n):
            sim = cosine_similarity(vectors[names[i]], vectors[names[j]])
            row += f"{sim:>{col_width}.4f}"
        print(row)


def validate_vectors(vectors: dict[str, np.ndarray], model) -> None:
    """Score validation sentences against each vector and print results."""
    print("\n--- Validation Scores ---")
    for emotion, sentences in VALIDATION_SENTENCES.items():
        if emotion not in vectors:
            continue
        cv = vectors[emotion]
        embeddings = model.encode(sentences, batch_size=32, show_progress_bar=False)
        embeddings = embeddings.astype(np.float32)
        scores = embeddings @ cv
        print(f"\n  {emotion}:")
        for sent, score in zip(sentences, scores):
            print(f"    {score:+.4f}  {sent}")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    parser = argparse.ArgumentParser(
        description="Generate emotion concept vectors from GoEmotions (ADR-015)"
    )
    parser.add_argument(
        "--force", action="store_true",
        help="Regenerate vectors even if they already exist",
    )
    parser.add_argument(
        "--dry-run", action="store_true",
        help="Show stats without writing output files",
    )
    args = parser.parse_args()

    # Check if vectors already exist
    emotions = list(EMOTION_DEFS.keys())
    output_paths = {e: resolve(f"cvp-{e}-vector.csv") for e in emotions}

    if not args.force:
        existing = [e for e in emotions if os.path.exists(output_paths[e])]
        if len(existing) == len(emotions):
            print("All emotion vectors already exist. Use --force to regenerate.")
            sys.exit(0)

    # Load GoEmotions
    all_texts, all_labels = load_goemotions()

    # Load embedding model
    from sentence_transformers import SentenceTransformer

    print(f"\nLoading model {MODEL_NAME}...")
    model = SentenceTransformer(MODEL_NAME)

    # Process each emotion
    vectors: dict[str, np.ndarray] = {}

    print("\n--- Emotion Pole Statistics ---")
    for emotion in emotions:
        defn = EMOTION_DEFS[emotion]
        pos_texts, neg_texts = filter_poles(
            all_texts, all_labels,
            defn["positive"], defn["negative"],
        )

        print(f"\n  {emotion}:")
        print(f"    Positive pole ({', '.join(defn['positive'])}): {len(pos_texts)} sentences")
        print(f"    Negative pole ({', '.join(defn['negative'])}): {len(neg_texts)} sentences")

        assert len(pos_texts) >= MIN_POLE_SENTENCES, (
            f"{emotion}: need >= {MIN_POLE_SENTENCES} positive sentences, "
            f"got {len(pos_texts)}"
        )
        assert len(neg_texts) >= MIN_POLE_SENTENCES, (
            f"{emotion}: need >= {MIN_POLE_SENTENCES} negative sentences, "
            f"got {len(neg_texts)}"
        )

        print(f"    Embedding positive pole...")
        pos_emb = embed_texts(pos_texts, model)
        print(f"    Embedding negative pole...")
        neg_emb = embed_texts(neg_texts, model)

        cv = compute_concept_vector(pos_emb, neg_emb)
        vectors[emotion] = cv

    # Load existing sentiment vector for comparison
    sentiment_path = resolve("cvp-concept-vector.csv")
    all_vectors = dict(vectors)
    if os.path.exists(sentiment_path):
        all_vectors["sentiment"] = load_concept_vector(sentiment_path)

    # Print cosine similarity matrix
    print("\n--- Concept Vector Cosine Similarity Matrix ---")
    print_similarity_matrix(all_vectors)

    # Validation
    validate_vectors(vectors, model)

    # Summary
    print("\n--- Summary ---")
    for emotion, cv in vectors.items():
        print(f"  {emotion}: norm={np.linalg.norm(cv):.6f}, "
              f"min={cv.min():.6f}, max={cv.max():.6f}")

    if args.dry_run:
        print("\nDry run -- no files written.")
        sys.exit(0)

    # Write output
    print("\nWriting concept vectors...")
    for emotion, cv in vectors.items():
        path = output_paths[emotion]
        save_concept_vector(cv, path)
        print(f"  Wrote {path}")

    print("\nDone.")


if __name__ == "__main__":
    main()
