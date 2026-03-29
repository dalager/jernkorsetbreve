# ADR-036: Sentiment Explorer Website Section

## Status

Accepted (implemented 2026-03-29)

## Date

2026-03-29

## Context

ADR-030 implemented CVP (Concept Vector Projection) sentiment scoring, producing continuous scores for all 13,577 sentences across 665 letters. The data exists at two levels:

- **Letter-level** (`data/cvp-letter-scores.json`): cvp_mean, cvp_min, cvp_p10, cvp_p90, cvp_range, negative_ratio, sentence_count
- **Sentence-level** (`data/cvp-sentence-scores.json`): per-sentence score, text, formulaic flag

Today the website uses only `cvp_mean` to color dots on the timeline and embedding explorer. The rich multi-score data and the full sentence-level detail are entirely untapped. This is a missed opportunity: the primary value of CVP over AFINN/Sentida is its continuous scores and sentence-level granularity.

### Audience considerations

The website serves a non-technical audience interested in WW1 Danish history and personal correspondence. Sentiment analysis is an unfamiliar concept to most visitors. The section must:

1. Not overplay the validity or relevance of the method
2. Frame findings as exploration, not proof
3. Surface genuine insight where it exists, while being honest about uncertainty
4. Use Danish terminology throughout ("Stemning", not "sentiment analysis")

The guiding principle: **interesting but useless is acceptable; real insight and discovery is the goal**.

### What CVP enables that the current site cannot show

| Capability | Current state | With Sentiment Explorer |
|---|---|---|
| Emotional range within a letter | Hidden | Visible via p10/p90 and sentence coloring |
| Narrative arc (opening → body → closing) | Not shown | Sentence-by-sentence sparkline |
| "Drowned negativity" (negative sentences hidden by positive mean) | Invisible | Surfaced via negative_ratio and cvp_min |
| Corpus-wide mood shifts over war years | Single colored dots | Timeline with confidence band |
| Notable letters (extremes, outliers) | Not discoverable | Auto-surfaced with excerpts |

## Decision

Build a new `/sentiment/` route called **"Stemning"** (Mood) with three views, a prominent method explanation, and a strong/weak signal framework.

### View 1: Overblik (Overview)

A landing view with four components:

**Sentiment timeline with confidence band.** X-axis: 1911-1918. Y-axis: sentiment (-1 to +1). Shows a rolling average line (30-day window) of `cvp_mean` with a shaded band between rolling `cvp_p10` and `cvp_p90`. Individual letter dots sized by `sentence_count`, colored by sentiment. Key war dates annotated (mobilization Aug 1914, armistice Nov 1918).

**Distribution chart.** Histogram or density plot of `cvp_mean` across all 665 letters. Contextualizes what "negative" and "positive" mean in this specific corpus — most letters cluster near zero.

**Summary stat cards.** Most positive letter, most negative letter, widest emotional range, average sentiment pre-war vs wartime. Each links to the letter in question.

**Notable letters list.** Auto-surfaced letters with extreme scores, high `negative_ratio`, or wide `cvp_range`. Each entry shows date, sender/recipient, score, and a snippet of the most extreme sentence.

### View 2: Breve (Letter comparison)

A sortable, filterable table with sentiment as the primary column:

- Columns: Date, Sender, Recipient, Stemning (cvp_mean), Spandvidde (cvp_range), Negativt (negative_ratio %)
- Sortable by any column (default: date)
- Filters: sender, year, sentiment range slider
- Each row links to the sentence-level detail view

### View 3: Dybdegående (Sentence deep dive)

Drill-down view for a single letter, shown as an expandable panel within the page:

- Letter metadata (date, sender, recipient, place)
- Letter-level aggregate scores as colored badges
- **Full letter text rendered sentence by sentence**, each colored by CVP score on a continuous gradient (red → neutral → green). Color applied as background opacity or left-border, not text color (readability).
- **Narrative arc mini-chart**: sparkline of sentence scores through the letter, revealing patterns like "reassurance → shock → reassurance"
- Formulaic sentences (greetings/closings) visually dimmed with an indicator
- Link to the full letter page (`/letters/[id]/`)

### Method explanation component

