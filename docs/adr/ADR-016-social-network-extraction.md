# ADR-016: Social Network Extraction and Visualization

## Status
Accepted (2026-04-04; disappearance data output pending)

## Context

The letters mention dozens of people beyond the primary correspondents (Peter, Trine, Mor og Far). Names like Uffe, Bodil, Maren Fog, Anders Thojsen, Konow, and various soldiers appear throughout the corpus. The existing `ordforklaringer.md` glossary already identifies many recurring names.

These mentions encode a social network — who Peter talks about, to whom, and when. Extracting and visualizing this network reveals:

- The structure of Peter's social world (family, military, community)
- How that world changes with deployment and war
- Who disappears from the letters (casualties? lost contact?)
- Information brokers who bridge home and front
- The density and diversity of Peter's social support network over time

Network analysis of historical correspondence is an established method in digital humanities but has not been applied to Danish WWI letters.

## Replan Notes (2026-04-03)

A GOAP analysis compared this ADR against actual project progress and found a **moderate replan** is needed. The goal remains valid but the path has changed:

### What changed since proposal

1. **NER already partially done**: `data/NER_entities.csv` (4,575 mentions) and `NER_entities_grouped.csv` (1,266 entities) exist from `notebooks/04_extract_named_entities.ipynb`, but with quality issues (false PER: Gud, Bromberg, Regt, military ranks; duplicates: Konov/Konow).
2. **DaCy adopted**: The project now uses DaCy (`da_dacy_large_trf`) for NLP work (ADR-040), which outperforms the originally proposed `da_core_news_lg`.
3. **Modernized text available**: `data/normalized-letters.json` from ADR-014 enables higher-quality NER.
4. **Ordforklaringer is near-empty**: `research/ordforklaringer.md` has only 2 entries, not the rich glossary assumed. The gazetteer must be built bottom-up from NER output instead.
5. **RuVector directory is empty**: No integration work has been done. For ~50-80 person nodes, a graph database is over-engineered.

### Revised decisions

- **Drop Step 6 (RuVector)** — use the fallback path: pre-compute with NetworkX, export static JSON for D3.js.
- **Replace spaCy with DaCy** — run on `text_normalized` for better accuracy on archaic Danish.
- **Invert gazetteer strategy** — bootstrap person registry from NER output + manual audit, not from ordforklaringer.
- **Add entity quality audit step** — clean ~300+ false PER mentions before network construction.

### Post-implementation enrichment (2026-04-04)

Three follow-up ADRs extend the social network pipeline:

- **ADR-042 (Person disambiguation):** Split conflated bare first names (Niels, Maren) into distinct persons using co-occurrence evidence. Registry grew from 61 to 65 entries.
- **ADR-043 (Epithet resolution):** Identified 197 epithet mentions ("den gamle", "den lille", "Tante", etc.) and resolved "den gamle" as referring to both a commanding officer and Peter's father.
- **ADR-044 (OSINT cross-referencing):** Defined a structured research queue for the 20 disappeared and 30 unknown persons, targeting Rigsarkivet, kirkeboger.dk, and other Danish archives.

### Revised phase plan

```
Phase A (parallel, immediate):
  A1: Join existing NER → letter_id via sentences.csv       [quick win]
  A2: Entity quality audit — remove false PER, merge dupes  [semi-manual]
  B1: Re-run DaCy NER on normalized text                    [new notebook]

Phase B (after A):
  B2: Build person-registry.json from NER + audit           [semi-manual]

Phase C (after B2):
  C1: NetworkX graph construction → social-network.json
  C2: Compute centrality, PageRank, modularity metrics

Phase D (after C):
  D1: /network page with D3.js force graph + timeline slider
  E1: Disappearance analysis — silence dates, fading nodes
```

---

## Decision (original, with amendments noted)

### 1. Named Entity Extraction

~~Use a two-pass approach:~~

~~**Pass 1: spaCy NER** (`da_core_news_lg`) to extract PER entities from all 665 letters.~~ **Amended:** Use DaCy (`da_dacy_large_trf`) on the normalized text from `data/normalized-letters.json`. An initial NER run already exists (`data/NER_entities.csv`) but has quality issues requiring a re-run.

**Pass 2: Gazetteer matching** using a manually curated name dictionary ~~seeded from `ordforklaringer.md`~~ **built bottom-up from NER output** and expanded through manual review. The gazetteer handles:
- Name variants: "Trine" / "min Trine" / "lille Trine" / "Trinelil"
- Familial references: "Mor" / "Moer" → Maren Maersk, "Far" → Peter Maersk Sr.
- Military titles: "Gefr. Hansen" → disambiguated person
- Nicknames and diminutives
- Known misclassifications to exclude: Gud, Regt, Feldv/Feldw, military ranks

Output: `data/letter-entities.json` — per-letter list of recognized person mentions with character offsets.

### 2. Name Disambiguation

Create `data/person-registry.json`:
```json
{
  "trine": {
    "canonical": "Trine",
    "aliases": ["Trine", "min Trine", "lille Trine", "min egen kjære Trine"],
    "role": "romantic_partner",
    "category": "family"
  },
  "mor": {
    "canonical": "Maren Maersk",
    "aliases": ["Mor", "Moder"],
    "role": "mother",
    "category": "family"
  }
}
```

