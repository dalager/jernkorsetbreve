# ADR-013: Search Quality Evaluation Framework

## Status
Accepted (implemented 2026-03-27)

## Context

There is no way to measure search quality. Without measurement, model switches (ADR-012), text modernization (ADR-014), and any future search improvements cannot be objectively evaluated. Changes are currently assessed by "feels better" — which is unreliable for a 665-document corpus where even random ordering occasionally surfaces relevant results.

### Domain-Specific Quality Dimensions

For a historical Danish letter corpus, search quality has dimensions that generic benchmarks (MTEB/MMTEB) do not capture:

| Dimension | Example |
|-----------|---------|
| **Topical relevance** | "krigen i Frankrig" → letters from the Western Front |
| **Temporal precision** | "julen 1917" → December 1917 letters |
| **Person relevance** | "Trine" → letters to/from Trine |
| **Emotional/thematic** | "ensomhed" → letters expressing isolation |
| **Cross-lingual** | Modern Danish query → archaic Danish text |

No public benchmark covers these dimensions for this language and era.

## Decision

### 1. Golden Evaluation Dataset

Create `tests/search-eval/golden-queries.json` with ~80 manually curated query-to-relevant-letter-ID pairs across three tiers:

**Tier 1: Factual queries (30 cases)** — objectively verifiable from metadata:
```json
{
  "query": "breve fra december 1917",
  "relevant": [423, 425, 427, 430],
  "tier": "factual"
}
```

**Tier 2: Topical queries (30 cases)** — require reading letters to judge:
```json
{
  "query": "mad og forplejning",
  "relevant": [12, 45, 89, 156, 234],
  "tier": "topical"
}
```

**Tier 3: Semantic/conceptual queries (20 cases)** — test deeper understanding:
```json
{
  "query": "frygt for fremtiden",
  "relevant": [301, 345, 402],
  "tier": "semantic"
}
```

Each entry supports graded relevance (0 = not relevant, 1 = somewhat relevant, 2 = highly relevant) for nDCG computation.

### 2. Metrics

| Metric | What It Measures |
|--------|-----------------|
| **Precision@5** | Are top 5 results useful? |
| **Precision@10** | Broader result quality |
| **Recall@10** | Do we find all relevant letters in the top 10? |
| **MRR** | How quickly does the first good result appear? |
| **nDCG@10** | Ranking quality with graded relevance |

Report metrics both per-tier and aggregated.

### 3. Evaluation Script

Create `scripts/evaluate-search.mjs` that:
1. Loads the golden dataset
2. Loads pre-computed embeddings for a given model variant
3. Embeds each query using the same model
4. Ranks documents by cosine similarity
5. Computes all metrics
6. Outputs a comparison table and per-query breakdown

Usage:
```bash
# Evaluate current model
node scripts/evaluate-search.mjs --embeddings data/embeddings-gte-small.bin --model Xenova/gte-small

# Compare two models
node scripts/evaluate-search.mjs --compare \
  --a data/embeddings-gte-small.bin --model-a Xenova/gte-small \
  --b data/embeddings-e5-small.bin --model-b Xenova/multilingual-e5-small
```

### 4. UX Metrics (Separate from Retrieval Quality)

Track alongside retrieval metrics but measured differently:

| Metric | Method |
|--------|--------|
| Model load time (first visit) | Performance API in search-engine.ts |
| Model load time (cached) | Performance API in search-engine.ts |
| Query latency (p50, p95) | Measured per-search in search-engine.ts |
| Total download size | Lighthouse audit |

### 5. Process

- Run the evaluation script before and after every search-related change
- Store results in `tests/search-eval/results/` as timestamped JSON files
- The baseline (current gte-small) must be measured first — all future models compare against it

## Consequences

### Positive
- Every search change becomes measurable
- The golden dataset encodes domain expertise about what "good search" means for this corpus
- Comparison framework makes model selection data-driven rather than subjective
- Per-tier breakdown reveals whether a model is good at factual but weak at semantic queries (or vice versa)

### Negative
- Creating the golden dataset requires manually reading letters and judging relevance (~4-8 hours of work)
- The dataset is subjective — different annotators might disagree on relevance for Tier 3 queries
- 80 queries may be too few for statistical significance on small differences

### Mitigation
- Start with 80 queries; expand to 120+ if differences between models are small
- For Tier 3 queries, use graded relevance (0/1/2) rather than binary to reduce annotation disagreement
- Document the annotation criteria so the dataset can be reviewed and expanded by others

## Validation
- Golden dataset covers all five quality dimensions (topical, temporal, person, emotional, cross-lingual)
- Evaluation script produces reproducible results (same embeddings + same queries = same scores)
- Baseline scores for gte-small are recorded before any model changes
