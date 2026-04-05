# ADR-048: Person Page and Photo Gallery

## Status

Accepted (2026-04-05)

## Date

2026-04-05

## Context

The project has 68 persons in `data/person-registry.json`, 13 of whom have biographical data and photo references. The image registry (`data/image-registry.json`, ADR-045) has person tags on 95 images, but these images are currently surfaced only on letter detail pages through `letter-images.json` (ADR-046). No dedicated person view exists: persons are visible only as entity mentions within individual letter pages.

The social network extraction (ADR-016) already produces relationship data — co-mention counts between persons across the letter corpus. This data is currently used only for the social graph visualisation and is not exposed through the main navigation.

The combination of 68 known persons, 95 tagged images, 615+ letter mentions (for Peter alone), and pre-computed relationship data makes dedicated person pages viable and useful. Without them, a reader who encounters "Konow" in a letter has no way to learn who Konow is, see his photos, or navigate to other letters in which he appears.

## Decision

### URL structure

`/personer/{id}/` — e.g., `/personer/peter/`, `/personer/trine/`, `/personer/konow/`

An index page at `/personer/` lists all persons grouped by category.

Person IDs come directly from the `id` field in `person-registry.json` (lowercase, no spaces, already URL-safe).

### Page sections

Pages are server-rendered and generated statically at build time. Each page contains the following sections in order:

**1. Header**

Full name (`full_name`), birth and death dates (`birth_date`, `death_date`) formatted as `DD. MMM YYYY – DD. MMM YYYY`, and the `role` field rendered as a subtitle. Where dates are absent the field is omitted rather than shown as empty.

**2. Portrait gallery**

All images from `image-registry.json` where the person's ID appears in the `persons` array, sorted ascending by `date_sort`. Uses the same grid-and-lightbox pattern as the `LetterImages` component. The gallery is omitted if no images are tagged to this person.

**3. Biographical text**

The `biographical` field rendered as prose paragraphs. Omitted if the field is absent or empty.

**4. Letter timeline**

All letters in which this person is mentioned, drawn from `letter-entities.json` (entity mentions) and from `corrected-letters.json` (sender/recipient fields). Displayed as a chronological vertical list showing: date, place (if available), and the letter's opening line or summary. Each entry links to the letter detail page. The list is sorted ascending by letter date.

**5. Connections**

Other persons who are frequently co-mentioned in the same letters as this person. Source: the edge weights in the social network data produced by ADR-016. Shown as a compact list of names with co-mention counts, linking to each person's own page. Limited to the top 10 connections by weight. Omitted if no connection data is present.

### Data requirements

| Source file | Used for |
|---|---|
| `data/person-registry.json` | Person metadata: name, dates, role, biographical, photo filenames |
| `data/image-registry.json` | Filter images by person ID in `persons` array |
| `data/letter-entities.json` | Find letters mentioning this person by entity ID |
| `data/corrected-letters.json` | Letter metadata (date, place, opening) for timeline; sender/recipient matching |
| Social network edge data (ADR-016 output) | Co-mention weights for Connections section |

### Build pipeline

A new script `scripts/build-person-pages-data.py` pre-computes all per-person page data at build time:

1. Reads `person-registry.json` and filters to qualifying persons (see below).
2. For each person, collects:
   - Matching images from `image-registry.json`
   - Matching letter references from `letter-entities.json` and `corrected-letters.json`
   - Top-10 co-mention partners from social network edges
3. Writes `data/person-pages.json` — a JSON array of person objects, each containing: `person` (metadata), `photos` (array of image objects), `letters` (array of letter references with date/place/opening), `connections` (array of `{id, canonical, count}` objects). Note: the output file uses a JSON array structure (not a keyed object), consistent with `person-registry.json`.
4. The output file is copied to `apps/website/public/data/` as part of the existing static build step.

```json
{
  "peter": {
    "person": { "id": "peter", "full_name": "Peter Mærsk", "birth_date": "1892-04-27", ... },
    "photos": [
      { "id": "img_page001_02", "path": "portrait/page001_02.png", "date_sort": "1892-01-01", "description": "..." },
      ...
    ],
    "letters": [
      { "letter_id": "1914-08-01", "date": "1914-08-01", "place": "Løtzen", "opening": "Kære Trine..." },
      ...
    ],
    "connections": [
      { "id": "trine", "canonical": "Trine", "count": 287 },
      ...
    ]
  }
}
```

### Which persons get pages

A person qualifies for a page if either condition holds:

- `letter_count >= 3`, OR
- `biographical` field is present and non-empty

This excludes one-mention names and unresolved references while including all persons with meaningful presence in the corpus. Estimated qualifying count: 35–40 persons.

Persons who do not qualify are still resolvable via entity mentions on letter pages but do not receive a dedicated URL.

### Index page (`/personer/`)

Lists all qualifying persons grouped by `category` (family, military, community). Within each group, persons are sorted by `letter_count` descending. Each entry shows: full name, role, letter count, and a small portrait thumbnail if any photo is tagged to this person.

### Navigation integration

- The letter detail page links a recognised person's name to `/personer/{id}/` when the entity ID resolves to a qualifying person.
- The person page header links back to the letter index.
- The Connections section links to each co-mentioned person's page.

### Design

Same archival editorial style as letter pages: serif body text, muted palette, no decorative chrome. Photos use the existing `LetterImages` grid-and-lightbox pattern to avoid duplicating image-display logic. The letter timeline uses a plain vertical list consistent in structure with the letter list on the index page.

## Consequences

- The 95 person-tagged images, currently surfaced only when a reader happens to navigate to a letter that contains them, become reachable through person pages. Combined with portrait photos that appear on multiple letters, this substantially increases image discoverability.
- A navigation path is created: letter detail page → person page → other letters mentioning that person. Readers can follow a person across the full corpus without knowing which letters to look for.
- The pre-computed `person-pages.json` keeps the pattern of static data files: no runtime queries, no API changes required.
- The build script (`build-person-pages-data.py`) introduces a dependency on the social network edge data. If ADR-016 output is absent or stale, the Connections section is omitted gracefully rather than failing the build.
- Person pages only exist for qualifying persons. Stub pages for one-mention names are intentionally avoided to prevent thin content.
- The `id` field in `person-registry.json` becomes a stable public URL segment. Changing a person ID after publication would break inbound links; IDs should be treated as permanent once a person page is published.
