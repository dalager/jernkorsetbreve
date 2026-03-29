# Analysis: Sentiment Pipeline Modernization & Best Practices

**Date:** 2026-03-28
**Scope:** Sentiment analysis on modernized text, pipeline extraction, NLP best practices

---

## 1. Should Sentiment Analysis Use Normalized/Modernized Text?

### Finding: Yes, with high confidence

The hypothesis is well-founded. The current sentiment pipeline (notebook `05a_generate_sentiments.ipynb`) runs AFINN, Sentida, and DaNLP BERT on the archaic Danish text from `data/letters.csv`. All three tools are trained or built on modern Danish, which means archaic spellings create systematic blind spots.

### Evidence from the codebase

**AFINN (lexicon-based):** Works by looking up individual words in a Danish sentiment dictionary. Archaic spellings produce direct lookup failures:

| Archaic (current input) | Modern (after normalization) | AFINN impact |
|---|---|---|
| kjære | kære | "kjære" likely missing from lexicon |
| kjærlighed | kærlighed | Positive word, missed entirely |
| daarlig | dårlig | Negative word, missed entirely |
| morsomt → morsåmt? No, already modern | morsomt | OK |
| saa glad | så glad | "saa" may not resolve; "så" is a known intensifier |
| gaaet | gået | Missed participial form |
| vilde | ville | Modal verb, possible mismatch |

Every missed word is a lost signal. For a lexicon with ~3,500 entries (AFINN-da), even a 5% miss rate across the corpus is significant because sentiment words are sparse -- missing a few per letter can shift the score substantially.

**Sentida (Danish sentiment):** Same lexicon-based vulnerability. Sentida's dictionary is Danish-specific but built on modern orthography. The `aa`-to-`å` transformation alone (the single most frequent change, as shown by `normalize-danish.mjs` statistics) would affect hundreds of words across the corpus.

**DaNLP BERT emotion:** This is the most interesting case. The BERT tokenizer uses subword tokenization, so it can partially handle unknown words by splitting them. However:
- "kjære" gets tokenized differently than "kære"
- "skulde" vs "skulle" may map to different subword sequences
- The model was trained on modern Danish web text, news, and social media -- not 1910s correspondence
- Archaic forms will cluster in the model's embedding space differently from their modern equivalents

The BERT model is more robust than lexicon approaches, but modernized text would still improve its predictions by aligning inputs with training distribution.

### Quantitative estimate

The `normalize-danish.mjs` script's statistics (visible in the `--stats` output) show the normalization touches the majority of letters. Based on the rule categories:

- `aa`-to-`å`: Affects nearly every letter (the most common change)
- Verb forms (skulde, vilde, kunde): High frequency modal verbs
- Adverbs (saa, idag, igaar): Very common words
- Orthography (kj, gj, skj): Affects emotion-laden words like "kjære/kære", "kjærlighed/kærlighed"

The last point is critical: sentiment-carrying words (love, dear, sad, bad) are disproportionately affected because they are common in personal correspondence AND many happen to use archaic orthography.

### Recommendation

Run sentiment analysis on normalized text. Expected improvement:
- **AFINN/Sentida:** 10-30% more words matched to lexicon entries (estimate based on normalization rule coverage)
- **BERT emotion:** Modest but meaningful improvement in classification accuracy
- **Overall:** More reliable sentiment time-series, fewer false-neutral scores on emotionally charged letters

### Validation approach

Run sentiment on BOTH archaic and modernized text, compare:
1. Count of non-zero AFINN word matches per letter (archaic vs. modern)
2. Pearson correlation between archaic and modern sentiment scores
3. Manual review of the 20 letters with largest score differences
4. Check whether the BERT emotion label distribution changes (currently, "Vrede/Irritation" appears dominant in the sample -- this may be an artifact of lexicon misses pushing neutral-positive letters into negative territory, or it may be genuine)

---

## 2. Should the Pipeline Be Extracted from Notebooks to Scripts?

### Current state

| Step | Format | Purpose |
|---|---|---|
| 01_cleanup | Notebook | JSON to CSV conversion, text cleaning |
| 02_geodata | Notebook | Geocoding |
| 03_extract_sentences | Notebook | Sentence extraction |
| 04_extract_named_entities | Notebook | NER |
| 05a_generate_sentiments | Notebook | Sentiment scoring (AFINN + Sentida + BERT) |
| 05b_sentiment_analysis | Notebook | Visualization of sentiment results |
| 06-15 | Notebooks | Various analysis and export |
| normalize-danish.mjs | Script | Text modernization |
| build-data.mjs | Script | Website data assembly |
| generate-embeddings.mjs | Script | Vector embeddings |
| generate-clusters.mjs | Script | Topic clustering |

