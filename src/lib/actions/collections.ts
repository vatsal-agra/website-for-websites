'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { audit } from '@/lib/db'
import { requireUser } from '@/lib/session'
import { LIMITS, rateLimit } from '@/lib/ratelimit'
import {
  addToCollection,
  createCollection,
  deleteCollection,
  getCollectionById,
  removeFromCollection,
  updateCollection,
} from '@/lib/queries/collections'
import { getSiteBySlug } from '@/lib/queries/sites'
import { hueFrom } from '@/lib/utils'

export interface CollectionFormState {
  error?: string
  ok?: string
}

async function ownedCollection(id: number) {
  const user = await requireUser()
  const collection = await getCollectionById(id)
  if (!collection) throw new Error('That collection no longer exists.')
  if (collection.curator_id !== user.id && user.role !== 'admin') {
    throw new Error('That is not your collection.')
  }
  return { user, collection }
}

export async function createCollectionAction(
  _prev: CollectionFormState,
  formData: FormData,
): Promise<CollectionFormState> {
  let slug = ''
  try {
    const user = await requireUser()
    const limit = await rateLimit('collection', String(user.id), LIMITS.collection.limit, LIMITS.collection.window)
    if (!limit.ok) return { error: 'You have created a lot of collections today. Try again tomorrow.' }

    const title = String(formData.get('title') ?? '').trim()
    if (title.length < 3) return { error: 'Give the collection a name of at least three characters.' }

    const collection = await createCollection({
      title,
      subtitle: String(formData.get('subtitle') ?? '').trim(),
      description: String(formData.get('description') ?? '').trim(),
      curatorId: user.id,
      isPublic: formData.get('isPublic') !== 'off',
      hue: hueFrom(title),
    })
    slug = collection.slug
    audit('collection.created', collection.slug, title, `@${user.username}`)
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Could not create that collection.' }
  }

  revalidatePath('/collections')
  redirect(`/collections/${slug}`)
}

export async function updateCollectionAction(
  _prev: CollectionFormState,
  formData: FormData,
): Promise<CollectionFormState> {
  try {
    const id = Number(formData.get('id'))
    const { collection } = await ownedCollection(id)

    const title = String(formData.get('title') ?? '').trim()
    if (title.length < 3) return { error: 'The name needs at least three characters.' }

    await updateCollection(id, {
      title: title.slice(0, 90),
      subtitle: String(formData.get('subtitle') ?? '').slice(0, 140),
      description: String(formData.get('description') ?? '').slice(0, 1200),
      is_public: formData.get('isPublic') === 'on' ? 1 : 0,
    })

    revalidatePath(`/collections/${collection.slug}`)
    revalidatePath('/collections')
    return { ok: 'Saved.' }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Could not save that.' }
  }
}

export async function deleteCollectionAction(formData: FormData) {
  const id = Number(formData.get('id'))
  const { collection, user } = await ownedCollection(id)
  await deleteCollection(id)
  audit('collection.deleted', collection.slug, collection.title, `@${user.username}`)
  revalidatePath('/collections')
  redirect(`/u/${user.username}`)
}

export async function addSiteToCollectionAction(
  _prev: CollectionFormState,
  formData: FormData,
): Promise<CollectionFormState> {
  try {
    const id = Number(formData.get('id'))
    const { collection } = await ownedCollection(id)

    const raw = String(formData.get('site') ?? '').trim()
    if (!raw) return { error: 'Paste a web-amble site link or slug.' }

    // accept a full /site/<slug> URL, a bare slug, or the site's own domain
    const slug = raw.replace(/^https?:\/\/[^/]+/, '').replace(/^\/?site\//, '').replace(/[/?#].*$/, '').trim()
    const site = await getSiteBySlug(slug)
    if (!site) {
      return { error: `No catalogued site called “${slug}”. Open the site page and copy its address.` }
    }

    await addToCollection(collection.id, site.id, String(formData.get('note') ?? '').trim())
    revalidatePath(`/collections/${collection.slug}`)
    return { ok: `Added ${site.title}.` }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Could not add that site.' }
  }
}

export async function removeSiteFromCollectionAction(formData: FormData) {
  const id = Number(formData.get('id'))
  const siteId = Number(formData.get('siteId'))
  const { collection } = await ownedCollection(id)
  await removeFromCollection(collection.id, siteId)
  revalidatePath(`/collections/${collection.slug}`)
}

/** Used by the "add to collection" popover on site pages. */
export async function toggleSiteInCollectionAction(collectionId: number, siteSlug: string) {
  const { collection } = await ownedCollection(collectionId)
  const site = await getSiteBySlug(siteSlug)
  if (!site) return { ok: false as const, error: 'Unknown site.' }

  const { isInCollection } = await import('@/lib/queries/collections')
  if (await isInCollection(collection.id, site.id)) {
    await removeFromCollection(collection.id, site.id)
    revalidatePath(`/collections/${collection.slug}`)
    return { ok: true as const, added: false }
  }
  await addToCollection(collection.id, site.id)
  revalidatePath(`/collections/${collection.slug}`)
  return { ok: true as const, added: true }
}
