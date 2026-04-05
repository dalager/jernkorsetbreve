# ADR-044: External Record Cross-Referencing (OSINT Strategy)

## Status

Accepted (2026-04-04; tooling complete, manual research ongoing)

## Date

2026-04-04

## Context

The person registry (`data/person-registry.json`) and social network (`data/social-network.json`) are built entirely from internal evidence — what Peter wrote in 665 letters. This gives us names, approximate roles, temporal spans, and co-occurrence patterns. But it cannot tell us:

- **Who these people actually were** — their full names, birthdates, occupations, family relations
- **Whether disappearances are deaths** — `docs/social-network-analysis.md` notes that 18 of 61 persons "disappeared" and that the 1917 cluster of 9 disappearances aligns with the deadliest year on the Western Front. But "the letters alone cannot confirm this."
- **Whether our disambiguation is correct** — ADR-042 splits Niels into Kjær and Skau based on textual evidence. External records could confirm or refute this.
- **Who the 28 "unknown" persons are** — nearly half the registry has no confirmed category or role.

This ADR defines a strategy for **cross-referencing the person registry against external historical sources** — a modern OSINT approach applied to a WW1 primary source corpus.

### The Sønderjylland Context

Peter Mærsk was a Danish-speaking farmer from the Roagger (Roager) area in Sønderjylland (North Schleswig), which was under German/Prussian sovereignty from 1864 to 1920. This means:

- **Military records are German**, not Danish — Peter and his neighbours served in the German Imperial Army (Deutsches Heer)
- **Civil records are bilingual** — church records (kirkebøger) are in Danish, civil registry (Standesamt) in German
- **The community was small** — Roagger/Øster Åbølling was a rural parish; most people mentioned in the letters would appear in the same set of records
- **The period is well-documented** — both Danish and German archives have digitized substantial collections from 1900–1920

### What We Know About Peter's Military Service

From the letters themselves, we can extract:
- Regiment and unit identifiers (mentioned in addresses and text)
- Deployment locations and dates (letter places: Halle, Bromberg, Arys, Laon, etc.)
- Names of military associates with approximate dates of acquaintance
- Rank progressions (Gefreiter, etc.)

This is enough to identify specific regimental muster rolls.

---

## Specification (SPARC-S)

### Requirements

1. **Source inventory**: Identify all relevant external databases and archives with their coverage, access methods, and limitations.
2. **Query strategy per source**: Define what to search for and how, tailored to each source's strengths.
3. **Linking criteria**: Define what constitutes a positive match between a registry person and an external record.
4. **Enrichment schema**: Define what fields from external records should be added to the person registry.
5. **Provenance tracking**: Every piece of externally-sourced information must cite its source, access date, and confidence level.
6. **Ethical boundaries**: Historical person records may involve living descendants. Define what information is appropriate to include in a public project.

### Acceptance Criteria

- Source inventory covers ≥ 5 relevant archives with access details
- At least one person from each registry category (family, military, community) has a documented cross-referencing attempt
- Any confirmed identifications are added to person-registry.json with provenance
- Disappearance cases (especially the 9 from 1917) have documented search attempts against casualty records

### Non-Goals

- This ADR does **not** require resolving every person. It defines the *strategy* and *sources*. Actual resolution is incremental research work.
- This ADR does **not** commit to any specific archival subscription or API integration.

---

## Pseudocode (SPARC-P)

### Source Priority Matrix

