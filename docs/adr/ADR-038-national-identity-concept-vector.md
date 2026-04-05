# ADR-038: National Identity Concept Vector

## Status

Accepted (2026-04-04)

## Date

2026-03-29

## Context

Peter Mærsk was a Danish-speaking Sønderjyde conscripted into the German Imperial Army during WW1. His 665 letters span 1911-1918, covering peacetime, mobilization, four years of combat, and armistice. A central question for the historical research is: **does Peter's national identity shift under sustained German military service?**

The existing psycholinguistic pipeline (ADR-015) tracks German military term density as a code-switching metric, but this only counts vocabulary adoption — it does not capture the *sentiment context* in which Peter frames himself as Danish vs. German/military. Similarly, the emotion vectors (ADR-015, extended with anger/gratitude/pride/remorse/relief/desire) measure emotional dimensions but not identity framing.

### Research findings (see `docs/research/national-identity-vector-02.md`)

A prototype identity vector was constructed by:
1. Finding 46 Danish-identity seed sentences and 27 German/military-identity seed sentences from the corpus via keyword matching
2. Computing mean embeddings for each pole from the cached sentence embeddings (13,577 × 768, already at `data/.cache/sentence-embeddings.npy`)
3. Building the concept vector as `mean(Danish) - mean(German)`, normalized

Key results:
- **Cosine similarity with sentiment vector: -0.02** — the identity dimension is completely independent from sentiment. It captures register framing, not mood.
- **Danish-leaning pole** captures: group identification ("os danskere"), homeland geography, Danish language use, cultural context
- **German/military-leaning pole** captures: military hierarchy (Major, Oberstleutnant), awards (Jernkorset), commands, formal military register
- **Explicit tension sentences** were surfaced, including: "det er jo ikke så let for os, at love ham troskab og forsvare det tyske Rige" (letter 59), "Så jeg er snart mere Englænder end - tysk Soldat" (letter 591)

### Methodological difference from emotion vectors

The emotion vectors are trained on an external dataset (GoEmotions, ~58k labeled English sentences) and transferred cross-lingually. The identity vector is **trained on the corpus itself** — there is no external ground truth for "Danish identity" vs. "German military identity" in sentence embeddings.

This is methodologically sound (corpus-specific concept vectors are established in computational linguistics) but requires honest framing: the vector detects *Peter's own patterns* of Danish vs. military-German register, not an externally validated identity scale. The website must label this as "mønstre, ikke beviser" (patterns, not proof).

### Available infrastructure

| Asset | Status |
|-------|--------|
| Sentence embeddings (768-dim, mpnet) | Cached at `data/.cache/sentence-embeddings.npy` |
| CVP scoring pipeline | Operational (`scripts/generate-sentiments-cvp.py`, `scripts/generate-emotions-cvp.py`) |
| Concept vector format | Established (CSV, 768 columns) |
| Per-sentence score format | Established (`cvp-sentence-scores.json`) |
| Sproganalyse page (ADR-037) | Proposed, provides natural home for visualization |

## Decision

### Build a corpus-specific national identity concept vector

Create a curated-seed CVP pipeline that produces per-sentence and per-letter identity scores, where positive = Danish-leaning register and negative = German/military-leaning register.

### Specification

#### S1: Seed sentence curation

Create a curated seed file `data/identity-seeds.json` with the following structure:

```json
{
  "danish_pole": [
    {"letter_id": 71, "text": "Sidste aften i Arys tog alle os danskere afsked med hinanden...", "reason": "explicit group identification"},
    ...
  ],
  "german_pole": [
    {"letter_id": 343, "text": "Majoren ville have, at jeg først skulle have Jernkorset...", "reason": "military hierarchy and awards"},
    ...
  ],
  "excluded": [
    {"letter_id": 59, "text": "det er jo ikke så let for os, at love ham troskab...", "reason": "expresses tension itself, not a clean pole example"}
  ]
}
```

