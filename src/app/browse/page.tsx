import { Suspense } from 'react'
import type { Metadata } from 'next'
import { SearchX } from 'lucide-react'
import { getCurrentUser } from '@/lib/session'
import { listCategories, listSites, listTags } from '@/lib/queries/sites'
import { SiteGrid } from '@/components/site/site-card'
import { ButtonLink, EmptyState } from '@/components/ui/primitives'
import type { BrowseQuery } from '@/components/filter-bar'
import { FilterBar, Pagination, ResultCount, parseQuery, SORTS } from '@/components/filter-bar'
import { CountSkeleton, GridSkeleton } from '@/components/skeletons'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Browse every site',
  description:
    'The whole web-amble catalogue. Filter by category, tag or attribute, sort by trending, newest or top rated.',
}

type Results = Awaited<ReturnType<typeof listSites>>

const GRID_COLUMNS = 'sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'

export default async function BrowsePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  const query = parseQuery(params)
  const user = await getCurrentUser()

  const [categories, tags] = await Promise.all([listCategories(), listTags(28)])
  const activeCategory = categories.find((c) => c.slug === query.category)

  // Started, deliberately not awaited: the header and filters render now, and
  // the counter and the grid below both consume this one promise as it lands.
  const results = listSites({
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
  results.catch(() => {}) // consumers below surface the failure; this only silences the bare-rejection warning

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
            : 'Everything in web-amble, filterable and sortable. Nothing here is sponsored — the order is decided by votes, clicks, quality and how recently we found it.'}
        </p>
      </header>

      <div className="sticky top-16 z-30 -mx-5 mb-8 border-b border-line bg-canvas/90 px-5 py-4 backdrop-blur-xl sm:-mx-8 sm:px-8">
        <FilterBar
          base="/browse"
          query={query}
          categories={categories}
          tags={tags}
          total={
            <Suspense fallback={<CountSkeleton width="w-16" />}>
              <ResultCount of={results} />
            </Suspense>
          }
        />
      </div>

      <Suspense key={JSON.stringify(query)} fallback={<GridSkeleton count={8} columns={GRID_COLUMNS} />}>
        <SiteResults results={results} query={query} signedIn={Boolean(user)} />
      </Suspense>
    </div>
  )
}

async function SiteResults({
  results,
  query,
  signedIn,
}: {
  results: Promise<Results>
  query: BrowseQuery
  signedIn: boolean
}) {
  const result = await results

  if (result.sites.length === 0) {
    return (
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
    )
  }

  const sortLabel = SORTS.find((s) => s.key === query.sort)?.label ?? 'Trending'

  return (
    <>
      <p className="sr-only" aria-live="polite">
        {result.total} sites, sorted by {sortLabel}, page {result.page} of {result.pages}
      </p>
      <SiteGrid sites={result.sites} signedIn={signedIn} />
      <Pagination base="/browse" query={query} page={result.page} pages={result.pages} />
    </>
  )
}
