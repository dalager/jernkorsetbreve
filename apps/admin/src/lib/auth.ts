import type { Request, Response, NextFunction } from 'express'

// ADR-052: Shared API key authentication
// Protects mutating endpoints (POST/PUT/DELETE) and export routes.
// If ADMIN_API_KEY is not set, all requests pass (dev mode).

export function requireApiKey(req: Request, res: Response, next: NextFunction): void {
  const configuredKey = process.env.ADMIN_API_KEY
  if (!configuredKey) {
    next()
    return
  }

  const providedKey = req.headers['x-api-key'] as string | undefined
  if (providedKey !== configuredKey) {
    res.status(401).json({ error: 'Invalid or missing API key' })
    return
  }
  next()
}
