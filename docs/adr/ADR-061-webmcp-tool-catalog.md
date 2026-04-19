# ADR-061: WebMCP Tool Catalog Design

## Status

Proposed (2026-04-19)

## Date

2026-04-19

## Context

ADR-060 establishes the WebMCP integration strategy for jernkorset.dk. This ADR defines the exact tool contracts: names, descriptions, input schemas, return shapes, and data source mappings. These definitions serve as the authoritative reference for implementation and for AI agents that discover the tools at runtime.

The site hosts 665 WW1 Danish letters (1911-1918) with rich NLP analysis. All data is pre-computed and served as static JSON from `/data/`. The client-side search engine uses multilingual-e5-small embeddings (384 dimensions) for semantic search in any language.

## Decision

Define 10 WebMCP tools as specified below. All tools return JSON. All tools except `navigate_to` are annotated with `readOnlyHint: true`.

---

### Tool 1: `search_letters`

**Title:** Search Letters

**Description:** Semantic search across 665 WW1 Danish letters (1911-1918) using a multilingual embedding model. Accepts queries in any language -- the model (multilingual-e5-small) handles cross-lingual retrieval. Returns ranked results with letter metadata and relevance scores. Note: the first call may take 5-15 seconds as the search model loads from CDN.

**Annotations:** `{ readOnlyHint: true }`

**Input Schema:**

```json
{
  "type": "object",
  "properties": {
    "query": {
      "type": "string",
      "description": "Natural language search query in any language. Examples: 'longing for home', 'Sehnsucht nach Hause', 'længsel efter hjemmet'"
    },
    "top_k": {
      "type": "integer",
      "minimum": 1,
      "maximum": 50,
      "default": 10,
      "description": "Number of results to return"
    }
  },
  "required": ["query"]
}
```

**Return shape:**

```typescript
{
  results: Array<{
    letterId: number;
    score: number;          // Cosine similarity, 0-1
    date: string;           // ISO date
    sender: string;
    recipient: string;
    place: string;
    snippet: string;        // First ~200 chars of letter text (plain text, no HTML)
  }>;
  totalLetters: number;     // 665
  queryLanguageNote: string; // "Multilingual model -- query language auto-detected"
}
```

**Data source:** `search-engine.ts` singleton (`getSearchEngine().search(query, topK)`), enriched with metadata from `/data/letters.json` and snippets from `/data/search-snippets.json`.

**Implementation notes:** The search engine is lazy-initialized. First call triggers model download (~30MB from CDN). Subsequent calls are fast (~100ms). The `execute` callback must `await engine.init()` if the engine is not yet ready. AbortSignal should be checked before and after model initialization.

---

### Tool 2: `find_similar_letters`

**Title:** Find Similar Letters

**Description:** Find letters semantically similar to a given letter, using pre-computed cosine similarity scores. Useful for discovering thematic connections across the corpus -- for example, finding other letters that discuss similar topics, emotions, or events.

**Annotations:** `{ readOnlyHint: true }`

**Input Schema:**

```json
{
  "type": "object",
  "properties": {
    "letter_id": {
      "type": "integer",
      "minimum": 1,
      "maximum": 665,
      "description": "ID of the source letter"
    },
    "top_k": {
      "type": "integer",
      "minimum": 1,
      "maximum": 20,
      "default": 5,
      "description": "Number of similar letters to return"
    }
  },
  "required": ["letter_id"]
}
```

**Return shape:**

```typescript
{
  sourceLetter: {
    id: number;
    date: string;
    sender: string;
    recipient: string;
  };
  similar: Array<{
    letterId: number;
    score: number;          // Cosine similarity
    date: string;
    sender: string;
    recipient: string;
    place: string;
  }>;
}
```

**Data source:** `/data/related-letters.json` -- keyed by letter ID, each entry is an array of `{ id, score }` pre-sorted by descending similarity. Enriched with metadata from `/data/letters.json`.

---

### Tool 3: `browse_letters`

**Title:** Browse Letters

**Description:** Filter and paginate the letter collection by date range, sender, recipient, or place. Returns letter metadata without full text (use get_letter for full text). Supports pagination for browsing large result sets.

**Annotations:** `{ readOnlyHint: true }`

**Input Schema:**

