import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { apiGet } from '@/lib/api'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

interface PlaceCSV {
  id: number
  name: string
  geometry: string | null
}

interface PlaceEnriched {
  modern_name?: string
  country?: string
  wikidata_id?: string
}

interface PlaceRow {
  name: string
  modern_name: string
  country: string
  wikidata_id: string
}

export default function PlaceList() {
  const [places, setPlaces] = useState<PlaceRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    Promise.all([
      apiGet<Record<string, PlaceCSV>>('/places').then((res) => {
        const items = (res as unknown as { items: Record<string, PlaceCSV> }).items
        return items
      }),
      apiGet<Record<string, PlaceEnriched>>('/places-enriched'),
    ])
      .then(([csvPlaces, enriched]) => {
        const rows: PlaceRow[] = []
        const seen = new Set<string>()

        for (const p of Object.values(csvPlaces)) {
          const name = p.name
          const e = enriched[name] || {}
          rows.push({
            name,
            modern_name: e.modern_name || '',
            country: e.country || '',
            wikidata_id: e.wikidata_id || '',
          })
          seen.add(name)
        }

        for (const [name, e] of Object.entries(enriched)) {
          if (!seen.has(name)) {
            rows.push({
              name,
              modern_name: e.modern_name || '',
              country: e.country || '',
              wikidata_id: e.wikidata_id || '',
            })
          }
        }

        rows.sort((a, b) => a.name.localeCompare(b.name, 'da'))
        setPlaces(rows)
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  const filtered = places.filter((p) => {
    const q = search.toLowerCase()
    return (
      p.name.toLowerCase().includes(q) ||
      p.modern_name.toLowerCase().includes(q) ||
      p.country.toLowerCase().includes(q)
    )
  })

  // ADR-056: Navigate to create new place (uses existing PUT create-or-update flow)
  const handleCreatePlace = () => {
    if (!newName.trim()) return
    navigate(`/steder/${encodeURIComponent(newName.trim())}`)
  }

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <Skeleton className="h-8 w-48 mb-6" />
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full mb-2" />
        ))}
      </div>
    )
  }

  // ADR-055: Error state
  if (error) {
    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-wax-red font-ui mb-2">Kunne ikke hente steder</p>
            <p className="text-faded text-sm">{error}</p>
            <Button onClick={() => location.reload()} className="mt-4">Prøv igen</Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display text-display-md text-ink">Steder</h1>
        <div className="flex items-center gap-3">
          <span className="text-ui-sm font-ui text-faded">
            {filtered.length} af {places.length}
          </span>
          {/* ADR-056: Add place button */}
          <Button size="sm" onClick={() => setShowCreate(!showCreate)}>
            Tilføj sted
          </Button>
        </div>
      </div>

      {/* ADR-056: Create place form */}
      {showCreate && (
        <Card className="mb-4">
          <CardContent className="py-4">
            <div className="flex items-end gap-3">
              <Input
                label="Stednavn"
                placeholder="f.eks. Verdun"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreatePlace()}
              />
              <Button onClick={handleCreatePlace} disabled={!newName.trim()}>
                Opret
              </Button>
              <Button variant="ghost" onClick={() => setShowCreate(false)}>Annullér</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="mb-4 max-w-sm">
        <Input
          placeholder="Søg efter stednavn..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <Card>
        <CardContent className="p-0">
          <table className="w-full">
            <thead>
              <tr className="border-b border-faded/20">
                <th className="text-left px-4 py-3 text-ui-sm font-ui text-faded font-medium">Navn</th>
                <th className="text-left px-4 py-3 text-ui-sm font-ui text-faded font-medium">Moderne navn</th>
                <th className="text-left px-4 py-3 text-ui-sm font-ui text-faded font-medium">Land</th>
                <th className="text-left px-4 py-3 text-ui-sm font-ui text-faded font-medium">Wikidata</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr
                  key={p.name}
                  onClick={() => navigate(`/steder/${encodeURIComponent(p.name)}`)}
                  className="border-b border-faded/10 hover:bg-parchment/50 cursor-pointer transition-colors"
                >
                  <td className="px-4 py-3 font-body text-ink">{p.name}</td>
                  <td className="px-4 py-3 text-sm text-faded font-ui">{p.modern_name || '\u2014'}</td>
                  <td className="px-4 py-3">
                    {p.country ? <Badge variant="muted">{p.country}</Badge> : '\u2014'}
                  </td>
                  <td className="px-4 py-3 text-sm text-faded font-ui">{p.wikidata_id || '\u2014'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  )
}
