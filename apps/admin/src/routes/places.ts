import { Router } from 'express'
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'
import { parse } from 'csv-parse/sync'
import { requireApiKey } from '../lib/auth.js'
import { savePlacesEnriched } from '../lib/registry.js'
import { PlaceEnrichedUpdateSchema } from '../types.js'
import type { PlaceCSV, PlaceEnriched } from '../types.js'

function loadPlacesCSV(csvDir: string): PlaceCSV[] {
  const csvPath = join(csvDir, 'places_cleanup.csv')
  if (!existsSync(csvPath)) return []
  const raw = readFileSync(csvPath, 'utf-8')
  const records = parse(raw, { columns: true, skip_empty_lines: true }) as Record<string, string>[]
  return records.map(r => ({
    place_id: parseInt(r.place_id, 10),
    name: r.name,
    geometry: r.geometry || null,
    country: r.country || '',
  }))
}

export function createPlacesRouter(
  placesEnriched: Record<string, PlaceEnriched>,
  registryDir: string,
  csvDir: string
): Router {
  const router = Router()
  const csvPlaces = loadPlacesCSV(csvDir)

  // GET /places — all places from CSV
  router.get('/', (_req, res) => {
    const items: Record<string, PlaceCSV> = {}
    for (const p of csvPlaces) {
      items[p.name] = p
    }
    res.json({ items, total: csvPlaces.length })
  })

  // GET /places/lookup — merged place names for dropdowns
  router.get('/lookup', (_req, res) => {
    const seen = new Set<string>()
    const result: { name: string; place_id: number | null }[] = []
    for (const p of csvPlaces) {
      result.push({ name: p.name, place_id: p.place_id })
      seen.add(p.name)
    }
    for (const name of Object.keys(placesEnriched)) {
      if (!seen.has(name)) {
        result.push({ name, place_id: null })
      }
    }
    result.sort((a, b) => a.name.localeCompare(b.name, 'da'))
    res.json(result)
  })

  // GET /places-enriched — all enrichment data
  router.get('/enriched', (_req, res) => {
    res.json(placesEnriched)
  })

  // GET /places-enriched/:name — single enrichment
  router.get('/enriched/:name', (req, res) => {
    const name = decodeURIComponent(req.params.name as string)
    const data = placesEnriched[name]
    if (!data) {
      res.status(404).json({ error: 'Place enrichment not found' })
      return
    }
    res.json(data)
  })

  // PUT /places-enriched/:name — create or update enrichment
  router.put('/enriched/:name', requireApiKey, (req, res) => {
    const name = decodeURIComponent(req.params.name as string)
    const result = PlaceEnrichedUpdateSchema.safeParse(req.body)
    if (!result.success) {
      res.status(422).json({ error: 'Validation failed', details: result.error.issues })
      return
    }
    placesEnriched[name] = { ...placesEnriched[name], ...result.data }
    savePlacesEnriched(registryDir, placesEnriched)
    res.json(placesEnriched[name])
  })

  return router
}
