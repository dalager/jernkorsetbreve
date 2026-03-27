# Research Report: Semantic Search & NLP Improvements for Jernkorset Breve

**Date:** 2026-03-26
**Scope:** Search quality evaluation, model selection, archaic Danish modernization, semantic trajectories, visualization

---

## 1. Current State Assessment

### What Exists Today

The project has a well-architected client-side semantic search system:

- **Model:** `Xenova/gte-small` -- a 384-dimensional English-focused embedding model
- **Corpus:** 665 letters, average 1,636 characters each (11 to 5,846 chars)
- **Pre-computed embeddings:** `embeddings.bin` at ~998 KB (665 x 384 x 4 bytes)
- **Runtime:** Only query embedding happens at runtime via Transformers.js + ONNX Runtime WASM
- **Model download:** ~33 MB quantized (q8) from Hugging Face, cached after first load
- **Additional data products:** UMAP 2D projection, k-means topic clusters (k=8), related letters, sentiment scores, search snippets
- **Explorer page:** Interactive canvas with color-by-time/sender/sentiment/cluster and timeline animation

### The Core Problem

**gte-small is English-only.** It was designed for English text and has no meaningful Danish language training. It works partially because:
1. Many words share Germanic roots with English
2. The model captures some cross-lingual signal from structural patterns
3. With only 665 documents, even weak similarity signals produce some ordering

But it fundamentally cannot understand Danish semantics, especially archaic 1800s-era Danish with spellings like "skulde" (skulle), "Meningen" (meningen), "Tornyster" (tornister), "Ekcerserere" (ekserserere), and military terms from the German-Danish context.

### Language Characteristics of the Corpus

The letters (1911-1918) exhibit:
- **Pre-reform Danish spelling:** "aa" for "å", inconsistent capitalization of nouns (German influence)
- **Archaic vocabulary:** Military terms (Feldvebel, Hauptmand, Ordenans), old-fashioned expressions
- **German loanwords:** Reflecting the Schleswig-Holstein context under German rule
- **Dialectal features:** South Jutlandic (Sønderjysk) elements
- **Inconsistent orthography:** The same word spelled differently across letters
- **Mixed language fragments:** Occasional German phrases

---

## 2. Search Quality Evaluation Framework

### 2.1 Defining "Good Search Quality"

For this historical letter corpus, search quality has domain-specific dimensions:

| Dimension | Description | Example |
|-----------|-------------|---------|
| **Topical relevance** | Letters about the queried subject | "krigen i Frankrig" should return letters from the Western Front |
| **Temporal precision** | Time-specific queries match correctly | "julen 1917" should return December 1917 letters |
| **Person relevance** | Queries about people find relevant letters | "Trine" should rank letters to/from Trine highly |
| **Emotional/thematic** | Abstract queries find thematically matching letters | "ensomhed" (loneliness) should find letters expressing isolation |
| **Cross-lingual** | Modern Danish queries match archaic text | "soldater" should match letters using "Soldater" or related terms |

### 2.2 Test Case Design

Build a golden evaluation dataset with three tiers:

**Tier 1: Factual queries (30 test cases)**
These have objectively correct answers verifiable from metadata:
```
Query: "breve fra december 1917" -> Letters dated December 1917
Query: "breve fra Vestfronten"   -> Letters with Western Front locations
Query: "breve til Trine"         -> Letters where recipient = Trine
```

**Tier 2: Topical queries (30 test cases)**
These require reading the letters to judge relevance:
```
Query: "mad og forplejning"      -> Letters discussing food/rations
Query: "hjemve"                  -> Letters expressing homesickness
Query: "vejret"                  -> Letters describing weather conditions
```

**Tier 3: Semantic/conceptual queries (20 test cases)**
These test deeper understanding:
```
Query: "frygt for fremtiden"     -> Letters expressing anxiety about what comes next
Query: "familiens sundhed"       -> Letters asking about family health
Query: "krigens meningsloshed"   -> Letters questioning the purpose of war
```

### 2.3 Metrics

| Metric | Formula | What It Measures |
|--------|---------|-----------------|
| **Precision@5** | Relevant in top 5 / 5 | Are top results useful? |
| **Precision@10** | Relevant in top 10 / 10 | Broader result quality |
| **Recall@10** | Relevant in top 10 / total relevant | Do we find all relevant letters? |
| **MRR** | 1/rank of first relevant result | How quickly does a good result appear? |
| **nDCG@10** | Normalized discounted cumulative gain | Ranking quality with graded relevance |

