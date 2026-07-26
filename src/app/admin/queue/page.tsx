import Link from 'next/link'
import { ArrowUpRight, Check, Inbox } from 'lucide-react'
import { getCurrentUser } from '@/lib/session'
import { listSites } from '@/lib/queries/sites'
import { displayUrl } from '@/lib/url'
import { formatDate, timeAgo } from '@/lib/utils'
import { SiteCover } from '@/components/site/cover'
import { Badge, EmptyState } from '@/components/ui/primitives'
import { approveSiteAction, rejectSiteAction } from '@/lib/actions/admin'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Review queue' }

const REJECT_REASONS = [
  'does not meet the listing guidelines',
  'not really a website (profile / app store / link page)',
  'behind a login or paywall',
  'affiliate or SEO filler',
  'duplicate of an existing entry',
  'low quality or empty page',
]

export default async function QueuePage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>
}) {
  const { page } = await searchParams
  const user = await getCurrentUser()

  const result = await listSites({
    status: 'pending',
    sort: 'new',
    page: Math.max(1, Number(page ?? 1) || 1),
    perPage: 20,
    userId: user?.id,
  })

  return (
    <div>
      <header className="mb-6">
        <h2 className="font-display text-2xl">Review queue</h2>
        <p className="mt-1 text-sm text-muted">
          {result.total === 0
            ? 'Nothing waiting. The catalogue is up to date.'
            : `${result.total} ${result.total === 1 ? 'site is' : 'sites are'} waiting for a decision. Oldest first is usually fairest, but these are newest first so you see submissions quickly.`}
        </p>
      </header>

      {result.sites.length === 0 ? (
        <EmptyState
          icon={<Inbox className="h-8 w-8" />}
          title="Queue is empty"
          description="Discovered sites above the auto-approve threshold go live without review. Everything else lands here."
        />
      ) : (
        <div className="space-y-4">
          {result.sites.map((site) => (
            <article key={site.id} className="overflow-hidden rounded-2xl border border-line bg-surface">
              <div className="grid gap-4 sm:grid-cols-[13rem_1fr]">
                <div className="relative aspect-[16/10] bg-canvas sm:aspect-auto">
                  <SiteCover
                    thumbKey={site.thumb_key}
                    seed={site.url}
                    hue={site.accent_hue}
                    title={site.title}
                  />
                </div>

                <div className="p-4 sm:py-4 sm:pr-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="truncate font-medium">{site.title}</h3>
                      <a
                        href={site.url}
                        target="_blank"
                        rel="noopener noreferrer nofollow"
                        className="mt-0.5 inline-flex items-center gap-1 font-mono text-xs text-muted no-underline hover:text-ink"
                      >
                        {displayUrl(site.url, 46)}
                        <ArrowUpRight className="h-3 w-3" />
                      </a>
                    </div>
                    <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                      <Badge tone={site.quality >= 0.7 ? 'positive' : site.quality >= 0.5 ? 'warning' : 'danger'}>
                        q {site.quality.toFixed(2)}
                      </Badge>
                      <Badge>{site.source}</Badge>
                      {site.category && <Badge tone="accent">{site.category.name}</Badge>}
                    </div>
                  </div>

                  <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-muted">
                    {site.tagline || site.description || <em className="text-faint">no description published</em>}
                  </p>

                  {site.editor_note && (
                    <p className="mt-2 rounded-lg border-l-2 border-accent/50 bg-raised px-3 py-2 text-xs leading-relaxed text-ink-soft">
                      <span className="font-medium">Submitter’s note:</span> {site.editor_note}
                    </p>
                  )}

                  <p className="mt-3 flex flex-wrap gap-x-3 font-mono text-2xs text-faint">
                    <span>added {timeAgo(site.created_at)}</span>
                    <span>{formatDate(site.created_at)}</span>
                    <span>{site.lang.toUpperCase()}</span>
                    {site.http_status && <span>HTTP {site.http_status}</span>}
                    <span>{site.tags.map((t) => t.name).join(', ') || 'no tags'}</span>
                  </p>

                  <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-4">
                    <form action={approveSiteAction}>
                      <input type="hidden" name="id" value={site.id} />
                      <button
                        type="submit"
                        className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-positive px-3.5 text-sm font-medium text-white transition-opacity hover:opacity-90"
                      >
                        <Check className="h-3.5 w-3.5" />
                        Approve
                      </button>
                    </form>

                    <form action={rejectSiteAction} className="flex items-center gap-1.5">
                      <input type="hidden" name="id" value={site.id} />
                      <select
                        name="reason"
                        defaultValue={REJECT_REASONS[0]}
                        className="h-9 max-w-[15rem] rounded-lg border border-line bg-canvas px-2 text-xs text-muted outline-none"
                      >
                        {REJECT_REASONS.map((reason) => (
                          <option key={reason} value={reason}>
                            {reason}
                          </option>
                        ))}
                      </select>
                      <button
                        type="submit"
                        className="inline-flex h-9 items-center rounded-lg border border-danger/30 px-3 text-sm text-danger transition-colors hover:bg-danger/10"
                      >
                        Decline
                      </button>
                    </form>

                    <Link
                      href={`/admin/sites/${site.id}`}
                      className="ml-auto text-sm text-muted no-underline transition-colors hover:text-ink"
                    >
                      Edit first →
                    </Link>
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {result.pages > 1 && (
        <nav className="mt-8 flex justify-center gap-2">
          {Array.from({ length: result.pages }, (_, i) => i + 1).map((n) => (
            <Link
              key={n}
              href={`/admin/queue?page=${n}`}
              className={`flex h-9 min-w-9 items-center justify-center rounded-lg px-2 font-mono text-xs no-underline ${
                n === result.page ? 'bg-ink text-canvas' : 'text-muted hover:bg-raised'
              }`}
            >
              {n}
            </Link>
          ))}
        </nav>
      )}
    </div>
  )
}
