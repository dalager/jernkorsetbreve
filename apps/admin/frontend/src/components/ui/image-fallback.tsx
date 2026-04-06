import { useState } from 'react'
import { cn } from '@/lib/utils'

interface ImageWithFallbackProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  fallbackText?: string
}

export function ImageWithFallback({ src, alt, fallbackText, className, ...props }: ImageWithFallbackProps) {
  const [failed, setFailed] = useState(false)

  if (failed || !src) {
    return (
      <div
        className={cn('bg-parchment flex items-center justify-center text-faded text-xs font-ui', className)}
        title={alt}
      >
        {fallbackText || alt || '?'}
      </div>
    )
  }

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      onError={() => setFailed(true)}
      {...props}
    />
  )
}
