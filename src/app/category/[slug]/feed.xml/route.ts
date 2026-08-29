import { feedResponse } from '@/lib/feed'
import { getCategory, listSites } from '@/lib/queries/sites'

export const dynamic = 'force-dynamic'

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const category = await getCategory(slug)
  if (!category) return new Response('Not found', { status: 404 })

  const { sites } = await listSites({ category: category.slug, sort: 'new', perPage: 50 })

  return feedResponse({
    title: category.name,
    description: category.description,
    path: `/category/${category.slug}/feed.xml`,
    sites,
  })
}
