# Social Network Analysis: People in Peter's Letters

**Scope:** Extracting, disambiguating, and visualizing the social network encoded in 665 WW1 letters (1911–1918).
**Status:** Implemented. See ADR-016 for technical decisions.

---

## Why social network analysis?

Peter Maersk's letters mention dozens of people beyond the direct correspondents. Names appear, recur, and sometimes vanish. Read one at a time, these mentions are anecdotal. Read computationally across all 665 letters, they encode a social world — its structure, its evolution, and its losses.

The core questions:

1. **Who populated Peter's world?** Family, military comrades, community — and how large was each circle?
2. **How did the war reshape that world?** Did the network expand, contract, or split?
3. **Who bridged separate worlds?** Who connected the home front and the military front?
4. **Who disappeared?** When people stop being mentioned, what does the silence mean?

Network analysis of historical correspondence is an established digital humanities method, but it has not previously been applied to Danish WWI-era letters.

## The pipeline

The analysis runs as a five-step data pipeline, integrated into the project's `npm run data:all` build chain.

### Step 1: Named Entity Recognition

**Script:** `scripts/extract-entities-dacy.py`
**Input:** `data/normalized-letters.json` (modernized text from ADR-014)
**Output:** `data/letter-entities.json`

We run the DaCy transformer model (`da_dacy_large_trf`) on the normalized letter text rather than the original archaic Danish. This matters because NER models are trained on modern language — archaic spellings like "Kjære" or "Moer" cause systematic recognition failures.

DaCy extracts person (PER), location (LOC), and organization (ORG) entities with character offsets for each of the 665 letters. The full corpus yields approximately 4,900 entity mentions (3,200 PER, 1,500 LOC, 230 ORG).

**Why DaCy over spaCy?** The project originally planned to use spaCy's `da_core_news_lg`. DaCy wraps a larger Danish transformer and was adopted for other NLP work in the project (ADR-040). It produces fuller name spans — "Maren Fog" and "Thomas Nielsen" rather than fragments — and better distinguishes persons from locations.

**Why normalized text?** Running NER on the modernized text from `data/normalized-letters.json` avoids the systematic blind spots that archaic spelling creates. The normalization pipeline (ADR-014) handles the most frequent transformations ("aa" → "å", "saa" → "så", "kjære" → "kære") before the NER model sees the text.

### Step 2: Entity quality audit

**Script:** `scripts/audit-entities.py`
**Input:** `data/NER_entities_grouped.csv`
**Output:** `data/entity-audit.json`

No NER model is perfect, especially on historical text. The audit step programmatically corrects known error classes:

- **False persons removed:** "Gud" (God, 142 mentions), "Regt" (regiment abbreviation), "Feldv"/"Feldw" (military rank abbreviations), "Hejmdal" (a newspaper). These are frequent enough to distort the network.
- **Locations reclassified:** Bromberg, Roagger, Arys, Halle, Hadersleben, and others were tagged as PER but are places. The original NER confused these because they appear in person-like syntactic positions ("fra Bromberg", "i Arys").
- **Duplicates merged:** "Konov"/"Konow"/"Konovs" → "Konow" (229 combined mentions). "Trinelil"/"Trines" → aliases of "Trine". "Moer" → alias of "Mor".

The correction rules are encoded as data structures at the top of the script, designed to be extended as new issues are discovered.

### Step 3: Person registry

**Script:** `scripts/build-person-registry.py`
**Input:** `data/entity-audit.json`, `data/letter-entities-draft.json`, `data/letters.csv`
**Output:** `data/person-registry.json`

The person registry is the interpretive layer — it maps raw NER output to disambiguated, categorized people. Each entry has a canonical name, a list of aliases, a role, and a category.

The registry currently contains **61 persons** in four categories:

| Category | Count | Examples |
|----------|-------|---------|
| Family | 7 | Peter (author), Trine (wife), Mor, Far, Signe, Musse, Bodil |
| Military | 10 | Konow, Uffe, Petersen, Poulsen, Madsen, Schwartz, Skopnik |
| Community | 16 | Maren, Niels, Anna, Hans Nissen, Iver, Ellen |
| Unknown | 28 | Persons with ≥3 mentions but no confirmed classification |

