# Architecture Decision Records

This directory contains Architecture Decision Records (ADRs) for the jernkorsetbreve project. ADRs document significant architectural decisions, their context, alternatives considered, and consequences.

## Format

Each ADR follows a standard template:
- **Status**: Proposed | Accepted | Superseded | Deprecated
- **Context**: Why this decision is needed
- **Decision**: What was decided
- **Alternatives Considered**: What else was evaluated
- **Consequences**: Positive and negative impacts

## Index

| # | Title | Status |
|---|-------|--------|
| [001](ADR-001-api-error-handling.md) | API Error Handling Implementation | Accepted |
| [001](ADR-001-frontend-redesign.md) | Frontend Redesign — Archival Editorial Design System | Proposed |
| [002](ADR-002-ddd-architecture.md) | Domain-Driven Design Architecture | Proposed |
| [003](ADR-003-testing-strategy.md) | Testing Strategy | Proposed |
| [004](ADR-004-performance-targets.md) | Performance Targets | Proposed |
| [005](ADR-005-historical-map-borders.md) | Historical Map Borders — Data Source and Processing | Accepted |
| [006](ADR-006-historical-borders-frontend.md) | Historical Borders — Frontend Rendering | Accepted |
| [007](ADR-007-historical-map-images.md) | Historical Map Images — Deferred | Accepted |
| [008](ADR-008-historical-borders-build-pipeline.md) | Historical Borders — Build Pipeline | Accepted |
| [009](ADR-009-search-ux-simplification.md) | Search UX Simplification | Accepted (2026-03-25) |
| [010](ADR-010-search-model-preloading.md) | Search Model Preloading Strategy | Accepted (2026-03-25) |
| [011](ADR-011-search-model-hosting-cdn.md) | Search Model Hosting and CDN Strategy | Accepted (Phase 1+2, Phase 3 deferred) |
| [012](ADR-012-multilingual-embedding-model.md) | Switch to Multilingual Embedding Model | Accepted (Phase 1, 2026-03-26) |
| [013](ADR-013-search-evaluation-framework.md) | Search Quality Evaluation Framework | Accepted (2026-03-27) |
| [014](ADR-014-archaic-danish-modernization.md) | Archaic Danish Text Modernization | Accepted (Phase 1, Phase 2 in progress) |
| [015](ADR-015-psycholinguistic-analysis.md) | Psycholinguistic Analysis Pipeline | Accepted (2026-04-04) |
| [016](ADR-016-social-network-extraction.md) | Social Network Extraction and Visualization | Accepted (2026-04-04) |
| [017](ADR-017-semantic-trajectory-analysis.md) | Semantic Trajectory and Temporal Analysis | Proposed |
| [018](ADR-018-visualization-suite.md) | Visualization Suite for Analytical Data | Proposed |
| [019](ADR-019-domain-specific-extraction.md) | Domain-Specific Information Extraction | Proposed |
| [020](ADR-020-cognitive-atlas.md) | The Cognitive Atlas — Multidimensional State Projection | Proposed |
| [021](ADR-021-sonification.md) | Data Sonification — The Sound of 665 Letters | Proposed |
| [022](ADR-022-conversational-search-rag.md) | Conversational Search Interface (RAG) | Proposed |
| [023](ADR-023-parallel-lives-visualization.md) | Parallel Lives — Multi-Stream Narrative Visualization | Proposed |
| [024](ADR-024-build-version-footer-meta.md) | Build Version in Footer and HTML Meta Tags | Accepted |
| [025](ADR-025-sentiment-on-normalized-text.md) | Sentiment Analysis on Normalized Text | Accepted (2026-03-28) |
| [026](ADR-026-extract-notebooks-to-scripts.md) | Extract Data-Producing Notebooks to Scripts | Proposed (partial) |
| [027](ADR-027-python-dependency-management.md) | Python Dependency Management for Pipeline | Proposed (partial) |
| [028](ADR-028-makefile-data-pipeline.md) | Makefile-Based Data Pipeline Orchestration | Proposed (partial) |
| [029](ADR-029-sentiment-artifact-hashing.md) | Artifact Hashing for Sentiment Skip Logic | Accepted (2026-03-28) |
| [030](ADR-030-cvp-sentiment-implementation.md) | Concept Vector Projection (CVP) for Sentiment | Accepted (2026-03-28) |
| [031](ADR-031-place-data-quality.md) | Place Data Quality — Fix Matching, Coordinates, Encoding | Accepted (2026-03-28) |
| [032](ADR-032-wikidata-place-enrichment.md) | Wikidata Enrichment for Places | Accepted (2026-03-28) |
| [033](ADR-033-3d-embedding-coordinates.md) | 3D Embedding Coordinates in Data Pipeline | Accepted (2026-03-28) |
| [034](ADR-034-threejs-3d-explorer.md) | Three.js 3D Letter Explorer | Accepted (2026-03-28) |
| [035](ADR-035-mobile-responsiveness.md) | Mobile Responsiveness Improvements | Accepted (2026-03-28) |
| [036](ADR-036-sentiment-explorer-section.md) | Sentiment Explorer Website Section | Accepted (2026-03-29) |
| [037](ADR-037-psycholinguistic-explorer-section.md) | Psycholinguistic Explorer Website Section | Accepted (2026-03-29) |
| [038](ADR-038-national-identity-concept-vector.md) | National Identity Concept Vector | Accepted (2026-04-04) |
| [039](ADR-039-multi-layer-text-architecture.md) | Multi-Layer Text Architecture for Editorial Corrections | Accepted (2026-04-02) |
| [040](ADR-040-corpus-quality-audit-strategy.md) | Corpus Text Quality Audit and Correction Strategy | Accepted (2026-04-02) |
| [041](ADR-041-moderne-sprog-toggle.md) | Moderne Sprog Toggle — User-Facing Text Modernization | Accepted (2026-04-03) |
| [042](ADR-042-person-disambiguation.md) | Person Registry Disambiguation | Accepted (2026-04-04) |
| [043](ADR-043-epithet-reference-resolution.md) | Epithet and Pronoun-like Reference Resolution | Accepted (2026-04-04) |
| [044](ADR-044-external-record-crossreferencing.md) | External Record Cross-Referencing (OSINT Strategy) | Accepted (2026-04-04) |
| [045](ADR-045-image-registry-schema.md) | Image Registry Schema Design | Accepted (2026-04-05) |
| [046](ADR-046-letter-image-association.md) | Letter-Image Association Strategy | Accepted (2026-04-05) |
| [047](ADR-047-image-serving-strategy.md) | Image Serving Strategy | Accepted (2026-04-05) |
| [048](ADR-048-person-page-photo-gallery.md) | Person Page with Photo Gallery | Accepted (2026-04-05) |
| [049](ADR-049-place-page-photos-letters.md) | Place Page with Photos and Letters | Accepted (2026-04-05) |
| [050](ADR-050-image-curation-workflow.md) | Image Curation Workflow | Proposed (partial) |

