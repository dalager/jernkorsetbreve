# ADR-050: Image Curation Workflow

## Status

Proposed (2026-04-05)

## Date

2026-04-05

## Context

After implementing the letter-image association system (ADR-046), data quality issues emerged:

- **Recipient portrait dominance**: 3184 of 4783 associations are recipient-relevance images. Many letters show 4-6 family portraits as the only images, reducing contextual relevance.
- **Unused images**: 101 of 164 images are not associated with any letter.
- **Sparse descriptions**: Many images (especially military and place photos) have empty or generic `description_da` fields, reducing frontend display quality.
- **Missing dates**: Only 52 of 164 images have `date_sort` populated, limiting date-proximity scoring in ADR-046.
- **Classification drift**: Some images are incorrectly categorized (e.g., a "military" photo that is actually a "place" photo).

## Decision

### 1. Recipient portrait cap

Modify `scripts/build-letter-images.py` to cap `recipient-relevance` images at **2 per letter**.

Rationale:
- Recipient portraits (person_id in `["peter_møller", "trine_møller", "the_parents"]`) are abundant and add little contextual value beyond the second occurrence.
- Capping at 2 preserves the "who wrote this letter" context while leaving room for place-matched and date-matched images.
- This is a hard limit applied after scoring but before the max-8-per-letter limit.

### 2. Manual overrides file

Create `data/letter-image-overrides.json` for curating key letter-image associations:

```json
[
  {
    "letter_id": 320,
    "image_id": "img_page129_02",
    "score": 1.0,
    "relevance": "place+context",
    "reason_da": "Villa Vinterhistorie interiør — beskrevet direkte i dette brev"
  }
]
```

Schema:
- `letter_id` (integer): Target letter ID
- `image_id` (string): Image ID from image-registry.json
- `score` (0.0-1.0): Override score (usually 1.0 for high-priority connections)
- `relevance` (string): Label (e.g., `"place+context"`, `"manual"`)
- `reason_da` (string): Human-readable Danish explanation for frontend display

Priority letters for manual curation:
- Letters that describe specific places shown in photos (Villa Vinterhistorie, Feste Boyen, Katedralen i Laon)
- First and last letters from each location
- Key biographical moments (engagement reveal, first child born, desertion)

Manual overrides are merged into `data/letter-images.json` during the build step, always taking precedence over algorithmic scores.

### 3. Batch description enrichment

Create `scripts/enrich-image-descriptions.py` to populate missing `description_da` fields:

```bash
python scripts/enrich-image-descriptions.py [--skip-existing]
```

Process:
1. Load `data/manifest.json` and `data/image-registry.json`
2. For each image with empty `description_da`:
   - Extract `page_text` from the source PDF page
   - Use surrounding slide context (captions, labels in the PDF)
   - Generate a brief Danish description (1-2 sentences)
   - Write back to `data/image-registry.json`
3. `--skip-existing` flag: only process images with null or empty descriptions (supports incremental runs)

Output:
- Updated `data/image-registry.json` with populated descriptions
- Log of enriched images for manual review

Rationale: The PDF page context (OCR text, slide captions) often provides enough signal to write useful descriptions without manual inspection.

### 4. Date enrichment pass

Extend `scripts/build-image-registry.py` with a DATE_ESTIMATES lookup to populate missing `date_sort` values:

```python
DATE_ESTIMATES = {
  "løtzen": (datetime(1913, 10, 1), datetime(1914, 8, 31)),
  "dünaburg": (datetime(1915, 9, 1), datetime(1916, 12, 31)),
  "western_front": (datetime(1916, 12, 1), datetime(1918, 9, 30)),
  # ... per place
}
```

Process:
1. Load letter-images.json associations
2. For each image with null `date_sort`:
   - Check if it has a place match (from associations)
   - If place is in DATE_ESTIMATES, use the period midpoint
   - Otherwise, skip (no automatic enrichment without context)
3. Rewrite `data/image-registry.json`

Rationale: Military and place photos often lack explicit dates, but can be estimated from the location's historical period (e.g., Lötzens was occupied Oct 1913 - Aug 1914). This improves date-proximity scoring without requiring manual dating of every image.

### 5. Classification review tool

Create `scripts/review-image-classification.py` for interactive reclassification:

```bash
python scripts/review-image-classification.py --category military
```

Interactive workflow:
1. Load all images in the specified category from `data/image-registry.json`
2. For each image:
   - Display the image ID, current category, tags, and description
   - Prompt user: `(k)eep / (m)ilitary / (p)lace / (g)roup / (p)ortrait / (d)ocument / (h)istorical / (s)kip`
   - If changed, update `data/image-registry.json`
   - Log reclassifications for audit
3. After review, trigger a rebuild of `data/image-registry.json` and run `scripts/build-letter-images.py`

Output:
- Updated `data/image-registry.json` with corrected categories
- Audit log of changes (timestamp, image_id, old_category → new_category, reason)

Rationale: Allows curators to quickly correct classification drift without editing JSON manually.

## Build pipeline

Update `scripts/build-letter-images.py`:

1. Load image-registry.json, corrected-letters.json, letter-entities.json, person-registry.json
2. **Apply recipient portrait cap**: Filter recipient-relevance images to max 2 per letter
3. Build place resolution lookup
4. For each letter, score all candidate images (ADR-046 formula)
5. Apply limits and thresholds
6. **Load and merge manual overrides** from `data/letter-image-overrides.json`
7. Write letter-images.json

Build order:
```bash
# 1. Enrich image metadata
python scripts/enrich-image-descriptions.py --skip-existing
python scripts/build-image-registry.py  # Updates date_sort for place-matched images

# 2. Review and correct classifications (interactive)
python scripts/review-image-classification.py --category military
python scripts/review-image-classification.py --category place
# ... other categories

# 3. Generate associations
python scripts/build-letter-images.py

# 4. Manual curation (edit data/letter-image-overrides.json)
# Then rebuild:
python scripts/build-letter-images.py
```

## Consequences

- **Recipient cap** improves signal-to-noise for letters with place-matched or date-matched images
- **Manual overrides** enable curated associations for the most important letters without algorithm changes
- **Description enrichment** improves frontend display quality (letter detail pages will show useful image captions)
- **Date enrichment** increases the effectiveness of date-proximity scoring in ADR-046
- **Classification review** allows correcting metadata drift and improving future scoring
- Each step is independent and can be performed incrementally
- The curation workflow is repeatable: new images or letters trigger a re-run of the pipeline

## Open questions for implementation

- Should description enrichment attempt to generate descriptions for all images, or only recipient portraits (which are already numerous)?
- Should the classification review tool support batch reclassification (e.g., "all military images on page 45 are actually place photos")?
- Should date estimates for place periods be stored in a separate `data/place-date-estimates.json` for maintainability?
- Should manual overrides include a `confidence` field to weight override priority if there are conflicts?

## Implementation Status (2026-04-05)

| Item | Status |
|------|--------|
| Recipient portrait cap (MAX_RECIPIENT=2) | Implemented |
| Manual overrides framework (letter-image-overrides.json) | Code ready, no data file yet |
| Description enrichment script | Not yet implemented |
| Date enrichment pass | Not yet implemented |
| Classification review tool | Not yet implemented |