The Node.js scripts are already well-structured: deterministic, CLI-friendly, composable via `npm run data:all`. The Python notebooks mix processing and exploration.

### Recommendation: Selective extraction, not wholesale migration

For a personal/research project, the cost-benefit of full script extraction is different from enterprise. The right approach:

**Extract processing steps that feed downstream consumers:**
- `01_cleanup` (letters.json to letters.csv) -- this is the foundation of everything
- `05a_generate_sentiments` (produces `sentiment_scored_letters.csv` consumed by `build-data.mjs`)
- `03_extract_sentences` (produces `sentences.csv` used by sentiment)

**Keep as notebooks (exploration/visualization):**
- `05b_sentiment_analysis` -- pure visualization, no downstream consumers
- `06_verb_noun_frequencies` -- analysis only
- `07_lemmatization` -- analysis only
- `11_placemaps`, `12_vector_clusters`, `13-15` -- all EDA/visualization

### Why extract these three?

1. **Reproducibility:** `01_cleanup` and `05a_generate_sentiments` produce files that the website build depends on. They should be runnable without Jupyter.
2. **CI/CD:** The `npm run data:all` pipeline already chains Node.js scripts. Adding Python scripts to this chain (via subprocess calls or a Makefile) makes the full pipeline automatable.
3. **Dependency clarity:** The notebooks import from various places (`sys.path.insert(0, '../scripts')`, inline NLTK downloads). Scripts force explicit dependency management.

### Practical extraction plan

The sentiment notebook is only ~10 cells. Extracted as a Python script, it would be approximately 80 lines:

```
scripts/generate-sentiments.py
  Input:  data/letters.csv (or data/normalized-letters.json for modernized text)
  Output: data/sentiment_scored_letters.csv
  Deps:   pandas, afinn, sentida, danlp
```

The cleanup notebook is similarly small. The sentence extraction delegates to a module already (`sentence_extractor.py`), so it is nearly script-ready.

---

## 3. Best Practices for ML NLP Pipelines (Research-Scale)

The following recommendations are calibrated for a personal/research project with ~665 documents. Enterprise-grade tooling (Kubeflow, MLflow, Airflow) would be overkill.

### 3.1 Pipeline Orchestration

**Current:** `npm run data:all` chains Node.js scripts sequentially. Python notebooks are run manually.

**Recommended: Makefile**

A Makefile is the right tool at this scale. It handles:
- Mixed Node.js and Python steps
- File-based dependency tracking (only re-run if inputs changed)
- No new dependencies to install
- Universally understood

```makefile
# Example structure
data/letters.csv: data/letters.json scripts/cleanup.py
    python scripts/cleanup.py

data/normalized-letters.json: data/letters.json scripts/normalize-danish.mjs
    node scripts/normalize-danish.mjs

data/sentiment_scored_letters.csv: data/normalized-letters.json scripts/generate-sentiments.py
    python scripts/generate-sentiments.py --input normalized

apps/website/public/data/letters.json: data/letters.csv data/sentiment_scored_letters.csv
    node scripts/build-data.mjs

.PHONY: all
all: apps/website/public/data/letters.json
```

**Why not DVC?** DVC is excellent but adds complexity (requires a remote storage backend, `.dvc` files in git, learning curve). For a 665-document corpus where all data fits in git, a Makefile provides 80% of the benefit at 10% of the complexity.

**Why not Prefect/Dagster/Airflow?** These are server-based orchestrators designed for recurring production pipelines. This project runs its pipeline manually or at build time. A Makefile is the right abstraction.

### 3.2 Data Versioning

**Current:** Data files (`letters.csv`, `sentiment_scored_letters.csv`) are tracked in git. JSON data files for the website are also in git.

**Recommended: Keep using git for now.** The entire dataset is small enough:
- `letters.json`: ~2 MB
- `letters.csv`: ~1 MB
- `sentiment_scored_letters.csv`: ~1.5 MB
- Website JSON files: ~5 MB total

This is well within git's comfort zone. The main risk is binary files (`embeddings.bin`) which are already tracked. If `embeddings.bin` grows beyond ~50 MB, consider git-lfs for that single file.

**If the project grows:** DVC would be the natural next step, with local storage (no cloud needed for a personal project).

### 3.3 Separation of Concerns

The project already demonstrates good separation intuitively. Formalizing it:

