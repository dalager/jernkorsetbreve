import * as React from 'react'
import { cn } from '@/lib/utils'

interface StatisticProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string
  value?: number | string
  suffix?: string
  precision?: number
}

const Statistic = React.forwardRef<HTMLDivElement, StatisticProps>(
  ({ className, title, value, suffix, precision, ...props }, ref) => {
    const formattedValue = typeof value === 'number' && precision !== undefined
      ? value.toFixed(precision)
      : value

    return (
      <div
        ref={ref}
        className={cn('flex flex-col', className)}
        {...props}
      >
        <div className="text-sm font-ui text-faded mb-1">{title}</div>
        <div className="text-2xl font-display text-ink">
          {formattedValue}
          {suffix && <span className="text-sm text-faded ml-1">{suffix}</span>}
        </div>
      </div>
    )
  }
)
Statistic.displayName = 'Statistic'

export { Statistic }
