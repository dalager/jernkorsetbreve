# ADR-023: "Parallel Lives" — Synchronized Multi-Stream Narrative Visualization

## Status
Proposed

## Context

The Jernkorset corpus is not just a dataset — it is a human story unfolding over seven years. Individual visualizations (ADRs 018, 020, 021) each reveal one dimension. But the most powerful insight comes from seeing multiple dimensions simultaneously, synchronized to a single timeline.

This is the "moonshot" visualization: a full-screen, time-synchronized experience showing Peter's journey through the war across six simultaneous data streams.

### Inspiration
- NYT "Snow Fall" (2012) — multimedia scrollytelling
- Lev Manovich's "Cultural Analytics" — multi-panel synchronized data views
- Museum interactive exhibits — Sønderborg Castle already has a WWI permanent exhibition

## Decision

### The Six Streams

A full-screen layout with synchronized panels, all driven by a single timeline scrubber:

```
┌─────────────────────────────────────────────────────────┐
│ ◀ ▶ ⏸  ═══════════●══════════════════  1914-08-01  ▸▸ │
├────────────────────────┬────────────────────────────────┤
│                        │                                │
│   1. MAP TRACK         │   2. SOCIAL NETWORK            │
│   Peter's animated     │   Force-directed graph         │
│   position on a        │   of mentioned people,         │
│   historical map       │   evolving with each letter    │
│                        │                                │
├────────────────────────┼────────────────────────────────┤
│                        │                                │
│   3. EMOTIONAL ARC     │   4. LETTER TEXT               │
│   Sentiment + entropy  │   Current letter scrolling     │
│   + trauma composite   │   (original + modern Danish)   │
│   as a waveform        │                                │
│                        │                                │
├────────────────────────┼────────────────────────────────┤
│                        │                                │
│   5. HISTORICAL        │   6. SONIFICATION              │
│   CONTEXT              │   Audio player with            │
│   Battle markers,      │   visual waveform,             │
│   political events,    │   instrument legend            │
│   pandemic waves       │                                │
│                        │                                │
└─────────────────────────────────────────────────────────┘
```

### Synchronization Architecture

A shared `TimelineController` manages the current date:

```typescript
interface TimelineController {
  currentDate: Date;
  currentLetterIndex: number;
  isPlaying: boolean;
  playbackSpeed: number; // 1x = 1 year per minute

  subscribe(callback: (date: Date, letterIndex: number) => void): void;
  seek(date: Date): void;
  play(): void;
  pause(): void;
  setSpeed(speed: number): void;
}
```

All six panels subscribe to the `TimelineController` and update when the date changes. The controller advances either by:
- User scrubbing the timeline
- Auto-play at configurable speed
- Clicking a letter in any panel (jumps all panels to that date)

### Panel Specifications

#### Panel 1: Map Track
- Leaflet map with historical borders (existing infrastructure)
- Animated marker for Peter's position
- Trail line colored by sentiment
- Battle markers appear/pulse when Peter is within 100km
- Distance-from-home counter

**Data:** Existing geocoded locations + `battles.json` + `letter-sentiments.json`

#### Panel 2: Social Network
- D3.js force simulation (from ADR-016)
- Shows the network state at the current date
- New nodes fade in when first mentioned
- Nodes that haven't been mentioned in >6 months begin to fade
- Edge thickness reflects recent co-mention frequency
- Compact layout for the constrained panel size

**Data:** `social-network.json` with temporal slicing

#### Panel 3: Emotional Arc
- Multi-line sparkline showing:
  - Sentiment (primary, colored)
  - Entropy (secondary, gray)
  - Trauma composite (tertiary, dashed)
- Vertical "now" line synchronized with timeline
- Smooth animation as the line extends with each letter
- Small multiples option: show Trine vs. Parents separately

**Data:** `letter-sentiments.json`, `letter-entropy.json`, `letter-psycholinguistics.json`

#### Panel 4: Letter Text
- Current letter displayed with:
  - Original text
  - Modernized text (toggle, from ADR-014)
  - Highlighted domain mentions (health in red, economics in orange, etc.)
- Metadata header: date, location, recipient
- Navigation: previous/next letter buttons

**Data:** Letter texts + `modernized-letters.json` + domain extraction JSONs

#### Panel 5: Historical Context
- Timeline of external events synchronized with Peter's letters
- Events appear as labeled markers on a vertical timeline
- Categories: military (battles), political (treaties, declarations), personal (holidays), pandemic
- Sources: `battles.json`, manually curated event list

**Data:** `battles.json` + new `data/historical-events.json` (manually curated)

#### Panel 6: Sonification
- Tone.js audio player (from ADR-021)
- Visual waveform showing the generated audio
- Instrument legend with mute toggles
- Volume control
- Current note highlighted

**Data:** Derived from all metrics (ADR-021 mapping scheme)

### Responsive Behavior

- **Desktop (≥1200px):** Full 3×2 grid as shown above
- **Tablet (768–1199px):** 2×3 grid, smaller panels, sonification collapsed to audio-only
- **Mobile (<768px):** Single-column stack, only map + letter text + timeline. Link to full experience on desktop.

### Build Strategy

Each panel is an independent React component that consumes the `TimelineController` context. This means:
1. Each panel can be developed and tested independently
2. Panels can be reused on their individual pages (ADR-018)
3. The "Parallel Lives" page composes them into the synchronized layout

### Performance

- Lazy-load panels below the fold
- Throttle update callbacks to 60fps max
- Pre-compute all data at build time — no runtime computation
- D3.js force simulation: limit to 50 iterations per frame

## Consequences

### Positive
- Creates a museum-quality interactive documentary experience
- Every component is independently valuable (developed via ADRs 016–021) — this ADR only adds the synchronization layer
- The editorial power of juxtaposition: seeing sentiment drop as the map shows Peter approaching a battle site, while the social network adds military names — this is understanding
- Conference demo that makes the project memorable
- Potential museum exhibit (Sønderborg Castle Museum)

### Negative
- Most complex visualization in the project — integration of 6 independent systems
- Performance risk: 6 animated panels updating simultaneously
- Editorial design decisions (what to emphasize, how to label) require humanities expertise
- Full experience only works on desktop

### Mitigation
- Build panels independently first (ADRs 016–021), then integrate
- Profile performance early with all 6 panels active
- Collaborate with a historian or museum professional on editorial framing
- Mobile gets a curated subset, not a broken version of the full experience

### Phased Delivery

| Phase | Panels | Effort |
|-------|--------|--------|
| MVP | Map + Letter Text + Timeline | 1 week (mostly integration) |
| V2 | + Emotional Arc + Historical Context | 1 week |
| V3 | + Social Network + Sonification | 2 weeks |

## Validation
- All 6 panels stay synchronized within 100ms of each other during playback
- Scrubbing to any date updates all panels correctly
- Page maintains >30fps during playback on a mid-range laptop
- 3 test users can narrate what they see without technical guidance
- The experience loads in <5 seconds on desktop broadband
