# National Identity Concept Vector Projection

## Motivation

Peter Mærsk was a Danish-speaking Sønderjyde — a member of the Danish minority in the border region of Schleswig — conscripted into the German Imperial Army in August 1914. His 665 letters home (1911–1918) present a natural question that keyword counting cannot answer: **does Peter's linguistic identity shift under sustained German military service, and if so, how?**

The existing psycholinguistic pipeline (ADR-015) already tracks German military term density as a code-switching metric — how many German loan words Peter uses per letter. But vocabulary adoption is not identity. A soldier can adopt German military vocabulary while maintaining a fundamentally Danish frame of reference, or he can shift his entire linguistic register toward the military institution without borrowing individual German words.

We needed a method that captures the *contextual framing* of Peter's sentences — not which words appear, but what kind of world the sentence describes.

## Goal

Build a continuous score for each sentence and letter that measures where Peter's language sits on a spectrum from **Danish social register** (homeland, Danish companions, Danish culture) to **German military register** (hierarchy, commands, awards, institutional framing). Track this score over time to see whether the war years produce a measurable shift.

The score must be:
- **Independent from sentiment** — a sad letter about fallen Danish comrades and a happy letter about German awards should both register their respective identities, regardless of mood
- **Continuous, not binary** — most letters contain both registers; the score should reflect the balance
- **Transparent** — the training data (seed sentences) should be a reviewable, version-controlled research artifact

## Method

### Concept Vector Projection (CVP)

We use the same mathematical framework as the emotion analysis (ADR-015/ADR-030), with one critical difference: the training data comes from the corpus itself rather than an external labeled dataset.

**Step 1: Embed all sentences.** All 13,577 sentences across 665 letters are embedded into 768-dimensional vectors using `paraphrase-multilingual-mpnet-base-v2`, a multilingual sentence transformer. These embeddings are cached at `data/.cache/sentence-embeddings.npy` (40 MB) and reused across all CVP analyses.

**Step 2: Curate seed sentences.** A human curator (with domain knowledge of the corpus) selects sentences into two poles:

- **Danish pole** (45 sentences): Sentences where Peter frames himself within a Danish identity context. Examples:
  - *"Vi er 6 danskere her ved de 4 komp."* (letter 33) — counting fellow Danes as distinct group
  - *"Men det var jo dog mere hjemlig, om der havde været en dansk iblandt."* (letter 33) — Danish presence as source of comfort
  - *"Af mine danske kammerater er alle levende."* (letter 90) — relief framed through Danish group membership

- **German/military pole** (37 sentences): Sentences where Peter adopts the German military register. Examples:
  - *"Kommandant Generalen udtalte en tak til os"* (letter 50) — formal military commendation
  - *"Jeg meldte straks meldingen videre til Majoren"* (letter 89) — executing military reporting chain
  - *"Hvor feldwebel fik en Anerkendelse Medalje"* (letter 45) — military awards ceremony

- **Excluded / tension** (18 sentences): Sentences that express the identity conflict itself. These are analysis targets, not training data:
  - *"Ja, nu har vi lovet den tyske Kejser troskab."* (letter 59) — oath of loyalty to a foreign emperor
  - *"det er jo ikke så let for os, at love ham troskab og forsvare det tyske Rige, når vi er et andet Folk"* (letter 59) — explicit statement of belonging to another people
  - *"Han ved jo også nok, at jeg eller vi danskere må gå med som Maskiner"* (letter 81) — Danish identity vs. forced service

Each seed has a `reason` field explaining why it belongs to its pole. The full seed file (`data/identity-seeds.json`) is version-controlled as a reviewable research artifact.

**Step 3: Compute the concept vector.** Average the embeddings of each pole and subtract:

```
identity_cv = mean(danish_embeddings) - mean(german_embeddings)
identity_cv = identity_cv / ||identity_cv||
```

This produces a single 768-dimensional unit vector. Projecting any sentence's embedding onto this vector yields a scalar score: positive values indicate Danish register, negative values indicate German military register.

