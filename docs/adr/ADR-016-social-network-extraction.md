# ADR-016: Social Network Extraction and Visualization

## Status
Proposed

## Context

The letters mention dozens of people beyond the primary correspondents (Peter, Trine, Mor og Far). Names like Uffe, Bodil, Maren Fog, Anders Thojsen, Konow, and various soldiers appear throughout the corpus. The existing `ordforklaringer.md` glossary already identifies many recurring names.

These mentions encode a social network — who Peter talks about, to whom, and when. Extracting and visualizing this network reveals:

- The structure of Peter's social world (family, military, community)
- How that world changes with deployment and war
- Who disappears from the letters (casualties? lost contact?)
- Information brokers who bridge home and front
- The density and diversity of Peter's social support network over time

Network analysis of historical correspondence is an established method in digital humanities but has not been applied to Danish WWI letters.

## Decision

### 1. Named Entity Extraction

Use a two-pass approach:

**Pass 1: spaCy NER** (`da_core_news_lg`) to extract PER entities from all 665 letters. Expected issues: archaic name forms, German names, inconsistent capitalization.

**Pass 2: Gazetteer matching** using a manually curated name dictionary seeded from `ordforklaringer.md` and expanded through Pass 1 results. The gazetteer handles:
- Name variants: "Trine" / "min Trine" / "lille Trine"
- Familial references: "Mor" → Maren Maersk, "Far" → Peter Maersk Sr.
- Military titles: "Gefr. Hansen" → disambiguated person
- Nicknames and diminutives

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

**Library:** D3.js force simulation (consistent with existing visualization stack).

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
- Run NER on modernized text (ADR-014) for better accuracy
- Start with a conservative gazetteer (high-confidence names only) and expand iteratively
- Use a minimum co-mention threshold (≥2 letters) to filter noise from edges
- Manual review of the person registry before computing metrics

## Validation
- Person registry covers all names mentioned in `ordforklaringer.md`
- NER recall: >80% of known persons detected in a 50-letter sample
- Network visualization renders correctly with interactive features
- Temporal animation shows expected pattern: pre-war community → military names appearing 1914+ → post-war
