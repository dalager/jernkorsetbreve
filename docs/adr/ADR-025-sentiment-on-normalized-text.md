# ADR-025: Sentiment Analysis on Normalized Text

## Status

Accepted (implemented 2026-03-28 via ADR-030 CVP pipeline)

## Date

2026-03-28

## Context

The sentiment analysis pipeline (notebook `05a_generate_sentiments.ipynb`) runs three tools on the original archaic Danish text from `data/letters.csv`:

- **AFINN** (lexicon-based, ~3,500 Danish words)
- **Sentida** (lexicon-based, Danish-specific)
- **DaNLP BERT emotion** (transformer-based, trained on modern Danish social media)

All three tools are built on modern Danish. Archaic spellings cause systematic blind spots:

| Archaic (current input) | Modern (normalized) | Impact |
|-------------------------|---------------------|--------|
| kjære | kære | Positive emotion word missed by AFINN/Sentida |
| kjærlighed | kærlighed | Positive emotion word missed |
| daarlig | dårlig | Negative word missed |
| saa glad | så glad | "saa" not in lexicon |
| gaaet | gået | Participial form missed |
| vilde | ville | Modal verb mismatch |

The same issue was identified and solved for embeddings in ADR-014, which introduced `scripts/normalize-danish.mjs` and the dual-text architecture. The normalized output (`data/normalized-letters.json`) already exists and has proven effective for embeddings. ADR-014's consequences section explicitly noted: "Modernized text benefits all downstream analyses (topic modeling, NER, sentiment) not just search."

Sentiment-carrying words are disproportionately affected because personal correspondence is rich in emotion vocabulary — and many of these words (`kjære`, `kjærlighed`, `daarlig`, `morsomt`) use the archaic orthographic patterns that normalization corrects.

### Scope: Letter-Level First

The current pipeline also scores individual sentences (via `data/sentences.csv`). Those sentences are extracted from archaic text in `03_extract_sentences.ipynb`. Re-extracting sentences from normalized text is a separate concern that can be pursued later. This ADR scopes the change to **letter-level sentiment on normalized text** only, while preserving sentence-level scores on archaic text for continuity.

---

## Research Findings: Danish Sentiment Landscape (2026)

### The current tools are outdated

**DaNLP was archived on March 22, 2025** and is no longer maintained. The BERT emotion model (`alexandrainst/da-emotion-classification-base`) used in the current pipeline was trained on DR social media data — a significant domain mismatch with 1910s war correspondence.

DaNLP's own benchmarks reveal the performance gap clearly:

| Model | Type | Europarl Acc | LCC Acc | Twitter Acc | Speed |
|-------|------|-------------|---------|-------------|-------|
| **AFINN** | Lexicon | 0.68 | 0.66 | 0.48 | ~1,707 sent/s |
| **Sentida** | Lexicon | 0.67 | 0.58 | 0.44 | ~751 sent/s |
| **BERT Tone** | Transformer | **0.79** | **0.74** | 0.73 | ~5 sent/s |
| **Senda** | Transformer | 0.75 | 0.68 | **0.76** | ~5 sent/s |
| spaCy Sentiment | Classifier | 0.74 | 0.66 | 0.66 | ~139 sent/s |

AFINN and Sentida perform near-random on Twitter data (0.48/0.44 accuracy for 3-class). Even on formal text (Europarl), they trail transformers by 10+ percentage points.

### EuroEval benchmarks (formerly ScandEval)

The standard benchmark for Danish NLP is now **EuroEval** (euroeval.com), maintained by Dan Saattrup Nielsen. Danish sentiment is evaluated on:

- **Angry Tweets** (DDSC/angry-tweets): 3,328 crowd-annotated tweets, 3-class (positiv/neutral/negativ)
- **Danish Sentiment in Context**: 1,041 examples from the COR lexicon

Best published results on Angry Tweets (decoder models, few-shot macro F1):

| Model | Macro F1 |
|-------|----------|
| SnakModel-7B instruct | 66.70 |
| Llama2-7B chat + INSTda | 65.92 |

