# ADR-042: Person Registry Disambiguation — Splitting Conflated First-Name Aliases

## Status

Accepted (2026-04-04)

## Date

2026-04-04

## Context

ADR-016 built a person registry (`data/person-registry.json`) containing 61 disambiguated persons extracted from the 665 WW1 letters. The registry was constructed bottom-up from DaCy NER output, with domain knowledge encoded in a `KNOWN_PERSONS` dictionary in `scripts/build-person-registry.py`.

The current registry has a structural flaw: **it conflates distinct individuals who share a first name** by merging all surname variants into a single entry. Two confirmed cases:

### Case 1: Niels (lines 98–101 of build-person-registry.py)

The registry entry `"niels"` merges aliases for at least two different people:
- **Niels Kjær** (aliases: "Niels Kjær", "N. Kjær", "Kjærs") — a community member
- **Niels Skau** (aliases: "Niels Skau", "N. Skau") — a different community member

The bare name "Niels" appears in letters spanning 1911–1918 and could refer to either person depending on context.

### Case 2: Maren (lines 92–96 of build-person-registry.py)

The registry entry `"maren"` (28 letters) merges at least three distinct women:
- **Maren Fog** — a friend of Trine, active 1911 (also has a *separate* registry entry `"maren_fog"` with 4 letters — a direct duplication)
- **Maren Hansen** — a different person; letter 92 (1914-09-05) is *sent by* "Niels og Maren Hansen"
- **Maren Bøjlesen** — explicitly named as a separate person in the same letter 92: "Maren Bøjlesen går så god og så tro i sit arbejde"

Letter 92 proves co-occurrence of Maren Hansen and Maren Bøjlesen in the same text, definitively establishing them as different people.

### Impact on network analysis

