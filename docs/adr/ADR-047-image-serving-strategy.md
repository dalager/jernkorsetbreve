# ADR-047: Image Serving Strategy

## Status

Accepted (2026-04-05)

## Date

2026-04-04

## Context

165 images (309MB total) need to be served to the web frontend. The project uses a FastAPI backend (`api/`) and a frontend. The images are archival — a fixed set extracted from a family presentation PDF, not user-uploaded content.

## Options considered

### A. FastAPI endpoint

Add `/api/images/{image_id}` endpoint that reads from `data/images/pdf-presentation/` and streams the file.

Pros: Consistent with existing API pattern, can add auth/resizing later.
Cons: Adds backend complexity for simple file serving, slower than static.

### B. Static files in frontend public directory

Copy images to `frontend/public/images/letters/` (or equivalent). Served directly by the web server.

Pros: Simplest, fastest, CDN-compatible, zero backend changes.
Cons: 309MB added to frontend build artifacts, needs .gitignore.

### C. Separate static file server / CDN

Serve from a dedicated path or external CDN.

Pros: Best performance at scale.
Cons: Over-engineered for this project's needs.

## Decision

**Option B: Static files** with a FastAPI fallback.

### Primary: Static serving

Images are copied (not symlinked — Windows compatibility) to the frontend's public/static directory during the build pipeline.

**Directory structure:**
```
frontend/public/images/letters/
  portrait/
  group/
  place/
  map/
  document/
  historical/
  military/
```

**URL pattern:** `/images/letters/{path}` where `{path}` matches the `path` field in `image-registry.json`.

Example: image-registry entry `{"path": "portrait/page001_02.png"}` → URL `/images/letters/portrait/page001_02.png`

### Fallback: FastAPI endpoint

Add a simple `/api/images/{image_path:path}` endpoint that serves from `data/images/pdf-presentation/`. This is useful for:
- Development (no need to copy 309MB for every frontend rebuild)
- Admin/preview tools
- Future auth-gated access

### Git handling

Add to `.gitignore`:
```
frontend/public/images/letters/
```

The images are derived artifacts (extracted from the PDF). The PDF itself and the extraction scripts are in git. The images are reproduced by running the extraction pipeline.

### Build pipeline addition

Add to the data build step:
```bash
# Copy classified images to frontend
python scripts/copy-images-to-frontend.py
```

This script reads `image-registry.json` and copies each image from `data/images/pdf-presentation/{path}` to `frontend/public/images/letters/{path}`.

### Thumbnails (future)

Not needed now (most images are under 2MB). If page load becomes an issue:
- Generate thumbnails during build (e.g., 300px wide)
- Store in `frontend/public/images/letters/thumbs/`
- Add `thumbnail_path` field to image-registry.json
- This is a separate future decision, not part of this ADR.

## Consequences

- Zero backend changes for the primary serving path
- Frontend can reference images with a simple path: `/images/letters/${image.path}`
- The 309MB is not in git, but reproducible from the PDF + scripts
- Development workflow: run `scripts/copy-images-to-frontend.py` once after checkout
- The FastAPI fallback means the API can also serve images during development without the copy step
