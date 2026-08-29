import { Rss } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Every shelf publishes RSS. This is the visible half of that — the
 * `<link rel="alternate">` in the page metadata is what readers autodiscover,
 * but a person needs somewhere to click.
 *
 * Deliberately not a Next <Link>: the target is a feed, not a route, and
 * prefetching it would generate the XML on hover.
 */
export function FeedLink({ href, label = 'Subscribe', className }: { href: string; label?: string; className?: string }) {
  return (
    <a
      href={href}
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 rounded-full border border-line px-3 py-1.5',
        'font-mono text-2xs uppercase tracking-[0.12em] text-faint no-underline',
        'transition-colors hover:border-line-strong hover:text-ink',
        className,
      )}
      title="RSS feed for this shelf"
    >
      <Rss className="h-3 w-3" />
      {label}
    </a>
  )
}
