# ADR-054: Admin Deployment Architecture

## Status

Accepted (2026-04-06)

## Date

2026-04-06

## Context

The admin app (apps/admin/) must be deployed independently of the public static website. The public site is built with Next.js and deployed as static files (e.g., Vercel, Netlify). The admin app is a Node.js/TypeScript application with an Express API backend and a React SPA frontend.

The backend was originally a Python/FastAPI prototype that included letter modernization (Anthropic API spike). The rewrite to Node/TypeScript is motivated by:
- **One language**: frontend and backend share TypeScript, types, and tooling
- **One runtime**: single Node.js process serves both API and SPA — no separate API container
- **Simpler deployment**: Node apps deploy trivially to Railway, Render, Fly.io, or any VPS
- **No Python dependency**: eliminates venv, pip, separate Dockerfile for the API
- **Modernization removed**: the Anthropic API integration was a spike; text modernization is a pipeline concern (ADR-014/ADR-041), not an admin editor concern

Key constraints:
- The data directory (`data/`) must persist across redeploys
- The admin should be reachable by 1-3 domain experts, not the public
- Image files (309MB in `data/images/`) must be available to the admin API for serving
- `REGISTRY_DIR` must be configurable via environment variable

## Decision

### Architecture: Unified Node.js application

A single Node.js process serves both the API and the built React SPA:

```
apps/admin/
├── src/
│   ├── server.ts          # Express app: API routes + static SPA serving
│   ├── routes/
│   │   ├── persons.ts     # CRUD for person-registry.json
│   │   ├── images.ts      # CRUD for image-registry.json
│   │   ├── places.ts      # CRUD + places.csv read
│   │   └── export.ts      # ADR-051 export/download
│   ├── lib/
│   │   ├── registry.ts    # Atomic JSON read/write (ADR-053)
│   │   └── auth.ts        # API key middleware (ADR-052)
│   └── types.ts           # Shared Zod schemas + TS types
├── frontend/              # Existing React app (unchanged)
├── package.json           # Single package, scripts for dev + build + start
├── tsconfig.json          # Server TypeScript config
└── Dockerfile             # Single-stage Node image
```

In production, Express serves:
- `/api/*` — REST endpoints for registry CRUD, export, health
- `/api/static/images/*` — static image files from the data directory
- `/*` — the built React SPA (from `frontend/dist/`)

### Dockerfile

```dockerfile
FROM node:20-alpine AS build
WORKDIR /app

# Build backend
COPY package.json package-lock.json tsconfig.json ./
COPY src/ ./src/
RUN npm ci && npm run build:server

# Build frontend
COPY frontend/ ./frontend/
RUN cd frontend && npm ci && npm run build

FROM node:20-alpine
WORKDIR /app
COPY --from=build /app/dist/ ./dist/
COPY --from=build /app/frontend/dist/ ./frontend/dist/
COPY --from=build /app/node_modules/ ./node_modules/
COPY package.json ./

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000
CMD ["node", "dist/server.js"]
```

Single image, single process. No nginx, no docker-compose for simple deployments.

### Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Server port |
| `REGISTRY_DIR` | `../../data` (relative to server.ts) | Path to data directory |
| `ADMIN_API_KEY` | _(none — dev mode)_ | Shared API key for write access (ADR-052) |
| `CORS_ORIGIN` | `*` | Allowed CORS origin for production |

### Deployment options

#### Option A: Railway / Render / Fly.io (recommended)

- Push to GitHub, connect repo, auto-deploy
- Attach persistent volume for `data/` (all three support this)
- Set env vars in dashboard
- HTTPS provided automatically
- Cost: ~$5-7/month

#### Option B: VPS with Docker

```bash
docker build -t jernkorset-admin .
docker run -d \
  -p 3000:3000 \
  -v /path/to/data:/data \
  -e REGISTRY_DIR=/data \
  -e ADMIN_API_KEY=secret \
  jernkorset-admin
```

Add Caddy or nginx reverse proxy for HTTPS.

#### Option C: Direct Node.js on VPS

```bash
npm run build
REGISTRY_DIR=/path/to/data ADMIN_API_KEY=secret node dist/server.js
```

Use PM2 or systemd for process management. Simplest option for a small VPS.

### Health check

```typescript
app.get('/api/health', (req, res) => {
  const status = persons.length > 0 && images.length > 0 ? 'healthy' : 'degraded'
  res.json({
    status,
    persons: persons.length,
    images: images.length,
    places: Object.keys(placesEnriched).length,
  })
})
```

### Backup strategy

On persistent storage, add a cron job that copies the data directory daily:

```bash
0 3 * * * tar czf /backups/jernkorset-data-$(date +\%Y\%m\%d).tar.gz /path/to/data/
```

Combined with the rotating `.bak` files from ADR-053, this provides:
- Per-save backups (3 rotations) for quick recovery
- Daily full backups for disaster recovery

### Local development

```bash
cd apps/admin
npm run dev        # Starts Express with tsx (hot reload) + Vite dev server
```

The Vite dev server proxies `/api` to the Express backend, same as the current setup.

## Alternatives Considered

### A. Keep Python/FastAPI backend

Requires maintaining two languages, two runtimes, two Dockerfiles. The backend logic is thin JSON CRUD — Python bought nothing here. The Anthropic API integration (modernization) that justified Python has been removed. **Rejected**.

### B. Serverless (Vercel Functions, AWS Lambda)

Node.js runs well on Lambda. But the in-memory data model (loading all registries at startup) conflicts with cold starts. Image serving from ephemeral `/tmp` is not practical. Could work with S3 for images, but adds infrastructure complexity. **Rejected** for now.

### C. Docker Compose with separate API + frontend containers

Adds operational complexity (two containers, nginx proxy config) for no benefit. A single Node process handles both. **Rejected**.

## Consequences

### Positive
- Single language (TypeScript), single runtime (Node.js), single process
- Deploys to any Node hosting with zero configuration
- Shared types between server and frontend (Zod schemas → TypeScript types)
- No Python/venv dependency management
- Modernization spike removed — clean, focused editor application
- Same codebase works for local dev and production

### Negative
- Rewrite effort: Python API → TypeScript Express (~450 lines of logic)
- Existing Python E2E tests need adaptation
- Image serving via Express static middleware is less optimized than nginx (acceptable for 1-3 users)

## Depends On
- ADR-052 (authentication — `ADMIN_API_KEY` env var)
- ADR-053 (atomic writes — data integrity on the volume)
- ADR-051 (export — fallback for getting data out)

## Supersedes

The original Python/FastAPI backend in `apps/admin/api/` is replaced by the Node.js backend in `apps/admin/src/`. The letter modernization endpoints (proofread, batch modernize, modernization dashboard) are removed — they were a spike that has been superseded by the pipeline approach in ADR-014 and ADR-041.