### 2.4 A/B Comparison Framework

Structure evaluations as model comparisons:

```
Evaluation Run:
  - Model A: Xenova/gte-small (current baseline)
  - Model B: [candidate model]
  - Test set: 80 query-relevance pairs
  - Metrics: P@5, P@10, R@10, MRR, nDCG@10
  - Output: Per-query scores + aggregate + statistical significance
```

### 2.5 Implementation Plan

Create a Node.js evaluation script (`scripts/evaluate-search.mjs`) that:
1. Loads the golden dataset (JSON file with queries + relevant letter IDs + relevance grades)
2. Loads pre-computed embeddings for each model variant
3. Runs each query against each model's embeddings
4. Computes all metrics
5. Outputs a comparison table and per-query breakdown

The golden dataset should live at `tests/search-eval/golden-queries.json`.

### 2.6 User Experience Metrics

Beyond retrieval quality, track:
- **Model load time:** Time from init() to ready (first visit vs. cached)
- **Query latency:** Time from query submission to results displayed
- **Embedding binary size:** Impact on initial page load and bandwidth
- **Total download size:** Model + embeddings + supporting data

---

## 3. Model Selection & Size/Quality Tradeoff

### 3.1 Candidate Models

| Model | Params | Dims | Languages | ONNX Size (q8) | Danish Support | Transformers.js Ready |
|-------|--------|------|-----------|----------------|----------------|----------------------|
| **Xenova/gte-small** (current) | 33M | 384 | English only | ~33 MB | None | Yes |
| **multilingual-e5-small** | 118M | 384 | 100+ | ~120 MB | Yes (trained) | Yes (Xenova/multilingual-e5-small) |
| **multilingual-e5-base** | 278M | 768 | 100+ | ~280 MB | Yes (trained) | Yes (Xenova/multilingual-e5-base) |
| **EmbeddingGemma-300M** | 308M | 768 (MRL to 256/128) | 100+ | ~200 MB (q4) | Yes | Yes (onnx-community/embeddinggemma-300m-ONNX) |
| **gte-multilingual-base** | ~305M | 768 | 70+ | ~300 MB | Likely | Requested but unclear |
| **jina-embeddings-v3** | 570M | 1024 (MRL to 32-1024) | 89 (Danish explicit) | ~570 MB | Yes (top-30 language) | Issue open, not yet |

### 3.2 Recommended Approach: Hybrid Architecture

The key insight is that the current architecture already supports a hybrid approach -- embeddings are pre-computed at build time, and only queries are embedded at runtime. This means:

**Document embeddings can use a LARGE, high-quality model** (run once at build time, no size constraint)
**Query embeddings need a SMALL, fast model** (run in browser, size matters)

This works if both models map to a compatible embedding space, OR if we use the same model for both but accept a larger client download.

#### Option A: Same Model, Bigger and Better (Recommended First Step)

Switch from `gte-small` to `multilingual-e5-small`:
- Same 384 dimensions, same embedding binary size (~998 KB)
- Genuine Danish language support
- ONNX model ~120 MB unquantized, ~60 MB q8 -- larger than current but manageable
- **Xenova/multilingual-e5-small already exists** with ONNX weights
- Drop-in replacement: change MODEL_NAME in two files

**Expected impact:** Significant improvement on Danish queries with moderate download size increase.

#### Option B: EmbeddingGemma-300M (Best Quality per Size)

- 768 dimensions with Matryoshka truncation to 256 or 128
- 100+ language support, best-in-class for sub-500M models
- q4 quantized fits under 200 MB
- Proven browser deployment via Transformers.js
- Embedding binary grows: 665 x 768 x 4 = ~2 MB (or 665 x 256 x 4 = ~665 KB with MRL)

**Expected impact:** Best search quality, but 3-6x larger model download.

#### Option C: Asymmetric Hybrid (Advanced)

Use a large model (e.g., jina-embeddings-v3 or multilingual-e5-large) at build time to generate document embeddings, and a smaller compatible model at runtime for queries. This requires:
- Both models to share the same embedding space (same model family)
- Or: pre-compute query embeddings for common queries

This is more complex but offers the best quality/size tradeoff.

