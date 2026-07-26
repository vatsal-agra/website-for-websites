import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getCurrentUser } from '@/lib/session'
import { getTag, listCategories, listSites, listTags } from '@/lib/queries/sites'
import { SiteGrid } from '@/components/site/site-card'
import { FilterBar, Pagination, parseQuery } from '@/components/filter-bar'
import { ChipLink, EmptyState } from '@/components/ui/primitives'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const tag = await getTag(slug)
  if (!tag) return { title: 'Tag not found' }
  return {
    title: `#${tag.name}`,
    description: `Websites tagged “${tag.name}” in the Portico catalogue.`,
    alternates: { canonical: `/tag/${tag.slug}` },
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

  const result = await listSites({
    tag: tag.slug,
    category: query.category,
    sort: query.sort,
    attrs: query.attrs,
    page: query.page,
    perPage: 24,
    userId: user?.id,
  })

  const otherTags = (await listTags(40)).filter((t) => t.slug !== tag.slug)

  return (
    <div className="shell py-10 sm:py-14">
      <header className="mb-8">
        <p className="eyebrow mb-3">Tag</p>
        <h1 className="font-display text-display-sm">#{tag.name}</h1>
        <p className="mt-3 max-w-prose text-base leading-relaxed text-muted">
          {result.total.toLocaleString()} {result.total === 1 ? 'site carries' : 'sites carry'} this tag. Tags are
          assigned automatically from a fixed vocabulary, so they stay consistent across the catalogue.
        </p>
      </header>

      <div className="mb-8">
        <FilterBar base={base} query={{ ...query, tag: undefined }} categories={await listCategories()} total={result.total} />
      </div>

      {result.sites.length === 0 ? (
        <EmptyState title="Nothing here right now" description="Try loosening the filters." />
      ) : (
        <>
          <SiteGrid sites={result.sites} signedIn={Boolean(user)} />
          <Pagination base={base} query={{ ...query, tag: undefined }} page={result.page} pages={result.pages} />
        </>
      )}

      {otherTags.length > 0 && (
        <section className="mt-16 border-t border-line pt-8">
          <h2 className="eyebrow mb-4">Other tags</h2>
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
