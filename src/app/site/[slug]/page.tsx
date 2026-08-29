import { Suspense } from 'react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { after } from 'next/server'
import { ArrowUpRight, Globe, Layers, ShieldCheck, Sparkles } from 'lucide-react'
import { env } from '@/lib/env'
import { getCurrentUser } from '@/lib/session'
import { getSiteBySlug, recordView, relatedSites, bestOfCategory } from '@/lib/queries/sites'
import { collectionsContaining } from '@/lib/queries/collections'
import { ShelfSkeleton } from '@/components/skeletons'
import type { Site } from '@/lib/types'
import { ATTRIBUTE_DEFS } from '@/lib/taxonomy'
import { displayUrl } from '@/lib/url'
import { formatDate, formatNumber } from '@/lib/utils'
import { SiteCover } from '@/components/site/cover'
import { SiteMark } from '@/components/site/favicon'
import { ReportButton, SaveButton, ShareButton, VisitLink, VoteButton } from '@/components/site/actions'
import { AddToCollection } from '@/components/site/add-to-collection'
import { SiteCard } from '@/components/site/site-card'
import { Shelf } from '@/components/shelf'
import { Badge, SectionHeader } from '@/components/ui/primitives'
import { RelativeTime } from '@/components/relative-time'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const site = await getSiteBySlug(slug)
  if (!site) return { title: 'Site not found' }

  const description = site.tagline || site.description || `${site.title} — catalogued on web-amble.`
  return {
    title: site.title,
    description,
    alternates: { canonical: `/site/${site.slug}` },
    openGraph: {
      title: `${site.title} · web-amble`,
      description,
      url: `${env.siteUrl}/site/${site.slug}`,
      type: 'article',
      // No `images` here on purpose: opengraph-image.tsx generates a branded PNG
      // card for this route. Pointing at the listed site's own og:image instead
      // would be a webp many social platforms refuse to render, would be missing
      // entirely for the many sites that publish none, and would drop the
      // category and tagline that make a shared link legible.
    },
    robots: site.status === 'approved' ? { index: true, follow: true } : { index: false, follow: false },
  }
}

