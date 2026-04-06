import { useState, useRef, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { Badge } from './badge'

interface MultiSelectProps {
  label?: string
  options: { value: string; label: string }[]
  selected: string[]
  onChange: (selected: string[]) => void
  placeholder?: string
}

export function MultiSelect({ label, options, selected, onChange, placeholder = 'Vælg...' }: MultiSelectProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const filtered = options.filter(
    (o) =>
      !selected.includes(o.value) &&
      o.label.toLowerCase().includes(search.toLowerCase())
  )

  const toggle = (value: string) => {
    if (selected.includes(value)) {
      onChange(selected.filter((v) => v !== value))
    } else {
      onChange([...selected, value])
    }
    setSearch('')
  }

  const getLabel = (value: string) =>
    options.find((o) => o.value === value)?.label ?? value

  return (
    <div className="space-y-1" ref={ref}>
      {label && (
        <span className="block text-ui-sm font-ui text-faded">{label}</span>
      )}
      <div className="flex flex-wrap gap-1 mb-1">
        {selected.map((v) => (
          <Badge key={v} onRemove={() => toggle(v)}>
            {getLabel(v)}
          </Badge>
        ))}
      </div>
      <div className="relative">
        <input
          type="text"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          className={cn(
            'w-full px-3 py-2 text-sm font-ui',
            'bg-cream border border-faded/30 rounded-md',
            'placeholder:text-faded/60 text-ink',
            'focus:outline-none focus:ring-2 focus:ring-wax-red/30 focus:border-wax-red/50'
          )}
        />
        {open && filtered.length > 0 && (
          <ul className="absolute z-10 w-full mt-1 max-h-48 overflow-y-auto bg-cream border border-faded/30 rounded-md shadow-letter">
            {filtered.map((o) => (
              <li key={o.value}>
                <button
                  type="button"
                  onClick={() => toggle(o.value)}
                  className="w-full text-left px-3 py-1.5 text-sm font-ui text-ink hover:bg-parchment transition-colors"
                >
                  {o.label}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
