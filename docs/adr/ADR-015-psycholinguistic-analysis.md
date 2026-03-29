# ADR-015: Psycholinguistic Analysis Pipeline

## Status
Proposed (expanded 2026-03-29 with research synthesis)

## Context

Peter Maersk writes 620+ letters over 7 years (1911-1918), spanning courtship, military training, and front-line combat. This is an extraordinary longitudinal dataset for tracking how war changes language — and by inference, cognition.

The corpus also contains a natural experiment: Peter writes to two distinct audiences — Trine (romantic partner, ~199 letters) and Mor og Far (parents, ~421 letters). The same events may produce different tellings, revealing self-censorship and performative patterns.

Research in psycholinguistics has established that trauma, cognitive load, and identity shifts leave measurable traces in language: vocabulary constriction, syntactic simplification, pronoun shifts, and hedging patterns. These metrics have never been applied to a historical Danish letter corpus.

### What Changed Since the Original Proposal

ADR-030 implemented Concept Vector Projection (CVP) for sentiment analysis, producing:
- 13,577 sentence embeddings (`paraphrase-multilingual-mpnet-base-v2`, 768-dim)
- Per-sentence continuous sentiment scores (`data/cvp-sentence-scores.json`)
- Per-letter aggregated scores (`data/cvp-letter-scores.json`)

This infrastructure — sentence embeddings already computed and stored — dramatically expands what is feasible. Many psycholinguistic metrics can now be derived from the existing embeddings with no additional model loading. The sentence-level CVP pipeline also establishes conventions (skip-logic, per-letter JSON keyed by ID, formulaic sentence exclusion) that the psycholinguistic pipeline should follow.

Research into the current tool landscape and academic literature (conducted 2026-03-29) identified several significant opportunities beyond the original proposal.

## Decision

### Build a Multi-Layer Psycholinguistic Analysis Pipeline

Create `scripts/analyze-psycholinguistics.py` (Python, using DaCy + lexicalrichness + custom lexicons) that computes per-letter metrics and outputs `data/letter-psycholinguistics.json`.

Additionally, extend the existing CVP infrastructure with multi-dimensional concept vectors to produce `data/cvp-emotion-scores.json`.

### Tool Stack

| Tool | Purpose | Replaces |
|------|---------|----------|
| **DaCy `da_dacy_large_trf`** | Tokenization, POS tagging, dependency parsing | spaCy `da_core_news_lg` (original proposal) |
| **lexicalrichness** | MATTR, MTLD, HD-D and other diversity measures | Custom TTR computation |
| **lingua-py** | Danish-German code-switching detection | (supplements curated lexicon) |
| **NRC Emotion Lexicon (Danish)** | 8-emotion word-level categories | (new) |
| **NRC VAD Lexicon (Danish)** | Valence-arousal-dominance word-level scores | (new) |
| **TextDescriptives** | spaCy component for readability/quality metrics | (new — from CHCAA, same group as CVP) |
| **GoEmotions dataset** | Training data for emotion concept vectors | (new) |
| Python `math`, `gzip`, `collections` | Entropy, compression ratio, frequency | (unchanged) |
| **Existing CVP sentence embeddings** | Semantic coherence, emotion CVP, PCA discovery | (leverages ADR-030 output) |

**Why DaCy over stock spaCy**: DaCy is developed by the Centre for Humanities Computing at Aarhus University — the same group that produced the CVP method (ADR-030). DaCy's transformer-based models (`da_dacy_large_trf`) significantly outperform `da_core_news_lg` on NER (F1 ~86-90% vs ~80-82%) and dependency parsing. The transformer backbone handles subword variation in archaic forms better than word-vector models. Since we already depend on this group's CVP work, DaCy is a natural fit.

**Why TextDescriptives**: Also from the CHCAA group. A spaCy component that computes readability indices, coherence metrics, and quality measures out of the box. Reduces custom code for several ADR-015 metrics.

---

## Metrics to Extract

### A. Lexical Metrics

| Metric | Description | Hypothesis | Tool |
|--------|-------------|------------|------|
| **MATTR** | Moving Average TTR (window=50 words) | Vocabulary constricts under stress | `lexicalrichness` |
| **MTLD** | Measure of Textual Lexical Diversity | Length-independent diversity; drops under stress | `lexicalrichness` |
| **HD-D** | Hypergeometric Distribution D | Probabilistic TTR; robust to short letters | `lexicalrichness` |
| **Hapax Legomena Ratio** | Words appearing once / total words | Creative expression reduces under constraint | Custom |
| **Lexical Density** | Content words / total words | Functional language increases under cognitive load | DaCy POS |
| **Lexical Frequency** | Mean word frequency rank in corpus | High-frequency (basic) words increase under stress | Custom |

