---
name: lookup-person
description: >
  Look up people mentioned in 665 WW1-era Danish letters (1913-1920) from the
  Jernkorset collection. Search by name, retrieve biographies, letter timelines,
  social connections, and PageRank centrality for 60 identified persons.
license: CC-BY-4.0
metadata:
  domain: history
  language: da
  period: 1913-1920
  corpus_size: 665 letters
  persons: 60
  base_url: https://jernkorset.dk
---

# Lookup Person

Find and retrieve information about people mentioned in 665 Danish WW1 letters
from the Jernkorset collection. The letters were written between 1913 and 1920,
primarily between Peter Maersk (a Danish soldier serving in the German army) and
his family and sweetheart in Southern Jutland.

## Data Endpoints

| Endpoint | Description |
|----------|-------------|
| `/data/person-pages.json` | Full person records (60 persons) |
| `/data/person-registry.json` | Canonical names, aliases, disambiguation |
| `/data/social-network.json` | Network graph with PageRank and betweenness centrality |
| `/personer/{id}/` | Person page (HTML; use Accept header for markdown) |

All URLs are relative to `https://jernkorset.dk`.

## How to Find a Person by Name

1. Fetch `https://jernkorset.dk/data/person-pages.json`.
2. The response is an array of person objects.
3. Search by matching against `full_name` or `canonical` fields (case-insensitive).
4. If no match, fetch `https://jernkorset.dk/data/person-registry.json` and check
   the `aliases` array for alternative spellings or nicknames.

```
GET /data/person-pages.json

Filter where:
  full_name contains "Peter"
  OR canonical contains "peter"
```

Each person object has an `id` field (a URL slug) that can be used to construct
a direct link: `https://jernkorset.dk/personer/{id}/`

## Person Record Structure

Each entry in `person-pages.json` contains:

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | URL slug (e.g. `peter`) |
| `full_name` | string | Display name |
| `canonical` | string | Canonical identifier |
| `role` | string | Role in the letters |
| `category` | enum | `family`, `military`, `community`, or `unknown` |
| `birth_date` | string | Birth date (if known) |
| `death_date` | string | Death date (if known) |
| `biographical` | string | Short biography |
| `photos` | array | Photo references |
| `letters` | array | Letters involving this person |
| `connections` | array | Related persons with weight |
| `letter_count` | number | Total letters mentioning this person |
| `first_mention` | string | Date of first mention |
| `last_mention` | string | Date of last mention |

### Letter entries

Each item in the `letters` array has: `letter_id`, `date`, `place`, `sender`,
`recipient`, `role`, and `excerpt`.

### Connection entries

Each item in the `connections` array has: `person_id`, `full_name`, and `weight`
(co-occurrence strength).

## How to Get Biography and Timeline

1. Find the person in `person-pages.json` by name or id.
2. Read the `biographical` field for their biography.
3. Read the `letters` array, sorted by `date`, for a chronological timeline.
4. Use `first_mention` and `last_mention` for the date range.

## How to Get Social Connections

1. Find the person in `person-pages.json` and read their `connections` array.
2. For network-level analysis (PageRank, betweenness centrality), fetch
   `https://jernkorset.dk/data/social-network.json`.
3. The network file contains nodes with centrality scores and edges with weights.

## Key Persons

| ID | Name | Role | Letters |
|----|------|------|---------|
| `peter` | Peter Maersk | The soldier and protagonist | 615 |
| `trine` | Trine Kjems Gad | His sweetheart, later wife | many |
| `mor` | Maren Maersk | Peter's mother | many |
| `far` | Jes Maersk | Peter's father | many |
| `konow` | Wilhelm Konow | Military comrade | several |

Peter Maersk is the central figure. He served in Infantry Regiment 147,
37th Division of the German army during WW1. Most letters are between Peter and
Trine or Peter and his parents.

## Example: Looking Up Peter Maersk

**Step 1** -- Fetch the person pages:

```
GET https://jernkorset.dk/data/person-pages.json
```

**Step 2** -- Find Peter by filtering on `id == "peter"` or `full_name` containing
"Peter Maersk".

**Step 3** -- Read his record:

```json
{
  "id": "peter",
  "full_name": "Peter Maersk",
  "category": "military",
  "biographical": "Danish soldier from Southern Jutland serving in IR 147...",
  "letter_count": 615,
  "first_mention": "1913-...",
  "last_mention": "1920-...",
  "letters": [ ... ],
  "connections": [
    { "person_id": "trine", "full_name": "Trine Kjems Gad", "weight": 0.95 },
    { "person_id": "mor", "full_name": "Maren Maersk", "weight": 0.8 }
  ]
}
```

**Step 4** -- To see his page in a browser: `https://jernkorset.dk/personer/peter/`

**Step 5** -- For network centrality, fetch `social-network.json` and find the
node with `id == "peter"` to see his PageRank and betweenness scores.

## Tips

- Names may appear in Danish forms. Check the registry for aliases.
- The `weight` in connections indicates co-occurrence frequency, not sentiment.
- Letter excerpts are in the original Danish (some in old-style orthography).
- Use the person page URL with `Accept: text/markdown` to get a markdown version.