```python
SOURCES = [
    {
        "name": "Arkivalier Online (ao.dk)",
        "type": "Danish National Archives",
        "coverage": "Kirkebøger (church records), folketællinger (census)",
        "region": "All of Denmark including Sønderjylland",
        "period": "1646–present (varies by parish)",
        "access": "Free, web-based, no API",
        "strength": "Birth/death/marriage records for the Roagger parish",
        "use_for": ["family members", "community members", "birth/death dates"],
        "query_method": "manual_browse_by_parish_and_year",
    },
    {
        "name": "FamilySearch.org",
        "type": "Genealogical database",
        "coverage": "Indexed Danish parish records, census, emigration",
        "region": "Global, strong Danish coverage",
        "period": "1800s–1920s",
        "access": "Free account required, indexed search",
        "strength": "Indexed and searchable — faster than raw kirkebøger",
        "use_for": ["name verification", "family relationships", "dates"],
        "query_method": "search_by_name_place_date_range",
    },
    {
        "name": "Verlustlisten des Deutschen Heeres",
        "type": "German military casualty lists",
        "coverage": "All German Army casualties 1914–1918",
        "region": "German Empire (includes Sønderjylland)",
        "period": "1914–1918",
        "access": "Free via genealogy.net/verlustlisten",
        "strength": "Definitive source for casualties — confirms deaths, wounds, capture",
        "use_for": ["disappearance resolution", "military personnel confirmation"],
        "query_method": "search_by_surname_optionally_unit",
    },
    {
        "name": "Historisk Sønderjylland / Sønderjylland i Krigen",
        "type": "Regional historical database",
        "coverage": "Danish minority in German service during WW1",
        "region": "Sønderjylland specifically",
        "period": "1914–1918",
        "access": "Web-based, partially indexed",
        "strength": "Curated for exactly this population — Danish speakers in German army",
        "use_for": ["military service records", "community context", "known casualties"],
        "query_method": "browse_by_name_or_parish",
    },
    {
        "name": "Rigsarkivet / Sønderjyske Personregistre",
        "type": "Danish state archives — Sønderjylland civil registry",
        "coverage": "Standesamt records (German civil registry) for Sønderjylland",
        "region": "Sønderjylland parishes",
        "period": "1874–1920 (German civil registration period)",
        "access": "Via Arkivalier Online or in-person",
        "strength": "Civil birth/marriage/death, complements church records",
        "use_for": ["name verification", "family structure", "death dates"],
        "query_method": "browse_by_standesamt_and_year",
    },
    {
        "name": "Ancestry.dk / MyHeritage",
        "type": "Commercial genealogy platforms",
        "coverage": "Aggregated records, user-contributed family trees",
        "region": "Global, Danish focus",
        "period": "Varies",
        "access": "Subscription required for most records",
        "strength": "Cross-referenced trees may already identify these families",
        "use_for": ["secondary confirmation", "family tree context"],
        "query_method": "search_by_name_place",
    },
    {
        "name": "Bundesarchiv (German Federal Archives)",
        "type": "German military archives",
        "coverage": "Service records, unit histories",
        "region": "German Empire",
        "period": "1914–1918",
        "access": "In-person or written request; some digitized",
        "strength": "Regimental muster rolls — definitive for who served where",
        "use_for": ["military associate identification", "unit confirmation"],
        "query_method": "written_request_by_unit_and_period",
    },
]
```

### Cross-Referencing Workflow per Person

```python
def cross_reference_person(person, letters, sources):
    """
    Attempt to identify a registry person against external records.
    Priority order depends on person category.
    """
    results = {
        "person_id": person["id"],
        "canonical": person["canonical"],
        "searches_attempted": [],
        "matches_found": [],
        "confidence": "none",
    }

    if person["category"] == "military":
        # 1. Extract regiment/unit from Peter's letter addresses
        #    during the person's mention period
        unit_info = extract_military_context(person, letters)

        # 2. Search Verlustlisten if person disappeared
        if person.get("disappeared"):
            search_verlustlisten(person, unit_info, results)

        # 3. Search Sønderjylland i Krigen database
        search_historisk_sonderjylland(person, results)

    elif person["category"] == "family":
        # 1. Search kirkebøger for Roagger parish
        search_kirkeboger(person, "Roagger", results)

        # 2. Cross-reference with FamilySearch
        search_familysearch(person, "Roagger", results)

    elif person["category"] == "community":
        # 1. Search census (folketælling) for Roagger area
        search_folketaelling(person, "Roagger", results)

        # 2. Search kirkebøger
        search_kirkeboger(person, "Roagger", results)

    return results
```

