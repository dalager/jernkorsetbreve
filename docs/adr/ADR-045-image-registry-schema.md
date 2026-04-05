# ADR-045: Image Registry Schema Design

## Status

Accepted (2026-04-05)

## Date

2026-04-04

## Context

The PDF presentation by Else Gad Maersk (`docs/background/Powerpoint_presentation_about_letters.pdf`) was processed to extract 165 unique images: 32 portraits, 15 group photos, 43 place photos, 20 maps, 15 documents, 6 historical, 33 military scenes.

These images are currently described in `data/images/pdf-presentation/manifest.json` — a working file with presentation-specific metadata (page number, xref, raw page text). The person registry (`data/person-registry.json`) has `photos` arrays on 13 enriched persons. The `place-photo-links.json` maps 14 places to their photos with geojson keys.

We need a **canonical image registry** that:
1. Can be consumed by the frontend and API
2. Links to persons, places, and (via ADR-046) letters
3. Is independent of the PDF extraction tooling
4. Supports future image sources beyond this one presentation

## Decision

### File: `data/image-registry.json`

A flat JSON array, one entry per image:

```json
{
  "id": "img_page001_02",
  "filename": "page001_02.png",
  "path": "portrait/page001_02.png",
  "category": "portrait",
  "persons": ["peter"],
  "places": ["oester_aabolling"],
  "date_estimate": "1892",
  "date_sort": "1892-01-01",
  "description": "Peter Maersk as young boy",
  "source": "else_gad_maersk_presentation",
  "width": 676,
  "height": 990,
  "size_bytes": 972110
}
```

### Field definitions

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | yes | Stable identifier. Format: `img_{filestem}`. Prefixed to avoid collision with letter/person IDs. |
| `filename` | string | yes | File name (e.g., `page001_02.png`) |
| `path` | string | yes | Relative path within `data/images/pdf-presentation/` including category subfolder |
| `category` | enum | yes | One of: `portrait`, `group`, `place`, `map`, `document`, `historical`, `military` |
| `persons` | string[] | yes | Array of person-registry IDs. Empty array if no persons identified. |
| `places` | string[] | yes | Array of place keys (matching `place-photo-links.json` keys). Empty array if no places. |
| `date_estimate` | string | no | Human-readable date or range (e.g., "1914", "Påsken 1914", "Nov 1915 - Jan 1916") |
| `date_sort` | string | no | ISO date for sorting/matching. For ranges, use start date. For year-only, use `YYYY-01-01`. |
| `description` | string | yes | Brief description of what the image shows |
| `description_da` | string | no | Danish description for frontend display |
| `source` | string | yes | Source identifier. Currently always `else_gad_maersk_presentation`. Supports future sources. |
| `width` | int | yes | Image width in pixels |
| `height` | int | yes | Image height in pixels |
| `size_bytes` | int | yes | File size |

### Design decisions

1. **Flat array, not keyed object**: Consistent with `person-registry.json` and `letter-entities.json`. Allows filtering and sorting without restructuring.

2. **`img_` prefix on IDs**: Prevents collisions when IDs from different registries appear in the same context (e.g., a search result mixing letters, persons, and images).

3. **`path` includes category subfolder**: The frontend needs the full relative path to construct image URLs. This decouples the URL from needing to know the category.

4. **`source` field**: Future-proofing. If more images are added (e.g., from Verlustlisten scans, museum archives), each batch gets its own source tag.

5. **`date_sort` separate from `date_estimate`**: The human-readable estimate preserves nuance ("Påsken 1914"), while `date_sort` enables machine matching with letter dates.

6. **`places` uses short keys, not geojson names**: The place-photo-links.json already provides the mapping from short keys (e.g., `loetzen`) to geojson keys (e.g., `Løtzen (Gizycko)`). No need to duplicate.

### What migrates from manifest.json

| manifest.json field | image-registry.json | Notes |
|---------------------|---------------------|-------|
| filename | filename, id, path | id = `img_` + stem; path = `{category}/{filename}` |
| category | category | Direct copy |
| persons | persons | Direct copy |
| places | places | Direct copy |
| description | description | Direct copy |
| width, height, size_bytes | width, height, size_bytes | Direct copy |
| date_estimate | date_estimate, date_sort | Enriched with dates from letters and biographical data |
| page, page_text, xref, source_note | — | Dropped (presentation-specific) |

### What does NOT go in image-registry.json

- Letter associations → `letter-images.json` (ADR-046)
- Geojson coordinate lookups → resolved at query time via `place-photo-links.json`
- Thumbnail/resized versions → future concern (ADR-047)
- The `manifest.json` is preserved as the extraction-level record; `image-registry.json` is the consumption-level record.

## Build script

`scripts/build-image-registry.py` — reads manifest.json + place-photo-links.json, enriches dates, writes image-registry.json.

## Consequences

- Frontend and API consume `image-registry.json` only, never `manifest.json`
- Adding new image sources means appending to `image-registry.json` with a different `source` value
- The `img_` prefix convention must be followed for all future images
- The `path` field assumes images are served from a known base URL (decided in ADR-047)

## Revision (2026-04-05)

The original ADR described `image-registry.json` as a derived file built from `manifest.json` + `place-photo-links.json` + `DATE_ESTIMATES` in Python. This has been superseded:

- **`data/image-registry.json` is now the canonical editable source** — not a build output
- `build-image-registry.py` has been replaced by `validate-image-registry.py` (validation only)
- Image files moved from `data/images/pdf-presentation/{category}/` to `data/images/{category}/`
- `place-photo-links.json` moved from extraction folder to `data/place-photo-links.json`
- The extraction folder (`data/images/_archived-extraction/`) is preserved for provenance

### Editable source files (image data)

| File | Purpose |
|------|---------|
| `data/image-registry.json` | Image metadata: IDs, categories, persons, places, descriptions, dates |
| `data/place-photo-links.json` | Place-to-image relationships, named locations, letter references |
| `data/place-image-lookup.json` | Place name resolution (geojson name → short ID) |

### Editorial workflow

1. Edit the source file(s) above
2. Run `python scripts/rebuild-all-image-data.py --quick`
3. Optionally run `python scripts/validate-image-registry.py` to check consistency
