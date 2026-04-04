# Data Pipeline Documentation

This document traces the full provenance chain from the original letter data through all processing stages to the website's static JSON files.

## Source Data

**`data/letters.json`** is the original digitised export of 665 WW1 Danish letters. It has no ID field and is in an arbitrary order (not chronological). Fields: `Place`, `Sender`, `Recipient`, `LetterDate`, `Location`, `Text`. This file is the archival source only — no script in the automated pipeline reads it directly. All processing starts from `letters.csv`.

**`data/letters.csv`** is the canonical source for the entire project. It was created once by `01_cleanup.ipynb` from `letters.json` with these transforms: HTML stripping, whitespace normalisation, paragraph breaks replaced with `<PARA>` markers, date-sorting, and sequential ID assignment (1-665). Every script and every ID in the project traces back to this file.

## Pipeline Overview

```
data/letters.json          (original, unsorted, no IDs)
       |
  01_cleanup.ipynb         sort by date, assign IDs 1-665
       |
  data/letters.csv         (canonical source, date-sorted, with IDs)
       |
       +---> audit-text-quality.py ---> quality-audit/error-inventory.json
       |
       +---> apply-corrections.py ---> corrected-letters.json  (ADR-039/040)
       |         (reads abbreviation-lexicon.json)
       |
       +---> normalize-danish.mjs ---> normalized-letters.json
       |       (prefers corrected-letters.json, falls back to letters.csv)
       |            |
       |     extract-sentences-normalized.py ---> normalized-sentences.json
       |            |
       |     generate-sentiments-cvp.py ---> cvp-sentence-scores.json
       |            |                        cvp-letter-scores.json
       |     generate-emotions-cvp.py  ---> cvp-emotion-scores.json
       |     generate-identity-vector.py -> cvp-identity-scores.json
       |     analyze-psycholinguistics.py -> letter-psycholinguistics.json
       |     analyze-narrative-arcs.py --> letter-narrative-arcs.json
       |     analyze-audience-divergence.py -> letter-audience-divergence.json
       |     detect-semantic-shifts.py --> semantic-shifts.json
       |
       +---> extract-entities-dacy.py ---> letter-entities.json
       |       (reads normalized-letters.json)
       |
       +---> audit-entities.py -------> entity-audit.json
       |       (reads NER_entities_grouped.csv — independent of DaCy re-run)
       |            |
       |     disambiguate-persons.py --> disambiguation-evidence.json  (ADR-042)
       |     scan-epithets.py ---------> epithet-inventory.json        (ADR-043)
       |     resolve-epithets.py ------> epithet-resolutions.json      (ADR-043)
       |            |
       |     build-person-registry.py -> person-registry.json
       |     build-social-network.py --> social-network.json
       |     analyze-disappearances.py -> social-network.json (updated)
       |     build-research-queue.py --> external-records/research-queue.json (ADR-044)
       |
       +---> build-data.mjs ---> apps/website/public/data/*
       |
       +---> generate-embeddings.mjs ---> embeddings.bin, related-letters.json
       |
       +---> generate-battle-data.mjs --> battles.json
       +---> generate-clusters.mjs ----> topic-clusters.json
```

## Stage 1: Notebooks (exploratory & one-time generation)

The notebooks form the original research pipeline. They are numbered in execution order.

### 01_cleanup.ipynb — CSV creation (foundation)

| | |
|---|---|
| **Reads** | `data/letters.json` |
| **Writes** | `data/letters.csv` |
| **Key transforms** | Strip HTML tags, normalise whitespace, replace `\n\n` with `<PARA>` markers, convert dates to datetime, **sort by date**, **assign sequential IDs 1-665**, reorder columns to `id, date, sender, recipient, place, location, text` |

This is the single most important notebook: it establishes the canonical ID assignment used by the entire website. The date sort means IDs are chronological.

### 02_geodata.ipynb — Geographic exploration

| | |
|---|---|
| **Reads** | `data/letters.csv`, `maps/1914/1914.geojson`, `maps/capitals.geojson` |
| **Writes** | Nothing (visualisation only) |
| **Key transforms** | Parse location strings to WKT geometry, calculate distances between consecutive letters, filter to Peter Maersk's letters, plot on 1914 map |

### 02_1_create1914map.ipynb — Historical map preparation

| | |
|---|---|
| **Reads** | `maps/1914/1914.geojson` |
| **Writes** | `maps/1914/1914_dk.geojson` |
| **Key transforms** | Translate country names to Danish, remove small countries |

### 03_extract_sentences.ipynb — Sentence splitting

| | |
|---|---|
| **Reads** | `data/letters.csv` |
| **Writes** | `data/sentences.csv` (via external `sentence_extractor` script) |
| **Key transforms** | Uses dacy Danish NLP model for sentence boundary detection |

