import { Router } from 'express'
import { requireApiKey } from '../lib/auth.js'
import { saveImageRegistry } from '../lib/registry.js'
import { ImageCreateSchema, ImageUpdateSchema, ImageSchema } from '../types.js'
import type { ImageEntry } from '../types.js'

export function createImagesRouter(images: ImageEntry[], registryDir: string): Router {
  const router = Router()

  router.get('/', (req, res) => {
    const category = req.query.category as string | undefined
    if (category) {
      res.json(images.filter(img => img.category === category))
    } else {
      res.json(images)
    }
  })

  router.get('/:imageId', (req, res) => {
    const image = images.find(i => i.id === req.params.imageId)
    if (!image) {
      res.status(404).json({ error: 'Image not found' })
      return
    }
    res.json(image)
  })

  // ADR-056: Image metadata creation
  router.post('/', requireApiKey, (req, res) => {
    const result = ImageCreateSchema.safeParse(req.body)
    if (!result.success) {
      res.status(422).json({ error: 'Validation failed', details: result.error.issues })
      return
    }
    if (images.some(i => i.id === result.data.id)) {
      res.status(409).json({ error: `Image ID '${result.data.id}' already exists` })
      return
    }
    const entry: ImageEntry = {
      ...result.data,
      width: null,
      height: null,
      size_bytes: null,
    }
    images.push(entry)
    saveImageRegistry(registryDir, images)
    res.status(201).json(entry)
  })

  router.put('/:imageId', requireApiKey, (req, res) => {
    const idx = images.findIndex(i => i.id === req.params.imageId)
    if (idx === -1) {
      res.status(404).json({ error: 'Image not found' })
      return
    }
    const result = ImageUpdateSchema.safeParse(req.body)
    if (!result.success) {
      res.status(422).json({ error: 'Validation failed', details: result.error.issues })
      return
    }
    const updated = { ...images[idx], ...result.data }
    const validate = ImageSchema.safeParse(updated)
    if (!validate.success) {
      res.status(422).json({ error: 'Invalid data after merge', details: validate.error.issues })
      return
    }
    images[idx] = validate.data
    saveImageRegistry(registryDir, images)
    res.json(images[idx])
  })

  router.delete('/:imageId', requireApiKey, (req, res) => {
    const idx = images.findIndex(i => i.id === req.params.imageId)
    if (idx === -1) {
      res.status(404).json({ error: 'Image not found' })
      return
    }
    images.splice(idx, 1)
    saveImageRegistry(registryDir, images)
    res.status(204).end()
  })

  return router
}
