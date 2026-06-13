# ADR-060: WebMCP Integration Strategy

## Status

Implemented (2026-04-19, commit 8c4a466)

## Date

2026-04-19

## Context

The W3C WebMCP draft specification (April 2026) introduces `navigator.modelContext.registerTool()`, allowing web pages to expose structured tool capabilities to in-browser AI agents. This is a natural fit for jernkorset.dk: the site already has rich client-side data infrastructure (665 WW1 letters, pre-computed NLP analysis, client-side semantic search with multilingual embeddings) and existing machine-readable discovery via `/.well-known/api-catalog` (RFC 9727) and OpenAPI 3.1 schema.

WebMCP complements the existing agent discovery layer. Where the OpenAPI schema describes static JSON endpoints for server-side agents, WebMCP exposes live in-browser capabilities -- including the semantic search engine that requires a loaded ML model and cannot be replicated by a static API.

### Current capabilities available for exposure

| Capability | Data source | Notes |
|---|---|---|
| Semantic search | `search-engine.ts` singleton + `embeddings.bin` (384d) | Multilingual, ~30MB model from CDN, lazy-loaded |
| Letter corpus | `/data/letters.json` (665 entries) | Full text in original + modern Danish |
| Person registry | `/data/person-registry.json` (68 persons) | Biography, aliases, photos, dates |
| Place registry | `/data/places.json` + `/data/place-pages.json` (75 places) | Coordinates, Wikidata, country |
| Sentiment analysis | `/data/letter-sentiments.json`, `/data/cvp-emotion-scores.json` | Per-letter CVP scores + 7 emotion dimensions |
| Social network | `/data/social-network.json` | 65 nodes, 209 edges, centrality metrics, temporal slices |
| Related letters | `/data/related-letters.json` | Pre-computed cosine similarity, top-5 per letter |
| Narrative arcs | `/data/letter-narrative-arcs.json` | Per-letter arc type + cross-letter trends |
| Sentiment overview | `/data/sentiment-overview.json` | Monthly rolling averages |
| Letter summaries | `/data/letter-summaries.json` | AI-generated summaries |

## Decision

Implement WebMCP tool registration as a progressive enhancement module that exposes 10 tools covering search, data retrieval, analysis, and navigation. Follow the SPARC methodology for structured design.

### S -- Specification

#### Tool inventory

Ten tools organized into three categories:

**Search & Discovery**
1. `search_letters` -- Semantic search across the full corpus using the in-browser multilingual model
2. `find_similar_letters` -- Find letters similar to a given letter using pre-computed cosine similarity
3. `browse_letters` -- Filter and paginate letters by date range, sender, recipient, or place

**Data Retrieval**
4. `get_letter` -- Fetch a specific letter by ID with full text, metadata, and NLP analysis
5. `get_person` -- Look up a person by ID with biography, connections, and letter references
6. `get_place` -- Look up a place with coordinates, Wikidata links, and letter references
7. `get_social_network` -- Query the social network graph with optional filtering

**Analysis**
8. `get_sentiment` -- Get sentiment and emotion analysis for a letter or date range
9. `get_narrative_arc` -- Get emotional/thematic arc data for a letter or time period

**Navigation**
10. `navigate_to` -- Navigate the browser to a specific letter, person, or place page

#### Design principles

- All tools are `readOnlyHint: true` except `navigate_to`
- Tools that return letter text include both original and modern Danish
- All tools return structured JSON that agents can reason about
- Descriptions are in English, optimized for AI agent comprehension
- The search engine model is NOT loaded until an agent actually calls `search_letters`

### P -- Pseudocode

#### Feature detection and registration

```
function registerWebMCPTools():
    if navigator.modelContext is undefined:
        return  // Browser does not support WebMCP

    for each tool in TOOL_DEFINITIONS:
        navigator.modelContext.registerTool(tool.definition, {
            execute: tool.handler
        })

// Registration timing: after DOMContentLoaded, non-blocking
if document.readyState === "loading":
    document.addEventListener("DOMContentLoaded", registerWebMCPTools)
else:
    queueMicrotask(registerWebMCPTools)
```

#### Lazy data loading pattern

```
// Data cache -- fetch JSON only when an agent first needs it
const dataCache = new Map<string, any>()

async function getData(path: string):
    if dataCache.has(path):
        return dataCache.get(path)
    
    response = await fetch(path)
    data = await response.json()
    dataCache.set(path, data)
    return data

// Search engine -- only init when search_letters is called
async function handleSearchLetters(input, client):
    engine = getSearchEngine()
    if not engine.isReady():
        await engine.init()  // This triggers model download
    
    results = await engine.search(input.query, input.top_k)
    // Enrich results with letter metadata
    letters = await getData("/data/letters.json")
    return results.map(r => enrichWithMetadata(r, letters))
```

#### AbortSignal handling

```
async function executeWithAbort(input, client, handler):
    if client.signal.aborted:
        throw new DOMException("Aborted", "AbortError")
    
    // Set up abort listener for long operations
    abortPromise = new Promise((_, reject) =>
        client.signal.addEventListener("abort", () =>
            reject(new DOMException("Aborted", "AbortError"))
        )
    )
    
    return Promise.race([handler(input), abortPromise])
```

### A -- Architecture

#### File organization