**Curation rules:**
- Target ~50 sentences per pole (minimum 30)
- Exclude sentences that express the identity *tension* — these are analysis targets, not training data
- Exclude formulaic openings/closings
- Each seed must have a `reason` field explaining why it belongs to that pole
- Balance across time periods (don't over-sample early or late letters)

#### S2: Vector generation script

`scripts/generate-identity-vector.py` — follows the pattern of `generate-emotion-vectors.py` but uses corpus seeds instead of GoEmotions:

1. Load `data/identity-seeds.json`
2. Load cached embeddings from `data/.cache/sentence-embeddings.npy`
3. Match seed sentences to their embedding indices via text matching against `data/cvp-sentence-scores.json`
4. Compute `identity_cv = mean(danish_embeddings) - mean(german_embeddings)`, normalize
5. Validate: compute cosine similarity with sentiment vector (must be < 0.15) and emotion vectors
6. Save to `data/cvp-identity-vector.csv` (same 768-column CSV format)

#### S3: Scoring integration

Extend `scripts/generate-emotions-cvp.py` (or create a parallel `scripts/generate-identity-cvp.py`) to:

1. Load `data/cvp-identity-vector.csv`
2. Score all 13,577 sentences against the identity vector
3. Aggregate per-letter: mean, p10, p90
4. Output to `data/cvp-identity-scores.json`

#### S4: Validation

Built-in validation checks:
- Cosine similarity with sentiment vector < 0.15 (independence)
- Cosine similarity with each emotion vector < 0.30
- Danish-pole seed sentences score positive (mean > 0)
- German-pole seed sentences score negative (mean < 0)
- "Tension" sentences from the excluded set should score near zero (|score| < 0.3)
- Print temporal distribution of high/low scores as sanity check

### Pseudocode

```
# generate-identity-vector.py

load identity-seeds.json → danish_seeds, german_seeds
load sentence-embeddings.npy → embeddings[13577, 768]
load cvp-sentence-scores.json → sentences (for text matching)

# Match seeds to embedding indices
for each seed in danish_seeds + german_seeds:
    find index where sentences[i].text matches seed.text
    assert match found

dk_emb = mean(embeddings[danish_indices])
de_emb = mean(embeddings[german_indices])
identity_cv = normalize(dk_emb - de_emb)

# Validate independence
for each existing_cv in [sentiment, fear, grief, hope, love, ...]:
    sim = cosine(identity_cv, existing_cv)
    assert sim < threshold

save identity_cv → data/cvp-identity-vector.csv

# Score all sentences
scores = embeddings @ identity_cv
per_letter = group_by_letter(scores) → {mean, p10, p90}
save → data/cvp-identity-scores.json
```

### Architecture

```
scripts/
  generate-identity-vector.py    — Seed-based CVP vector generation
data/
  identity-seeds.json            — Curated seed sentences (version-controlled)
  cvp-identity-vector.csv        — 768-dim concept vector (generated)
  cvp-identity-scores.json       — Per-letter identity scores (generated)
```

The script is standalone (not integrated into `generate-emotions-cvp.py`) because:
1. Different methodology (corpus seeds vs. external dataset) deserves separation
2. The seed file is an explicit research artifact that should be version-controlled and peer-reviewable
3. The validation checks are specific to the identity vector

#### Integration with build pipeline

Add to `package.json` scripts:
```
"data:identity": "python scripts/generate-identity-vector.py"
```

Add to `scripts/build-data.mjs` as an optional step after emotion scoring.

#### Integration with Sproganalyse page (ADR-037)

The identity scores can be visualized in **Tab 2 ("Krigens sprog")** as an additional timeline chart: "National identitet over tid" showing the per-letter mean identity score across 1911-1918 with the August 1914 marker. This sits naturally alongside the other war-impact metrics.

Alternatively, if the identity analysis proves rich enough, it could become a **5th tab** ("Identitet") on the Sproganalyse page.

### Refinement considerations

#### Seed quality matters more than quantity

The vector quality depends entirely on seed curation. A poorly curated seed set (e.g., including "kære" as Danish-identity) would produce a vector that captures formality rather than identity. The `reason` field in each seed entry forces deliberate justification.

#### Temporal bias risk

If most Danish-identity seeds come from early letters and most German-military seeds come from wartime, the vector might capture time period rather than identity. Mitigation: balance seed selection across the full 1911-1918 span, and validate by checking that the vector does not simply correlate with letter date.

#### The vector captures register, not belief

The identity vector measures which *linguistic register* Peter uses in a sentence — Danish social framing vs. German military framing. It cannot distinguish between genuine identity adoption and pragmatic code-switching. This distinction must be made explicit in any public-facing presentation.

### Completion checklist

1. [ ] Curate `data/identity-seeds.json` (~50 sentences per pole)
2. [ ] Implement `scripts/generate-identity-vector.py`
3. [ ] Run vector generation, verify independence checks pass
4. [ ] Generate `data/cvp-identity-scores.json`
5. [ ] Add `data:identity` npm script
6. [ ] Add identity timeline to Sproganalyse page (ADR-037 Tab 2 or new Tab 5)
7. [ ] Write method note text in Danish for the website
8. [ ] Peer review seed curation with domain expert

## Alternatives Considered

### Expand GoEmotions with synthetic identity labels

Rejected. GoEmotions labels emotions, not national identity. Adding synthetic "Danish" and "German" labels to English Reddit comments would be meaningless — there is no cross-lingual transfer path for culture-specific identity framing.

### Keyword density only (no embedding approach)

Already partially implemented as German military term density in ADR-015. But keyword counting misses contextual framing — a sentence mentioning "danskere" in a sad context ("da alle danskere var borte") and a proud context ("de ser op til os danskere") would score identically. The CVP approach captures this distinction.

### Use the identity vector as a binary classifier

Rejected. The continuous score is more informative than a binary Danish/German label. Letters often contain both registers (Danish framing in personal sections, German framing in military descriptions). The per-sentence scores preserve this granularity.

### Train on external Danish vs. German text corpora

Rejected. External corpora (e.g., Danish newspapers vs. German military orders) would capture generic language differences, not Peter's specific identity framing. The corpus-specific approach is more authentic and more defensible for this research context.

## Consequences

### Positive

- Opens a genuinely novel analytical dimension on the corpus — no comparable analysis exists for WW1 Sønderjysk letters
- Reuses existing infrastructure (cached embeddings, CVP pipeline, Sproganalyse page)
- The seed curation file is a transparent, reviewable research artifact
- Independence from sentiment (cosine sim -0.02) means this is not redundant with existing analysis

### Negative

- Corpus-specific vector is not transferable to other letter collections
- Seed curation requires domain expertise and is inherently subjective
- Risk of over-interpretation by website visitors ("Peter became German!") — requires careful framing
- Adds one more data file to the build pipeline

### Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| Seed curation bias | Medium | High | Require `reason` field; peer review; temporal balance check |
| Temporal confound (vector = time, not identity) | Medium | High | Validate: regress score on date; if R² > 0.5, investigate |
| Over-interpretation by visitors | Medium | Medium | Frame as "sproglig register" not "national loyalitet"; method note |
| Too few German-pole seeds (<30) | Low | Medium | Semantic search found 27 keyword + additional via embedding neighbors |

## Replanning Triggers

1. **Cosine similarity with sentiment > 0.15** → Seed curation is contaminated; re-curate
2. **Score correlates strongly with letter date (R² > 0.5)** → Vector captures time, not identity; add temporal balancing to seeds
3. **Fewer than 25 sentences per pole after curation** → Insufficient data; fall back to keyword-density proxy (Option C from research notes)
4. **Domain expert review rejects seed categorizations** → Re-curate with expert input before proceeding

## Related

- ADR-015: Psycholinguistic Analysis Pipeline (code-switching metric, embedding infrastructure)
- ADR-030: CVP Sentiment Implementation (concept vector methodology)
- ADR-037: Psycholinguistic Explorer Section (visualization home)
- `docs/research/national-identity-vector-02.md` (research notes with full results)
