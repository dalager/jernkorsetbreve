import { existsSync, writeFileSync, readFileSync, renameSync, copyFileSync, unlinkSync } from 'fs'
import { join, dirname } from 'path'
import { PersonSchema } from '../types.js'
import type { Person, ImageEntry, PlaceEnriched } from '../types.js'

// ── ADR-053: Rotating backups ───────────────────────────

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

// ── ADR-053: Atomic file writes ─────────────────────────

export function saveJson(filePath: string, data: unknown, backup = true): void {
  if (backup && existsSync(filePath)) {
    rotateBackup(filePath)
  }
  const tmp = join(
    dirname(filePath),
    `.tmp-${Date.now()}-${Math.random().toString(36).slice(2)}`
  )
  try {
    writeFileSync(tmp, JSON.stringify(data, null, 2) + '\n', 'utf-8')
    renameSync(tmp, filePath) // atomic on same filesystem (POSIX)
  } catch (err) {
    try { unlinkSync(tmp) } catch { /* ignore cleanup failure */ }
    throw err
  }
}

export function loadJson<T>(filePath: string, fallback: T): T {
  if (!existsSync(filePath)) return fallback
  const raw = readFileSync(filePath, 'utf-8')
  return JSON.parse(raw) as T
}

// ── Registry-specific loaders/savers ────────────────────

export function loadPersonRegistry(dir: string): Person[] {
  const raw = loadJson<unknown[]>(join(dir, 'person-registry.json'), [])
  return raw.map((entry) => PersonSchema.parse(entry))
}

export function savePersonRegistry(dir: string, data: Person[]): void {
  saveJson(join(dir, 'person-registry.json'), data)
  syncPersonEnrichments(dir, data)
}

// ── ADR-057: Pipeline-safe enrichment overlay ──────────

interface EnrichmentEntry {
  role: string
  category: string
  full_name?: string
  birth_date?: string
  death_date?: string
  biographical?: string
  enrichment_source?: string
  photos?: string[]
  add_aliases: string[]
}

interface EnrichmentsFile {
  _meta?: { description: string; last_updated: string }
  _manual_persons?: Person[]
  [personId: string]: unknown
}

export function syncPersonEnrichments(dir: string, persons: Person[]): void {
  const filePath = join(dir, 'person-registry-enrichments.json')
  const existing = loadJson<EnrichmentsFile>(filePath, {})

  const result: EnrichmentsFile = {}

  // Preserve _meta or create default
  result._meta = existing._meta ?? {
    description: 'Human-curated enrichments that survive NLP pipeline re-runs (ADR-057)',
    last_updated: new Date().toISOString().slice(0, 10),
  }
  result._meta.last_updated = new Date().toISOString().slice(0, 10)

  const manualPersons: Person[] = []

  for (const p of persons) {
    // Manual persons: letter_count 0 and no first_mention
    if (p.letter_count === 0 && !p.first_mention) {
      manualPersons.push(p)
      continue
    }

    const entry: EnrichmentEntry = {
      role: p.role,
      category: p.category,
      add_aliases: [],
    }

    if (p.full_name != null) entry.full_name = p.full_name
    if (p.birth_date != null) entry.birth_date = p.birth_date
    if (p.death_date != null) entry.death_date = p.death_date
    if (p.biographical != null) entry.biographical = p.biographical
    if (p.enrichment_source != null) entry.enrichment_source = p.enrichment_source
    if (p.photos && p.photos.length > 0) entry.photos = p.photos

    result[p.id] = entry
  }

  if (manualPersons.length > 0) {
    result._manual_persons = manualPersons
  }

  saveJson(filePath, result)
}

export function loadImageRegistry(dir: string): ImageEntry[] {
  return loadJson<ImageEntry[]>(join(dir, 'image-registry.json'), [])
}

export function saveImageRegistry(dir: string, data: ImageEntry[]): void {
  saveJson(join(dir, 'image-registry.json'), data)
}

export function loadPlacesEnriched(dir: string): Record<string, PlaceEnriched> {
  return loadJson<Record<string, PlaceEnriched>>(join(dir, 'places-enriched.json'), {})
}

export function savePlacesEnriched(dir: string, data: Record<string, PlaceEnriched>): void {
  saveJson(join(dir, 'places-enriched.json'), data)
}