### Enrichment Schema

```python
ENRICHMENT_FIELDS = {
    # Added to person-registry.json entries when confirmed
    "full_name": str,          # e.g., "Niels Christian Kjær"
    "birth_date": str,         # ISO 8601
    "birth_place": str,
    "death_date": str,         # ISO 8601 or null
    "death_place": str,        # e.g., "Vestfronten" / specific battle
    "death_cause": str,        # "killed_in_action", "disease", "wounds", null
    "occupation": str,         # e.g., "gårdmand" (farmer)
    "military_unit": str,      # e.g., "Infanterie-Regiment Nr. 86"
    "military_rank": str,
    "relation_to_peter": str,  # e.g., "neighbour in Roagger", "served in same company"
    "external_sources": [      # provenance for each claim
        {
            "source": str,     # e.g., "Verlustlisten des Deutschen Heeres"
            "record_id": str,  # e.g., "Liste 487, S. 12"
            "access_date": str,
            "url": str,        # if available
            "confidence": str, # "confirmed", "probable", "possible"
        }
    ]
}
```

---

## Architecture (SPARC-A)

### Research Workflow (Not a Pipeline)

Unlike ADR-042 and ADR-043 which produce deterministic scripts, this ADR describes **a research process**. External record lookups are manual, slow, and may require archive visits or subscription access. The architecture is therefore a documentation and tracking structure, not a code pipeline.

```
                ┌─────────────────────────┐
                │  person-registry.json    │
                │  (61 persons, 28 unknown)│
                └───────────┬─────────────┘
                            │
                  prioritize by research value
                            │
                ┌───────────▼─────────────┐
                │  Research Queue          │
                │  data/research-queue.json│
                │  - 18 disappeared persons│
                │  - 28 unknown persons    │
                │  - 5 conflated names     │
                └───────────┬─────────────┘
                            │
              ┌─────────────┼──────────────┐
              ▼             ▼              ▼
        ┌──────────┐  ┌──────────┐  ┌───────────┐
        │Verlust-  │  │Kirkebøger│  │FamilySearch│
        │listen    │  │(ao.dk)   │  │.org        │
        │(military)│  │(civil)   │  │(indexed)   │
        └────┬─────┘  └────┬─────┘  └─────┬─────┘
             │             │              │
             └─────────────┼──────────────┘
                           ▼
                ┌─────────────────────────┐
                │  data/external-records/  │
                │  research-log.json      │
                │  per-person findings     │
                └───────────┬─────────────┘
                            │
                  merge confirmed findings
                            │
                ┌───────────▼─────────────┐
                │  person-registry.json    │
                │  (enriched)              │
                └─────────────────────────┘
```

### Research Priority Order

The 18 disappeared persons are the highest-value targets because:
1. External records can definitively confirm or refute casualty status
2. The Verlustlisten are searchable by name — no parish browsing required
3. Confirmed casualties are historically significant findings
4. The social network analysis specifically identifies this as a gap

```
Priority 1 — Disappeared military (highest information gain):
  Poulsen (22 letters, last April 1915 — Ypres period)
  Petersen (25 letters, last Aug 1916 — Somme period)
  Schwartz (11 letters, last Aug 1917 — Third Ypres)
  Skopnik (9 letters, last Jan 1916)
  + other military disappearances from 1917 wave

Priority 2 — Core family (fills biographical picture):
  Peter Mærsk himself — regiment, rank progression, deployment history
  Trine — maiden name, marriage date, birth/death dates
  Far / Mor — full names, ages

Priority 3 — Community members with surnames (researchable):
  Niels Kjær, Niels Skau, Maren Hansen, Maren Bøjlesen, Hans Nissen,
  Thomas Nielsen, P. Barsballe, Georg Stilke, Søren Møller

Priority 4 — Unknown persons with ≥ 5 mentions:
  28 unknown entries — some may be identifiable with full names
  from census or church records
```

