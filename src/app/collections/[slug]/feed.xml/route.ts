import { feedResponse } from '@/lib/feed'
import { collectionSites, getCollection } from '@/lib/queries/collections'

export const dynamic = 'force-dynamic'

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const collection = await getCollection(slug)
  // private collections have no public feed, and saying "not found" is the
  // honest answer to someone who cannot see it either way
  if (!collection || !collection.is_public) return new Response('Not found', { status: 404 })

  return feedResponse({
    title: collection.title,
    description: collection.description || `Sites collected under “${collection.title}”.`,
    path: `/collections/${collection.slug}/feed.xml`,
    sites: await collectionSites(collection.id),
  })
}
