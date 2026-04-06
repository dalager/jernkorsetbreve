# Jernkorset Admin App

Editorial tool for managing WW1 letter registry data (persons, images, places).

## Architecture

Unified Node.js application — single Express server serves the API and React SPA.

```
apps/admin/
├── src/                    # Express/TypeScript backend
│   ├── server.ts           # Main entry — API routes + SPA serving
│   ├── routes/             # REST endpoints (persons, images, places, letters, export)
│   ├── lib/                # Auth middleware, atomic JSON persistence
│   └── types.ts            # Zod schemas (shared validation)
├── frontend/               # React 19 SPA (Vite + Tailwind)
├── data/                   # CSV data (letters, places)
├── package.json            # Server dependencies + scripts
├── tsconfig.json           # Backend TypeScript config
└── Dockerfile              # Single-stage Node 20 image
```

## Quick Start

```bash
cd apps/admin
npm install
npm run dev          # Starts Express (port 3000) + Vite dev server (port 5173)
```

The Vite dev server proxies `/api` requests to Express at `http://localhost:3000`.

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/persons` | No | All persons |
| GET | `/api/persons/:id` | No | Single person |
| POST | `/api/persons` | Yes | Create person |
| PUT | `/api/persons/:id` | Yes | Update person |
| DELETE | `/api/persons/:id` | Yes | Delete person |
| GET | `/api/images` | No | All images (optional `?category=`) |
| POST | `/api/images` | Yes | Create image metadata |
| PUT | `/api/images/:id` | Yes | Update image |
| DELETE | `/api/images/:id` | Yes | Delete image |
| GET | `/api/places` | No | All places from CSV |
| GET | `/api/places-enriched` | No | All enrichment data |
| PUT | `/api/places-enriched/:name` | Yes | Create/update enrichment |
| GET | `/api/letters` | No | All letters with text |
| GET | `/api/export/all` | Yes | Download all data as ZIP |
| GET | `/api/health` | No | Health check |

## Authentication (ADR-052)

Set `ADMIN_API_KEY` environment variable to enable API key auth on write endpoints.
No key = dev mode (all requests pass).

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Server port |
| `REGISTRY_DIR` | `../../data` | Path to JSON registries + images |
| `CSV_DIR` | `./data` | Path to CSV data |
| `ADMIN_API_KEY` | _(none)_ | API key for write access |
| `CORS_ORIGIN` | `*` | Allowed CORS origin |

## Production

```bash
npm run build        # Compiles TypeScript + builds React SPA
npm start            # Runs dist/server.js (serves API + SPA on port 3000)
```

Or with Docker:

```bash
docker build -t jernkorset-admin .
docker run -p 3000:3000 -v /path/to/data:/data -e REGISTRY_DIR=/data jernkorset-admin
```

## Related ADRs

- ADR-051: Data export & git sync
- ADR-052: API key authentication
- ADR-053: Atomic writes & rotating backups
- ADR-054: Node.js deployment architecture
- ADR-055: Frontend resilience
- ADR-056: Entity CRUD completeness