As noted in `docs/social-network-analysis.md`, the social network currently has 61 nodes and 201 edges. Conflated entries inflate edge weights (all three Marens' co-mentions accumulate on one node) and deflate degree centrality (connections that should distribute across nodes are collapsed). The disappearance analysis is also affected — if one Maren vanishes while another continues, the conflated entry masks the disappearance signal.

---

## Specification (SPARC-S)

### Requirements

1. **Split conflated entries**: Each distinct person must have their own registry entry with correct aliases.
2. **Evidence-based splitting**: Splits must be justified by co-occurrence, temporal, or contextual evidence from the letters.
3. **Bare first-name handling**: When only "Niels" or "Maren" appears, assign to the most likely identity or mark as ambiguous.
4. **No false splits**: Do not split entries where a single identity is plausible (e.g., "Jens" with no surname variants).
5. **Registry consistency**: No alias should appear in more than one registry entry. The current Maren Fog duplication must be eliminated.
6. **Downstream regeneration**: After fixing the registry, `social-network.json` must be regenerated.

### Acceptance Criteria

- Niels Kjær and Niels Skau are separate registry entries
- Maren Fog, Maren Hansen, and Maren Bøjlesen are separate registry entries
- The duplicate `maren_fog` entry is removed (its data absorbed into the split)
- Bare "Niels" and bare "Maren" mentions are either assigned to the correct person with stated evidence, or flagged as ambiguous
- `social-network.json` regenerated from corrected registry
- No alias appears in more than one registry entry (validated by script)

---

## Pseudocode (SPARC-P)

### Phase 1: Co-occurrence Evidence Gathering

```python
def find_co_occurrences(letter_entities, alias_groups):
    """
    For each set of aliases currently merged under one canonical,
    find letters where two or more aliases with different surnames
    appear together — proving they're different people.
    """
    evidence = {}

    for canonical, aliases in alias_groups.items():
        # Group aliases by surname
        surname_groups = cluster_by_surname(aliases)
        if len(surname_groups) <= 1:
            continue  # only one surname — no conflict

        # For each letter, check if aliases from different surname groups co-occur
        for letter_id, entities in letter_entities.items():
            mentioned_groups = set()
            for entity in entities["persons"]:
                for group_name, group_aliases in surname_groups.items():
                    if entity in group_aliases:
                        mentioned_groups.add(group_name)

            if len(mentioned_groups) > 1:
                evidence[canonical] = {
                    "letter_id": letter_id,
                    "groups": mentioned_groups,
                    "proof": "co-occurrence"
                }

    return evidence
```

### Phase 2: Temporal Disambiguation for Bare Names

```python
def assign_bare_names(letter_entities, letters_csv, split_persons):
    """
    For bare first names ('Niels', 'Maren') without surname context,
    assign to the most likely identity based on:
    1. Temporal proximity to other mentions of the same person
    2. Co-occurring persons in the same letter (social context)
    3. Geographic context (place of the letter)
    """
    assignments = []

    for letter_id, entities in letter_entities.items():
        for person in entities["persons"]:
            if person in BARE_NAMES:  # e.g., "Niels", "Maren"
                candidates = split_persons[person]
                scores = {}

                for candidate in candidates:
                    # Temporal: how close is this letter to other mentions
                    # of this candidate?
                    temporal_score = temporal_proximity(
                        letter_id, candidate, letters_csv
                    )
                    # Social: do other people in this letter co-occur
                    # frequently with this candidate elsewhere?
                    social_score = social_context_match(
                        letter_id, candidate, letter_entities
                    )
                    scores[candidate] = temporal_score + social_score

                best = max(scores, key=scores.get)
                confidence = scores[best] / sum(scores.values())

                assignments.append({
                    "letter_id": letter_id,
                    "bare_name": person,
                    "assigned_to": best,
                    "confidence": confidence,
                    "method": "temporal+social"
                })

    return assignments
```

### Phase 3: Registry Update

```python
def split_registry_entry(registry, canonical, new_entries):
    """
    Remove the conflated entry and add distinct new entries.
    Update KNOWN_PERSONS and SKIP_ENTITIES in build-person-registry.py.
    """
    # Remove old entry
    registry = [e for e in registry if e["canonical"] != canonical]

    # Add new entries with correct aliases and letter counts
    for new_entry in new_entries:
        # Recompute letter_count, first_mention, last_mention
        # from letter-entities-draft.json using only this entry's aliases
        stats = compute_letter_stats_for_aliases(new_entry["aliases"])
        new_entry.update(stats)
        registry.append(new_entry)

    return registry
```

---

## Architecture (SPARC-A)

### Disambiguation Strategy Hierarchy

```
                    ┌──────────────────────────┐
                    │  Co-occurrence Proof      │
                    │  (same letter = different │
                    │   person, 100% certain)   │
                    └────────────┬─────────────┘
                                 │ splits confirmed entries
                                 ▼
                    ┌──────────────────────────┐
                    │  Temporal Clustering      │
                    │  (mention timeline per    │
                    │   alias variant)          │
                    └────────────┬─────────────┘
                                 │ assigns ambiguous periods
                                 ▼
                    ┌──────────────────────────┐
                    │  Social Context Match     │
                    │  (who else is mentioned   │
                    │   in the same letter?)    │
                    └────────────┬─────────────┘
                                 │ resolves remaining bare names
                                 ▼
                    ┌──────────────────────────┐
                    │  Ambiguous Marker         │
                    │  (bare name with no       │
                    │   resolvable context)     │
                    └──────────────────────────┘
```

### Data Flow

```
data/letter-entities-draft.json  ──┐
data/entity-audit.json             ├──→ scripts/disambiguate-persons.py
data/letters.csv                  ─┘         │
                                             ▼
                                   data/disambiguation-evidence.json
                                             │
                                             ▼
                              scripts/build-person-registry.py (updated KNOWN_PERSONS)
                                             │
                                             ▼
                              data/person-registry.json (corrected)
                                             │
                                             ▼
                              scripts/build-social-network.py (regenerate)
                                             │
                                             ▼
                              data/social-network.json (corrected)
```

### Changes to build-person-registry.py

The `KNOWN_PERSONS` dictionary (line 29) must be updated:

```python
# BEFORE (conflated):
"Maren": {
    "role": "community member",
    "category": "community",
    "extra_aliases": ["Maren", "Maren Fog", "Maren Hansen", "Maren Bøjlesen"],
},
"Maren Fog": {
    "role": "community member, friend of Trine",
    "category": "community",
    "extra_aliases": ["Maren Fog"],
},

# AFTER (split):
"Maren Fog": {
    "role": "community member, friend of Trine",
    "category": "community",
    "extra_aliases": ["Maren Fog"],
},
"Maren Hansen": {
    "role": "community member",
    "category": "community",
    "extra_aliases": ["Maren Hansen"],
},
"Maren Bøjlesen": {
    "role": "community member",
    "category": "community",
    "extra_aliases": ["Maren Bøjlesen"],
},
# Bare "Maren" handled by disambiguation logic, not hardcoded alias
```

Similarly for Niels → Niels Kjær + Niels Skau.

---

## Refinement (SPARC-R)

### Key Adjustment: Bare "Maren" May Be Unresolvable

In many letters, Peter writes only "Maren" with no surname. When the surrounding context provides no social or temporal signal, these mentions should be tagged `"ambiguous": true` rather than force-assigned. The registry should support this:

```json
{
  "letter_id": 45,
  "person_text": "Maren",
  "resolved_to": null,
  "candidates": ["maren_fog", "maren_hansen", "maren_bojlesen"],
  "confidence": 0.0,
  "reason": "no contextual signal"
}
```

Ambiguous mentions count toward none of the split entries. This is more honest than guessing and preserves the option for future manual review.

### Key Adjustment: "Maren Mærsk" Is Not Part of This Split

The alias "Maren Mærsk" currently belongs to `"mor"` (Peter's mother). This is correct — she is a fourth Maren but already properly separated. The disambiguation must not accidentally absorb her.

### Key Adjustment: SKIP_ENTITIES Must Be Updated

Lines 238–242 of `build-person-registry.py` add "Maren Fog", "Maren Hansen", "Maren Bøjlesen", "Niels Kjær", "N. Kjær", etc. to `SKIP_ENTITIES` because they're treated as aliases of the conflated entries. After splitting, each becomes the canonical or alias of its own entry and must be *removed* from `SKIP_ENTITIES`.

---

## Completion (SPARC-C)

### Phase 1: Evidence Gathering (new script)

**Deliverable**: `scripts/disambiguate-persons.py` and `data/disambiguation-evidence.json`

1. Parse `letter-entities-draft.json` for co-occurrence of aliases currently merged
2. Build temporal profiles per alias (which dates does "N. Kjær" vs "N. Skau" appear?)
3. Build social context profiles (who else appears in letters mentioning each alias?)
4. Output evidence file documenting each split decision with supporting data

### Phase 2: Registry Fix

**Deliverable**: Updated `scripts/build-person-registry.py` and `data/person-registry.json`

1. Update `KNOWN_PERSONS`: split Maren → Maren Fog + Maren Hansen + Maren Bøjlesen
2. Update `KNOWN_PERSONS`: split Niels → Niels Kjær + Niels Skau
3. Remove duplicate `"Maren Fog"` entry
4. Update `SKIP_ENTITIES`: remove items that are now canonical/alias of split entries
5. Add bare-name disambiguation logic (or ambiguity tagging)
6. Regenerate `person-registry.json`

### Phase 3: Network Regeneration

**Deliverable**: Updated `data/social-network.json`

1. Run `scripts/build-social-network.py` on corrected registry
2. Run `scripts/analyze-disappearances.py`
3. Verify: node count increased (61 → ~64), edge weights redistributed
4. Spot-check: Maren Fog's social cluster should be distinct from Maren Hansen's

### Phase 4: Validation

**Deliverable**: Validation checks added to pipeline

1. Alias uniqueness check: no alias appears in more than one registry entry
2. Coverage check: all PER entities from entity-audit map to exactly one registry entry (or are in SKIP_ENTITIES)
3. Letter count sanity: sum of split entry letter_counts ≤ original conflated count

---

## Alternatives Considered

### Alternative 1: Leave conflated and add a disclaimer

Add a note to `social-network-analysis.md` acknowledging the conflation.

**Rejected** because the conflation actively distorts network metrics. "Niels" with 26 letters and 6 aliases has inflated centrality. The network analysis claims to show "who populated Peter's world" — it should show the right people.

### Alternative 2: Manual assignment of every bare name mention

Have a domain expert read every letter containing "Maren" or "Niels" and manually assign.

**Partially adopted**: manual review is appropriate for ambiguous cases after automated methods are exhausted. But the automated co-occurrence/temporal/social analysis should handle the clear cases first, reducing manual work to a manageable number.

### Alternative 3: Probabilistic entity linking with embeddings

Use sentence embeddings around each name mention to cluster identities.

**Deferred**: overkill for ~5 conflated entries with clear surname evidence. Could revisit for the 28 "unknown" persons in the registry if manual classification isn't feasible.

---

## Consequences

### Positive

- Social network analysis becomes more accurate — real people, not merged phantoms
- Disappearance analysis can correctly flag when a specific person vanishes
- The Maren Fog duplication bug is eliminated
- Establishes a pattern for handling future disambiguation issues in the registry
- Bare-name ambiguity is made explicit rather than silently hidden

### Negative

- Some bare "Maren" / "Niels" mentions may remain ambiguous — the letter count for individual entries may be lower-bounded rather than exact
- The disambiguation script adds a step to the data pipeline
- Social network metrics will change — any published findings based on the old graph need qualification

### Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| Over-splitting: "Niels Kjær" and "Niels Skau" might actually be one person with two surnames | Low | Co-occurrence evidence or temporal overlap would confirm; if not found, conservative approach keeps them separate only when surname evidence is clear |
| Bare-name assignment errors | Medium | Ambiguity tagging for low-confidence cases; manual review of assignments |
| Pipeline regression | Low | Alias uniqueness check catches duplicate assignments; letter count sanity check catches data loss |

---

## Related

- **ADR-016**: Social Network Extraction — the parent ADR; this fixes a known limitation in Phase B2
- **ADR-040**: Corpus Quality Audit — similar pattern of systematic evidence-based correction
- **ADR-044**: External Record Cross-Referencing — may provide independent confirmation of splits
- `docs/social-network-analysis.md` — documents the current (conflated) registry and acknowledges the 28 unknowns as candidates for classification
