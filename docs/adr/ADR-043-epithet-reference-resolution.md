# ADR-043: Epithet and Pronoun-like Reference Resolution

## Status

Accepted (2026-04-04)

## Date

2026-04-04

## Context

The NER pipeline (ADR-016) extracts named entities — "Peter", "Konow", "Maren Fog". But Peter's letters also refer to people through **epithets, kinship terms, and descriptive phrases** that NER models cannot capture:

- **"den gamle"** ("the old one") — appears in 83+ letters, consistently referring to an elderly male
- **"Far" / "Faer"** — already partially captured (6 letters), but "den gamle" may be the same person or a different elder
- **"Mor" / "Moer" / "Moder"** — already captured (4 letters)
- **"din Mand"** ("your husband") — already captured as a Peter alias
- **Diminutives and pet names** — "Peterlil", "Trinelil", "Musse" are captured, but others may be missed

The gap is significant. "Den gamle" alone appears in more letters (83+) than any person except Peter, Trine, and Konow. If this refers to Peter's father, then "Far" should have ~89 letter mentions rather than 6 — a 15x increase that would dramatically change his position in the social network.

As noted in `docs/social-network-analysis.md`, the network currently shows Far with only 6 mentions and low centrality. If "den gamle" is indeed Far, he becomes the 4th most-mentioned person in the corpus, fundamentally changing our understanding of the family structure in the letters.

---

## Specification (SPARC-S)

### Requirements

1. **Inventory all epithet references**: Systematically identify pronoun-like person references across the 665 letters that the NER pipeline misses.
2. **Contextual resolution**: For each epithet, determine whether it refers to an existing registry person or a new one, based on textual evidence.
3. **Evidence documentation**: Each resolution must cite specific letter passages as evidence.
4. **Confidence levels**: Distinguish between high-confidence resolutions (consistent usage across many letters) and uncertain ones.
5. **Registry integration**: Resolved epithets become aliases in `person-registry.json`.
6. **Entity pipeline integration**: The epithet extraction must feed into `letter-entities-draft.json` so that network metrics reflect the true mention counts.

### Acceptance Criteria

- "den gamle" is resolved: either added as alias of "Far" or established as a separate entry, with cited evidence
- At least 5 epithet patterns are inventoried and assessed
- Resolved epithets are added to person-registry.json as aliases
- Letter counts for affected persons are recalculated
- social-network.json is regenerated with corrected counts

---

## Pseudocode (SPARC-P)

### Phase 1: Epithet Pattern Discovery

```python
# Known epithet patterns to search for in letter texts
EPITHET_PATTERNS = [
    # Kinship terms used as names
    (r'\bden gamle\b', 'the old one'),
    (r'\bden lille\b', 'the little one'),
    (r'\bden unge\b', 'the young one'),
    (r'\bden syge\b', 'the sick one'),
    (r'\bBedstefar\b', 'grandfather'),
    (r'\bBedstemor\b', 'grandmother'),
    (r'\bSvigerfar\b', 'father-in-law'),
    (r'\bSvigermor\b', 'mother-in-law'),
    (r'\bOnkel\b', 'uncle'),
    (r'\bTante\b', 'aunt'),

    # Possessive person references
    (r'\bvor gamle\b', 'our old one'),
    (r'\bmin gamle\b', 'my old one'),
    (r'\bStakkel(?:s)?\b', 'poor one' — often used about a specific person),

    # Military rank as name (when consistently referring to one person)
    (r'\bFeldwebelen\b', 'the sergeant'),
    (r'\bLeutnanten\b', 'the lieutenant'),
    (r'\bHovedmanden\b', 'the captain'),
]

def scan_epithets(letters):
    """Find all epithet occurrences with surrounding context."""
    results = {}
    for pattern, meaning in EPITHET_PATTERNS:
        matches = []
        for letter in letters:
            for match in re.finditer(pattern, letter["text"], re.IGNORECASE):
                context_start = max(0, match.start() - 80)
                context_end = min(len(letter["text"]), match.end() + 80)
                matches.append({
                    "letter_id": letter["id"],
                    "date": letter["date"],
                    "match": match.group(),
                    "context": letter["text"][context_start:context_end],
                    "position": match.start(),
                })
        if matches:
            results[pattern] = {
                "meaning": meaning,
                "count": len(matches),
                "matches": matches,
            }
    return results
```

### Phase 2: Contextual Resolution