```
data/                          # Raw and derived data (tracked in git)
  letters.json                 # Source of truth (never modified by pipeline)
  letters.csv                  # Derived: cleaned text
  normalized-letters.json      # Derived: modernized text
  sentiment_scored_letters.csv # Derived: sentiment scores
  sentences.csv                # Derived: extracted sentences

scripts/                       # Processing scripts (deterministic transforms)
  cleanup.py                   # letters.json -> letters.csv
  generate-sentiments.py       # letters.csv/normalized -> sentiment_scored_letters.csv
  normalize-danish.mjs         # letters.json -> normalized-letters.json
  build-data.mjs               # Assembly -> website JSON
  generate-embeddings.mjs      # Embedding generation

notebooks/                     # Exploration and visualization ONLY
  05b_sentiment_analysis.ipynb # Visualize sentiment results
  06_verb_noun_frequencies.ipynb
  ...

apps/website/public/data/      # Built artifacts (could be .gitignored)
```

### 3.4 Testing Data Quality

**Current:** No automated data quality checks.

**Recommended: Lightweight assertions in scripts.** Not a test framework -- just inline checks:

```python
# In generate-sentiments.py
assert len(df) > 600, f"Expected 600+ letters, got {len(df)}"
assert df['sentiment_score'].notna().sum() > 600, "Too many missing sentiment scores"
assert -100 < df['sentiment_score'].mean() < 100, "Sentiment mean out of expected range"
```

For the normalization script, the existing `--stats` flag already serves as a quality check. Adding a `--validate` flag that asserts minimum change counts would catch regressions.

### 3.5 Configuration Management

**Current:** Paths are hardcoded in each script. Model names are hardcoded.

**Recommended: A single config file is overkill for this project.** The hardcoded paths work because the project structure is stable. If you find yourself changing paths frequently, a `config.mjs` or `config.json` at the project root would help, but this is not urgent.

### 3.6 Artifact Tracking

**Current:** The `generate-embeddings.mjs` script already implements artifact tracking well -- it stores content hashes in `embedding-meta.json` and only regenerates when inputs change.

**Recommended: Apply the same pattern to sentiment.** Store a hash of the input data and model versions in a `sentiment-meta.json`. This enables:
- Skip re-computation when inputs haven't changed
- Track which model versions produced which results
- Reproducibility auditing

---

## 4. Concrete Modernization Plan

### Phase 1: Quick Wins (1-2 hours each)

#### 1A. Run sentiment on normalized text (HIGH IMPACT, LOW EFFORT)

Modify `05a_generate_sentiments.ipynb` (or create `scripts/generate-sentiments.py`) to read from `data/normalized-letters.json` instead of `data/letters.csv`.

Steps:
1. Read `data/normalized-letters.json` (already exists, generated by `npm run data:normalize`)
2. Use `text_normalized` field instead of the archaic `text` field
3. Run AFINN, Sentida, BERT on normalized text
4. Output to `data/sentiment_scored_letters.csv` (same format)
5. Compare old vs. new scores to validate improvement

This is the single highest-impact change. The normalized text already exists. The sentiment code is ~10 cells. The modification is changing one input source.

#### 1B. A/B comparison script (VALIDATION)

Create a small script or notebook that:
1. Runs AFINN on both archaic and normalized text for all letters
2. Reports: word match count difference, score difference distribution, top-20 most-affected letters
3. This validates the hypothesis before committing to the change

#### 1C. Add `data:sentiment` to package.json (QUICK WIN)

Once sentiment is a script:
```json
"data:sentiment": "python scripts/generate-sentiments.py",
"data:all": "npm run data:normalize && npm run data:sentiment && npm run data:build && ..."
```

### Phase 2: Medium-Term (half day each)

#### 2A. Extract cleanup notebook to script

Convert `01_cleanup.ipynb` to `scripts/cleanup.py`. This is straightforward -- the notebook is 8 cells of sequential pandas operations with no interactivity.

Benefits:
- The full pipeline becomes runnable without Jupyter
- `data/letters.csv` regeneration is automated

#### 2B. Extract sentence extraction to script

`03_extract_sentences.ipynb` already delegates to `sentence_extractor.py`. Wrap it in a CLI script.

#### 2C. Extract sentiment to script

Convert the 10-cell `05a_generate_sentiments.ipynb` into `scripts/generate-sentiments.py` with:
- CLI arguments for input source (archaic vs. normalized)
- Progress reporting
- Output validation assertions
- Hash-based skip logic (like `generate-embeddings.mjs`)

#### 2D. Create a Makefile

Define the full dependency graph:
```
letters.json -> cleanup -> letters.csv -> sentences -> sentences.csv
letters.json -> normalize -> normalized-letters.json
normalized-letters.json + sentences.csv -> sentiment -> sentiment_scored_letters.csv
letters.csv + sentiment_scored_letters.csv -> build-data -> website JSON
website JSON -> embeddings -> embeddings.bin + related files
```