### 3.3 Decision Matrix

| Approach | Search Quality | Download Size | Embedding Binary | Complexity | Recommendation |
|----------|---------------|---------------|-----------------|------------|----------------|
| **A: multilingual-e5-small** | Good | ~60 MB q8 | 998 KB (same) | Trivial | **Do first** |
| **B: EmbeddingGemma q4** | Excellent | ~200 MB q4 | ~2 MB | Low | Do second, evaluate |
| **C: Asymmetric hybrid** | Best | ~60 MB q8 | ~2 MB | Medium | Investigate after A/B |

### 3.4 Implementation Steps for Option A

1. Update `scripts/generate-embeddings.mjs`: change `MODEL_NAME` to `Xenova/multilingual-e5-small`, update `DIMENSIONS` if needed
2. Update `apps/website/src/lib/search-engine.ts`: change `MODEL_NAME` to `Xenova/multilingual-e5-small`
3. Note: multilingual-e5 models require a query prefix `"query: "` and passage prefix `"passage: "` -- update the embedding generation script to prepend `"passage: "` to document texts, and the search engine to prepend `"query: "` to user queries
4. Regenerate embeddings: `node scripts/generate-embeddings.mjs --force`
5. Run evaluation framework against both old and new embeddings
6. Compare metrics

---

## 4. Archaic Danish Modernization for Better Embeddings

### 4.1 The Problem

Even with a multilingual model that supports modern Danish, the archaic orthography creates a vocabulary mismatch. Examples from the corpus:

| Archaic Form | Modern Danish | English |
|-------------|---------------|---------|
| skulde | skulle | should |
| Tornyster | tornister | knapsack |
| Ekcerserere | ekserserere/eksercere | drill/exercise |
| vilde | ville | would |
| kunde | kunne | could |
| Brev i Gaar | brev i gar | letter yesterday |
| saa | sa | so/then |
| "aa" throughout | "a" | (letter a) |

### 4.2 Approaches to Modernization

#### Approach 1: Rule-Based Orthographic Normalization (Low-Hanging Fruit)

Systematic spelling rules that apply to early 1900s Danish:

```javascript
const NORMALIZATION_RULES = [
  // Pre-1948 Danish spelling reform: aa -> a
  [/\baa\b/gi, match => match === 'AA' ? 'A' : match === 'Aa' ? 'A' : 'a'],
  // But preserve "aa" in names and places

  // Common archaic verb forms
  [/\bskulde\b/gi, 'skulle'],
  [/\bvilde\b/gi, 'ville'],
  [/\bkunde\b/gi, 'kunne'],

  // Capitalized common nouns (German influence)
  // This requires POS tagging to do correctly

  // Double consonant variations
  // Context-dependent, needs careful handling
];
```

**Pros:** Fast, deterministic, no API costs, can be applied at build time
**Cons:** Limited coverage, risk of false positives (e.g., "aa" in place names), cannot handle vocabulary changes

#### Approach 2: LLM-Based Modernization (High Quality)

Use an LLM to modernize each letter text at build time:

```
System: Du er en ekspert i historisk dansk sprog. Moderniser folgende tekst
fra tidligt 1900-tals dansk til moderne dansk retskrivning. Bevar
betydningen og tonen, men opdater stavning og grammatik til nutidens standard.
Bevar navne, steder og datoer uandrede.

Input: "Min egen kare Trine. Tak for sidst. Jeg er saa forkolet at jeg
snart ikke kan snakke."

Output: "Min egen kare Trine. Tak for sidst. Jeg er sa forkolet, at jeg
snart ikke kan snakke."
```

**Pros:** Handles vocabulary, grammar, and context; best quality
**Cons:** API costs (~665 letters x ~$0.01 = ~$6.65 one-time), non-deterministic, needs review

#### Approach 3: Dual-Text Embedding (Recommended)

Generate embeddings from BOTH original and modernized text, concatenated or averaged:

```
embedding_input = f"Moderne: {modernized_text}\n\nOriginal: {original_text}"
```

Or generate separate embeddings and average them:
```
final_embedding = 0.7 * embed(modernized) + 0.3 * embed(original)
```

This captures both the modern semantic meaning and any unique archaic vocabulary.

### 4.3 Existing Tools and Research

**Danish NLP resources relevant to historical text:**