### Research Log Format

```json
{
  "person_id": "poulsen",
  "canonical": "Poulsen",
  "research_attempts": [
    {
      "date": "2026-04-10",
      "source": "Verlustlisten des Deutschen Heeres",
      "query": "Poulsen, searched lists from March-June 1915",
      "result": "Found: 'Poulsen, Hans, Musk., Inf.Rgt. 86, 3.Komp., gefallen 24.4.1915'",
      "confidence": "probable",
      "notes": "Regiment matches Peter's known unit. First name Hans not confirmed from letters but plausible. Date aligns with Second Battle of Ypres."
    },
    {
      "date": "2026-04-12",
      "source": "FamilySearch.org",
      "query": "Hans Poulsen, born ~1885-1895, Roagger parish",
      "result": "No match found",
      "confidence": "none",
      "notes": "Poulsen may not be from Roagger — could be from anywhere in Sønderjylland"
    }
  ],
  "resolution": {
    "status": "probable_match",
    "full_name": "Hans Poulsen",
    "death_date": "1915-04-24",
    "death_cause": "killed_in_action",
    "military_unit": "Infanterie-Regiment Nr. 86, 3. Kompanie",
    "confidence": "probable",
    "notes": "Regiment and date match. First name unconfirmed from letters."
  }
}
```

---

## Refinement (SPARC-R)

### Key Adjustment: This Is Research, Not Engineering

Unlike the other ADRs in this project, ADR-044 does not produce a deterministic script that can be run in a pipeline. It produces a research methodology and a structured format for recording findings. The "completion" is measured in persons resolved, not in scripts delivered.

The project should resist the temptation to automate this. The Verlustlisten are searchable but require human judgment to match (common surnames like Poulsen appear hundreds of times). Church records require manual browsing of handwritten register pages. This is digital humanities fieldwork, not data engineering.

### Key Adjustment: Living Descendants

Peter's letters are from 1911–1918. Some persons mentioned may have descendants alive today. The enrichment should:
- Include birth/death dates only for persons confirmed deceased
- Not include addresses or personal details of potential living relatives
- Focus on the historical period (pre-1920) rather than tracing family lines forward

### Key Adjustment: Regiment Identification Is the Key Lever

If Peter's regiment can be identified from letter addresses and deployment locations, the Verlustlisten search becomes much more targeted. Instead of searching "Poulsen" across all German Army casualties, search "Poulsen" within a specific regiment's lists. This dramatically reduces false positives.

The letter metadata (place, date) already encodes a deployment trajectory:
- 1913–1914: Training locations (Halle, etc.)
- 1914–1915: Eastern Front (Arys, Bromberg, etc.)
- 1916–1918: Western Front (Laon, etc.)

Cross-referencing these with regiment deployment histories (available in published unit histories) can identify the regiment with high confidence.

### Key Adjustment: Collaboration Opportunity

`docs/social-network-analysis.md` notes that "a historian with knowledge of the Maersk family and the Danish community in Sønderjylland could likely classify most of [the 28 unknowns]." This ADR's structured research queue and log format are designed to support exactly that collaboration — a domain expert can work through the queue without needing to understand the data pipeline.

---

## Completion (SPARC-C)

### Phase 1: Source Inventory and Access Verification

**Deliverable**: `data/external-records/source-inventory.json`

1. Verify access to each source (ao.dk, FamilySearch, genealogy.net/verlustlisten, etc.)
2. Confirm coverage for Roagger parish and the relevant period (1880–1920)
3. Document search interfaces and limitations
4. Identify any sources requiring subscriptions or archive visits

### Phase 2: Regiment Identification

**Deliverable**: `data/external-records/regiment-identification.json`