A prominent, collapsible card at the top of the page explaining CVP in lay terms:

- Frame as "stemningsbarometer" (mood barometer) — shows general direction, not precise feeling
- Explain: "En computer laeer hver saetning og placerer den pa en skala fra negativ til positiv, baseret pa hvor meget den ligner saetninger vi ved er triste eller glade"
- Acknowledge: method developed for Danish literary text, first application to WW1 personal correspondence
- State clearly: "Tallene viser tendenser, ikke sandheder. En 'negativ' score kan afspejle modgang, bekymring eller blot en faktuel beskrivelse af svaere forhold — metoden kan ikke skelne mellem disse."
- Link to the CVP paper

### Strong and weak signals framework

Each signal is presented as a card with narrative explanation, mini-visualization, and interpretation caveat.

**Strong signals** (clear pattern, higher confidence):

- Letters in the top/bottom 5% of the corpus
- Sentences scoring below -0.8 or above +1.0
- Sudden shifts in monthly rolling average (delta > 0.15)
- Structural break at mobilization (Aug 1914)
- Pre-war vs wartime mean difference

**Weak signals** (interesting but uncertain):

- Gradual trends within a year (e.g., declining sentiment through 1916)
- Differences between recipients (letters to Trine vs letters to parents)
- Correlation between letter length and sentiment
- Seasonal patterns (winter vs summer)

### Data pipeline additions

Two new outputs from `build-data.mjs`:

1. **`apps/website/public/data/cvp-sentence-scores.json`** — Copy of sentence scores (2.7 MB raw, ~400 KB gzipped). Lazy-loaded only when user drills into a specific letter.

2. **`apps/website/public/data/sentiment-overview.json`** — Pre-computed aggregates: monthly rolling averages (mean, p10, p90), distribution bins, notable letters lists (top 10 most negative, most positive, widest range, highest negative_ratio). Keeps overview page fast without client-side joins.

### Color system

Sentence-level views use a **continuous gradient** — the primary value proposition of CVP over categorical methods. Overview views retain categorical labels (positive/neutral/negative) for accessibility. Both provided by a shared `sentiment-utils.ts` module.

### Data loading strategy

| View | Data loaded | Size (gzipped) |
|---|---|---|
| Overview | `letter-sentiments.json` + `sentiment-overview.json` | ~55 KB |
| Letter list | `letter-sentiments.json` (already loaded) | 0 KB additional |
| Sentence detail | `cvp-sentence-scores.json` (lazy, on drill-down) | ~400 KB |

## Implementation Plan

### New files

| File | Purpose |
|---|---|
| `apps/website/src/app/sentiment/page.tsx` | Main page with three tab/scroll sections |
| `apps/website/src/components/SentimentOverview.tsx` | Timeline with band, distribution, stat cards, notable letters |
| `apps/website/src/components/SentimentLetterList.tsx` | Filterable/sortable letter table |
| `apps/website/src/components/SentimentLetterDetail.tsx` | Colored sentences and narrative arc sparkline |
| `apps/website/src/components/SentimentMethodNote.tsx` | Lay explanation of CVP method |
| `apps/website/src/components/SentimentSignals.tsx` | Strong/weak signal cards |
| `apps/website/src/lib/sentiment-utils.ts` | Color gradients, data loading, aggregation helpers |

### Files to modify

| File | Change |
|---|---|
| `scripts/build-data.mjs` | Publish sentence scores + pre-compute overview aggregates |
| `apps/website/src/components/Header.tsx` | Add "Stemning" nav item (after "Statistik", before "Udforsk") |
| `apps/website/src/app/letters/[id]/page.tsx` | Optional compact sentiment section (collapsed by default) |
| `apps/website/src/app/about/page.tsx` | Mention Sentiment Explorer in "Sprogteknologi og data" section |
| `apps/website/src/types/letters.ts` | Add sentence-score type interfaces |

### Phases

| Phase | Scope | Estimate |
|---|---|---|
| 1: Foundation | Data pipeline, types, utils, method note | ~4h |
| 2: Overview | Timeline band chart, distribution, stat cards, navigation | ~6h |
| 3: Drill-down | Letter list, sentence coloring, narrative arc chart | ~6h |
| 4: Polish | Signals, letter detail integration, mobile, about page | ~4h |
| **Total** | | **~20h** |