**Change from original**: MATTR replaces raw TTR (which is length-dependent). MTLD and HD-D added as they are robust to the wide variation in letter length (from short postcards to multi-page letters). Lexical frequency added based on Kellogg (1996): stressed writers default to higher-frequency words.

### B. Syntactic Metrics (DaCy dependency parsing)

| Metric | Description | Hypothesis | Tool |
|--------|-------------|------------|------|
| **Mean Dependency Distance (MDD)** | Average token distance between dependent and head | Drops with trauma/exhaustion (Liu 2008) | DaCy parse |
| **Max Dependency Distance** | Longest dependency arc in letter | Long-range planning capacity indicator | DaCy parse |
| **Mean Sentence Length** | Words per sentence | Shortens under stress | DaCy tokenization |
| **Subordinate Clause Ratio** | Subordinate clauses / total clauses | Complex argumentation decreases at front | DaCy dep labels |
| **Tree Depth** | Max depth of dependency parse tree | Syntactic nesting decreases under load | DaCy parse |

Computed directly from DaCy dependency parse trees:

```python
def mean_dependency_distance(doc):
    distances = [abs(token.i - token.head.i) for token in doc if token.dep_ != "ROOT"]
    return sum(distances) / len(distances) if distances else 0

def subordinate_clause_ratio(doc):
    sub_labels = {"mark", "advcl", "ccomp", "xcomp", "acl", "relcl"}
    clause_tokens = [t for t in doc if t.dep_ in sub_labels | {"ROOT", "conj"}]
    sub_tokens = [t for t in doc if t.dep_ in sub_labels]
    return len(sub_tokens) / len(clause_tokens) if clause_tokens else 0
```

### C. Psychological Markers

| Metric | Description | Hypothesis | Source |
|--------|-------------|------------|--------|
| **First-person singular ratio** | "jeg"/"mig"/"min"/"mit"/"mine" per 100 words | High = individual focus, depression (Pennebaker 2011) | Custom lexicon |
| **First-person plural ratio** | "vi"/"os"/"vores"/"vor" per 100 words | High = group identity absorption | Custom lexicon |
| **Jeg-to-Vi shift index** | Ratio of singular to plural 1st person | Military identity absorption over time | Custom |
| **Hedging frequency** | "vist," "maske," "vel," "nok," "vist nok" per 100 words | Uncertainty/anxiety markers | Custom lexicon |
| **Reassurance formulae** | "alt vel," "det gar godt," "I skal ikke bekymre Jer" | Performed normalcy for home front | Custom regex |
| **Absolutist language density** | "altid," "aldrig," "alt," "intet," "helt," "fuldstaendig" per 100 words | Strongest linguistic marker of psychological distress (Al-Mosaiwi & Johnstone 2018) | Custom lexicon |
| **Cognitive processing words** | "fordi," "grund," "forsta," "indse" (causation + insight) per 100 words | Drops acutely in trauma; rises during recovery (Pennebaker 2003) | Custom lexicon |
| **Temporal orientation** | Past/present/future tense verb ratio | Present-tense intrusion increases in trauma narratives (Kleim et al. 2018) | DaCy POS |
| **Sensory language density** | "se," "hore," "fole," "lugte," "smage" and derivatives per 100 words | Increases in traumatic recall | Custom lexicon |

**New additions** (supported by Pennebaker 2003, Kleim et al. 2018, Al-Mosaiwi & Johnstone 2018):
- **Absolutist language**: Al-Mosaiwi & Johnstone found this is the single strongest linguistic marker of psychological distress, outperforming negative emotion words.
- **Cognitive processing words**: Pennebaker's insight + causation categories track whether Peter is cognitively processing his experiences or avoiding reflection.
- **Temporal orientation**: Present-tense intrusion when narrating past events is a validated PTSD marker.
- **Sensory language**: Increases during traumatic recall (reliving experiences).

### D. Code-Switching (Danish-to-German)

| Metric | Description | Hypothesis | Tool |
|--------|-------------|------------|------|
| **German loanword density** | German terms per 100 words | Increases during combat as military German colonizes Danish thought | Curated lexicon |
| **German lexicon (expanded)** | See domain-tagged lexicon below | Domain-specific code-switching | Custom |
| **Automated German detection** | lingua-py on 5-word sliding windows | Catches German phrases not in curated lexicon | `lingua-py` |
| **Morphological integration** | German words with Danish inflections (-en, -er, -ede) | Measures depth of linguistic integration over time | Custom regex |

**Expanded German military lexicon** (domain-tagged):

