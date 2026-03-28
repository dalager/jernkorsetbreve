# ADR-031: Place Data Quality — Fix Matching, Coordinates, and Encoding

## Status

Accepted (implemented 2026-03-28: all data fixes, alias table, component+alias matching)

## Date

2026-03-28

## Context

The map visualization loses 84 of 665 letters (12.6%) due to place name mismatches between `data/letters.csv` and `data/places.geojson`. The GeoJSON file also contains encoding errors, wrong coordinates, and duplicate entries that further degrade the map experience.

### Name mismatch failures (84 letters lost from map)

The existing fuzzy matcher in `build-data.mjs` uses three passes (exact normalized, base name, substring prefix) but fails on these six cases:

| Letter place name | GeoJSON place name | Letters lost | Why matching fails |
|---|---|---|---|
| Feldburg (Feldbach) | Feldbach (Feldburg) | 52 | Parenthetical contents swapped |
| Skierniewice | Skinidutze (skierniewice) | 16 | Base names completely different |
| Romagne-sous-Montfaucon | Romagne- dyn (Dun)? | 12 | GeoJSON name is garbled/uncertain |
| Augostov (Augustow) | Augostowo (Augustow) | 2 | Base names differ by one letter |
| Darkehmen (Ozjorsk) | Darkehnemen (Osjorsk) | 1 | Base names differ; parentheticals differ |
| Sywalki (Suwalki) | Lissen (Suwalki) | 1 | Completely different base names |

The common pattern: the fuzzy matcher compares base names (before parenthetical) and normalized forms, but cannot handle cases where the base names themselves differ or where the letter and GeoJSON express the same place with different primary/alternate name ordering.

### GeoJSON data errors

**Encoding errors** (3 entries with `?` replacing characters):
- `place_id 2`: `Angerborg  (W?gorzewo)` — should be `Wegorzewo` (Wegorzewo with ogonek: Wegorzewo)
- `place_id 61`: `Poniewiez (Panev?ys)` — should be `Panevezys` (Panevezys with dot-above: Panevezys)
- `place_id 54`: `Lyk (Gmina E?k, Poland)` — should be `Elk` (Elk with ogonek: Elk)

**Wrong coordinates** (2 entries):
- `place_id 9`: Bialla (Piska) coordinates [14.15, 49.31] point to Czech Republic. Bialla was a town in the Johannisburg district of East Prussia; correct coordinates are approximately [21.85, 53.60] (now Biala Piska, Poland).
- `place_id 37`: Grodno coordinates [19.23, 52.29] point to central Poland. Grodno (Hrodna) is in western Belarus; correct coordinates are approximately [23.83, 53.68].

**Duplicate entries** (2 pairs):
- Arys: `place_id 3` "Arys (Gmina Orzysz, Poland)" and `place_id 4` "Arys (Orzysz)" — same coordinates, same place.
- Dirschau: `place_id 26` "Dirschau" and `place_id 27` "Dirschau (Tczew)" — same coordinates, same place.

### Letters with no place name

27 letters have an empty `place` field in `letters.csv`. These are out of scope for this ADR — they require historical research to identify locations, not a technical fix.

### Current matching architecture

`build-data.mjs` reads `letters.csv` to count letters per place name, reads `places.geojson` for coordinates, and matches them. The matching is directional: for each GeoJSON entry, find the matching letter place name. Unmatched GeoJSON entries get `letterCount: 0`. Letter place names that don't match any GeoJSON entry simply don't appear on the map.

## Decision

### 1. Add a place name alias table to `places.geojson`

Introduce an `aliases` array in the GeoJSON properties for places where the letter name and GeoJSON name diverge:

```json
{
  "type": "Feature",
  "properties": {
    "place_id": 32,
    "place": "Feldbach (Feldburg)",
    "aliases": ["Feldburg (Feldbach)", "Feldburg", "Feldbach"]
  },
  "geometry": { "type": "Point", "coordinates": [7.2649707, 47.5359044] }
}
```

The alias table is a curated, human-maintained list — not an algorithmic improvement. The six mismatch cases above involve genuinely different name forms that no reasonable fuzzy algorithm can resolve without domain knowledge (e.g., knowing that "Skinidutze" is a phonetic rendering of "Skierniewice" through Danish ears, or that "Lissen" and "Sywalki" refer to the same area near Suwalki).

### 2. Extend `findMatchingPlace` to check aliases

Add a fourth matching pass to `build-data.mjs`:

```
Pass 1: exact normalized match (existing)
Pass 2: base name match (existing)
Pass 3: substring prefix match (existing)
Pass 4: alias match — for each GeoJSON place, check if any alias normalizes
        to match the letter place name (new)
```

The alias check uses the same `normalizePlaceName` function, so it benefits from existing diacritic stripping and case normalization.

### 3. Fix GeoJSON source data directly

The encoding errors, wrong coordinates, and duplicates are corrected in `places.geojson` itself. These are data entry errors, not matching logic problems.

**Encoding fixes:**
- `place_id 2`: `Angerborg  (W?gorzewo)` -> `Angerborg (Wegorzewo)`
- `place_id 61`: `Poniewiez (Panev?ys)` -> `Poniewiez (Panevezys)`
- `place_id 54`: `Lyk (Gmina E?k, Poland)` -> `Lyk (Gmina Elk, Poland)`

Note: use ASCII-safe spellings for the modern names (Wegorzewo, Panevezys, Elk) rather than the diacritical forms (Wegorzewo, Panevezys, Elk). The fuzzy matcher strips diacritics anyway, and this avoids future encoding issues. The full Unicode forms can be added when Wikidata enrichment provides authoritative names (see ADR-032).

