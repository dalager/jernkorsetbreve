# ADR-030: Concept Vector Projection (CVP) for Sentiment Analysis

## Status

Accepted (implemented 2026-03-28, Phase 0-5 complete)

## Date

2026-03-28

## Context

ADR-025 identified the need to upgrade sentiment analysis from lexicon-based tools (AFINN: 0.48 acc, Sentida: 0.44 acc on informal text) to a method robust to historical Danish text.

A 2025 paper from Centre for Humanities Computing, Aarhus University — "Continuous Sentiment Scores for Literary and Multilingual Contexts" (Lyngbaek, Feldkamp, Bizzoni, Nielbo, Enevoldsen) — introduces **Concept Vector Projection (CVP)**, a method purpose-built for exactly this use case.

### Why CVP is ideal for this project

| Property | CVP | XLM-RoBERTa (classifier) | AFINN/Sentida |
|----------|-----|--------------------------|---------------|
| Output | Continuous (-1 to +1) | Pseudo-trinary (clusters at -1, 0, +1) | Integer sum |
| Historical Danish | ρ=0.68 (Fiction4 Danish) | ρ=0.58 | 0.44-0.48 acc |
| Historical robustness | ρ+0.12 on 1798 hymns | Degrades on archaic text | Misses archaic words |
| Fine-tuning needed | No (zero-shot via concept vector) | Yes (or few-shot) | N/A (lexicon) |
| Narrative arc analysis | Native (continuous scores) | Requires post-processing | Too noisy |

CVP outperforms all alternatives on the Fiction4 benchmark for Danish literary text (Table 2 of the paper), including on the historically oldest data (1798-1873 hymns). Our letters (1911-1918) are closer to modern Danish than those hymns.

### How CVP works (9 lines of pseudocode)

```
1. Embed labeled positive and negative example sentences with a sentence transformer
2. P+ = mean(positive embeddings), P- = mean(negative embeddings)
3. Concept vector v = P+ - P-, normalized to unit length
4. For any new sentence: score = embedding · v̂  (dot product)
```

The concept vector encodes the "direction of sentiment" in embedding space. Projecting any sentence onto it yields a continuous sentiment score. Positive projection = positive sentiment, negative = negative, near-zero = neutral.

### Available implementation

The official repo is added as a git submodule at `submodules/aau-cvp/`:

- **Local submodule**: `submodules/aau-cvp/` — full source with pre-computed concept vector
- **Official repo**: `github.com/centre-for-humanities-computing/embedding-projection` (MIT, Python)
- **Pip package (by lead author)**: `github.com/lauritswl/SemanticProjection` — referenced in the repo README as the "quick implementation"
- **Enevoldsen's fork**: `github.com/KennethEnevoldsen/embedding-projection` (WIP pip package)
- **Encoder model**: `paraphrase-multilingual-mpnet-base-v2` (278M params, 768 dims, 50+ languages, ~5.7M downloads/month)
- **Training data**: Fiction4 dataset (`chcaa/fiction4sentiment` on HuggingFace) — 204 positive + 168 negative sentences from Danish/English literary texts (1798-1965)

### Pre-computed assets in submodule

The submodule contains key artifacts that **eliminate the concept vector computation step**:

| Asset | Path | Description |
|-------|------|-------------|
| Concept vector | `submodules/aau-cvp/data/concept_vectors/vectors/Fiction4Sentiment_concept_vector.csv` | Pre-computed 768-dim vector |
| Training sentences | `submodules/aau-cvp/data/concept_vectors/text/Fiction4Sentiment_concept_text.csv` | 372 labeled sentences used to build the vector |
| Fiction4 raw data | `submodules/aau-cvp/data/raw/fiction4.csv` | Full dataset with continuous labels |
| Reference pipeline | `submodules/aau-cvp/src/pipeline.py` | `ConceptProjector` class with `run()` method |
| Embedder | `submodules/aau-cvp/src/embedder.py` | `Embedder` class wrapping sentence-transformers |
| Projector | `submodules/aau-cvp/src/projecter.py` | `ProjectionAnalyzer` — concept vector projection + distance |

### Key code patterns from the reference

