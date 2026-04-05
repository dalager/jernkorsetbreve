# ADR-046: Letter-Image Association Strategy

## Status

Accepted (2026-04-05)

## Date

2026-04-04

## Context

We have 165 classified images (ADR-045) and ~900 letters. Images have person and place tags. Letters have dates, locations, and NER-extracted entities. The goal is to show relevant images when viewing a letter.

The challenge: images and letters don't have explicit 1:1 links. A photo of Løtzen is relevant to any letter written from Løtzen. A portrait of Peter is loosely relevant to every letter. A map of the Eastern Front is relevant to a date range. We need a scoring system that surfaces the most contextually relevant images.

## Decision

### Precomputed associations in `data/letter-images.json`

Associations are computed at build time (not query time) because:
- The image set is fixed (165 images from a known source)
- Letters don't change
- Precomputation allows human review and manual overrides
- No runtime dependency on scoring logic

### Schema

```json
{
  "letter_id": 42,
  "images": [
    {
      "image_id": "img_page045_02",
      "relevance": "place+person",
      "score": 0.95,
      "reason": "Photo from Løtzen, shows Peter and Trine"
    }
  ]
}
```

Top-level: array of objects, one per letter that has at least one matched image. Letters with no matches are omitted.

### Matching dimensions and scoring

#### 1. Place match (base score: 0.7)

If the letter's location resolves to a place key that appears in an image's `places` array.

Resolution chain: letter `location` field → geojson place name → place-photo-links.json key → image `places` array.

Bonus +0.1 if the image category is `place` (actual photo of the location vs. a map that happens to include it).

#### 2. Person match (base score: 0.4)

If the letter mentions a person (via `letter-entities.json`, resolved to person-registry IDs) who appears in an image's `persons` array.

Scoring adjustments:
- Portrait of that person: 0.4
- Group photo including that person: 0.3
- If Peter is the only match: 0.1 (he's in 78 photos — too many to be useful as a discriminator)

#### 3. Date proximity (modifier: +0.0 to +0.3)

If both the letter and image have dates, and they fall within a window:
- Same month: +0.3
- Same quarter (±3 months): +0.2
- Same year: +0.1
- No date on image: +0.0 (no penalty, no bonus)

#### 4. Category-specific adjustments

| Category | Adjustment | Rationale |
|----------|------------|-----------|
| `portrait` | Person match only, ignore place/date | Portraits are timeless references to a person |
| `map` | Score 0.3, require place OR date overlap | Maps are contextual, not letter-specific |
| `place` | Full scoring | Most relevant to letters from that location |
| `group` | Full scoring | Relevant when persons + place/date align |
| `military` | Place + date match only, score 0.5 | War scenes need geographic + temporal context |
| `document` | Score 0.2, shown as "related document" | Contextual, rarely letter-specific |
| `historical` | Score 0.1, only if date matches | Background context only |

#### 6. Recipient scoring

Letter recipients are always matched as persons. Scoring:
- Recipient portrait: base 0.5 + date bonus
- "Mor og far" maps to both `far` and `mor`
- Recipient images are capped at 2 per letter (MAX_RECIPIENT, added per ADR-050)

This ensures every letter shows who it was written to, without flooding out contextual images.

#### 5. Combination formula

```
score = max(place_score, person_score) + date_bonus + category_adjustment
```

Capped at 1.0.

#### 6. Relevance label

Derived from which dimensions matched:
- `"place+person"` — both matched
- `"place"` — location matched
- `"person"` — person in the photo
- `"date"` — temporal overlap only
- `"context"` — map or document, loose association

### Limits

- **Max 8 images per letter** (sorted by score descending)
- **Minimum score threshold: 0.2** (below this, the association is too loose)
- **At most 2 maps per letter** (maps are useful but shouldn't dominate)
- **At most 1 historical image per letter**

### Manual overrides

The output file supports a `manual` flag:

```json
{
  "image_id": "img_page129_02",
  "relevance": "manual",
  "score": 1.0,
  "reason": "Villa Vinterhistorie interior — directly described in this letter"
}
```

Manual overrides are stored in a separate `data/letter-image-overrides.json` and merged during build. This allows curated associations for key letters (e.g., linking the Villa Vinterhistorie photo to the letter that describes the bunker).

## Build script

`scripts/build-letter-images.py`:
1. Load image-registry.json, corrected-letters.json, letter-entities.json, person-registry.json
2. Build place resolution lookup
3. For each letter, score all candidate images
4. Apply limits and thresholds
5. Merge manual overrides
6. Write letter-images.json

## Consequences

- Letter detail pages can show contextual images immediately
- The scoring can be tuned by adjusting weights — the ADR documents the initial values, implementation may refine them based on review
- Manual overrides allow curating the most important letter-image links without changing the algorithm
- When person or place pages are built, they read directly from image-registry.json (no need for letter-images.json)
- Adding new images requires re-running the build script

## Open questions for implementation

- Should letters to parents vs. letters to Trine weight person matches differently?
- The Peter-everywhere problem (78 photos): is the 0.1 downweight enough, or should Peter be excluded from person matching entirely?
- Should the `reason` field be human-readable Danish for frontend display?
