# ADR-028: Makefile-Based Data Pipeline Orchestration

## Status

Proposed

## Date

2026-03-28

## Context

The data pipeline currently has two disconnected halves:

**Node.js side** (automated via `npm run data:all`):
```
data:normalize → data:build → data:battles → data:reindex → data:clusters → data:borders
```

**Python side** (manual, requires Jupyter):
```
01_cleanup.ipynb → 03_extract_sentences.ipynb → 05a_generate_sentiments.ipynb
```

The Node.js pipeline cannot call the Python steps, and `npm run data:all` has no dependency tracking — it reruns everything sequentially every time. The project already has a `Makefile` but it only contains Docker and development commands.

With ADR-026 extracting the Python notebooks to scripts, the full pipeline becomes automatable. The question is how to orchestrate the combined Node.js + Python dependency graph.

### Full dependency graph

```
data/letters.json
  ├──→ [cleanup.py] ──→ data/letters.csv
  │                       ├──→ [extract-sentences.py] ──→ data/sentences.csv
  │                       ├──→ [build-data.mjs] ──→ apps/website/public/data/*.json
  │                       └──→ (visualization notebooks, manually)
  │
  └──→ [normalize-danish.mjs] ──→ data/normalized-letters.json
                                    ├──→ [generate-sentiments.py] ──→ data/sentiment_scored_letters.csv
                                    │       (also needs sentences.csv)      │
                                    ├──→ [generate-embeddings.mjs] ──→ embedding artifacts
                                    └──→ [build-data.mjs] ──→ (also needs letters.csv + sentiments)
```

## Decision

Extend the existing `Makefile` with a **data pipeline section** that encodes the dependency graph using Make's file-based dependency tracking.

### Makefile structure

The Makefile will have two clearly separated sections:

1. **Docker & Development** (existing, unchanged)
2. **Data Pipeline** (new)

```makefile
# =============================================================================
# Data Pipeline
# =============================================================================

data/letters.csv: data/letters.json scripts/cleanup.py
	python scripts/cleanup.py

data/normalized-letters.json: data/letters.json scripts/normalize-danish.mjs
	node scripts/normalize-danish.mjs

data/sentences.csv: data/letters.csv scripts/extract-sentences.py
	python scripts/extract-sentences.py

data/sentiment_scored_letters.csv: data/normalized-letters.json data/sentences.csv scripts/generate-sentiments.py
	python scripts/generate-sentiments.py

WEBSITE_DATA := apps/website/public/data/letters.json
$(WEBSITE_DATA): data/letters.csv data/sentiment_scored_letters.csv data/normalized-letters.json scripts/build-data.mjs
	node scripts/build-data.mjs

.PHONY: data data-clean
data: $(WEBSITE_DATA)
	node scripts/generate-embeddings.mjs
	node scripts/generate-clusters.mjs
	node scripts/generate-battle-data.mjs
	node scripts/build-historical-borders.mjs

data-clean:
	rm -f data/letters.csv data/sentences.csv data/sentiment_scored_letters.csv data/normalized-letters.json
```

### Transition from `npm run data:all`

The `data:all` script in `package.json` is preserved as a convenience but documented as calling `make data` under the hood once the Python scripts are extracted. During the transition period, both paths work — `npm run data:all` for Node.js-only steps, `make data` for the full pipeline.

## Alternatives Considered

### Keep `npm run data:all` only

Rejected. npm scripts cannot express file-based dependencies (always reruns everything), cannot call Python scripts natively, and cannot skip unchanged steps.

### Separate `data.mk` included by main Makefile

Considered for cleaner separation, but unnecessary at this scale. A single Makefile with clear section headers is simpler and avoids `include` indirection.

### `just` (justfile)

Modern Make alternative with nicer syntax. Rejected because it requires installing a separate tool, while Make is already available on the development machine (via Git Bash / WSL). The Makefile already exists and works.

### DVC pipelines

DVC can express dependency graphs and track data artifacts. Rejected as overkill: the full dataset fits in git, there is no remote storage need, and DVC adds significant conceptual overhead (`dvc.yaml`, `dvc.lock`, `.dvc` files, remote configuration).

### Prefect / Dagster / Airflow

Server-based pipeline orchestrators designed for recurring production workflows. This pipeline runs at build time or manually. Wrong tool entirely for this scale.

## Consequences

### Positive

- `make data` runs the full pipeline (Python + Node.js) with dependency tracking
- Changed input files trigger only the necessary downstream steps
- The dependency graph is explicitly documented in the Makefile
- No new tools to install — Make is universally available
- Docker commands and data pipeline coexist cleanly in one file

### Negative

- Make's syntax is unfamiliar to some developers (tab-sensitivity, phony targets)
- File timestamps are the only dependency signal — if a script changes behavior without changing its output file's mtime, Make won't detect it (mitigated by ADR-029's content hashing for the sentiment step)
- Windows compatibility: Make requires Git Bash, WSL, or a Make port. The existing Makefile already assumes this.

## Related

- ADR-026: Extract Notebooks to Scripts (prerequisite — scripts must exist for Make to call them)
- ADR-029: Artifact Hashing (complements Make's timestamp-based tracking with content-aware skip logic)
- ADR-024: Build Version Footer (existing Makefile usage for build commands)