The Makefile makes `make all` equivalent to the full pipeline, with automatic skip of unchanged steps.

#### 2E. Python dependency management

Create `requirements.txt` (or `pyproject.toml`) for the Python side:
```
pandas>=2.0
afinn>=0.1
sentida>=0.4
danlp>=0.1
nltk>=3.8
dacy>=2.0
```

This ensures anyone can `pip install -r requirements.txt` and run the pipeline.

### Phase 3: Long-Term (optional, only if needed)

#### 3A. DVC integration

If the project grows or you want to version data artifacts independently of git:
- `dvc init`
- Track `embeddings.bin` and large JSON files with DVC
- Keep `letters.json` in git (source of truth, small)
- Use local DVC storage (no cloud needed)

#### 3B. LLM-based modernization for sentiment (ADR-014 Phase 2)

The rule-based normalization catches ~60% of archaic forms (per ADR-014). LLM modernization would catch more nuanced vocabulary and phrasing that affects sentiment. However, for sentiment specifically, the rule-based approach may be sufficient because:
- Sentiment tools care about individual words, not sentence-level phrasing
- The orthographic rules (aa, kj, gj, th) cover the most common lexicon misses
- LLM modernization is more important for embeddings (semantic similarity) than lexicon lookup

Evaluate whether rule-based normalization is sufficient for sentiment before investing in LLM modernization.

#### 3C. Custom sentiment validation dataset

Create a small gold-standard set: manually annotate 50 letters with expected sentiment (positive/negative/neutral). Use this to benchmark:
- Archaic text + AFINN
- Normalized text + AFINN
- Archaic text + BERT
- Normalized text + BERT

This gives hard numbers on the improvement.

#### 3D. Sentence-level modernization for sentence sentiment

Currently, sentences are extracted from archaic text (`03_extract_sentences`), then scored individually. The sentence extraction could also benefit from modernized text (better tokenization boundaries). Consider:
1. Extract sentences from modernized text
2. Score modernized sentences
3. Aggregate to letter-level scores

---

## 5. Priority Matrix

| Action | Impact | Effort | Priority |
|---|---|---|---|
| 1A. Sentiment on normalized text | HIGH | 1-2 hours | **Do first** |
| 1B. A/B comparison validation | HIGH | 1 hour | **Do first** |
| 1C. Add npm script for sentiment | LOW | 10 min | **Do first** |
| 2C. Extract sentiment to script | MEDIUM | 2-3 hours | **Next** |
| 2E. Python requirements.txt | MEDIUM | 15 min | **Next** |
| 2A. Extract cleanup to script | MEDIUM | 1-2 hours | When convenient |
| 2D. Create Makefile | MEDIUM | 1-2 hours | When convenient |
| 2B. Extract sentences to script | LOW | 1 hour | When convenient |
| 3C. Gold-standard validation set | HIGH (validation) | 4-6 hours | If pursuing research publication |
| 3A. DVC integration | LOW | 2-3 hours | Only if data grows |
| 3B. LLM modernization for sentiment | LOW-MEDIUM | 2 hours + cost | After validating rule-based is insufficient |
| 3D. Sentence-level modernization | LOW | 2-3 hours | After letter-level is validated |

---

## 6. Key Insight: The Normalization Script Is Already the Hard Part

The `normalize-danish.mjs` script represents significant investment: 11 rule categories, case preservation, name/place whitelisting, OCR fixes, and compound word handling. The normalized output (`data/normalized-letters.json`) already exists and is used for embeddings.

Connecting this output to sentiment analysis is a small wiring change with disproportionately large impact. The infrastructure is built; it just needs to be plugged in.

---

## Appendix: Data Flow After Modernization

```
letters.json
  |
  +---> [cleanup.py] ---> letters.csv (archaic, for display/notebooks)
  |
  +---> [normalize-danish.mjs] ---> normalized-letters.json (modern text)
          |
          +---> [generate-sentiments.py] ---> sentiment_scored_letters.csv
          |
          +---> [build-data.mjs] ---> website JSON (search-corpus with text_modern)
          |
          +---> [generate-embeddings.mjs] ---> embeddings.bin + related files
          |
          +---> [generate-clusters.mjs] ---> topic-clusters.json
```

The key change: `generate-sentiments.py` reads from `normalized-letters.json` instead of `letters.csv`. Everything downstream benefits automatically because `build-data.mjs` already reads `sentiment_scored_letters.csv`.
