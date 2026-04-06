import * as React from 'react'
import { cn } from '@/lib/utils'

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  options: { value: string; label: string }[]
}

const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, id, options, ...props }, ref) => (
    <div className="space-y-1">
      {label && (
        <label htmlFor={id} className="block text-ui-sm font-ui text-faded">
          {label}
        </label>
      )}
      <select
        id={id}
        ref={ref}
        className={cn(
          'w-full px-3 py-2 text-sm font-ui',
          'bg-cream border border-faded/30 rounded-md',
          'text-ink',
          'focus:outline-none focus:ring-2 focus:ring-wax-red/30 focus:border-wax-red/50',
          className
        )}
        {...props}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  )
)
Select.displayName = 'Select'

export { Select }
