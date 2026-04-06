import { Router } from 'express'
import archiver from 'archiver'
import { join } from 'path'
import { readFileSync, existsSync } from 'fs'
import { requireApiKey } from '../lib/auth.js'

export function createExportRouter(registryDir: string): Router {
  const router = Router()

  function sendJsonFile(res: import('express').Response, filename: string, filePath: string): void {
    if (!existsSync(filePath)) {
      res.status(404).json({ error: `${filename} not found` })
      return
    }
    res.setHeader('Content-Type', 'application/json')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    res.send(readFileSync(filePath, 'utf-8'))
  }

  // ADR-051: Individual file exports
  router.get('/persons', requireApiKey, (req, res) => {
    sendJsonFile(res, 'person-registry.json', join(registryDir, 'person-registry.json'))
  })

  router.get('/images', requireApiKey, (req, res) => {
    sendJsonFile(res, 'image-registry.json', join(registryDir, 'image-registry.json'))
  })

  router.get('/places-enriched', requireApiKey, (req, res) => {
    sendJsonFile(res, 'places-enriched.json', join(registryDir, 'places-enriched.json'))
  })

  // ADR-051: ZIP bundle of all registries
  router.get('/all', requireApiKey, (req, res) => {
    const date = new Date().toISOString().slice(0, 10)
    const zipFilename = `jernkorset-data-${date}.zip`

    res.setHeader('Content-Type', 'application/zip')
    res.setHeader('Content-Disposition', `attachment; filename="${zipFilename}"`)

    const archive = archiver('zip', { zlib: { level: 9 } })
    archive.pipe(res)

    const files = [
      { name: 'person-registry.json', path: join(registryDir, 'person-registry.json') },
      { name: 'person-registry-enrichments.json', path: join(registryDir, 'person-registry-enrichments.json') },
      { name: 'image-registry.json', path: join(registryDir, 'image-registry.json') },
      { name: 'places-enriched.json', path: join(registryDir, 'places-enriched.json') },
    ]

    for (const f of files) {
      if (existsSync(f.path)) {
        archive.file(f.path, { name: f.name })
      }
    }

    archive.finalize()
  })

  return router
}
