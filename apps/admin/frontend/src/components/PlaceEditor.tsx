import { useEffect, useState, useRef } from 'react'
import { useParams, Link } from 'react-router'
import { apiGet, apiPut } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useUnsavedChanges } from '@/lib/hooks'

interface PlaceEnriched {
  wikidata_id?: string
  wikipedia_url?: string
  wikipedia_da_url?: string
  modern_name?: string
  country?: string
  match_method?: string
  match_distance_km?: number
}

export default function PlaceEditor() {
  const { name } = useParams<{ name: string }>()
  const placeName = name ? decodeURIComponent(name) : ''
  const [place, setPlace] = useState<PlaceEnriched>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isNew, setIsNew] = useState(false)
  const [dirty, setDirty] = useState(false)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  // ADR-055: Unsaved changes guard
  useUnsavedChanges(dirty)

  useEffect(() => {
    if (!placeName) return
    setLoading(true)
    apiGet<PlaceEnriched>(`/places-enriched/${encodeURIComponent(placeName)}`)
      .then(setPlace)
      .catch(() => {
        setPlace({})
        setIsNew(true)
      })
      .finally(() => setLoading(false))
  }, [placeName])

  const update = (field: keyof PlaceEnriched, value: unknown) => {
    setPlace({ ...place, [field]: value })
    setSaved(false)
    setDirty(true)
  }

  // ADR-055: Save with auto-clearing feedback
  const save = async () => {
    setSaving(true)
    setError(null)
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    try {
      await apiPut(`/places-enriched/${encodeURIComponent(placeName)}`, place)
      setSaved(true)
      setIsNew(false)
      setDirty(false)
      saveTimerRef.current = setTimeout(() => setSaved(false), 3000)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Ukendt fejl')
    } finally {
      setSaving(false)
    }
  }

  useEffect(() => {
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current) }
  }, [])

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        <Skeleton className="h-8 w-64 mb-6" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <Link to="/steder" className="text-wax-red font-ui text-sm hover:underline">
            &larr; Tilbage til steder
          </Link>
          <h1 className="font-display text-display-md text-ink mt-1">
            {placeName}
          </h1>
          {isNew && (
            <p className="text-ui-sm text-faded font-ui">
              Ingen berigelsesdata endnu — udfyld og gem for at oprette.
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          {saved && <span className="text-sm font-ui text-green-700">Gemt</span>}
          {error && <span className="text-sm font-ui text-wax-red">{error}</span>}
          <Button onClick={save} disabled={saving}>
            {saving ? 'Gemmer...' : 'Gem'}
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Berigelsesdata</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Input
            id="modern_name"
            label="Moderne navn"
            value={place.modern_name || ''}
            onChange={(e) => update('modern_name', e.target.value)}
          />
          <Input
            id="country"
            label="Land"
            value={place.country || ''}
            onChange={(e) => update('country', e.target.value)}
          />
          <Input
            id="wikidata_id"
            label="Wikidata ID"
            value={place.wikidata_id || ''}
            onChange={(e) => update('wikidata_id', e.target.value)}
            placeholder="f.eks. Q12345"
          />
          <Input
            id="wikipedia_url"
            label="Wikipedia (engelsk)"
            value={place.wikipedia_url || ''}
            onChange={(e) => update('wikipedia_url', e.target.value)}
            placeholder="https://en.wikipedia.org/wiki/..."
          />
          <Input
            id="wikipedia_da_url"
            label="Wikipedia (dansk)"
            value={place.wikipedia_da_url || ''}
            onChange={(e) => update('wikipedia_da_url', e.target.value)}
            placeholder="https://da.wikipedia.org/wiki/..."
          />
          {place.match_method && (
            <div className="sm:col-span-2 text-ui-sm text-faded font-ui">
              Match: {place.match_method}
              {place.match_distance_km !== undefined && ` (${place.match_distance_km} km)`}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
