---
name: read-letter
description: >
  Read and retrieve WW1 letters from jernkorset.dk — a digitised collection
  of 665 letters written between Danish family members during World War I
  (1914-1918). Supports content negotiation for markdown output and
  programmatic JSON access with sentiment and image metadata.
metadata:
  collection-size: 665
  languages: [da]
  time-period: 1914-1918
  base-url: https://jernkorset.dk
---

# read-letter

Retrieve a specific WW1 letter from jernkorset.dk by its numeric ID (1-665).
Letters are ordered chronologically. The collection contains correspondence
between members of a Danish family during World War I.

## Quick start

### Option A: Content negotiation (preferred)

Request the letter page with `Accept: text/markdown` to get clean markdown
containing both the original 1910s Danish and a modern Danish translation:

```
GET https://jernkorset.dk/letters/42/
Accept: text/markdown
```

The response is structured markdown with frontmatter-style metadata, the
original text, and the modernised text. No HTML stripping needed.

### Option B: JSON bulk endpoint

Fetch all 665 letters in one request:

```
GET https://jernkorset.dk/data/letters.json
```

Each entry in the array has these fields:

| Field         | Type   | Description                              |
|---------------|--------|------------------------------------------|
| `id`          | number | 1-665, chronological order               |
| `date`        | string | ISO date of the letter                   |
| `sender`      | string | Name of the sender                       |
| `recipient`   | string | Name of the recipient                    |
| `place`       | string | Place of writing                         |
| `location`    | object | `{ lat, lng }` coordinates (nullable)    |
| `text`        | string | Original Danish text as HTML             |
| `text_modern` | string | Modern Danish translation as HTML        |

### Stripping HTML from JSON fields

The `text` and `text_modern` fields contain simple HTML (`<p>` tags and
occasional `<br>`). To get plain text:

1. Remove all HTML tags: replace `<[^>]+>` with empty string
2. Decode HTML entities (`&amp;` -> `&`, etc.)
3. Collapse multiple blank lines

Example in JavaScript:

```js
function stripHtml(html) {
  return html
    .replace(/<[^>]+>/g, '\n')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
```

## Additional metadata

### Sentiment scores

```
GET https://jernkorset.dk/data/letter-sentiments.json
```

Returns CVP (Circumplex Values Profile) sentiment analysis per letter,
useful for tracking emotional tone across the war years.

### Images

```
GET https://jernkorset.dk/data/letter-images.json
```

Returns associated scanned images for each letter (original handwritten
pages, postcards, envelopes).

### Letter HTML pages

Each letter also has a rendered HTML page at:

```
https://jernkorset.dk/letters/{id}/
```

These pages show the letter with contextual navigation, sender/recipient
info, and a toggle between original and modern Danish.

## Example: reading letter 42

### Step 1 -- Fetch via markdown negotiation

```
GET https://jernkorset.dk/letters/42/
Accept: text/markdown
```

### Step 2 -- Or fetch from JSON and extract

```js
const response = await fetch('https://jernkorset.dk/data/letters.json');
const letters = await response.json();
const letter42 = letters.find(l => l.id === 42);

// Read the modern Danish version
const modernText = stripHtml(letter42.text_modern);
console.log(`From: ${letter42.sender}`);
console.log(`To: ${letter42.recipient}`);
console.log(`Date: ${letter42.date}`);
console.log(`Place: ${letter42.place}`);
console.log(modernText);
```

### Step 3 -- Enrich with sentiment

```js
const sentiments = await fetch('https://jernkorset.dk/data/letter-sentiments.json')
  .then(r => r.json());
const sentiment42 = sentiments.find(s => s.id === 42);
```

## Tips

- Use the markdown endpoint when you need a single letter -- it avoids
  downloading the full 665-letter JSON.
- The JSON endpoint is better when you need to search, filter, or
  process multiple letters at once.
- Letter IDs are stable and chronological: ID 1 is the earliest letter,
  ID 665 is the latest.
- Coordinates in the `location` field can be used to plot letters on a
  map. Not all letters have location data.
