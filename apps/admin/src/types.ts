import { z } from 'zod'

// ── Person ──────────────────────────────────────────────

export const PersonSchema = z.object({
  id: z.string(),
  canonical: z.string().min(1),
  aliases: z.array(z.string()).default([]),
  role: z.string().default(''),
  category: z.string().default('unknown'),
  letter_count: z.number().default(0),
  first_mention: z.string().nullable().default(null),
  last_mention: z.string().nullable().default(null),
  full_name: z.string().nullable().default(null),
  birth_date: z.string().nullable().default(null),
  death_date: z.string().nullable().default(null),
  biographical: z.string().nullable().default(null),
  photos: z.array(z.string()).default([]),
  enrichment_source: z.string().nullable().optional(),
})

export type Person = z.infer<typeof PersonSchema>

export const PersonCreateSchema = z.object({
  id: z.string().regex(/^[a-z0-9_-]+$/, 'ID must be lowercase alphanumeric with hyphens/underscores'),
  canonical: z.string().min(1),
  aliases: z.array(z.string()).default([]),
  role: z.string().default(''),
  category: z.string().default('unknown'),
  full_name: z.string().nullable().default(null),
  biographical: z.string().nullable().default(null),
  birth_date: z.string().nullable().default(null),
  death_date: z.string().nullable().default(null),
})

export const PersonUpdateSchema = z.object({
  canonical: z.string().min(1).optional(),
  aliases: z.array(z.string()).optional(),
  role: z.string().optional(),
  category: z.string().optional(),
  full_name: z.string().nullable().optional(),
  birth_date: z.string().nullable().optional(),
  death_date: z.string().nullable().optional(),
  biographical: z.string().nullable().optional(),
  photos: z.array(z.string()).optional(),
  enrichment_source: z.string().nullable().optional(),
})

// ── Image ───────────────────────────────────────────────

export const ImageSchema = z.object({
  id: z.string(),
  filename: z.string(),
  path: z.string(),
  category: z.string(),
  persons: z.array(z.string()),
  places: z.array(z.string()),
  date_estimate: z.string().nullable(),
  date_sort: z.string().nullable(),
  description: z.string().nullable(),
  description_da: z.string().nullable(),
  source: z.string().nullable(),
  width: z.number().nullable(),
  height: z.number().nullable(),
  size_bytes: z.number().nullable(),
})

export type ImageEntry = z.infer<typeof ImageSchema>

export const ImageCreateSchema = z.object({
  id: z.string().min(1),
  filename: z.string().min(1),
  path: z.string().min(1),
  category: z.string().default('document'),
  description_da: z.string().nullable().default(null),
  description: z.string().nullable().default(null),
  persons: z.array(z.string()).default([]),
  places: z.array(z.string()).default([]),
  date_estimate: z.string().nullable().default(null),
  date_sort: z.string().nullable().default(null),
  source: z.string().nullable().default(null),
})

export const ImageUpdateSchema = z.object({
  description: z.string().nullable().optional(),
  description_da: z.string().nullable().optional(),
  category: z.string().optional(),
  date_estimate: z.string().nullable().optional(),
  date_sort: z.string().nullable().optional(),
  persons: z.array(z.string()).optional(),
  places: z.array(z.string()).optional(),
  source: z.string().nullable().optional(),
})

// ── Place ───────────────────────────────────────────────

export const PlaceEnrichedSchema = z.object({
  wikidata_id: z.string().optional(),
  wikipedia_url: z.string().optional(),
  wikipedia_da_url: z.string().optional(),
  modern_name: z.string().optional(),
  country: z.string().optional(),
  match_method: z.string().optional(),
  match_distance_km: z.number().optional(),
})

export type PlaceEnriched = z.infer<typeof PlaceEnrichedSchema>

export const PlaceEnrichedUpdateSchema = PlaceEnrichedSchema

// ── Letter (read-only from CSV) ─────────────────────────

export interface Letter {
  id: number
  date: string
  sender: string
  recipient: string
  text: string
  place_id: number
}

export interface LetterSummary {
  id: number
  date: string
  sender: string
  recipient: string
  place_id: number
}

// ── Place CSV (read-only) ───────────────────────────────

export interface PlaceCSV {
  place_id: number
  name: string
  geometry: string | null
  country: string
}