| Category | Terms |
|----------|-------|
| **Rank/organization** | Feldvebel, Hauptmand, Gefr., Regt., Unteroffizier, Leutnant, Zugfuhrer, Kompagni, Batteri |
| **Locations/facilities** | Kaserne, Lazarett, Etappe, Stellung, Graben |
| **Equipment/weapons** | Gewehr, Granate, Geschutz, Munition, Patrone |
| **Procedures** | Appell, Wache, Dienst, Urlaub, Marschbefehl, Ordenans |
| **Medical** | Sanitater, Lazarett, Verbandplatz |
| **Administrative** | Feldpost, Feldpostkarte, Zensur |

Domain-tagging enables distinguishing functional borrowing (no Danish equivalent exists) from identity-laden code-switching (choosing German when Danish alternatives are available).

### E. Information-Theoretic Metrics

| Metric | Description | Hypothesis | Tool |
|--------|-------------|------------|------|
| **Character-level Shannon entropy** | Bits per character | Constrained/formulaic writing = lower entropy | `math` |
| **Compression ratio** | gzip(text) / len(text) | Self-censored text compresses better | `gzip` |
| **Word surprisal (corpus)** | -log2 P(word\|corpus) summed per letter | Information density drops with censorship | `collections.Counter` |

Unchanged from original proposal. Python stdlib is sufficient.

### F. Embedding-Derived Metrics (NEW — leverages ADR-030 infrastructure)

| Metric | Description | Hypothesis | Tool |
|--------|-------------|------------|------|
| **Semantic coherence** | Mean cosine similarity between consecutive sentence embeddings within a letter | Drops during cognitive fragmentation/trauma (Bedi et al. 2015) | Existing CVP embeddings |
| **Semantic coherence variance** | Variance of consecutive sentence cosine similarities | High variance = topic jumping, low = monotone | Existing CVP embeddings |
| **Intra-letter embedding spread** | Mean pairwise cosine distance of sentence embeddings | Wide = diverse content, narrow = repetitive | Existing CVP embeddings |
| **Formulaic embedding distance** | Cosine distance between formulaic sentences and the letter's non-formulaic centroid | Large distance = formulaic openings/closings are disconnected from content | Existing CVP embeddings |

**Key insight**: Semantic coherence (Bedi et al. 2015) was originally validated as a predictor of psychosis onset. In our context, it measures narrative coherence — whether Peter's thoughts flow logically or fragment. This is computable from the existing 13,577 sentence embeddings with no additional model loading.

---

## Multi-Dimensional Concept Vector Projection (NEW)

### Extending CVP Beyond Sentiment

The CVP infrastructure from ADR-030 can be extended to measure any bipolar psychological dimension. The existing 13,577 sentence embeddings are concept-agnostic — projecting onto a new concept vector is a single dot product per sentence.

```python
# V is a matrix of shape (K, 768), one row per concept vector
V = np.stack([v_sentiment, v_fear, v_homesickness, v_exhaustion, v_hope, v_grief])

# For all sentence embeddings E (13577, 768):
scores = E @ V.T  # yields (13577, K) — all emotions for all sentences
```

### Concept Vectors to Construct

| Concept Axis | Positive Pole (+) | Negative Pole (-) | Training Data Source |
|---|---|---|---|
| **Sentiment** | Happy/positive | Sad/negative | Fiction4 (already computed, ADR-030) |
| **Fear/Anxiety** | Fearful/anxious sentences | Calm/secure sentences | GoEmotions "fear" + "nervousness" |
| **Grief/Loss** | Death/loss/mourning | Continuation/presence | GoEmotions "grief" + "sadness" subset |
| **Hope/Optimism** | Future-looking/hopeful | Hopeless/despairing | GoEmotions "optimism" |
| **Love/Affection** | Intimate/caring sentences | Neutral/distant sentences | GoEmotions "love" + "caring" |
| **Homesickness** | Longing-for-home sentences | Content-where-I-am sentences | **Corpus-internal labeling** (50-100 sentences) |

### Why Cross-Lingual Transfer Works

GoEmotions is English-only, but the `paraphrase-multilingual-mpnet-base-v2` encoder aligns 50+ languages in the same embedding space. English-trained concept vectors produce valid projections for Danish text — the same property that makes Fiction4's English+Danish concept vector work for our Danish letters.

### Constructing Each Vector

For each target emotion:
1. Filter GoEmotions for sentences labeled with that emotion (positive pole, ~200-2000 sentences)
2. Filter for sentences explicitly NOT labeled with that emotion (negative pole)
3. Embed with `paraphrase-multilingual-mpnet-base-v2` (same model as sentiment)
4. `v = mean(positive_embeddings) - mean(negative_embeddings)`, normalize to unit length
5. Save as `data/cvp-{emotion}-vector.csv`