export default async function SitePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const user = await getCurrentUser()
  const site = await getSiteBySlug(slug, user?.id)

  if (!site) notFound()
  if (site.status !== 'approved' && user?.role !== 'admin') notFound()

  // Counted after the response is sent. A Suspense boundary that renders
  // nothing is not a real boundary — it left an empty one behind that broke
  // hydration for the whole page — and analytics has no business being in the
  // render tree at all.
  after(async () => {
    try {
      await recordView(site.id)
    } catch {
      /* view counting must never break the page */
    }
  })

  const activeAttributes = ATTRIBUTE_DEFS.filter((attr) => site.attributes[attr.key])

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: site.title,
    url: site.url,
    description: site.tagline || site.description,
    inLanguage: site.lang,
  }

  return (
    <>
      {/* Structured data. React 19 logs a notice about script tags inside
          components; it is harmless here because JSON-LD is data a crawler
          reads out of the HTML, never something the browser executes. */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />


      {site.status !== 'approved' && (
        <div className="border-b border-warning/30 bg-warning/10">
          <div className="shell py-2.5 text-sm text-warning">
            Admin preview — this site is <strong>{site.status}</strong> and is not publicly visible.
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------ hero -- */}
      <div className="relative">
        <div className="absolute inset-0 h-72 overflow-hidden">
          <div className="h-full w-full scale-110 opacity-30 blur-2xl">
            <SiteCover thumbKey={site.thumb_key} seed={site.url} hue={site.accent_hue} title={site.title} />
          </div>
          <div className="absolute inset-0 bg-gradient-to-b from-canvas/40 via-canvas/80 to-canvas" />
        </div>

        <div className="shell relative pt-10 sm:pt-14">
          <nav className="mb-6 flex items-center gap-2 font-mono text-2xs uppercase tracking-[0.12em] text-faint">
            <Link href="/browse" className="no-underline transition-colors hover:text-ink">
              Catalogue
            </Link>
            {site.category && (
              <>
                <span>/</span>
                <Link href={`/category/${site.category.slug}`} className="no-underline transition-colors hover:text-ink">
                  {site.category.name}
                </Link>
              </>
            )}
          </nav>

          <div className="grid gap-8 lg:grid-cols-[1.4fr_1fr] lg:items-start">
            {/* left: identity */}
            <div>
              <div className="flex items-start gap-4">
                <SiteMark site={site} size={56} className="rounded-xl" />
                <div className="min-w-0">
                  <h1 className="font-display text-display-sm leading-[1.05]">{site.title}</h1>
                  <a
                    href={`/go/${site.slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1.5 inline-flex items-center gap-1.5 font-mono text-sm text-muted no-underline transition-colors hover:text-ink"
                  >
                    <Globe className="h-3.5 w-3.5" />
                    {displayUrl(site.url, 52)}
                    <ArrowUpRight className="h-3 w-3" />
                  </a>
                </div>
              </div>

              <p className="mt-6 max-w-prose text-lg leading-relaxed text-ink-soft">
                {site.tagline || site.description}
              </p>

              {site.description && site.description !== site.tagline && (
                <p className="mt-4 max-w-prose text-[0.95rem] leading-relaxed text-muted">{site.description}</p>
              )}

              {site.editor_note && (
                <blockquote className="mt-6 max-w-prose rounded-xl border-l-2 border-accent/50 bg-raised px-4 py-3">
                  <p className="eyebrow mb-1.5 flex items-center gap-1.5">
                    <Sparkles className="h-3 w-3" />
                    Editor’s note
                  </p>
                  <p className="text-sm leading-relaxed text-ink-soft">{site.editor_note}</p>
                </blockquote>
              )}

              {/* actions */}
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <VisitLink slug={site.slug} url={site.url}>
                  Visit {site.domain}
                  <ArrowUpRight className="h-4 w-4" />
                </VisitLink>
                <VoteButton
                  slug={site.slug}
                  votes={site.votes}
                  voted={site.viewerVoted}
                  signedIn={Boolean(user)}
                />
                <SaveButton slug={site.slug} saved={site.viewerSaved} signedIn={Boolean(user)} variant="full" />
                <AddToCollection slug={site.slug} signedIn={Boolean(user)} />
                <ShareButton url={`${env.siteUrl}/site/${site.slug}`} title={site.title} />
              </div>

              {/* tags */}
              <div className="mt-7 flex flex-wrap items-center gap-1.5">
                {site.category && (
                  <Link
                    href={`/category/${site.category.slug}`}
                    className="rounded-full border border-line bg-surface px-3 py-1.5 font-mono text-2xs uppercase tracking-[0.1em] text-muted no-underline transition-colors hover:border-line-strong hover:text-ink"
                  >
                    {site.category.name}
                  </Link>
                )}
                {site.tags.map((tag) => (
                  <Link
                    key={tag.id}
                    href={`/tag/${tag.slug}`}
                    className="rounded-full border border-line px-3 py-1.5 font-mono text-2xs text-faint no-underline transition-colors hover:border-line-strong hover:text-ink"
                  >
                    #{tag.name}
                  </Link>
                ))}
              </div>
            </div>

            {/* right: the cover */}
            <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
              <div className="relative aspect-[16/10]">
                <SiteCover
                  thumbKey={site.thumb_key}
                  seed={site.url}
                  hue={site.accent_hue}
                  title={site.title}
                  priority
                />
              </div>
              <p className="border-t border-line px-4 py-2.5 font-mono text-2xs text-faint">
                {site.thumb_source === 'og'
                  ? 'Cover image published by the site'
                  : site.thumb_source === 'screenshot'
                    ? 'Screenshot captured by AmbleBot'
                    : 'Generated artwork — this site publishes no cover image'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* --------------------------------------------------------- details -- */}
      <div className="shell mt-14">
        <div className="grid gap-10 lg:grid-cols-[1.4fr_1fr] lg:items-start">
          <div className="space-y-10">
            {activeAttributes.length > 0 && (
              <section>
                <h2 className="eyebrow mb-3 flex items-center gap-1.5">
                  <ShieldCheck className="h-3 w-3" />
                  What to expect
                </h2>
                <div className="grid gap-2 sm:grid-cols-2">
                  {activeAttributes.map((attr) => (
                    <div key={attr.key} className="rounded-xl border border-line bg-surface px-3.5 py-3">
                      <p className="text-sm font-medium">{attr.label}</p>
                      <p className="mt-0.5 text-xs text-muted">{attr.hint}</p>
                    </div>
                  ))}
                </div>
                <p className="mt-3 text-xs leading-relaxed text-faint">
                  These are detected automatically when we crawl the page, so treat them as a strong hint rather
                  than a guarantee.
                </p>
              </section>
            )}

            <Suspense fallback={null}>
              <AppearsIn siteId={site.id} />
            </Suspense>
          </div>

          {/* fact panel */}
          <aside className="rounded-2xl border border-line bg-surface p-5">
            <h2 className="eyebrow mb-4">Catalogue record</h2>
            <dl className="space-y-3 text-sm">
              <Row label="Added">{formatDate(site.published_at ?? site.created_at)}</Row>
              <Row label="Last checked">{site.checked_at ? <RelativeTime value={site.checked_at} /> : 'not yet'}</Row>
              <Row label="Upvotes">{formatNumber(site.votes)}</Row>
              <Row label="Visits from here">{formatNumber(site.clicks)}</Row>
              <Row label="Language">{site.lang.toUpperCase()}</Row>
              <Row label="Found via">
                <span className="capitalize">{site.source.replace(/[-_]/g, ' ')}</span>
              </Row>
              <Row label="Page score">
                <span className="inline-flex items-center gap-2">
                  <span className="h-1.5 w-16 overflow-hidden rounded-full bg-line">
                    <span
                      className="block h-full rounded-full"
                      style={{
                        width: `${Math.round(site.quality * 100)}%`,
                        background: `hsl(${site.accent_hue} 60% 55%)`,
                      }}
                    />
                  </span>
                  <span className="font-mono text-xs">{site.quality.toFixed(2)}</span>
                </span>
              </Row>
              {site.http_status ? (
                <Row label="Last response">
                  <Badge tone={site.http_status < 400 ? 'positive' : 'danger'}>HTTP {site.http_status}</Badge>
                </Row>
              ) : null}
            </dl>

            <p className="mt-4 text-xs leading-relaxed text-faint">
              The page score is what the crawler made of the page it fetched — enough to read or use, links out
              to the rest of the web, not a parked domain or a sales funnel. It decides whether an entry is
              listed without review and how it is ordered. It is not a verdict on whether the site is any good.
            </p>

            <div className="mt-5 border-t border-line pt-4">
              <ReportButton slug={site.slug} />
            </div>
          </aside>
        </div>
      </div>

      {/* --------------------------------------------------------- related -- */}
      <Suspense
        fallback={<ShelfSkeleton eyebrow="Because you looked at this" title="More like this" />}
      >
        <RelatedShelf site={site} signedIn={Boolean(user)} />
      </Suspense>

      {site.category && (
        <Suspense fallback={<ShelfSkeleton eyebrow="Same shelf" title={`More in ${site.category.name}`} />}>
          <SameShelf
            categorySlug={site.category.slug}
            categoryName={site.category.name}
            excludeId={site.id}
            userId={user?.id}
            signedIn={Boolean(user)}
          />
        </Suspense>
      )}
    </>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="text-muted">{label}</dt>
      <dd className="text-right text-ink-soft">{children}</dd>
    </div>
  )
}

// ------------------------------------------------------- streamed sections --
// These are secondary to the listing itself, so they resolve after the page is
// already readable rather than holding up the visit button.

async function AppearsIn({ siteId }: { siteId: number }) {
  const collections = await collectionsContaining(siteId, 4)
  if (!collections.length) return null
  return (
    <section>
      <h2 className="eyebrow mb-3 flex items-center gap-1.5">
        <Layers className="h-3 w-3" />
        Appears in
      </h2>
      <div className="grid gap-2 sm:grid-cols-2">
        {collections.map((collection) => (
          <Link
            key={collection.id}
            href={`/collections/${collection.slug}`}
            className="rounded-xl border border-line bg-surface px-3.5 py-3 no-underline transition-colors hover:border-line-strong"
          >
            <p className="text-sm font-medium">{collection.title}</p>
            <p className="mt-0.5 text-xs text-muted">{collection.subtitle}</p>
          </Link>
        ))}
      </div>
    </section>
  )
}

async function RelatedShelf({ site, signedIn }: { site: Site; signedIn: boolean }) {
  const related = await relatedSites(site, 8)
  if (!related.length) return null
  return (
    <section className="shell mt-20">
      <SectionHeader
        eyebrow="Because you looked at this"
        title="More like this"
        description="Matched on shared tags and category."
      />
      <Shelf>
        {related.map((item) => (
          <SiteCard key={item.id} site={item} signedIn={signedIn} variant="rail" />
        ))}
      </Shelf>
    </section>
  )
}

async function SameShelf({
  categorySlug,
  categoryName,
  excludeId,
  userId,
  signedIn,
}: {
  categorySlug: string
  categoryName: string
  excludeId: number
  userId?: number
  signedIn: boolean
}) {
  const sites = (await bestOfCategory(categorySlug, 8, userId)).filter((s) => s.id !== excludeId)
  if (!sites.length) return null
  return (
    <section className="shell mt-16 pb-8">
      <SectionHeader eyebrow="Same shelf" title={`More in ${categoryName}`} />
      <Shelf>
        {sites.map((item) => (
          <SiteCard key={item.id} site={item} signedIn={signedIn} variant="rail" />
        ))}
      </Shelf>
    </section>
  )
}
