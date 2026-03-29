# ADR-037: Psycholinguistic Explorer Website Section

## Status

Accepted (2026-03-29)

## Date

2026-03-29

## Context

ADR-015 implemented a comprehensive psycholinguistic analysis pipeline producing seven data files across six metric categories (lexical, syntactic, psychological, code-switching, information-theoretic, embedding-derived) for all 665 letters. Key findings include:

- **+1177% reassurance formulae** in wartime vs. pre-war
- **-21% first-person singular pronouns** (identity absorption into military collective)
- **+29% absolutist language** under combat stress
- **58 same-date letter pairs** revealing systematic audience adaptation between Trine and parents
- **Valley-shaped narrative arcs** (reassurance→shock→reassurance) dominating at 35%
- **"hjem" shows strongest semantic drift** — from physical place to aspiration

This data is qualitatively different from the sentiment analysis in ADR-036. Sentiment asks "how does Peter *feel*?" while psycholinguistics asks "how does Peter *write*, and how does war change that?" The data covers vocabulary diversity, syntactic complexity, pronoun patterns, audience adaptation, and semantic drift — dimensions that have no overlap with the sentiment explorer's CVP-based valence scoring.

### Available data files

| File | Size | Content |
|------|------|---------|
| `letter-psycholinguistics.json` | ~200 KB | 25 metrics per letter × 665 letters |
| `cvp-emotion-scores.json` | ~150 KB | fear/grief/hope/love per letter (mean, p10, p90) |
| `cvp-emotion-sentence-scores.json` | ~3.5 MB | Per-sentence emotion scores (lazy load) |
| `letter-audience-divergence.json` | ~30 KB | Quarterly Trine-vs-parents divergence + 58 same-date pairs |
| `letter-narrative-arcs.json` | ~50 KB | Arc type, asymmetry, range per letter |
| `semantic-shifts.json` | ~15 KB | 10 target words with year-by-year CVP drift |
| `pca-dimensions.json` | ~40 KB | 10 principal components with top/bottom sentences |

### Audience considerations

Same non-technical audience as ADR-036. The challenge is greater here: psycholinguistic metrics are less intuitive than sentiment. Every visualization must lead with a human-readable finding and explain *why it matters*, not just *what the number is*.

### Relationship to ADR-036 (Sentiment Explorer)

The sentiment page (`/sentiment/`) has three tabs and is already content-rich. Adding psycholinguistic content would create a 6-7 tab page that overwhelms visitors. The two analyses serve different lenses on the same corpus:

- **Stemning** (Sentiment): How does Peter feel? Valence scoring, emotional range, narrative arcs within letters.
- **Sproganalyse** (Language Analysis): How does Peter write? Vocabulary, syntax, pronouns, audience adaptation, meaning drift.

These deserve separate pages with extensive cross-linking.

## Decision

### Build a dedicated `/sproganalyse/` route

