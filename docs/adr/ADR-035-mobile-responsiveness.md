# ADR-035: Mobile Responsiveness Improvements

## Status

Proposed

## Date

2026-03-28

## Context

The website is built with Tailwind CSS v4 and Next.js, and already uses responsive breakpoints (`sm:640`, `md:768`, `lg:1024`) in several places. The hamburger menu, flex stacking, and column hiding on the letter table all work. However, a mobile audit reveals seven categories of issues that make the site difficult or impossible to use on phones (320-414px viewport width).

### Issue 1: SVG chart overflow

`TimelineSVG.tsx` uses `viewBox="0 0 1000 ..."` with `className="w-full"`, which would scale correctly, but also sets `style={{ minWidth: 600 }}` (line 92). This forces horizontal overflow on any viewport under 600px. `BattleCorrelation.tsx` has a similar `minWidth: Math.min(chartWidth, 600)` constraint. `Charts.tsx` uses `viewBox` + `w-full` without a `minWidth` and scales correctly already.

### Issue 2: Map page fixed height and sidebar stacking

`map/page.tsx` line 110 sets `style={{ height: 600 }}` on the flex container. On mobile, the sidebar and map stack vertically inside this fixed 600px, leaving each component roughly 300px tall -- the map is barely usable and the sidebar list is truncated. The sidebar also has no collapse mechanism on mobile.

### Issue 3: Touch targets below 44px minimum

WCAG 2.5.8 and Apple HIG both specify 44x44px minimum touch targets. Several interactive elements fall short:

| Component | Element | Current size | File |
|---|---|---|---|
| `ExplorerTimeline` | Play/pause button | `h-8 w-8` (32x32px) | `ExplorerTimeline.tsx:101` |
| `ExplorerTimeline` | Speed buttons (1x/2x/5x) | `px-2 py-0.5` (~20px tall) | `ExplorerTimeline.tsx:134` |
| `ExplorerTimeline` | Range slider thumb | Browser default ~8px | `ExplorerTimeline.tsx:117` |
| `Explorer3DCanvas` | Auto-rotate toggle | `h-8 w-8` (32x32px) | `Explorer3DCanvas.tsx:401` |
| `LetterTable` | Pagination buttons | Varies | `LetterTable.tsx` |
| Letter detail | Prev/next navigation | Varies | Letter detail page |

### Issue 4: SearchBox dropdown overflow

`SearchBox.tsx` line 212 uses `className="w-80"` (320px fixed width) for the search results dropdown. On a 320px phone, this overflows the viewport. The dropdown is positioned `absolute right-0`, so it extends past the left edge.

### Issue 5: Explorer controls bar density

`explorer/page.tsx` lines 228-290 render the 2D/3D toggle, color-by dropdown, and legend swatches in a single `flex flex-wrap` row. On narrow screens, the legend wraps across 3-4 lines, consuming excessive vertical space and pushing the canvas below the fold.

### Issue 6: No touch-action on canvas elements

`ExplorerCanvas.tsx` (line 300) and `EnhancedTimeline.tsx` (line 280) render `<canvas>` elements that handle pointer events for pan/zoom. Without `touch-action: none` (or `manipulation`), the browser's default touch scroll competes with the canvas interaction, making it impossible to scroll past these full-width visualizations on a phone.

### Issue 7: Search page uses hardcoded Tailwind colors

`search/page.tsx` uses `text-gray-400`, `text-gray-500`, `text-gray-600`, `text-gray-900`, `bg-gray-100`, `border-gray-200`, `border-blue-500`, `bg-blue-50`, and `hover:border-blue-400` (13 instances across lines 65-414). The rest of the site uses the project's design tokens (`text-ink`, `text-faded`, `bg-parchment`, etc.) defined via `@theme inline` in `globals.css`. This is not strictly a mobile issue, but the hardcoded colors break visual consistency on all viewports and should be fixed in the same pass.