### 3. Network Construction

Build `data/social-network.json`:

**Nodes:** Each unique person, with attributes:
- `letter_count`: number of letters mentioning this person
- `first_mention`: date of first appearance
- `last_mention`: date of last appearance
- `category`: family / military / community / other
- `role`: specific relationship to Peter

**Edges:** Two people share an edge if mentioned in the same letter, with:
- `weight`: number of co-mention letters
- `temporal_distribution`: which years/months they co-appear

**Temporal slices:** The full network sliced by year (1911–1918) to show evolution.

### 4. Network Metrics

Compute per node:
- **Degree centrality**: how connected is this person?
- **Betweenness centrality**: who bridges separate social worlds?
- **PageRank**: who is the most "important" person in Peter's letters?
- **Temporal persistence**: how long does this person appear in the correspondence?

Compute per time slice:
- **Network density**: how interconnected is Peter's mentioned social world?
- **Modularity**: does the network split into communities (home vs. front)?
- **New nodes per period**: rate of new people entering Peter's life

### 5. Visualization

A force-directed graph on a new `/network` page:
- Nodes sized by letter count, colored by category
- Edges weighted by co-mention frequency
- Timeline slider to animate the network year by year
- Click a node to see all letters mentioning that person
- Hover to highlight connected nodes

**Library:** D3.js force simulation (consistent with existing visualization stack). Graph data served as static JSON from NetworkX build step.

### 6. ~~RuVector Integration~~ Graph Backend (Amended)

~~The social network is the strongest candidate for RuVector integration across all ADRs (fit: 9/10).~~

**2026-04-03 amendment:** RuVector integration is **dropped**. The `RuVector/` directory is empty and for a graph of ~50-80 person nodes, a dedicated graph database is over-engineered. The fallback path from the original ADR is now the primary approach:

**Adopted approach:** Pre-compute all metrics at build time using Python/NetworkX and export static JSON for D3.js. The graph is small enough that pre-computation is entirely adequate. If client-side graph queries become desirable later, a lightweight JS graph library (e.g., graphology) can be added without a WASM dependency.

### Disappearance Analysis

Flag people who stop being mentioned:
- Compute a "silence date" — last mention of each person
- Cross-reference with known casualty data where available
- Visualize as nodes fading out on the temporal animation

People who vanish without explanation are historically significant — their disappearance may mark casualties, transfers, or broken relationships.

## Consequences

### Positive
- Reveals hidden social structure invisible from reading individual letters
- Temporal animation makes the war's social impact viscerally clear
- Disappearance analysis may surface historically unknown casualties or social disruptions
- The methodology transfers directly to other letter corpora
- Feeds into the Cognitive Atlas (ADR-020) as "social network centrality" feature

### Negative
- NER on archaic Danish will have significant error rate — manual correction needed
- Name disambiguation is labor-intensive and requires domain knowledge
- With ~665 letters, some network metrics may be noisy
- False co-mentions (two people mentioned in same letter but not related) create spurious edges

### Mitigation
- Run NER on modernized text (ADR-014) for better accuracy — **now actionable** with `data/normalized-letters.json`
- Start with a conservative gazetteer (high-confidence names only) and expand iteratively
- Use a minimum co-mention threshold (≥2 letters) to filter noise from edges
- Manual review of the person registry before computing metrics
- Exclude the implicit Peter–Trine edge (author–recipient) to avoid dominating the graph

## Validation
- Person registry covers all names mentioned in `ordforklaringer.md` **and** the top ~80 PER entities from NER output
- NER recall: >80% of known persons detected in a 50-letter sample
- Network visualization renders correctly with interactive features
- Temporal animation shows expected pattern: pre-war community → military names appearing 1914+ → post-war

## Known Entity Quality Issues (from 2026-04-03 audit)

The existing NER data (`data/NER_entities_grouped.csv`) contains these known issues that Phase A must address:

| Entity | Count | Issue |
|--------|-------|-------|
| Gud / Guds | 119 | Not a person — "God" |
| Konov / Konow / Konovs | 229 | Duplicates — merge to "Konow" |
| Regt | 34 | Abbreviation for Regiment |
| Feldv / Feldw / Feldveblen | 38 | Abbreviation for Feldvebel (rank) |
| Major / Leutn / Gefr | 43 | Military ranks, not persons |
| Bromberg | 33 | City in Prussia, not a person |
| Roagger | 13 | Village (Roager), not a person |
| Arys | 15 | Military camp in East Prussia |
| Halle / Hadersleben / Laon / Marne / Lotzen | 32 | Locations misclassified as PER |
| Trinelil / Trines | 23 | Aliases of Trine — merge |
| Peterlil | 7 | Alias of Peter — merge |
| Moer | 8 | Alias of Mor (mother) — merge |
| Hejmdal | 5 | Newspaper, not a person |
| Hindenburg | 9 | Ambiguous — could be person (von Hindenburg) or location |
