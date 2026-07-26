import type { Metadata } from 'next'
import Link from 'next/link'
import { SearchX } from 'lucide-react'
import { getCurrentUser } from '@/lib/session'
import { listCategories, listSites, listTags } from '@/lib/queries/sites'
import { SiteGrid } from '@/components/site/site-card'
import { ButtonLink, EmptyState } from '@/components/ui/primitives'
import { FilterBar, Pagination, parseQuery } from '@/components/filter-bar'

export const dynamic = 'force-dynamic'

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
      ? `Websites in the Portico catalogue matching “${term}”.`
      : 'Search the Portico catalogue of websites.',
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

  const categories = await listCategories()
  const tags = await listTags(20)

  const result = term
    ? await listSites({
        q: term,
        category: query.category,
        tag: query.tag,
        sort: query.sort,
        attrs: query.attrs,
        page: query.page,
        perPage: 24,
        userId: user?.id,
      })
    : { sites: [], total: 0, page: 1, perPage: 24, pages: 0 }

  return (
    <div className="shell py-10 sm:py-14">
      <header className="mb-8">
        <p className="eyebrow mb-3">Search</p>
        <h1 className="font-display text-display-sm">
          {term ? (
            <>
              {result.total.toLocaleString()} {result.total === 1 ? 'result' : 'results'} for{' '}
              <span className="text-muted">“{term}”</span>
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

      {term && (
        <div className="mb-8">
          <FilterBar base="/search" query={query} categories={categories} tags={tags} total={result.total} />
        </div>
      )}

      {term && result.sites.length === 0 ? (
        <EmptyState
          icon={<SearchX className="h-8 w-8" />}
          title={`Nothing matched “${term}”`}
          description="Portico only indexes whole websites, not individual pages — so try a broader term, or tell us about the site we are missing."
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
      ) : term ? (
        <>
          <SiteGrid sites={result.sites} signedIn={Boolean(user)} />
          <Pagination base="/search" query={query} page={result.page} pages={result.pages} />
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