A minimum threshold of 3 letter mentions filters out single-occurrence names (521 excluded). The 28 "unknown" persons are candidates for manual classification by someone with domain knowledge of the family and military history.

**Key design decision:** The registry was built bottom-up from NER output, not top-down from a pre-existing glossary. The project's `ordforklaringer.md` turned out to contain only 2 entries, so the originally planned gazetteer-seeding approach was inverted. Domain knowledge about the core family and military figures is encoded directly in the script as `KNOWN_PERSONS`.

### Step 4: Network construction and metrics

**Script:** `scripts/build-social-network.py`
**Input:** `data/person-registry.json`, `data/letter-entities-draft.json`, `data/letters.csv`
**Output:** `data/social-network.json`

Two people share an edge if they are mentioned in the same letter. Edge weight is the number of letters in which they co-occur. The Peter–Trine edge is excluded because Peter is always the author and Trine nearly always the recipient — their co-occurrence is structural, not informational, and at weight 197 it would dominate the graph.

Edges with weight < 2 are filtered to reduce noise from incidental co-mentions.

The resulting graph has **61 nodes and 201 edges** across 4 connected components.

**Per-node metrics:**
- **Degree centrality** — how many other persons co-occur with this person.
- **Betweenness centrality** — how often this person lies on the shortest path between others (a measure of brokering between social worlds).
- **PageRank** — recursive importance, similar to Google's original algorithm.
- **Temporal persistence** — how many distinct years (1911–1918) this person appears.

**Per-year temporal slices** capture how the network evolves, with density, node count, edge count, and newly appearing persons for each year.

### Step 5: Disappearance analysis

**Script:** `scripts/analyze-disappearances.py`
**Input:** `data/social-network.json`, `data/letters.csv`
**Output:** `data/social-network.json` (updated with disappearance metadata)

A person is flagged as "disappeared" if their last mention is more than 6 months before the end of the correspondence and they appeared in at least 5 letters. This avoids flagging infrequent mentions as disappearances.

Each person gets a **regularity score** (0–1): the ratio of years they were active to the span from first to last mention. A score of 1.0 means they were mentioned every year of their span, then stopped — more consistent with a sudden event (casualty, capture, transfer) than gradual loss of contact.

## Findings

### The shape of Peter's world

The network splits cleanly into the categories one would expect: a tight family cluster, a military cluster that grows from 1914 onward, and a dispersed community cluster.

The top five persons by PageRank:

| Person | PageRank | Category | Letters |
|--------|----------|----------|---------|
| Peter | 0.191 | family | 615 |
| Trine | 0.129 | family | 290 |
| Konow | 0.085 | military | 159 |
| Uffe | 0.075 | military | 82 |
| Niels | 0.043 | community | 26 |

### Trine as information broker

The most striking structural finding: **Trine has the highest betweenness centrality (0.31)**, higher than Peter himself (0.17). She sits at the junction between the home-front community and Peter's military world. Information flows through her — she is the person most likely to connect people who would otherwise not appear in the same letter.

This makes historical sense: Trine is the recipient, and Peter reports to her about people from both worlds. But the quantification reveals the degree to which she occupies a unique structural position.

### The war's social impact, year by year

| Year | Nodes | Edges | Density | New persons |
|------|-------|-------|---------|-------------|
| 1911 | 12 | 40 | 0.61 | 12 |
| 1912 | 17 | 45 | 0.33 | 8 |
| 1913 | 18 | 46 | 0.30 | 4 |
| **1914** | **28** | **72** | **0.19** | **11** |
| **1915** | **31** | **68** | **0.15** | **10** |
| 1916 | 31 | 72 | 0.15 | 6 |
| 1917 | 35 | 109 | 0.18 | 7 |
| 1918 | 25 | 73 | 0.24 | 1 |

The pre-war network (1911–1913) is small and dense — a close community of family and neighbours where everyone knows everyone. The density of 0.61 in 1911 means most mentioned people co-occur frequently.