```
apps/website/src/lib/
    webmcp/
        index.ts            -- Feature detection + registration entry point
        tools/
            search.ts       -- search_letters, find_similar_letters, browse_letters
            retrieval.ts    -- get_letter, get_person, get_place, get_social_network
            analysis.ts     -- get_sentiment, get_narrative_arc
            navigation.ts   -- navigate_to
        data-loader.ts      -- Cached JSON fetcher for /data/*.json
        types.ts            -- Shared TypeScript types for tool I/O
```

A single module per tool category keeps files small (well under 500 lines each) while grouping related functionality. The `index.ts` entry point handles feature detection and orchestrates registration.

#### Integration with existing code

- `search_letters` and `find_similar_letters` import from the existing `search-engine.ts` singleton -- no duplication of search logic
- `data-loader.ts` provides a thin caching layer over `fetch()` for the static JSON files. This avoids re-fetching `/data/letters.json` if multiple tools need it in the same session
- `navigate_to` uses Next.js `router.push()` for client-side navigation (no full page reload)

#### Data flow

```
Agent request
    |
    v
navigator.modelContext
    |
    v
Tool execute callback
    |
    +---> data-loader.ts ---> /data/*.json (cached)
    |
    +---> search-engine.ts singleton (lazy init)
    |
    +---> Next.js router (navigate_to only)
    |
    v
Structured JSON response to agent
```

### R -- Refinement

#### Progressive enhancement

The entire WebMCP module is a no-op on browsers without support. The feature detection check (`'modelContext' in navigator`) runs once; if false, no event listeners, no imports, no memory overhead.

#### Performance considerations

1. **Registration is synchronous and fast.** Tool definitions are plain objects. No data is fetched at registration time.
2. **Search model is lazy-loaded.** The ~30MB multilingual-e5-small model downloads only when an agent calls `search_letters` for the first time. This is the same behavior as the existing search UI.
3. **JSON data is fetched once and cached.** The `data-loader.ts` cache means that a sequence of tool calls (e.g., `get_letter` then `get_sentiment` for the same letter) does not re-fetch `letters.json`.
4. **No bundle impact.** The WebMCP module can be dynamically imported only after feature detection succeeds, keeping the main bundle unaffected for non-WebMCP browsers.

#### Graceful degradation

| Scenario | Behavior |
|---|---|
| Browser lacks WebMCP | Module skipped entirely |
| Agent calls `search_letters` before model loads | Tool awaits `engine.init()`, returns results when ready |
| Network error fetching data JSON | Tool returns structured error with message |
| Agent sends AbortSignal | Long operations (search) abort cleanly |
| Duplicate tool name | Caught by WebMCP spec (InvalidStateError) -- should not happen since we control registration |

#### Security

- All tools run in SecureContext (HTTPS) -- jernkorset.dk is served via Cloudflare Pages over HTTPS
- No tool modifies server-side state (the site is fully static)
- `navigate_to` is the only tool with side effects (changing the visible page), and it is constrained to same-origin routes
- No tool exposes credentials, API keys, or user data

### C -- Completion

#### Testing strategy

1. **Unit tests** for each tool handler: mock `fetch()` responses and verify correct output shapes
2. **Integration test**: load the WebMCP module in a browser environment (Playwright) and verify tools are registered on `navigator.modelContext`
3. **Manual validation**: use a WebMCP-capable browser (or polyfill) to interact with the tools via an AI agent
4. **Schema validation**: ensure all tool `inputSchema` definitions match the actual parameter handling
5. **isitagentready.com**: run the scanner against the deployed site to verify WebMCP discovery

#### Rollout plan

1. Implement `data-loader.ts` and tool handler functions with unit tests
2. Implement `index.ts` registration with feature detection
3. Add dynamic import of the WebMCP module to the site's root layout
4. Deploy to preview branch on Cloudflare Pages
5. Validate with isitagentready.com scanner
6. Merge to production

## Alternatives considered

1. **Expose tools via a Service Worker instead of page context** -- Rejected. The WebMCP spec scopes tools to page context. Service Workers have a different lifecycle and cannot access `navigator.modelContext`.

2. **Register all tools in a single file** -- Rejected. With 10 tools, a single file would exceed 500 lines and mix unrelated concerns. The modular approach (one file per category) is more maintainable.

3. **Pre-load the search model at registration time** -- Rejected. The model is ~30MB and takes several seconds to download. Pre-loading would penalize every page visit, even when no agent is present. Lazy loading on first `search_letters` call preserves the current user experience.

4. **Expose only read-only tools, skip navigate_to** -- Rejected. Navigation is a valuable agent capability (e.g., "show me the letter where Peter describes the trenches") and the side effect is minimal (changing the visible URL within the same site).

5. **Wait for WebMCP to reach W3C Recommendation status** -- Rejected. The draft is stable enough for progressive enhancement. If the API changes, the impact is limited to the WebMCP module; the rest of the site is unaffected.

## Consequences

### Positive

- AI agents running in WebMCP-capable browsers gain structured access to the full letter corpus, semantic search, NLP analysis, and social network data
- The existing search engine and data layer are reused without duplication
- Progressive enhancement means zero impact on browsers without WebMCP support
- Lazy loading preserves current performance characteristics
- Complements the existing RFC 9727 / OpenAPI discovery layer with live in-browser capabilities

### Negative

- New code to maintain (~400-500 lines across the module)
- WebMCP is a draft specification; breaking changes may require updates
- Testing requires a WebMCP-capable browser or polyfill, which may not yet be widely available

### Neutral

- The tool catalog (ADR-061) defines the exact contracts and can be updated independently of the implementation
- The modular architecture allows adding new tools without modifying existing ones
