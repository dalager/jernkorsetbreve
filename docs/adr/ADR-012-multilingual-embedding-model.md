# ADR-012: Switch to Multilingual Embedding Model

## Status
Accepted (Phase 1 implemented 2026-03-26)

## Context

The current semantic search uses `Xenova/gte-small`, a 33M parameter English-only embedding model producing 384-dimensional vectors. This model has no meaningful Danish language training. It partially works because:

1. Many Danish words share Germanic roots with English
2. Structural patterns provide weak cross-lingual signal
3. With only 665 documents, even weak similarity produces some ordering

But it fundamentally cannot understand Danish semantics — especially archaic 1900s Danish with pre-reform spelling ("aa" for "å"), German military loanwords (Feldvebel, Hauptmand), and South Jutlandic dialect features.

The WASM runtime binary (`ort-wasm-simd-threaded.jsep.wasm`) is ~4 MB. The quantized model itself is ~33 MB. Both query and document embeddings must use the same model since cosine similarity requires a shared vector space.

### Candidate Models

| Model | Params | Dims | Danish Support | ONNX Size (q8) | Transformers.js |
|-------|--------|------|----------------|----------------|-----------------|
| **Xenova/gte-small** (current) | 33M | 384 | None | ~33 MB | Yes |
| **Xenova/multilingual-e5-small** | 118M | 384 | Trained on 100+ languages | ~60 MB | Yes |
| **onnx-community/embeddinggemma-300m** | 308M | 768 (MRL→128-256) | 100+ languages | ~200 MB (q4) | Yes |

### Architecture Constraint

The existing architecture pre-computes document embeddings at build time and only embeds queries at runtime. Both operations must use the identical model. The browser download size therefore equals the full model weight.

## Decision

### Phase 1: Switch to `multilingual-e5-small`

Replace `Xenova/gte-small` with `Xenova/multilingual-e5-small`:

- Same 384 dimensions — embedding binary stays at ~998 KB
- Genuine multilingual training including Danish
- ONNX model ~60 MB (q8) — roughly 2x the current download
- Near drop-in replacement

**Code changes required:**

1. `scripts/generate-embeddings.mjs`: Change `MODEL_NAME`, add `"passage: "` prefix to document texts
2. `apps/website/src/lib/search-engine.ts`: Change `MODEL_NAME`, add `"query: "` prefix to user queries
3. Regenerate all embeddings: `node scripts/generate-embeddings.mjs --force`

The `multilingual-e5` family requires text prefixes:
- Document text: `"passage: {text}"`
- Query text: `"query: {text}"`

### Phase 2: Evaluate EmbeddingGemma-300M

After Phase 1 is measured via the evaluation framework (ADR-013), evaluate EmbeddingGemma-300M:

- Best-in-class for sub-500M parameters (Google, September 2025)
- Matryoshka Representation Learning allows truncating 768 dims → 256 or 128
- At 256 dims: embedding binary = 665 × 256 × 4 = ~665 KB (smaller than current)
- q4 quantized model ~200 MB — significant browser download
- Only pursue if quality improvement over multilingual-e5-small justifies the 3x download increase

### Not Recommended: Asymmetric Hybrid

Using different models for documents (large, build-time) vs. queries (small, browser) was considered. Rejected because cosine similarity requires both embeddings to share the same vector space. Model families trained for cross-encoder compatibility are rare and fragile.

## Consequences

### Positive
- Genuine Danish language understanding in search
- Same embedding dimensions — no changes to binary format or downstream consumers (UMAP, clusters, related letters)
- Established ONNX weights on Hugging Face — no conversion needed
- Measurable improvement expected on Danish queries

### Negative
- Model download increases from ~33 MB to ~60 MB (first visit only, cached thereafter)
- The `"query: "` / `"passage: "` prefixes must be applied consistently or similarity breaks
- Requires regenerating all pre-computed data products (embeddings, UMAP, clusters, related letters, snippets)

### Risks
- Even multilingual models may struggle with archaic 1900s Danish — this is why ADR-014 (text modernization) exists as a complementary strategy
- The 60 MB download may affect mobile users on slow connections — monitor via ADR-011's R2 hosting strategy if needed

## Validation
- Run evaluation framework (ADR-013) against both models on the same golden dataset
- Verify `multilingual-e5-small` achieves >10% nDCG@10 improvement over `gte-small` baseline
- Verify all data products regenerate correctly (embeddings.bin, umap-2d.json, topic-clusters.json, related-letters.json)
- E2E search tests pass
- Measure browser model load time; compare against ADR-004 performance targets
