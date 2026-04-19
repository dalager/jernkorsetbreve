---
name: browse-data
description: >
  Discover and query static JSON endpoints on jernkorset.dk — a digitized
  archive of 665 WW1 letters written by Peter Dalager from the Western Front
  (1914-1918), with NLP sentiment analysis, social-network graphs, embeddings,
  and historical GeoJSON borders.
license: CC-BY-4.0
metadata:
  version: "1.0.0"
  base_url: https://jernkorset.dk
  data_prefix: /data/
  format: application/json
  language: da
  spec: openapi-3.1
---

# Browse Data

Query the jernkorset.dk static JSON API to explore 665 WW1 letters, persons,
places, NLP sentiment scores, social-network graphs, and embedding
projections.

## Quick start

1. Fetch the OpenAPI 3.1 schema for full endpoint documentation:

   ```
   GET https://jernkorset.dk/data/api-schema.json
   ```

2. Or browse the API catalog (RFC 9264):

   ```
   GET https://jernkorset.dk/.well-known/api-catalog
   ```

3. All data lives under `https://jernkorset.dk/data/<file>.json`.

## Endpoint catalog

### Letters (core content)

| Endpoint | Size | Description |
|---|---|---|
| `letters.json` | 2.4 MB | 665 letters with full HTML body + modern Danish translation |
| `letter-summaries.json` | 95 KB | Metadata only (date, sender, recipient, summary) |
| `search-corpus.json` | -- | Plain-text letter bodies for full-text search |
| `search-snippets.json` | -- | 200-character previews for search results |

### Persons

| Endpoint | Size | Description |
|---|---|---|
| `person-pages.json` | 995 KB | Full person data with biographies and letter references |
| `person-registry.json` | -- | Canonical names, aliases, and roles |

### Places

| Endpoint | Size | Description |
|---|---|---|
| `place-pages.json` | 128 KB | Full place data with coordinates and letter references |
| `places.json` | -- | Lightweight list with coordinates only |

### NLP analysis

| Endpoint | Description |
|---|---|
| `letter-sentiments.json` | CVP sentiment scores per letter |
| `sentiment-overview.json` | Aggregated sentiment statistics |
| `cvp-sentence-scores.json` | Sentence-level sentiment |
| `cvp-emotion-scores.json` | Emotion vectors (joy, sadness, fear, anger, etc.) |
| `cvp-identity-scores.json` | National identity markers |
| `letter-psycholinguistics.json` | Word length, complexity, pronoun usage |
| `letter-audience-divergence.json` | Style differences by recipient |
| `letter-narrative-arcs.json` | Emotional arcs over time |
| `semantic-shifts.json` | Words that changed meaning during the war |

### Media

| Endpoint | Description |
|---|---|
| `image-registry.json` | Archival photos with metadata |
| `letter-images.json` | Letter-to-image associations |

### Network

| Endpoint | Description |
|---|---|
| `social-network.json` | Graph with PageRank, centrality, disappearance analysis |

### Search and embeddings

| Endpoint | Description |
|---|---|
| `embeddings-2d.json` | UMAP 2D projections of letter embeddings |
| `embeddings-3d.json` | UMAP 3D projections of letter embeddings |
| `related-letters.json` | Cosine-similarity pairs |
| `topic-clusters.json` | Thematic topic clusters |
| `pca-dimensions.json` | Interpretable PCA embedding dimensions |

### Historical context

| Endpoint | Description |
|---|---|
| `battles.json` | WW1 battles correlated with letter dates |
| `borders-1914.json` | GeoJSON borders at war start |
| `borders-1918.json` | GeoJSON borders at war end |

## Tips

### Prefer summaries over full data

When listing or browsing letters, fetch `letter-summaries.json` (95 KB) instead
of `letters.json` (2.4 MB). Only fetch the full file when you need HTML body
text or modern Danish translations.

### Markdown negotiation

Any page on jernkorset.dk supports content negotiation. Set the `Accept` header
to `text/markdown` to receive a Markdown-formatted version of the page:

```
GET https://jernkorset.dk/breve/42
Accept: text/markdown
```

This is useful for agents that prefer structured text over HTML.

### Filtering and cross-referencing

The JSON files are static snapshots. To filter or join data, fetch the relevant
files and process client-side. Common joins:

- Letter ID links `letters.json` to `letter-sentiments.json`, `cvp-emotion-scores.json`, `letter-images.json`, and `related-letters.json`.
- Person slugs link `person-pages.json` to letter sender/recipient fields.
- Place slugs link `place-pages.json` to letter location fields.

### Data freshness

All files are built at deploy time from the source data pipeline. They do not
change between deploys. There is no authentication or rate limiting.

## Example workflow: find the saddest letter

1. **Get sentiment scores** -- fetch the compact sentiment file:

   ```
   GET https://jernkorset.dk/data/letter-sentiments.json
   ```

2. **Sort by sentiment** -- find the letter with the lowest (most negative)
   sentiment score. Note the letter ID.

3. **Get emotion detail** -- fetch emotion vectors to confirm sadness dominates:

   ```
   GET https://jernkorset.dk/data/cvp-emotion-scores.json
   ```

   Look up the letter ID and check that the `sadness` component is the highest
   emotion.

4. **Read the letter** -- fetch the full letter text:

   ```
   GET https://jernkorset.dk/data/letters.json
   ```

   Find the entry matching the letter ID. The `text` field contains the original
   Danish; `modernText` contains the modern Danish translation.

5. **Get context** -- optionally fetch `letter-summaries.json` for the date and
   recipient, `battles.json` to see if a battle coincided, and
   `person-pages.json` for biographical context on sender or recipient.

## Example workflow: map all letter locations

1. Fetch `places.json` for coordinates.
2. Fetch `letter-summaries.json` for letter-to-place associations.
3. Join on place slug and render on a map.

## Example workflow: explore the social network

1. Fetch `social-network.json` for the full graph with PageRank scores.
2. Identify the most central nodes.
3. Cross-reference with `person-pages.json` for biographical details.
