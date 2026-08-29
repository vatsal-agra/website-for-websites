import { feedResponse } from '@/lib/feed'
import { getTag, listSites } from '@/lib/queries/sites'

export const dynamic = 'force-dynamic'

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const tag = await getTag(slug)
  if (!tag) return new Response('Not found', { status: 404 })

  const { sites } = await listSites({ tag: tag.slug, sort: 'new', perPage: 50 })

  return feedResponse({
    title: `#${tag.name}`,
    description: `Websites tagged “${tag.name}”, newest first.`,
    path: `/tag/${tag.slug}/feed.xml`,
    sites,
  })
}
