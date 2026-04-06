# ADR-053: Registry Persistence & Atomic Writes

## Status

Accepted (2026-04-06)

## Date

2026-04-06

## Context

The admin API persists registry data by writing JSON files to disk on every save operation. The naive approach:

```typescript
fs.writeFileSync(path, JSON.stringify(data, null, 2))
```

has three data integrity risks:

1. **Non-atomic writes**: `writeFileSync` truncates the file before writing. If the process crashes mid-write, the file is empty or partial — corrupted beyond recovery.

2. **Single-depth backup**: Overwriting a single `.bak` file on every save means two bad saves in a row lose the last good version.

3. **Single-process assumption**: Node.js runs single-threaded, which eliminates in-process race conditions. But if someone accidentally runs two instances against the same data directory, writes will conflict silently.

Additionally, there is no post-save validation — the update handler applies changes and writes without verifying the result still conforms to the expected schema.

## Decision

### 1. Atomic file writes

Use write-to-temp-then-rename via Node.js:

```typescript
// src/lib/registry.ts
import { writeFileSync, renameSync, mkdtempSync, unlinkSync, copyFileSync } from 'fs'
import { join, dirname } from 'path'
import { tmpdir } from 'os'

function saveJson(filePath: string, data: unknown, backup = true): void {
  if (backup && existsSync(filePath)) {
    rotateBackup(filePath)
  }
  const tmp = join(dirname(filePath), `.tmp-${Date.now()}-${Math.random().toString(36).slice(2)}`)
  try {
    writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf-8')
    renameSync(tmp, filePath)  // atomic on same filesystem (POSIX)
  } catch (err) {
    try { unlinkSync(tmp) } catch {}
    throw err
  }
}
```

`renameSync` is atomic on POSIX (same filesystem). On Windows (the current dev environment), it is not fully atomic but avoids the truncate-then-write failure mode.

### 2. Rotating backups

Keep the 3 most recent backups:

```typescript
function rotateBackup(filePath: string, maxBackups = 3): void {
  for (let i = maxBackups - 1; i > 0; i--) {
    const src = `${filePath}.bak.${i}`
    const dst = `${filePath}.bak.${i + 1}`
    if (existsSync(src)) renameSync(src, dst)
  }
  if (existsSync(filePath)) {
    copyFileSync(filePath, `${filePath}.bak.1`)
  }
}
```

This gives a history of 3 previous versions: `.bak.1` (most recent), `.bak.2`, `.bak.3`. Oldest is rotated out automatically. Sufficient for recovering from accidental bad edits without filling disk.

### 3. Single-instance enforcement

Node runs single-threaded, so there are no in-process race conditions. To prevent accidental multi-instance conflicts, write a `.lock` file on startup with the PID and port. Log a warning if a lock already exists.

For the current scale (1-3 editors, single server), single-instance is the correct deployment mode.

### 4. Post-save validation with Zod

Define schemas for all registry types using Zod (already common in TypeScript projects). Validate after applying updates, before persisting:

```typescript
import { z } from 'zod'

const PersonSchema = z.object({
  id: z.string(),
  canonical: z.string().min(1),
  aliases: z.array(z.string()),
  // ...
})

// In update handler:
const updated = { ...person, ...body }
PersonSchema.parse(updated) // throws ZodError if invalid
saveJson(registryPath, allPersons)
```

If validation fails, the update is rejected with a 422 response. Because validation happens before `saveJson`, no invalid data is persisted.

## Alternatives Considered

### A. SQLite backend

Replace JSON files with SQLite. Gives proper ACID transactions, concurrent access, and crash recovery. But breaks the git-as-source-of-truth model and requires import/export logic. **Rejected** for now — atomic JSON writes are sufficient at current scale.

### B. Write-ahead log (WAL)

Log individual operations, replay on startup. Standard database technique. Overkill for 3 JSON files with < 200 entries each. **Rejected**.

### C. Copy-on-write per request

Clone the entire registry before each update, validate, then atomically swap. Clean approach. Since Node is single-threaded and the registries are small (< 200 entries), copying is cheap. **Recommended** — validate on copy, then persist only if valid.

## Consequences

### Positive
- No more corrupted files from crash during write
- 3 backup versions provide recovery window for bad edits
- Post-save validation catches invalid data before persistence
- Zod schemas are shared with the frontend (same TypeScript types)

### Negative
- Atomic writes add slight I/O overhead (temp file + rename)
- 3 backups per registry = up to 9 extra files in data/
- Zod adds a dependency (but it's lightweight and standard)

## Implementation Notes

The `saveJson` function in `src/lib/registry.ts` is the single place that handles all file writes. All registry saves go through it. The Zod schemas in `src/types.ts` serve double duty — API validation and frontend type generation.