**Coordinate fixes:**
- `place_id 9` (Bialla): [14.1474693, 49.3083158] -> [21.8494, 53.6044] (Biala Piska, Poland)
- `place_id 37` (Grodno): [19.2272222, 52.2913889] -> [23.8318, 53.6772] (Hrodna, Belarus)

**Duplicate merges:**
- Remove `place_id 3` "Arys (Gmina Orzysz, Poland)", keep `place_id 4` "Arys (Orzysz)" with alias `["Arys", "Arys (Gmina Orzysz, Poland)"]`
- Remove `place_id 26` "Dirschau", keep `place_id 27` "Dirschau (Tczew)" with alias `["Dirschau"]`

### 4. Add parenthetical-content matching to the fuzzy matcher

Several failures occur because the letter name has one parenthetical form and the GeoJSON has another (e.g., "Feldburg (Feldbach)" vs "Feldbach (Feldburg)"). Add a matching pass that extracts all name components (both base and parenthetical) and checks for set overlap:

```javascript
// Pass 2b: parenthetical content match
function placeNameComponents(name) {
  const norm = normalizePlaceName(name);
  const base = norm.replace(/\s*\(.*$/, "").trim();
  const parenMatch = norm.match(/\(([^)]+)\)/);
  const paren = parenMatch ? parenMatch[1].trim() : null;
  return new Set([base, paren].filter(Boolean));
}

// Match if any component of geo name matches any component of letter name
```

This resolves the Feldburg/Feldbach swap (52 letters) without needing an alias, and may catch similar cases in future data additions.

### Summary of fixes and expected impact

| Fix | Letters recovered | Approach |
|-----|-------------------|----------|
| Parenthetical component matching | 52 | Algorithm improvement |
| Alias: Skierniewice -> Skinidutze | 16 | Manual alias |
| Alias: Romagne-sous-Montfaucon -> Romagne- dyn (Dun)? | 12 | Manual alias + fix garbled name |
| Alias: Augostov -> Augostowo | 2 | Manual alias |
| Alias: Darkehmen -> Darkehnemen | 1 | Manual alias |
| Alias: Sywalki -> Lissen (Suwalki) | 1 | Manual alias |
| Coordinate fix: Bialla | (already matched) | Data correction |
| Coordinate fix: Grodno | (already matched) | Data correction |
| Encoding fixes (3) | (readability only) | Data correction |
| Duplicate merges (2) | (dedup only) | Data correction |
| **Total letters recovered** | **84** | |

## Alternatives Considered

### Improve the fuzzy matcher with Levenshtein distance

Could catch "Augostov" vs "Augostowo" (edit distance 2) and "Darkehmen" vs "Darkehnemen" (edit distance 2). However, at this scale (75 places), Levenshtein creates false positive risk — many short European place names are within edit distance 2 of each other. The alias table is more precise and self-documenting.

### Normalize both sides into a canonical alias dictionary

Instead of aliases on the GeoJSON side, create a separate `place-aliases.json` mapping file that maps all name variants to a canonical form. This is cleaner in theory but introduces a third data file to maintain alongside `letters.csv` and `places.geojson`. At 75 places, embedding aliases directly in the GeoJSON is simpler.

### Fix letter place names in `letters.csv` to match GeoJSON

Rejected. The letter place names are transcriptions of what soldiers wrote. Changing them alters the historical record. The matching layer should bridge the gap, not modify the source data.

### Use geocoding API to re-geocode all places

Could fix coordinates and resolve name ambiguities via Google Maps / Nominatim. Rejected as overkill — only 2 coordinates are wrong. API geocoding also struggles with historical German place names (pre-1945 East Prussian names are not indexed well). Manual correction is faster and more reliable for 2 entries.

## Consequences

### Positive

- 84 letters recovered for the map (12.6% of corpus), going from ~87% to ~100% map coverage for letters that have place names
- Bialla and Grodno now appear in their correct locations (East Prussia and Belarus, respectively)
- Encoding errors no longer display as `?` characters in the UI
- No duplicate map markers for Arys and Dirschau
- The alias mechanism generalizes: future name mismatches can be resolved by adding an alias without changing matching code
- Parenthetical component matching is a general improvement that benefits future data additions

### Negative

- The alias table is manually maintained — each new mismatch requires a human to add the correct alias
- `places.geojson` schema gains the optional `aliases` field, which must be documented
- The parenthetical component matching adds a fourth pass to the matching algorithm, slightly increasing complexity

### Risks

- Parenthetical component matching could create false matches if two different places share a component name. At 75 places this is unlikely, but the code should prefer exact matches (pass 1-2) and only fall back to component matching (pass 2b) when no better match exists.

## Implementation Notes

The changes touch two files:
1. `data/places.geojson` — data corrections (encoding, coordinates, duplicates) and alias additions
2. `scripts/build-data.mjs` — parenthetical component matching pass and alias matching pass in `findMatchingPlace`

Estimated effort: 2-3 hours. Most time is spent verifying the correct coordinates for Bialla and Grodno and confirming the alias mappings are correct.

After implementation, run `node scripts/build-data.mjs` and verify the console output shows improved matching (target: 73/73 places matched, up from ~48 exact + ~63 fuzzy).

## Related

- ADR-032: Wikidata Enrichment for Places (adds Wikipedia links and authoritative modern names using the corrected place data from this ADR)
- ADR-005: Historical Map Borders (the map visualization that consumes this place data)