The war breaks this open. In 1914–1915, the network nearly triples in size as military names flood in (Konow, Uffe, Petersen, Poulsen, Schwartz, Skopnik). But the density drops from 0.61 to 0.15 — the expanded network is much sparser. Peter now inhabits two social worlds that barely overlap.

By 1918, with only 1 new person entering, the network is contracting. The cast has solidified. The war is ending. The density ticks back up — not because the world is reconnecting, but because it has stopped growing.

### Who vanished

**18 of 61 persons disappeared** — last mentioned more than 6 months before the final letter, with at least 5 prior mentions.

The disappearances cluster in time:

- **1914:** 1 (Bodil — family, pre-war)
- **1915:** 2 (Poulsen, Truls)
- **1916:** 5 (Skopnik, P. Barsballe, Meiske, Sine, Petersen)
- **1917:** 9 — the catastrophic peak
- **1918:** 1 (Wilhelm)

The 1917 wave of 9 disappearances aligns with the deadliest year of the war on the Western Front (Third Ypres/Passchendaele, Arras, Cambrai). All military disappearances have a regularity score of 1.00 — they were mentioned consistently in every year of their span, then abruptly stopped. This pattern is more consistent with sudden events (death, capture, severe wounding) than gradual loss of contact.

Notable individual cases:

- **Poulsen** (22 letters, military) — last mentioned April 1915, during the Second Battle of Ypres period.
- **Petersen** (25 letters, military) — last mentioned August 1916, during the Battle of the Somme.
- **Schwartz** (11 letters, military) — last mentioned August 1917, during Third Ypres.

These dates and the military context make casualties or capture plausible, though the letters alone cannot confirm this. Cross-referencing with Danish military casualty records from German service (Sønderjylland was under German sovereignty) could potentially resolve some cases.

## Limitations and future work

**NER accuracy.** DaCy on normalized text is a significant improvement, but archaic Danish names and German military terminology still cause errors. The entity audit catches the most common ones, but the long tail of low-frequency misclassifications persists. The 28 "unknown" persons in the registry are candidates for manual review.

**Co-mention ≠ co-presence.** Two people mentioned in the same letter are not necessarily related to each other. A letter might mention Uffe in one paragraph and Maren in another with no connection between them. The minimum co-mention threshold (≥2 letters) reduces but does not eliminate this noise.

**Disappearance ≠ death.** People stop being mentioned for many reasons: Peter lost contact, the person moved away, or simply became less relevant to the conversation. The regularity score and military context provide circumstantial evidence but not proof.

**The 28 unknowns.** Nearly half the registry (28 of 61) has no confirmed category or role. A historian with knowledge of the Maersk family and the Danish community in Sønderjylland could likely classify most of these, significantly enriching the network's interpretive value.

**Disappearance data not yet surfaced in UI.** The `/network` page visualizes the graph structure and temporal evolution, but does not yet use the disappearance metadata (fading nodes, silence indicators). This is a natural next step for the visualization.

## File inventory

| File | Description |
|------|-------------|
| `scripts/extract-entities-dacy.py` | DaCy NER on normalized text |
| `scripts/audit-entities.py` | Programmatic entity quality corrections |
| `scripts/build-person-registry.py` | Person disambiguation and categorization |
| `scripts/build-social-network.py` | NetworkX graph construction and metrics |
| `scripts/analyze-disappearances.py` | Silence date and disappearance analysis |
| `data/letter-entities.json` | Per-letter entities with character offsets |
| `data/entity-audit.json` | Curated entity classifications |
| `data/person-registry.json` | 61 disambiguated persons |
| `data/social-network.json` | Graph, metrics, temporal slices, disappearances |
| `apps/website/src/app/network/page.tsx` | The /network route |
| `apps/website/src/components/SocialNetwork.tsx` | Timeline + detail panel |
| `apps/website/src/components/NetworkGraph.tsx` | D3.js force-directed graph |
| `apps/website/src/components/NetworkStatsPanel.tsx` | Metrics sidebar |
