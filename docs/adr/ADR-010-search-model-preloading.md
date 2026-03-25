# ADR-010: Search Model Preloading Strategy

## Status
Accepted (implemented 2026-03-25)

## Context

GitHub Issue [#5](https://github.com/dalager/jernkorsetbreve/issues/5) asks whether loading the ML model in the background *before* the search page is visited is a viable option.

### Current Behavior

The search engine (`SearchEngine` singleton in `search-engine.ts`) only initializes in two places:

1. **`/search/` page** -- `page.tsx` calls `engine.init()` in a `useEffect` on mount.
2. **`SearchBox` in the header** -- subscribes to engine state but does **not** call `init()`. When the user focuses the input and the engine isn't ready, it *redirects* to `/search/` instead of starting initialization. This means clicking the header search box navigates away from the current page.

No preloading or prefetching of the model happens on any other page (home, letters, timeline, map, etc.).

### Loading Cost Breakdown

Based on analysis of the actual cached model files in `.cache/models/Xenova/gte-small/`:

| Asset | Size | Source | Cached After First Load |
|-------|------|--------|------------------------|
| transformers.js v3 core | ~2 MB | cdn.jsdelivr.net | Yes (HTTP cache) |
| `model.onnx` (unquantized) | **127 MB** | huggingface.co | Yes (browser + transformers.js internal cache) |
| `config.json` | 601 B | huggingface.co | Yes |
| `tokenizer.json` | 695 KB | huggingface.co | Yes |
| `tokenizer_config.json` | 557 B | huggingface.co | Yes |
| `embeddings.bin` | 998 KB | Own domain (static) | Yes |
| `embedding-index.json` | 18 KB | Own domain (static) | Yes |

**Critical finding:** The local cache contains the **unquantized** `model.onnx` at 127 MB. In the browser, transformers.js v3 defaults to downloading the quantized variant (`model_quantized.onnx`, ~33 MB) when available. However, the current code does not explicitly request quantization -- see ADR-011 for the model hosting decision.

**Regardless of quantization, first-visit load is 33-127 MB.** After the first visit, the browser cache makes subsequent loads near-instant (<1 second).

### User Navigation Patterns

The site has 7 main sections: Breve (home), Sog, Tidslinje, Kort, Statistik, Udforsk, Om. A typical user will browse letters first, then may use search. This means there is often a window of 10-60 seconds between first page load and search use -- enough time to preload in the background.

## Decision

### 1. Add a Background Preloader Component

Create a new `SearchPreloader.tsx` component that renders nothing visually but starts the search engine initialization in the background after a delay:

```tsx
// webapp/public-site/src/components/SearchPreloader.tsx
"use client";
import { useEffect } from "react";
import { getSearchEngine } from "@/lib/search-engine";

export default function SearchPreloader() {
  useEffect(() => {
    const timer = setTimeout(() => {
      // Respect users on slow/metered connections
      const conn = (navigator as any).connection;
      if (conn?.saveData || conn?.effectiveType === "2g") return;

      getSearchEngine().init().catch(() => {
        // Silently fail -- search page will show its own error if needed
      });
    }, 3000); // 3 second delay to prioritize visible content rendering

    return () => clearTimeout(timer);
  }, []);

  return null;
}
```

Mount in `layout.tsx` after `<Header />`:

```tsx
<Header />
<SearchPreloader />
<main className="flex-grow">{children}</main>
```

### 2. Fix SearchBox Focus Behavior

The current `handleFocus` in `SearchBox.tsx` redirects to `/search/` when the engine isn't ready. This is disruptive -- clicking the search box navigates you away from your current page.

Change to:
- **On focus:** If engine is not yet initializing, call `getSearchEngine().init()` (idempotent due to singleton). Show the input as normal. Set placeholder to `"Forbereder sogning..."`.
- **On typing:** Allow typing immediately. If the engine isn't ready, show a "loading" state in the dropdown instead of results.
- **On Enter:** Always navigate to `/search/?q=...` (unchanged).
- **Remove the redirect-on-focus behavior entirely.**

This means the SearchBox becomes a dual-purpose component: quick inline search when the engine is ready, and a gateway to the full search page via Enter.

### 3. Add Preconnect Hints

Add DNS/connection prewarming for the two external origins in `layout.tsx`:

```tsx
<head>
  <link rel="preconnect" href="https://cdn.jsdelivr.net" crossOrigin="anonymous" />
  <link rel="preconnect" href="https://huggingface.co" crossOrigin="anonymous" />
  <link rel="dns-prefetch" href="https://cdn.jsdelivr.net" />
  <link rel="dns-prefetch" href="https://huggingface.co" />
</head>
```

This eliminates ~100-300ms of DNS + TLS setup time per origin on first connection.

### Delay Tuning

The 3-second delay before preloading is chosen because:
- **0s (immediate):** Competes with initial page render, fonts, CSS, letter data. Degrades LCP.
- **1-2s:** Page is likely still rendering above-the-fold content.
- **3s:** Page should be fully interactive. Background network activity won't be noticed.
- **>5s:** Diminishing returns. User may already be navigating to search.

The delay should be configurable in the future if analytics show different patterns.

## Alternatives Considered

### A. Service Worker Prefetch
Register a service worker that pre-fetches model files into the Cache API on install. Rejected because:
- Adds SW complexity and versioning concerns
- Cloudflare Pages static export + SW interaction needs careful testing
- The transformers.js library has its own internal caching (IndexedDB/Cache API) that would conflict
- Deferred to a potential future ADR if browser cache eviction proves to be a real problem

### B. Prefetch Only on Search Nav Hover
Use `onMouseEnter` on the "Sog" nav link to trigger `init()`. Rejected because:
- Only helps desktop users (no hover on mobile)
- Hover is too late -- model takes 5-15 seconds, hover-to-click is typically <1 second
- Doesn't help users who go directly to `/search/` via URL

### C. Web Worker for Model Loading
Move the transformers.js loading into a Web Worker to avoid any main thread impact. Rejected for now because:
- transformers.js v3 already uses WASM/WebGPU which runs off-thread
- The main thread impact during loading is minimal (mostly network I/O)
- Would add significant complexity to the SearchEngine class
- Could be reconsidered if profiling shows main thread jank during loading

### D. No Preloading (Status Quo + UX Polish Only)
Rely on ADR-009's UX improvements alone. Rejected because:
- First-visit users still face 5-15 seconds of waiting on the search page
- The preloader is low-risk and low-complexity (6 lines of logic)
- The bandwidth cost is one-time per user (cached afterward)

## Consequences

### Positive
- Search is often ready by the time users navigate to it (especially on broadband)
- SearchBox in header becomes functional on all pages (no more redirect-on-focus)
- Preconnect hints shave ~100-300ms off model loading with zero download cost
- Connection-aware: respects `saveData` and slow connections

### Negative
- **Bandwidth cost on first visit:** 33-127 MB downloaded even if user never searches. Mitigated by:
  - One-time cost (browser cache persists)
  - `saveData` / `2g` connection check skips preloading
  - 3-second delay means quick bounces don't trigger the download
- **Background network activity:** May slow other page resources on very constrained connections. Mitigated by browser's own priority scheduling (preload fetch is low priority vs. user-initiated fetches).

### Metrics to Monitor
- % of users who use search (to validate that preloading is worth the bandwidth)
- Time from page load to search readiness
- Preload completion rate (how often does preloading finish before user navigates to search?)

## Validation
- E2E: search page still functions correctly (engine init is idempotent)
- Manual: visit home page, wait 10 seconds, navigate to search -- engine should be ready
- Manual: visit on throttled 2G -- preloading should not trigger
- Performance: LCP on home page is not degraded (3-second delay ensures this)