1. Extract all military addresses and location mentions from letters
2. Build a deployment timeline for Peter's unit
3. Cross-reference with published German regimental histories
4. Confirm regiment number (e.g., Infanterie-Regiment Nr. 86)

### Phase 3: Priority 1 — Disappeared Military Personnel

**Deliverable**: Research log entries for each of the 18 disappeared persons

1. Search Verlustlisten for each disappeared military person, using regiment if identified
2. Document all matches and near-matches
3. For confirmed matches: add enrichment fields to person-registry.json
4. For unresolved: document what was searched and not found

### Phase 4: Priority 2–4 — Family, Community, Unknown

**Deliverable**: Incremental research log entries

1. Search kirkebøger for core family members (Roagger parish)
2. Search census records for community members with surnames
3. Attempt identification of unknown persons with ≥ 5 mentions
4. Update person-registry.json with confirmed findings

### Phase 5: Documentation

**Deliverable**: Updated `docs/social-network-analysis.md`

1. Add a "Cross-referencing with external records" section
2. Document confirmed identifications and their significance
3. Update the "Limitations and future work" section
4. If any disappearances are confirmed as casualties, update the disappearance analysis

---

## Alternatives Considered

### Alternative 1: Automated web scraping of archival sources

Build scrapers for ao.dk, genealogy.net, FamilySearch, etc.

**Rejected** because:
- Most sources have terms of service prohibiting automated access
- The search requires human judgment (common names, handwritten records)
- The number of persons (61) is small enough for manual research
- Scraping archival sites is ethically problematic

### Alternative 2: Commission a professional genealogist

Hire a genealogist specializing in Sønderjylland to research all 61 persons.

**Deferred but viable**: a professional genealogist with local knowledge would be the most efficient path for Priority 2–4. The research queue and enrichment schema defined here would serve as their brief.

### Alternative 3: Crowdsource via a genealogy society

Post the research queue to Historisk Samfund for Sønderjylland or a Sønderjylland genealogy group.

**Worth exploring**: the structured research queue format makes this feasible. Local genealogy enthusiasts may recognize names from their own research. This approach is compatible with the ADR — the log format captures contributions from any source.

### Alternative 4: LLM-assisted research with web access

Use a language model with web browsing to search archival databases.

**Partially viable for indexed sources**: FamilySearch and Verlustlisten have text-searchable interfaces. An LLM with web access could perform initial searches and report findings for human verification. Not viable for kirkebøger (scanned handwritten pages require human reading).

---

## Consequences

### Positive

- Disappearance analysis moves from speculation to evidence ("casualties? lost contact?" → confirmed fates)
- The 28 unknown persons may gain categories and roles, completing the social network picture
- Person disambiguation (ADR-042) gains independent confirmation
- The project becomes a model for how digital humanities and OSINT methods complement each other
- Structured research format enables collaboration with historians and genealogists

### Negative

- Research is inherently uncertain — some persons may never be identified
- Time-intensive: manual archival research cannot be parallelized or automated
- Access to some sources may require subscriptions or physical archive visits
- Findings are contingent on record survival — German WW1 military records suffered significant losses in WW2 bombing

### Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| False positive: wrong "Poulsen" identified in casualty lists | High | Require corroborating evidence (regiment, date range, first name) before marking as confirmed |
| Records destroyed or inaccessible | Medium | Document negative results; use multiple sources for cross-confirmation |
| Privacy concerns for living descendants | Medium | Limit enrichment to historical period; do not trace family lines past 1920 |
| Scope creep into full genealogical research | Low | Stick to the enrichment schema — answer specific questions about registry persons, not general family history |

---

## Related

- **ADR-016**: Social Network Extraction — the parent ADR; cross-referencing validates and enriches the network
- **ADR-042**: Person Disambiguation — external records can independently confirm split decisions
- **ADR-043**: Epithet Reference Resolution — external records may clarify who "den gamle" is
- `docs/social-network-analysis.md` — "Limitations and future work" section explicitly calls for cross-referencing with Danish military casualty records
