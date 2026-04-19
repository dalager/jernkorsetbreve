---
name: lookup-place
description: >
  Look up places mentioned in 665 WW1 Danish letters on jernkorset.dk.
  The collection references locations across Denmark, Germany, Poland,
  France, Belgium, and Russia — many of which changed names after the
  1920 border redrawing. Returns coordinates, Wikidata links, historical
  borders, and the letters written from each place.
metadata:
  place-count: auto
  languages: [da]
  time-period: 1914-1918
  base-url: https://jernkorset.dk
---

# lookup-place

Find geographic locations mentioned in a WW1 Danish letter collection.
Many place names in the letters use German or pre-1920 Danish forms that
differ from their modern equivalents (e.g. Lotzen is now Gizycko, Poland).
This skill helps you resolve those names and retrieve associated letters,
coordinates, and historical context.

## Data endpoints

### Full place pages (recommended)

```
GET https://jernkorset.dk/data/place-pages.json
```

Returns an array of place objects. Each object contains:

| Field            | Type     | Description                                  |
|------------------|----------|----------------------------------------------|
| `id`             | string   | URL slug, e.g. `loetzen`                     |
| `name`           | string   | Name used in the letters (period spelling)   |
| `modern_name`    | string   | Current official name                        |
| `country`        | string   | Present-day country                          |
| `lat`            | number   | Latitude (WGS 84)                            |
| `lng`            | number   | Longitude (WGS 84)                           |
| `wikidata_id`    | string   | Wikidata Q-identifier (nullable)             |
| `wikipedia_url`  | string   | Wikipedia article URL (nullable)             |
| `description`    | string   | Short historical description                 |
| `letter_count`   | number   | How many letters reference this place        |
| `photos`         | array    | Associated photographs                       |
| `letters`        | array    | Letters from this place (see below)          |
| `named_locations` | array   | Sub-locations mentioned in the letters       |

Each entry in the `letters` array has: `letter_id`, `date`, `sender`,
`recipient`, `excerpt`.

### Lightweight place list

```
GET https://jernkorset.dk/data/places.json
```

A smaller payload with just names and coordinates -- useful when you only
need to locate places on a map without letter details.

### Historical border GeoJSON

```
GET https://jernkorset.dk/data/borders-1914.json
GET https://jernkorset.dk/data/borders-1918.json
```

GeoJSON polygons showing national borders at the start and end of WW1.
Useful for understanding which country a place belonged to at the time
the letters were written.

### Individual place pages

```
GET https://jernkorset.dk/steder/{id}/
Accept: text/markdown
```

Returns a single place page. Use `Accept: text/markdown` for clean
markdown output, or omit the header for the full HTML page.

## How to find a place

Search the `place-pages.json` array by matching against both `name`
(the period spelling) and `modern_name` (current official name). Many
places can be found under either form.

```js
const places = await fetch('https://jernkorset.dk/data/place-pages.json')
  .then(r => r.json());

function findPlace(query) {
  const q = query.toLowerCase();
  return places.filter(p =>
    p.name.toLowerCase().includes(q) ||
    p.modern_name.toLowerCase().includes(q) ||
    p.id.includes(q)
  );
}
```

If a user mentions a place name you do not recognise, try common
substitutions: o/oe for ö, a/aa for å, u/ue for ü. The letter
writers used Danish transliterations of German place names.

## Historical context

The letters span 1914-1918, a period when the Danish-German border
ran along the Kongeaaen river. Northern Schleswig (Sonderjylland)
was German territory, so the Danish letter writers were German
citizens serving in the German army. After the 1920 plebiscite,
Northern Schleswig was returned to Denmark.

Key consequences for place names:

- **Eastern Front places** used German names that reverted to Polish
  or Russian after the war (Lotzen -> Gizycko, Arys -> Orzysz).
- **Western Front places** used German forms of French/Belgian names.
- **Sonderjylland places** used Danish names throughout, since the
  family wrote in Danish regardless of official German administration.

Use the `borders-1914.json` and `borders-1918.json` endpoints to see
exactly where national boundaries lay during the letter period.

## Key places

| id                | name (period) | modern_name    | significance                          |
|-------------------|---------------|----------------|---------------------------------------|
| `loetzen`         | Lotzen        | Gizycko        | Peter's garrison town, Eastern Front  |
| `arys`            | Arys          | Orzysz         | Military training area near Lotzen    |
| `oester_aabolling`| Oster Aabolling | Oster Aabolling | The family's home farm              |

## Example: looking up Lotzen

### Step 1 -- Find the place

```js
const places = await fetch('https://jernkorset.dk/data/place-pages.json')
  .then(r => r.json());
const loetzen = places.find(p => p.id === 'loetzen');
```

### Step 2 -- Read coordinates and links

```js
console.log(`${loetzen.name} (now ${loetzen.modern_name})`);
console.log(`Coordinates: ${loetzen.lat}, ${loetzen.lng}`);
console.log(`Wikidata: https://www.wikidata.org/wiki/${loetzen.wikidata_id}`);
console.log(`Wikipedia: ${loetzen.wikipedia_url}`);
console.log(`Letters from here: ${loetzen.letter_count}`);
```

### Step 3 -- Browse letters from this place

```js
for (const letter of loetzen.letters) {
  console.log(`Letter ${letter.letter_id} (${letter.date})`);
  console.log(`  ${letter.sender} -> ${letter.recipient}`);
  console.log(`  "${letter.excerpt}"`);
}
```

### Step 4 -- View the place page directly

```
GET https://jernkorset.dk/steder/loetzen/
Accept: text/markdown
```

## Tips

- Use `place-pages.json` when you need letter excerpts and full metadata.
  Use `places.json` when you only need names and coordinates.
- The `id` field is the URL slug -- use it to construct links to the
  place page at `https://jernkorset.dk/steder/{id}/`.
- Not all places have Wikidata or Wikipedia links. Check for null values.
- Letter excerpts in the `letters` array are short previews. Use the
  `read-letter` skill to fetch the full letter text.
- Combine with `borders-1914.json` to determine which country a place
  belonged to when the letters were written.