The `ProjectionAnalyzer` supports loading a saved concept vector directly:

```python
analyzer = ProjectionAnalyzer(
    matrix_project=test_embeddings,
    use_concept_vector=True,
    concept_vector_path="submodules/aau-cvp/data/concept_vectors/vectors/Fiction4Sentiment_concept_vector.csv"
)
analyzer.project()
scores = analyzer.projected_in_1D  # continuous sentiment scores
```

Our implementation can either import the submodule classes directly or extract just the concept vector CSV — the core projection is a single dot product.

## Decision

Implement CVP sentiment scoring as a Python script, operating at sentence level with multi-score aggregation per letter.

### Architecture

```
data/normalized-letters.json
  ↓
[extract-sentences-normalized.py] → data/normalized-sentences.json
  ↓
[generate-sentiments-cvp.py] + data/cvp-concept-vector.json
  ↓
data/cvp-sentence-scores.json  (per-sentence, for narrative arcs)
data/cvp-letter-scores.json    (per-letter aggregated, for website)
  ↓
[build-data.mjs] → letter-sentiments.json (multi-score format)
```

### Key decisions

1. **Python, not Node.js** — `sentence-transformers` is the canonical library for the encoder model. The official CVP implementation is Python. Fighting ONNX compatibility in Node.js would add ~6 hours for no benefit.

2. **Sentence-level scoring with aggregation** — The encoder's 128-token limit means many letters would be truncated. Sentence-level scoring also enables the multi-score aggregation from ADR-025 and narrative arc visualization.

3. **Use the paper's Fiction4-derived concept vector** — The vector is pre-computed from 204 positive + 168 negative literary sentences (including 19th-century Danish). Our 1911-1918 letters are in the same domain. Domain-specific refinement is a future option.

4. **Must use `paraphrase-multilingual-mpnet-base-v2`** — The concept vector is model-specific. A different encoder would produce incompatible embeddings. This model coexists alongside `multilingual-e5-small` (used for search embeddings); they serve different purposes.

### Multi-score output format

```json
{
  "1": {
    "cvp_mean": 0.042,
    "cvp_min": -0.31,
    "cvp_p10": -0.12,
    "cvp_p90": 0.18,
    "cvp_range": 0.49,
    "negative_ratio": 0.07,
    "sentence_count": 15,
    "afinn_legacy": 1
  }
}
```

## Implementation Plan

### Phase 0: Setup (1-2 hours)

Add Python dependencies:
```
sentence-transformers>=2.2.0
datasets>=2.14.0
torch>=2.0.0
numpy>=1.24.0
```

Model download: ~1 GB (cached in `.cache/`, one-time). Memory at runtime: ~1.5 GB peak.

### Phase 1: Load and Validate Concept Vector (30 min)

The pre-computed concept vector is already available at `submodules/aau-cvp/data/concept_vectors/vectors/Fiction4Sentiment_concept_vector.csv` (768-dim, from 372 labeled Fiction4 sentences).

1. Copy or symlink the vector to `data/cvp-concept-vector.csv` for pipeline independence from the submodule
2. Validate with obvious Danish test sentences (embed a few positive/negative sentences, check dot product signs)
3. Optionally: create `scripts/compute-concept-vector.py` using the submodule's `CorpusLoader` + `Embedder` + `ProjectionAnalyzer` classes for reproducibility — but this is not required for the first run

**No computation needed.** The vector is a static artifact already checked into the submodule.

### Phase 2: Sentence Extraction from Normalized Text (2-3 hours)

Create `scripts/extract-sentences-normalized.py`:
- Rule-based splitter on `text_normalized` (split on `.!?` + space + uppercase, and `<PARA>`)
- Tag formulaic greetings/closings (`"Kære..."`, `"Hilsener..."`, `"din egen..."`)
- Output: `data/normalized-sentences.json`

Use a rule-based approach (not DaCy) to avoid the 35-minute runtime and heavy model dependency. CVP is robust to minor boundary errors since it uses continuous projection, not classification.

**Phases 1 and 2 can run in parallel** — no mutual dependency.

### Phase 3: CVP Scoring Pipeline (3-4 hours)

