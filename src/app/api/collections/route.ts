import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/session'
import { LIMITS, rateLimit } from '@/lib/ratelimit'
import {
  addToCollection,
  collectionsForUser,
  createCollection,
  getCollectionById,
  isInCollection,
  removeFromCollection,
} from '@/lib/queries/collections'
import { getSiteBySlug } from '@/lib/queries/sites'
import { hueFrom } from '@/lib/utils'

export const dynamic = 'force-dynamic'

/** GET /api/collections?site=<slug> — the viewer's collections + membership. */
export async function GET(request: Request) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const siteSlug = searchParams.get('site')
  const site = siteSlug ? await getSiteBySlug(siteSlug) : null

  const collections = await Promise.all(
    (await collectionsForUser(user.id)).map(async (collection) => ({
      id: collection.id,
      slug: collection.slug,
      title: collection.title,
      count: collection.count ?? 0,
      isPublic: Boolean(collection.is_public),
      contains: site ? await isInCollection(collection.id, site.id) : false,
    })),
  )

  return NextResponse.json({ collections })
}

/**
 * POST /api/collections
 *   { action: 'toggle', collectionId, site }  — add/remove a site
 *   { action: 'create', title, site }         — create and add in one step
 */
export async function POST(request: Request) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 })

  const limit = await rateLimit('collection', String(user.id), LIMITS.collection.limit * 4, LIMITS.collection.window)
  if (!limit.ok) return NextResponse.json({ error: 'Slow down a moment.' }, { status: 429 })

  const body = await request.json().catch(() => ({}))
  const siteSlug = typeof body.site === 'string' ? body.site : ''
  const site = await getSiteBySlug(siteSlug)
  if (!site) return NextResponse.json({ error: 'Unknown site.' }, { status: 404 })

  if (body.action === 'create') {
    const title = String(body.title ?? '').trim()
    if (title.length < 3) return NextResponse.json({ error: 'Name it first.' }, { status: 400 })
    const collection = await createCollection({
      title,
      curatorId: user.id,
      isPublic: true,
      hue: hueFrom(title),
    })
    await addToCollection(collection.id, site.id)
    return NextResponse.json({
      collection: { id: collection.id, slug: collection.slug, title: collection.title, count: 1, contains: true, isPublic: true },
    })
  }

  const collection = await getCollectionById(Number(body.collectionId))
  if (!collection || collection.curator_id !== user.id) {
    return NextResponse.json({ error: 'That is not your collection.' }, { status: 403 })
  }

  if (await isInCollection(collection.id, site.id)) {
    await removeFromCollection(collection.id, site.id)
    return NextResponse.json({ contains: false })
  }
  await addToCollection(collection.id, site.id)
  return NextResponse.json({ contains: true })
}
