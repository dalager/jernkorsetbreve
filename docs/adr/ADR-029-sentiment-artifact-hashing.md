# ADR-029: Artifact Hashing for Sentiment Pipeline Skip Logic

## Status

Accepted (implemented 2026-03-28 in generate-sentiments-cvp.py)

## Date

2026-03-28

## Context

The `generate-embeddings.mjs` script already implements content-hash-based skip logic: it stores input content hashes and model identifiers in `embedding-meta.json` and skips re-computation when nothing has changed. This is effective because embedding generation is the most expensive step in the pipeline (~minutes for 665 letters with ONNX inference).

Sentiment generation has a similar cost profile — the DaNLP BERT emotion model performs transformer inference on all 665 letters, taking several minutes. AFINN and Sentida are fast (lexicon lookups), but BERT dominates the runtime.

Without skip logic, every `make data` invocation would re-run sentiment on all letters even when neither the input data nor the models have changed. The Makefile (ADR-028) handles file-timestamp dependencies, but cannot detect:

- Model version upgrades (e.g., upgrading `danlp` installs a new BERT checkpoint)
- Input content changes within the same file (e.g., normalization rules improved but `normalized-letters.json` was regenerated with the same mtime)
- Script logic changes that affect output

## Decision

Implement a `data/sentiment-meta.json` file that stores:

```json
{
  "generated": "2026-03-28T14:30:00Z",
  "input_hash": "sha256 of normalized-letters.json content",
  "model_versions": {
    "afinn": "0.1",
    "sentida": "0.4.2",
    "danlp_bert_emotion": "0.1.0"
  },
  "script_hash": "sha256 of generate-sentiments.py content",
  "letter_count": 665,
  "output_file": "data/sentiment_scored_letters.csv"
}
```

The sentiment script checks this file at startup:

1. Compute current input hash and collect model versions
2. Compare against `sentiment-meta.json`
3. If all match → skip with message "Sentiment scores up to date, skipping"
4. If any differ → re-run and update `sentiment-meta.json`
5. A `--force` flag bypasses the check

### Precedent

This follows the exact pattern from `generate-embeddings.mjs` (`embedding-meta.json`), adapted for Python. The schema is intentionally similar for consistency.

## Alternatives Considered

### Rely on Makefile timestamps only

Insufficient. Make tracks file modification times but cannot detect model version changes or content-preserving file rewrites. The sentiment step is expensive enough to warrant content-level tracking.

### No skip logic (always rerun)

Rejected. BERT inference on 665 letters takes minutes. During iterative development of other pipeline steps, re-running sentiment every time wastes significant time.

### Hash only input data, ignore model versions

Simpler but risks stale results when upgrading `danlp`, `afinn`, or `sentida`. Recording model versions catches this automatically.

### Use DVC for artifact tracking

DVC's `dvc.lock` provides similar hashing semantics. Rejected for the same reason as in ADR-028: DVC adds disproportionate complexity for a personal project. A single JSON metadata file achieves the same result with zero dependencies.

## Consequences

### Positive

- Sentiment generation skips cleanly when nothing has changed (~0.5s check vs. minutes of inference)
- Model version upgrades automatically trigger re-computation
- The metadata file documents exactly what produced the current scores (reproducibility audit trail)
- Consistent pattern with the existing `embedding-meta.json`

### Negative

- One more file to track in git (`data/sentiment-meta.json`)
- Slight added complexity in the sentiment script (~20 lines of hashing logic)
- Hash computation adds ~0.5s to every run (reading and hashing `normalized-letters.json`)

## Related

- ADR-025: Sentiment on Normalized Text (determines the input source to hash)
- ADR-026: Extract Notebooks to Scripts (the script must exist to add this logic to)
- ADR-028: Makefile Pipeline (complements Make's timestamp tracking)