### What already works

- Hamburger navigation menu with auto-close on route change
- Responsive breakpoints on layout containers (`sm:`, `md:`, `lg:`)
- Letter table hides less-important columns on mobile
- Flex layouts stack vertically at appropriate breakpoints
- The archival design system has well-defined color tokens

## Decision

Implement a single mobile-first pass across the affected files, organized in three tiers by impact.

### Shared utility: `useIsMobile()` hook

Create `apps/website/src/hooks/useIsMobile.ts`:

```typescript
"use client";

import { useState, useEffect } from "react";

/**
 * Returns true when the viewport width is below the given breakpoint.
 * Defaults to 768px (Tailwind `md`).
 * Uses matchMedia for efficient, debounce-free updates.
 */
export function useIsMobile(breakpoint = 768): boolean {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${breakpoint - 1}px)`);
    setIsMobile(mql.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, [breakpoint]);

  return isMobile;
}
```

This hook is used by components that need to conditionally render different layouts (e.g., collapsing the explorer legend or the map sidebar). It defaults to `false` during SSR/static export, which is the correct behavior: the full desktop layout renders in the initial HTML, and the mobile layout kicks in after hydration. For a 665-letter archive site, the brief layout shift is acceptable.

### Tier 1 -- Critical usability (blocks basic phone usage)

#### 1a. Remove `minWidth` from TimelineSVG and BattleCorrelation

**File: `TimelineSVG.tsx`** -- Remove `style={{ minWidth: 600 }}` from the `<svg>` element (line 92). The SVG already has `viewBox` + `w-full`, so it scales to any container width. At very narrow widths the year labels will crowd, but that is preferable to horizontal overflow. If label crowding is severe, a follow-up can filter to show every-other-year labels when `useIsMobile()` is true.

**File: `BattleCorrelation.tsx`** -- Replace `minWidth: Math.min(chartWidth, 600)` with no `minWidth`, or cap it at `minWidth: Math.min(chartWidth, window.innerWidth - 32)` to respect viewport bounds.

#### 1b. Make map height viewport-relative with collapsible sidebar

**File: `map/page.tsx`** -- Replace `style={{ height: 600 }}` with `className="h-[calc(100vh-8rem)]"` so the map container scales with the viewport. On mobile (`< lg:`), render the sidebar as a collapsible panel (slide-up sheet or toggleable section) instead of a stacked column. The map gets the full container height; the sidebar overlays or collapses below.

```
Desktop (lg:):  [sidebar 288px] [map flex-1]   -- side by side, as today
Mobile (<lg:):  [map 100%]                      -- full width
                [toggle button]                  -- "Vis steder" to expand sidebar
                [sidebar overlay / bottom sheet] -- slides up over map
