import { cn } from '@/lib/utils'

/**
 * The mark: three columns and a lintel — a portico. It doubles as an abstract
 * "shelf of sites", which is the whole idea of the product.
 */
export function PorticoGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={cn('h-5 w-5', className)} aria-hidden="true">
      <path d="M2 7.5 12 2.5l10 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4.5 11v9M12 11v9M19.5 11v9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M2 21h20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

export function Wordmark({ className, compact }: { className?: string; compact?: boolean }) {
  return (
    <span className={cn('inline-flex items-center gap-2 text-ink', className)}>
      <PorticoGlyph />
      {!compact && (
        <span className="font-display text-xl leading-none tracking-[-0.01em]">
          Portico
        </span>
      )}
    </span>
  )
}
