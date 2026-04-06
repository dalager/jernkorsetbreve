# ADR-055: Admin Frontend Resilience

## Status

Accepted (2026-04-06)

## Date

2026-04-06

## Context

The admin frontend is used by non-technical domain experts (historians, family members) who are contributing specialized knowledge about WW1-era persons, places, and images. Code review identified several UX gaps that could cause data loss or confusion:

1. **No unsaved-changes warning**: Clicking "Tilbage" (Back) or navigating away silently discards all edits
2. **Error states swallowed**: List pages show empty tables if the API is unreachable — no error message
3. **Navigation active state**: The nav link for "Personer" is not highlighted when viewing `/personer/peter`
4. **Photo fallback**: Broken image thumbnails show the browser's default broken-image icon
5. **Save feedback**: The "Gemt" (Saved) indicator never clears, making it unclear if a second save succeeded
6. **Duplicated types**: TypeScript interfaces for Person, ImageEntry etc. are copy-pasted across components

These are individually minor but collectively degrade trust and usability for non-technical editors.

Note: With the Node/TypeScript backend rewrite (ADR-054), the shared types issue is now solvable at the project level — Zod schemas defined in `src/types.ts` can be imported by the frontend for type-safe API contracts.

## Decision

### 1. Unsaved-changes guard

Add a `useUnsavedChanges` hook that:
- Tracks a `dirty` flag (set when any form field changes, cleared on save)
- Registers a `beforeunload` event handler to warn on browser close/refresh
- Uses React Router's `useBlocker` to warn on in-app navigation

```typescript
// frontend/src/lib/hooks.ts
export function useUnsavedChanges(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [dirty])
}
```

Apply in PersonEditor, ImageEditor, and PlaceEditor. The `dirty` flag is already implicit — it maps to `saved === false && hasBeenEdited`.

### 2. Error states on list pages

Replace `.catch(console.error)` with proper error state:

```typescript
const [error, setError] = useState<string | null>(null)

// In fetch:
.catch((e) => setError(e.message))

// In render:
if (error) {
  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-wax-red font-ui mb-2">Kunne ikke hente data</p>
          <p className="text-faded text-sm">{error}</p>
          <Button onClick={() => location.reload()} className="mt-4">Prøv igen</Button>
        </CardContent>
      </Card>
    </div>
  )
}
```

### 3. Navigation active state fix

Change exact match to prefix match for non-root paths:

```typescript
const isActive = item.href === '/'
  ? location.pathname === '/'
  : location.pathname.startsWith(item.href)
```

This highlights "Personer" when viewing `/personer/peter`.

### 4. Image fallback component

Create a reusable `ImageWithFallback` component:

```typescript
// frontend/src/components/ui/image-fallback.tsx
function ImageWithFallback({ src, alt, ...props }) {
  const [failed, setFailed] = useState(false)
  if (failed) {
    return <div className="bg-parchment flex items-center justify-center text-faded text-xs">{alt}</div>
  }
  return <img src={src} alt={alt} onError={() => setFailed(true)} {...props} />
}
```

Replace raw `<img>` tags in PersonEditor photo grid and ImageList thumbnails.

### 5. Save feedback with auto-clear

Auto-clear the "Gemt" indicator after 3 seconds:

```typescript
const save = async () => {
  setSaved(false)
  setSaving(true)
  try {
    await apiPut(...)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  } catch { ... }
  finally { setSaving(false) }
}
```

### 6. Shared TypeScript types

With the Node/TypeScript backend rewrite (ADR-054), types are defined once using Zod schemas in `src/types.ts`. The frontend imports the inferred TypeScript types:

```typescript
// src/types.ts (shared, server-side)
import { z } from 'zod'

export const PersonSchema = z.object({
  id: z.string(),
  canonical: z.string().min(1),
  aliases: z.array(z.string()),
  role: z.string(),
  category: z.string(),
  // ...
})

export type Person = z.infer<typeof PersonSchema>
export type PersonUpdate = Partial<Omit<Person, 'id' | 'letter_count'>>
```

The frontend imports types from this shared module. No more copy-pasted interfaces.

If the import path is awkward (server code in frontend), extract types to a shared `packages/types/` or simply export the type definitions (without Zod runtime) from a `frontend/src/lib/types.ts` file that mirrors the server schemas.

## Consequences

### Positive
- Domain experts cannot accidentally lose unsaved work
- API errors are visible and actionable (retry button)
- Navigation is intuitive (active state always correct)
- Broken images degrade gracefully
- Save feedback is clear and timely
- Type safety across server and client with single source of truth

### Negative
- `useBlocker` requires React Router v7's data router (verify compatibility)
- Auto-clearing save indicator may be missed if user looks away — but the alternative (persistent indicator) is already proven confusing
- Shared types between server/client need a clean import strategy

## Implementation Notes

These are all frontend-only changes (except the shared types which are part of the server rewrite). Can be implemented incrementally — each fix is independent. The navigation fix and error states should ship with the initial rewrite; the unsaved-changes guard can follow.