Create `scripts/generate-sentiments-cvp.py`:
1. Load concept vector from JSON
2. Load normalized sentences
3. Embed all sentences in batches (batch_size=32)
4. Score: `score = embedding @ concept_vector`
5. Aggregate per letter (excluding formulaic sentences): mean, min, p10, p90, range, negative_ratio
6. Output sentence scores + letter scores
7. Implement skip logic (ADR-029 pattern)

Runtime: ~10-15 minutes on CPU for ~10,000 sentences. Skip logic prevents re-runs when inputs haven't changed.

### Phase 4: Validation (2-3 hours)

Create `scripts/compare-sentiment-methods.py`:
- Load old AFINN scores and new CVP scores
- Pearson/Spearman correlation between methods
- Identify 20 most-divergent letters
- Spot-check: do letters about combat/death show low `cvp_p10`? Do peaceful letters score higher?
- Check "reassurance-shock-reassurance" pattern in sentence trajectories

### Phase 5: Pipeline Integration (1-2 hours)

Add to `package.json`:
```json
"data:sentences": "python scripts/extract-sentences-normalized.py",
"data:sentiment": "python scripts/generate-sentiments-cvp.py"
```

Update `build-data.mjs` to read `cvp-letter-scores.json` for the multi-score `letter-sentiments.json`.

### Summary

| Phase | Effort | Parallelizable | Output |
|-------|--------|----------------|--------|
| 0: Setup | 1-2h | — | requirements.txt updated |
| 1: Concept vector | 30 min | Yes (with Phase 2) | `cvp-concept-vector.csv` (copied from submodule) |
| 2: Sentence extraction | 2-3h | Yes (with Phase 1) | `normalized-sentences.json` |
| 3: CVP scoring | 3-4h | — | `cvp-sentence-scores.json`, `cvp-letter-scores.json` |
| 4: Validation | 2-3h | — | `sentiment-comparison.json` |
| 5: Integration | 1-2h | — | Updated pipeline |
| **Total** | **10-14h** | | |

Critical path: Phase 0 → (Phase 1 ∥ Phase 2) → Phase 3 → Phase 4 → Phase 5

The submodule reduces total effort by ~2-4 hours by eliminating concept vector computation and providing reference implementations of all key classes.

## Alternatives Considered

### Implement in Node.js with ONNX

Rejected. `paraphrase-multilingual-mpnet-base-v2` may not have an ONNX export. Manual mean pooling, tokenization handling, and ONNX debugging would add ~6 hours for no quality benefit. Python with sentence-transformers is the canonical path.

### Use a different encoder model

Rejected. The concept vector is tied to the encoder model. Using a different model requires recomputing the vector and revalidating. The paper's results are proven with this specific model on this specific type of text. Changing the model invalidates the benchmarks.

### Skip concept vector, fine-tune a classifier

Rejected. Fine-tuning requires labeled training data from this domain. 665 letters is too small. CVP works zero-shot with the Fiction4-derived vector, which was trained on historical Danish literary text — exactly the right domain.

### Use the official repo as-is

