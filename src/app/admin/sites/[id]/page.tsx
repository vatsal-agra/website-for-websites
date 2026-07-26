import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowUpRight } from 'lucide-react'
import { getSiteById, listCategories } from '@/lib/queries/sites'
import { displayUrl } from '@/lib/url'
import { formatDate, timeAgo } from '@/lib/utils'
import { SiteCover } from '@/components/site/cover'
import { Badge } from '@/components/ui/primitives'
import {
  approveSiteAction,
  archiveSiteAction,
  deleteSiteAction,
  featureSiteAction,
  recheckSiteAction,
  regenerateThumbAction,
  rejectSiteAction,
} from '@/lib/actions/admin'
import { SiteEditForm } from './edit-form'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const site = await getSiteById(Number(id))
  return { title: site ? `Edit ${site.title}` : 'Edit site' }
}

export default async function AdminSitePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const site = await getSiteById(Number(id))
  if (!site) notFound()

  const categories = await listCategories(false)

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <Link href="/admin/sites" className="eyebrow no-underline hover:text-ink">
            ← All sites
          </Link>
          <h2 className="mt-2 truncate font-display text-2xl">{site.title}</h2>
          <a
            href={site.url}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="mt-1 inline-flex items-center gap-1 font-mono text-xs text-muted no-underline hover:text-ink"
          >
            {displayUrl(site.url, 56)}
            <ArrowUpRight className="h-3 w-3" />
          </a>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge
            tone={
              site.status === 'approved'
                ? 'positive'
                : site.status === 'pending'
                  ? 'warning'
                  : site.status === 'rejected'
                    ? 'danger'
                    : 'neutral'
            }
          >
            {site.status}
          </Badge>
          <Badge>{site.source}</Badge>
          {site.featured_on && <Badge tone="accent">featured {site.featured_on}</Badge>}
        </div>
      </header>

      {site.reject_reason && (
        <p className="rounded-xl border border-danger/25 bg-danger/5 px-4 py-3 text-sm text-danger">
          Declined: {site.reject_reason}
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_18rem] lg:items-start">
        <SiteEditForm site={site} categories={categories} />

        <aside className="space-y-4">
          <div className="overflow-hidden rounded-2xl border border-line bg-surface">
            <div className="relative aspect-[16/10] bg-canvas">
              <SiteCover thumbKey={site.thumb_key} seed={site.url} hue={site.accent_hue} title={site.title} />
            </div>
            <div className="border-t border-line px-3 py-2 font-mono text-2xs text-faint">
              cover: {site.thumb_source}
              {site.favicon_key ? ' · icon cached' : ' · no icon'}
            </div>
          </div>

          <div className="rounded-2xl border border-line bg-surface p-4">
            <h3 className="eyebrow mb-3">Record</h3>
            <dl className="space-y-2 text-xs">
              <Row label="Slug">
                <code>{site.slug}</code>
              </Row>
              <Row label="Quality">{site.quality.toFixed(3)}</Row>
              <Row label="Trending">{site.trending.toFixed(3)}</Row>
              <Row label="Votes / clicks">{`${site.votes} / ${site.clicks}`}</Row>
              <Row label="Views">{site.views}</Row>
              <Row label="Added">{formatDate(site.created_at)}</Row>
              <Row label="Checked">{site.checked_at ? timeAgo(site.checked_at) : 'never'}</Row>
              <Row label="HTTP">{site.http_status ?? '—'}</Row>
              <Row label="Dead strikes">{site.dead_strikes}</Row>
              <Row label="Language">{site.lang}</Row>
            </dl>
          </div>

          <div className="space-y-2 rounded-2xl border border-line bg-surface p-4">
            <h3 className="eyebrow mb-1">Actions</h3>

            {site.status !== 'approved' && (
              <ActionButton action={approveSiteAction} id={site.id} tone="positive">
                Approve and publish
              </ActionButton>
            )}
            {site.status === 'approved' && (
              <>
                <ActionButton action={featureSiteAction} id={site.id}>
                  Make site of the day
                </ActionButton>
                <ActionButton action={archiveSiteAction} id={site.id}>
                  Archive
                </ActionButton>
              </>
            )}
            {site.status !== 'rejected' && (
              <ActionButton action={rejectSiteAction} id={site.id} tone="danger">
                Decline
              </ActionButton>
            )}

            <div className="border-t border-line pt-2">
              <ActionButton action={recheckSiteAction} id={site.id}>
                Re-crawl now
              </ActionButton>
              <ActionButton action={regenerateThumbAction} id={site.id}>
                Regenerate cover art
              </ActionButton>
            </div>

            <form action={deleteSiteAction} className="border-t border-line pt-3">
              <input type="hidden" name="id" value={site.id} />
              <label className="mb-2 flex items-center gap-2 text-xs text-muted">
                <input type="checkbox" name="blocklist" className="accent-current" />
                also blocklist {site.domain}
              </label>
              <button
                type="submit"
                className="w-full rounded-lg border border-danger/30 px-3 py-2 text-xs text-danger transition-colors hover:bg-danger/10"
              >
                Delete permanently
              </button>
            </form>
          </div>

          {site.status === 'approved' && (
            <Link
              href={`/site/${site.slug}`}
              className="block rounded-xl border border-line bg-surface px-4 py-2.5 text-center text-sm text-muted no-underline transition-colors hover:text-ink"
            >
              View public page →
            </Link>
          )}
        </aside>
      </div>
    </div>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-faint">{label}</dt>
      <dd className="truncate font-mono text-muted">{children}</dd>
    </div>
  )
}

function ActionButton({
  action,
  id,
  children,
  tone = 'neutral',
}: {
  action: (formData: FormData) => Promise<void>
  id: number
  children: React.ReactNode
  tone?: 'neutral' | 'positive' | 'danger'
}) {
  const tones = {
    neutral: 'border-line text-muted hover:text-ink hover:border-line-strong',
    positive: 'border-positive/30 text-positive hover:bg-positive/10',
    danger: 'border-danger/30 text-danger hover:bg-danger/10',
  }
  return (
    <form action={action}>
      <input type="hidden" name="id" value={id} />
      <button type="submit" className={`w-full rounded-lg border px-3 py-2 text-xs transition-colors ${tones[tone]}`}>
        {children}
      </button>
    </form>
  )
}