- **DaNLP** (Alexandra Institute): Core Danish NLP toolkit with embeddings, NER, sentiment analysis. Does not specifically address historical text but provides foundational tools.
- **DaCy**: Danish spaCy pipeline for tokenization, lemmatization, POS tagging, dependency parsing. Could be used to preprocess before modernization.
- **Lemmy / cstlemma**: Danish lemmatizers that could help normalize word forms.
- **DaN+**: Handles lexical normalization, potentially applicable to historical spelling.
- **CLARIN normalization tools**: The CLARIN infrastructure provides tools for historical text normalization across multiple languages.
- **MultiLexNorm benchmark**: Includes Danish in its multilingual lexical normalization evaluation.

**Academic projects for historical Scandinavian NLP:**
- Research on 19th-century Danish and Norwegian literature has produced models using continued pre-training that outperform general models on historical texts.
- The "Making Sense of Normalization" project at Uppsala University addresses Old Norse/Old Danish normalization.
- VARD2 and MorphAdorner are adaptable historical text normalization tools (originally English, adaptable to Danish).

### 4.4 Recommended Pipeline

```
Phase 1 (Quick win):
  1. Apply rule-based aa->a and common archaic->modern substitutions
  2. Generate embeddings from normalized text
  3. Evaluate improvement

Phase 2 (Higher quality):
  1. Use Claude/GPT to modernize all 665 letters (one-time, ~$7)
  2. Store modernized text alongside originals in search-corpus.json
  3. Generate embeddings from modernized text
  4. Display original text in UI, use modernized for search
  5. Evaluate improvement vs Phase 1

Phase 3 (Optimal):
  1. Combine modernized + original text for embedding generation
  2. Add modernized text as additional search snippet for display
  3. A/B test different weighting strategies
```

### 4.5 Data Architecture Change

Extend `search-corpus.json` to include modernized text:

```json
{
  "id": 1,
  "text": "Min egen kare Trine. Tak for sidst...",
  "text_modern": "Min egen kare Trine. Tak for sidst...",
  "text_for_embedding": "Min egen kare Trine. Tak for sidst..."
}
```

The `text_for_embedding` field would be the input to the embedding model, which could be the modernized text, the original, or a combination.

---

## 5. Semantic Trajectory Mapping

### 5.1 Concept Definition

Semantic trajectories trace how meaning evolves through a sequence of documents ordered by time. For a letter corpus spanning 1911-1918, this reveals:

- **Topic drift:** How the subject matter of letters changes as Peter Maersk moves from civilian life to military service to front-line combat
- **Emotional arc:** The sentiment trajectory from early romantic letters to wartime anxiety
- **Relationship evolution:** How communication patterns between correspondents change
- **Geographic narrative:** The spatial journey mapped through letter locations

### 5.2 Concrete Analyses

#### A. Topic Evolution Timeline

Using the existing k-means clusters (k=8) and letter dates, plot cluster membership over time:

```
1911 |====CLUSTER_1====|
1912 |===CLUSTER_1===|==CLUSTER_2==|
1913 |==CLUSTER_2==|====CLUSTER_3====|
1914 |==CLUSTER_3==|=====CLUSTER_4=====|  <- War begins
1915 |========CLUSTER_5========|
...
```

This could be implemented as a stacked area chart or stream graph showing how topic proportions shift over the years.

#### B. Sentiment Trajectory

The project already has sentiment scores per letter. Plot these chronologically:

```
Sentiment
  +30 |     *
  +20 |   * * *   *
  +10 | * * * * * * *
    0 |----------*---*---*---------> Time
  -10 |              * *   *
  -20 |                  * * *
       1911  1912  1913  1914  1915  1916  1917  1918
```

Apply smoothing (rolling average) to reveal the emotional arc. Correlate with known historical events (mobilization, major battles, Christmas truces).

#### C. Embedding Drift

Track how the centroid of letter embeddings moves through the 384-dimensional space over time:

1. Group letters by month/quarter
2. Compute centroid of each group
3. Measure cosine distance between consecutive centroids
4. Plot "semantic velocity" -- how fast the content is changing

Spikes in semantic velocity correspond to life-changing events (deployment, transfer between fronts, injuries, armistice).

#### D. Vocabulary Trajectory

Track word frequency over time for key terms:
- Military vocabulary density increases with deployment
- Emotional language patterns shift
- References to home/family vs. military life

