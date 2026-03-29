"""
Unsupervised PCA dimension discovery on sentence embeddings (ADR-015).

Algorithm:
  1. Embed all sentences (or load cached embeddings)
  2. Run PCA on the 768-dim embedding matrix
  3. For each top PC, find the 20 highest- and 20 lowest-scoring sentences
  4. Compute cosine similarity between each PC direction and available
     concept vectors (sentiment, fear, grief, hope, love)
  5. Report explained variance ratios and output results for interpretation

Inputs:
  data/normalized-sentences.json       sentence objects
  data/cvp-concept-vector.csv          768-dim sentiment concept vector
  data/cvp-{fear,grief,hope,love}-vector.csv   (optional emotion vectors)

Outputs:
  data/pca-dimensions.json             PCA analysis results
  data/.cache/sentence-embeddings.npy  cached embeddings (reusable)
"""

import argparse
import json
import os
import sys
from itertools import combinations

import numpy as np
import pandas as pd

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(SCRIPT_DIR, os.pardir, "data")
MODEL_NAME = "paraphrase-multilingual-mpnet-base-v2"
CACHE_DIR = os.path.join(DATA_DIR, ".cache")
EMBEDDING_CACHE = os.path.join(CACHE_DIR, "sentence-embeddings.npy")

TEXT_TRUNCATE = 80  # max chars of sentence text to include in output


def resolve(path: str) -> str:
    return os.path.normpath(os.path.join(DATA_DIR, path))


# ---------------------------------------------------------------------------
# Loading helpers
# ---------------------------------------------------------------------------

def load_sentences(path: str) -> list[dict]:
    with open(path, "r", encoding="utf-8") as f:
        sentences = json.load(f)
    assert len(sentences) >= 5000, (
        f"Expected >= 5000 sentences, got {len(sentences)}"
    )
    return sentences


def load_concept_vectors() -> dict[str, np.ndarray]:
    """Load all available concept vectors from data/."""
    vectors: dict[str, np.ndarray] = {}

    # Sentiment (always present)
    sentiment_path = resolve("cvp-concept-vector.csv")
    if os.path.exists(sentiment_path):
        cv = pd.read_csv(sentiment_path).values[0].astype(np.float32)
        assert cv.shape == (768,), f"Sentiment vector: expected 768-dim, got {cv.shape}"
        vectors["sentiment"] = cv / np.linalg.norm(cv)

    # Emotion vectors (may or may not exist)
    for emotion in ["fear", "grief", "hope", "love"]:
        path = resolve(f"cvp-{emotion}-vector.csv")
        if os.path.exists(path):
            cv = pd.read_csv(path).values[0].astype(np.float32)
            assert cv.shape == (768,), f"{emotion} vector: expected 768-dim, got {cv.shape}"
            vectors[emotion] = cv / np.linalg.norm(cv)

    return vectors


# ---------------------------------------------------------------------------
# Embedding (with cache)
# ---------------------------------------------------------------------------

def embed_sentences(texts: list[str], force: bool = False) -> np.ndarray:
    """Embed sentences, using a numpy cache file when available."""
    if not force and os.path.exists(EMBEDDING_CACHE):
        print(f"Loading cached embeddings from {EMBEDDING_CACHE}...")
        embeddings = np.load(EMBEDDING_CACHE)
        if embeddings.shape[0] == len(texts):
            print(f"  Cache hit: {embeddings.shape[0]} x {embeddings.shape[1]}")
            return embeddings.astype(np.float32)
        print(f"  Cache size mismatch ({embeddings.shape[0]} vs {len(texts)}), "
              "re-embedding...")

    from sentence_transformers import SentenceTransformer

    print(f"Loading model {MODEL_NAME}...")
    model = SentenceTransformer(MODEL_NAME)
    print(f"Embedding {len(texts)} sentences...")
    embeddings = model.encode(texts, batch_size=32, show_progress_bar=True)
    embeddings = embeddings.astype(np.float32)

    # Cache for reuse
    os.makedirs(CACHE_DIR, exist_ok=True)
    np.save(EMBEDDING_CACHE, embeddings)
    print(f"  Cached embeddings to {EMBEDDING_CACHE}")

    return embeddings


