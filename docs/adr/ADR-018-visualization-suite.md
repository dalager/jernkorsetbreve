# ADR-018: Visualization Suite for Analytical Data

## Status
Proposed

## Context

ADRs 015–017 produce rich per-letter analytical data (psycholinguistic metrics, social network, semantic trajectories). This data needs visualization to be accessible to both researchers and general audiences. The existing site already has visualization infrastructure: UMAP explorer (Canvas2D), Leaflet maps, and basic topic clusters.

### Design Principles

1. **Data already exists or is computed at build time** — visualizations consume static JSON
2. **Progressive disclosure** — simple view by default, detail on interaction
3. **Temporal synchronization** — multiple views share a timeline scrubber where possible
4. **Consistent tech stack** — D3.js for custom visualizations, recharts for simple charts, Leaflet for maps (all already in the project or compatible with Next.js)

## Decision

### Visualization Components (Priority Order)

#### 1. Sentiment Arc Page (`/analytics/sentiment`) — Priority: High

A smoothed line chart of sentiment over time with:
- Raw data points (hoverable, link to letter)
- LOESS-smoothed emotional arc line
- Emotional volatility band (±1 rolling std dev)
- Historical event annotations (vertical lines with labels)
- Color gradient: positive (warm) → negative (cool)

**Data source:** `letter-sentiments.json` + `sentiment-trajectory.json`
**Library:** D3.js (allows custom annotations and interaction)
**Effort:** 1–2 days

#### 2. Topic Stream Graph (`/analytics/topics`) — Priority: High

Stacked stream graph showing topic proportions over time:
- Each band labeled with cluster's top 3 representative terms
- Hover to highlight one topic and show its percentage
- Click a band to filter the letter list to that topic+period
- Historical event annotations on x-axis

**Data source:** `topic-evolution.json`
**Library:** D3.js `d3.stack()` + `d3.area()` with `curveBasis`
**Effort:** 2–3 days

#### 3. Correspondence Network Graph (`/network`) — Priority: High

Force-directed graph of people mentioned in the letters:
- Nodes: sized by mention count, colored by category (family/military/community)
- Edges: weighted by co-mention frequency
- Timeline slider: animate network evolution year by year
- Click node: show all letters mentioning that person
- Hover node: highlight connected nodes and edges
- Fading nodes: people who disappear from the letters

**Data source:** `social-network.json`
**Library:** D3.js force simulation
**Effort:** 3–5 days

#### 4. Animated Movement Trail (enhanced `/map`) — Priority: Medium

Extend the existing Leaflet map with:
- Animated dot showing Peter's position moving over time
- Trail line colored by sentiment (green → red gradient)
- Battle markers as pulsing circles when Peter is nearby
- Distance-from-home indicator (numeric, updating with animation)
- Timeline scrubber synchronized with the animation
- Speed control (1x, 2x, 5x, 10x)

**Data source:** Existing location data + `battles.json` + `letter-sentiments.json`
**Library:** Leaflet (existing) + Leaflet.AnimatedMarker or custom animation
**Effort:** 3–5 days

#### 5. Semantic Drift Chart (`/analytics/drift`) — Priority: Medium

Line chart of semantic velocity over time:
- Y-axis: cosine distance between consecutive monthly centroids
- Annotated with explanatory labels for major spikes
- Overlay option: show alongside sentiment trajectory for correlation
- Below the chart: a "what changed?" panel showing the most distinctive words for high-drift periods

**Data source:** `semantic-drift.json`
**Library:** D3.js or recharts
**Effort:** 2–3 days

#### 6. Psycholinguistic Dashboard (`/analytics/language`) — Priority: Medium

Multi-line chart showing selected psycholinguistic metrics over time:
- User selects which metrics to display (checkboxes)
- Available: TTR, sentence length, hedging frequency, pronoun ratio, code-switching density, entropy
- Rolling average smoothing with adjustable window
- Audience toggle: show Trine-letters vs. parent-letters separately
- Highlight divergence periods between audiences

**Data source:** `letter-psycholinguistics.json` + `letter-audience-divergence.json`
**Library:** recharts (React-native, simpler for multi-series toggle)
**Effort:** 3–5 days

#### 7. Audience Comparison View (`/analytics/audiences`) — Priority: Medium

Side-by-side comparison of Peter's writing to Trine vs. parents:
- Split-screen timeline with matching time axis
- Per-metric comparison bars (are letters to Trine longer? more emotional? more hedged?)
- Highlight dates where both audiences received a letter — clickable to read both
- Divergence meter: overall KL divergence over time

**Data source:** `letter-audience-divergence.json` + letter metadata
**Library:** D3.js or recharts
**Effort:** 2–3 days

#### 8. Vocabulary Trajectory Chart (`/analytics/vocabulary`) — Priority: Low

Multi-series area chart showing word category densities over time:
- Military, domestic, emotional, nature, religious, health categories
- Stacked or overlaid, user-toggleable
- Click a category to see the actual words counted in each period

**Data source:** `vocabulary-trajectory.json`
**Library:** recharts
**Effort:** 1–2 days

### Navigation and Layout

Add an `/analytics` hub page that links to all analytical views with preview thumbnails. Group visualizations:

- **Tidslinje** (Timeline): Sentiment arc, topic stream, vocabulary trajectory
- **Sprog** (Language): Psycholinguistic dashboard, audience comparison
- **Netværk** (Network): Social graph
- **Kort** (Map): Animated movement trail
- **Udforsk** (Explore): Existing UMAP explorer, Cognitive Atlas (ADR-020)

### Shared Components

- **TimelineScrubber**: Reusable component for synchronized time navigation
- **EventAnnotations**: Historical event markers shared across all temporal charts
- **LetterPopover**: Hover/click on any data point to preview the associated letter

## Consequences

### Positive
- Makes analytical data accessible to non-technical audiences
- Temporal synchronization across views enables cross-analysis exploration
- Progressive disclosure keeps the default experience simple
- All visualizations consume static JSON — no server-side computation needed
- The analytics hub creates a cohesive research platform rather than scattered pages

### Negative
- 8 new visualization components is significant frontend work
- D3.js learning curve for contributors unfamiliar with it
- Mobile responsiveness for complex visualizations requires additional effort
- Page weight increases with D3.js (~90 KB) and potentially recharts (~150 KB)

### Mitigation
- Prioritize the top 3 (sentiment arc, stream graph, network) — these alone create a compelling platform
- Use dynamic imports to load visualization libraries only on analytics pages
- Build shared components early (TimelineScrubber, EventAnnotations) to reduce per-visualization effort
- Accept that some visualizations (force graph, stream graph) work best on desktop

## Validation
- Each visualization renders correctly with the actual data products
- Interactive features (hover, click, filter, scrub) work in Chrome, Firefox, Safari
- Page load time for analytics pages stays under 3 seconds (excluding data fetch)
- Visualizations display correctly on viewport widths ≥768px (tablet and above)