**Step 4: Validate independence.** The identity vector's cosine similarity with the existing sentiment vector is **-0.02** — essentially zero. This confirms it captures a genuinely independent dimension. If the similarity were high (>0.15), the vector would be measuring mood rather than identity, and the seed curation would need revision.

**Step 5: Score all sentences.** Compute `score = embedding · identity_cv` for all 13,577 sentences. Aggregate per letter as mean, 10th percentile, and 90th percentile.

### Difference from emotion vectors

The emotion vectors (fear, grief, hope, love, anger, gratitude, pride, remorse, relief, desire) are trained on the [GoEmotions dataset](https://huggingface.co/datasets/google-research-datasets/go_emotions) — 58,000 labeled English Reddit comments — and transferred cross-lingually via the multilingual embedding model. This works because emotions are relatively universal in how they're expressed linguistically.

The identity vector cannot use this approach: there is no external dataset labeled for "Danish identity" vs. "German military identity." Instead, it uses **corpus-specific seeds** — real sentences from Peter's letters, curated by a human with domain knowledge. This makes the vector:

- More authentic (captures Peter's actual register patterns)
- Less generalizable (only valid for this corpus)
- More transparent (every training example is a documented quote with a justification)

## Results

### Yearly mean identity scores

| Year | Mean score | Letters | Interpretation |
|------|-----------|---------|----------------|
| 1911 | +0.132 | 9 | Pre-war, civilian Danish context |
| 1912 | +0.153 | 14 | Pre-war, civilian Danish context |
| 1913 | +0.210 | 13 | Peak Danish register (pre-mobilization) |
| 1914 | +0.118 | 85 | Drop at mobilization — military register enters |
| 1915 | +0.115 | 127 | Lowest point — deep in military service |
| 1916 | +0.118 | 125 | Stable plateau |
| 1917 | +0.140 | 179 | Gradual recovery toward Danish register |
| 1918 | +0.141 | 113 | Maintained recovery |

### Key observations

1. **All yearly means are positive.** Peter never shifts into a predominantly German register on average. His letters home are fundamentally Danish documents, even when written from the trenches.

2. **The pre-war peak in 1913 (+0.210) drops to +0.118 in 1914.** This ~44% reduction coincides with mobilization and the first year of military service. The drop represents the entry of military institutional language into Peter's writing, not a loss of Danish identity.

3. **A gradual recovery begins in 1917.** By the war's final two years, Peter's register has partially recovered (+0.140). This could reflect habituation (military vocabulary becoming routine and unmarked), war-weariness reducing institutional language, or stronger longing for home finding expression.

4. **The p10–p90 range within letters is wide.** Most letters contain both registers — Danish framing in personal passages, German framing when describing military events. The per-letter mean masks this internal diversity.

5. **Independence from sentiment is confirmed.** The cosine similarity of -0.02 means the identity signal is not an artifact of mood. A letter can be emotionally negative (describing casualties) while being strongly Danish in register (framing the dead as "mine danske kammerater").

### What the vector captures vs. what it doesn't

The vector captures **linguistic register** — the words, syntax, and contextual framing Peter uses. It does not and cannot capture:

- **Private belief** — Peter may think in Danish while writing in military register, or vice versa
- **Strategic adaptation** — Writing to his Danish wife and parents, Peter has every reason to emphasize Danish framing regardless of his internal state
- **Censorship effects** — German military censors read the letters; overt anti-German sentiment would be suppressed

These limitations are inherent to any text-based analysis. The honest framing is: the vector measures *how Peter writes*, not *what Peter believes*.

## Implementation

### Pipeline

```
data/identity-seeds.json          ← human-curated, version-controlled
data/.cache/sentence-embeddings.npy  ← cached from sentiment pipeline
         ↓
scripts/generate-identity-vector.py
         ↓
data/cvp-identity-vector.csv      ← 768-dim concept vector
data/cvp-identity-scores.json     ← per-letter mean, p10, p90
         ↓
apps/website/src/components/IdentityTimeline.tsx  ← visualization
```

### Built-in validation

The script (`generate-identity-vector.py`) performs automatic checks:
- Cosine similarity with sentiment vector must be < 0.15
- Cosine similarity with each emotion vector must be < 0.30
- All Danish-pole seeds must score positive on average
- All German-pole seeds must score negative on average
- Temporal confound check: if R² between score and date > 0.5, a warning is printed

### Website integration

The identity timeline appears in the "Krigens sprog" tab of the Sproganalyse page (`/sproganalyse/`). It shows:
- A line chart of per-letter mean identity score over 1911–1918
- A confidence band (p10–p90) showing within-letter register diversity
- Color-coded line segments: warm brown for Danish register, muted green for German military register
- A zero line and war onset marker for reference

The section only renders when the data file exists, so the site degrades gracefully if the identity pipeline hasn't been run.

## Ideas for Improvement

### 1. Expand and rebalance the seed set

The current 45/37 split is adequate but thin. The German pole in particular could benefit from more seeds — the semantic search found ~27 keyword matches, and embedding-neighbor expansion could double that. A target of 60–80 seeds per pole would improve vector stability.

The temporal distribution is also imbalanced: Danish seeds cluster in 1914 (mobilization triggers explicit "vi danskere" language), while German seeds concentrate in 1915–1917. Adding late-war Danish seeds and early-war German seeds would reduce the risk that the vector partially captures "early vs. late war" rather than identity register.

### 2. Split-half cross-validation

Randomly split seeds into two halves, compute two independent vectors, and check their cosine similarity. A stable vector should produce halves with cosine similarity > 0.70. This would quantify how much the vector depends on individual seed choices. The German pole (37 seeds → halves of ~18) is the weak point.

### 3. Residualize the temporal confound

If the R² between identity score and letter date exceeds a threshold, the linear time trend could be regressed out: `adjusted_score = score - (β₀ + β₁ × date)`. This would isolate the identity signal from any time-correlated confound. The current R² should be computed and reported.

### 4. Recipient-stratified analysis

Peter writes to Trine (wife) and to his parents. The existing audience divergence analysis (ADR-015) shows systematic adaptation between recipients. Running the identity scores separately for Trine-letters vs. parent-letters could reveal whether Peter frames his identity differently for different audiences. Does he emphasize Danish identity more when writing to his wife? Does he adopt more military register when writing to his parents (who might understand it less)?

### 5. Sentence-level identity mapping within letters

The current visualization shows per-letter means. A richer view would show sentence-by-sentence identity scores within a single letter — similar to the sentiment sparklines in ADR-036. This would reveal how Peter code-switches within a single letter: "Danish opening → military middle → Danish closing" patterns might emerge.

### 6. Interaction with emotion vectors

Cross-tabulating identity register with emotion scores could reveal patterns like:
- Are high-fear sentences more likely to be in military register?
- Are high-love sentences more likely to be in Danish register?
- Does grief cluster differently by register (mourning Danish comrades vs. military casualties)?

The independence from sentiment (cosine sim -0.02) doesn't preclude correlations with specific emotions — it only means the identity dimension is orthogonal to the general positive/negative axis.

### 7. Comparison with code-switching metric

The psycholinguistic pipeline already computes German military term density (code-switching). Correlating this with the identity vector score would test whether vocabulary adoption and register framing move together or independently. If they diverge — Peter uses more German words but maintains Danish framing — that would be a meaningful finding about the nature of wartime linguistic adaptation.

### 8. External validation with other Sønderjysk corpora

While the vector is corpus-specific, the *method* could be applied to other letter collections from Sønderjysk soldiers in WW1. If similar vectors trained on different correspondences produce comparable temporal patterns, that would strengthen the finding from anecdote to pattern. The Historisk Samfund for Sønderjylland archive contains additional published letter collections that could serve as validation corpora.