# ---------------------------------------------------------------------------
# PCA analysis
# ---------------------------------------------------------------------------

def run_pca(embeddings: np.ndarray, n_components: int) -> tuple:
    """Run PCA and return (transformed, pca_object)."""
    from sklearn.decomposition import PCA

    print(f"Running PCA with {n_components} components on "
          f"{embeddings.shape[0]} x {embeddings.shape[1]} matrix...")
    pca = PCA(n_components=n_components)
    transformed = pca.fit_transform(embeddings)
    print(f"  Total explained variance: "
          f"{sum(pca.explained_variance_ratio_):.4f}")
    return transformed, pca


def find_extreme_sentences(
    transformed: np.ndarray,
    sentences: list[dict],
    component_idx: int,
    n: int = 20,
) -> tuple[list[dict], list[dict]]:
    """Find the n highest- and lowest-scoring sentences for a PC."""
    scores = transformed[:, component_idx]
    top_indices = np.argsort(scores)[-n:][::-1]
    bottom_indices = np.argsort(scores)[:n]

    def build_record(idx: int) -> dict:
        sent = sentences[idx]
        text = sent["text"]
        if len(text) > TEXT_TRUNCATE:
            text = text[:TEXT_TRUNCATE] + "..."
        return {
            "letter_id": sent["letter_id"],
            "index": sent["index"],
            "text": text,
            "score": round(float(scores[idx]), 4),
        }

    top = [build_record(int(i)) for i in top_indices]
    bottom = [build_record(int(i)) for i in bottom_indices]
    return top, bottom


def compute_cv_similarities(
    pca, concept_vectors: dict[str, np.ndarray], n_components: int,
) -> dict[str, dict[str, float]]:
    """Cosine similarity between each PC direction and each concept vector."""
    result: dict[str, dict[str, float]] = {}
    for i in range(n_components):
        pc_direction = pca.components_[i].astype(np.float32)
        pc_direction = pc_direction / np.linalg.norm(pc_direction)
        sims = {}
        for name, cv in sorted(concept_vectors.items()):
            sims[name] = round(float(np.dot(pc_direction, cv)), 4)
        result[f"PC{i + 1}"] = sims
    return result


def compute_cv_correlation_matrix(
    concept_vectors: dict[str, np.ndarray],
) -> dict[str, float]:
    """Pairwise cosine similarities between all concept vectors."""
    names = sorted(concept_vectors.keys())
    matrix = {}
    for a, b in combinations(names, 2):
        key = f"{a}_vs_{b}"
        sim = float(np.dot(concept_vectors[a], concept_vectors[b]))
        matrix[key] = round(sim, 4)
    return matrix


# ---------------------------------------------------------------------------
# Output
# ---------------------------------------------------------------------------

def build_output(
    pca,
    transformed: np.ndarray,
    sentences: list[dict],
    concept_vectors: dict[str, np.ndarray],
    n_components: int,
) -> dict:
    """Build the full JSON output structure."""
    ev = [round(float(r), 4) for r in pca.explained_variance_ratio_[:n_components]]
    cumulative = [round(float(sum(ev[:i + 1])), 4) for i in range(len(ev))]

    cv_sims = compute_cv_similarities(pca, concept_vectors, n_components)

    components = {}
    for i in range(n_components):
        pc_name = f"PC{i + 1}"
        top, bottom = find_extreme_sentences(transformed, sentences, i, n=20)
        components[pc_name] = {
            "explained_variance_ratio": ev[i],
            "top_sentences": top,
            "bottom_sentences": bottom,
            "concept_vector_similarity": cv_sims[pc_name],
        }

    cv_matrix = compute_cv_correlation_matrix(concept_vectors)

    return {
        "explained_variance_ratio": ev,
        "cumulative_variance": cumulative,
        "components": components,
        "concept_vector_correlation_matrix": cv_matrix,
    }