Create a new page called **"Sprog"** (Language) in the navigation, with the page title **"Sproganalyse"** and subtitle *"Hvordan krigen forandrede Peters sprog"* (How the war changed Peter's language).

### Four story-driven tabs

Each tab tells one story, using accessible Danish labels. The structure mirrors ADR-036's proven three-tab pattern but adds a fourth for the unique audience-divergence analysis.

---

#### Tab 1: "Overblik" (Overview)

Entry-point dashboard with headline findings.

**Components:**
- 5-6 stat cards with key findings, each linking to the relevant tab
- A composite complexity sparkline (MATTR or mean sentence length) over 1911-1918 with August 1914 marked
- A collapsible method note explaining the computational approach in lay Danish

**Data:** `letter-psycholinguistics.json` (aggregated client-side)

---

#### Tab 2: "Krigens sprog" (The Language of War)

How war mechanically changed Peter's writing.

**Components:**
- Pre-war vs. wartime comparison cards for key metrics (MATTR, sentence length, jeg/vi shift, hedging, absolutist language, reassurance, German density)
- Small-multiple timeline charts for 5-6 metrics across 1911-1918, each with a vertical "Krigens udbrud" marker at August 1914
- Emotion trajectory chart (fear/grief/hope/love over time) from CVP emotion scores
- Cross-link to `/sentiment/` for pure valence analysis

**Data:** `letter-psycholinguistics.json`, `cvp-emotion-scores.json`

---

#### Tab 3: "To modtagere" (Two Recipients)

Peter writes differently to Trine vs. his parents — the 58 same-date pairs prove conscious adaptation.

**Components:**
- Headline statistic: 58 same-date pairs
- Quarterly divergence timeline (JSD or Wasserstein distance) showing adaptation intensity over time
- Metric-level divergence breakdown: which dimensions differ most between audiences
- Narrative arc distribution by recipient (bar chart of arc types)
- Cross-links to individual letters and sentiment page

**Data:** `letter-audience-divergence.json`, `letter-narrative-arcs.json`, `letter-psycholinguistics.json`

---

#### Tab 4: "Ordenes rejse" (The Journey of Words)

How the meaning of everyday words shifted through the war years.

**Components:**
- Word selector: 10 target words as clickable buttons, with "most shifted" and "most fossilized" highlighted
- Per-word drift chart: mean CVP score by year with std deviation band and occurrence count
- Drift ranking table showing total drift per word
- Human-readable interpretation for each word's journey

**Data:** `semantic-shifts.json`, `pca-dimensions.json`

---

### Component architecture

```
apps/website/src/app/sproganalyse/
  page.tsx                    — Route, tab state, data orchestration

apps/website/src/components/
  SprogOverview.tsx           — Tab 1: stat cards + sparkline
  SprogMethodNote.tsx         — Collapsible method explanation
  KrigensSprog.tsx            — Tab 2: war metrics orchestrator
  MetricTimeline.tsx          — Reusable: single metric over time
  EmotionTimeline.tsx         — Fear/grief/hope/love area chart
  ToModtagere.tsx             — Tab 3: audience divergence
  DivergenceTimeline.tsx      — Quarterly divergence line chart
  ArcDistribution.tsx         — Narrative arc breakdown
  OrdenesRejse.tsx            — Tab 4: semantic drift
  WordDriftChart.tsx          — Per-word CVP drift over years
  WordSelector.tsx            — Clickable word buttons

apps/website/src/lib/
  psycholinguistic-utils.ts   — Data loading, aggregation, pre-war/wartime splits

apps/website/src/types/
  psycholinguistics.ts        — Interfaces for all data files
```

### Data loading strategy

| Tab | Data loaded | Approx size (gzipped) |
|-----|-------------|----------------------|
| Overblik | `letter-psycholinguistics.json` | ~40 KB |
| Krigens sprog | (already loaded) + `cvp-emotion-scores.json` | ~30 KB additional |
| To modtagere | `letter-audience-divergence.json` + `letter-narrative-arcs.json` | ~15 KB additional |
| Ordenes rejse | `semantic-shifts.json` + `pca-dimensions.json` | ~10 KB additional |

All data loaded eagerly on page mount (total ~95 KB gzipped) — small enough that lazy loading per-tab adds complexity without meaningful benefit. Exception: `cvp-emotion-sentence-scores.json` (3.5 MB) is NOT loaded by this page.

### Cross-linking strategy

1. **Header navigation**: Add "Sprog" after "Stemning" in `navItems`
2. **Sentiment → Sproganalyse**: Banner on sentiment overview: "Udforsk også sproglige mønstre"
3. **Sproganalyse → Sentiment**: Tab 2 bottom link: "Se den følelsesmæssige analyse"
4. **Both → Letter detail**: Individual letter links go to `/letters/[id]`

### Design principles

1. **Story-first**: Each section leads with a human-readable finding, then shows the backing chart
2. **August 1914 marker**: Every timeline chart has a vertical dashed line at "Krigens udbrud"
3. **Pre-war = parchment tones, wartime = wax-red**: Consistent visual period distinction
4. **Progressive disclosure**: Stat cards → tabs → charts → individual data points
5. **Danish throughout**: No English metric names exposed to visitors
6. **Honest framing**: "Mønstre, ikke beviser" — patterns, not proof

### Color system

- Pre-war data points: `text-ink` / warm gray tones
- Wartime data points: `text-wax-red` / warm red tones
- Trine letters: a dedicated color (e.g., `#8B6F47` warm brown)
- Parent letters: a contrasting color (e.g., `#5B7B6A` muted green)
- Emotion channels: fear=amber, grief=slate, hope=green, love=rose

## Implementation Plan

### SPARC Phases

| Phase | Scope | Depends on |
|-------|-------|-----------|
| **S: Specification** | This ADR + TypeScript interfaces | — |
| **P: Pseudocode** | Utility functions, data aggregation logic | S |
| **A: Architecture** | Page shell, tab infrastructure, nav link | P |
| **R: Refinement** | 4 tabs implemented in parallel (swarm) | A |
| **C: Completion** | Cross-links, build pipeline, E2E tests | R |

### Parallel execution strategy (Refinement phase)

Tabs 2, 3, and 4 are independent once the page shell and types exist. They can be implemented concurrently:

- **Agent A**: Tab 2 (KrigensSprog + MetricTimeline + EmotionTimeline)
- **Agent B**: Tab 3 (ToModtagere + DivergenceTimeline + ArcDistribution)
- **Agent C**: Tab 4 (OrdenesRejse + WordDriftChart + WordSelector)

Tab 1 (SprogOverview) is built as part of the page shell since it's the default view.

## Alternatives Considered

### Expand the existing `/sentiment/` page

Rejected. Adding 4 more tabs to an already 3-tab page creates cognitive overload. The psycholinguistic analysis is a fundamentally different lens on the corpus — vocabulary diversity, syntactic complexity, and audience adaptation have no conceptual overlap with CVP valence scoring. A dedicated page also earns its own navigation slot, improving discoverability.

### Build as sub-routes (`/sentiment/sprog/`, `/sentiment/modtagere/`)

Rejected. This implies psycholinguistics is a subset of sentiment analysis, which misrepresents the relationship. Both are peer analyses of the same corpus. Nesting one under the other creates a misleading hierarchy.

### Use a charting library (Recharts, Chart.js)

Deferred. The existing site uses hand-rolled SVG for simple charts. The psycholinguistic timelines are line charts with markers — achievable with SVG. If complexity demands it during implementation, Recharts can be added. The component interfaces are the same regardless.

### Include PCA scatter plot

Deferred to a future iteration. The PCA components have abstract meaning that's hard to explain to a non-technical audience. The word drift charts in Tab 4 already convey semantic change in a more accessible way. PCA can be added as a "Dybdegående" sub-view later.

## Consequences

### Positive

- Unlocks the full value of the ADR-015 psycholinguistic pipeline for website visitors
- Tells four compelling, accessible stories about how war transforms language
- Parallel tab implementation enables efficient development
- Mirrors the proven ADR-036 pattern (tabs, method note, progressive disclosure)
- Cross-linking creates a richer exploratory experience across the site

### Negative

- Adds ~12 new files and ~2,500-3,000 lines of frontend code
- Navigation grows to 8 items (may need grouping on mobile)
- Maintaining two analysis pages increases surface area for bugs
- Psycholinguistic metrics require more careful explanation than sentiment

### Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| Non-technical audience confused by metrics | Medium | High | Story-first design; every chart has a plain Danish explanation |
| Tab 3 (To modtagere) too thin | Low | Low | Can merge into Tab 2 as subsection if needed |
| Data files too large for mobile | Low | Medium | Total ~95 KB gzipped; well within budget |
| Charts too complex for hand-rolled SVG | Medium | Low | Can adopt Recharts; component interfaces unchanged |

## Replanning Triggers

1. **Tab 3 has < 3 meaningful visualizations** → Merge audience divergence into Tab 2 as a section
2. **Mobile navigation overflow with 8+ items** → Group "Stemning" and "Sprog" under a "Analyse" dropdown
3. **User testing shows overview stat cards are not understood** → Replace with narrative paragraphs instead of numbers
4. **PCA demand from users** → Add as Tab 5 or as an advanced sub-view within Tab 4

## Related

- ADR-015: Psycholinguistic Analysis Pipeline (data foundation)
- ADR-030: CVP Sentiment Implementation (embedding infrastructure)
- ADR-036: Sentiment Explorer Section (sister page, design patterns)
- ADR-035: Mobile Responsiveness (new section must follow mobile-first patterns)