Top-ranked Danish encoders for NLU tasks (EuroEval Nov 2025):
- `KennethEnevoldsen/dfm-sentence-encoder-large` (0.4B params)
- `AI-Sweden-Models/roberta-large-1160k` (0.4B params, ranked #2 overall on ScandEval)
- `ltg/norbert3-small` (best small-size encoder)

### Historical text sentiment: a solved problem?

A 2025 paper from Aarhus University (Centre for Humanities Computing — same group behind DaCy) introduces **Concept Vector Projection (CVP)** specifically for literary and historical text sentiment:

| Method | Fiction4 Overall (ρ) | Danish subset (ρ) |
|--------|----------------------|-------------------|
| **Sentiment Projection (CVP)** | **0.66** | **0.68** |
| XLM-RoBERTa | 0.60 | 0.58 |
| Twitter-XLM | 0.55 | — |
| VADER | 0.49 | — |

On **historical hymns (1798–1873)**, CVP outperformed alternatives by ρ = 0.12, demonstrating robustness to archaic Danish / "lexical drift." Key advantages:
- Produces **continuous scores** (not coarse 3-class), ideal for narrative arc analysis
- Uses multilingual encoder embeddings + linear projection
- No fine-tuning needed — works zero-shot on historical text
- The WW1 letters (1911–1918) fall squarely in this method's strength zone

A NoDaLiDa 2023 paper on historical Danish/Norwegian literary texts confirmed that **multilingual transformers outperform Danish-specific models** on archaic text, and continued pre-training on historical corpora improves results further.

**Source:** Lyngbaek et al. 2025, "Continuous Sentiment Scores for Literary and Multilingual Contexts" (arXiv:2508.14620)

### Additional lexical resources

The **Danish Sentiment Lexicon (DSL)** (ACL 2022) contains 13,859 headwords with polarity values — nearly 4x larger than AFINN's lexicon. The **NRC VAD Lexicon** is available in Danish (~20,000 words) and adds valence-arousal-dominance dimensions.

### The "drowned negativity" problem

The current pipeline reduces each letter to a single score (AFINN full-text or sentence-average). This causes **sentiment dilution**: a letter with 15 positive/neutral sentences and 1 devastating sentence about fallen comrades scores as mildly positive.

This is especially problematic for war correspondence. Research on Finnish WW2 letters (CEUR-WS Vol-3232) found that soldiers systematically downplay negative experiences. Danish soldiers in this corpus show the same pattern: wrapping bad news in reassuring framing ("Vi har det ellers godt... Vi mistede tre kammerater i går... Ellers er vejret fint").

A 2024 WASSA paper on Danish literary sentiment confirmed that **dictionary-based tools are outperformed by multilingual transformers** on historical Danish text — validating the concern about relying solely on AFINN/Sentida.

---

## Decision

### 1. Switch sentiment input to normalized text

Read from `data/normalized-letters.json` (`text_normalized` field) instead of `data/letters.csv`, using the same two-tier resolution as `build-data.mjs`: prefer LLM-modernized text when available, fall back to rule-based normalization.

### 2. Adopt multi-score sentiment representation

Replace the current single-integer output with a **multi-dimensional sentiment profile** per letter:

| Feature | Source | Purpose |
|---------|--------|---------|
| `sentiment_mean` | Sentence-level score, mean | Overall tone |
| `sentiment_min` | Min sentence score | Worst moment (emotional floor) |
| `sentiment_p10` | 10th percentile of sentence scores | Robust negative floor (tolerates noise) |
| `sentiment_p90` | 90th percentile | Positive ceiling |
| `sentiment_range` | max − min | Emotional volatility / mixed content indicator |
| `negative_ratio` | Fraction of sentences below threshold | Density of negative content |
| `emotion_labels` | BERT or CVP per-sentence, aggregated | Discrete emotion profile |

The `sentiment_p10` and `negative_ratio` features specifically address the drowned-negativity problem. A letter about losing comrades would have a low p10 and elevated negative_ratio even if the mean is positive.

### 3. Exclude greeting/closing formulae from aggregation

Detect and exclude formulaic openings ("Kære Forældre", "Min egen kære Trine") and closings ("Mange kærlige Hilsner", "din egen Peter") from sentence-level aggregation. These carry consistent positive sentiment that dilutes the letter's actual emotional content.

### 4. Evaluate model upgrade path

Run a comparative evaluation before committing to a model change:

| Approach | Priority | Rationale |
|----------|----------|-----------|
| **Keep AFINN + Sentida on normalized text** | Immediate | Baseline improvement, no new dependencies |
| **Add Senda** (`pin/senda`, transformer) | Short-term | Best Twitter accuracy (0.76), actively maintained, drop-in replacement for BERT Tone |
| **Evaluate CVP (Sentiment Projection)** | Medium-term | Purpose-built for historical/literary Danish, continuous scores, no fine-tuning needed |
| **Drop AFINN** | After evaluation | Consistently worst performer across all benchmarks |
| **Drop DaNLP BERT emotion** | After evaluation | Archived library, social media training data, domain mismatch |

The CVP method (Lyngbaek et al. 2025) is the most promising upgrade for this specific corpus because it was designed for exactly this use case — historical Danish literary text with archaic language.

### 5. Validate with A/B comparison

Before committing to normalized text:
- Count non-zero AFINN word matches per letter (archaic vs. normalized)
- Pearson correlation between archaic and normalized sentiment scores
- Manual review of the 20 letters with the largest score difference
- Check whether BERT emotion label distribution shifts meaningfully

---

## Alternatives Considered

### Keep sentiment on archaic text (status quo)

Rejected. AFINN and Sentida miss archaic spellings systematically. DaNLP benchmarks show these tools already perform poorly on modern informal text (0.44–0.48 accuracy); archaic text makes it worse.

### Run on LLM-modernized text only

Rejected as premature. LLM modernization (ADR-014 Phase 2) is not yet complete. Rule-based normalization is available now and sufficient for the orthographic mismatches that cause lexicon failures. The two-tier resolution pattern means LLM text will be used automatically when available.

### Replace all tools with a single LLM call

An LLM (Claude, GPT-4) could score each letter in one pass for ~$0.50–2.00 total. This would be the most powerful approach for detecting downplayed negativity, as LLMs understand framing, hedging, and euphemism. However, it creates an API dependency for the build pipeline and non-deterministic results. **Recommended as a validation/calibration layer** (run once to create a reference dataset), not as the primary pipeline.

### Dual-run permanently (both archaic and normalized)

Rejected for ongoing maintenance burden. The A/B comparison is a one-time validation step.

### Fine-tune a custom model on the corpus

Rejected. 665 letters is too small for fine-tuning. The CVP method works zero-shot, which is the right approach at this corpus size.

---

## Consequences

### Positive

- Estimated 10–30% more AFINN/Sentida lexicon matches per letter
- Multi-score representation surfaces hidden negativity in otherwise-positive letters
- Greeting/closing exclusion focuses scoring on substantive content
- Clear upgrade path from lexicon-based tools to state-of-the-art (CVP)
- No new infrastructure needed for Phase 1 — `data/normalized-letters.json` already exists
- Follows the same dual-text architecture established by ADR-014

### Negative

- Sentiment scores will change for all letters — any analysis referencing old scores needs to be re-evaluated
- Multi-score output requires changes to `build-data.mjs` and the website's `letter-sentiments.json` format
- Sentence-level sentiment remains on archaic text (scoped out), creating a temporary inconsistency
- CVP evaluation requires reading/implementing the Lyngbaek et al. paper

### Risks

- Normalization could introduce errors that shift sentiment (e.g., a normalization false positive on a sentiment-carrying word). The A/B validation step mitigates this.
- Greeting/closing detection may be imperfect — some letters have non-formulaic openings. Use conservative patterns.
- Model upgrades (Senda, CVP) introduce new Python dependencies that must be managed (ADR-027).

---

## Validation

### Phase 1: Normalized text (immediate)

1. Run AFINN on both archaic and normalized text for all 665 letters
2. Report: total word match count difference, per-letter score difference distribution
3. Manual review of top-20 most-affected letters (largest absolute score change)
4. Verify BERT emotion labels on 10 randomly sampled letters still seem reasonable
5. Spot-check that no normalization artifacts (e.g., broken names) are affecting scores

### Phase 2: Multi-score validation

6. Compare `sentiment_p10` against manually identified "letters with bad news" — does it flag them?
7. Check `negative_ratio` for letters known to describe combat, death, or hardship
8. Verify greeting/closing exclusion on 10 sample letters — are the right sentences excluded?

### Phase 3: Model evaluation (if pursuing upgrades)

9. Run EuroEval on candidate models: `euroeval --model <model-id> --task sentiment-classification`
10. Compare Senda, CVP, and current tools on 20 manually scored letters from the corpus
11. Evaluate CVP specifically on the archaic vs. normalized text to measure normalization's impact on a robust model

---

## Appendix A: Danish Sentiment Model Landscape (March 2026)

### Active HuggingFace models for Danish sentiment

| Model | Architecture | Labels | Best Score | Status |
|-------|-------------|--------|-----------|--------|
| `pin/senda` | Danish BERT | 3-class | 0.76 acc (Twitter) | Active |
| `alexandrainst/da-sentiment-base` | Danish BERT | 3-class | 0.79 acc (Europarl) | Active (DaNLP archived) |
| `cardiffnlp/twitter-xlm-roberta-base-sentiment-multilingual` | XLM-R | 3-class | 0.69 F1 (multilingual) | Active |
| CVP / Sentiment Projection | Multilingual encoder | Continuous | 0.68 ρ (Danish lit.) | Paper 2025 |

### Top Danish encoders (for fine-tuning or CVP)

| Model | Params | EuroEval Rank |
|-------|--------|---------------|
| `KennethEnevoldsen/dfm-sentence-encoder-large` | 0.4B | Best large |
| `AI-Sweden-Models/roberta-large-1160k` | 0.4B | #2 overall |
| `vesteinn/DanskBERT` | 110M | Best base-size (63.87 ScandEval agg) |
| `ltg/norbert3-small` | Small | Best small |

### Key benchmarks

| Benchmark | Dataset | Metric | Purpose |
|-----------|---------|--------|---------|
| EuroEval (euroeval.com) | Angry Tweets | MCC, macro F1 | Standard Danish sentiment benchmark |
| EuroEval | Danish Sentiment in Context | MCC, macro F1 | Context-dependent sentiment |
| DaNLP (archived) | Europarl / LCC / Twitter | Accuracy | Historical reference |

### Key lexical resources

| Resource | Size | Notes |
|----------|------|-------|
| AFINN-da | ~3,500 words | Current. Smallest, weakest coverage |
| Danish Sentiment Lexicon (DSL) | 13,859 headwords | ACL 2022. ~4x larger than AFINN |
| NRC VAD Lexicon (Danish) | ~20,000 words | Adds arousal + dominance dimensions |
| Sentida lexicon | Unknown exact size | With stemming. Performs worse than AFINN on LCC/Twitter |

## Appendix B: Aggregation Techniques for Long-Document Sentiment

### The drowned-negativity problem in war correspondence

Research on Finnish WW2 letters (CEUR-WS Vol-3232, 7,000 letters) found soldiers systematically downplay hardship. The recommended approach: **filter a general emotion lexicon to domain-relevant terms** with historian input (their 7,000-word FEIL lexicon was reduced to 298 domain-relevant words).

### Recommended aggregation features

| Feature | Formula | What it catches |
|---------|---------|-----------------|
| Mean | `mean(sentence_scores)` | Overall tone |
| P10 | `quantile(sentence_scores, 0.1)` | "Hidden floor" — robust to 1-2 noise sentences |
| Min | `min(sentence_scores)` | Absolute worst moment |
| Range | `max - min` | Emotional volatility |
| Negative ratio | `count(score < -1) / total` | Density of negative content |

### Detecting downplayed negativity (Danish-specific patterns)

| Pattern | Example | Signal |
|---------|---------|--------|
| Litotes | "det er jo ikke så slemt" | Negation + negative = hidden concern |
| Hedging with "ellers" | "vi har det ellers godt" | Minimization of negative context |
| Contrast after "men" | "vi har det godt, men..." | Post-contrast clause carries real sentiment |
| "Det værste er" | "Det værste er at vi har næsten ikke noget at spise" | Explicit worst-case marker |

### Narrative arc analysis

Rather than a single score, compute a **sentiment trajectory** through each letter (ordered sentence scores, smoothed with 3-sentence rolling window). This can reveal the "reassurance–shock–reassurance" pattern common in soldier letters.

---

## Appendix C: Sources

### Benchmarks and tools
- EuroEval (formerly ScandEval): euroeval.com — standard Danish NLP benchmark
- DaNLP: github.com/alexandrainst/danlp — archived March 2025
- DaCy: github.com/centre-for-humanities-computing/DaCy — Danish spaCy pipelines (NER/POS only, no sentiment)

### Key papers
- Lyngbaek et al. 2025, "Continuous Sentiment Scores for Literary and Multilingual Contexts" (arXiv:2508.14620) — CVP method, historical Danish
- NoDaLiDa 2023, "Sentiment Classification of Historical Danish and Norwegian Literary Texts" (ACL Anthology 2023.nodalida-1.34)
- WASSA 2024, "Comparing Tools for Sentiment Analysis of Danish Literature" (ACL Anthology 2024.wassa-1.15)
- NoDaLiDa 2025, "Lessons Learned from Training an Open Danish LLM" — SnakModel, Angry Tweets benchmarks
- CEUR-WS Vol-3232, paper10 — Finnish WW2 war letters emotion mining
- Pauli et al. 2021, "DaNLP: An open-source toolkit for Danish NLP" (NoDaLiDa 2021) — Angry Tweets dataset
- PLOS ONE 2025, "The Advantages of Lexicon-Based Sentiment Analysis in an Age of Machine Learning"
- Reagan et al. 2016, "The Emotional Arcs of Stories" (EPJ Data Science)

### Datasets
- DDSC/angry-tweets (HuggingFace) — 3,328 annotated Danish tweets
- Danish Sentiment Lexicon (ACL 2022, ACL Anthology 2022.salld-1.4) — 13,859 headwords
- NRC VAD Lexicon v2 (saifmohammad.com) — valence-arousal-dominance, Danish available

## Related

- ADR-014: Archaic Danish Text Modernization (establishes dual-text architecture)
- ADR-013: Search Evaluation Framework (evaluation methodology patterns)
- ADR-026: Extract Notebooks to Scripts (sentiment script extraction)
- ADR-029: Artifact Hashing (skip logic for sentiment pipeline)
