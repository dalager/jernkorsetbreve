# ADR-049: Place Pages with Photos and Letters

## Status

Accepted (2026-04-05)

## Date

2026-04-05

## Context

The project has 75 places in `places.geojson` with coordinates, enriched with Wikidata data in `places-enriched.json`. The existing map page (`/kort/`) displays all places as markers, but clicking a marker only filters the letter list — it does not navigate to a dedicated place page.

`data/images/pdf-presentation/place-photo-links.json` connects 14 places to 58 photo associations extracted from the Else Gad Mærsk presentation. These photos include portraits taken at specific locations, postcards of buildings, and documentary images of named sub-locations such as "Villa Vinterhistorie" and "Willa Fred".

Two places with photos in `place-photo-links.json` have no corresponding entry in `places.geojson`:

- **Ravnholt**: Trine's family home near Roager, Denmark. Present in the photo links with 3 photos, including Russian prisoners at Ravnholt in 1915.
- **Kongeåen**: The Danish-German border 1864–1920. Present in the photo links as a crossing-point context for the letters.

There is currently no way to browse the collection by place, nor to see all letters and photos associated with a single location in one view. The map is the only entry point to place-level information, and it does not surface the photo or letter content.

## Decision

### URL structure

Place detail pages at `/steder/{place_id}/`, for example:

- `/steder/loetzen/`
- `/steder/vallekilde/`
- `/steder/ravnholt/`

Index page listing all places at `/steder/`.

### Place ID strategy

Place IDs are short, lowercase, ASCII slugs:

- Where a key already exists in `place-photo-links.json`, use that key directly (e.g., `loetzen`, `vallekilde`, `oester_aabolling`).
- For the 61 places that have no photo-link entry, derive the ID by slugifying the geojson name: strip diacritics, replace spaces and parentheses with underscores, lowercase (e.g., `Løtzen (Gizycko)` → `lotzen_gizycko`). Where a place-photo-links key exists for that place, the photo-link key takes precedence and the derived key is not used.
- IDs are stable once assigned. They appear in URLs and must not change.

### Missing places to add to places.geojson

| Place | Coordinates | Notes |
|-------|-------------|-------|
| Ravnholt | 55.18°N, 8.85°E | Trine's family home near Roager |
| Kongeåen | 55.43°N, 9.28°E | Representative point near Vamdrup; the border is a line feature but is represented as a point for map display |

Both entries should follow the existing geojson feature format with a `name` property matching the place-photo-links key (capitalised: `"Ravnholt"`, `"Kongeåen"`).

### Page sections

Each place detail page renders the following sections in order:

**1. Header**

Place name (from geojson), modern name where different (from `places-enriched.json`), country, and a link to the Wikidata entity where one exists in the enriched data.

**2. Map**

A small Leaflet map centered on this place, using the `MiniMapWrapper` pattern established on letter detail pages. The map shows a single marker for the place. For Kongeåen, the marker is the representative point. The map is sized larger than the letter-page mini-map to give the place more visual prominence.

**3. Photos**

All images in `image-registry.json` whose `places` array contains this place's ID, displayed in a grid. Each image shows its description and date estimate. Images link to a lightbox view. If no images are associated, this section is omitted.

**4. Letters from here**

All letters where the `place` field matches this location, listed chronologically. Each entry shows the letter date, sender, recipient, and a short excerpt. Letters link to their detail pages. If no letters are associated, this section is omitted.

**5. Historical context**

For places that have a `letter_references` block in `place-photo-links.json` (currently `villa_vinterhistorie` and similar named sub-locations), display the referenced letter excerpts with their source attribution. This section surfaces the documentary value of the photo-linked place data. If the place has no `letter_references`, this section is omitted.

**6. Named locations**

For named sub-locations that appear as distinct entries in `place-photo-links.json` (e.g., `villa_vinterhistorie`, `villa_fred`) and are associated with a parent place (e.g., `loetzen`), display them as points of interest under the parent place page. Each named location shows its description, associated photos, and any letter references. Named locations do not get their own top-level place pages; they are anchored sections within the parent page at `/steder/{parent_id}/#villa-vinterhistorie`.

### Index page at /steder/

The index page lists all places grouped by country (Denmark, Germany, Poland/East Prussia, France, Belgium, etc.). Each place entry shows:

- Place name (and modern name if different)
- Letter count
- Photo count (if any)
- Link to the place detail page

Places with photos are visually distinguished (e.g., a small camera indicator). Letter counts are derived from the prebuilt data file.

### Navigation changes

- **Map page → place pages**: Clicking a place marker on the existing map page navigates to `/steder/{place_id}/` instead of (or in addition to) filtering the letter list.
- **Letter detail → place page**: The place name shown on a letter detail page becomes a link to `/steder/{place_id}/`.
- **Place page → letter pages**: Each letter in the "Letters from here" list links to its detail page.

### Data pipeline

A new build script `scripts/build-place-pages-data.py` merges the following sources:

| Source | Contributes |
|--------|-------------|
| `data/places.geojson` | Coordinates, canonical place names |
| `data/places-enriched.json` | Modern names, Wikidata IDs, country |
| `data/images/pdf-presentation/place-photo-links.json` | Photo associations, named sub-locations, letter references |
| `data/image-registry.json` | Full image metadata for display |
| Letter summaries (from letters API or prebuilt index) | Letter counts, excerpts, dates |

Output: `data/place-pages.json`

Schema per place entry:

```json
{
  "id": "loetzen",
  "name": "Løtzen (Gizycko)",
  "modern_name": "Giżycko",
  "country": "Poland (then East Prussia, Germany)",
  "coordinates": [54.0352, 21.7622],
  "wikidata_id": "Q123456",
  "letter_count": 12,
  "letters": [
    {
      "letter_id": "brev_001",
      "date": "1914-03-15",
      "sender": "Peter",
      "recipient": "Trine",
      "excerpt": "..."
    }
  ],
  "photos": ["img_page039_02", "img_page039_03"],
  "named_locations": [
    {
      "id": "villa_vinterhistorie",
      "name": "Villa Vinterhistorie",
      "description": "...",
      "photos": ["img_page050_02"],
      "letter_references": [
        {
          "letter_id": "brev_042",
          "excerpt": "..."
        }
      ]
    }
  ]
}
```

The script is run as part of the data build step, after `build-image-registry.py` has produced `image-registry.json`.

### Design

- Archival editorial style matching letter detail pages: serif body text, muted palette, document-like layout.
- The map section is placed prominently near the top, larger than the mini-map on letter pages.
- Photo grid uses the same component as any future image gallery (consistent with ADR-047 image serving).
- Mobile layout stacks all sections vertically; the map collapses to a smaller fixed height on narrow viewports.

## Consequences

- All 14 photo-linked places get rich detail pages with images, letters, historical context, and named sub-locations.
- The remaining 61 geojson places get simpler pages showing only the map and letter list.
- Ravnholt and Kongeåen are added to `places.geojson`, making the geojson the authoritative source for all places referenced anywhere in the project.
- A new navigation axis is created: map → place → letters, and letter → place → other letters from the same location. This connects the collection spatially in a way the current letter-only navigation does not support.
- The `place_id` slug scheme must be documented and followed consistently. Any future place added to `place-photo-links.json` or `places.geojson` requires a stable ID assigned at that time.
- `build-place-pages-data.py` becomes a required step in the full data build sequence, after `build-image-registry.py`.
- Named sub-locations (Villa Vinterhistorie, Willa Fred) are surfaced as anchored sections rather than top-level routes, keeping the URL structure flat and avoiding stub pages with minimal content.
