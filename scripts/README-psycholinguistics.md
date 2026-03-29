# Psycholinguistic Analysis Pipeline (ADR-015)

Multi-layer psycholinguistic analysis of Peter Maersk's WW1 letters, extending the CVP sentiment pipeline with emotion dimensions, linguistic metrics, audience divergence, narrative arcs, and semantic change detection.

## Setup

Requires Python 3.11.

```bash
python3.11 -m venv .venv
source .venv/bin/activate

# CPU-only PyTorch (skip the ~2GB CUDA bundle)
pip install torch --index-url https://download.pytorch.org/whl/cpu

pip install -r requirements-cvp.txt
pip install -r requirements-psycholinguistics.txt
```

### NLP model

DaCy large (transformer-based, best accuracy) or spaCy (faster fallback):

```bash
# Option A: DaCy large (~500MB, 30-60 min for 665 letters on CPU)
python -c "import dacy; dacy.download('da_dacy_large_trf')"

# Option B: spaCy fallback (~50MB, ~5 min on CPU)
python -m spacy download da_core_news_lg
```

The psycholinguistics script tries DaCy first and falls back to spaCy automatically.

## Pipeline scripts

Run in order (or use `npm run data:all` for the full chain):

| Step | Command | Time (CPU) | Output |
|------|---------|------------|--------|
| 1. Emotion vectors | `npm run data:emotion-vectors` | ~10 min | `data/cvp-{fear,grief,hope,love}-vector.csv` |
| 2. Emotion scoring | `npm run data:emotions` | ~10 min | `data/cvp-emotion-scores.json` |
| 3. Psycholinguistic metrics | `npm run data:psycholinguistics` | 30-60 min | `data/letter-psycholinguistics.json` |
| 4. Audience divergence | `npm run data:audience` | <1 min | `data/letter-audience-divergence.json` |
| 5. Narrative arcs | `npm run data:arcs` | <1 min | `data/letter-narrative-arcs.json` |
| 6. Semantic shifts | `npm run data:semantic-shifts` | <1 min | `data/semantic-shifts.json` |
| 7. PCA discovery | `npm run data:pca` | ~10 min | `data/pca-dimensions.json` |

Steps 1-2 need internet access the first time (downloads GoEmotions from HuggingFace).
Step 3 is the slowest (DaCy transformer parsing). Use `da_core_news_lg` fallback for ~5 min.
Step 7 is exploratory and not included in `data:all`.

### Direct Python invocation

All scripts support `--force` (skip cache) and `--dry-run` (compute but don't write):

```bash
python scripts/generate-emotion-vectors.py --dry-run
python scripts/generate-emotions-cvp.py --force
python scripts/analyze-psycholinguistics.py
python scripts/analyze-audience-divergence.py
python scripts/analyze-narrative-arcs.py
python scripts/detect-semantic-shifts.py
python scripts/discover-embedding-dimensions.py --n-components 20
```

## Data outputs

### `data/cvp-emotion-scores.json`
Per-letter scores for fear, grief, hope, love (mean, p10, p90). Keyed by letter ID.

### `data/letter-psycholinguistics.json`
28 metrics per letter across 6 categories:
- **Lexical**: MATTR, MTLD, HD-D, hapax ratio, lexical density
- **Syntactic**: mean dependency distance, sentence length, subordination ratio, tree depth
- **Psychological**: jeg/vi pronouns, hedging, absolutist language, cognitive words, reassurance, sensory language, tense ratios
- **Code-switching**: German military term density
- **Information-theoretic**: Shannon entropy, compression ratio
- **Embedding-derived**: sentiment volatility, arc asymmetry

### `data/letter-audience-divergence.json`
Quarterly Jensen-Shannon divergence and metric differences between Trine-letters (199) and parent-letters (421). Includes 58 same-date letter pair comparisons for censorship analysis.

### `data/letter-narrative-arcs.json`
Within-letter arc classification (valley/peak/rising/falling/flat) and across-letter emotional trajectory with CUSUM change-point detection.

### `data/semantic-shifts.json`
Per-word sentiment context drift and fossilization index for 10 target words across 1911-1918.

### `data/pca-dimensions.json`
Top PCA components with extreme sentences and cosine similarity to concept vectors.

## Skip logic

All scripts implement ADR-029 hash-based caching. Re-running a script when inputs haven't changed exits immediately. Use `--force` to override.

## Dependencies on existing pipeline

These scripts depend on outputs from the existing pipeline:
- `data/normalized-letters.json` (from `npm run data:normalize`)
- `data/normalized-sentences.json` (from `npm run data:sentences`)
- `data/cvp-sentence-scores.json` (from `npm run data:sentiment`)
- `data/cvp-concept-vector.csv` (pre-computed Fiction4 sentiment vector)
- `data/letters.csv` (source metadata with dates and recipients)