### 5.3 Research Connections

This work connects to several active fields:

- **Computational Narratology:** The study of narrative structure using computational methods. The Cambridge CHR journal has a specific track for this.
- **Narrative Arc Analysis:** Methods from Matthew Jockers' "Syuzhet" package for extracting plot shapes from text.
- **Digital Humanities:** The DHSI (Digital Humanities Summer Institute) offers courses on computational text analysis with direct relevance.
- **Sentiment Analysis in Literary Studies:** DHQ has published critical surveys of sentiment analysis approaches for literary/historical texts.

---

## 6. Visualization & Language Analysis

### 6.1 Current Visualizations

The project already has:
- UMAP 2D scatter plot (ExplorerCanvas) with color modes: time, sender, sentiment, cluster
- Timeline animation
- Leaflet map with letter locations
- Basic topic clusters (k-means)

### 6.2 Proposed New Visualizations

#### A. Topic Stream Graph (Priority: High)

A stacked stream graph showing topic proportions over time. Uses the existing cluster assignments and letter dates.

**Implementation:** D3.js `d3.stack()` with `d3.curveBasis` interpolation. Data is already available in `topic-clusters.json` and `letter-summaries.json`.

**Estimated effort:** 1-2 days. All data exists.

#### B. Correspondence Network Graph (Priority: High)

A force-directed graph showing relationships between senders and recipients:
- Nodes = people (sized by letter count)
- Edges = correspondence relationships (weighted by letter count)
- Color = role (soldier, family, friend)

**Implementation:** D3.js force simulation or vis.js. Data available from `letter-summaries.json`.

**Estimated effort:** 1-2 days.

#### C. Semantic Drift Visualization (Priority: Medium)

A line chart showing the cosine distance between consecutive letter embeddings, smoothed with a rolling window. Annotated with key historical events.

**Implementation:** D3.js line chart with event annotations. Requires computing drift from existing embeddings.

**Estimated effort:** 1 day for computation script + 1 day for visualization.

#### D. Interactive BERTopic Visualization (Priority: Medium)

Replace or supplement k-means with BERTopic for more interpretable topics:

- BERTopic produces human-readable topic labels via c-TF-IDF
- Supports hierarchical topic structures
- Can generate intertopic distance maps
- Supports multilingual models natively

**Caveat:** BERTopic is Python-only. Could run at build time and export results as JSON for the static site.

**Implementation:**
1. Python script using BERTopic with a Danish/multilingual sentence transformer
2. Export topic assignments, topic labels, topic hierarchy as JSON
3. Visualize in the browser using D3.js or the exported pyLDAvis-style HTML

**Estimated effort:** 2-3 days.

#### E. Sentiment Arc Visualization (Priority: Medium)

A smoothed line chart of sentiment over time, with annotations for:
- Historical events (battles, holidays, troop movements)
- Letter context (to whom, from where)
- Hoverable data points linking to individual letters

**Implementation:** D3.js or recharts. Sentiment data exists in `letter-sentiments.json`.

**Estimated effort:** 1 day.

#### F. Word Cloud with Historical Context (Priority: Low)

Per-cluster or per-time-period word clouds showing distinctive vocabulary:
- Compute TF-IDF per cluster/period
- Render using d3-cloud
- Interactive: click a word to see letters containing it

**Estimated effort:** 1-2 days.

### 6.3 JavaScript Visualization Libraries

| Library | Best For | Complexity | Size |
|---------|----------|-----------|------|
| **D3.js** | Custom, interactive charts | High | ~90 KB |
| **vis.js** | Network graphs, timelines | Medium | ~200 KB |
| **recharts** | React-native charts | Low | ~150 KB |
| **deck.gl** | Large-scale WebGL vis | High | ~500 KB |
| **d3-cloud** | Word clouds | Low | ~15 KB |
| **Plotly.js** | Quick scientific plots | Low | ~1 MB |

Recommendation: Use D3.js for custom visualizations (already an industry standard for digital humanities projects), and recharts for simpler charts that integrate well with the React/Next.js stack.

### 6.4 In-Browser Topic Modeling

**jsLDA** (Cornell/Mimno) provides in-browser LDA topic modeling:
- Runs entirely in JavaScript using Gibbs sampling
- Interactive: users can explore topics, sort documents, view correlations
- Could complement the existing k-means clusters with a different perspective