```python
def resolve_epithet(epithet, matches, registry):
    """
    Determine who an epithet refers to by analyzing:
    1. Co-occurrence with known persons in same letter
    2. Contextual clues (topics, activities, locations)
    3. Consistency across letters (does it always refer to the same person?)
    """
    # Example: "den gamle" resolution
    #
    # Evidence for "den gamle" = Far (Peter's father):
    # - Letter 25 (1913-01-26): "den gamle er kommen hertil ... vi er oppe
    #   at drikke kaffe sammen med ham" — elderly male visitor, familiar tone
    # - Letters consistently use "den gamle" in family/home context,
    #   not military context
    # - "Far"/"Faer" appears in 6 letters; "den gamle" in 83+
    #   — the low Far count suggests the epithet IS the primary way
    #   Peter refers to his father
    #
    # Counter-evidence to check:
    # - Does "den gamle" ever co-occur with "Far" in the same letter?
    #   If so, they might be different people.
    # - Does "den gamle" appear in military contexts where it might
    #   refer to an old soldier or officer?

    co_occurrences = find_co_occurrences_with(epithet, "Far", letter_entities)
    context_clusters = cluster_by_topic(matches)

    if co_occurrences:
        return Resolution(
            target=None,
            confidence="low",
            reason="co-occurs with Far — may be a different person"
        )
    elif context_clusters.is_consistent("family"):
        return Resolution(
            target="far",
            confidence="high",
            reason="consistently used in family context, never co-occurs with Far"
        )
    else:
        return Resolution(
            target=None,
            confidence="review",
            reason="mixed contexts — needs manual review"
        )
```

### Phase 3: Registry Integration

```python
def integrate_epithets(registry, resolutions, letter_entities):
    """Add resolved epithets as aliases and update letter counts."""
    for epithet, resolution in resolutions.items():
        if resolution.confidence in ("high", "medium"):
            # Find the registry entry for the target person
            entry = find_entry(registry, resolution.target)
            entry["aliases"].append(epithet)

            # Update letter-entities-draft.json to include epithet mentions
            for match in resolution.matches:
                letter_entities[match["letter_id"]]["persons"].append(
                    resolution.target_canonical
                )

            # Recompute letter_count, first_mention, last_mention
            recompute_stats(entry, letter_entities)
```

---

## Architecture (SPARC-A)

### Detection Is Complementary to NER

The NER pipeline (DaCy) handles proper names. Epithet resolution handles everything else. They run in sequence:

```
data/normalized-letters.json
    │
    ├──→ scripts/extract-entities-dacy.py     (proper names: "Konow", "Maren Fog")
    │         │
    │         ▼
    │    data/letter-entities.json
    │
    └──→ scripts/resolve-epithets.py          (epithets: "den gamle", "Svigerfar")
              │
              ▼
         data/epithet-resolutions.json
              │
              ▼
         scripts/build-person-registry.py     (merges both sources)
              │
              ▼
         data/person-registry.json            (complete)
```

### Epithet Resolution Output Format

```json
{
  "epithet": "den gamle",
  "pattern": "\\bden gamle\\b",
  "total_mentions": 83,
  "resolved_to": "far",
  "confidence": "high",
  "evidence": [
    {
      "letter_id": 25,
      "date": "1913-01-26",
      "context": "Ja den gamle er kommen hertil. Og jeg tror nok han er glad ved turen",
      "signal": "elderly male visitor in family context, familiar tone"
    },
    {
      "letter_id": 48,
      "date": "1914-03-10",
      "context": "...",
      "signal": "..."
    }
  ],
  "counter_evidence": [],
  "co_occurs_with_target": false
}
```

### Impact on Person Registry

If "den gamle" → Far is confirmed:

| Person | Before | After | Change |
|--------|--------|-------|--------|
| Far | 6 letters | ~89 letters | +83, becomes 4th most mentioned |
| Network rank | Below top 20 | #4 by letter count | Major centrality shift |

This would place Far between Uffe (82) and Signe (38) in the network — a fundamental change to the family structure picture. As `docs/social-network-analysis.md` notes, the current analysis shows Far as a peripheral figure. If "den gamle" is Far, he is actually one of the most central people in Peter's world.

---

## Refinement (SPARC-R)

### Key Adjustment: "den gamle" May Have Multiple Referents

In 83 letters across 7 years, "den gamle" might not always refer to the same person. The resolution must check for:

1. **Temporal shifts**: Does the referent change after a certain date? (e.g., if Far dies, "den gamle" might shift to someone else)
2. **Context clustering**: Do military uses of "den gamle" refer to a different person than home-front uses?
3. **Grammatical gender**: Danish "den gamle" is common gender — it could refer to a woman. Check if it ever appears with feminine pronouns (hun/hende).

