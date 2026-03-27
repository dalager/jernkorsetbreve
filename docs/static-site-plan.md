# Static Site with Client-Side Semantic Search — Implementation Plan

## Goal

Transform the jernkorsetbreve letter collection into a fully static site with client-side semantic search, delivering features normally requiring a frontend+backend+database stack — entirely without a server at runtime.

## Architecture

```
Build Time:                              Runtime (Browser):

data/letters.csv ──┐
data/places.geojson ┼─→ build-data.mjs ─→ public/data/*.json
data/sentiment_*.csv┘
                                         Load embeddings.bin (998 KB, cached)
search-corpus.json ─→ generate-embeddings.mjs
                         │                Load gte-small model (33 MB, cached)
                         ├─→ embeddings.bin
                         ├─→ embedding-index.json      User types query
                         ├─→ embedding-meta.json             │
                         └─→ related-letters.json      Embed query (~100ms)
                                                             │
Next.js static export ─→ 675 HTML pages             Cosine similarity (~5ms)
                                                             │
                                                        Ranked results
```

**Base**: `apps/website/` — Next.js 15 with `output: "export"`
**Search Model**: `Xenova/gte-small` (384 dimensions, multilingual, supports Danish)
**Hosting Target**: GitHub Pages

## Data Pipeline

### Source Data
| File | Contents |
|------|----------|
| `data/letters.csv` / `webapp/data/letters.csv` | 665 letters (id, date, sender, recipient, place, location, text) |
| `data/places.geojson` | 75 places with coordinates (FeatureCollection) |
| `data/sentiment_scored_letters.csv` | Sentiment scores per letter |
| `data/NER_entities.csv` | Named entity recognition data |
| `historical_data/Battles_WW1.csv` | WWI battle data for timeline annotations |

### Generated Static Data (`apps/website/public/data/`)
| File | Size | Purpose |
|------|------|---------|
| `letters.json` | 1,271 KB | Full letter data, text as HTML `<p>` tags |
| `letter-summaries.json` | 92 KB | Lightweight list (no text field) |
| `places.json` | 8 KB | 75 places with lat/lng and letterCount |
| `search-corpus.json` | 1,114 KB | Plain text per letter for embedding |
| `letter-sentiments.json` | 8 KB | {id: score} sentiment map |
| `search-snippets.json` | 143 KB | First 200 chars per letter for search results |
| `embeddings.bin` | 998 KB | Binary Float32 vectors (665 x 384 dims) |
| `embedding-index.json` | 18 KB | Letter ID mapping + byte offsets |
| `embedding-meta.json` | 234 B | Model name + content hash for caching |
| `related-letters.json` | 178 KB | Pre-computed top-5 similar letters per letter |

## Embedding Pipeline

### Smart Caching
- `embedding-meta.json` stores: model name, SHA-256 hash of search-corpus.json, timestamp
- On run: compares current model + content hash against stored values
- If both match and all output files exist: **skip** ("Embeddings up to date, skipping")
- If model changed or `--force` flag: **full regeneration**

### Reindexing
```bash
npm run data:embed      # Uses cache — skips if unchanged
npm run data:reindex    # Forces full regeneration (e.g., after model change)
```

### Performance
- First run (model download): ~2m 25s
- Subsequent runs (model cached): ~30s
- Embedding rate: ~22-31 letters/second
- Cache check (no-op): instant

## npm Scripts

```json
{
  "data:build": "node scripts/build-data.mjs",
  "data:embed": "node scripts/generate-embeddings.mjs",
  "data:reindex": "node scripts/generate-embeddings.mjs --force",
  "data:all": "npm run data:build && npm run data:embed",
  "dev": "cd apps/website && npm run dev",
  "build": "npm run data:all && cd apps/website && npm run build",
  "preview": "npx serve apps/website/out"
}
```

## Pages & Features

| Route | Type | Description |
|-------|------|-------------|
| `/` | Server (SSG) | Letter list with client-side filtering (sender, recipient, place), pagination (25/page) |
| `/letters/[id]/` | Server (SSG) | 665 pre-rendered letter detail pages with prev/next navigation, related letters |
| `/search/` | Client | Semantic search — loads pre-computed embeddings, embeds only query at runtime (~100ms) |
| `/timeline/` | Client | Interactive SVG timeline (1911-1918), sentiment coloring, WWI event annotations |
| `/map/` | Client | Leaflet + OpenStreetMap, 73 places with proportional markers, sidebar, popups |
| `/statistics/` | Client | Dashboard: letters per year/month, top senders/recipients, sentiment trends |
| `/about/` | Server | Project history, technical explanation, credits |

### Client-Side Search UX
- Example query pills (Danish): "breve om kaerlighed", "krigen i Frankrig", "julen 1917"
- Performance dashboard: model load time, search latency
- SearchBox in header with live dropdown (top 5 results)
- Progressive enhancement: search page works without embeddings (graceful degradation)

## Static Output

```
apps/website/out/
  index.html                     (letter list)
  search/index.html              (semantic search)
  timeline/index.html            (interactive timeline)
  map/index.html                 (Leaflet map)
  statistics/index.html          (dashboard)
  about/index.html               (project info)
  letters/
    1/index.html ... 665/index.html  (pre-rendered letter pages)
  data/
    letters.json, embeddings.bin, places.json, ...
  _next/                         (JS/CSS bundles, ~103 KB shared)
```

Total: **675 static HTML pages** + data files

## CI/CD

### GitHub Actions Workflows
- `.github/workflows/deploy-static.yml` — Build + deploy to GitHub Pages on push to master
  - Caches: embeddings.bin (keyed by corpus hash + model), HuggingFace model files
- `.github/workflows/test-static.yml` — E2E tests on PRs and pushes

### E2E Tests
- `tests/e2e-static/` — 28 Playwright tests
- Covers: letter list, letter detail, navigation, search, responsive viewports, performance thresholds

## Theme

Parchment theme ported from `webapp/frontend/`:
- Colors: parchment, cream, ink, faded, wax-red
- Fonts: display, body, ui families
- Iron Cross logo in navigation header
- Danish language (`lang="da"`)

## Key Dependencies

| Package | Purpose | Where |
|---------|---------|-------|
| `@huggingface/transformers` | Embedding generation (build-time, Node.js) | Root |
| `onnxruntime-node` | ONNX runtime for Node.js embeddings | Root |
| `leaflet` + `react-leaflet` | Interactive map | apps/website |
| `@playwright/test` | E2E testing | tests/e2e-static |

## Design Decisions

1. **Next.js over Vite**: Already had `output: "export"` + `generateStaticParams` for pre-rendering 665 pages
2. **Binary embeddings**: Float32 ArrayBuffer (998 KB) vs JSON arrays (~3 MB) — 3x smaller, instant parsing
3. **CDN for Transformers.js**: Not bundled (~33 MB) — loaded from CDN at runtime, browser-cached
4. **Pre-computed related letters**: Avoids needing search engine on detail pages
5. **No modernize feature**: Requires Anthropic API — removed for pure static deployment
6. **Leaflet.js**: No API key needed, free OpenStreetMap tiles