### 04_extract_named_entities.ipynb — NER extraction (legacy)

| | |
|---|---|
| **Reads** | `data/sentences.csv` |
| **Writes** | `output/NER_entities_scandi.csv`, `output/NER_entities_grouped.csv` |
| **Key transforms** | nbailab-base-ner-scandi transformer model, extract persons/places/orgs, group and count |
| **Status** | **Legacy.** Superseded by `scripts/extract-entities-dacy.py` (ADR-016/040) which uses the DaCy large transformer on normalized text for higher accuracy. The grouped CSV output is still consumed by `audit-entities.py`. |

### 05a_generate_sentiments.ipynb — Legacy sentiment scoring

| | |
|---|---|
| **Reads** | `data/letters.csv`, `data/sentences.csv` |
| **Writes** | `data/sentiment_scored_letters.csv`, `data/sentiment_scored_sentences.csv` |
| **Key transforms** | AFINN scores, Sentida scores, BERT emotion classification. Uses letter IDs from CSV directly. |

### 05b_sentiment_analysis.ipynb — Sentiment visualisation

| | |
|---|---|
| **Reads** | `data/sentiment_scored_letters.csv`, `data/sentiment_scored_sentences.csv` |
| **Writes** | Nothing (analysis only) |
| **Key transforms** | Min-Max normalisation, time-series plots, identify extreme letters |

### 06_verb_noun_frequencies.ipynb — Linguistic frequencies

| | |
|---|---|
| **Reads** | `data/letters.csv` |
| **Writes** | `data/nouns.csv`, `data/verbs.csv`, `data/nounfreq.csv`, `data/verbfreq.csv` |
| **Key transforms** | Filter to Peter Maersk only (625 letters), dacy POS tagging, frequency counts |

### 07_lemmatization.ipynb — Verb lemmatisation

| | |
|---|---|
| **Reads** | `data/verbfreq.csv` |
| **Writes** | `data/verbfreq_lemma.csv` |
| **Key transforms** | Lemmy Danish lemmatiser, group by lemma, sum frequencies |

### 08_epub_creation.ipynb — EPUB export

| | |
|---|---|
| **Reads** | `data/letters.csv` (via script) |
| **Writes** | `jernkorset.epub` |

### 09_pdf_creation.ipynb — PDF export

| | |
|---|---|
| **Reads** | `data/letters.csv` (via script) |
| **Writes** | `exports/jernkorset.pdf` |

### 10_places.ipynb — Place extraction and geocoding

| | |
|---|---|
| **Reads** | `data/letters.csv`, `maps/1914/1914_dk.geojson` |
| **Writes** | `data/places.csv`, `data/placed_letters.csv`, `data/places_cleanup.csv` |
| **Key transforms** | Group by (place, location), assign place_id, spatial join with 1914 map for country assignment, add OSM/Google Maps links |

### 11_placemaps.ipynb — Individual place maps

| | |
|---|---|
| **Reads** | `data/places.csv` |
| **Writes** | PNG images per place |
| **Key transforms** | Basemap tiles, inset locator maps, place markers |

### 12_vector_clusters.ipynb — Text clustering

| | |
|---|---|
| **Reads** | `data/letters.csv`, `data/sentences.csv` |
| **Writes** | `data/letters_tokenized.csv`, `data/sentences_tokenized.csv` |
| **Key transforms** | Filter to war period (post 1913-10-15), TF-IDF vectorisation, K-means clustering (3 letter clusters, 4 sentence clusters), PCA to 2D |

### 13_historical_timeline.ipynb — Battle timeline

| | |
|---|---|
| **Reads** | `historical_data/Battles_WW1.csv` |
| **Writes** | Nothing (visualisation only) |
| **Key transforms** | Gantt charts, interactive Plotly maps of battle locations |

### 14_temp_spatial_correlation.ipynb — Letter-battle proximity

| | |
|---|---|
| **Reads** | `data/letters.csv`, battle data (via scripts) |
| **Writes** | Nothing (analysis only) |
| **Key transforms** | Reproject to UTM for distance, find battles within 100km and 10 days of each letter |

### 15_wikidata_with_sparql.ipynb — Wikidata enrichment

| | |
|---|---|
| **Reads** | `wikidata_query_ww1_battles.sparql` |
| **Writes** | Nothing (visualisation only) |
| **Key transforms** | SPARQL query to Wikidata for WW1 battles, map visualisation |

### wordcloud.ipynb — Word clouds

| | |
|---|---|
| **Reads** | `data/nounfreq.csv`, `data/verbfreq.csv`, `data/verbfreq_lemma.csv`, `data/NER_entities_grouped.csv` |
| **Writes** | `images/nouncloud.png`, `images/verbcloud.png`, `images/verbcloud_lemmatized.png`, NER entity type clouds |

