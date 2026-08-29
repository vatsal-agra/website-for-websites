import Link from 'next/link'
import { ArrowUpRight, Layers } from 'lucide-react'
import type { Category, Collection, Site } from '@/lib/types'
import { cn, formatNumber, pluralize } from '@/lib/utils'
import { displayUrl } from '@/lib/url'
import { SiteCover } from './site/cover'
import { VoteButton, VisitLink } from './site/actions'
import { ButtonLink } from './ui/primitives'

// ------------------------------------------------------------- category ----

export function CategoryTile({ category, className }: { category: Category; className?: string }) {
  return (
    <Link
      href={`/category/${category.slug}`}
      className={cn(
        'group relative flex min-h-[9.5rem] flex-col justify-between overflow-hidden rounded-2xl border border-line bg-surface p-4 no-underline transition-all duration-300 hover:-translate-y-1 hover:border-line-strong hover:shadow-card',
        className,
      )}
    >
      <div
        className="pointer-events-none absolute -right-10 -top-12 h-36 w-36 rounded-full opacity-45 blur-2xl transition-all duration-500 group-hover:scale-125 group-hover:opacity-70"
        style={{ background: `hsl(${category.hue} 78% 58%)` }}
        aria-hidden="true"
      />
      <div className="relative">
        <span
          className="mb-3 block h-6 w-6 rounded-md"
          style={{
            background: `linear-gradient(135deg, hsl(${category.hue} 72% 62%), hsl(${(category.hue + 45) % 360} 68% 50%))`,
          }}
          aria-hidden="true"
        />
        <h3 className="font-display text-lg leading-tight tracking-tight">{category.name}</h3>
        <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted">{category.tagline}</p>
      </div>
      <p className="relative mt-4 font-mono text-2xs uppercase tracking-[0.12em] text-faint">
        {formatNumber(category.count ?? 0)} sites
      </p>
    </Link>
  )
}

// ----------------------------------------------------------- collection ----

export function CollectionCard({
  collection,
  preview = [],
  className,
}: {
  collection: Collection
  preview?: Site[]
  className?: string
}) {
  return (
    <Link
      href={`/collections/${collection.slug}`}
      className={cn(
        'group relative flex flex-col overflow-hidden rounded-2xl border border-line bg-surface no-underline transition-all duration-300 hover:-translate-y-1 hover:border-line-strong hover:shadow-lift',
        className,
      )}
    >
      <div className="relative grid aspect-[16/9] grid-cols-2 grid-rows-2 gap-px bg-line">
        {Array.from({ length: 4 }).map((_, i) => {
          const site = preview[i]
          return (
            <div key={i} className="relative overflow-hidden bg-canvas">
              {site ? (
                <SiteCover thumbKey={site.thumb_key} seed={site.url} hue={site.accent_hue} title={site.title} />
              ) : (
                <div
                  className="h-full w-full opacity-60"
                  style={{
                    background: `linear-gradient(${45 + i * 40}deg, hsl(${(collection.hue + i * 30) % 360} 40% 22%), hsl(${(collection.hue + i * 30 + 40) % 360} 35% 12%))`,
                  }}
                />
              )}
            </div>
          )
        })}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
        <span className="pointer-events-none absolute bottom-2.5 left-3 inline-flex items-center gap-1.5 font-mono text-2xs uppercase tracking-[0.12em] text-white/85">
          <Layers className="h-3 w-3" />
          {pluralize(collection.count ?? 0, 'site')}
        </span>
      </div>

      <div className="flex flex-1 flex-col p-4">
        <h3 className="font-display text-lg leading-tight tracking-tight">{collection.title}</h3>
        <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-muted">{collection.subtitle}</p>
        <p className="mt-auto pt-4 font-mono text-2xs uppercase tracking-[0.12em] text-faint">
          {collection.is_editorial ? 'web-amble editorial' : `by ${collection.curator?.username ?? 'a reader'}`}
        </p>
      </div>
    </Link>
  )
}

// ---------------------------------------------------------------- feature --

/** The large "site of the day" slab on the home page. */
export function FeatureCard({ site, signedIn }: { site: Site; signedIn: boolean }) {
  return (
    <article className="group relative overflow-hidden rounded-3xl border border-line bg-surface">
      <div className="grid lg:grid-cols-[1.15fr_1fr]">
        <div className="relative aspect-[16/10] overflow-hidden bg-canvas lg:aspect-auto lg:min-h-[26rem]">
          <div className="absolute inset-0 transition-transform duration-700 ease-out group-hover:scale-[1.03]">
            <SiteCover
              thumbKey={site.thumb_key}
              seed={site.url}
              hue={site.accent_hue}
              title={site.title}
              priority
            />
          </div>
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/50 to-transparent lg:bg-gradient-to-r lg:from-transparent lg:to-surface/95" />
        </div>

        <div className="relative flex flex-col justify-center gap-5 p-6 sm:p-9">
          <div>
            <p className="eyebrow" style={{ color: `hsl(${site.accent_hue} 60% 55%)` }}>
              Site of the day
            </p>
            <h2 className="mt-3 font-display text-3xl leading-[1.05] tracking-tight sm:text-4xl">
              <Link href={`/site/${site.slug}`} className="no-underline">
                {site.title}
              </Link>
            </h2>
            <p className="mt-1 font-mono text-xs text-faint">{displayUrl(site.url, 44)}</p>
          </div>

          <p className="max-w-prose text-[0.95rem] leading-relaxed text-ink-soft">
            {site.editor_note || site.tagline || site.description}
          </p>

          <div className="flex flex-wrap items-center gap-2">
            {site.category && (
              <Link
                href={`/category/${site.category.slug}`}
                className="rounded-full border border-line bg-raised px-2.5 py-1 font-mono text-2xs uppercase tracking-[0.1em] text-muted no-underline transition-colors hover:text-ink"
              >
                {site.category.name}
              </Link>
            )}
            {site.tags.slice(0, 3).map((tag) => (
              <Link
                key={tag.id}
                href={`/tag/${tag.slug}`}
                className="rounded-full border border-line px-2.5 py-1 font-mono text-2xs text-faint no-underline transition-colors hover:text-ink"
              >
                {tag.name}
              </Link>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <VisitLink slug={site.slug} url={site.url}>
              Visit site
              <ArrowUpRight className="h-4 w-4" />
            </VisitLink>
            <ButtonLink href={`/site/${site.slug}`} variant="secondary" size="lg">
              Read more
            </ButtonLink>
            <VoteButton slug={site.slug} votes={site.votes} voted={site.viewerVoted} signedIn={signedIn} />
          </div>
        </div>
      </div>
    </article>
  )
}

