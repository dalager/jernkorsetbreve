# ADR-056: Entity CRUD Completeness

## Status

Accepted (2026-04-06)

## Date

2026-04-06

## Context

The admin app provides full CRUD (Create, Read, Update, Delete) for images, but the person and place editors are limited:

| Entity | Create | Read | Update | Delete |
|--------|--------|------|--------|--------|
| Person | - | Yes | Yes | - |
| Image | Yes | Yes | Yes | Yes |
| Place (enriched) | Via PUT | Yes | Yes | - |

Missing capabilities:
- **No person creation**: If domain experts discover a new person referenced in the letters (e.g., a previously unidentified neighbor), they cannot add them through the admin UI.
- **No person deletion**: If a person entry is discovered to be a duplicate or error, it cannot be removed.
- **No place creation UI**: While `PUT /api/places-enriched/{name}` creates-or-updates, there is no frontend flow to add a completely new place that does not already exist in `places.csv`.
- **No image file upload**: `POST /api/images` creates metadata only. Domain experts with new photos cannot upload the files through the admin.

Additionally, the image `POST` endpoint has no corresponding UI — it was built in the API but never wired to the frontend.

## Decision

### 1. Person Create endpoint + UI

**API** (`src/routes/persons.ts`): Add `POST /api/persons`:

```typescript
router.post('/', requireApiKey, (req, res) => {
  const body = PersonCreateSchema.parse(req.body)
  if (persons.some(p => p.id === body.id)) {
    return res.status(409).json({ error: `Person ID '${body.id}' already exists` })
  }
  const entry: Person = {
    ...body,
    letter_count: 0,
    first_mention: null,
    last_mention: null,
    photos: [],
  }
  persons.push(entry)
  savePersonRegistry(registryDir, persons)
  res.status(201).json(entry)
})
```

**Schema** (`src/types.ts`):

```typescript
const PersonCreateSchema = z.object({
  id: z.string().regex(/^[a-z0-9_-]+$/),
  canonical: z.string().min(1),
  aliases: z.array(z.string()).default([]),
  role: z.string().default(''),
  category: z.string().default('unknown'),
  full_name: z.string().nullable().default(null),
  biographical: z.string().nullable().default(null),
})
```

The `id` field is required and must be kebab-case (validated via regex). `letter_count`, `first_mention`, and `last_mention` are computed fields — set to defaults on creation.

**Frontend**: Add a "Tilføj person" (Add person) button on the PersonList page. Opens a modal or inline form with mandatory `id` + `canonical` fields. On submit, navigates to the new person's editor page.

### 2. Person Delete endpoint

**API**: Add `DELETE /api/persons/:personId`:

```typescript
router.delete('/:personId', requireApiKey, (req, res) => {
  const idx = persons.findIndex(p => p.id === req.params.personId)
  if (idx === -1) return res.status(404).json({ error: 'Person not found' })
  persons.splice(idx, 1)
  savePersonRegistry(registryDir, persons)
  res.status(204).end()
})
```

**Frontend**: Add a delete button at the bottom of PersonEditor, with confirmation: "Er du sikker? Denne person fjernes fra registret."

**Safety**: Persons referenced in `image-registry.json` (in `persons[]` arrays) should trigger a warning: "Denne person er tilknyttet X billeder. Fjern personreferencer fra billederne først." The API should not cascade-delete references — that is a manual curation step.

### 3. New Place creation flow

The existing `PUT /api/places-enriched/:name` already creates-or-updates. The frontend needs a "Tilføj sted" (Add place) button on PlaceList that:
1. Prompts for the place name
2. Navigates to `/steder/{name}` which opens PlaceEditor
3. PlaceEditor already handles the "no enrichment data yet" case (shows "Ingen berigelsesdata endnu")

No API changes needed — just a frontend UX addition.

### 4. Image metadata creation UI

Add a "Registrér billede" (Register image) button on ImageList. Opens a form for:
- `id` (auto-generated from filename if possible)
- `filename` (required)
- `path` (required — e.g., `portrait/new_photo.png`)
- `category` (select)
- `description_da` (textarea)

This calls the existing `POST /api/images` endpoint. The actual image file must be placed on the server manually (or via file upload in a future phase).

### 5. Image file upload (deferred)

Adding a proper file upload (`multipart/form-data`) is deferred to a future ADR. It requires:
- Backend: receiving and storing the file in `data/images/{category}/` (use `multer` middleware)
- Image processing: generating thumbnails/WebP variants (ref ADR-047, use `sharp`)
- Validation: file type, size limits
- Storage: ensuring the volume has space

For now, domain experts place files manually and register them through the metadata UI. This matches the existing workflow where images were extracted from a PDF and placed in directories by scripts.

## Alternatives Considered

### A. Admin-only CRUD, no public creation

Keep creation restricted to scripts and pipelines. Domain experts only edit existing entries. **Rejected** — too limiting for historians discovering new persons or places in their research.

### B. Full relational integrity enforcement

Prevent deletion of persons referenced by images, places referenced by images, etc. **Rejected for now** — adds complexity. A warning is sufficient. The data is version-controlled in git; mistakes can be reverted.

## Consequences

### Positive
- Domain experts can add newly discovered persons and places
- Complete CRUD for all entity types
- Referential integrity warnings prevent accidental orphaning
- Consistent UX patterns across all entity editors

### Negative
- Person deletion without cascade could leave orphaned references in image-registry
- `id` field for new persons requires kebab-case convention understanding
- Image file upload is still manual — partial workflow

## Depends On
- ADR-053 (atomic writes — creation must be safe)
- ADR-052 (authentication — create/delete must be protected)

## Relation to Other ADRs
- ADR-042 (person disambiguation) — new persons should follow the canonical naming conventions established there
- ADR-045 (image registry schema) — new image metadata must conform to the schema
- ADR-050 (image curation workflow) — metadata creation is part of the curation flow
