import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { apiGet, apiPost } from '@/lib/api'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

interface Person {
  id: string
  canonical: string
  full_name: string | null
  role: string
  category: string
  letter_count: number
  birth_date: string | null
  death_date: string | null
}

export default function PersonList() {
  const [persons, setPersons] = useState<Person[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [newId, setNewId] = useState('')
  const [newName, setNewName] = useState('')
  const [creating, setCreating] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    apiGet<Person[]>('/persons')
      .then(setPersons)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  const filtered = persons.filter((p) => {
    const q = search.toLowerCase()
    return (
      p.canonical.toLowerCase().includes(q) ||
      (p.full_name?.toLowerCase().includes(q) ?? false) ||
      p.role.toLowerCase().includes(q)
    )
  })

  const categoryLabel: Record<string, string> = {
    family: 'Familie',
    military: 'Militær',
    community: 'Lokalsamfund',
    civilian: 'Civil',
    unknown: 'Ukendt',
  }

  // ADR-056: Create new person
  const handleCreate = async () => {
    if (!newId.trim() || !newName.trim()) return
    setCreating(true)
    try {
      const person = await apiPost<Person>('/persons', {
        id: newId.trim().toLowerCase().replace(/\s+/g, '-'),
        canonical: newName.trim(),
      })
      navigate(`/personer/${person.id}`)
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Oprettelse fejlede')
    } finally {
      setCreating(false)
    }
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
            <p className="text-wax-red font-ui mb-2">Kunne ikke hente personer</p>
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
        <h1 className="font-display text-display-md text-ink">
          Personer
        </h1>
        <div className="flex items-center gap-3">
          <span className="text-ui-sm font-ui text-faded">
            {filtered.length} af {persons.length}
          </span>
          {/* ADR-056: Create person button */}
          <Button size="sm" onClick={() => setShowCreate(!showCreate)}>
            Tilføj person
          </Button>
        </div>
      </div>

      {/* ADR-056: Create person form */}
      {showCreate && (
        <Card className="mb-4">
          <CardContent className="py-4">
            <div className="flex items-end gap-3">
              <Input
                label="ID (kebab-case)"
                placeholder="f.eks. hans-nielsen"
                value={newId}
                onChange={(e) => setNewId(e.target.value)}
              />
              <Input
                label="Navn"
                placeholder="Hans Nielsen"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              />
              <Button onClick={handleCreate} disabled={creating || !newId.trim() || !newName.trim()}>
                {creating ? 'Opretter...' : 'Opret'}
              </Button>
              <Button variant="ghost" onClick={() => setShowCreate(false)}>Annullér</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="mb-4 max-w-sm">
        <Input
          placeholder="Søg efter navn eller rolle..."
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
                <th className="text-left px-4 py-3 text-ui-sm font-ui text-faded font-medium">Rolle</th>
                <th className="text-left px-4 py-3 text-ui-sm font-ui text-faded font-medium">Kategori</th>
                <th className="text-right px-4 py-3 text-ui-sm font-ui text-faded font-medium">Breve</th>
                <th className="text-left px-4 py-3 text-ui-sm font-ui text-faded font-medium">Levetid</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr
                  key={p.id}
                  onClick={() => navigate(`/personer/${p.id}`)}
                  className="border-b border-faded/10 hover:bg-parchment/50 cursor-pointer transition-colors"
                >
                  <td className="px-4 py-3 font-body text-ink">
                    {p.full_name || p.canonical}
                  </td>
                  <td className="px-4 py-3 text-sm text-faded font-ui">
                    {p.role || '\u2014'}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="muted">
                      {categoryLabel[p.category] || p.category}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right font-ui text-sm text-ink tabular-nums">
                    {p.letter_count}
                  </td>
                  <td className="px-4 py-3 text-sm text-faded font-ui">
                    {p.birth_date && p.death_date
                      ? `${p.birth_date.slice(0, 4)}\u2013${p.death_date.slice(0, 4)}`
                      : p.birth_date
                      ? `f. ${p.birth_date.slice(0, 4)}`
                      : '\u2014'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  )
}
