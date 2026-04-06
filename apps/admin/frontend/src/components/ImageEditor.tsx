import { useEffect, useState, useRef } from 'react'
import { useParams, Link, useNavigate } from 'react-router'
import { apiGet, apiPut, apiDelete } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select } from '@/components/ui/select'
import { MultiSelect } from '@/components/ui/multi-select'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ImageWithFallback } from '@/components/ui/image-fallback'
import { useUnsavedChanges } from '@/lib/hooks'

interface ImageEntry {
  id: string
  filename: string
  path: string
  category: string
  persons: string[]
  places: string[]
  date_estimate: string | null
  date_sort: string | null
  description: string | null
  description_da: string | null
  source: string | null
  width: number | null
  height: number | null
  size_bytes: number | null
}

interface PersonLookup {
  id: string
  canonical: string
}

interface PlaceLookup {
  name: string
  place_id: number | null
}

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api'

const categoryOptions = [
  { value: 'portrait', label: 'Portræt' },
  { value: 'place', label: 'Sted' },
  { value: 'document', label: 'Dokument' },
  { value: 'group', label: 'Gruppe' },
  { value: 'historical', label: 'Historisk' },
  { value: 'map', label: 'Kort' },
  { value: 'military', label: 'Militaer' },
]

export default function ImageEditor() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [image, setImage] = useState<ImageEntry | null>(null)
  const [personOptions, setPersonOptions] = useState<PersonLookup[]>([])
  const [placeOptions, setPlaceOptions] = useState<PlaceLookup[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dirty, setDirty] = useState(false)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  // ADR-055: Unsaved changes guard
  useUnsavedChanges(dirty)

  useEffect(() => {
    if (!id) return
    Promise.all([
      apiGet<ImageEntry>(`/images/${id}`),
      apiGet<PersonLookup[]>('/persons/lookup'),
      apiGet<PlaceLookup[]>('/places/lookup'),
    ])
      .then(([img, persons, places]) => {
        setImage(img)
        setPersonOptions(persons)
        setPlaceOptions(places)
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [id])

  const update = (field: keyof ImageEntry, value: unknown) => {
    if (!image) return
    setImage({ ...image, [field]: value })
    setSaved(false)
    setDirty(true)
  }

  // ADR-055: Save with auto-clearing feedback
  const save = async () => {
    if (!image || !id) return
    setSaving(true)
    setError(null)
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    try {
      await apiPut(`/images/${id}`, {
        description: image.description,
        description_da: image.description_da,
        category: image.category,
        date_estimate: image.date_estimate,
        date_sort: image.date_sort,
        persons: image.persons,
        places: image.places,
        source: image.source,
      })
      setSaved(true)
      setDirty(false)
      saveTimerRef.current = setTimeout(() => setSaved(false), 3000)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Ukendt fejl')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!id || !confirm('Er du sikker på at du vil slette dette billede fra registret?')) return
    try {
      await apiDelete(`/images/${id}`)
      navigate('/billeder')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Sletning fejlede')
    }
  }

  useEffect(() => {
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current) }
  }, [])

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        <Skeleton className="h-8 w-64 mb-6" />
        <Skeleton className="h-96 w-full" />
      </div>
    )
  }

  if (!image) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        <p className="text-faded font-ui">Billede ikke fundet.</p>
        <Link to="/billeder" className="text-wax-red font-ui text-sm hover:underline">
          Tilbage til billeder
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <Link to="/billeder" className="text-wax-red font-ui text-sm hover:underline">
            &larr; Tilbage til billeder
          </Link>
          <h1 className="font-display text-display-md text-ink mt-1">
            {image.description_da || image.filename}
          </h1>
        </div>
        <div className="flex items-center gap-3">
          {saved && <span className="text-sm font-ui text-green-700">Gemt</span>}
          {error && <span className="text-sm font-ui text-wax-red">{error}</span>}
          <Button onClick={save} disabled={saving}>
            {saving ? 'Gemmer...' : 'Gem'}
          </Button>
        </div>
      </div>

      <div className="grid gap-6">
        <Card>
          <CardContent className="p-4">
            <ImageWithFallback
              src={`${API_BASE_URL}/static/images/${image.path}`}
              alt={image.description_da || image.filename}
              fallbackText={image.filename}
              className="max-h-[500px] mx-auto rounded"
            />
            <div className="flex justify-center gap-4 mt-2 text-ui-sm text-faded font-ui">
              <span>{image.filename}</span>
              {image.width && image.height && <span>{image.width} &times; {image.height}px</span>}
              {image.size_bytes && <span>{(image.size_bytes / 1024).toFixed(0)} KB</span>}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Metadata</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Textarea
              id="description_da"
              label="Beskrivelse (dansk)"
              value={image.description_da || ''}
              onChange={(e) => update('description_da', e.target.value)}
              rows={3}
            />
            <Textarea
              id="description"
              label="Description (English)"
              value={image.description || ''}
              onChange={(e) => update('description', e.target.value)}
              rows={3}
            />
            <Select
              id="category"
              label="Kategori"
              options={categoryOptions}
              value={image.category}
              onChange={(e) => update('category', e.target.value)}
            />
            <Input
              id="date_estimate"
              label="Datering"
              value={image.date_estimate || ''}
              onChange={(e) => update('date_estimate', e.target.value)}
              placeholder="f.eks. ca. 1915"
            />
            <Input
              id="source"
              label="Kilde"
              value={image.source || ''}
              onChange={(e) => update('source', e.target.value)}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Afbildede personer</CardTitle>
          </CardHeader>
          <CardContent>
            <MultiSelect
              options={personOptions.map((p) => ({ value: p.id, label: p.canonical }))}
              selected={image.persons}
              onChange={(v) => update('persons', v)}
              placeholder="Søg person..."
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Relaterede steder</CardTitle>
          </CardHeader>
          <CardContent>
            <MultiSelect
              options={placeOptions.map((p) => ({ value: p.name, label: p.name }))}
              selected={image.places}
              onChange={(v) => update('places', v)}
              placeholder="Søg sted..."
            />
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button variant="ghost" onClick={handleDelete} className="text-wax-red hover:text-wax-red-dark">
            Slet billede fra register
          </Button>
        </div>
      </div>
    </div>
  )
}
