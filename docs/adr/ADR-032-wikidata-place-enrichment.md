# ADR-032: Wikidata Enrichment for Places

## Status

Proposed

## Date

2026-03-28

## Context

The project's 75 places (after deduplication in ADR-031: 73) have coordinates and letter counts but no links to external knowledge. Meanwhile, `battles.json` already includes Wikipedia URLs for each battle — users can click through to learn about the Battle of Tannenberg or the Battle of Mons. No equivalent exists for places, even though many of these locations have rich WW1 history.

### What Wikidata can provide

For a place like "Königsberg (Kaliningrad)", a single Wikidata SPARQL query yields:

| Property | Value | Use |
|----------|-------|-----|
| Wikipedia URL | `https://en.wikipedia.org/wiki/Kaliningrad` | Link from map popup |
| Wikidata QID | Q1829 | Stable identifier for future lookups |
| Modern name | Kaliningrad | Display alongside historical name |
| Country | Russia | Context for modern geography |
| Population (1910) | 245,994 | Historical context |
| Image | Wikimedia Commons URL | Visual enrichment |
| Coordinate | 54.7104, 20.4522 | Cross-validation of our coordinates |

### Existing infrastructure

The project already has a working Wikidata pipeline:

- `scripts/wikidata_client.py` — SPARQL wrapper with `query_to_dataframe()` method, polite user-agent
- `scripts/wikidata_battle_mapper.py` — maps Wikidata results to GeoDataFrame
- `notebooks/15_wikidata_with_sparql.ipynb` — successfully queried 100 WW1 battles from Wikidata
- `apps/website/public/data/battles.json` — 19 battles already have `"wikipedia": "https://en.wikipedia.org/wiki/..."` fields

The pattern is proven. The question is how to adapt it for places.

### Place name complexity

Matching our 73 places to Wikidata is harder than matching battles because:

1. **Renamed places**: 20+ East Prussian towns were renamed after 1945 (German -> Polish/Russian). Our GeoJSON uses the German name with the modern name in parentheses: "Königsberg (Kaliningrad, Kaliningrad Oblast, Russia)". Wikidata indexes the modern name.
2. **Small villages**: Some French/Belgian front-line villages (Vauxcere, Vauxtin, Dravegny) may not have Wikidata entries at all.
3. **Ambiguity**: "Frankfurt" could be Frankfurt am Main or Frankfurt an der Oder. "Halle" could be Halle (Saale) or Halle (Westfalen). Our coordinates disambiguate.
4. **Uncertainty markers**: Names like "Pannes (lidt usikkert, om det er den rigtige)" contain Danish commentary meaning "a bit uncertain if this is the right one."

### Coordinate-based matching as primary strategy

Rather than name matching (fragile for multilingual historical names), Wikidata supports geographic queries: "find the settlement nearest to coordinates [lat, lng]." This sidesteps the naming problem entirely. For the 2 places with corrected coordinates (ADR-031: Bialla, Grodno), this requires the corrections from ADR-031 to be applied first.

## Decision

### 1. Create a Python script for Wikidata place enrichment

Create `scripts/enrich-places-wikidata.py` using the existing `WikiDataClient` class. The script:

1. Reads `data/places.geojson` (corrected per ADR-031)
2. For each place, queries Wikidata using a coordinate-based SPARQL query with a radius search
3. Selects the best match from results (nearest settlement)
4. Writes enriched data to `data/places-enriched.json`

### 2. Use coordinate-based SPARQL queries with name verification

The primary matching strategy is geographic proximity with name cross-check:

```sparql
SELECT ?place ?placeLabel ?coord ?article ?population ?image WHERE {
  SERVICE wikibase:around {
    ?place wdt:P625 ?coord .
    bd:serviceParam wikibase:center "Point(LNG LAT)"^^geo:wktLiteral .
    bd:serviceParam wikibase:radius "5" .  # 5 km radius
  }
  ?place wdt:P31/wdt:P279* wd:Q486972 .  # instance of human settlement
  OPTIONAL { ?article schema:about ?place ; schema:isPartOf <https://en.wikipedia.org/> . }
  OPTIONAL { ?place wdt:P1082 ?population . }
  OPTIONAL { ?place wdt:P18 ?image . }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en,de,da,pl,ru,lt,fr" . }
}
ORDER BY ASC(?dist)
LIMIT 5
```

For each GeoJSON place:
- Query Wikidata for settlements within 5 km of the coordinates
- If exactly one result, accept it
- If multiple results, prefer the one whose label matches our place name (using the existing `normalizePlaceName` logic or simple substring matching)
- If no results, widen radius to 15 km and retry
- If still no results, mark as "unmatched" for manual review

### 3. Output enriched data as a separate file

Write `data/places-enriched.json` rather than modifying `places.geojson`. This keeps the GeoJSON as the manually-curated source of truth and the enrichment as a derived artifact.

```json
{
  "Königsberg (Kaliningrad, Kaliningrad Oblast, Russia)": {
    "wikidata_id": "Q1829",
    "wikipedia_url": "https://en.wikipedia.org/wiki/Kaliningrad",
    "modern_name": "Kaliningrad",
    "country": "Russia",
    "image_url": "https://commons.wikimedia.org/wiki/...",
    "match_method": "coordinate_5km",
    "match_distance_km": 0.3
  }
}
```

### 4. Integrate into `build-data.mjs` output

Extend the `places.json` output to include `wikipedia` and `wikidata_id` fields, mirroring the pattern already used in `battles.json`:

```json
{
  "name": "Königsberg (Kaliningrad, Kaliningrad Oblast, Russia)",
  "lat": 54.7115951,
  "lng": 20.5099722,
  "letterCount": 3,
  "wikipedia": "https://en.wikipedia.org/wiki/Kaliningrad",
  "wikidata_id": "Q1829"
}
```

