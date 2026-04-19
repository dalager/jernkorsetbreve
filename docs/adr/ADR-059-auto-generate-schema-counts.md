# ADR-059: Remove Hardcoded Entity Counts from API Schema

## Status

Implemented (2026-04-19)

## Date

2026-04-19

## Context

The published `api-schema.json` hardcodes entity counts in several descriptions. These counts have already drifted from reality:

| Description says | Actual count | Drift |
|---|---|---|
| "60 persons" (person-pages) | 79 entries in `person-registry.json` | +19 persons |
| "65 persons as network nodes" (social-network) | Stale | Unknown |
| "209 relationships" (social-network) | Stale | Unknown |
| "164 images" (image-registry) | Stale | Unknown |
| "75 places" (place-pages) | Stale | Unknown |
| "28 JSON endpoints" (robots.txt) | 29 paths in schema (+ `api-schema.json` itself + `embeddings.bin`) | At least +1 |

These counts were accurate when first written but became stale as the data pipeline evolved — persons were added through enrichment (ADR-057), places were enriched via Wikidata (ADR-032), and new endpoints were added. Every pipeline run or manual enrichment risks widening the gap.

Hardcoded counts in a schema are a maintenance trap: they look authoritative but silently become wrong, and no automated check catches the drift.

## Decision

Remove all hardcoded entity counts from `api-schema.json` descriptions. For `robots.txt`, either remove the endpoint count or replace it with a reference to the schema.

### What to change

1. **Schema descriptions**: Remove specific numbers from descriptions. Replace "Contains 60 persons" with "Contains all identified persons" or similar count-free phrasing.

2. **robots.txt**: Change "28 JSON endpoints" to either remove the count entirely or use phrasing like "See api-schema.json for the full list of endpoints".

### Future option: templated counts

If precise counts are valuable to consumers in the future, the schema can be templated during the build pipeline:

```
# In a build step:
1. Run pipeline, producing data files
2. Count entities in each output file
3. Inject counts into api-schema.json.template → api-schema.json
```

This is not implemented now because:
- The current descriptions work fine without counts
- Adding a template step increases build complexity
- Counts can be derived by consumers from the data itself (e.g., `person-registry.json` array length)

### Alternatives considered

1. **Remove all counts from descriptions** — Chosen for now. Simplest approach, eliminates the drift problem entirely.

2. **Template the schema and inject counts during build** — Deferred as a future option. Adds build complexity that is not currently justified.

3. **Keep manual counts and update them periodically** — Rejected. Already proven unreliable ("60 persons" vs 79 actual). Manual processes do not scale and produce silently wrong documentation.

## Consequences

### Positive

- Descriptions never go stale due to count drift
- No maintenance burden to update counts after pipeline changes or enrichment
- `robots.txt` accurately reflects the API surface

### Negative

- Consumers lose at-a-glance size information (mitigated: they can check array lengths in the actual data files)
- If templated counts are desired later, a build step must be added

### Neutral

- The data files themselves remain the source of truth for entity counts — this has always been the case, the schema just no longer pretends otherwise