```json
{
  "type": "object",
  "properties": {
    "date_from": {
      "type": "string",
      "format": "date",
      "description": "Start date (inclusive), ISO format. Earliest: 1911-03-06"
    },
    "date_to": {
      "type": "string",
      "format": "date",
      "description": "End date (inclusive), ISO format. Latest: 1918-08-30"
    },
    "sender": {
      "type": "string",
      "description": "Filter by sender name (case-insensitive substring match)"
    },
    "recipient": {
      "type": "string",
      "description": "Filter by recipient name (case-insensitive substring match)"
    },
    "place": {
      "type": "string",
      "description": "Filter by place name (case-insensitive substring match)"
    },
    "offset": {
      "type": "integer",
      "minimum": 0,
      "default": 0,
      "description": "Number of results to skip (for pagination)"
    },
    "limit": {
      "type": "integer",
      "minimum": 1,
      "maximum": 100,
      "default": 20,
      "description": "Maximum number of results to return"
    }
  },
  "required": []
}
```

**Return shape:**

```typescript
{
  letters: Array<{
    id: number;
    date: string;
    sender: string;
    recipient: string;
    place: string;
  }>;
  total: number;            // Total matching letters (before pagination)
  offset: number;
  limit: number;
  hasMore: boolean;
}
```

**Data source:** `/data/letters.json` -- filtered and paginated in memory. No full text returned to keep responses compact.

---

### Tool 4: `get_letter`

**Title:** Get Letter

**Description:** Fetch a specific WW1 Danish letter by ID. Returns the full letter text in both original archaic Danish and modernized Danish, along with metadata (date, sender, recipient, place, coordinates). Letter IDs range from 1 to 665.

**Annotations:** `{ readOnlyHint: true }`

**Input Schema:**

```json
{
  "type": "object",
  "properties": {
    "letter_id": {
      "type": "integer",
      "minimum": 1,
      "maximum": 665,
      "description": "The letter ID (1-665)"
    },
    "include_analysis": {
      "type": "boolean",
      "default": false,
      "description": "If true, also include sentiment scores, emotion vectors, and narrative arc type"
    }
  },
  "required": ["letter_id"]
}
```

**Return shape:**

```typescript
{
  id: number;
  date: string;                // ISO date
  sender: string;
  recipient: string;
  place: string;
  location: { lat: number; lng: number } | null;
  text_original: string;       // Original archaic Danish (HTML stripped to plain text)
  text_modern: string;         // Modernized Danish (HTML stripped to plain text)
  // Only when include_analysis is true:
  analysis?: {
    sentiment: {
      cvp_mean: number;        // -1 (negative) to +1 (positive)
      cvp_range: number;
      negative_ratio: number;
    };
    emotions: {
      fear_mean: number;
      grief_mean: number;
      hope_mean: number;
      love_mean: number;
      anger_mean: number;
      gratitude_mean: number;
      loneliness_mean: number;
    };
    narrative_arc: {
      arc_type: string;        // "peak" | "flat" | "rising" | "falling" | "valley"
      arc_asymmetry: number;
      sentiment_range: number;
    };
  };
}
```

**Data source:** `/data/letters.json` for core data. When `include_analysis` is true, also fetches `/data/letter-sentiments.json`, `/data/cvp-emotion-scores.json`, and `/data/letter-narrative-arcs.json`. HTML tags are stripped from `text` and `text_modern` fields before returning.

---

### Tool 5: `get_person`

**Title:** Get Person

**Description:** Look up a person mentioned in the WW1 letter corpus. Returns biographical information, role, category, letter references, and known aliases. There are 68 identified persons including the main letter author (Peter Maersk), his wife (Trine), family members, fellow soldiers, and acquaintances.

**Annotations:** `{ readOnlyHint: true }`

**Input Schema:**

```json
{
  "type": "object",
  "properties": {
    "person_id": {
      "type": "string",
      "description": "Person identifier (lowercase slug, e.g., 'peter', 'trine', 'jes'). Use browse with no filter to discover available IDs."
    },
    "include_letters": {
      "type": "boolean",
      "default": false,
      "description": "If true, include the list of letters mentioning this person (IDs and dates)"
    },
    "include_network": {
      "type": "boolean",
      "default": false,
      "description": "If true, include social network metrics (centrality, connections)"
    }
  },
  "required": ["person_id"]
}
```

**Return shape:**

```typescript
{
  id: string;
  full_name: string;
  canonical: string;          // Short display name
  role: string;
  category: string;           // "family" | "military" | "community" | etc.
  biographical: string;       // Rich biographical text
  birth_date: string | null;
  death_date: string | null;
  aliases: string[];
  first_mention: string;      // ISO date
  last_mention: string;       // ISO date
  letter_count: number;
  photos: string[];           // Photo filenames
  // Only when include_letters is true:
  letters?: Array<{ letter_id: number; date: string; sender: string; recipient: string }>;
  // Only when include_network is true:
  network?: {
    degree_centrality: number;
    betweenness_centrality: number;
    pagerank: number;
    connections: Array<{ person_id: string; canonical: string; weight: number }>;
  };
}
```

