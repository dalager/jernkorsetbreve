# ADR-041: Moderne Sprog Toggle — User-Facing Text Modernization

## Status

Accepted (2026-04-03)

## Date

2026-04-03

## Context

The jernkorsetbreve pipeline already produces modernized text for all 665 letters (ADR-014), and stores it in `normalized-letters.json` with a `text_normalized` field. The build script (`build-data.mjs`) loads this into `modernizedTextMap` and writes `text_modern` to `search-corpus.json` for embedding/search use. However, the modernized text is **not exposed to users** on the letter detail pages.

Users reading the archaic Danish (1911–1918) encounter pre-1948 spelling (`saa` → `så`, `aa` → `å`), archaic verb forms (`skulde` → `skulle`), German military loanwords (`Hauptmand` → `kaptajn`), and South Jutlandic dialect features. This creates a barrier for contemporary Danish readers.

### Relationship to Existing ADRs

- **ADR-014** (Archaic Danish Modernization): Defines the normalization pipeline that produces the modernized text. This ADR exposes that text to end users.
- **ADR-039** (Multi-Layer Text Architecture): Defines the three-layer text model (raw → corrected → normalized). The toggle switches between the corrected layer (displayed as "original") and the normalized layer (displayed as "moderne dansk").

### Current Data Flow

```
letters.csv (text_original)
  → normalize-danish.mjs → normalized-letters.json (text_normalized)
    → build-data.mjs → search-corpus.json (text_modern) ✅
    → build-data.mjs → letters.json (text only, NO text_modern) ❌ gap
```

## Decision

Add a **toggle control** on each letter detail page that switches between the original text and the modernized version. The toggle state persists across navigation via `localStorage`.

### Implementation

**Data layer:**
1. Add `text_modern?: string` to the `Letter` TypeScript interface
2. Emit `text_modern` from `build-data.mjs` into `letters.json` (the `modernizedTextMap` is already loaded; ~5-line change)
3. Convert plain text (`\n\n` paragraph breaks) to HTML (`<p>` tags) to match the existing `text` field format

**Frontend layer:**
4. Create a `LetterContent` client component (`"use client"`) with toggle UI
5. Persist toggle state to `localStorage` key `jernkorset-text-mode` (`"original"` | `"modern"`)
6. Default to `"original"` on server render; read `localStorage` in `useEffect` to avoid hydration mismatch
7. Show toggle only when `text_modern` is available for the letter
8. Replace the `dangerouslySetInnerHTML` block in `app/letters/[id]/page.tsx` with the new component

**Testing:**
9. Add E2E tests: toggle visibility, text switching, persistence across navigation

### UI Design

Follow the existing project aesthetic. The `BorderToggle.tsx` component (historical map borders) provides a design precedent. Use Danish labels: **"Original"** / **"Moderne dansk"**. Place the toggle above the letter text, aligned with the existing content layout.

## Alternatives Considered

| Alternative | Pros | Cons | Decision |
|---|---|---|---|
| **Side-by-side view** | Shows differences directly | Requires wider viewport; poor mobile experience; complex layout | Rejected — toggle is simpler and works on all devices |
| **Inline diff highlighting** | Shows exact changes | Visually noisy for 665 letters of varying length; complex implementation | Rejected — could be a future enhancement |
| **URL-based state** (`?mode=modern`) | Shareable links; SEO | Increases page variants; static export would need to handle query params | Rejected — localStorage is simpler for personal preference |
| **Cookie-based state** | Works without JS on first load | Requires server-side rendering; site is static export | Rejected — not compatible with `output: "export"` |

## Consequences

### Positive
- Users can read letters in contemporary Danish
- Educational value: users can compare archaic and modern Danish
- Leverages existing pipeline output — minimal data work needed
- Consistent with existing toggle pattern (BorderToggle)

### Negative
- `letters.json` grows by ~1.3 MB (modernized text for all 665 letters) — acceptable for static site
- Adds a client component boundary in the letter page — minimal performance impact since only the text area becomes client-side

### Risks
- Hydration mismatch if localStorage is read during SSR → mitigated by `useEffect` pattern
- Paragraph structure differences between original HTML and modernized plain text → build script handles conversion
