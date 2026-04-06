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