**Data source:** `/data/person-registry.json` for core data. `/data/person-pages.json` for letter references (when `include_letters` is true). `/data/social-network.json` for network metrics and edges (when `include_network` is true).

---

### Tool 6: `get_place`

**Title:** Get Place

**Description:** Look up a place referenced in the WW1 letter corpus. Returns coordinates, modern name, country, Wikidata link, and letters written from that location. Covers 75 places across Denmark, Germany, Poland, France, Belgium, and Russia.

**Annotations:** `{ readOnlyHint: true }`

**Input Schema:**

```json
{
  "type": "object",
  "properties": {
    "place_id": {
      "type": "string",
      "description": "Place identifier (lowercase slug, e.g., 'loetzen', 'arys', 'oester_aabolling'). Use browse_letters with a place filter to discover place names."
    },
    "include_letters": {
      "type": "boolean",
      "default": false,
      "description": "If true, include the list of letters written from this place"
    }
  },
  "required": ["place_id"]
}
```

**Return shape:**

```typescript
{
  id: string;
  name: string;               // Historical name used in letters
  modern_name: string | null; // Current name
  country: string;
  lat: number;
  lng: number;
  wikidata_id: string | null;
  wikipedia_url: string | null;
  letter_count: number;
  photos: string[];
  // Only when include_letters is true:
  letters?: Array<{ letter_id: number; date: string; sender: string; recipient: string }>;
}
```

**Data source:** `/data/place-pages.json` (keyed by place ID, includes letter lists). Falls back to `/data/places.json` for basic coordinate data.

---

### Tool 7: `get_social_network`

**Title:** Get Social Network

**Description:** Query the social network graph extracted from the letter corpus. The network has 65 persons and 209 edges representing co-mention relationships. Includes centrality metrics, temporal persistence, and disappearance analysis (persons who stop being mentioned, possibly due to death or separation during the war).

**Annotations:** `{ readOnlyHint: true }`

**Input Schema:**

```json
{
  "type": "object",
  "properties": {
    "person_id": {
      "type": "string",
      "description": "Optional: filter to show only a specific person's connections. Omit to get the full network summary."
    },
    "include_edges": {
      "type": "boolean",
      "default": false,
      "description": "If true, include the full edge list (209 edges). Can be large."
    },
    "include_temporal": {
      "type": "boolean",
      "default": false,
      "description": "If true, include temporal network slices showing how the network evolved year by year"
    }
  },
  "required": []
}
```

**Return shape:**

```typescript
{
  metadata: {
    node_count: number;
    edge_count: number;
    generated: string;
  };
  global_metrics: {
    density: number;
    avg_degree: number;
    // ... additional graph-level metrics
  };
  // When person_id is provided: single node + its edges
  // When person_id is omitted: top nodes by PageRank
  nodes: Array<{
    id: string;
    canonical: string;
    category: string;
    role: string;
    letter_count: number;
    degree_centrality: number;
    betweenness_centrality: number;
    pagerank: number;
    disappeared: boolean;
    silence_date: string | null;
  }>;
  // Only when include_edges is true:
  edges?: Array<{ source: string; target: string; weight: number; letters: number[] }>;
  // Only when include_temporal is true:
  temporal_slices?: Array<{ year: number; node_count: number; edge_count: number }>;
}
```

**Data source:** `/data/social-network.json` -- contains `nodes`, `edges`, `temporal_slices`, `global_metrics`, and `disappearance_analysis`.

---

### Tool 8: `get_sentiment`

**Title:** Get Sentiment Analysis

**Description:** Get sentiment and emotion analysis for a specific letter or a date range. Uses CVP (Contextualized Valence Polarity) scores ranging from -1 (most negative) to +1 (most positive), plus 7 emotion dimensions: fear, grief, hope, love, anger, gratitude, and loneliness. For date ranges, returns monthly aggregates showing emotional trends over time -- useful for tracking how the war affected the letter writer's emotional state.

**Annotations:** `{ readOnlyHint: true }`

**Input Schema:**