## Status Summary

| Status | Count |
|--------|-------|
| Accepted | 38 |
| Proposed | 9 |
| Proposed (partial) | 3 |

## Thematic Groups

### Search & Embeddings (009-014)
Full semantic search pipeline from UX through model selection, evaluation, and text modernization. All implemented.

### Historical Maps (005-008)
Historical border visualization on the map view. All implemented.

### Sentiment Analysis (025, 029, 030)
Migration from broken AFINN/Sentida lexicon tools to CVP (Concept Vector Projection) from Aarhus University. Multi-score output with narrative arc support. All implemented.

### Pipeline Modernization (026-028)
Extract notebooks to scripts, formalize Python dependencies, add Makefile orchestration. Partially implemented via the sentiment work; full scope pending.

### Location Data Quality (031-032)
Fixed place name mismatches (recovered 84 lost letters), coordinate errors (Bialla, Grodno), and encoding issues. Enriched 69/73 places with Wikidata Q-numbers and 14 with Wikipedia URLs using coordinate-based SPARQL queries. All implemented.

### 3D Explorer (033-034)
Extend the 2D embedding explorer with optional 3D visualization. ADR-033 adds 3D UMAP coordinates to the data pipeline; ADR-034 integrates Three.js via React Three Fiber with code-splitting and SSR-safe dynamic import.

### Mobile Responsiveness (035)
Full mobile-first pass: fix SVG overflow, map layout, touch targets (44px WCAG minimum), SearchBox dropdown, explorer controls density, canvas touch-action, and search page design token migration. Three-tiered implementation.

### Text Quality (039-040)
Multi-layer text architecture (source → corrected → normalized) with editorial correction provenance tracking, abbreviation annotations, and automated quality validation. Systematic audit of 665 letters found and corrected 30 issues: typing errors, OCR artifacts, encoding artifacts, and garbled text. All implemented.

### Image Dataset & Entity Pages (045-050)
Integrate 165 extracted photos from Else Gad Mærsk's presentation into the project data model. ADR-045 defines the canonical image registry schema. ADR-046 defines how images associate with letters through place/person/date matching. ADR-047 decides the image serving strategy (static files + API fallback). ADR-048/049 design person and place detail pages with photo galleries. ADR-050 defines the curation workflow for improving image descriptions and associations. Letter-image display is implemented; person/place pages are proposed.

### Future Analysis (015-023)
Proposed NLP and visualization enhancements: psycholinguistic analysis, social networks, semantic trajectories, sonification, RAG search, and more.
