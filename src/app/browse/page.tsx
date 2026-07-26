import type { Metadata } from 'next'
import { SearchX } from 'lucide-react'
import { getCurrentUser } from '@/lib/session'
import { listCategories, listSites, listTags } from '@/lib/queries/sites'
import { SiteGrid } from '@/components/site/site-card'
import { ButtonLink, EmptyState } from '@/components/ui/primitives'
import { FilterBar, Pagination, parseQuery, SORTS } from '@/components/filter-bar'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Browse every site',
  description:
    'The whole Portico catalogue. Filter by category, tag or attribute, sort by trending, newest or top rated.',
}

export default async function BrowsePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  const query = parseQuery(params)
  const user = await getCurrentUser()

  const categories = await listCategories()
  const tags = await listTags(28)

  const result = await listSites({
    q: query.q,
    category: query.category,
    tag: query.tag,
    sort: query.sort,
    attrs: query.attrs,
    page: query.page,
    perPage: 24,
    userId: user?.id,
    seed: Number(new Date().toISOString().slice(8, 10)) * 977 + 13,
  })

  const sortLabel = SORTS.find((s) => s.key === query.sort)?.label ?? 'Trending'
  const activeCategory = categories.find((c) => c.slug === query.category)

  return (
    <div className="shell py-10 sm:py-14">
      <header className="mb-8">
        <p className="eyebrow mb-3">The catalogue</p>
        <h1 className="font-display text-display-sm">
          {activeCategory ? activeCategory.name : 'Every site we know about'}
        </h1>
        <p className="mt-3 max-w-prose text-base leading-relaxed text-muted">
          {activeCategory
            ? activeCategory.description
            : 'Everything in Portico, filterable and sortable. Nothing here is sponsored — the order is decided by votes, clicks, quality and how recently we found it.'}
        </p>
      </header>

      <div className="sticky top-16 z-30 -mx-5 mb-8 border-b border-line bg-canvas/90 px-5 py-4 backdrop-blur-xl sm:-mx-8 sm:px-8">
        <FilterBar base="/browse" query={query} categories={categories} tags={tags} total={result.total} />
      </div>

      {result.sites.length === 0 ? (
        <EmptyState
          icon={<SearchX className="h-8 w-8" />}
          title="Nothing matches those filters"
          description="Try removing an attribute or picking a different category. The catalogue is big, but it is not infinite."
          action={
            <ButtonLink href="/browse" variant="secondary">
              Reset filters
            </ButtonLink>
          }
        />
      ) : (
        <>
          <p className="sr-only" aria-live="polite">
            {result.total} sites, sorted by {sortLabel}, page {result.page} of {result.pages}
          </p>
          <SiteGrid sites={result.sites} signedIn={Boolean(user)} />
          <Pagination base="/browse" query={query} page={result.page} pages={result.pages} />
        </>
      )}
    </div>
  )
}
