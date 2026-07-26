import { cn } from '@/lib/utils'
import type { Site } from '@/lib/types'

/**
 * Site mark. Uses the cached favicon when the worker managed to fetch one,
 * otherwise falls back to a tinted monogram so grids never look broken.
 */
export function SiteMark({
  site,
  size = 32,
  className,
}: {
  site: Pick<Site, 'favicon_key' | 'title' | 'accent_hue' | 'domain'>
  size?: number
  className?: string
}) {
  const letter = (site.title.replace(/[^\p{L}\p{N}]/gu, '')[0] ?? site.domain[0] ?? '?').toUpperCase()

  return (
    <span
      className={cn(
        'relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-lg border border-line bg-raised',
        className,
      )}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      {site.favicon_key ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={`/api/thumb/${site.favicon_key}`}
          alt=""
          width={size}
          height={size}
          loading="lazy"
          decoding="async"
          className="h-full w-full object-contain p-1"
        />
      ) : (
        <span
          className="font-display leading-none"
          style={{
            fontSize: size * 0.5,
            color: `hsl(${site.accent_hue} 62% 58%)`,
          }}
        >
          {letter}
        </span>
      )}
    </span>
  )
}