Rejected as a direct dependency (it's a research reproduction, not a library). But the implementation should follow the same algorithm and reference the repo. The core logic is ~50 lines; wrapping it in our pipeline script is cleaner than adapting their `main.py`.

## Consequences

### Positive

- Continuous sentiment scores (not pseudo-trinary) enable meaningful narrative arc analysis
- Proven on historical Danish text — no degradation on 1798-1873 hymns, our 1911-1918 letters are closer to modern Danish
- Multi-score aggregation surfaces hidden negativity (the "drowned negativity" problem)
- Zero-shot — no labeled training data from our corpus needed
- Deterministic — the concept vector is a static artifact, scores are reproducible
- The concept vector approach generalizes: can define vectors for other concepts (fear, homesickness, patriotism) using the same framework

### Negative

- Adds `sentence-transformers` + `torch` as Python dependencies (~1.2 GB installed)
- Model download is ~1 GB (one-time, cached)
- 10-15 minute runtime for full corpus (mitigated by skip logic)
- Not as interpretable as AFINN (can't point to specific words that drove the score)
- 128-token limit means we must work at sentence level, not document level

### Risks

- **Concept vector domain transfer**: Fiction4 is literary text (novels, hymns, poetry). Our letters are personal correspondence. The emotional vocabulary overlaps (personal letters are literary-adjacent) but there may be domain-specific sentiment expressions the vector misses. Mitigation: validation in Phase 4, with option to create a domain-refined vector later.
- **Fiction4 dataset availability**: If HuggingFace removes or changes the dataset, we lose the ability to recompute the vector. Mitigation: the computed vector is stored as a static JSON file in git.
- **Model deprecation**: `paraphrase-multilingual-mpnet-base-v2` is widely used (5.7M downloads/month) and unlikely to disappear, but if it does, a new concept vector must be computed with a replacement model.

## Replanning Triggers

1. **Fiction4 unavailable** → Extract labeled sentences from the `literary_sentiment_benchmarking` repo's data directory
2. **Model too large for build machine** → Consider `paraphrase-multilingual-MiniLM-L12-v2` (384 dims, ~471 MB). Requires recomputing vector.
3. **CVP scores don't correlate with known emotional content** → Label 50-100 sentences from the corpus manually and compute a domain-specific concept vector
4. **Sentence splitting quality too low** → Upgrade to DaCy (adds ~35 min runtime + model dependency)

## Proof of Concept (recommended first step)

Before committing to the full plan, a 15-minute proof of concept using the submodule's pre-computed concept vector:

```python
from sentence_transformers import SentenceTransformer
import pandas as pd
import numpy as np

# Load pre-computed concept vector from submodule
cv_df = pd.read_csv('submodules/aau-cvp/data/concept_vectors/vectors/Fiction4Sentiment_concept_vector.csv')
cv = cv_df.values[0]
cv = cv / np.linalg.norm(cv)  # normalize to unit vector

# Load the same model used to compute the vector
model = SentenceTransformer('paraphrase-multilingual-mpnet-base-v2')

# Test on sample letter sentences (normalized Danish)
tests = [
    "Min egen kære Trine, tak for sidst.",
    "Vi mistede tre kammerater i går ved granaten.",
    "Vejret er fint og maden er god.",
    "Jeg har det ellers godt, men savner jer derhjemme.",
    "Det er forfærdeligt og trist her i skyttegraven.",
    "Jeg glæder mig til at komme hjem til jer alle.",
    "Vi har næsten ikke noget at spise.",
    "Tak for pakken, den gjorde mig så glad.",
]
for t in tests:
    score = model.encode(t) @ cv
    print(f"{score:+.3f}  {t}")
```

If this produces sensible scores (positive for happy sentences, negative for war/suffering), proceed with the full plan. If not, investigate before investing further.

Alternatively, use the submodule's own classes directly:

```python
import sys; sys.path.insert(0, 'submodules/aau-cvp')
from src.embedder import Embedder
from src.projecter import ProjectionAnalyzer

embedder = Embedder(model_name="paraphrase-multilingual-mpnet-base-v2")
# ... embed and project using the submodule's pipeline
```

## Related

- ADR-025: Sentiment Analysis on Normalized Text (this ADR implements the CVP upgrade path from ADR-025)
- ADR-026: Extract Notebooks to Scripts (CVP scripts follow the same conventions)
- ADR-029: Artifact Hashing (skip logic for sentiment pipeline)
- ADR-014: Archaic Danish Text Modernization (normalized text as input)

## Sources

- Lyngbaek et al. 2025, "Continuous Sentiment Scores for Literary and Multilingual Contexts" (doi:10.63744/nVu1Zq5gRkuD, CC BY 4.0)
- Follow-up: Lyngbaek et al. 2026, "Is Sentiment Banana-Shaped? Exploring the Geometry and Portability of Sentiment Concept Vectors" (arXiv:2601.07995)
- Official implementation: `github.com/centre-for-humanities-computing/embedding-projection` (MIT)
- Fiction4 dataset: `huggingface.co/datasets/chcaa/fiction4sentiment`
- Encoder model: `huggingface.co/sentence-transformers/paraphrase-multilingual-mpnet-base-v2`