The website frontend can then render Wikipedia links in map popups, consistent with how battle popups already work.

### 5. Manual review for unmatched and ambiguous places

The script produces a review log listing:
- **Unmatched**: places with no Wikidata result within 15 km (expected for some tiny French villages)
- **Ambiguous**: places with multiple candidates where no name match was found
- **Low confidence**: places where the nearest settlement name does not resemble our place name

These are reviewed once and the correct Wikidata QIDs are added to `places-enriched.json` manually. The script supports a `--manual-overrides` flag pointing to a JSON file with pre-assigned QIDs that skip the SPARQL lookup.

### 6. Rate limiting and caching

Wikidata's query service has usage limits (no hard rate limit, but aggressive querying gets throttled). The script:
- Waits 1 second between queries (73 queries = ~75 seconds total)
- Caches results in `data/.cache/wikidata-places/` keyed by `place_id`
- Supports `--force` to re-query all, otherwise skips cached entries
- Uses the existing polite user-agent from `WikiDataClient`

## Alternatives Considered

### Name-based SPARQL queries instead of coordinate-based

Query Wikidata by place label (e.g., `?place rdfs:label "Königsberg"@de`). Rejected as primary strategy because:
- Many of our names are Danish phonetic renderings of German names, not standard German spellings
- Parenthetical commentary ("eller der omkring", "lidt usikkert") would need stripping
- Ambiguous names (Frankfurt, Halle) require disambiguation anyway
- Coordinates are unambiguous and already available

Name matching is used as a secondary verification step, not the primary lookup.

### Enrich `places.geojson` directly

Add Wikidata fields to the GeoJSON properties. Rejected because:
- `places.geojson` is a manually-curated file (human-entered coordinates and names)
- Mixing manual and automated data in one file makes it unclear what can be regenerated
- A separate enrichment file can be regenerated independently when Wikidata data improves

### Use Wikipedia API instead of Wikidata SPARQL

Wikipedia's geosearch API (`action=query&list=geosearch&gscoord=LAT|LNG&gsradius=5000`) could find nearby articles. However, Wikidata SPARQL provides structured data (QID, modern name, country, population, image) in a single query, while Wikipedia API only returns article titles. The existing `WikiDataClient` already wraps SPARQL. No reason to add a second API client.

### Skip enrichment, just add Wikipedia URLs manually

At 73 places, manually looking up Wikipedia URLs would take 2-3 hours. However, manual lookup misses structured data (QID, modern name, country) and doesn't scale if places are added. The script takes similar effort to write but produces richer data and is repeatable.

### Use OpenStreetMap Nominatim for geocoding verification

Nominatim could cross-check our coordinates against its database. Useful but orthogonal — coordinate verification is handled by the Wikidata coordinate cross-check (compare our coordinates with Wikidata's `P625` property). No need for a third data source.

## Consequences

### Positive

- Wikipedia links for places, matching the existing pattern in `battles.json`
- Modern place names from Wikidata provide context for renamed East Prussian towns
- Wikidata QIDs serve as stable identifiers for future integrations
- Coordinate cross-validation: comparing our manually-entered coordinates with Wikidata's can surface additional errors beyond the 2 already identified
- The enrichment script reuses the existing `WikiDataClient` infrastructure
- Cached results mean the script runs quickly after first execution

### Negative

- Depends on Wikidata query service availability (mitigated by caching)
- Some small villages will not have Wikidata entries, creating gaps in coverage (expected: 5-10 places unmatched)
- Adds a Python script to the build pipeline (but Python is already required for sentiment)
- Manual review step required for ambiguous matches (one-time effort)

### Risks

- **Wikidata query service downtime**: The script caches all results. After the first successful run, it can operate offline. New places added to the GeoJSON would need connectivity.
- **Wrong Wikidata match**: A coordinate query might match a nearby but wrong settlement (e.g., a suburb instead of the city center). The name verification step and match distance logging mitigate this. The manual review step catches remaining errors.
- **Wikidata data quality**: Wikipedia URLs or modern names might be incorrect in Wikidata itself. This is a risk shared with the battles pipeline and is mitigated by the manual review step.

## Implementation Notes

### Dependencies

The script uses `scripts/wikidata_client.py` (existing) and `pandas` (already a project dependency). No new Python packages needed.

### Pipeline integration

Add to `package.json`:
```json
"data:enrich-places": "python scripts/enrich-places-wikidata.py"
```

This step runs after `places.geojson` corrections (ADR-031) and before `build-data.mjs`. In the Makefile (ADR-028):

```makefile
data/places-enriched.json: data/places.geojson scripts/enrich-places-wikidata.py
	python scripts/enrich-places-wikidata.py
```

### Estimated effort

- Script development: 3-4 hours (SPARQL query construction, coordinate matching, caching, output format)
- Manual review of unmatched/ambiguous places: 1-2 hours (one-time)
- `build-data.mjs` integration: 30 minutes (read `places-enriched.json`, merge into `places.json` output)
- Total: 5-7 hours

### Expected coverage

Based on the current 73 places (post ADR-031 deduplication):
- ~50-55 places: automatic match via coordinate query (major towns, East Prussian cities, well-known French towns)
- ~10-15 places: match after widening radius or manual QID override (small villages, renamed hamlets)
- ~5-8 places: no Wikidata entry (tiny front-line positions, uncertain identifications)

## Related

- ADR-031: Place Data Quality (prerequisite — corrected coordinates and deduplicated entries)
- ADR-005: Historical Map Borders (the map visualization consuming this data)
- ADR-008: Historical Borders Build Pipeline (build pipeline patterns)
