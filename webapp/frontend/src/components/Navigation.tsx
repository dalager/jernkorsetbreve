import { useState } from 'react'
import { Link, useLocation } from 'react-router'
import { cn } from '@/lib/utils'

interface NavItem {
  label: string
  href: string
  disabled?: boolean
}

const navItems: NavItem[] = [
  { label: 'Breve', href: '/' },
  { label: 'Tidslinje', href: '/timeline', disabled: true },
  { label: 'Kort', href: '/map', disabled: true },
  { label: 'Om', href: '/about', disabled: true },
]

export default function Navigation() {
  const location = useLocation()
  const [searchQuery, setSearchQuery] = useState('')

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    // TODO: Implement full-text search
    console.log('Search query:', searchQuery)
  }

  return (
    <header className="bg-cream border-b border-faded/30 sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16">
          {/* Logo / Site Title */}
          <Link to="/" className="flex items-center gap-2 group">
            <span className="text-2xl" role="img" aria-label="Iron Cross">
              ✠
            </span>
            <div className="flex flex-col">
              <span className="font-display text-xl text-ink group-hover:text-wax-red transition-colors">
                Jernkorset
              </span>
              <span className="text-xs text-faded font-ui -mt-1 hidden sm:block">
                Breve fra Første Verdenskrig
              </span>
            </div>
          </Link>

          {/* Navigation Links */}
          <nav className="hidden md:flex items-center gap-1">
            {navItems.map((item) => (
              <Link
                key={item.href}
                to={item.disabled ? '#' : item.href}
                onClick={item.disabled ? (e) => e.preventDefault() : undefined}
                className={cn(
                  'px-3 py-2 rounded-md text-sm font-ui transition-colors',
                  location.pathname === item.href
                    ? 'bg-parchment text-ink font-medium'
                    : item.disabled
                    ? 'text-faded/50 cursor-not-allowed'
                    : 'text-faded hover:text-ink hover:bg-parchment/50'
                )}
                aria-disabled={item.disabled}
                title={item.disabled ? 'Kommer snart' : undefined}
              >
                {item.label}
                {item.disabled && (
                  <span className="ml-1 text-xs text-faded/50">(snart)</span>
                )}
              </Link>
            ))}
          </nav>

          {/* Search Field */}
          <form onSubmit={handleSearch} className="flex items-center">
            <div className="relative">
              <input
                type="search"
                placeholder="Søg i breve..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={cn(
                  'w-40 sm:w-56 px-3 py-1.5 pl-9 text-sm font-ui',
                  'bg-parchment/50 border border-faded/30 rounded-md',
                  'placeholder:text-faded/60 text-ink',
                  'focus:outline-none focus:ring-2 focus:ring-wax-red/30 focus:border-wax-red/50',
                  'transition-all duration-200'
                )}
                disabled
                title="Fuldtekstsøgning kommer snart"
              />
              <svg
                className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-faded/60"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </div>
          </form>
        </div>

        {/* Mobile Navigation */}
        <nav className="md:hidden flex items-center gap-1 pb-3 -mt-1 overflow-x-auto">
          {navItems.map((item) => (
            <Link
              key={item.href}
              to={item.disabled ? '#' : item.href}
              onClick={item.disabled ? (e) => e.preventDefault() : undefined}
              className={cn(
                'px-3 py-1.5 rounded-md text-sm font-ui whitespace-nowrap transition-colors',
                location.pathname === item.href
                  ? 'bg-parchment text-ink font-medium'
                  : item.disabled
                  ? 'text-faded/50'
                  : 'text-faded hover:text-ink'
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  )
}
