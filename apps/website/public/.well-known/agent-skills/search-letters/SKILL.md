---
name: search-letters
description: >
  Search and explore 665 digitised WW1 Danish letters on jernkorset.dk.
  Filter by date, sender, recipient, or place. Perform semantic similarity
  lookups using pre-computed embeddings. Access full text, 200-character
  previews, and thematic topic clusters — all from static JSON endpoints
  with no server API required.
metadata:
  collection-size: 665
  languages: [da]
  time-period: 1911-1918
  base-url: https://jernkorset.dk
---

# search-letters

Search through 665 WW1 letters from jernkorset.dk — a digitised collection
of correspondence between members of a Danish family during World War I.
The site is fully static (Cloudflare Pages) with no server-side API.
All search is done by fetching JSON data files and filtering client-side.

## Data endpoints

| Endpoint | Size | Purpose |
|----------|------|---------|
| `/data/letter-summaries.json` | ~40 KB | Metadata for all 665 letters |
| `/data/search-corpus.json` | ~1.5 MB | Full plain text of every letter |
| `/data/search-snippets.json` | ~60 KB | 200-char preview of each letter |
| `/data/related-letters.json` | ~200 KB | Pre-computed cosine similarity |
| `/data/topic-clusters.json` | ~30 KB | Thematic clusters (k=8) |

All URLs are prefixed with `https://jernkorset.dk`.

## Step 1: Fetch letter metadata

Start every search by fetching the summaries file:

```
GET https://jernkorset.dk/data/letter-summaries.json
```

Returns an array of 665 objects:

```json
{
  "id": 42,
  "date": "1914-08-12",
  "sender": "Peter Mærsk",
  "recipient": "Trine Mærsk",
  "place": "Haderslev"
}
```

### Fields

| Field       | Type   | Description                            |
|-------------|--------|----------------------------------------|
| `id`        | number | Stable ID (1-665), chronological order |
| `date`      | string | ISO 8601 date (YYYY-MM-DD)             |
| `sender`    | string | Name of the letter writer              |
| `recipient` | string | Name of the addressee                  |
| `place`     | string | Place where the letter was written     |

## Step 2: Filter

Apply filters in-memory on the summaries array.

### By date range

```js
const from = "1914-08-01";
const to = "1914-12-31";
const results = summaries.filter(l => l.date >= from && l.date <= to);
```

### By sender or recipient

```js
const results = summaries.filter(l => l.sender === "Peter Mærsk");
```

Common senders: `Peter Mærsk`, `Trine Mærsk`.
Common recipients: `Trine Mærsk`, `Peter Mærsk`, `Mor og far`.

### By place

```js
const results = summaries.filter(l =>
  l.place.toLowerCase().includes("haderslev")
);
```

### Combined filters

Filters compose naturally — chain them:

```js
const results = summaries.filter(l =>
  l.date >= "1916-01-01" &&
  l.date <= "1916-12-31" &&
  l.sender === "Peter Mærsk"
);
```

## Step 3: Get letter content

### Quick previews (recommended first step)

Fetch 200-character snippets to scan results without downloading full text:

```
GET https://jernkorset.dk/data/search-snippets.json
```

Returns an object keyed by letter ID:

```json
{
  "42": "Min kære Trine! I dag har vi faaet Ordre til at marchere..."
}
```

### Full text

For the complete letter text, use either approach:

**Option A — Single letter via content negotiation:**

```
GET https://jernkorset.dk/letters/42/
Accept: text/markdown
```

Returns clean markdown with metadata, original text, and modern Danish
translation. Preferred when you need one or a few specific letters.

**Option B — Bulk plain text:**

```
GET https://jernkorset.dk/data/search-corpus.json
```

Returns an array of objects with `id` and `text` (plain text, no HTML):

```json
{
  "id": 42,
  "text": "Min kære Trine! I dag har vi faaet Ordre til at marchere..."
}
```

Use this when you need to do text search across many letters.

### Full-text keyword search

Search the corpus for keywords:

```js
const corpus = await fetch("https://jernkorset.dk/data/search-corpus.json")
  .then(r => r.json());

const query = "lazaret";  // field hospital
const hits = corpus.filter(l =>
  l.text.toLowerCase().includes(query.toLowerCase())
);
```

The text is in period Danish (1910s spelling). Try variant spellings:
- "aa" vs "å" (e.g., "Gaard" / "Gård")
- "Feldt" / "Felt"
- "Compagni" / "Kompagni"

## Step 4: Semantic similarity search

When you have a letter of interest and want to find thematically similar
letters, use the pre-computed similarity data:

```
GET https://jernkorset.dk/data/related-letters.json
```

Returns an object keyed by letter ID. Each value is an array of the top
similar letters ranked by cosine similarity:

```json
{
  "42": [
    { "id": 105, "score": 0.9412 },
    { "id": 87,  "score": 0.9387 },
    { "id": 201, "score": 0.9301 }
  ]
}
```

Scores are cosine similarity (0-1) computed from sentence-level embeddings.
A score above 0.93 indicates strong thematic overlap.

### Approach for semantic queries

1. Find an initial letter matching the user's interest (by keyword or
   metadata filter).
2. Look up that letter's ID in `related-letters.json`.
3. Fetch the top related letters to expand the result set.

## Step 5: Topic clusters

For broad thematic exploration, fetch pre-computed topic clusters:

```
GET https://jernkorset.dk/data/topic-clusters.json
```

Returns `k` clusters, each with:

```json
{
  "id": 0,
  "label": "Midterste krigsår (1911-1918)",
  "size": 130,
  "topSender": "Peter Mærsk",
  "yearRange": [1911, 1918],
  "representative": [548, 601, 404],
  "letterIds": [9, 29, 33, ...]
}
```

Use the `representative` array to sample the most central letters in a
topic. Use `letterIds` to retrieve all letters belonging to that theme.

## Example queries

### "What did Peter write about in the first months of the war?"

1. Fetch `letter-summaries.json`.
2. Filter: `sender === "Peter Mærsk"` and `date >= "1914-08-01"` and
   `date <= "1914-12-31"`.
3. Fetch `search-snippets.json` and display previews for matching IDs.
4. For the most interesting hits, fetch full text via content negotiation.

### "Find letters mentioning Verdun or the Western Front"

1. Fetch `search-corpus.json`.
2. Search for keywords: `"Verdun"`, `"Vestfronten"`, `"Skyttegrav"` (trench).
3. Cross-reference hits with `letter-summaries.json` for dates and places.

### "Find letters similar to letter 300"

1. Fetch `related-letters.json`.
2. Read `related["300"]` — the top 5 similar letters by cosine score.
3. Fetch those letters for comparison.

### "What are the main themes in the collection?"

1. Fetch `topic-clusters.json`.
2. List the cluster labels and sizes.
3. For each cluster, fetch the `representative` letters to illustrate
   the theme.

## Tips

- Start with `letter-summaries.json` (smallest file) to narrow results
  before fetching heavier endpoints.
- Use `search-snippets.json` to preview many letters without downloading
  the full corpus.
- The letters are in period Danish. When searching, try both old and
  modern spellings.
- Letter IDs are stable and chronological: lower IDs are earlier letters.
- Any page on jernkorset.dk supports `Accept: text/markdown` for clean
  markdown output — useful for reading individual letters or person pages.
- The full `search-corpus.json` is roughly 1.5 MB. Cache it if you plan
  to run multiple keyword searches.
