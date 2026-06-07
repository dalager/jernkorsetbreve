import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { apiGet, apiPost } from '@/lib/api'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { ImageWithFallback } from '@/components/ui/image-fallback'

interface ImageEntry {
  id: string
  filename: string
  path: string
  category: string
  persons: string[]
  places: string[]
  date_estimate: string | null
  description_da: string | null
}

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api'

const categories = [
  { value: '', label: 'Alle' },
  { value: 'portrait', label: 'Portræt' },
  { value: 'place', label: 'Sted' },
  { value: 'document', label: 'Dokument' },
  { value: 'group', label: 'Gruppe' },
  { value: 'historical', label: 'Historisk' },
  { value: 'map', label: 'Kort' },
  { value: 'military', label: 'Militaer' },
]

export default function ImageList() {
  const [images, setImages] = useState<ImageEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeCategory, setActiveCategory] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [newId, setNewId] = useState('')
  const [newFilename, setNewFilename] = useState('')
  const [newPath, setNewPath] = useState('')
  const [newCategory, setNewCategory] = useState('document')
  const [creating, setCreating] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    apiGet<ImageEntry[]>('/images')
      .then(setImages)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  const filtered = activeCategory
    ? images.filter((img) => img.category === activeCategory)
    : images

  // ADR-056: Create image metadata
  const handleCreate = async () => {
    if (!newId.trim() || !newFilename.trim() || !newPath.trim()) return
    setCreating(true)
    try {
      const img = await apiPost<ImageEntry>('/images', {
        id: newId.trim(),
        filename: newFilename.trim(),
        path: newPath.trim(),
        category: newCategory,
      })
      navigate(`/billeder/${img.id}`)
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
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <Skeleton key={i} className="aspect-square" />
          ))}
        </div>
      </div>
    )
  }

  // ADR-055: Error state
  if (error) {
    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-wax-red font-ui mb-2">Kunne ikke hente billeder</p>
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
          Billeder
        </h1>
        <div className="flex items-center gap-3">
          <span className="text-ui-sm font-ui text-faded">
            {filtered.length} af {images.length}
          </span>
          {/* ADR-056: Create image metadata button */}
          <Button size="sm" onClick={() => setShowCreate(!showCreate)}>
            Registrér billede
          </Button>
        </div>
      </div>

      {/* ADR-056: Create image form */}
      {showCreate && (
        <Card className="mb-4">
          <CardContent className="py-4">
            <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4 items-end">
              <Input label="ID" placeholder="f.eks. img_new_001" value={newId} onChange={(e) => setNewId(e.target.value)} />
              <Input label="Filnavn" placeholder="billede.png" value={newFilename} onChange={(e) => setNewFilename(e.target.value)} />
              <Input label="Sti" placeholder="portræt/billede.png" value={newPath} onChange={(e) => setNewPath(e.target.value)} />
              <Select
                id="new-category"
                label="Kategori"
                options={categories.filter(c => c.value)}
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
              />
            </div>
            <div className="flex gap-2 mt-3">
              <Button onClick={handleCreate} disabled={creating || !newId.trim() || !newFilename.trim() || !newPath.trim()}>
                {creating ? 'Opretter...' : 'Opret'}
              </Button>
              <Button variant="ghost" onClick={() => setShowCreate(false)}>Annullér</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex flex-wrap gap-1.5 mb-6">
        {categories.map((cat) => (
          <Button
            key={cat.value}
            variant={activeCategory === cat.value ? 'default' : 'secondary'}
            size="sm"
            onClick={() => setActiveCategory(cat.value)}
          >
            {cat.label}
          </Button>
        ))}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {filtered.map((img) => (
          <div
            key={img.id}
            onClick={() => navigate(`/billeder/${img.id}`)}
            className="group cursor-pointer"
          >
            <div className="aspect-square bg-parchment rounded-lg overflow-hidden shadow-letter group-hover:shadow-letter-hover transition-shadow">
              <ImageWithFallback
                src={`${API_BASE_URL}/static/images/${img.path}`}
                alt={img.description_da || img.filename}
                fallbackText={img.filename}
                className="w-full h-full object-cover"
                loading="lazy"
              />
            </div>
            <div className="mt-1.5 px-0.5">
              <p className="text-ui-sm font-ui text-ink truncate">
                {img.description_da || img.filename}
              </p>
              <div className="flex items-center gap-1 mt-0.5">
                <Badge variant="muted">{categories.find((c) => c.value === img.category)?.label || img.category}</Badge>
                {img.date_estimate && (
                  <span className="text-ui-sm text-faded">{img.date_estimate}</span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