Critical path: Phase 1 → Phase 2 → Phase 3 → Phase 4 (sequential; each builds on the previous).

## Alternatives Considered

### Add sentiment columns to existing letter table

Rejected. Sentiment deserves its own exploratory lens, not just a data column in a metadata-focused table. The letter table's purpose is finding specific letters; the Sentiment Explorer's purpose is discovering patterns across the corpus.

### Use categorical sentiment (positive/neutral/negative) throughout

Rejected. Continuous scores are CVP's primary advantage over AFINN/Sentida. Reducing to three categories would discard the very granularity that justified the CVP implementation (ADR-030). Categorical labels are retained only for overview accessibility.

### Build sentence detail as separate routes (`/sentiment/[id]/`)

Deferred. An expandable panel within the page is simpler for MVP and maintains browsing context. A dedicated route can be added later if users need shareable URLs for individual letter sentiment views.

### Pre-split sentence scores into per-letter files

Deferred. The full file is 2.7 MB (~400 KB gzipped), fetched only on drill-down. Client-side filtering of 13,577 records is instantaneous. If performance proves problematic on mobile, per-letter splitting or an index+chunk approach can be added without changing the component API.

### Use a charting library (Recharts, D3)

Not yet decided. The existing site uses hand-rolled SVG for the timeline and Chart.js for some charts. The sentiment timeline with confidence band is more complex than existing charts. This decision is deferred to Phase 2 implementation — the component interface is the same regardless of rendering approach.

## Consequences

### Positive

- Unlocks the full value of the CVP investment (ADR-030) — sentence-level scores and multi-score aggregation become visible
- Enables discovery of patterns invisible in the current UI (emotional range, narrative arcs, drowned negativity)
- Honest framing builds trust with the academic/heritage audience
- Strong/weak signal framework sets expectations appropriately
- Lazy loading keeps the existing site's performance unaffected
- Pre-computed overview aggregates avoid heavy client-side computation

### Negative

- Adds 7 new files and ~2,000 lines of code to the frontend
- Sentence score file (2.7 MB) increases total static asset size
- The method explanation adds cognitive load for visitors who just want to read letters
- Maintaining two color systems (continuous gradient + categorical) adds complexity to `sentiment-utils.ts`

### Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Sentence score file too slow on mobile | Low | Medium | Lazy loading; can split per-letter later |
| Non-technical audience misinterprets scores as precise | Medium | High | Prominent method note; "tendenser, ikke sandheder" framing |
| CVP scores on personal correspondence don't correlate with actual emotion | Low-Medium | High | Honest framing; validation against known emotional content; "interesting but uncertain" weak signal category |
| Timeline band chart too complex for existing SVG approach | Medium | Low | Can adopt a charting library; component interface unchanged |
| Notable letters list surfaces uninteresting outliers | Medium | Low | Curate thresholds during Phase 4 polish; can add editorial override |

### Deep linking

The page supports deep linking via URL search params: `/sentiment/?brev=123` opens directly to the sentence-level detail view for letter 123. The URL updates via `router.replace` (no page reload) when selecting or deselecting a letter. The `useSearchParams` hook is wrapped in a `Suspense` boundary as required by Next.js static export.

## Replanning Triggers

1. **Sentence file > 1 MB gzipped** → Split into per-letter files or implement pagination
2. **CVP scores don't correlate with known emotional letters** → Add editorial annotations alongside scores; reframe as "computational reading" rather than "mood analysis"
3. **User testing shows overview is overwhelming** → Simplify to timeline + notable letters only; move distribution and signals to a "mere" (more) expandable section
4. **Charting library needed** → Evaluate Recharts (already React, smallest bundle) vs hand-rolled SVG (consistency with existing code)

## Related

- ADR-030: CVP Sentiment Implementation (data foundation)
- ADR-025: Sentiment Analysis on Normalized Text (original sentiment approach)
- ADR-029: Artifact Hashing (skip logic for pipeline)
- ADR-035: Mobile Responsiveness (new section must follow mobile-first patterns)