If multiple referents are found, the epithet should be split by context or time period, similar to ADR-042's approach to bare first names.

### Key Adjustment: Not All Epithets Are Worth Resolving

Some epithets are too generic ("den lille" might refer to a child, an animal, or a small object). The inventory should be filtered by:
- Frequency: ≥ 3 mentions to be worth investigating
- Person-reference likelihood: must appear in a syntactic position where a person name could appear
- Consistency: should refer to the same person in ≥ 80% of occurrences

### Key Adjustment: Relationship to ADR-042

ADR-042 splits conflated first-name entries. This ADR adds epithet aliases. The two should run in sequence: first split (ADR-042), then add epithets (ADR-043), then regenerate the network once.

---

## Completion (SPARC-C)

### Phase 1: Epithet Inventory

**Deliverable**: `scripts/scan-epithets.py` and `data/epithet-inventory.json`

1. Define search patterns for known Danish kinship terms, descriptive epithets, and rank-as-name constructions
2. Scan all 665 letters (using `corrected-letters.json` or `normalized-letters.json`)
3. Output every match with letter ID, date, and 80-character context window
4. Sort by frequency — focus resolution effort on high-frequency epithets first

### Phase 2: "den gamle" Deep Analysis

**Deliverable**: Resolution entry in `data/epithet-resolutions.json`

1. Extract all 83+ "den gamle" mentions with context
2. Check co-occurrence with "Far"/"Faer" in the same letters
3. Cluster by topic context (family/military/community)
4. Check for temporal shifts in referent
5. Determine resolution: Far alias, separate person, or split by period
6. Document evidence passages

### Phase 3: Remaining Epithets

**Deliverable**: Complete `data/epithet-resolutions.json`

1. For each epithet with ≥ 3 mentions, apply the contextual resolution method
2. Resolve or mark as ambiguous
3. Document evidence for each resolution

### Phase 4: Registry Integration

**Deliverable**: Updated `person-registry.json` and `social-network.json`

1. Add resolved epithet aliases to registry entries
2. Update `letter-entities-draft.json` to include epithet mentions
3. Recompute letter counts
4. Regenerate social network (combine with ADR-042 regeneration if both are implemented)

---

## Alternatives Considered

### Alternative 1: Treat epithets as stop-words and ignore them

**Rejected** because "den gamle" alone has more mentions than all but 3 named persons. Ignoring it means the social network is missing one of Peter's most frequently referenced relationships.

### Alternative 2: Manual reading of all 83 "den gamle" letters

**Partially adopted**: automated scanning identifies and extracts the mentions, but final resolution (especially checking for referent shifts) benefits from reading a sample of the context windows. The script reduces the workload from reading 83 full letters to reviewing 83 context snippets.

### Alternative 3: Coreference resolution with a language model

Use a coreference resolution model to link "den gamle" to a named entity in the same or nearby letters.

**Deferred**: Danish coreference resolution models are not mature enough for archaic text. The pattern-based approach with contextual analysis is more reliable for this corpus size. If a high-quality Danish coreference model becomes available, it could be applied as a validation layer.

---

## Consequences

### Positive

- The social network gains a major missing signal — "den gamle" with 83+ mentions
- Far's true importance in Peter's world becomes visible
- Establishes a systematic method for capturing non-NER person references
- The epithet inventory itself is a useful linguistic resource for the corpus

### Negative

- Epithet resolution is inherently less certain than named entity resolution — confidence levels vary
- Some epithets will remain ambiguous and uncounted
- Adds another processing step to the data pipeline

### Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| "den gamle" refers to multiple people across 7 years | Medium | Temporal and contextual clustering; split if evidence warrants |
| Epithet resolution incorrectly links to wrong person | Medium | Evidence-based resolution with documented counter-evidence checks; manual review of high-impact resolutions |
| Pipeline complexity grows | Low | Epithet resolution is an optional enrichment step, not a blocking dependency |

---

## Related

- **ADR-016**: Social Network Extraction — the parent ADR; epithet resolution enriches Phase B2 (person registry)
- **ADR-042**: Person Disambiguation — must run first to establish clean split entries before epithets are added
- **ADR-014**: Archaic Danish Modernization — epithets should be searched in both original and normalized text
- `docs/social-network-analysis.md` — the "Findings" section will need updating if Far moves from 6 to ~89 mentions
