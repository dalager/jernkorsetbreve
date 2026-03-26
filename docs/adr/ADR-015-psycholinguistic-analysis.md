# ADR-015: Psycholinguistic Analysis Pipeline

## Status
Proposed

## Context

Peter Maersk writes 620+ letters over 7 years (1911–1918), spanning courtship, military training, and front-line combat. This is an extraordinary longitudinal dataset for tracking how war changes language — and by inference, cognition.

The corpus also contains a natural experiment: Peter writes to two distinct audiences — Trine (romantic partner, ~199 letters) and Mor og Far (parents, ~421 letters). The same events may produce different tellings, revealing self-censorship and performative patterns.

Research in psycholinguistics has established that trauma, cognitive load, and identity shifts leave measurable traces in language: vocabulary constriction, syntactic simplification, pronoun shifts, and hedging patterns. These metrics have never been applied to a historical Danish letter corpus.

## Decision

### Build a Computational Psycholinguistic Analysis Pipeline

Create `scripts/analyze-psycholinguistics.py` (Python, using spaCy `da_core_news_lg`) that computes per-letter metrics and outputs `data/letter-psycholinguistics.json`.

### Metrics to Extract

#### A. Lexical Metrics

| Metric | Description | Hypothesis |
|--------|-------------|------------|
| **Type-Token Ratio (TTR)** | Unique words / total words (window-corrected MATTR) | Vocabulary constricts under stress |
| **Hapax Legomena Ratio** | Words appearing once / total words | Creative expression reduces under constraint |
| **Lexical Density** | Content words / total words | Functional language increases under cognitive load |

#### B. Syntactic Metrics (spaCy dependency parsing)

| Metric | Description | Hypothesis |
|--------|-------------|------------|
| **Mean Dependency Distance** | Average distance between dependent and head in dependency tree | Syntactic complexity drops with trauma/exhaustion |
| **Mean Sentence Length** | Words per sentence | Sentences shorten under stress |
| **Subordinate Clause Ratio** | Subordinate clauses / total clauses | Complex argumentation decreases at the front |

#### C. Psychological Markers

| Metric | Description | Hypothesis |
|--------|-------------|------------|
| **First-person singular ratio** | "jeg"/"mig"/"min" per 100 words | High = individual focus |
| **First-person plural ratio** | "vi"/"os"/"vores" per 100 words | High = group identity absorption |
| **Jeg→Vi shift index** | Ratio of singular to plural 1st person | Military identity absorption over time |
| **Hedging frequency** | "vist," "måske," "vel," "nok," "vist nok" per 100 words | Uncertainty/anxiety markers |
| **Reassurance formulae** | "alt vel," "det går godt," "I skal ikke bekymre Jer" | Performed normalcy for home front |

#### D. Code-Switching (Danish↔German)

| Metric | Description | Hypothesis |
|--------|-------------|------------|
| **German loanword density** | German military terms per 100 words | Increases during intense combat as military German colonizes Danish thought |
| **German lexicon** | Curated list: Feldvebel, Hauptmand, Gefr., Regt., Ordenans, Lazarett, Sanitäter, Kompagni, Batteri, Kaserne, etc. | Domain-specific code-switching |

#### E. Information-Theoretic Metrics

| Metric | Description | Hypothesis |
|--------|-------------|------------|
| **Character-level Shannon entropy** | Bits per character | Constrained/formulaic writing = lower entropy |
| **Compression ratio** | gzip(text) / len(text) | Self-censored text compresses better (less randomness) |
| **Word surprisal** | −log₂P(word\|corpus) summed per letter | Information density drops with censorship |

### Composite Indicators

**Trauma Composite** = weighted combination of:
- Low TTR (vocabulary constriction)
- Low mean dependency distance (syntactic simplification)
- High hedging frequency (uncertainty)
- Jeg→Vi shift (identity absorption)
- High German code-switching density

When multiple metrics spike simultaneously, the signal is stronger than any individual metric. Validate against known battle dates from `battles.json`.

**Censorship vs. Exhaustion Discriminator:**
- Low entropy + high hedging = self-censorship ("can't say")
- Low entropy + low hedging = genuine simplification ("can't think")
- Low entropy + high reassurance formulae = performative normalcy ("won't say")

### Audience Divergence Analysis

For each metric, compute separate time series for Trine-letters vs. parent-letters. Then compute:

- **KL divergence** of word distributions between streams per time window
- **Metric divergence** per metric per time window
- **Temporal overlap analysis**: for letters written on the same date to different recipients, compare all metrics directly

Output: `data/letter-audience-divergence.json`

### Tools and Dependencies

| Tool | Purpose |
|------|---------|
| spaCy `da_core_news_lg` | Tokenization, POS tagging, dependency parsing |
| Python `collections`, `math` | Entropy, TTR, frequency analysis |
| Python `gzip` | Compression ratio |
| Curated German military lexicon | Code-switching detection |
| Curated Danish hedging/reassurance lexicons | Psychological markers |

## Consequences

### Positive
- Produces a "cognitive weather map" of Peter's mental state across 7 years
- The audience divergence analysis is unique to this corpus — a natural experiment in wartime self-presentation
- Composite trauma indicator offers a new methodology for computational analysis of historical correspondence
- All metrics are reproducible and domain-transferable to other letter corpora
- Feeds directly into visualizations (ADR-018) and the Cognitive Atlas (ADR-020)

### Negative
- spaCy `da_core_news_lg` is trained on modern Danish — accuracy on archaic text will be imperfect
- POS tagging and dependency parsing errors compound into metric noise
- Small sample sizes per time window may produce noisy estimates
- The trauma composite is a hypothesis, not a validated clinical instrument

### Mitigation
- Run spaCy on modernized text (ADR-014) where available, for better parsing accuracy
- Use rolling windows (5-10 letters) to smooth noise in time series
- Validate trauma composite against known historical events rather than claiming clinical validity
- Report confidence intervals on all metrics

## Validation
- Verify spaCy parses a sample of 20 archaic Danish letters with acceptable accuracy (>80% POS accuracy)
- Trauma composite correlates with at least 3 known major events (deployment, specific battles, armistice)
- Audience divergence is statistically significant (KL divergence > 0 with p < 0.05) for at least some time windows
- All per-letter JSON output is keyed by letter ID and compatible with existing data products
