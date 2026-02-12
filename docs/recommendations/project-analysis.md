# Jernkorset Project Analysis

> Analysis performed: February 2026

## Project Overview

**Jernkorset** (The Iron Cross) is a comprehensive digital humanities project analyzing 666 personal letters from 1911-1918, primarily written by **Peter Mærsk**, a Danish soldier who fought on the German side during WWI as part of the Danish minority in Sønderjylland (Southern Jutland).

### Historical Context

- **Author**: Peter Mærsk and family members
- **Period**: 1911-1918 (pre-war through WWI)
- **Recipients**: Trine Mærsk (fiancée/wife), parents ("Mor og far")
- **Original letters**: Now held at the Royal Danish Library (Det Kongelige Bibliotek)
- **Digitization**: Typed by Else Mærsk (Peter's daughter) in the 1990s, later OCR'd and converted

---

## Data Architecture

### Core Data Files

| Dataset | Records | Size | Purpose |
|---------|---------|------|---------|
| `letters.json` | 666 | 1.5 MB | Primary source (HTML-formatted) |
| `letters.csv` | 666 | 1.2 MB | Cleaned flat-file version |
| `sentences.csv` | 14,234 | 1.3 MB | Sentence-level extraction |
| `NER_entities.csv` | 4,575 | 98 KB | Named entity mentions |
| `NER_entities_grouped.csv` | 1,265 | 26 KB | Aggregated entities |
| `sentiment_scored_letters.csv` | 666 | 1.2 MB | Multi-model sentiment |
| `places.csv` | 75 | 3.4 KB | Geographic reference |
| `Battles_WW1.csv` | 19 | 2.8 KB | Historical context |

### Data Schema

**Letter Record**:
```json
{
  "Place": "Løtzen (Gizycko)",
  "Sender": "Peter Mærsk",
  "Recipient": "Mor og far",
  "LetterDate": "1914-01-31T00:00:00",
  "Location": "54.036405,21.7667341,7",
  "Text": "<p>Kære Forældre...</p>"
}
```

### Data Relationships

```
letters.json/csv (666 letters)
    ├─→ letters_tokenized.csv (NLP processing)
    ├─→ placed_letters.csv (link to places)
    ├─→ sentiment_scored_letters.csv (sentiment analysis)
    ├─→ sentences.csv (sentence extraction)
    │   ├─→ sentences_tokenized.csv (tokenization)
    │   ├─→ NER_entities.csv (entity extraction)
    │   │   └─→ NER_entities_grouped.csv (aggregation)
    │   └─→ sentiment_scored_sentences.csv
    ├─→ places.csv (75 unique locations)
    │   └─→ places.geojson (mapping format)
    └─→ verbfreq.csv / nounfreq.csv (linguistic analysis)
```

---

## NLP Processing Pipeline

### Notebook Execution Order (01-15)

| Stage | Notebook | Purpose | Output |
|-------|----------|---------|--------|
| 1 | 01_cleanup | Text normalization | letters.csv |
| 2 | 02_geodata | Geographic processing | GeoDataFrame |
| 2a | 02_1_create1914map | Historical map prep | 1914_dk.geojson |
| 3 | 03_extract_sentences | Sentence tokenization | sentences.csv |
| 4 | 04_extract_named_entities | NER extraction | NER_entities.csv |
| 5a | 05a_generate_sentiments | Sentiment scoring | sentiment_scored_*.csv |
| 5b | 05b_sentiment_analysis | Sentiment visualization | Charts |
| 6 | 06_verb_noun_frequencies | POS tagging | nounfreq.csv, verbfreq.csv |
| 7 | 07_lemmatization | Lemma normalization | verbfreq_lemma.csv |
| 8 | 08_epub_creation | E-book generation | jernkorset.epub |
| 9 | 09_pdf_creation | PDF export | jernkorset.pdf |
| 10 | 10_places | Place geocoding | places.csv |
| 11 | 11_placemaps | Individual place maps | PNG files |
| 12 | 12_vector_clusters | Document clustering | Cluster visualizations |
| 13 | 13_historical_timeline | WWI battle timeline | Timeline charts |
| 14 | 14_temp_spatial_correlation | Letter-battle proximity | Correlation data |
| 15 | 15_wikidata_with_sparql | Wikidata enrichment | Battle metadata |

### Pipeline Flow Diagram

```
letters.json
    ↓
01_cleanup.ipynb
    ↓
letters.csv
    ├─→ 02_geodata.ipynb → Geographic visualizations
    ├─→ 03_extract_sentences.ipynb → sentences.csv
    │   ├─→ 04_NER → NER_entities_grouped.csv
    │   └─→ 05a_sentiment → sentiment_scored_sentences.csv
    ├─→ 06_verbs_nouns → nounfreq.csv, verbfreq.csv
    │   └─→ 07_lemmatization → verbfreq_lemma.csv
    ├─→ 08/09_export → epub, pdf
    ├─→ 10_places → places.csv
    │   └─→ 11_placemaps → PNG maps
    ├─→ 12_clusters → Thematic analysis
    └─→ 14_correlation → Battle proximity
```

---

## Utility Scripts

| Script | Purpose | Used By |
|--------|---------|---------|
| `MLStripper.py` | HTML tag removal | create_epub, create_pdf |
| `sentence_extractor.py` | DaCy sentence tokenization | 03_extract_sentences |
| `create_epub.py` | EPUB generation | 08_epub_creation |
| `create_pdf.py` | PDF generation | 09_pdf_creation |
| `letters_to_geopandas.py` | Letter → GeoDataFrame | 02_geodata, 10_places |
| `battles_to_geopandas.py` | Battle → GeoDataFrame | 13_historical_timeline |
| `wikidata_client.py` | SPARQL queries | 15_wikidata |
| `wikidata_battle_mapper.py` | Wikidata result mapping | 15_wikidata |

---

## Web Application Architecture

### Three-Tier Stack

```
┌─────────────────────────────────────────────────────────┐
│                    Docker Network                        │
│                  (jernkorset-network)                    │
│                                                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐  │
│  │     API     │  │  Frontend   │  │   Public Site   │  │
│  │  (FastAPI)  │  │   (Vite)    │  │    (Next.js)    │  │
│  │   :8000     │  │   :5173     │  │     :3000       │  │
│  └──────┬──────┘  └──────┬──────┘  └────────┬────────┘  │
│         │                │                   │           │
│         └────────────────┴───────────────────┘           │
│                          │                               │
│                    ┌─────┴─────┐                        │
│                    │   Data    │                        │
│                    │  (CSV)    │                        │
│                    └───────────┘                        │
└─────────────────────────────────────────────────────────┘
```

### API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/` | GET | All letters with full details |
| `/letters` | GET | Letter list (metadata only) |
| `/letters/{id}` | GET | Single letter by ID |
| `/places` | GET | Geographic reference data |
| `/proofread/{id}` | POST | AI text modernization |

### Frontend Features

- **React Dashboard** (Vite): Letter browsing, AI modernization with diff resolver
- **Next.js Public Site**: SEO-optimized, place filtering, static export

### AI Modernization

Uses Claude 3.5 Haiku to update 1911-1918 Danish spelling to contemporary Danish:
- Word-level diff visualization
- Accept/reject individual changes
- Performance metrics (tokens/second)

---

## Key Metrics

| Metric | Value |
|--------|-------|
| Total Letters | 666 |
| Sentences Extracted | 14,234 |
| Unique Places | 75 |
| Named Entities (unique) | 1,265 |
| Unique Nouns | 4,348 |
| Unique Verbs | 1,873 |
| Battle Correlations | 61 matches |

### Top Named Entities

**People**: Peter (629), Trine (409), Konov (153), Uffe (132), Gud (101)

**Places**: Berlin (71), Hamborg (48), Rusland (47)

### Historical Correlations

Peter Mærsk's letters correlate with major WWI battles:
- **Battle of Tannenberg** (Aug 1914): 1-38 km distance
- **First Battle of Masurian Lakes** (Sept 1914): 26-99 km
- **Spring Offensive** (1918): 52-96 km (Western Front)

---

## Technology Stack

| Layer | Technologies |
|-------|-------------|
| **Data Processing** | pandas, numpy, geopandas |
| **NLP** | DaCy, spaCy, AFINN, Sentida, BERT, Lemmy, transformers |
| **Geographic** | geopandas, shapely, geopy, contextily, pyproj |
| **Visualization** | matplotlib, seaborn, plotly, bokeh, wordcloud |
| **Backend** | FastAPI, Anthropic SDK, uvicorn |
| **Frontend** | React 19, Vite, Ant Design, TypeScript, diff |
| **Public Site** | Next.js 15, Tailwind CSS, TypeScript |
| **Export** | ebooklib (EPUB), reportlab (PDF) |

---

## Project Structure

```
jernkorsetbreve/
├── data/               # 18 CSV/JSON data files (~17 MB)
├── notebooks/          # 16 Jupyter notebooks
├── scripts/            # 8 Python utility modules
├── webapp/
│   ├── api/           # FastAPI backend
│   ├── data/          # Webapp data copy
│   ├── frontend/      # React dashboard
│   └── public-site/   # Next.js static site
├── historical_data/    # WWI battles + maps
├── maps/              # 1914/1918 GeoJSON boundaries
├── exports/           # EPUB + PDF publications
├── images/            # Wordclouds, visualizations
├── research/          # Research materials
└── docs/              # Documentation
```

---

## Summary

This project represents a complete **digital humanities workflow**:

1. **Preserves** historical correspondence through digitization
2. **Analyzes** text with modern NLP (sentiment, NER, clustering)
3. **Contextualizes** letters against WWI historical events
4. **Visualizes** geographic movements and linguistic patterns
5. **Publishes** in multiple formats (EPUB, PDF, web)
6. **Modernizes** historical Danish text using AI
