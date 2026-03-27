# ADR-008: Historical Borders — Build Pipeline Integration

## Status
Accepted

## Context
The border processing script (ADR-005) produces two JSON files that must exist in `apps/website/public/data/` before the Next.js build. This mirrors the existing pattern where `build-data.mjs`, `generate-embeddings.mjs`, and `generate-battle-data.mjs` all produce files in the same directory.

The current data pipeline (from `package.json` in the repo root):
```
data:build    → build-data.mjs        (letters, summaries, places, corpus)
data:battles  → generate-battle-data.mjs  (battle correlation data)
data:embed    → generate-embeddings.mjs   (search embeddings)
data:clusters → generate-clusters.mjs     (topic clusters)
data:all      → data:build && data:battles && data:embed && data:clusters
build         → data:all && cd apps/website && npm run build
```

## Decision

### New script: `scripts/build-historical-borders.mjs`

A standalone Node.js script with **zero npm dependencies**. The Douglas-Peucker simplification algorithm is implemented inline (~40 lines). The script:

1. Reads `maps/1914/1914.geojson` and `maps/1914/1918.geojson` from the repo
2. Filters features to the European bounding box
3. Simplifies geometry and reduces precision
4. Adds Danish name translations
5. Writes `borders-1914.json` and `borders-1918.json` to `apps/website/public/data/`

### Pipeline integration

Add to `package.json`:
```json
"data:borders": "node scripts/build-historical-borders.mjs"
```

Update `data:all` to include it:
```json
"data:all": "npm run data:build && npm run data:battles && npm run data:embed && npm run data:clusters && npm run data:borders"
```

The order doesn't matter (borders are independent of other data), but placing it last avoids any confusion about dependencies.

### Generated files: committed to git

Like all other files in `apps/website/public/data/`, the generated border files are committed to git. This is consistent with the existing approach (embeddings.bin, battles.json, etc. are all committed) and avoids requiring CI to run the data pipeline.

The generated files are expected to be ~500 KB each. They change only when:
- The source GeoJSON files change (unlikely — they are historical reference data)
- The simplification parameters change (rare, only during development)

### No caching/hash mechanism

Unlike `generate-embeddings.mjs` (which uses a content hash to skip regeneration), the border script does not need caching. It runs in under 2 seconds and the source data is static. A `--force` flag is unnecessary.

### Douglas-Peucker: inline implementation

Rather than adding a dependency like `simplify-js` or `@turf/simplify`, the algorithm is implemented inline. Reasons:
- The algorithm is 40 lines of well-known geometry code
- It avoids adding a dependency for a build-time-only operation
- The project already follows this pattern (e.g., `timeline-utils.ts` implements its own rolling average rather than importing a statistics library)

The implementation operates on coordinate arrays `[lng, lat][]` and returns simplified arrays. It handles both `Polygon` and `MultiPolygon` geometry types by recursing into each ring.

## Consequences

- One new script file, one new npm script, one edit to `data:all`
- Two new committed JSON files (~500 KB each)
- No new npm dependencies
- Build pipeline remains fully offline (no network access needed)
- Developers must run `npm run data:borders` (or `npm run data:all`) after cloning to generate the border files, same as all other data files
