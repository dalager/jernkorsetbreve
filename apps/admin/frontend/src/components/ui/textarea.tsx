import * as React from 'react'
import { cn } from '@/lib/utils'

const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string }
>(({ className, label, id, ...props }, ref) => (
  <div className="space-y-1">
    {label && (
      <label htmlFor={id} className="block text-ui-sm font-ui text-faded">
        {label}
      </label>
    )}
    <textarea
      id={id}
      ref={ref}
      className={cn(
        'w-full px-3 py-2 text-sm font-body',
        'bg-cream border border-faded/30 rounded-md',
        'placeholder:text-faded/60 text-ink',
        'focus:outline-none focus:ring-2 focus:ring-wax-red/30 focus:border-wax-red/50',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        'min-h-24 resize-y',
        className
      )}
      {...props}
    />
  </div>
))
Textarea.displayName = 'Textarea'

export { Textarea }
