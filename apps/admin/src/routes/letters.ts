import { Router } from 'express'
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'
import { parse } from 'csv-parse/sync'
import type { Letter, LetterSummary } from '../types.js'

function loadLettersCSV(csvDir: string): Letter[] {
  const csvPath = join(csvDir, 'placed_letters.csv')
  if (!existsSync(csvPath)) return []
  const raw = readFileSync(csvPath, 'utf-8')
  const records = parse(raw, { columns: true, skip_empty_lines: true }) as Record<string, string>[]
  return records.map(r => ({
    id: parseInt(r.id, 10),
    date: r.date,
    sender: r.sender,
    recipient: r.recipient,
    text: r.text,
    place_id: parseInt(r.place_id, 10),
  }))
}

export function createLettersRouter(csvDir: string): Router {
  const router = Router()
  const letters = loadLettersCSV(csvDir)

  // GET / — all letters with full text
  router.get('/', (_req, res) => {
    res.json(letters)
  })

  // GET /summaries — summaries only (no text)
  router.get('/summaries', (_req, res) => {
    const summaries: LetterSummary[] = letters.map(({ id, date, sender, recipient, place_id }) => ({
      id, date, sender, recipient, place_id,
    }))
    res.json(summaries)
  })

  // GET /:id — single letter
  router.get('/:id', (req, res) => {
    const id = parseInt(req.params.id, 10)
    if (isNaN(id)) {
      res.status(400).json({ error: 'Invalid letter ID' })
      return
    }
    const letter = letters.find(l => l.id === id)
    if (!letter) {
      res.status(404).json({ error: 'Letter not found' })
      return
    }
    res.json(letter)
  })

  return router
}
