import { timeAgo } from '@/lib/utils'

/**
 * A relative timestamp that cannot break hydration.
 *
 * "4 minutes ago" is computed from the clock, so the server and the browser can
 * legitimately disagree: the server renders at one moment and the browser
 * hydrates a second or two later, and a value near a bucket boundary flips.
 * React treats that as a mismatch and aborts hydration for the whole page —
 * which, on a page using Suspense, also strands every pending boundary because
 * React never flushes its queued reveals.
 *
 * `suppressHydrationWarning` is exactly the escape hatch for this: a text-only
 * difference that is expected and harmless. The machine-readable instant goes
 * in `dateTime`, and the exact timestamp in `title`, so nothing is lost.
 */
export function RelativeTime({
  value,
  fallback = '—',
  className,
}: {
  value: string | Date | null | undefined
  fallback?: string
  className?: string
}) {
  if (!value) return <span className={className}>{fallback}</span>

  const iso =
    value instanceof Date
      ? value.toISOString()
      : /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value)
        ? `${value.replace(' ', 'T')}Z`
        : value

  return (
    <time dateTime={iso} title={iso} className={className} suppressHydrationWarning>
      {timeAgo(value)}
    </time>
  )
}
