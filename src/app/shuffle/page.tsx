import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowUpRight, RefreshCw } from 'lucide-react'
import { getCurrentUser } from '@/lib/session'
import { randomSite, recordView } from '@/lib/queries/sites'
import { displayUrl } from '@/lib/url'
import { SiteCover } from '@/components/site/cover'
import { SiteMark } from '@/components/site/favicon'
import { SaveButton, VisitLink, VoteButton } from '@/components/site/actions'
import { ButtonLink } from '@/components/ui/primitives'
import { ShuffleKeys } from './shuffle-keys'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Shuffle',
  description: 'One website at random from the web-amble catalogue. Press space for another.',
  robots: { index: false, follow: true },
}

/**
 * How many recent picks to remember. Carried in the URL rather than a cookie so
 * the page stays a plain server component, and capped so the link cannot grow
 * without bound on a long session.
 */
const HISTORY = 24

function parseSeen(raw: string | undefined): number[] {
  if (!raw) return []
  return raw
    .split('.')
    .map((n) => Number(n))
    .filter((n) => Number.isFinite(n) && n > 0)
    .slice(-HISTORY)
}

export default async function ShufflePage({
  searchParams,
}: {
  searchParams: Promise<{ seen?: string }>
}) {
  const { seen } = await searchParams
  const history = parseSeen(seen)
  const user = await getCurrentUser()
  const site = await randomSite(history)

  if (!site) notFound()

  const nextHref = `/shuffle?seen=${[...history, site.id].slice(-HISTORY).join('.')}`

  try {
    await recordView(site.id)
  } catch {
    /* ignore */
  }

  return (
    <div className="shell flex min-h-[calc(100dvh-4rem)] flex-col justify-center py-10">
      <ShuffleKeys nextHref={nextHref} visitHref={`/go/${site.slug}`} />

      <div className="mb-6 flex items-center justify-between">
        <p className="eyebrow">Somewhere at random</p>
        <p className="hidden font-mono text-2xs text-faint sm:block">
          <kbd className="rounded border border-line px-1.5 py-0.5">space</kbd> next ·{' '}
          <kbd className="rounded border border-line px-1.5 py-0.5">enter</kbd> visit
        </p>
      </div>

      <article className="overflow-hidden rounded-3xl border border-line bg-surface">
        <div className="relative aspect-[16/9] max-h-[26rem] overflow-hidden bg-canvas sm:aspect-[21/9]">
          <SiteCover thumbKey={site.thumb_key} seed={site.url} hue={site.accent_hue} title={site.title} priority />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
        </div>

        <div className="p-6 sm:p-9">
          <div className="flex items-start gap-4">
            <SiteMark site={site} size={48} className="rounded-xl" />
            <div className="min-w-0 flex-1">
              <h1 className="font-display text-3xl leading-tight tracking-tight sm:text-4xl">
                <Link href={`/site/${site.slug}`} className="no-underline">
                  {site.title}
                </Link>
              </h1>
              <p className="mt-1 font-mono text-sm text-faint">{displayUrl(site.url, 48)}</p>
            </div>
          </div>

          <p className="mt-5 max-w-prose text-lg leading-relaxed text-ink-soft">
            {site.tagline || site.description}
          </p>

          <div className="mt-6 flex flex-wrap items-center gap-2">
            {site.category && (
              <Link
                href={`/category/${site.category.slug}`}
                className="rounded-full border border-line bg-raised px-3 py-1.5 font-mono text-2xs uppercase tracking-[0.1em] text-muted no-underline transition-colors hover:text-ink"
              >
                {site.category.name}
              </Link>
            )}
            {site.tags.slice(0, 4).map((tag) => (
              <Link
                key={tag.id}
                href={`/tag/${tag.slug}`}
                className="rounded-full border border-line px-3 py-1.5 font-mono text-2xs text-faint no-underline transition-colors hover:text-ink"
              >
                #{tag.name}
              </Link>
            ))}
          </div>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <VisitLink slug={site.slug} url={site.url}>
              Visit {site.domain}
              <ArrowUpRight className="h-4 w-4" />
            </VisitLink>
            <ButtonLink href={nextHref} variant="secondary" size="lg">
              <RefreshCw className="h-4 w-4" />
              Somewhere else
            </ButtonLink>
            <VoteButton slug={site.slug} votes={site.votes} voted={site.viewerVoted} signedIn={Boolean(user)} />
            <SaveButton slug={site.slug} saved={site.viewerSaved} signedIn={Boolean(user)} variant="full" />
          </div>
        </div>
      </article>

      <p className="mt-6 text-center text-sm text-muted">
        Prefer to browse deliberately?{' '}
        <Link href="/browse" className="text-ink">
          Open the catalogue
        </Link>
        .
      </p>
    </div>
  )
}
