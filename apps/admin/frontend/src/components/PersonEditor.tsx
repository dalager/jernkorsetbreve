import { useEffect, useState, useRef } from 'react'
import { useParams, Link, useNavigate } from 'react-router'
import { apiGet, apiPut, apiDelete } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ImageWithFallback } from '@/components/ui/image-fallback'
import { useUnsavedChanges } from '@/lib/hooks'

interface Person {
  id: string
  canonical: string
  aliases: string[]
  role: string
  category: string
  letter_count: number
  first_mention: string | null
  last_mention: string | null
  full_name: string | null
  birth_date: string | null
  death_date: string | null
  biographical: string | null
  photos: string[]
  enrichment_source: string | null
}

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api'

const categoryOptions = [
  { value: 'family', label: 'Familie' },
  { value: 'military', label: 'Militær' },
  { value: 'community', label: 'Lokalsamfund' },
  { value: 'civilian', label: 'Civil' },
  { value: 'unknown', label: 'Ukendt' },
]

export default function PersonEditor() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [person, setPerson] = useState<Person | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [newAlias, setNewAlias] = useState('')
  const [dirty, setDirty] = useState(false)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  // ADR-055: Unsaved changes guard
  useUnsavedChanges(dirty)

  useEffect(() => {
    if (!id) return
    setLoading(true)
    apiGet<Person>(`/persons/${id}`)
      .then(setPerson)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [id])

  const update = (field: keyof Person, value: unknown) => {
    if (!person) return
    setPerson({ ...person, [field]: value })
    setSaved(false)
    setDirty(true)
  }

  const addAlias = () => {
    if (!person || !newAlias.trim()) return
    if (!person.aliases.includes(newAlias.trim())) {
      update('aliases', [...person.aliases, newAlias.trim()])
    }
    setNewAlias('')
  }

  const removeAlias = (alias: string) => {
    if (!person) return
    update('aliases', person.aliases.filter((a) => a !== alias))
  }

  // ADR-055: Save with auto-clearing feedback
  const save = async () => {
    if (!person || !id) return
    setSaving(true)
    setError(null)
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    try {
      const { id: _id, letter_count: _lc, first_mention: _fm, last_mention: _lm, ...body } = person
      await apiPut(`/persons/${id}`, body)
      setSaved(true)
      setDirty(false)
      saveTimerRef.current = setTimeout(() => setSaved(false), 3000)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Ukendt fejl')
    } finally {
      setSaving(false)
    }
  }

  // ADR-056: Delete person
  const handleDelete = async () => {
    if (!id || !confirm('Er du sikker? Denne person fjernes fra registret.')) return
    try {
      await apiDelete(`/persons/${id}`)
      navigate('/personer')
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

  if (!person) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        <p className="text-faded font-ui">Person ikke fundet.</p>
        <Link to="/personer" className="text-wax-red font-ui text-sm hover:underline">
          Tilbage til personer
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <Link to="/personer" className="text-wax-red font-ui text-sm hover:underline">
            &larr; Tilbage til personer
          </Link>
          <h1 className="font-display text-display-md text-ink mt-1">
            {person.full_name || person.canonical}
          </h1>
          <p className="text-faded font-ui text-sm">
            {person.letter_count} breve &middot; {person.first_mention?.slice(0, 10)} &ndash; {person.last_mention?.slice(0, 10)}
          </p>
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
          <CardHeader>
            <CardTitle>Grundoplysninger</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Input
              id="full_name"
              label="Fuldt navn"
              value={person.full_name || ''}
              onChange={(e) => update('full_name', e.target.value)}
            />
            <Input
              id="canonical"
              label="Kaldenavn (canonical)"
              value={person.canonical}
              onChange={(e) => update('canonical', e.target.value)}
            />
            <Input
              id="role"
              label="Rolle"
              value={person.role}
              onChange={(e) => update('role', e.target.value)}
            />
            <Select
              id="category"
              label="Kategori"
              options={categoryOptions}
              value={person.category}
              onChange={(e) => update('category', e.target.value)}
            />
            <Input
              id="birth_date"
              label="Fødselsdato"
              type="date"
              value={person.birth_date || ''}
              onChange={(e) => update('birth_date', e.target.value || null)}
            />
            <Input
              id="death_date"
              label="Dødsdato"
              type="date"
              value={person.death_date || ''}
              onChange={(e) => update('death_date', e.target.value || null)}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Aliasser</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-1.5 mb-3">
              {person.aliases.map((alias) => (
                <Badge key={alias} onRemove={() => removeAlias(alias)}>
                  {alias}
                </Badge>
              ))}
              {person.aliases.length === 0 && (
                <span className="text-sm text-faded font-ui">Ingen aliasser</span>
              )}
            </div>
            <div className="flex gap-2 max-w-sm">
              <Input
                placeholder="Tilføj alias..."
                value={newAlias}
                onChange={(e) => setNewAlias(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addAlias())}
              />
              <Button variant="secondary" onClick={addAlias}>
                Tilføj
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Biografi</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              id="biographical"
              value={person.biographical || ''}
              onChange={(e) => update('biographical', e.target.value)}
              rows={8}
            />
            {person.enrichment_source && (
              <p className="text-ui-sm text-faded mt-2">
                Kilde: {person.enrichment_source}
              </p>
            )}
          </CardContent>
        </Card>

        {person.photos.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Fotos ({person.photos.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                {person.photos.map((photo) => (
                  <div key={photo} className="aspect-square bg-parchment rounded overflow-hidden">
                    <ImageWithFallback
                      src={`${API_BASE_URL}/static/images/portrait/${photo}`}
                      alt={photo}
                      fallbackText={photo.replace(/\.[^.]+$/, '')}
                      className="w-full h-full object-cover"
                    />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* ADR-056: Delete person */}
        <div className="flex justify-end">
          <Button variant="ghost" onClick={handleDelete} className="text-wax-red hover:text-wax-red-dark">
            Slet person fra register
          </Button>
        </div>
      </div>
    </div>
  )
}
