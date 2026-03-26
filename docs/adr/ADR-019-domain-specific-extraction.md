# ADR-019: Domain-Specific Information Extraction

## Status
Proposed

## Context

The letters contain structured information embedded in unstructured text — health observations, economic conditions, weather reports, material culture, musical references, and temporal expressions. Extracting this information transforms the corpus from a literary archive into a multidimensional historical dataset.

Each extraction domain is low-effort (regex + lexicon-based), produces independently valuable data, and feeds into visualizations (ADR-018) and the Cognitive Atlas (ADR-020).

### Cross-Domain Connections

These extractions gain value through combination:
- **Health + Geography** → disease environment mapping across fronts
- **Economics + Time** → wartime scarcity timeline with primary-source evidence
- **Weather + Geography + Time** → historical meteorological observations
- **Material culture + Economics** → the economy of care (packages between home and front)

## Decision

### Extraction Domains

#### 1. Health and Disease (`data/letter-health.json`)

**Lexicon (Danish + German military medical terms):**
- Illness: forkølet, syg, feber, ondt, svag, dårlig, influenza, tyfus
- Injury: såret, sår, brækket, slået, blod
- Medical: hospital, lazaret/Lazarett, doktor, Sanitäter, medicin, forbinding
- Death/casualty: død, falden/faldet, dræbt, begravet
- Food/nutrition: sulten, mad, brød, smør, pålæg, sukker, kød, Hestesukker

**Output per letter:** list of health mentions with category, context window (±20 chars), and severity estimate (mention vs. personal experience vs. reporting others).

**Historical interest:** Spans the 1918 Spanish Flu pandemic. Cross-reference health mention frequency with known pandemic waves.

**Effort:** 2–3 days

#### 2. Economic Conditions (`data/letter-economics.json`)

**Lexicon:**
- Scarcity: ingen, mangler, kan ikke få, savner, rationering
- Commodities: smør, sukker, brød, kød, mel, kaffe, tobak, tøj, sko
- Packages: pakke, sendt, modtaget, indhold
- Money: penge, mark, kroner, øre, betale, koste, dyr, billig

**Output per letter:** commodity mentions, package events (sent/received/requested with contents), scarcity indicators, any price mentions.

**Aggregate output:** monthly scarcity index (scarcity words per 1000 words), package frequency timeline, commodity availability heatmap over time.

**Historical interest:** Cross-references with the German Turnip Winter (1916–17) and the Allied blockade's impact on civilian provisioning.

**Effort:** 2–3 days

#### 3. Weather and Climate (`data/letter-weather.json`)

**Lexicon:**
- Conditions: vejr, regn, sne, sol, sky, tåge, storm, blæst, frost, is, varme, kulde, tørt, vådt
- Temperature: grader, koldt, varmt, frysende, sveder
- Seasonal: forår, sommer, efterår, vinter

**Output per letter:** weather mentions with date and geocoded location.

**Historical interest:** First-person meteorological observations from specific dates and locations across Europe. Where historical weather station data is sparse (Eastern Front 1914–1915), these observations contribute to historical climatology.

**Validation:** Compare extracted observations against European Climate Assessment & Dataset (ECA&D) records for overlapping dates/locations.

**Effort:** 1–2 days

#### 4. Material Culture (`data/letter-material.json`)

**Extract:**
- Writing conditions: blyant, pen, blæk, papir, lys, stearinlys
- Living conditions: seng, halm, telt, barak, skyttegrav, bunker, kvarter
- Personal items: ur, billede, fotografi, bog, bibel, sangbog
- Clothing: uniform, støvler, strømper, handsker, kappe

**Output per letter:** material mentions with context.

**Historical interest:** Reconstructs the material conditions of a Danish soldier's daily life. What objects flow between home and front in packages? What does Peter request, and what does he receive?

**Effort:** 1–2 days

#### 5. Musical and Cultural References (`data/letter-music.json`)

**Lexicon:**
- Music: sang, synge, musik, melodi, salme, vise, spille, harmoni, dans, danse
- Specific songs/hymns: cross-reference against Den Danske Salmebog
- Cultural events: koncert, gudstjeneste, fest, jul, påske, pinse

**Output per letter:** cultural reference mentions, identified songs/hymns where possible.

**Historical interest:** The role of music and religion in maintaining morale and cultural identity for a Danish minority within the German army.

**Effort:** 1–2 days

#### 6. Temporal Expressions (`data/letter-temporality.json`)

**Extract (beyond the psycholinguistic metrics in ADR-015):**
- Future references with estimated horizon: "i morgen" (1 day), "næste uge" (7 days), "til Jul" (variable), "efter krigen" (indefinite)
- Past references: "i går," "sidst vi," "for et år siden"
- Waiting indicators: vente, håbe, længsel, snart, endnu, når
- Mail references: "Tak for Brevet," "Dit Brev af [date]," "jeg skrev sidst"

**Output per letter:** temporal expressions with estimated horizon (days), direction (past/future), mail event indicators.

**Derived metric:** "temporal horizon" — median future reference horizon per letter. Hypothesis: shrinks as war intensifies.

**Effort:** 2–3 days

### Implementation Architecture

All extraction scripts share a common pattern:

```
scripts/extract-{domain}.py
  Input: data/search-corpus.json (or data/modernized-letters.json)
  Output: data/letter-{domain}.json
  Format: { "letters": { "1": { ... }, "2": { ... }, ... } }
```

Each script:
1. Loads the letter corpus
2. Applies domain-specific lexicon/regex matching
3. Extracts mentions with context windows
4. Computes per-letter aggregate metrics
5. Computes corpus-level temporal aggregates
6. Outputs structured JSON

A master script `scripts/extract-all-domains.py` runs all extractors and validates output consistency.

### Running on Original vs. Modernized Text

Run extraction on **both** original and modernized text (ADR-014):
- Original: captures archaic terms and German loanwords as-is
- Modernized: catches terms normalized to modern spelling
- Merge results, deduplicating overlapping mentions

## Consequences

### Positive
- Transforms unstructured letters into a structured multidimensional dataset
- Each domain is independently valuable and low-effort
- Cross-domain combination reveals patterns invisible to single-domain analysis
- Produces data for health historians, economic historians, climate scientists, and material culture scholars
- All outputs feed into visualizations (ADR-018) and the Cognitive Atlas (ADR-020)

### Negative
- Regex/lexicon-based extraction will have both false positives and false negatives
- Domain lexicons need manual curation and expansion as new terms are discovered
- Six separate JSON files may become unwieldy — consider a merged `letter-annotations.json`

### Mitigation
- Start with conservative lexicons (high precision, lower recall) and expand iteratively
- Provide context windows in output so false positives can be manually identified
- Consider a unified extraction framework if the individual scripts become redundant

## Validation
- Each extractor's lexicon coverage: >80% of manually identified mentions in a 30-letter sample
- False positive rate: <20% in a 30-letter sample per domain
- Temporal aggregates show expected patterns (health mentions spike 1918, scarcity spikes 1916–17)
- All output files are valid JSON and keyed by letter ID