```json
{
  "type": "object",
  "properties": {
    "letter_id": {
      "type": "integer",
      "minimum": 1,
      "maximum": 665,
      "description": "Get sentiment for a specific letter. Mutually exclusive with date_from/date_to."
    },
    "date_from": {
      "type": "string",
      "format": "date",
      "description": "Start of date range (inclusive). Use with date_to for trend analysis."
    },
    "date_to": {
      "type": "string",
      "format": "date",
      "description": "End of date range (inclusive). Use with date_from for trend analysis."
    }
  },
  "required": []
}
```

**Return shape (single letter):**

```typescript
{
  letter_id: number;
  date: string;
  sentiment: {
    cvp_mean: number;
    cvp_min: number;
    cvp_p10: number;
    cvp_p90: number;
    cvp_range: number;
    negative_ratio: number;
    sentence_count: number;
  };
  emotions: {
    fear_mean: number;
    grief_mean: number;
    hope_mean: number;
    love_mean: number;
    anger_mean: number;
    gratitude_mean: number;
    loneliness_mean: number;
  };
  dominant_emotion: string;   // The emotion with highest mean score
}
```

**Return shape (date range):**

```typescript
{
  date_from: string;
  date_to: string;
  letter_count: number;
  monthly_trend: Array<{
    month: string;            // "YYYY-MM"
    mean_sentiment: number;
    letter_count: number;
  }>;
  period_summary: {
    avg_sentiment: number;
    most_positive_letter: { id: number; date: string; cvp_mean: number };
    most_negative_letter: { id: number; date: string; cvp_mean: number };
    dominant_emotion: string;
  };
}
```

**Data source:** `/data/letter-sentiments.json` and `/data/cvp-emotion-scores.json` for per-letter data. `/data/sentiment-overview.json` for pre-computed monthly rolling averages (used to accelerate date-range queries). `/data/letters.json` for date mapping.

**Implementation notes:** When neither `letter_id` nor date range is provided, return the full corpus summary from `sentiment-overview.json`. When `letter_id` is provided, `date_from`/`date_to` are ignored.

---

### Tool 9: `get_narrative_arc`

**Title:** Get Narrative Arc

**Description:** Get the emotional narrative arc for a specific letter or across letters in a time period. Each letter is classified into an arc type: "peak" (positive climax), "valley" (negative nadir), "rising" (increasingly positive), "falling" (increasingly negative), or "flat" (stable sentiment). For time periods, returns the distribution of arc types and the overall emotional trajectory -- revealing how writing patterns changed as the war progressed.

**Annotations:** `{ readOnlyHint: true }`

**Input Schema:**

```json
{
  "type": "object",
  "properties": {
    "letter_id": {
      "type": "integer",
      "minimum": 1,
      "maximum": 665,
      "description": "Get narrative arc for a specific letter"
    },
    "date_from": {
      "type": "string",
      "format": "date",
      "description": "Start of date range for arc distribution analysis"
    },
    "date_to": {
      "type": "string",
      "format": "date",
      "description": "End of date range for arc distribution analysis"
    }
  },
  "required": []
}
```

**Return shape (single letter):**

```typescript
{
  letter_id: number;
  date: string;
  arc_type: string;           // "peak" | "valley" | "rising" | "falling" | "flat"
  arc_asymmetry: number;      // How skewed the emotional arc is
  sentiment_range: number;    // Max - min sentiment within the letter
  sentence_count: number;
}
```

**Return shape (date range):**

```typescript
{
  date_from: string;
  date_to: string;
  letter_count: number;
  arc_distribution: {
    peak: number;             // Count of letters with each arc type
    valley: number;
    rising: number;
    falling: number;
    flat: number;
  };
  avg_sentiment_range: number;
  avg_asymmetry: number;
  trend_description: string;  // Generated summary, e.g., "Letters shift from predominantly rising arcs to falling arcs after mid-1916"
}
```

**Data source:** `/data/letter-narrative-arcs.json` -- contains `within_letter` (per-letter arcs keyed by ID), `across_letters` (temporal trends), and `arc_type_distribution`. `/data/letters.json` for date mapping.

**Implementation notes:** The `trend_description` for date-range queries is computed client-side by comparing arc type distributions across the period halves. This is a simple heuristic, not an LLM-generated summary.

---

### Tool 10: `navigate_to`

**Title:** Navigate to Page

**Description:** Navigate the browser to a specific page on jernkorset.dk. Can navigate to a letter detail page, a person page, a place page, or the main views (letter list, map, search, network graph, sentiment explorer). This is the only tool with a side effect -- it changes what the user sees in the browser.

**Annotations:** `{ readOnlyHint: false }`

**Input Schema:**