## Stage 2: Script pipeline (`npm run data:all`)

These scripts run sequentially via `npm run data:all`. They produce the data files consumed by the website.

### Execution order

```bash
npm run data:audit            # 1. Quality audit (error inventory)
npm run data:correct          # 2. Apply corrections (provenance-tracked)
npm run data:validate         # 3. Validate corrections (round-trip, regressions)
npm run data:normalize        # 4. Text normalisation (reads corrected-letters.json)
npm run data:sentences        # 5. Sentence extraction
npm run data:sentiment        # 6. CVP sentiment scoring (needs ML model)
npm run data:emotion-vectors  # 7. Emotion concept vectors (needs ML model)
npm run data:emotions         # 8. Emotion scoring (needs ML model)
npm run data:psycholinguistics # 9. Psycholinguistic analysis (needs spaCy)
npm run data:audience         # 10. Audience divergence analysis
npm run data:arcs             # 11. Narrative arc analysis
npm run data:semantic-shifts  # 12. Semantic shift detection
npm run data:enrich-places    # 13. Wikidata place enrichment
npm run data:network-all      # 14. Social network pipeline (ADR-016, needs DaCy in .venv)
  # data:ner             — DaCy NER on normalized text → letter-entities.json
  # data:entity-audit    — entity quality cleanup → entity-audit.json
  # data:disambiguate    — co-occurrence evidence for split persons → disambiguation-evidence.json (ADR-042)
  # data:epithets        — epithet scanning + resolution → epithet-inventory.json, epithet-resolutions.json (ADR-043)
  # data:person-registry — disambiguated persons → person-registry.json
  # data:social-network  — graph construction + metrics → social-network.json
  # data:disappearance   — silence dates + disappearance analysis → social-network.json (updated)
  # data:research-queue  — OSINT research queue from registry → external-records/research-queue.json (ADR-044)
npm run data:build            # 15. Aggregate all into website JSON
npm run data:battles          # 16. Battle data for timeline
npm run data:reindex          # 17. Embedding generation (needs ML model)
npm run data:clusters         # 18. Topic clustering
npm run data:borders          # 19. Historical border simplification
```

### Step details

| Step | Script | Reads | Writes | ID source |
|------|--------|-------|--------|-----------|
| 1 | `audit-text-quality.py` | `letters.csv` | `quality-audit/error-inventory.json` | CSV `id` field |
| 2 | `apply-corrections.py` | `letters.csv`, `abbreviation-lexicon.json` | `corrected-letters.json` | CSV `id` field |
| 3 | `validate-text-quality.py` | `corrected-letters.json` | (stdout: PASS/FAIL) | Letter `id` from step 2 |
| 4 | `normalize-danish.mjs` | `corrected-letters.json` (fallback: `letters.csv`) | `normalized-letters.json` | `id` from step 2 |
| 5 | `extract-sentences-normalized.py` | `normalized-letters.json` | `normalized-sentences.json` | `letter.id` from step 4 |
| 6 | `generate-sentiments-cvp.py` | `normalized-sentences.json`, `cvp-concept-vector.csv` | `cvp-sentence-scores.json`, `cvp-letter-scores.json` | `letter_id` from step 5 |
| 7 | `generate-emotion-vectors.py` | GoEmotions (HuggingFace) | `cvp-{emotion}-vector.csv` (10 files) | N/A |
| 8 | `generate-emotions-cvp.py` | `normalized-sentences.json`, emotion vectors | `cvp-emotion-scores.json`, `cvp-emotion-sentence-scores.json` | `letter_id` from step 5 |
| 9 | `analyze-psycholinguistics.py` | `normalized-letters.json`, `cvp-sentence-scores.json`, `letters.csv` | `letter-psycholinguistics.json` | Joins on letter ID |
| 10 | `analyze-audience-divergence.py` | `letters.csv`, `cvp-letter-scores.json` | `letter-audience-divergence.json` | Joins on letter ID |
| 11 | `analyze-narrative-arcs.py` | `cvp-sentence-scores.json`, `cvp-letter-scores.json`, `letters.csv` | `letter-narrative-arcs.json` | Joins on letter ID |
| 12 | `detect-semantic-shifts.py` | `cvp-sentence-scores.json`, `letters.csv` | `semantic-shifts.json` | Joins on letter ID |
| 13 | `enrich-places-wikidata.py` | `places.geojson` | `places-enriched.json` | N/A |
| 14a | `extract-entities-dacy.py` | `normalized-letters.json`, `letters.csv` | `letter-entities.json` | Letter `id` from step 4 |
| 14b | `audit-entities.py` | `NER_entities_grouped.csv` | `entity-audit.json` | Entity text |
| 14c | `disambiguate-persons.py` | `letter-entities-draft.json`, `letters.csv` | `disambiguation-evidence.json` | Letter `id` from CSV |
| 14d | `scan-epithets.py` | `corrected-letters.json` | `epithet-inventory.json` | Letter `id` from step 2 |
| 14e | `resolve-epithets.py` | `epithet-inventory.json`, `letter-entities-draft.json` | `epithet-resolutions.json` | Letter `id` from 14d |
| 14f | `build-person-registry.py` | `entity-audit.json`, `letter-entities-draft.json`, `letters.csv` | `person-registry.json` | Letter `id` from CSV |
| 14g | `build-social-network.py` | `person-registry.json`, `letter-entities-draft.json`, `letters.csv` | `social-network.json` | Letter `id` from CSV |
| 14h | `analyze-disappearances.py` | `social-network.json`, `letters.csv` | `social-network.json` (updated) | Letter `id` from CSV |
| 14i | `build-research-queue.py` | `person-registry.json`, `social-network.json` | `external-records/research-queue.json` | Person `id` from 14f |
| 15 | `build-data.mjs` | `letters.csv` + all intermediate JSON | `apps/website/public/data/*` (15+ files) | CSV `id` field |
| 16 | `generate-battle-data.mjs` | `Battles_WW1.csv`, sentiment data | `battles.json` | N/A |
| 17 | `generate-embeddings.mjs` | `search-corpus.json` | `embeddings.bin`, `related-letters.json`, UMAP projections | Letter ID from corpus |
| 18 | `generate-clusters.mjs` | `embeddings.bin`, sentiment data | `topic-clusters.json` | Letter ID |
| 19 | `build-historical-borders.mjs` | `maps/1914/*.geojson` | `borders-{1914,1918}.json` | N/A |

