# ADR-051: Admin App Data Export & Git Sync

## Status

Accepted (2026-04-06)

## Date

2026-04-06

## Context

The admin app (apps/admin/) allows domain experts to edit three JSON registry files:
- `data/person-registry.json` (68 persons)
- `data/image-registry.json` (164 images)
- `data/places-enriched.json` (75 places)

These files are the canonical source of truth, stored in git. NLP pipelines produce them (ADR-042, ADR-045, ADR-032), the public website consumes them at build time, and the admin app is the first write-path for human edits.

**The problem**: When the admin runs on a deployed server, edits are written to the server's local filesystem. There is no mechanism to get those edits back into git. If the server redeploys, all edits since the last manual extraction are lost. Domain experts (historians, family members) are non-technical and cannot SSH into servers or run git commands.

This is the single biggest deployment blocker for the admin app.

## Decision

### Phase 1: Export Endpoints + Download UI (immediate)

Add export routes to the Express API (`src/routes/export.ts`):

```
GET /api/export/persons          → person-registry.json
GET /api/export/images           → image-registry.json
GET /api/export/places-enriched  → places-enriched.json
GET /api/export/all              → jernkorset-data-YYYY-MM-DD.zip
```

Each returns the current in-memory state as a downloadable file with `Content-Disposition: attachment` headers. The `/api/export/all` endpoint uses Node's built-in `archiver` (or `yazl`) to bundle all three into a timestamped ZIP archive.

Add a **"Download data"** button in the admin UI navigation that calls `/api/export/all` and triggers a browser download. This gives domain experts a clear escape hatch — they can download their work and send it to the project maintainer for git commit.

### Phase 2: Change Tracking (short-term)

Add a lightweight change log to each registry save:

```json
{
  "_changelog": [
    {
      "timestamp": "2026-04-06T14:32:00Z",
      "entity_id": "peter",
      "field": "biographical",
      "action": "update",
      "summary": "Added detail about Vallekilde Højskole"
    }
  ]
}
```

Store in a separate `data/admin-changelog.json` file. Include in the ZIP export. This gives the git committer context for meaningful commit messages and provides a basic audit trail.

### Phase 3: Server-Side Git Integration (later, optional)

For a fully automated flow, the API could commit and push changes directly using `simple-git` (Node.js git wrapper):

1. Admin server has a clone of the repo (or a sparse checkout of `data/`)
2. On save, the API writes the JSON, runs `git.add().commit().push()`
3. Push triggers the public site rebuild via CI/CD

This requires git credentials on the server and a dedicated branch (e.g., `admin-edits`) to avoid conflicts. A PR-based workflow is safest:
- Admin pushes to `admin-edits` branch
- CI opens a PR to `master`
- Maintainer reviews and merges

**This phase is deferred** — the export-based workflow is sufficient for the current team size (1-3 editors).

## Alternatives Considered

### A. Database backend (PostgreSQL/SQLite)

Replace JSON files with a proper database. This solves persistence but breaks the git-as-source-of-truth model that the entire project is built on. All NLP pipelines, build scripts, and the public site would need rewriting. **Rejected** — too invasive for the benefit.

### B. Real-time sync (CouchDB/PouchDB)

Use a sync-capable database for automatic bidirectional replication. Overkill for 3 JSON files and 1-3 editors. **Rejected** — complexity disproportionate to need.

### C. S3/object storage

Store JSON files in S3 instead of local disk. Solves persistence but still needs a way to get data into git. Adds infrastructure dependency. **Rejected** — adds complexity without solving the core git-sync problem.

## Consequences

### Positive
- Domain experts can always download their work — no data loss risk
- ZIP export gives the maintainer exactly what to `git add + commit`
- Change log provides audit trail and commit message context
- Phase 3 path is clear if automated sync is needed later
- No infrastructure dependencies beyond the Node server

### Negative
- Phase 1 requires manual download-and-commit workflow
- Change log adds slight overhead to every save operation
- Phase 3 requires git credentials management on the server

## Depends On
- ADR-053 (atomic writes — data must be consistent before export)
- ADR-052 (authentication — export endpoints must be protected)

## Implementation Notes

The export routes are a new `src/routes/export.ts` file. The ZIP endpoint can use the `archiver` npm package or the lighter `yazl`. The change log should be stored separately from the registry files to avoid polluting the canonical data format defined in ADR-045.
