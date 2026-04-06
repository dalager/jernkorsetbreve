import express from 'express'
import cors from 'cors'
import { resolve, join } from 'path'
import { existsSync } from 'fs'
import { fileURLToPath } from 'url'

import { loadPersonRegistry, loadImageRegistry, loadPlacesEnriched } from './lib/registry.js'
import { createPersonsRouter } from './routes/persons.js'
import { createImagesRouter } from './routes/images.js'
import { createPlacesRouter } from './routes/places.js'
import { createLettersRouter } from './routes/letters.js'
import { createExportRouter } from './routes/export.js'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

// ── Configuration ───────────────────────────────────────

const PORT = parseInt(process.env.PORT || '3000', 10)
const REGISTRY_DIR = resolve(process.env.REGISTRY_DIR || join(__dirname, '..', '..', '..', 'data'))
const CSV_DIR = resolve(process.env.CSV_DIR || join(__dirname, '..', 'data'))
const IMAGES_DIR = resolve(process.env.IMAGES_DIR || join(REGISTRY_DIR, 'images'))
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*'
const FRONTEND_DIR = resolve(join(__dirname, '..', 'frontend', 'dist'))

// ── Load data ───────────────────────────────────────────

console.log(`[admin] Registry dir: ${REGISTRY_DIR}`)
console.log(`[admin] CSV dir:      ${CSV_DIR}`)
console.log(`[admin] Images dir:   ${IMAGES_DIR}`)

if (!existsSync(join(REGISTRY_DIR, 'person-registry.json'))) {
  console.warn(`[admin] WARNING: No registries found at ${REGISTRY_DIR}`)
  console.warn(`[admin]   Mount a volume with person-registry.json, image-registry.json, places-enriched.json`)
  console.warn(`[admin]   The app will start with empty data (health: degraded)`)
}

const persons = loadPersonRegistry(REGISTRY_DIR)
const images = loadImageRegistry(REGISTRY_DIR)
const placesEnriched = loadPlacesEnriched(REGISTRY_DIR)

console.log(`[admin] Loaded ${persons.length} persons, ${images.length} images, ${Object.keys(placesEnriched).length} places`)

// ── Express app ─────────────────────────────────────────

const app = express()

app.use(cors({ origin: CORS_ORIGIN }))
app.use(express.json({ limit: '2mb' }))

// ── API routes ──────────────────────────────────────────

const api = express.Router()

api.use('/persons', createPersonsRouter(persons, REGISTRY_DIR))
api.use('/images', createImagesRouter(images, REGISTRY_DIR))
api.use('/places', createPlacesRouter(placesEnriched, REGISTRY_DIR, CSV_DIR))
api.use('/letters', createLettersRouter(CSV_DIR))
api.use('/export', createExportRouter(REGISTRY_DIR))

// Compatibility: /places-enriched routes (frontend uses this path)
api.get('/places-enriched', (_req, res) => res.json(placesEnriched))
api.get('/places-enriched/:name', (req, res) => {
  const name = decodeURIComponent(req.params.name)
  const data = placesEnriched[name]
  if (!data) {
    res.status(404).json({ error: 'Place enrichment not found' })
    return
  }
  res.json(data)
})
api.put('/places-enriched/:name', express.json(), (req, res) => {
  const name = decodeURIComponent(req.params.name)
  placesEnriched[name] = { ...placesEnriched[name], ...req.body }
  import('./lib/registry.js').then(({ savePlacesEnriched }) => {
    savePlacesEnriched(REGISTRY_DIR, placesEnriched)
  })
  res.json(placesEnriched[name])
})

// Static image serving
api.use('/static/images', express.static(IMAGES_DIR, { maxAge: '7d' }))

// Health check
api.get('/health', (_req, res) => {
  const status = persons.length > 0 && images.length > 0 ? 'healthy' : 'degraded'
  res.json({
    status,
    persons: persons.length,
    images: images.length,
    places: Object.keys(placesEnriched).length,
    uptime: process.uptime(),
  })
})

app.use('/api', api)

// ── SPA serving (production) ────────────────────────────

if (existsSync(FRONTEND_DIR)) {
  app.use(express.static(FRONTEND_DIR))
  app.get('*', (_req, res) => {
    res.sendFile(join(FRONTEND_DIR, 'index.html'))
  })
  console.log(`[admin] Serving SPA from ${FRONTEND_DIR}`)
}

// ── Start ───────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`[admin] Server running on http://localhost:${PORT}`)
  if (process.env.ADMIN_API_KEY) {
    console.log(`[admin] API key authentication enabled`)
  } else {
    console.log(`[admin] No ADMIN_API_KEY set — running in dev mode (no auth)`)
  }
})