```json
{
  "type": "object",
  "properties": {
    "target": {
      "type": "string",
      "enum": ["letter", "person", "place", "view"],
      "description": "Type of page to navigate to"
    },
    "id": {
      "type": ["string", "integer"],
      "description": "The entity ID. For letters: integer (1-665). For persons/places: string slug. For views: one of 'letters', 'map', 'search', 'network', 'sentiment', 'embeddings'."
    }
  },
  "required": ["target", "id"]
}
```

**Return shape:**

```typescript
{
  navigated: true;
  url: string;                // The URL navigated to, e.g., "/letters/42"
  target: string;
  id: string | number;
}
```

**Route mapping:**

| target | id | URL |
|---|---|---|
| `letter` | `42` | `/letters/42` |
| `person` | `"peter"` | `/persons/peter` |
| `place` | `"loetzen"` | `/places/loetzen` |
| `view` | `"letters"` | `/letters` |
| `view` | `"map"` | `/map` |
| `view` | `"search"` | `/search` |
| `view` | `"network"` | `/network` |
| `view` | `"sentiment"` | `/sentiment` |
| `view` | `"embeddings"` | `/embeddings` |

**Data source:** None -- uses Next.js `router.push()` for client-side navigation.

**Implementation notes:** Validates that the target entity exists before navigating (e.g., checks that letter ID is in range, person ID exists in registry). Returns an error if the target is invalid rather than navigating to a 404.

---

## Registration summary

| # | Tool name | Title | readOnly | Primary data source | Category |
|---|---|---|---|---|---|
| 1 | `search_letters` | Search Letters | yes | `search-engine.ts` + `letters.json` | Search |
| 2 | `find_similar_letters` | Find Similar Letters | yes | `related-letters.json` | Search |
| 3 | `browse_letters` | Browse Letters | yes | `letters.json` | Search |
| 4 | `get_letter` | Get Letter | yes | `letters.json` + analysis JSONs | Retrieval |
| 5 | `get_person` | Get Person | yes | `person-registry.json` + `person-pages.json` | Retrieval |
| 6 | `get_place` | Get Place | yes | `place-pages.json` + `places.json` | Retrieval |
| 7 | `get_social_network` | Get Social Network | yes | `social-network.json` | Retrieval |
| 8 | `get_sentiment` | Get Sentiment Analysis | yes | `letter-sentiments.json` + `cvp-emotion-scores.json` | Analysis |
| 9 | `get_narrative_arc` | Get Narrative Arc | yes | `letter-narrative-arcs.json` | Analysis |
| 10 | `navigate_to` | Navigate to Page | **no** | Next.js router | Navigation |

## Alternatives considered

1. **Fewer tools with more parameters** (e.g., a single `query` tool that accepts a sub-command) -- Rejected. The WebMCP spec encourages granular tools with clear names and schemas. A single mega-tool would produce worse agent behavior because the description and schema would be too broad for reliable parameter inference.

2. **Include letter full text in browse_letters results** -- Rejected. With 665 letters averaging several paragraphs each, returning full text in browse results would produce multi-megabyte responses. Agents should use `browse_letters` for discovery, then `get_letter` for full text.

3. **Expose raw JSON files as tools** (e.g., `fetch_data_file(filename)`) -- Rejected. Raw JSON dumps are not agent-friendly. Structured tools with semantic names, typed parameters, and curated return shapes produce far better agent comprehension and reliability.

4. **Add a `summarize_letter` tool** -- Deferred. The `/data/letter-summaries.json` file exists, but summaries could be added as an optional field on `get_letter` in a future iteration without changing the tool contract.

5. **Add an `analyze_writing_style` tool using psycholinguistic data** -- Deferred. The `/data/letter-psycholinguistics.json` data is available but would benefit from more design work on what aspects to expose. Can be added as tool 11 without modifying existing tools.

## Consequences

### Positive

- Agents get a well-typed, semantically clear interface to the full corpus and all NLP analysis
- Tool descriptions are optimized for AI comprehension with concrete examples and value ranges
- The catalog is extensible -- new tools can be added without modifying existing definitions
- Input validation (min/max on IDs, enum constraints on target types) prevents agent errors early

### Negative

- 10 tools is a moderately large surface area for agents to reason about; some agents may perform better with fewer tools
- The `search_letters` tool has a cold-start latency (~5-15 seconds) that agents must account for

### Neutral

- Tool names use snake_case per WebMCP convention (matches the `[a-zA-Z0-9_.-]` character class requirement)
- Return shapes are documented here but not enforced by a runtime schema validator -- implementation must match these contracts
