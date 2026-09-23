import { Suspense } from 'react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { DiscoveryActions } from '@/components/discovery-actions'
import { notFound } from 'next/navigation'
import { getCurrentUser } from '@/lib/session'
import { getTag, listCategories, listSites, listTags } from '@/lib/queries/sites'
import { feedAlternate } from '@/lib/feed'
import { SiteGrid } from '@/components/site/site-card'
import type { BrowseQuery } from '@/components/filter-bar'
import { FilterBar, Pagination, ResultCount, parseQuery } from '@/components/filter-bar'
import { CountSkeleton, GridSkeleton } from '@/components/skeletons'
import { FeedLink } from '@/components/feed-link'
import { ButtonLink, ChipLink, EmptyState } from '@/components/ui/primitives'

export const dynamic = 'force-dynamic'

type Results = Awaited<ReturnType<typeof listSites>>

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const tag = await getTag(slug)
  if (!tag) return { title: 'Tag not found' }
  return {
    title: `#${tag.name}`,
    description: `Websites tagged “${tag.name}” in the web-amble catalogue.`,
    alternates: { canonical: `/tag/${tag.slug}`, types: feedAlternate(`/tag/${tag.slug}/feed.xml`) },
  }
}

export default async function TagPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { slug } = await params
  const tag = await getTag(slug)
  if (!tag) notFound()

  const query = parseQuery(await searchParams)
  const user = await getCurrentUser()
  const base = `/tag/${tag.slug}`
  const barQuery: BrowseQuery = { ...query, tag: undefined }

  const results = listSites({
    tag: tag.slug,
    category: query.category,
    sort: query.sort,
    attrs: query.attrs,
    page: query.page,
    perPage: 24,
    userId: user?.id,
  })
  results.catch(() => {})

  const [categories, otherTags] = await Promise.all([
    listCategories(),
    listTags(40).then((tags) => tags.filter((t) => t.slug !== tag.slug)),
  ])

  return (
    <div className="shell py-10 sm:py-14">
      <header className="mb-8">
        <p className="eyebrow mb-3">Tag</p>
        <h1 className="font-display text-display-sm">#{tag.name}</h1>
        <p className="mt-3 max-w-prose text-base leading-relaxed text-muted">
          Tags are assigned automatically from a fixed vocabulary, so they stay consistent across the catalogue —
          every site carrying this one is below.
        </p>
        <div className="mt-6">
          <FeedLink href={`/tag/${tag.slug}/feed.xml`} label={`Subscribe to #${tag.name}`} />
        </div>
      </header>

      <div className="mb-8">
        <FilterBar
          base={base}
          query={barQuery}
          categories={categories}
          total={
            <Suspense fallback={<CountSkeleton width="w-16" />}>
              <ResultCount of={results} />
            </Suspense>
          }
        />
      </div>

      <Suspense key={JSON.stringify(query)} fallback={<GridSkeleton count={6} />}>
        <TagResults results={results} base={base} query={barQuery} signedIn={Boolean(user)} />
      </Suspense>

      {otherTags.length > 0 && (
        <section className="mt-16 border-t border-line pt-8">
          <div className="mb-4 flex items-baseline justify-between gap-4">
            <h2 className="eyebrow">Other tags</h2>
            <Link href="/tags" className="text-sm text-muted no-underline transition-colors hover:text-ink">
              Every tag →
            </Link>
          </div>
          <div className="flex flex-wrap gap-2">
            {otherTags.slice(0, 30).map((other) => (
              <ChipLink key={other.id} href={`/tag/${other.slug}`}>
                {other.name}
              </ChipLink>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

async function TagResults({
  results,
  base,
  query,
  signedIn,
}: {
  results: Promise<Results>
  base: string
  query: BrowseQuery
  signedIn: boolean
}) {
  const result = await results
  if (result.sites.length === 0) {
    return (
      <EmptyState
        title="No sites to show for this tag"
        description="Try loosening the filters, explore another corner of the web with Shuffle, or submit a site we are missing."
        action={
          <DiscoveryActions>
            <ButtonLink href={base} variant="secondary">
              Reset filters
            </ButtonLink>
            <ButtonLink href="/tags" variant="secondary">
              Explore tags
            </ButtonLink>
          </DiscoveryActions>
        }
      />
    )
  }
  return (
    <>
      <h2 className="sr-only">{result.total} sites with this tag, page {result.page} of {result.pages}</h2>
      <SiteGrid sites={result.sites} signedIn={signedIn} />
      <Pagination base={base} query={query} page={result.page} pages={result.pages} />
    </>
  )
}
