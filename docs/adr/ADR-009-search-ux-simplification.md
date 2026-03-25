# ADR-009: Search UX Simplification

## Status
Accepted (implemented 2026-03-25)

## Context

GitHub Issue [#5](https://github.com/dalager/jernkorsetbreve/issues/5) reports that the search page "reveals too much of the underlying technology." An audit of the current implementation (`webapp/public-site/src/app/search/page.tsx`) confirms several UX problems:

### Current Problems

1. **Performance dashboard exposed to all users.** Three `StatBox` components display "Model" load time, "Embeddings" load time, and "Search time" with technical subtitles like `gte-small (flersproget)` and `cosine similarity`. These are developer metrics, not user-facing information.

2. **Status messages expose internals.** During model loading, the status reads `"Henter AI-model: ${filename} (${progress}%)"`, showing individual ONNX file download progress. Users see file names like `model_quantized.onnx` scrolling by.

3. **Error messages are developer-oriented.** The error block mentions `embeddings.bin` by name and suggests "Kor build-data scriptet for at oprette den" -- instructions only a developer would understand.

4. **Technical jargon in title and subtitle.** The page title "Semantisk Brevsogning" and subtitle "AI-drevet sogning" use technical terms that don't help users understand what the page does.

5. **Search input is disabled during loading.** The input shows `disabled:opacity-40 disabled:cursor-not-allowed` while the engine initializes, making the page feel broken rather than loading. Users cannot start typing their query while waiting.

6. **No distinction between first visit and cached visit.** First-time users (5-15 second load) and returning users (<1 second load) see the same loading experience.

### Files Involved

| File | Lines | Role |
|------|-------|------|
| `webapp/public-site/src/app/search/page.tsx` | 475 | Full search page UI, StatBox component |
| `webapp/public-site/src/lib/search-engine.ts` | 316 | Engine state (status, progress, file names) |

## Decision

### 1. Remove the Performance Dashboard

Delete the 3-column `StatBox` grid (lines 248-280 in `search/page.tsx`) entirely. Do not replace it with a collapsed/toggleable version -- this adds complexity for a feature that serves no user need.

The `StatBox` component at lines 448-474 can also be deleted since it has no other consumers.

### 2. Rewrite Status Messages in Plain Danish

Replace all technical status messages in the `statusText()` function:

| Current Status | Current Message | New Message |
|----------------|-----------------|-------------|
| `idle` | `"Starter..."` | `"Forbereder sogning..."` |
| `loading-model` | `"Henter AI-model: ${filename} (${progress}%)"` | `"Forbereder sogemaskinen..."` (with progress bar only) |
| `loading-model` (no progress) | `"Henter AI-model (~33 MB, caches efter forste gang)..."` | `"Forbereder sogemaskinen..."` |
| `loading-embeddings` | `"Indlaeser brev-embeddings..."` | `"Indlaeser brevdata..."` |
| `searching` | `"Soger..."` | `"Soger..."` (unchanged, already fine) |
| `ready` | `"Klar! Sog i ${count} breve."` | `"Klar! Sog i ${count} breve."` (unchanged) |
| `error` | `"Fejl: ${error}"` | `"Noget gik galt. Prov at genindlaese siden."` |

The `modelProgressFile` field from `SearchEngineState` should no longer be rendered anywhere in the UI. The numeric `modelProgress` remains used by the progress bar.

### 3. Simplify Error State

Replace the current error block (lines 405-416) which mentions `embeddings.bin` and build scripts with:

```
Sogemaskinen kunne ikke starte.
Prov at genindlaese siden. Kontakt os hvis problemet fortsaetter.
```

No `<code>` blocks, no developer instructions.

### 4. Simplify Title and Subtitle

| Element | Current | Proposed |
|---------|---------|----------|
| Page title (`<h1>`) | "Semantisk Brevsogning" | "Brevsogning" |
| Subtitle | "AI-drevet sogning i breve fra 1. verdenskrig -- alt korer i din browser" | "Find breve efter emne eller indhold" |

### 5. Enable Typing During Load (Progressive Input)

Remove `disabled={!isReady}` from the search input. Instead:

- Always allow typing in the input field
- Store the typed query in state
- When engine becomes ready, auto-execute the pending query (the `subscribe` callback already handles this pattern for `initialQuery` from URL params -- extend to user-typed queries)
- Show a subtle placeholder change: `"Sogemaskinen forberedes..."` while loading, `"Sog efter breve..."` when ready
- Similarly, keep example query pills visible but show a brief loading state when clicked before engine is ready

### 6. Add First-Visit Messaging

When model loading takes longer than 3 seconds, show a reassuring message below the progress bar:

> "Forste gang tager det lidt laengere. Naeste gang er det hurtigere."

This disappears once loading completes and does not appear on subsequent visits (engine transitions to `ready` quickly when cached).

### 7. Simplify Footer Note

Change the current footer:

> **Alt korer i din browser** -- ingen data sendes til en server. Modellen caches efter forste indlaesning.

To:

> Sogningen sker lokalt i din browser -- ingen data sendes videre.

Remove the mention of "modellen" (model).

## Consequences

### Positive
- Search page feels like a product feature, not a tech demo
- Users can start typing immediately, reducing perceived wait time
- Error states are actionable for end users
- First-time visitors get reassurance about the one-time loading cost
- No changes needed to `search-engine.ts` -- all changes are in the presentation layer

### Negative
- Developers lose the at-a-glance performance dashboard (can still use browser DevTools Network tab)
- Exact model file progress is hidden (the overall progress bar remains)

### Migration
- No data migration needed
- No API changes
- Purely UI changes in `search/page.tsx`

## Validation
- Manual check: no model names, file names, load times, or technical terms visible by default
- E2E test for search page still passes (search functionality unchanged)
- Lighthouse accessibility score maintained or improved