## Stage 3: Website build

`build-data.mjs` (step 11) is the aggregation point. It reads `letters.csv` as the canonical source, merges in all intermediate data by letter ID, and writes the final JSON files to `apps/website/public/data/`.

Published files:
- `letters.json` — full letter objects with HTML text
- `letter-summaries.json` — metadata only (id, date, sender, recipient, place)
- `letter-sentiments.json` — merged AFINN + CVP scores keyed by letter ID
- `cvp-sentence-scores.json` — per-sentence CVP scores (copy from data/)
- `sentiment-overview.json` — rolling averages, distribution, notable letters
- `search-corpus.json` — plain text + modernised text for embedding
- `search-snippets.json` — 200-char previews
- `places.json` — geocoded places with Wikidata enrichment
- `letter-psycholinguistics.json`, `cvp-emotion-scores.json`, `cvp-identity-scores.json`, `letter-audience-divergence.json`, `letter-narrative-arcs.json`, `semantic-shifts.json`, `pca-dimensions.json` — published copies from data/
- `social-network.json` — social network graph with nodes, edges, metrics, temporal slices, disappearance analysis (ADR-016)
- `person-registry.json` — disambiguated person registry with canonical names, aliases, roles, categories (ADR-016)

## ID Provenance

All letter IDs originate from `01_cleanup.ipynb`:

```python
df.sort_values(by=['date'], inplace=True)
df.insert(0, 'id', range(1, 1 + len(df)))
df.to_csv('../data/letters.csv', index=False, encoding='utf-8')
```

The IDs are sequential (1-665) in chronological order. Every downstream script must use IDs from `letters.csv`, never from array position in `letters.json`.

## Notebook Dependency Graph

```
01_cleanup (letters.json -> letters.csv)
 ├── 02_geodata (visualisation)
 ├── 03_extract_sentences -> sentences.csv
 │    ├── 04_extract_named_entities -> NER entities
 │    │    └── wordcloud (NER clouds)
 │    ├── 05a_generate_sentiments -> sentiment CSVs
 │    │    └── 05b_sentiment_analysis (visualisation)
 │    └── 12_vector_clusters -> tokenized CSVs
 ├── 06_verb_noun_frequencies -> noun/verb CSVs
 │    ├── 07_lemmatization -> lemmatized verbs
 │    └── wordcloud (noun/verb clouds)
 ├── 08_epub_creation -> jernkorset.epub
 ├── 09_pdf_creation -> jernkorset.pdf
 ├── 10_places -> places.csv, placed_letters.csv
 │    └── 11_placemaps (PNG images)
 └── 14_temp_spatial_correlation (analysis)

02_1_create1914map (standalone, 1914 map prep)
 └── 10_places

13_historical_timeline (standalone, battle visualisation)
15_wikidata_with_sparql (standalone, Wikidata query)
```
