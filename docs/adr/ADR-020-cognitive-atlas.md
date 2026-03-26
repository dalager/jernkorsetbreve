# ADR-020: The Cognitive Atlas — Multidimensional State Projection

## Status
Proposed

## Context

ADRs 015–019 produce per-letter metrics across multiple disciplines: psycholinguistic features, information-theoretic measures, social network centrality, domain-specific extractions (health, economics, weather, material culture), and semantic trajectory data. Each metric is independently valuable, but their combination enables something unprecedented.

### The Idea

Take every per-letter metric and combine them into a single high-dimensional "cognitive state vector." Then project this vector into 2D using UMAP — creating a map where proximity means not "textually similar" (as the existing embedding explorer shows) but **existentially similar**.

Two letters from different years, different locations, different topics might cluster together because Peter was in the same overall cognitive-emotional-material state. A 1915 letter from the Eastern Front and a 1918 letter from France might be neighbors if both were written during intense combat, with high hedging, low entropy, constricted vocabulary, and frequent health mentions.

This has never been done for a historical letter corpus.

### Comparison with Existing Explorer

| | Current Embedding Explorer | Cognitive Atlas |
|---|---|---|
| **Input** | Text embeddings (384-dim) | Analytical features (~30-dim) |
| **Similarity** | "About the same topic" | "In the same state of being" |
| **Clusters** | Topical clusters | Experiential clusters |
| **Insight** | What Peter talks about | How Peter is doing |

## Decision

### 1. Feature Vector Construction

Concatenate normalized per-letter metrics into a state vector:

**From ADR-015 (Psycholinguistics):**
- Type-Token Ratio (MATTR)
- Mean Dependency Distance
- Mean Sentence Length
- Jeg/Vi ratio (first-person pronoun shift)
- Hedging frequency
- Reassurance formula frequency
- German code-switching density
- Shannon entropy
- Compression ratio

**From ADR-016 (Social Network):**
- Number of people mentioned in this letter
- Social network centrality of mentioned people (mean PageRank)
- New names introduced (count of first-time mentions)

**From ADR-017 (Trajectories):**
- Sentiment score (existing)
- Semantic drift from previous letter (cosine distance)
- Topic cluster assignment (one-hot or soft membership)

**From ADR-019 (Domain Extractions):**
- Health mention density
- Scarcity mention density
- Weather mention count
- Material culture mention density
- Temporal horizon (days)
- Waiting vocabulary density

**From metadata:**
- Distance from home (km, from geocoded locations)
- Days since last letter sent
- Days since last letter received (estimated from "Tak for Brevet" references)
- Letter length (characters)

**Total: ~25-35 features per letter.**

### 2. Normalization

Each feature is z-score normalized (subtract mean, divide by standard deviation) across the full corpus so that no single feature dominates the UMAP projection.

Features with many missing values (e.g., distance-from-home for letters without geocoded locations) are imputed with the corpus median.

### 3. UMAP Projection

Run UMAP on the normalized feature matrix (665 × ~30) to produce 2D coordinates:

```python
from umap import UMAP

reducer = UMAP(
    n_neighbors=15,      # local neighborhood size
    min_dist=0.1,        # minimum distance between points
    metric='euclidean',  # on normalized features
    random_state=42      # reproducibility
)
atlas_2d = reducer.fit_transform(feature_matrix)
```

Output: `data/cognitive-atlas-2d.json` — per-letter 2D coordinates.

### 4. Cluster Analysis

Apply HDBSCAN on the high-dimensional feature matrix (not the 2D projection) to find "experiential clusters" — groups of letters where Peter is in a similar overall state:

```python
from hdbscan import HDBSCAN

clusterer = HDBSCAN(min_cluster_size=10, min_samples=3)
labels = clusterer.fit_predict(feature_matrix)
```

Name clusters by their distinctive features (e.g., "combat stress," "peaceful routine," "homesick waiting," "performed normalcy").

Output: `data/cognitive-clusters.json` — per-letter cluster assignment with cluster descriptions.

### 5. RuVector Integration (Optional Browser-Side Clustering)

RuVector is a good fit for the Cognitive Atlas (fit: 7/10), specifically for enabling **interactive re-clustering in the browser** without a Python backend:

