# ADR-017: Semantic Trajectory and Temporal Analysis

## Status
Proposed

## Context

The letters span 1911–1918 — from peacetime courtship through total war. This temporal dimension is the corpus's greatest analytical asset. "Semantic trajectories" trace how meaning, topics, and concerns evolve through a sequence of time-ordered documents.

The project already has temporal data (letter dates), sentiment scores (`letter-sentiments.json`), topic clusters (`topic-clusters.json`), and embeddings (`embeddings.bin`). What is missing is the analytical layer that connects these into trajectory analyses and the visualizations that make trajectories legible.

### Relevant Fields
- **Computational Narratology**: Extracting narrative structure from text sequences
- **Digital Humanities**: Temporal text analysis methods (Jockers' "Syuzhet" package for narrative arc extraction)
- **Corpus Linguistics**: Diachronic language change analysis

## Decision

### 1. Topic Evolution (Stream Graph)

Using existing k-means clusters (k=8) and letter dates, compute topic proportions per time window:

1. Group letters by quarter (Q1 1911, Q2 1911, ..., Q4 1918)
2. For each quarter, count letters per cluster
3. Normalize to proportions
4. Smooth with a rolling average across adjacent quarters

Output: `data/topic-evolution.json`

Visualize as a **stacked stream graph** (D3.js `d3.stack()` with `d3.curveBasis`):
- X-axis: time
- Y-axis: topic proportion
- Each band = one topic cluster, labeled with representative terms
- Annotate with key events: mobilization (Aug 1914), deployment to Eastern Front, transfer to Western Front, armistice

### 2. Sentiment Trajectory

The existing `letter-sentiments.json` contains per-letter sentiment scores. Extend:

1. Plot raw sentiment scores chronologically as a scatter plot
2. Apply LOESS smoothing to extract the emotional arc
3. Compute a rolling standard deviation — "emotional volatility"
4. Annotate with historical events and personal milestones

Output: `data/sentiment-trajectory.json` (smoothed values, volatility)

### 3. Embedding Drift (Semantic Velocity)

Track how the centroid of letter embeddings moves through the 384-dimensional space over time:

1. Group letters by month (or quarter for sparse months)
2. Compute the centroid (mean embedding) of each group
3. Compute cosine distance between consecutive centroids
4. This "semantic velocity" measures how fast the content is changing

Output: `data/semantic-drift.json`

**Interpretation:**
- High drift = major life change (deployment, transfer, injury)
- Low drift = stable routine (training camp, quiet sector)
- Sudden spikes correlate with historical events

### 4. Vocabulary Trajectory

Track word category frequencies over time:

| Category | Example Words | What It Reveals |
|----------|--------------|-----------------|
| Military | soldat, gevær, skyttegrav, march, vagt | Militarization of daily life |
| Domestic | hjem, hus, have, mad, tøj | Connection to home |
| Emotional | glad, trist, længsel, håb, frygt | Emotional register |
| Nature | vejr, regn, sne, sol, træ | Environmental awareness |
| Religious | Gud, bede, kirke, salme, tro | Spiritual life |
| Health | syg, forkølet, såret, hospital, doktor | Physical condition |

Compute density (words per category per 1000 words) per letter, then smooth over time.

Output: `data/vocabulary-trajectory.json`

### 5. Temporal Phenomenology

From ADR-015's temporal metrics (verb tense distribution, waiting vocabulary, temporal horizon), compute:

- **Temporal orientation index**: past-looking vs. future-looking per letter
- **Temporal horizon**: how far into the future does Peter reference? ("i morgen" = 1 day, "til Jul" = months, "efter krigen" = indefinite)
- **Mail response latency**: when Peter references receiving a letter, estimate the round-trip time

Output: included in `data/letter-psycholinguistics.json` (ADR-015)

### 6. Correlation Analysis

Cross-correlate all trajectory metrics to find surprising relationships:

- Does semantic drift predict sentiment changes? (content change precedes emotional change)
- Does military vocabulary density correlate with hedging frequency? (danger → self-censorship)
- Does distance from home (from geocoded locations) predict temporal horizon? (farther = shorter horizon)
- Does letter frequency predict sentiment? (writing more often = better mood, or worse mood seeking connection?)

Output: `data/trajectory-correlations.json` — correlation matrix with significance values.

## Consequences

### Positive
- Makes the temporal structure of the corpus analytically accessible
- Stream graph and sentiment arc are immediately compelling visualizations
- Semantic drift is a novel metric — "how fast is this person's world changing?" — transferable to other corpora
- Correlation analysis may surface genuinely surprising patterns invisible to close reading
- All outputs feed into the Cognitive Atlas (ADR-020)

### Negative
- Quarterly time windows contain variable numbers of letters (some quarters may have <5 letters)
- Smoothing parameters (window size, LOESS bandwidth) affect the shape of trajectories — risk of over-smoothing
- Correlation ≠ causation — historical events provide context but not proof

### Mitigation
- Use adaptive window sizes: quarterly for dense periods, half-yearly for sparse
- Report trajectories with confidence bands showing uncertainty from small samples
- Present correlations alongside historical timeline, not as standalone claims

## Validation
- Topic stream graph sums to 100% at each time point
- Sentiment trajectory smoothing preserves known extremes (e.g., Christmas letters should be positive)
- Semantic drift spikes align with at least 3 known major events (deployment, front transfer, armistice)
- Vocabulary trajectories show expected patterns (military vocabulary increases post-1914)