```

#### 1c. Add `touch-action` to canvas elements

**File: `ExplorerCanvas.tsx`** -- Add `style={{ touchAction: "none" }}` to the `<canvas>` element (line 300). This prevents the browser from scrolling while the user pans/zooms the 2D scatter plot.

**File: `EnhancedTimeline.tsx`** -- Add `style={{ touchAction: "none" }}` to the `<canvas>` element (line 280). Same rationale.

Both canvases should also get a visible "scroll past" affordance on mobile: a small grab handle or instruction text above the canvas, so users know to scroll outside the canvas area.

#### 1d. Fix SearchBox dropdown overflow

**File: `SearchBox.tsx`** -- Replace `w-80` with `w-[min(20rem,calc(100vw-2rem))]` or use `w-full max-w-80` with the dropdown's parent container set to `relative`. This caps the dropdown at 320px on desktop but shrinks to fit on narrow viewports.

### Tier 2 -- Important UX improvements

#### 2a. Enlarge touch targets to 44px minimum

**File: `ExplorerTimeline.tsx`** -- Change play/pause button from `h-8 w-8` to `h-11 w-11` (44x44px). Change speed buttons from `px-2 py-0.5` to `min-h-[44px] min-w-[44px] px-3 py-2`. Style the range slider thumb to 44px using Tailwind's `[&::-webkit-slider-thumb]` and `[&::-moz-range-thumb]` utilities.

**File: `Explorer3DCanvas.tsx`** -- Change auto-rotate toggle from `h-8 w-8` to `h-11 w-11`.

**File: `LetterTable.tsx`** -- Ensure pagination buttons have `min-h-[44px] min-w-[44px]`.

**Letter detail navigation** -- Ensure prev/next buttons have at least 44px tap area via padding or min-height/min-width.

#### 2b. Collapse explorer legend on mobile

**File: `explorer/page.tsx`** -- Use `useIsMobile()` to conditionally render the legend section. On mobile, replace the inline legend swatches with a "Forklaring" toggle button that expands/collapses the legend. The color-by dropdown and 2D/3D toggle remain visible.

```
Desktop:  [2D/3D toggle] [Color dropdown] [swatch] [swatch] [swatch] ...
Mobile:   [2D/3D toggle] [Color dropdown] [Forklaring v]
          (expanded):                      [swatch grid, 2 cols]
