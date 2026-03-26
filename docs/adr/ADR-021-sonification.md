# ADR-021: Data Sonification — The Sound of 665 Letters

## Status
Proposed

## Context

Visualizations excel at spatial patterns but struggle with temporal patterns that unfold over long durations. The human auditory system detects temporal regularities, rhythm changes, and gradual shifts that the eye misses in charts. Data sonification — mapping data dimensions to musical parameters — is an established technique in scientific visualization and an increasingly common approach in digital humanities.

The Jernkorset corpus has strong temporal structure (7 years, 665 data points) and rich per-letter metrics (sentiment, entropy, letter frequency, audience, health). This is well-suited to sonification.

### Precedents
- "Listening to Noise and Silence" (Voegelin, 2010) — theoretical framework for sonic data
- Mark Hansen's sonification of financial and social data
- Various DH projects sonifying literary corpora (typically novel sentiment arcs)
- Brian Foo's "Data-Driven DJ" project — sonification of cultural data

## Decision

### Mapping Scheme

Compress 7 years (1911–1918) to ~7 minutes of audio. Each letter maps to a position on the musical timeline proportional to its date.

| Data Dimension | Musical Parameter | Rationale |
|---------------|-------------------|-----------|
| **Sentiment score** | Pitch (MIDI note) | Positive → higher, negative → lower. Maps the emotional arc to melody. |
| **Letter length** | Note duration + volume | Short terse letters = staccato; long reflective letters = sustained notes. Combat letters become percussive. |
| **Sender identity** | Instrument/timbre | Peter = piano, Trine = strings, Mor og Far = cello, others = woodwinds. Disappearance of a sender's instrument = audible absence. |
| **Letter frequency** | Tempo/density | Many letters in a period = fast passages; gaps = rests/silence. Active combat silence becomes literal silence. |
| **Shannon entropy** | Consonance/dissonance | Low entropy (constrained) = consonant intervals; high entropy (free) = more complex harmonics. Self-censored letters sound "resolved." |
| **German code-switching density** | Percussion/noise layer | Higher density = subtle military drum/march rhythm layered under the melody. |

### Implementation Options

#### Option A: Browser-Based (Tone.js) — Recommended

Build a `/sonification` page with an interactive player:

```
Timeline scrubber: |=====>==================|
                   1911                   1918
Play/Pause  Speed: [1x] [2x] [5x]

Currently playing: Letter #234, 14 March 1916, to Trine
[Sentiment: +12] [Entropy: 4.2] [Length: 1,834 chars]
```

**Tone.js** (Web Audio API wrapper, ~150 KB) provides:
- Synthesizers with configurable timbre per instrument
- Precise scheduling on the audio timeline
- Real-time parameter changes for interactive scrubbing

The sonification page synchronizes with:
- A mini-map showing Peter's current position
- The letter text scrolling alongside
- A metric dashboard showing current values

**Effort:** 2–3 weeks

#### Option B: Pre-Rendered Audio (Python midiutil)

Generate a MIDI file at build time, render to MP3/WAV. Embed as an audio player with synchronized visuals.

**Pros:** No client-side synthesis, smaller page weight, wider browser compatibility
**Cons:** Not interactive (no scrubbing to arbitrary positions), harder to synchronize with other visualizations

**Effort:** 1–2 weeks

### Recommended: Start with Option A

The interactivity (scrubbing, hovering over the timeline to preview a letter, toggling instruments on/off) is essential for exploration. Option B can serve as a fallback export for conference presentations.

### The Sound of Absence

A distinctive feature: gaps between letters (no mail for days or weeks) are rendered as silence or a low sustained drone. The rhythm of mail delivery — frequent letters, then silence, then a burst — becomes audible. This is how Peter's family experienced the war: through the tempo of the postman.

Periods where Trine's instrument is absent (did she stop writing? were letters lost?) become noticeable gaps in the harmonic texture.

### Musical Parameters (Detailed)

**Pitch mapping:**
- Sentiment range: approximately −30 to +30 (from existing scores)
- Map to MIDI notes 48–84 (C3 to C6), linear interpolation
- Smoothing: apply 3-letter rolling average to avoid jarring jumps

**Duration mapping:**
- Letter length range: 11 to 5,846 characters
- Map to note durations 0.1s to 2.0s, logarithmic scale
- Minimum gap between notes: 0.05s

**Instrument assignment:**
- Peter Maersk → Piano (Tone.Synth)
- Trine → Violin-like (Tone.AMSynth with slow attack)
- Mor og Far → Cello-like (Tone.FMSynth, low register)
- Konow → Clarinet-like (Tone.MonoSynth)
- Others → Bell-like (Tone.MetalSynth, quiet)

**Entropy → Harmony:**
- Low entropy (< median): notes are quantized to major scale intervals
- High entropy (> median): notes include chromatic passing tones and blue notes
- Transition is gradual, not binary

## Consequences

### Positive
- Makes temporal patterns perceptible that are invisible in charts
- Unforgettable at conference presentations and museum exhibits
- The "sound of absence" is a powerful conceptual contribution — experiencing the war through mail rhythm
- Interactive scrubbing connects sound to individual letters, grounding the abstraction
- Accessible: sonification reaches audiences who may not engage with charts or text

### Negative
- Musical taste is subjective — parameter choices require iteration and user testing
- Tone.js adds ~150 KB to the page
- Browser audio has quirks: autoplay policies, latency differences, mobile limitations
- Risk of being perceived as gimmicky if not executed with care

### Mitigation
- Provide volume/mute controls and never autoplay
- Test on Chrome, Firefox, Safari, and mobile Safari
- Iterate on parameter mapping with 3–5 test listeners before finalizing
- Frame as "an exploration" rather than a definitive sonic representation
- Provide a "how to listen" guide explaining the mapping scheme

## Validation
- Audio plays without errors across Chrome, Firefox, Safari (desktop)
- Timeline scrubber synchronizes audio position with visual indicators
- Known emotional peaks (Christmas letters, deployment) are audibly distinct
- 3 test listeners can identify at least 2 structural features (e.g., "it gets quieter here," "the mood drops") without being told what to listen for
