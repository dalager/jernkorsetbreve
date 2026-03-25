# ADR-011: Search Model Hosting and CDN Strategy

## Status
Accepted (Phase 1+2 implemented 2026-03-25, Phase 3 deferred)

## Context

GitHub Issue [#5](https://github.com/dalager/jernkorsetbreve/issues/5) requests that the ML model be loaded from a "CDN nearby" instead of Hugging Face, given the site is hosted on Cloudflare Pages.

### Current Loading Architecture

The search engine loads assets from three separate origins:

```
Browser
  |
  |-- cdn.jsdelivr.net -----> transformers.js v3 core (~2 MB ESM)
  |
  |-- huggingface.co -------> Xenova/gte-small model files:
  |                              config.json (601 B)
  |                              tokenizer.json (695 KB)
  |                              tokenizer_config.json (557 B)
  |                              model.onnx (127 MB unquantized)
  |                              or model_quantized.onnx (~33 MB)
  |
  |-- own domain ------------> embeddings.bin (998 KB)
       (Cloudflare Pages)      embedding-index.json (18 KB)
                               search-snippets.json (143 KB)
```

### Critical Finding: Model Size and Quantization

**The local model cache contains `model.onnx` at 127 MB (unquantized).** The current code does not explicitly specify quantization:

```typescript
// search-engine.ts, line 171
this.extractor = await pipeline("feature-extraction", MODEL_NAME, {
  progress_callback: ...
});
```

In transformers.js v3, the default behavior depends on the model repo structure. The `Xenova/gte-small` repo on Hugging Face contains both:
- `onnx/model.onnx` -- 127 MB (full precision float32)
- `onnx/model_quantized.onnx` -- ~33 MB (int8 quantized)

**The library should default to the quantized variant in browser**, but this is not guaranteed and not explicitly configured. Adding `dtype: "q8"` or `quantized: true` to the pipeline options would guarantee the smaller model is used.

**Recommendation:** Regardless of hosting decision, explicitly specify quantization to guarantee the 33 MB download instead of 127 MB. This is the single highest-impact change for load time -- a potential **4x reduction**.

### Cloudflare Pages Constraints

| Constraint | Value | Impact |
|-----------|-------|--------|
| Max file size (free tier) | 25 MB per file | Blocks self-hosting even the quantized model (~33 MB) |
| Max file size (paid tier) | 50 MB per file | Would fit quantized model but not unquantized |
| Max deployment size | 25,000 files | Not a concern |
| Bandwidth | Unlimited | Not a concern |
| Edge locations | 300+ cities | Excellent global distribution |

### Latency Analysis

Current model loading involves sequential DNS + TLS + download for each origin. For a user in Copenhagen:

| Origin | Typical Latency | Notes |
|--------|----------------|-------|
| cdn.jsdelivr.net | ~20-50ms RTT | Cloudflare-backed CDN, excellent global coverage |
| huggingface.co | ~50-150ms RTT | Servers primarily in US/EU, not edge-cached |
| Own domain (CF Pages) | ~5-20ms RTT | Served from nearest Cloudflare edge PoP |

Hugging Face is the slowest origin and serves the largest file. This is the bottleneck.

## Decision

### Phase 1: Explicit Quantization (Immediate, Zero Infrastructure)

Add `dtype: "q8"` to the pipeline call in `search-engine.ts`:

```typescript
this.extractor = await pipeline("feature-extraction", MODEL_NAME, {
  dtype: "q8",
  progress_callback: (progress) => { ... },
});
```

**Impact:** Guarantees 33 MB download instead of potential 127 MB. No infrastructure changes needed.

### Phase 2: Preconnect Hints (Immediate, Zero Infrastructure)

Covered in ADR-010. Add `<link rel="preconnect">` for both external origins.

### Phase 3: Evaluate Self-Hosting on Cloudflare R2

**Recommended future approach if Hugging Face latency proves problematic.**

Cloudflare R2 is Cloudflare's S3-compatible object storage with:
- No egress fees
- Served through Cloudflare's edge network (same 300+ PoPs as Pages)
- No per-file size limits
- Custom domain support via Cloudflare Workers or direct bucket binding

#### R2 Setup

```
Cloudflare R2 Bucket: "jernkorset-models"
  └── gte-small/
      ├── config.json
      ├── tokenizer.json
      ├── tokenizer_config.json
      └── onnx/
          └── model_quantized.onnx
```

Served via a Cloudflare Worker or custom domain, e.g. `models.jernkorsetbreve.dk/gte-small/`.

Code change in `search-engine.ts`:
```typescript
// Point transformers.js to our own model host
env.remoteHost = "https://models.jernkorsetbreve.dk";
env.allowRemoteModels = true;

this.extractor = await pipeline("feature-extraction", "gte-small", {
  dtype: "q8",
  progress_callback: ...
});
```

#### R2 Cost Estimate

| Resource | Free Tier | Estimated Usage | Monthly Cost |
|----------|-----------|-----------------|-------------|
| Storage | 10 GB | ~35 MB | $0 |
| Class A ops (writes) | 1M/month | ~1/month (deploy) | $0 |
| Class B ops (reads) | 10M/month | ~1000/month (model loads) | $0 |

**R2 would be free** for this use case.

### Not Recommended: Self-Hosting in `/public/models/`

Rejected because:
- Quantized model (~33 MB) exceeds Cloudflare Pages free tier 25 MB per-file limit
- Unquantized model (127 MB) exceeds even the paid tier 50 MB limit
- Increases deploy size and deploy time significantly
- Model updates require a full site redeploy
- The jsDelivr + Hugging Face combination already provides good caching

### Not Recommended: Alternative CDN Mirrors

Options like unpkg, cdnjs, or GitHub Releases were considered but:
- No advantage over jsDelivr for the transformers.js library (jsDelivr is already Cloudflare-backed)
- No mirror for Hugging Face model files exists on these CDNs
- Would require manual mirroring and version tracking

## Options Summary

| Option | Model Download Size | First-Load Latency | Infra Cost | Complexity | Recommendation |
|--------|-------------------|-------------------|-----------|-----------|----------------|
| **Status quo** (no quantization flag) | 33-127 MB | 5-15s | $0 | None | Risky -- size unpredictable |
| **Explicit quantization** (Phase 1) | ~33 MB | 3-8s | $0 | Trivial (1 line) | **Do immediately** |
| **+ Preconnect hints** (Phase 2) | ~33 MB | 2.5-7s | $0 | Trivial (4 lines) | **Do immediately** |
| **+ Cloudflare R2** (Phase 3) | ~33 MB | 1.5-4s | $0 | Medium (R2 setup) | Do if latency remains a problem |
| Self-host in /public/ | N/A | N/A | $0 | N/A | **Blocked by file size limit** |

## Consequences

### Positive
- Phase 1 alone guarantees a **4x reduction** in worst-case model download size
- Phases 1+2 require zero infrastructure and zero cost
- Phase 3 (R2) brings model hosting to Cloudflare's edge, same network as the site
- R2 is free at this scale and removes dependency on Hugging Face availability
- All phases are independent and can be shipped incrementally

### Negative
- Phase 1 (quantization): Very slight reduction in embedding quality from int8 quantization. For semantic search over 665 historical letters, this is negligible -- the model was designed for this use case.
- Phase 3 (R2): Adds infrastructure to manage (R2 bucket, Worker/domain). Model updates require a separate deployment step. However, model updates are infrequent (the project has used gte-small since inception).

### New Findings Uncovered During Analysis

1. **The 33 MB comment in `search-engine.ts` line 57 is misleading.** It says "~33 MB" but this refers to the CDN URL for transformers.js, not the model. The transformers.js core is ~2 MB. The 33 MB figure happens to match the quantized model size but the comment conflates the two.

2. **`letters.json` (1.3 MB) is loaded twice independently** -- once in `SearchBox.tsx` and once in `search/page.tsx`. Both fetch `/data/letters.json` to build the same `lettersMeta` map. This should be deduplicated into a shared hook or context provider (separate from this ADR but worth noting).

3. **The embedding generation script uses the unquantized model** (`.cache/models/Xenova/gte-small/onnx/model.onnx` at 127 MB). This is fine for build-time quality but confirms that the browser should use the quantized variant for parity testing.

4. **transformers.js has its own internal caching** using the Cache API / IndexedDB. This means the browser retains the model across page sessions even if HTTP cache headers expire. A Service Worker (discussed in ADR-010) is therefore lower priority.

## Validation
- After Phase 1: verify via DevTools Network tab that `model_quantized.onnx` (~33 MB) is downloaded, not `model.onnx` (127 MB)
- After Phase 2: verify via DevTools that DNS/TLS for jsDelivr and huggingface.co is resolved before `init()` is called
- After Phase 3 (if pursued): verify model loads from R2 domain, measure latency improvement vs Hugging Face baseline
- All phases: E2E search tests pass, search quality unchanged
