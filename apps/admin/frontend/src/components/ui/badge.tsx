import { cn } from '@/lib/utils'

interface BadgeProps {
  children: React.ReactNode
  onRemove?: () => void
  variant?: 'default' | 'muted'
  className?: string
}

export function Badge({ children, onRemove, variant = 'default', className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-ui-sm font-ui',
        variant === 'default'
          ? 'bg-parchment text-ink border border-faded/30'
          : 'bg-faded/10 text-faded',
        className
      )}
    >
      {children}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="ml-0.5 text-faded hover:text-wax-red transition-colors"
          aria-label="Fjern"
        >
          &times;
        </button>
      )}
    </span>
  )
}
