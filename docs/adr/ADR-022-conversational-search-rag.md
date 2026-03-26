# ADR-022: Conversational Search Interface (RAG)

## Status
Proposed

## Context

The current search returns a ranked list of letters by semantic similarity. Users must then read each letter to find the answer to their question. For a school class studying WWI, a researcher exploring a theme, or a casual visitor with a question like "What was the food like at the front?" — the current interface requires significant effort to extract an answer.

Retrieval-Augmented Generation (RAG) can bridge this gap: retrieve the most relevant letters (using the improved embeddings from ADR-012/014), then present the relevant passages with contextual framing drawn from the analytical metadata (ADRs 015–019).

### Key Constraint: No Hallucination

This is a historical archive. The system must **never** generate text that could be mistaken for Peter's words. Every piece of information presented must be directly traceable to a specific letter and passage.

## Decision

### Architecture: Retrieval + Contextual Presentation (Not Generative)

This is NOT a chatbot that pretends to be Peter. It is a smart search interface that:

1. Takes a natural-language question
2. Retrieves the most relevant letters (existing semantic search)
3. Extracts the specific relevant passages from those letters
4. Presents passages with rich context from the analytical metadata

**No LLM generation at query time.** All text shown to the user is either:
- Direct quotes from letters (with letter ID, date, location)
- Pre-computed metadata (sentiment, health mentions, audience, etc.)
- Static editorial framing generated at build time

### Query Flow

```
User: "How was the food at the front?"
                    ↓
1. Embed query with multilingual-e5-small
2. Retrieve top 10 letters by cosine similarity
3. From those 10, extract passages matching food/scarcity lexicon (ADR-019)
4. Present passages chronologically with context:

┌─────────────────────────────────────────────────────────┐
│ 📍 Daugavpils, Østfronten · 12. juli 1916 · Til Mor    │
│ Stemning: neutral · Tema: Forplejning                   │
│                                                         │
│ "...vi faar i den sidste Tid ingen Paalæg til Brødet,  │
│ den er tør, saa vi har kun Smør og Marmelade..."        │
│                                                         │
│ [Læs hele brevet →]                                     │
├─────────────────────────────────────────────────────────┤
│ 📍 Vestfronten · 3. marts 1917 · Til Trine              │
│ Stemning: negativ · Tema: Knaphed                       │
│                                                         │
│ "...Hestesukker det er det eneste Sukker vi kan faa..." │
│                                                         │
│ [Læs hele brevet →]                                     │
└─────────────────────────────────────────────────────────┘

Fundet i 7 breve fra 1916-1918.
Hyppigst nævnt: brød, smør, sukker, pålæg, pakke.
```

### Build-Time Preparation

At build time, for each letter, pre-compute:
- **Passage segmentation**: Split letters into ~2-3 sentence passages with character offsets
- **Per-passage topic tags**: Using domain extraction results (ADR-019) to tag passages
- **Passage-level embeddings** (optional, for sub-letter precision): Embed each passage separately to allow retrieval at passage granularity rather than full-letter granularity

### Suggested Queries

Offer pre-built example queries grouped by theme:

- **Dagliglivet**: "Hvad spiste soldaterne?", "Hvordan var vejret?", "Hvad bad Peter om hjemmefra?"
- **Følelser**: "Hvornår var Peter mest ked af det?", "Savnede Peter Trine?"
- **Krigen**: "Hvad skete der ved fronten?", "Var Peter bange?"
- **Familien**: "Hvordan havde familien det derhjemme?"

### Contextual Enrichment

Each result is annotated with metadata from upstream ADRs:

| Metadata | Source | Display |
|----------|--------|---------|
| Date, location, recipient | Letter metadata | Header |
| Sentiment score | `letter-sentiments.json` | Mood indicator |
| Topic cluster label | `topic-clusters.json` | Theme tag |
| Health mentions | `letter-health.json` | Health indicator (if relevant) |
| Scarcity level | `letter-economics.json` | Scarcity indicator (if relevant) |
| Distance from home | Geocoded locations | Context line |

### Future Option: LLM-Powered Summary (Guarded)

If an LLM summary layer is added later, it must:
- Be clearly labeled as AI-generated synthesis, not primary source
- Include citations to specific letter IDs for every claim
- Be generated at build time (not query time) to avoid API costs and latency
- Be toggleable — users can switch between "raw passages" and "AI summary"

This is explicitly deferred. The passage-based approach is sufficient and avoids all hallucination risk.

## Consequences

### Positive
- Makes the archive queryable by question rather than keyword
- Presents answers with rich historical context automatically
- Zero hallucination risk — all text is direct quotation
- No runtime API dependency — everything is static/client-side
- Educational: school classes can "interview" the archive
- Passage-level retrieval is more precise than full-letter retrieval

### Negative
- Passage segmentation adds complexity to the build pipeline
- Passage-level embeddings significantly increase the embedding binary size (if pursued)
- The system cannot answer questions that require synthesis across multiple letters (e.g., "How did Peter's attitude to the war change over time?") — it can only show relevant passages
- Without LLM generation, the interface may feel limited compared to modern chatbot experiences

### Mitigation
- Start with full-letter retrieval + lexicon-based passage highlighting (no passage-level embeddings)
- For synthesis questions, link to the relevant analytical visualizations (e.g., "See the sentiment trajectory →")
- Set clear user expectations: "This tool finds relevant passages from Peter's letters"

## Validation
- For 10 test questions, the top 3 results contain at least one genuinely relevant passage
- All displayed text is traceable to a specific letter ID and character offset
- No AI-generated text appears without explicit labeling
- Query latency remains under 500ms (client-side retrieval from existing embeddings)