```

#### 2c. Hide 3D toggle on small screens without WebGL

The 3D toggle is already gated on `hasWebGL`. Additionally, on very small screens (< 640px / `sm`), hide the 3D toggle entirely -- 3D orbit controls are awkward on small phones, and the 2D view works better with touch. Use `className="hidden sm:flex"` on the toggle container.

### Tier 3 -- Polish

#### 3a. Migrate search page to design tokens

**File: `search/page.tsx`** -- Replace all hardcoded Tailwind color classes with the project's design tokens:

| Hardcoded | Design token |
|---|---|
| `text-gray-900` | `text-ink` |
| `text-gray-600` | `text-faded-dark` |
| `text-gray-500` | `text-faded` |
| `text-gray-400` | `text-faded` |
| `bg-gray-100` | `bg-parchment-light` |
| `border-gray-200` | `border-faded/20` |
| `bg-white` | `bg-parchment` |
| `border-blue-500` / `focus:border-blue-500` | `border-ink` / `focus:border-ink` |
| `bg-blue-50` / `hover:bg-blue-50` | `hover:bg-parchment` |
| `hover:border-blue-400` | `hover:border-ink-light` |

#### 3b. Landscape orientation hint for visualization pages

On portrait-oriented phones viewing the explorer or timeline pages, show a subtle one-time hint suggesting landscape orientation: "Vend telefonen for bedre overblik" with a rotate-phone icon. Dismiss on tap or after 5 seconds. Store dismissal in `sessionStorage` so it only shows once per session.

#### 3c. ExplorerTimeline density on mobile

On mobile, the timeline bar's date label (`w-32`) and speed buttons consume too much horizontal space. Use `useIsMobile()` to shorten the date label (e.g., "Jan 15" instead of "Januar 1915") and show only the current speed as a cycle button instead of three separate buttons.

## Alternatives Considered

### Separate mobile site or app

A dedicated mobile experience (`m.jernkorsetbreve.dk`) or a React Native app would give full control over the mobile UX. Rejected because:
- The content is the same; maintaining two codebases is disproportionate for a historical archive
- Tailwind + responsive design can handle the required adaptations within the existing codebase
- The site has no complex mobile-specific interactions (no camera, GPS, etc.)

### CSS-only approach (no `useIsMobile()` hook)

All layout changes could theoretically be done with Tailwind responsive classes alone, avoiding JavaScript viewport detection. This works for simple show/hide and sizing, but falls short for:
- Conditional rendering of different component structures (legend toggle vs. inline swatches)
- Shortening date labels in `ExplorerTimeline`
- The landscape hint
CSS media queries can handle these via `@media`, but the React component model makes conditional rendering cleaner and more maintainable.

### Viewport-relative units everywhere (dvh, svh)

Using `100dvh` instead of `100vh` avoids the mobile browser chrome issue where `100vh` is taller than the visible viewport. This is a good practice and should be adopted where appropriate (e.g., the map container), but it does not address the structural issues (overflow, touch targets, collapsing controls).

### Progressive Web App (PWA)

Adding a service worker and manifest for offline access and "Add to Home Screen". Deferred -- this is orthogonal to responsiveness and can be a separate ADR if demand arises.

## Consequences

### Positive

- The site becomes usable on phones (320-414px), which likely represent a significant portion of casual visitors
- Touch targets meet WCAG 2.5.8 minimum, improving accessibility for all users including those with motor impairments
- The search page aligns with the design system, eliminating visual inconsistency
- Canvas touch-action fixes prevent the "stuck on visualization" problem where users cannot scroll past a full-width canvas
- The `useIsMobile()` hook establishes a reusable pattern for future responsive work

### Negative

- Tier 2 and 3 changes add conditional rendering complexity (the `useIsMobile()` hook introduces a hydration-dependent layout shift on first load)
- The collapsed legend and sidebar require additional state management and UI elements (toggle buttons)
- The 3D toggle is hidden on small phones, reducing feature discoverability for mobile users
- Touch target enlargement increases the visual footprint of controls, potentially feeling oversized on desktop (mitigate with responsive sizing: `h-11 sm:h-8`)

### Risks

- The `minWidth` removal on TimelineSVG may cause label crowding on very narrow viewports; monitor and add label filtering if needed
- The map sidebar collapse changes the interaction flow; users accustomed to the side-by-side layout on tablets may be confused
- `touch-action: none` on canvases means users cannot scroll by touching the canvas -- the scroll-past affordance must be clear

## Implementation Notes

### Files to create

1. `apps/website/src/hooks/useIsMobile.ts` -- shared viewport hook (~20 lines)

### Files to modify

| File | Tier | Change |
|---|---|---|
| `components/TimelineSVG.tsx` | 1 | Remove `minWidth: 600` |
| `components/BattleCorrelation.tsx` | 1 | Remove or cap `minWidth` |
| `app/map/page.tsx` | 1 | Viewport-relative height, collapsible sidebar |
| `components/ExplorerCanvas.tsx` | 1 | Add `touchAction: "none"` to canvas |
| `components/EnhancedTimeline.tsx` | 1 | Add `touchAction: "none"` to canvas |
| `components/SearchBox.tsx` | 1 | Fix dropdown width overflow |
| `components/ExplorerTimeline.tsx` | 2 | Enlarge touch targets, mobile date format |
| `components/Explorer3DCanvas.tsx` | 2 | Enlarge auto-rotate button |
| `components/LetterTable.tsx` | 2 | Enlarge pagination touch targets |
| `app/explorer/page.tsx` | 2 | Collapsible legend, hide 3D on small phones |
| `app/search/page.tsx` | 3 | Migrate to design tokens |

### Testing

- E2E tests (24 existing) must pass after each tier
- Add viewport-specific E2E tests for mobile (375px) and tablet (768px) viewports covering:
  - No horizontal overflow on timeline and charts pages
  - Map is usable (sidebar toggles, map fills viewport)
  - Search dropdown does not overflow
  - All interactive elements have >= 44px tap target (measure via bounding box)
- Manual testing on iOS Safari and Android Chrome for touch-action behavior

Estimated effort: 2-3 days (1 day per tier).

## Related

- ADR-001 (Frontend Redesign): Established the archival design system and Tailwind token set
- ADR-004 (Performance Targets): Load time thresholds that mobile changes must not regress
- ADR-034 (Three.js 3D Explorer): The 3D toggle hiding on small screens is a mobile-specific adjustment to this feature
- ADR-009 (Search UX Simplification): The search page token migration completes the design system alignment started there