def print_report(output: dict, concept_vectors: dict[str, np.ndarray]) -> None:
    """Print a human-readable interpretation report to stdout."""
    print("\n" + "=" * 70)
    print("PCA DIMENSION DISCOVERY REPORT")
    print("=" * 70)

    ev = output["explained_variance_ratio"]
    cv = output["cumulative_variance"]
    print(f"\nComponents analyzed: {len(ev)}")
    print(f"Total explained variance: {cv[-1]:.4f} ({cv[-1] * 100:.1f}%)")

    print("\n--- Explained Variance per Component ---")
    for i, (e, c) in enumerate(zip(ev, cv)):
        bar = "#" * int(e * 500)  # visual bar
        print(f"  PC{i + 1:2d}: {e:.4f} (cum: {c:.4f})  {bar}")

    cv_names = sorted(concept_vectors.keys())
    if cv_names:
        print(f"\n--- Concept Vector Alignment (loaded: {', '.join(cv_names)}) ---")
        for pc_name, comp in output["components"].items():
            sims = comp["concept_vector_similarity"]
            # Find strongest alignment
            if sims:
                best_name = max(sims, key=lambda k: abs(sims[k]))
                best_val = sims[best_name]
                sim_str = "  ".join(
                    f"{n}={v:+.4f}" for n, v in sorted(sims.items())
                )
                print(f"  {pc_name}: {sim_str}")
                if abs(best_val) >= 0.3:
                    direction = "+" if best_val > 0 else "-"
                    print(f"        ** Strong alignment with {best_name} "
                          f"({direction}{abs(best_val):.4f})")

    if output["concept_vector_correlation_matrix"]:
        print("\n--- Concept Vector Correlations ---")
        for pair, sim in sorted(output["concept_vector_correlation_matrix"].items()):
            print(f"  {pair}: {sim:+.4f}")

    print("\n--- Top/Bottom Sentences (first 3 per component) ---")
    for pc_name, comp in output["components"].items():
        print(f"\n  {pc_name} (var={comp['explained_variance_ratio']:.4f}):")
        print("    TOP:")
        for s in comp["top_sentences"][:3]:
            print(f"      [{s['score']:+.4f}] {s['text']}")
        print("    BOTTOM:")
        for s in comp["bottom_sentences"][:3]:
            print(f"      [{s['score']:+.4f}] {s['text']}")

    print("\n" + "=" * 70)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    parser = argparse.ArgumentParser(
        description="Unsupervised PCA dimension discovery on sentence "
                    "embeddings (ADR-015)"
    )
    parser.add_argument(
        "--force", action="store_true",
        help="Re-embed sentences even if cache exists",
    )
    parser.add_argument(
        "--dry-run", action="store_true",
        help="Compute and print report but do not write output",
    )
    parser.add_argument(
        "--n-components", type=int, default=10,
        help="Number of principal components to analyze (default: 10)",
    )
    args = parser.parse_args()

    sentences_path = resolve("normalized-sentences.json")
    output_path = resolve("pca-dimensions.json")

    # Validate input
    if not os.path.exists(sentences_path):
        print(f"Error: Sentences not found at {sentences_path}", file=sys.stderr)
        sys.exit(1)

    # Load inputs
    sentences = load_sentences(sentences_path)
    texts = [s["text"] for s in sentences]
    print(f"Loaded {len(sentences)} sentences.")

    concept_vectors = load_concept_vectors()
    if concept_vectors:
        print(f"Loaded concept vectors: {', '.join(sorted(concept_vectors.keys()))}")
    else:
        print("Warning: no concept vectors found. "
              "CV alignment analysis will be empty.")

    # Embed
    embeddings = embed_sentences(texts, force=args.force)

    # PCA
    n_components = min(args.n_components, embeddings.shape[0], embeddings.shape[1])
    transformed, pca = run_pca(embeddings, n_components)

    # Build output
    output = build_output(pca, transformed, sentences, concept_vectors, n_components)

    # Report
    print_report(output, concept_vectors)

    if args.dry_run:
        print("Dry run -- no files written.")
        sys.exit(0)

    # Write output
    print(f"Writing {output_path}...")
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)
    print(f"Wrote {output_path}")


if __name__ == "__main__":
    main()