**Homesickness is special**: No standard dataset captures this emotion. Instead, manually label 50-100 sentences from Peter's own letters as "expressing homesickness" vs. "not expressing homesickness." This produces a concept vector perfectly attuned to how *this author* expresses longing. The existing `is_formulaic` field already identifies greetings/closings that often contain homesickness markers.

### Orthogonality and Correlation

Concept vectors will not be perfectly orthogonal — sentiment and hope overlap, fear and grief overlap. This is expected. Report the cosine similarity matrix between all concept vectors to document correlations. If `cos(v_sentiment, v_hope) = 0.7`, the reader knows these partially measure the same thing.

**Output format** (extending `cvp-letter-scores.json`):

```json
{
  "1": {
    "sentiment_mean": 0.042, "sentiment_p10": -0.12, "sentiment_p90": 0.18,
    "fear_mean": -0.15, "fear_p10": -0.31, "fear_p90": 0.03,
    "homesickness_mean": 0.28, "homesickness_p10": 0.08, "homesickness_p90": 0.41,
    "hope_mean": 0.11, "hope_p10": -0.05, "hope_p90": 0.22,
    "grief_mean": -0.08, "grief_p10": -0.19, "grief_p90": 0.02,
    "love_mean": 0.19, "love_p10": 0.01, "love_p90": 0.35
  }
}
```

### Unsupervised Dimension Discovery via PCA

In addition to supervised concept vectors, run PCA on the 13,577 sentence embeddings to discover natural axes of variation:

1. Compute top 10 principal components
2. For each PC, find the 20 highest-scoring and 20 lowest-scoring sentences
3. Manually interpret what each axis represents
4. Compute cosine similarity between PCs and concept vectors — overlap validates both
5. PCs with no concept vector parallel represent **undiscovered dimensions** of variation in Peter's writing

This is computationally trivial (seconds on 13,577 x 768 matrix) and may reveal war-specific psychological dimensions that no existing emotion taxonomy includes.

---

## Composite Indicators

### Trauma Composite (expanded)

Weighted combination of:
- Low MATTR (vocabulary constriction)
- Low mean dependency distance (syntactic simplification)
- High hedging frequency (uncertainty)
- High absolutist language density (psychological distress — strongest single marker per Al-Mosaiwi & Johnstone 2018)
- Jeg-to-Vi shift (identity absorption)
- High German code-switching density
- Low semantic coherence (narrative fragmentation — Bedi et al. 2015)
- Low cognitive processing word density (avoidance of reflection — Pennebaker 2003)

When multiple metrics spike simultaneously, the signal is stronger than any individual metric. Validate against known battle dates from `battles.json`.

### Censorship vs. Exhaustion vs. Avoidance Discriminator (expanded)

| Pattern | Entropy | Hedging | Coherence | Cognitive Words | Interpretation |
|---------|---------|---------|-----------|-----------------|----------------|
| Low entropy + high hedging | Low | High | Normal | Normal | **Self-censorship** ("can't say") |
| Low entropy + low hedging | Low | Low | Low | Low | **Genuine exhaustion** ("can't think") |
| Low entropy + high reassurance | Low | Low | Normal | Normal | **Performed normalcy** ("won't say") |
| Normal entropy + low coherence | Normal | Variable | Low | Low | **Traumatic avoidance** (topic jumping) |