This could be offered as an "advanced exploration" feature where users can run topic modeling interactively on the letter corpus.

---

## 7. GOAP Action Plan

### State Assessment

```
Current State:
  search_model: "gte-small" (English-only)
  search_quality: low (no Danish understanding)
  text_modernization: none
  evaluation_framework: none
  visualizations: [umap_scatter, map, basic_clusters]
  topic_modeling: kmeans_only
  sentiment_analysis: exists_basic
  trajectory_analysis: none

Goal State:
  search_model: multilingual (Danish-aware)
  search_quality: measured_and_improved
  text_modernization: applied_to_embeddings
  evaluation_framework: running_with_golden_dataset
  visualizations: [umap, map, clusters, stream_graph, network, sentiment_arc, drift]
  topic_modeling: bertopic_with_labels
  sentiment_analysis: exists_with_trajectory
  trajectory_analysis: computed_and_visualized
```

### Optimal Action Sequence

#### Phase 1: Foundation (Week 1) -- Highest Impact, Lowest Effort

```
Action 1.1: Create evaluation golden dataset
  Preconditions: {corpus_accessible: true}
  Effects: {golden_dataset: true}
  Cost: 3 (manual work to identify relevant letters per query)
  Output: tests/search-eval/golden-queries.json

Action 1.2: Build evaluation script
  Preconditions: {golden_dataset: true}
  Effects: {eval_framework: true}
  Cost: 2
  Output: scripts/evaluate-search.mjs

Action 1.3: Baseline evaluation of gte-small
  Preconditions: {eval_framework: true}
  Effects: {baseline_measured: true}
  Cost: 1
  Output: Baseline P@5, P@10, MRR, nDCG@10 scores

Action 1.4: Switch to multilingual-e5-small
  Preconditions: {baseline_measured: true}
  Effects: {search_model: "multilingual-e5-small"}
  Cost: 1 (two-line code change + regenerate embeddings)
  Files: scripts/generate-embeddings.mjs, src/lib/search-engine.ts

Action 1.5: Evaluate multilingual-e5-small
  Preconditions: {search_model: "multilingual-e5-small", eval_framework: true}
  Effects: {model_a_evaluated: true}
  Cost: 1
  Validation: nDCG@10 improvement > 10% over baseline
```

**Expected Phase 1 outcome:** Measurable search quality improvement from simply switching to a multilingual model. This is the single highest-impact change with the lowest effort.

#### Phase 2: Text Modernization (Week 2) -- High Impact

```
Action 2.1: Implement rule-based normalization
  Preconditions: {corpus_accessible: true}
  Effects: {basic_normalization: true}
  Cost: 2
  Output: scripts/normalize-text.mjs

Action 2.2: LLM-based modernization of all 665 letters
  Preconditions: {corpus_accessible: true}
  Effects: {modernized_text: true}
  Cost: 3 (API calls, review, cost ~$7)
  Output: data/modernized-letters.json

Action 2.3: Update embedding pipeline to use modernized text
  Preconditions: {modernized_text: true}
  Effects: {embeddings_from_modern: true}
  Cost: 1
  Output: Updated search-corpus.json with text_modern field

Action 2.4: Evaluate modernized-text embeddings
  Preconditions: {embeddings_from_modern: true, eval_framework: true}
  Effects: {modernization_evaluated: true}
  Cost: 1
  Validation: nDCG@10 improvement over Phase 1 result
```

**Expected Phase 2 outcome:** Further search improvement by resolving the vocabulary mismatch between modern query language and archaic letter text.

#### Phase 3: Advanced Model Evaluation (Week 3) -- Medium Impact

```
Action 3.1: Evaluate EmbeddingGemma-300M
  Preconditions: {eval_framework: true, modernized_text: true}
  Effects: {gemma_evaluated: true}
  Cost: 3 (larger model, longer generation)
  Note: Test with MRL truncation to 256 dims to keep embedding binary small

Action 3.2: Compare all model variants
  Preconditions: {baseline_measured: true, model_a_evaluated: true, gemma_evaluated: true}
  Effects: {optimal_model_selected: true}
  Cost: 1
  Output: Model comparison report with quality vs. size tradeoff curves

Action 3.3: Implement selected model
  Preconditions: {optimal_model_selected: true}
  Effects: {production_model_deployed: true}
  Cost: 2
```

