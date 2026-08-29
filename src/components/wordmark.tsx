import { cn } from '@/lib/utils'

/**
 * The mark: a wandering path that crosses three waypoints.
 *
 * An amble is an unhurried walk with no particular destination, which is
 * exactly how this catalogue is meant to be used — so the mark is a route
 * rather than a building, and it deliberately does not travel in a straight
 * line.
 */
export function WebAmbleGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={cn('h-5 w-5', className)} aria-hidden="true">
      <path
        d="M2 18c3.5 0 3.5-5 7-5s3.5-6 7-6c2 0 3 1 6 1"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="2" cy="18" r="1.9" fill="currentColor" />
      <circle cx="12" cy="12" r="1.6" fill="currentColor" opacity="0.55" />
      <circle cx="22" cy="8" r="1.9" fill="currentColor" />
    </svg>
  )
}

export function Wordmark({ className, compact }: { className?: string; compact?: boolean }) {
  return (
    <span className={cn('inline-flex items-center gap-2 text-ink', className)}>
      <WebAmbleGlyph />
      {!compact && (
        <span className="font-display text-xl leading-none tracking-[-0.01em]">web-amble</span>
      )}
    </span>
  )
}
