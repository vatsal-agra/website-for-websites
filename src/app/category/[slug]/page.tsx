import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getCurrentUser } from '@/lib/session'
import { getCategory, listCategories, listSites, tagsForCategory } from '@/lib/queries/sites'
import { CATEGORY_SEEDS } from '@/lib/taxonomy'
import { SiteGrid } from '@/components/site/site-card'
import { FilterBar, Pagination, parseQuery } from '@/components/filter-bar'
import { EmptyState, ButtonLink } from '@/components/ui/primitives'

export const dynamic = 'force-dynamic'

export async function generateStaticParams() {
  return CATEGORY_SEEDS.map((c) => ({ slug: c.slug }))
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const category = await getCategory(slug)
  if (!category) return { title: 'Category not found' }
  return {
    title: category.name,
    description: category.description,
    alternates: { canonical: `/category/${category.slug}` },
  }
}

export default async function CategoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { slug } = await params
  const category = await getCategory(slug)
  if (!category) notFound()

  const query = parseQuery(await searchParams)
  const user = await getCurrentUser()
  const base = `/category/${category.slug}`

  const result = await listSites({
    category: category.slug,
    tag: query.tag,
    sort: query.sort,
    attrs: query.attrs,
    page: query.page,
    perPage: 24,
    userId: user?.id,
    seed: Number(new Date().toISOString().slice(8, 10)) * 613 + 7,
  })

  const tags = await tagsForCategory(category.slug, 24)

  return (
    <div>
      <header className="relative overflow-hidden border-b border-line">
        <div
          className="pointer-events-none absolute -right-20 -top-32 h-96 w-96 rounded-full opacity-25 blur-3xl"
          style={{ background: `hsl(${category.hue} 80% 55%)` }}
          aria-hidden="true"
        />
        <div className="shell relative py-12 sm:py-16">
          <p className="eyebrow mb-4" style={{ color: `hsl(${category.hue} 55% 55%)` }}>
            Shelf · {(category.count ?? 0).toLocaleString()} sites
          </p>
          <h1 className="max-w-3xl font-display text-display-sm">{category.name}</h1>
          <p className="mt-2 font-display text-xl text-muted">{category.tagline}</p>
          <p className="mt-5 max-w-prose text-base leading-relaxed text-muted">{category.description}</p>
        </div>
      </header>

      <div className="shell py-8">
        <div className="mb-8">
          <FilterBar
            base={base}
            query={{ ...query, category: undefined }}
            categories={await listCategories()}
            tags={tags}
            total={result.total}
          />
        </div>

        {result.sites.length === 0 ? (
          <EmptyState
            title="Nothing on this shelf yet"
            description="Either the filters are too narrow, or we simply have not found anything for this category. Both are fixable."
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <ButtonLink href={base} variant="secondary">
                  Clear filters
                </ButtonLink>
                <ButtonLink href="/submit" variant="primary">
                  Submit a site
                </ButtonLink>
              </div>
            }
          />
        ) : (
          <>
            <SiteGrid sites={result.sites} signedIn={Boolean(user)} />
            <Pagination base={base} query={{ ...query, category: undefined }} page={result.page} pages={result.pages} />
          </>
        )}
      </div>
    </div>
  )
}