#### Phase 4: Visualization & Analysis (Week 3-4) -- Medium Impact, High Visibility

```
Action 4.1: Topic stream graph
  Preconditions: {clusters_exist: true}
  Effects: {stream_graph: true}
  Cost: 2
  Dependencies: Existing topic-clusters.json + letter-summaries.json

Action 4.2: Correspondence network graph
  Preconditions: {letter_metadata: true}
  Effects: {network_graph: true}
  Cost: 2
  Dependencies: Existing letter-summaries.json

Action 4.3: Sentiment arc visualization
  Preconditions: {sentiments_exist: true}
  Effects: {sentiment_arc: true}
  Cost: 1
  Dependencies: Existing letter-sentiments.json + letter-summaries.json

Action 4.4: Semantic drift computation and visualization
  Preconditions: {embeddings_exist: true}
  Effects: {drift_computed: true, drift_visualized: true}
  Cost: 2
  Output: data/semantic-drift.json + visualization component
```

#### Phase 5: BERTopic & Advanced Analysis (Week 4-5) -- Lower Priority

```
Action 5.1: BERTopic analysis with Danish model
  Preconditions: {modernized_text: true}
  Effects: {bertopic_clusters: true}
  Cost: 3
  Tool: Python script, export JSON for static site

Action 5.2: Semantic trajectory analysis
  Preconditions: {embeddings_exist: true, drift_computed: true}
  Effects: {trajectories_computed: true}
  Cost: 3
  Output: data/semantic-trajectories.json

Action 5.3: Interactive exploration features
  Preconditions: {bertopic_clusters: true, trajectories_computed: true}
  Effects: {interactive_exploration: true}
  Cost: 4
```

### Priority Matrix

| Action | Impact | Effort | Priority Score | Phase |
|--------|--------|--------|---------------|-------|
| Switch to multilingual-e5-small | 9 | 2 | **4.5** | 1 |
| Build eval framework | 8 | 3 | **2.7** | 1 |
| LLM text modernization | 7 | 3 | **2.3** | 2 |
| Sentiment arc viz | 6 | 1 | **6.0** | 4 |
| Topic stream graph | 6 | 2 | **3.0** | 4 |
| Correspondence network | 6 | 2 | **3.0** | 4 |
| EmbeddingGemma evaluation | 5 | 3 | **1.7** | 3 |
| Semantic drift | 5 | 3 | **1.7** | 4 |
| BERTopic analysis | 5 | 4 | **1.3** | 5 |
| Rule-based normalization | 4 | 2 | **2.0** | 2 |
| Interactive exploration | 4 | 5 | **0.8** | 5 |

### Replanning Triggers

- If multilingual-e5-small shows < 5% nDCG improvement: investigate whether the corpus language is too archaic even for multilingual models (escalate modernization priority)
- If EmbeddingGemma download size causes UX problems: investigate Matryoshka truncation or R2 hosting (per ADR-011)
- If BERTopic produces poor topic coherence: the corpus may be too small (665 docs) for meaningful topic modeling; fall back to improved k-means with better labels

---

## 8. Key Research Findings Summary

### Models

1. **EmbeddingGemma-300M** is the current state-of-the-art for on-device/browser embedding models, with proven Transformers.js integration and 100+ language support.
2. **multilingual-e5-small** is the safest drop-in replacement for gte-small -- same dimensions, established ONNX support, genuine multilingual training.
3. **jina-embeddings-v3** explicitly lists Danish in its top-30 languages but lacks Transformers.js support as of March 2026.

### Historical Danish NLP

4. The Danish NLP ecosystem (DaNLP, DaCy, awesome-danish) has matured significantly but historical text normalization remains under-researched for Danish specifically.
5. The MultiLexNorm benchmark includes Danish, suggesting lexical normalization tools can be evaluated.
6. LLM-based modernization is likely the most practical approach for this specific corpus given its modest size.

### Digital Humanities

7. Computational narratology is an active field with direct applicability -- sentiment trajectories, topic evolution, and narrative arc analysis are established methods.
8. jsLDA provides in-browser topic modeling that could complement the existing k-means approach.
9. D3.js remains the standard for digital humanities visualizations and integrates well with the existing Next.js stack.

### Evaluation

10. MTEB/MMTEB is the standard benchmark for embedding model evaluation, but a domain-specific golden dataset is essential for this corpus.
11. nDCG@10 and MRR are the most informative single metrics for search quality evaluation.

