# ADR-005: Historical Map Borders — Data Source and Processing Strategy

## Status
Accepted

## Context
Issue #6 requests overlaying historical borders (1914/1918) on the Leaflet map page. The `maps/` directory contains GeoJSON border data from U-Spatial (University of Minnesota):

| File | Features | Size | Coverage | Names |
|------|----------|------|----------|-------|
| `1914/1914.geojson` | 202 | 13.7 MB | World | English (e.g. "Austria - Hungary") |
| `1914/1918.geojson` | 203 | 13.8 MB | World | English |
| `1914/1914_dk.geojson` | 24 | 3.8 MB | Europe subset | Danish, but **11 of 24 are null** |

The letter places span lat 47.5–56.0, lng 3.0–26.5 (northern France through Denmark to Latvia). The map page defaults to center [54.5, 12] at zoom 5, showing roughly lat 40–65, lng -10 to 35.

### Problem: Danish subset is unusable as-is

`1914_dk.geojson` initially seems attractive (smaller, Danish names) but has critical gaps:
- 11 of 24 features have `NAME: null` — including Denmark, Germany, France, Austria-Hungary, and the United Kingdom (all core countries for this letter collection)
- Missing countries: Albania, Greece, Portugal, Ottoman Empire
- Still 3.8 MB (no geometry simplification applied)
- Only covers 1914, no 1918 equivalent

### Problem: Full files are too large for browser delivery

At ~14 MB each, the world GeoJSON files cannot be served to the browser. They contain ~393,000 coordinate points each, with 13-decimal precision (sub-nanometer accuracy, absurdly excessive for country borders).

The European subset is roughly 45 features with ~135,000–162,000 coordinate points.

## Decision

**Process the full world files (`1914.geojson` and `1918.geojson`) at build time**, producing optimized European-only outputs. Specifically:

1. **Filter to Europe**: Bounding box lat 34–72, lng -25 to 45. This captures all relevant countries plus enough context (Iberia, Scandinavia, Turkey) for the user to orient themselves. The 45 European features in each file cover all countries relevant to the WW1 letter collection.

2. **Simplify geometry**: Douglas-Peucker algorithm with tolerance 0.01 degrees (~1.1 km at these latitudes). This removes points that contribute less than 1 km of detail — invisible at the zoom levels used (zoom 4–8, where 1 pixel ≈ 2–40 km). Expected point reduction: 60–80%.

3. **Reduce coordinate precision**: Truncate to 5 decimal places (~1.1 m accuracy). The source data has 13 decimals, wasting ~8 characters per coordinate pair.

4. **Add Danish names**: A hardcoded EN→DA translation table for the ~30 relevant European countries. This covers the display need without depending on the broken `1914_dk.geojson`.

5. **Minimize properties**: Strip `OBJECTID`, `OBJECTID_12`, keep only `NAME` (English) and `NAME_DA` (Danish).

### Estimated output size

| Step | Points | Size estimate |
|------|--------|---------------|
| Full world file | ~393,000 | 13.7 MB |
| Europe filter | ~162,000 | ~5.5 MB |
| Douglas-Peucker (0.01°) | ~40,000 | ~1.4 MB |
| Precision reduction (5 dec) | ~40,000 | ~800 KB |
| Property minimization | ~40,000 | ~500 KB |

Target: **under 500 KB per file**. If larger, increase tolerance to 0.02° or tighten the bounding box to lat 44–60, lng -5 to 30 (which still covers all letter places with margin).

### Implementation: `scripts/build-historical-borders.mjs`

A Node.js script with zero npm dependencies. The Douglas-Peucker algorithm is ~40 lines of JS. The script:
- Reads `maps/1914/1914.geojson` and `maps/1914/1918.geojson`
- Applies the pipeline above
- Writes `webapp/public-site/public/data/borders-1914.json` and `borders-1918.json`
- Integrated into the build chain via `npm run data:borders`

### 1914 vs 1918: what changed

The two years show meaningful border differences relevant to WW1 context:
- Ottoman Empire dissolution
- New states emerging in Eastern Europe
- Colonial territory transfers
- Alsace-Lorraine changing from Germany to France

Having both years with a toggle provides historical context for how the war reshaped the political map.

## Consequences

- Build-time dependency on `maps/1914/*.geojson` source files (already in repo)
- Two new generated files (~500 KB each) committed to `webapp/public-site/public/data/`
- The simplified geometry is visually accurate at zoom 4–8 but will show angular artifacts at zoom 10+. This is acceptable — the borders are contextual, not authoritative cartography.
- U-Spatial attribution must be displayed when borders are visible (license requirement)

## Alternatives Considered

**Use `1914_dk.geojson` directly**: Rejected. Too many null names, missing countries, no 1918 equivalent, still too large.

**Use an external tile service for historical maps (e.g., MapWarper, David Rumsey)**: Rejected. Adds external dependency, georeferencing quality varies, tiles may be slow or unavailable, and the aesthetic wouldn't match the CARTO light basemap.

**Use Mapbox/vector tiles**: Rejected. Would require a tile generation pipeline (tippecanoe) and a tile hosting service. Overkill for 45 polygons.
