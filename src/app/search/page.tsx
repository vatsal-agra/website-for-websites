import { Suspense } from 'react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { SearchX } from 'lucide-react'
import { getCurrentUser } from '@/lib/session'
import { listCategories, listSites, listTags } from '@/lib/queries/sites'
import { SiteGrid } from '@/components/site/site-card'
import { ButtonLink, EmptyState } from '@/components/ui/primitives'
import type { BrowseQuery } from '@/components/filter-bar'
import { FilterBar, Pagination, ResultCount, parseQuery } from '@/components/filter-bar'
import { CountSkeleton, GridSkeleton } from '@/components/skeletons'

export const dynamic = 'force-dynamic'

type Results = Awaited<ReturnType<typeof listSites>>

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}): Promise<Metadata> {
  const { q } = await searchParams
  const term = (q ?? '').trim()
  return {
    title: term ? `“${term}”` : 'Search',
    description: term
      ? `Websites in the web-amble catalogue matching “${term}”.`
      : 'Search the web-amble catalogue of websites.',
    robots: { index: false, follow: true },
  }
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  const query = parseQuery(params)
  const term = query.q ?? ''
  const user = await getCurrentUser()

  // Start the search before anything is awaited, so the round trip overlaps
  // with the category and tag lookups the filter bar needs.
  const results = term
    ? listSites({
        q: term,
        category: query.category,
        tag: query.tag,
        sort: query.sort,
        attrs: query.attrs,
        page: query.page,
        perPage: 24,
        userId: user?.id,
      })
    : null
  results?.catch(() => {})

  const [categories, tags] = await Promise.all([listCategories(), listTags(20)])

  return (
    <div className="shell py-10 sm:py-14">
      <header className="mb-8">
        <p className="eyebrow mb-3">Search</p>
        <h1 className="font-display text-display-sm">
          {term ? (
            <>
              Results for <span className="text-muted">“{term}”</span>
            </>
          ) : (
            'Search the catalogue'
          )}
        </h1>
        {!term && (
          <p className="mt-3 max-w-prose text-base leading-relaxed text-muted">
            Press <kbd className="rounded border border-line px-1.5 py-0.5 font-mono text-xs">⌘K</kbd> anywhere on
            the site to search from the keyboard.
          </p>
        )}
      </header>

      {results ? (
        <>
          <div className="mb-8">
            <FilterBar
              base="/search"
              query={query}
              categories={categories}
              tags={tags}
              total={
                <Suspense fallback={<CountSkeleton width="w-20" />}>
                  <ResultCount of={results} noun="result" />
                </Suspense>
              }
            />
          </div>

          <Suspense key={JSON.stringify(query)} fallback={<GridSkeleton count={6} />}>
            <SearchResults results={results} term={term} query={query} signedIn={Boolean(user)} />
          </Suspense>
        </>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {categories.map((category) => (
            <Link
              key={category.id}
              href={`/category/${category.slug}`}
              className="rounded-xl border border-line bg-surface px-4 py-3 no-underline transition-colors hover:border-line-strong"
            >
              <p className="text-sm font-medium">{category.name}</p>
              <p className="mt-0.5 font-mono text-2xs text-faint">{category.count ?? 0} sites</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

async function SearchResults({
  results,
  term,
  query,
  signedIn,
}: {
  results: Promise<Results>
  term: string
  query: BrowseQuery
  signedIn: boolean
}) {
  const result = await results

  if (result.sites.length === 0) {
    return (
      <EmptyState
        icon={<SearchX className="h-8 w-8" />}
        title={`Nothing matched “${term}”`}
        description="web-amble only indexes whole websites, not individual pages — so try a broader term, or tell us about the site we are missing."
        action={
          <div className="flex flex-wrap justify-center gap-2">
            <ButtonLink href={`/submit?url=${encodeURIComponent(term)}`} variant="primary">
              Submit a site
            </ButtonLink>
            <ButtonLink href="/browse" variant="secondary">
              Browse instead
            </ButtonLink>
          </div>
        }
      />
    )
  }

  return (
    <>
      <SiteGrid sites={result.sites} signedIn={signedIn} />
      <Pagination base="/search" query={query} page={result.page} pages={result.pages} />
    </>
  )
}