The addition of semantic coherence and cognitive processing words (from Pennebaker's framework) adds a fourth discriminator category: traumatic avoidance, where the writer unconsciously avoids specific topics, producing incoherent text despite normal vocabulary range.

### Emotional Velocity (NEW)

Euclidean distance in K-dimensional emotion space between consecutive letters:

```python
velocity = np.linalg.norm(emotion_vector[i+1] - emotion_vector[i])
```

Spikes indicate psychological state transitions. Validate against deployment, known battles, leave periods, and the armistice. This extends ADR-017's "semantic velocity" concept with grounded emotional dimensions.

---

## Audience Divergence Analysis (expanded)

### Computational Approach

For each metric, compute separate time series for Trine-letters vs. parent-letters. Then compute:

- **Jensen-Shannon divergence** (symmetric, avoids infinite values — preferred over KL) of word distributions between streams per time window
- **Wasserstein distance** on CVP sentiment score distributions per time window
- **Metric divergence** per metric per time window
- **Cosine distance between mean embeddings** of Trine-letters vs. parent-letters per time window (leverages existing sentence embeddings)
- **Temporal overlap analysis**: for letters written on the same date to different recipients, compare all metrics directly

Output: `data/letter-audience-divergence.json`

### Specific Divergence Hypotheses (from war letters literature)

| Metric | Expected Direction | Rationale (Hanna 2014, Bell 1984) |
|--------|-------------------|----------------------------------|
| Intimacy markers (kaere, elskede, min egen) | Higher to Trine | Romantic vs. filial relationship |
| Negative sentiment floor (cvp_p10) | Lower to Trine (more candid) | More honest about suffering with fiancee |
| Reassurance formulae | Higher to parents | "I skal ikke bekymre jer" pattern |
| German military vocabulary | Possibly higher to parents | Performing military identity for father? |
| Sentence length | Longer to Trine | More reflective, less formulaic |
| Future temporal references | More to Trine | Planning a shared future |
| Fear CVP score | Higher to Trine | Expressing vulnerability to partner |
| Homesickness CVP score | Higher to Trine | Intimate longing vs. stoic duty |

### Same-Date Censorship Detection (NEW)

For letters written on the same date to different recipients (a subset of the corpus):

```python
# Cosine similarity between the embeddings of same-date letters
censorship_index = 1 - cosine_similarity(trine_embedding, parent_embedding)
```

Low similarity on the same date = high audience adaptation = active self-censorship. This operationalizes Tishby's Information Bottleneck theory: if Peter censors himself, mutual information between his experience (Trine-letters, assumed more candid) and his communication (parent-letters) decreases.

### Academic Novelty

The audience divergence analysis is the most novel component of this project. No published study has computationally compared a single soldier's letters to multiple recipients over the same time period. This natural experiment in wartime self-presentation is a strong candidate for a standalone publication. (Bell 1984 provides the theoretical framework; Pavalanathan & Eisenstein 2015 provide the computational precedent from social media.)

---

## Narrative Arc Analysis (NEW)

### Within-Letter Arcs

Using the existing sentence-level CVP scores, classify each letter's internal emotional trajectory:

| Arc Type | Pattern | Interpretation |
|----------|---------|----------------|
| **Reassurance-Shock-Reassurance** | Positive opening, negative middle, positive close | Classic wartime self-presentation (Hanna 2014) |
| **Declining** | Positive opening, increasingly negative | Candor or exhaustion overcoming social norms |
| **Monotone positive** | Uniformly positive throughout | Performed normalcy or genuinely good period |
| **Monotone negative** | Uniformly negative throughout | Acute distress overcoming all filters |
| **Oscillating** | Rapid sentiment swings | Cognitive fragmentation |

Method: compute the sentiment trajectory within each letter (sentence-by-sentence CVP scores), smooth with a 3-sentence rolling mean, classify the shape.

**Within-letter arc asymmetry**: `(mean_score_second_half - mean_score_first_half)`. Positive = letter ends better than it starts (reassurance pattern). Negative = candor increases through the letter.

### Across-Letter Arcs

The per-letter CVP scores create a 7-year emotional time series. Apply:

1. **LOESS smoothing** to reveal the macro-emotional arc
2. **Fourier/DCT decomposition** to identify dominant modes (Reagan et al. 2016)
3. **Change-point detection (PELT algorithm)** to objectively identify when Peter's emotional profile shifts
4. **Comparison with Reagan et al.'s six shapes**: does the 7-year arc match "man in a hole" (fall-rise), "Oedipus" (fall-rise-fall), or something unique?

---

## Semantic Change Detection (NEW)

### Individual Word Meaning Shifts

Track how specific words shift in contextual meaning across Peter's 7-year correspondence. Using the existing sentence embeddings:

1. For each target word, collect all sentence embeddings containing that word, tagged with date
2. Group by time period (yearly to ensure adequate sample sizes)
3. Compute centroid embedding per period
4. Measure cosine distance between consecutive period centroids

### Target Words

| Word | Pre-war usage | Hypothesized wartime shift |
|------|---------------|---------------------------|
| godt (good/well) | Genuine positive affect | Formulaic reassurance ("det gaar godt") |
| hjem (home) | Physical place | Idealized, mythologized concept |
| kammerater (comrades) | Friends/acquaintances | Military brotherhood, loss |
| arbejde (work) | Farm/civilian labor | Military duties |
| glad (happy) | Spontaneous emotion | Performed emotion for family |
| stille (quiet) | Peaceful, calm | Absence of shelling (military meaning) |

### Semantic Fossilization (NEW)

Track how certain phrases become formulaic over time by measuring the decrease in contextual embedding variance. If "det gaar godt" shows decreasing variance, it is becoming a fixed formula rather than a genuine report. This is a novel application of semantic change detection to a single individual's writing.

```python
# Variance of contextual embeddings for "det gaar godt" per time period
variance_by_period = [np.var(embeddings_for_phrase_in_period, axis=0).mean()
                      for period in periods]
# Decreasing variance = fossilization
```

---

## Implementation Plan

### Phase 0: Dependencies (1-2 hours)

Create `requirements-psycholinguistics.txt`:
```
dacy>=2.6.0
spacy>=3.6.0
lexicalrichness>=0.5.0
lingua-language-detector>=2.0.0
textdescriptives>=2.7.0
scipy>=1.10.0
```

Note: `sentence-transformers`, `torch`, `numpy`, `pandas` are already in `requirements-cvp.txt`.

Model download: DaCy large (~500 MB one-time). The sentence-transformer model is already cached from CVP.

### Phase 1: Multi-Emotion CVP Vectors (3-4 hours)

Create `scripts/generate-emotion-vectors.py`:
1. Download GoEmotions from HuggingFace
2. For each target emotion (fear, grief, optimism, love): filter exemplar sentences, embed, compute concept vector
3. Save vectors to `data/cvp-{emotion}-vector.csv`
4. Validate with obvious Danish test sentences (same pattern as ADR-030 PoC)

Create `scripts/generate-emotions-cvp.py`:
1. Load all concept vectors
2. Load existing sentence embeddings (or re-embed if not saved)
3. Project: `scores = embeddings @ concept_vectors.T`
4. Aggregate per letter (mean, p10, p90, range)
5. Output: `data/cvp-emotion-scores.json`

**Parallelizable with Phase 2.**

### Phase 2: Homesickness Concept Vector (2-3 hours)

1. Sample 200 sentences from the corpus
2. Manually label each as "expressing homesickness" (1) or not (0)
3. Save labels as `data/homesickness-labels.json`
4. Embed labeled sentences, compute concept vector
5. Validate against known letter content

**Parallelizable with Phase 1.**

### Phase 3: Psycholinguistic Metrics (4-6 hours)

Create `scripts/analyze-psycholinguistics.py`:
1. Load DaCy `da_dacy_large_trf`
2. Process each letter's `text_normalized` through DaCy
3. Compute all metrics from sections A-E per letter
4. Compute embedding-derived metrics from section F using existing CVP embeddings
5. Implement skip-logic (ADR-029 pattern)
6. Output: `data/letter-psycholinguistics.json`

### Phase 4: Audience Divergence (2-3 hours)

Create `scripts/analyze-audience-divergence.py`:
1. Split letters by recipient (Trine vs. parents)
2. Compute all metrics separately for each stream
3. Compute Jensen-Shannon divergence per time window
4. Identify same-date letter pairs and compute censorship index
5. Output: `data/letter-audience-divergence.json`

### Phase 5: Narrative Arc & Semantic Change (3-4 hours)

Create `scripts/analyze-narrative-arcs.py`:
1. Within-letter arc classification from sentence-level CVP scores
2. Across-letter arc extraction with LOESS smoothing
3. Change-point detection (PELT) on key metric time series
4. Output: `data/letter-narrative-arcs.json`

Create `scripts/detect-semantic-shifts.py`:
1. Extract contextual embeddings for target words
2. Compute centroid shift per time period
3. Compute fossilization metrics
4. Output: `data/semantic-shifts.json`

### Phase 6: PCA Dimension Discovery (1-2 hours)

Create `scripts/discover-embedding-dimensions.py`:
1. Load 13,577 sentence embeddings
2. Run PCA, extract top 10 components
3. For each PC, output the 20 highest/lowest scoring sentences
4. Compute cosine similarity between PCs and all concept vectors
5. Output: `data/pca-dimensions.json`

### Phase 7: Validation (3-4 hours)

Create `scripts/validate-psycholinguistics.py`:
1. Verify DaCy parses 20 sample letters with acceptable accuracy (>80% POS accuracy)
2. Trauma composite correlates with at least 3 known major events (deployment, specific battles, armistice)
3. Audience divergence is statistically significant for at least some time windows
4. Emotion CVP scores produce sensible rankings (fear-laden letters score high on fear, etc.)
5. Change-point detection identifies at least one historically validated transition
6. All per-letter JSON output is keyed by letter ID and compatible with existing data products

### Phase 8: Pipeline Integration (1-2 hours)

Add to `package.json`:
```json
"data:psycholinguistics": "python scripts/analyze-psycholinguistics.py",
"data:emotions": "python scripts/generate-emotions-cvp.py",
"data:audience": "python scripts/analyze-audience-divergence.py",
"data:arcs": "python scripts/analyze-narrative-arcs.py"
```

Update `build-data.mjs` to read psycholinguistic outputs. Update `data:all` target.

### Summary

| Phase | Effort | Parallelizable | Output |
|-------|--------|----------------|--------|
| 0: Dependencies | 1-2h | — | requirements-psycholinguistics.txt |
| 1: Emotion CVP vectors | 3-4h | Yes (with 2) | `cvp-{emotion}-vector.csv`, `cvp-emotion-scores.json` |
| 2: Homesickness vector | 2-3h | Yes (with 1) | `homesickness-labels.json`, `cvp-homesickness-vector.csv` |
| 3: Psycholinguistic metrics | 4-6h | — | `letter-psycholinguistics.json` |
| 4: Audience divergence | 2-3h | — | `letter-audience-divergence.json` |
| 5: Narrative arcs + semantic shifts | 3-4h | — | `letter-narrative-arcs.json`, `semantic-shifts.json` |
| 6: PCA discovery | 1-2h | Yes (with 5) | `pca-dimensions.json` |
| 7: Validation | 3-4h | — | Validation report |
| 8: Integration | 1-2h | — | Updated pipeline |
| **Total** | **21-30h** | | |

Critical path: Phase 0 → (Phase 1 || Phase 2) → Phase 3 → Phase 4 → Phase 5 → Phase 7 → Phase 8
Phase 6 can run anytime after Phase 0.

---

## Alternatives Considered

### Use stock spaCy `da_core_news_lg` instead of DaCy

Rejected. DaCy uses transformer backends that significantly outperform stock spaCy on dependency parsing and NER. The research group is the same one behind CVP. The accuracy improvement on archaic/non-standard text is particularly relevant.

### Build all metrics from scratch

Rejected. `lexicalrichness` and `TextDescriptives` are established, tested packages that compute many of the needed metrics. Building from scratch adds effort and bug risk for no benefit.

### Use LIWC for psychological categories

Rejected. LIWC is proprietary and has no validated Danish dictionary. The open-source approach (NRC Emotion Lexicon + curated Danish lexicons + CVP concept vectors) provides better coverage for Danish and is reproducible.

### Skip multi-dimensional CVP, only do lexicon-based metrics

Rejected. The CVP sentence embeddings already exist. Projecting onto additional concept vectors is computationally trivial (a matrix multiplication). The multi-dimensional psychological profile is the project's strongest analytical innovation and feeds directly into the Cognitive Atlas (ADR-020).

### Use LLM annotation instead of automated metrics

Not rejected but deferred. LLM annotation (prompting Claude/GPT-4 to rate letters on psychological dimensions) is a valid validation layer but too expensive and non-deterministic for the primary pipeline. Recommended as a validation tool in Phase 7.

---

## Consequences

### Positive

- Produces a "cognitive weather map" of Peter's mental state across 7 years
- The audience divergence analysis is unique — no published study has computationally compared a single soldier's letters to multiple recipients
- Multi-dimensional CVP extends the proven sentiment infrastructure to fear, homesickness, hope, grief, and love
- Semantic coherence metric (from existing embeddings) provides a trauma/fragmentation indicator with zero additional model cost
- PCA dimension discovery may reveal war-specific psychological axes not in existing taxonomies
- Semantic fossilization tracking is a novel methodological contribution
- All metrics are reproducible and domain-transferable to other letter corpora
- Feeds directly into visualizations (ADR-018), the Cognitive Atlas (ADR-020), and temporal analysis (ADR-017)

### Negative

- DaCy `da_dacy_large_trf` is trained on modern Danish — accuracy on archaic text will be imperfect (mitigated by running on normalized text from ADR-014)
- POS tagging and dependency parsing errors compound into metric noise
- Small sample sizes per time window may produce noisy estimates
- The trauma composite is a hypothesis, not a validated clinical instrument
- Adds ~500 MB of model downloads (DaCy)
- Phase 3 runtime may be 20-40 minutes for DaCy parsing of 665 letters

### Mitigation

- Run DaCy on normalized text (`text_normalized`) where available for better parsing accuracy
- Use rolling windows (5-10 letters) to smooth noise in time series
- Validate trauma composite against known historical events rather than claiming clinical validity
- Report confidence intervals on all metrics
- Implement skip-logic (ADR-029) to avoid re-running when inputs haven't changed
- Phase 7 validation catches systematic errors before pipeline integration

---

## Validation Criteria

1. DaCy parses 20 sample normalized letters with >80% POS accuracy
2. Trauma composite correlates with at least 3 known major events (deployment, specific battles, armistice)
3. Audience divergence is statistically significant (JSD > 0 with bootstrap p < 0.05) for at least some time windows
4. Emotion CVP vectors produce correct sign on 8/10 obvious Danish test sentences per emotion
5. PCA top-3 components explain >15% of total variance in sentence embeddings
6. Semantic coherence is lower for letters dated during known combat periods
7. Change-point detection (PELT) identifies at least one historically validated transition
8. All per-letter JSON output is keyed by letter ID and compatible with existing data products

---

## Key Academic References

### Pronouns and Psychological Language
- Pennebaker, J.W. (2011). *The Secret Life of Pronouns.* Bloomsbury Press.
- Pennebaker, J.W., Mehl, M.R., & Niederhoffer, K.G. (2003). "Psychological Aspects of Natural Language Use." *Annual Review of Psychology*, 54, 547-577.
- Al-Mosaiwi, M. & Johnstone, T. (2018). "In an Absolute State: Elevated Use of Absolutist Words Is a Marker Specific to Anxiety, Depression, and Suicidal Ideation." *Clinical Psychological Science*, 6(4), 529-542.

### Trauma and Language
- Kleim, B. et al. (2018). "Linguistic Features of Peritraumatic Narratives and PTSD: A Meta-Analysis." *Clinical Psychology Review*, 63, 89-100.
- Bedi, G. et al. (2015). "Automated Analysis of Free Speech Predicts Psychosis Onset." *npj Schizophrenia*, 1, 15030.
- Coppersmith, G., Dredze, M., & Harman, C. (2014). "Quantifying Mental Health Signals in Twitter." *CLPsych Workshop, ACL.*

### Embedding Projection and Concept Vectors
- Lyngbaek et al. (2025). "Continuous Sentiment Scores for Literary and Multilingual Contexts." (CVP paper, doi:10.63744/nVu1Zq5gRkuD)
- Lyngbaek et al. (2026). "Is Sentiment Banana-Shaped?" (arXiv:2601.07995)
- Grand, G. et al. (2022). "Semantic Projection Recovers Rich Human Knowledge." *Nature Human Behaviour*, 6, 975-987.
- Kozlowski, A.C., Taddy, M., & Evans, J.A. (2019). "The Geometry of Culture." *American Sociological Review*, 84(5), 905-949.

### Narrative Arcs
- Reagan, A.J. et al. (2016). "The Emotional Arcs of Stories Are Dominated by Six Basic Shapes." *EPJ Data Science*, 5, 31.
- Boyd, R.L., Blackburn, K.G., & Pennebaker, J.W. (2020). "The Narrative Arc." *Science Advances*, 6(32), eaba2196.

### War Letters and Correspondence
- Hanna, M. (2014). "War Letters: Communication between Front and Home Front." *1914-1918 International Encyclopedia of the First World War.*
- Bell, A. (1984). "Language Style as Audience Design." *Language in Society*, 13(2), 145-204.
- Barton, D. & Hall, N. (2000). *Letter Writing as a Social Practice.* John Benjamins.

### Syntactic Complexity and Cognitive Load
- Liu, H. (2008). "Dependency Distance as a Metric of Language Comprehension Difficulty." *Journal of Cognitive Science*, 9(2), 159-191.
- Kellogg, R.T. (1996). "A Model of Working Memory in Writing." In Levy & Ransdell (Eds.), *The Science of Writing.*

### Semantic Change
- Hamilton, W.L., Leskovec, J., & Jurafsky, D. (2016). "Diachronic Word Embeddings Reveal Statistical Laws of Semantic Change." *ACL 2016.*
- Giulianelli, M. et al. (2020). "Analysing Lexical Semantic Change with Contextualised Word Embeddings." *ACL 2020.*

### Tools and Datasets
- DaCy: github.com/centre-for-humanities-computing/DaCy (Danish NLP framework)
- TextDescriptives: github.com/HLasse/TextDescriptives (spaCy linguistic descriptors)
- GoEmotions: huggingface.co/datasets/google-research-datasets/go_emotions (27 emotion categories)
- NRC Emotion Lexicon: saifmohammad.com/WebPages/NRC-Emotion-Lexicon.htm (Danish translation available)
- NRC VAD Lexicon: saifmohammad.com/WebPages/nrc-vad.html (valence-arousal-dominance)
- lexicalrichness: pypi.org/project/lexicalrichness/ (MATTR, MTLD, HD-D)

## Related ADRs

- ADR-014: Archaic Danish Text Modernization (normalized text as input)
- ADR-017: Semantic Trajectory Analysis (temporal analysis framework)
- ADR-018: Visualization Components (displays psycholinguistic metrics)
- ADR-019: Domain-Specific Extraction (health, economics, weather domain lexicons)
- ADR-020: Cognitive Atlas (multi-dimensional state projection — primary consumer of psycholinguistic features)
- ADR-025: Sentiment Analysis on Normalized Text (predecessor research)
- ADR-029: Artifact Hashing (skip logic pattern)
- ADR-030: CVP Sentiment Implementation (infrastructure this ADR extends)
