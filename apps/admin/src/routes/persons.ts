import { Router } from 'express'
import { requireApiKey } from '../lib/auth.js'
import { savePersonRegistry } from '../lib/registry.js'
import { PersonCreateSchema, PersonUpdateSchema, PersonSchema } from '../types.js'
import type { Person } from '../types.js'

export function createPersonsRouter(persons: Person[], registryDir: string): Router {
  const router = Router()

  router.get('/', (_req, res) => {
    res.json(persons)
  })

  router.get('/lookup', (_req, res) => {
    res.json(persons.map(p => ({ id: p.id, canonical: p.canonical })))
  })

  router.get('/:personId', (req, res) => {
    const person = persons.find(p => p.id === req.params.personId)
    if (!person) {
      res.status(404).json({ error: 'Person not found' })
      return
    }
    res.json(person)
  })

  // ADR-056: Person creation
  router.post('/', requireApiKey, (req, res) => {
    const result = PersonCreateSchema.safeParse(req.body)
    if (!result.success) {
      res.status(422).json({ error: 'Validation failed', details: result.error.issues })
      return
    }
    if (persons.some(p => p.id === result.data.id)) {
      res.status(409).json({ error: `Person ID '${result.data.id}' already exists` })
      return
    }
    const entry: Person = {
      ...result.data,
      letter_count: 0,
      first_mention: null,
      last_mention: null,
      photos: [],
      enrichment_source: null,
    }
    persons.push(entry)
    savePersonRegistry(registryDir, persons)
    res.status(201).json(entry)
  })

  router.put('/:personId', requireApiKey, (req, res) => {
    const idx = persons.findIndex(p => p.id === req.params.personId)
    if (idx === -1) {
      res.status(404).json({ error: 'Person not found' })
      return
    }
    const result = PersonUpdateSchema.safeParse(req.body)
    if (!result.success) {
      res.status(422).json({ error: 'Validation failed', details: result.error.issues })
      return
    }
    const updated = { ...persons[idx], ...result.data }
    const validate = PersonSchema.safeParse(updated)
    if (!validate.success) {
      res.status(422).json({ error: 'Invalid data after merge', details: validate.error.issues })
      return
    }
    persons[idx] = validate.data
    savePersonRegistry(registryDir, persons)
    res.json(persons[idx])
  })

  // ADR-056: Person deletion
  router.delete('/:personId', requireApiKey, (req, res) => {
    const idx = persons.findIndex(p => p.id === req.params.personId)
    if (idx === -1) {
      res.status(404).json({ error: 'Person not found' })
      return
    }
    persons.splice(idx, 1)
    savePersonRegistry(registryDir, persons)
    res.status(204).end()
  })

  return router
}
