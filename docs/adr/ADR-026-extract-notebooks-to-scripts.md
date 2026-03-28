# ADR-026: Extract Data-Producing Notebooks to Standalone Scripts

## Status

Proposed

## Date

2026-03-28

## Context

The data pipeline spans two runtimes:

| Step | Format | Produces | Consumed By |
|------|--------|----------|-------------|
| `01_cleanup.ipynb` | Notebook | `data/letters.csv` | Everything downstream |
| `03_extract_sentences.ipynb` | Notebook | `data/sentences.csv` | Sentiment analysis |
| `05a_generate_sentiments.ipynb` | Notebook | `data/sentiment_scored_letters.csv` | `build-data.mjs` |
| `normalize-danish.mjs` | Script | `data/normalized-letters.json` | Embeddings, search, sentiment (ADR-025) |
| `build-data.mjs` | Script | Website JSON files | Static site |
| `generate-embeddings.mjs` | Script | Embeddings artifacts | Static site |
| `generate-clusters.mjs` | Script | `topic-clusters.json` | Static site |

The Node.js scripts are already well-structured: CLI-invokable, deterministic, composable via `npm run data:all`. The three Python notebooks that produce downstream artifacts are not automatable — they require Jupyter to execute, have implicit state dependencies between cells, and use path hacks (`sys.path.insert(0, '../scripts')`).

The remaining notebooks (`05b_sentiment_analysis`, `06`–`15`) are exploratory: they read data, produce visualizations, and have no downstream consumers. These benefit from the notebook format.

### The Principle

**Notebooks that produce pipeline artifacts should be scripts. Notebooks that produce insight should stay notebooks.**

## Decision

Extract these three notebooks into CLI-invokable Python scripts:

| Notebook | Script | Notes |
|----------|--------|-------|
| `01_cleanup.ipynb` | `scripts/cleanup.py` | 8 cells of sequential pandas operations. Replace `sys.path.insert` hack with direct import or inline `strip_tags`. |
| `03_extract_sentences.ipynb` | `scripts/extract-sentences.py` | Already delegates to `scripts/sentence_extractor.py`. Extraction is mechanical. |
| `05a_generate_sentiments.ipynb` | `scripts/generate-sentiments.py` | ~10 cells. Modify input source per ADR-025. Add progress reporting for the BERT inference step. |

### Script conventions

Each extracted script follows the pattern established by the Node.js scripts:

1. **Standalone execution**: `python scripts/cleanup.py` with no arguments needed (sensible defaults)
2. **Optional CLI flags**: `--dry-run`, `--stats`, `--input normalized` where applicable
3. **Explicit file paths**: Resolved relative to the script's own `__file__`, not the working directory
4. **Progress output**: Print what was read, what was produced, and summary statistics
5. **Inline assertions**: Basic data quality checks (row counts, non-null checks) — not a test framework
6. **Exit code**: 0 on success, non-zero on failure

### Handling of old notebooks

The original notebooks are **kept but marked as superseded**. Add a markdown cell at the top of each:

```markdown
> **Note:** The data processing in this notebook has been extracted to
> `scripts/<name>.py`. This notebook is retained for reference and
> exploration but is no longer part of the data pipeline.
```

This avoids confusion without losing history.

## Alternatives Considered

### Extract all notebooks to scripts

Rejected. Visualization notebooks (`05b_sentiment_analysis`, `06_verb_noun_frequencies`, `11_placemaps`, etc.) benefit from inline output. Forcing them into scripts would require separate plotting infrastructure for no gain.

### Keep all notebooks, use `jupyter nbconvert --execute`

Rejected. Notebook execution is fragile (kernel state, implicit cell ordering), slow (Jupyter startup overhead), and hides dependency errors. Scripts are explicit about their inputs and outputs.

### Use Papermill for parameterized notebook execution

Rejected. Adds a tool dependency and complexity disproportionate to a personal project with three notebooks to extract.

### Do nothing

Rejected. The Python notebooks block pipeline automation (ADR-028) and create a gap in reproducibility — `npm run data:all` currently skips the Python steps entirely.

## Consequences

### Positive

- Full pipeline becomes runnable without Jupyter
- Python steps can be integrated into `npm run data:all` or a Makefile (ADR-028)
- Dependencies become explicit (no hidden `sys.path` hacks or inline `nltk.download()`)
- Scripts are testable with standard tools
- Reduces the gap between the well-structured Node.js scripts and the Python pipeline

### Negative

- Three new files to maintain alongside the (retained) notebooks
- Interactive development/debugging is slightly harder in a script vs. notebook
- The `danlp` BERT model has a hidden download step (`load_bert_emotion_model()` downloads on first use) — the script must handle first-run gracefully or document the setup requirement

### Migration risk

Low. The notebooks are small (8–10 cells each), sequential, and have no branching logic. The sentence extraction notebook already delegates to a script module. The cleanup notebook is pure pandas. The sentiment notebook is a linear sequence of library calls.

## Related

- ADR-025: Sentiment Analysis on Normalized Text (the sentiment script is the highest-priority extraction)
- ADR-027: Python Dependency Management (extracted scripts need explicit dependencies)
- ADR-028: Makefile-Based Pipeline Orchestration (scripts enable automation)
