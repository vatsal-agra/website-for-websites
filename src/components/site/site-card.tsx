import Link from 'next/link'
import { ArrowUpRight, ArrowUp } from 'lucide-react'
import type { Site } from '@/lib/types'
import { cn, foreignLanguage, formatNumber } from '@/lib/utils'
import { displayUrl } from '@/lib/url'
import { SiteCover } from './cover'
import { SiteMark } from './favicon'
import { SaveButton } from './actions'
import { RelativeTime } from '@/components/relative-time'

interface SiteCardProps {
  site: Site
  signedIn?: boolean
  variant?: 'grid' | 'rail' | 'row' | 'compact'
  priority?: boolean
  className?: string
  /** show the note attached to this site inside a collection */
  note?: string
  index?: number
}

export function SiteCard({
  site,
  signedIn = false,
  variant = 'grid',
  priority,
  className,
  note,
  index,
}: SiteCardProps) {
  if (variant === 'row') return <SiteRow site={site} signedIn={signedIn} className={className} index={index} />
  if (variant === 'compact') return <SiteCompact site={site} className={className} />

  const language = foreignLanguage(site.lang)

  return (
    <article
      className={cn(
        'group relative flex flex-col overflow-hidden rounded-2xl border border-line bg-surface transition-all duration-300 ease-out',
        'hover:-translate-y-1 hover:border-line-strong hover:shadow-lift',
        variant === 'rail' && 'w-[19rem] shrink-0 sm:w-[21rem]',
        className,
      )}
    >
      {/* cover */}
      <div className="relative aspect-[16/10] overflow-hidden bg-canvas">
        <div className="absolute inset-0 transition-transform duration-500 ease-out group-hover:scale-[1.04]">
          <SiteCover
            thumbKey={site.thumb_key}
            seed={site.url}
            hue={site.accent_hue}
            title={site.title}
            priority={priority}
          />
        </div>
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent opacity-70" />

        <div className="absolute right-2.5 top-2.5 z-10 opacity-0 transition-opacity duration-200 focus-within:opacity-100 group-hover:opacity-100">
          <SaveButton slug={site.slug} saved={site.viewerSaved} signedIn={signedIn} />
        </div>

        {site.category && (
          <span className="pointer-events-none absolute bottom-2.5 left-2.5 z-10 rounded-full border border-white/15 bg-black/45 px-2.5 py-1 font-mono text-2xs uppercase tracking-[0.1em] text-white/85 backdrop-blur">
            {site.category.name}
          </span>
        )}
      </div>

      {/* body */}
      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-start gap-3">
          <SiteMark site={site} size={34} />
          <div className="min-w-0 flex-1">
            <h3 className="truncate font-medium leading-snug tracking-[-0.01em]">
              <Link href={`/site/${site.slug}`} className="no-underline after:absolute after:inset-0 after:content-['']">
                {site.title}
              </Link>
            </h3>
            <p className="mt-0.5 flex items-center gap-1.5 font-mono text-2xs lowercase tracking-normal text-faint">
              <span className="truncate">{displayUrl(site.url, 34)}</span>
              {language && (
                <span
                  className="shrink-0 rounded border border-line px-1 uppercase tracking-[0.08em]"
                  title={`This site is in ${language.name}`}
                >
                  {language.code}
                </span>
              )}
            </p>
          </div>
        </div>

        <p className="mt-3 line-clamp-2 min-h-[2.5rem] text-sm leading-relaxed text-muted">
          {note || site.tagline || site.description}
        </p>

        <div className="mt-auto flex items-center justify-between gap-3 pt-4">
          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            {site.tags.slice(0, 2).map((tag) => (
              <span key={tag.id} className="rounded-md bg-raised px-1.5 py-0.5 font-mono text-2xs text-faint">
                {tag.name}
              </span>
            ))}
          </div>
          {site.votes > 0 ? (
            <span className="flex shrink-0 items-center gap-1 font-mono text-2xs text-faint">
              <ArrowUp className="h-3 w-3" strokeWidth={2.5} />
              {formatNumber(site.votes)}
            </span>
          ) : (
            <RelativeTime value={site.published_at ?? site.created_at} className="shrink-0 font-mono text-2xs text-faint" />
          )}
        </div>
      </div>
    </article>
  )
}

/** Dense list row — used in search results, saved lists and admin tables. */
function SiteRow({
  site,
  signedIn,
  className,
  index,
}: {
  site: Site
  signedIn: boolean
  className?: string
  index?: number
}) {
  return (
    <article
      className={cn(
        'group relative flex items-center gap-4 rounded-xl border border-transparent px-3 py-3 transition-colors hover:border-line hover:bg-surface',
        className,
      )}
    >
      {index !== undefined && (
        <span className="w-6 shrink-0 text-right font-mono text-xs tabular-nums text-faint">{index + 1}</span>
      )}

      <div className="relative h-14 w-24 shrink-0 overflow-hidden rounded-lg border border-line bg-canvas">
        <SiteCover thumbKey={site.thumb_key} seed={site.url} hue={site.accent_hue} title={site.title} />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h3 className="truncate font-medium leading-snug">
            <Link href={`/site/${site.slug}`} className="no-underline after:absolute after:inset-0 after:content-['']">
              {site.title}
            </Link>
          </h3>
          {site.category && (
            <span className="hidden shrink-0 font-mono text-2xs uppercase tracking-wider text-faint sm:inline">
              {site.category.name}
            </span>
          )}
        </div>
        <p className="mt-0.5 line-clamp-1 text-sm text-muted">{site.tagline || site.description}</p>
        <p className="mt-1 font-mono text-2xs text-faint">
          {displayUrl(site.url, 40)}
          {site.votes > 0 && ` · ${formatNumber(site.votes)} votes`} · added{' '}
          <RelativeTime value={site.published_at ?? site.created_at} />
        </p>
      </div>

      <div className="relative z-10 hidden shrink-0 sm:block">
        <SaveButton slug={site.slug} saved={site.viewerSaved} signedIn={signedIn} />
      </div>
    </article>
  )
}

/** Tiny reference used in sidebars and "also in this collection" strips. */
function SiteCompact({ site, className }: { site: Site; className?: string }) {
  return (
    <Link
      href={`/site/${site.slug}`}
      className={cn(
        'group flex items-center gap-3 rounded-xl border border-line bg-surface p-2.5 no-underline transition-colors hover:border-line-strong',
        className,
      )}
    >
      <SiteMark site={site} size={36} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium leading-tight">{site.title}</p>
        <p className="mt-0.5 truncate font-mono text-2xs text-faint">{displayUrl(site.url, 28)}</p>
      </div>
      <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-faint transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-ink" />
    </Link>
  )
}

/** Responsive card grid used by browse, category and search pages. */
export function SiteGrid({
  sites,
  signedIn,
  className,
  columns = 'default',
}: {
  sites: Site[]
  signedIn?: boolean
  className?: string
  columns?: 'default' | 'wide'
}) {
  return (
    <div
      className={cn(
        'stack-fade grid gap-4',
        columns === 'wide'
          ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
          : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4',
        className,
      )}
    >
      {sites.map((site, i) => (
        <SiteCard key={site.id} site={site} signedIn={signedIn} priority={i < 4} />
      ))}
    </div>
  )
}