- **Hyperbolic HNSW**: RuVector's hierarchy-aware search in Poincare ball space is well-suited for the ~30-dimensional feature vectors, particularly for detecting hierarchical cluster structure (e.g., "combat" subdividing into "Eastern Front combat" and "Western Front combat").
- **HNSW nearest-neighbor queries**: Replace or complement UMAP's kNN graph computation for the "why are these close?" tooltip — query the 5 nearest neighbors in feature space directly in the browser.
- **WASM runtime (58 KB)**: Load the normalized feature matrix into RuVector's WASM runtime, allowing users to adjust clustering parameters (min_cluster_size, distance metric) interactively without rerunning a Python pipeline.
- **Self-learning potential**: If the site ever gains user interaction tracking, SONA could learn which feature weightings produce the most user engagement with the atlas.

**Integration approach:**
1. Compute UMAP 2D projection at build time (Python, as specified above) — this remains the primary visualization
2. Load the full ~30-dimensional feature matrix into RuVector WASM as a secondary index
3. Use RuVector for interactive nearest-neighbor queries ("show me letters similar to this one in cognitive state")
4. Optionally expose a "re-cluster" button that runs HDBSCAN-equivalent clustering via RuVector client-side

**Caveat:** With only 665 data points, Python UMAP/HDBSCAN is simpler and produces more academically reproducible results (important for the DH2026 submission target). RuVector is the better choice if interactive browser-side exploration is prioritized over static reproducibility.

### 6. Visualization

Add a second tab to the existing `/explorer` page (or a new `/atlas` page):

- 2D scatter plot of Cognitive Atlas coordinates
- Points colored by: experiential cluster / time / sentiment / any single metric (user toggle)
- Hover: show letter date, location, and the top 3 distinctive features for that letter
- Click: open the letter with its full analytical annotation sidebar
- Timeline animation: watch Peter's "cognitive position" move through the atlas over time
- Comparison mode: overlay the text-embedding UMAP and the cognitive UMAP side by side

### 6. Interpretive Labels

For each HDBSCAN cluster, compute the most distinctive features (highest z-scores) and generate human-readable labels:

| Cluster | Distinctive Features | Suggested Label |
|---------|---------------------|-----------------|
| 0 | High hedging, low entropy, high German code-switching | "Under pressure" |
| 1 | High TTR, long sentences, many future references | "Peaceful reflection" |
| 2 | High health mentions, short sentences, low sentiment | "Illness/injury" |
| 3 | High reassurance, moderate entropy, many people mentioned | "Performing normalcy" |
| 4 | Low TTR, high scarcity, few people mentioned | "Deprivation and isolation" |

These labels are generated automatically but should be reviewed and refined manually.

## Consequences

### Positive
- A genuinely novel visualization — "existential similarity" rather than textual similarity
- Makes invisible patterns visible: letters from different years/places clustering together by shared experience
- The experiential clusters may reveal states that historians have not categorized
- Provides a holistic view that no single metric can offer
- Methodologically reproducible and transferable to other epistolary corpora
- Strong candidate for DH2026 conference submission

### Negative
- Depends on all upstream ADRs (015–019) completing successfully — high dependency chain
- UMAP projections are sensitive to hyperparameters — different settings produce different maps
- With only 665 data points, UMAP may not produce highly stable projections
- Interpreting why two letters are "close" in the atlas requires examining multiple features simultaneously

### Mitigation
- Can be built incrementally: start with available features, add more as upstream ADRs complete
- Run UMAP with multiple hyperparameter settings and choose the most interpretable projection
- Provide a "why are these close?" tooltip that lists the shared top features between neighboring letters
- Include the existing text-embedding explorer as a comparison baseline

### Minimum Viable Version

Even with just 5 features (sentiment, entropy, letter length, hedging frequency, distance-from-home), the atlas produces a meaningfully different view from the text-embedding explorer. Start with what is available and add features incrementally.

## Validation
- Atlas clusters are meaningfully different from text-embedding clusters (Adjusted Rand Index < 0.5, indicating the two views capture different structure)
- At least 3 experiential clusters have interpretable labels validated by reading representative letters
- Timeline animation shows Peter's cognitive position changing in ways that correlate with known historical events
- User testing: 3 people can describe what the atlas shows without technical explanation