---

## Sources

- [The Best Open-Source Embedding Models in 2026](https://www.bentoml.com/blog/a-guide-to-open-source-embedding-models)
- [Introducing EmbeddingGemma (Google Developers Blog)](https://developers.googleblog.com/introducing-embeddinggemma/)
- [Welcome EmbeddingGemma (Hugging Face Blog)](https://huggingface.co/blog/embeddinggemma)
- [In-browser semantic search with EmbeddingGemma](https://glaforge.dev/posts/2025/09/08/in-browser-semantic-search-with-embeddinggemma/)
- [EmbeddingGemma ONNX on Hugging Face](https://huggingface.co/onnx-community/embeddinggemma-300m-ONNX)
- [EmbeddingGemma Transformers.js issue](https://github.com/huggingface/transformers.js/issues/1418)
- [Xenova/multilingual-e5-small on Hugging Face](https://huggingface.co/Xenova/multilingual-e5-small)
- [Xenova/gte-small on Hugging Face](https://huggingface.co/Xenova/gte-small)
- [jina-embeddings-v3 announcement](https://jina.ai/news/jina-embeddings-v3-a-frontier-multilingual-embedding-model/)
- [jina-embeddings-v3 Transformers.js issue](https://github.com/huggingface/transformers.js/issues/1072)
- [MMTEB: Massive Multilingual Text Embedding Benchmark](https://arxiv.org/abs/2502.13595)
- [MTEB Leaderboard](https://huggingface.co/spaces/mteb/leaderboard)
- [Embedding Model Leaderboard March 2026](https://awesomeagents.ai/leaderboards/embedding-model-leaderboard-mteb-march-2026/)
- [The Lacunae of Danish NLP (ACL Anthology)](https://aclanthology.org/W19-6141/)
- [awesome-danish (GitHub)](https://github.com/fnielsen/awesome-danish)
- [DaNLP (Alexandra Institute)](https://github.com/alexandrainst/danlp)
- [CLARIN normalization tools](https://www.clarin.eu/resource-families/tools-normalisation)
- [MultiLexNorm benchmark](https://dh.fbk.eu/2021/11/multilexnorm-un-benchmark-multilingua-per-la-normalizzazione-lessicale/)
- [Making Sense of Normalization (Uppsala)](https://brill.com/view/journals/abag/82/3/article-p386_4.xml)
- [Large-Scale Comparison of Historical Text Normalization](https://aclanthology.org/N19-1389.pdf)
- [Historical text normalization with interactive MT](https://link.springer.com/article/10.1007/s10044-023-01164-w)
- [Computational Narratology (Cambridge CHR)](https://www.cambridge.org/core/journals/computational-humanities-research/announcements/call-for-papers/computational-narratology)
- [Computational Narrative Understanding (ACL)](https://aclanthology.org/2023.bigpicture-1.3.pdf)
- [Sentiment Analysis in Literary Studies (DHQ)](https://www.digitalhumanities.org/dhq/vol/17/2/000691/000691.html)
- [DHSI: Introduction to Computational Text Analysis](https://dhsi.org/2025/10/07/introduction-to-computational-text-analysis-dhsi-2026/)
- [BERTopic documentation](https://maartengr.github.io/BERTopic/index.html)
- [Multilingual BERTopic for Short Text](https://link.springer.com/chapter/10.1007/978-3-031-50755-7_16)
- [jsLDA: In-browser topic modeling](https://mimno.infosci.cornell.edu/jsLDA/)
- [D3.js](https://d3js.org/)
- [Retrieval Evaluation Metrics (Weaviate)](https://weaviate.io/blog/retrieval-evaluation-metrics)
- [Practical Guide to Recall, Precision, and NDCG](https://www.edge-ai-vision.com/2026/02/a-practical-guide-to-recall-precision-and-ndcg/)
- [Semantic Search with Sentence Transformers](https://sbert.net/examples/sentence_transformer/applications/semantic-search/README.html)
- [SemanticFinder (browser-based search demo)](https://do-me.github.io/SemanticFinder/)
- [Text Pre-Processing for Danish (Cultural Analytics)](https://melaniewalsh.github.io/Intro-Cultural-Analytics/05-Text-Analysis/Multilingual/Danish/01-Preprocessing-Danish.html)
