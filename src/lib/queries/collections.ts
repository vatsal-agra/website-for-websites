import { all, get, run, nowIso } from '../db'
import type { Collection, PublicUser, Site } from '../types'
import { hydrate } from './sites'
import { slugify } from '../utils'

function mapCurator(row: any): PublicUser | null {
  if (!row?.curator_username) return null
  return {
    id: Number(row.curator_id),
    username: row.curator_username,
    display_name: row.curator_display_name || row.curator_username,
    bio: '',
    role: 'user',
    created_at: '',
  }
}

const BASE_SELECT = `
  SELECT c.*,
    u.username AS curator_username,
    u.display_name AS curator_display_name,
    (SELECT COUNT(*)::int FROM collection_items ci WHERE ci.collection_id = c.id) AS count
  FROM collections c
  LEFT JOIN users u ON u.id = c.curator_id
`

export async function listCollections(
  opts: { editorialOnly?: boolean; limit?: number; curatorId?: number } = {},
): Promise<Collection[]> {
  const where: string[] = []
  const params: any[] = []
  if (opts.editorialOnly) where.push('c.is_editorial = 1')
  if (opts.curatorId) {
    where.push('c.curator_id = ?')
    params.push(opts.curatorId)
  } else {
    where.push('c.is_public = 1')
  }
  const rows = await all(
    `${BASE_SELECT} ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
     ORDER BY c.is_editorial DESC, c.position ASC, c.updated_at DESC
     LIMIT ?`,
    [...params, opts.limit ?? 60],
  )
  return rows.map((r) => ({ ...r, curator: mapCurator(r) })) as Collection[]
}

export async function getCollection(slug: string): Promise<Collection | null> {
  const row = await get(`${BASE_SELECT} WHERE c.slug = ?`, [slug])
  if (!row) return null
  return { ...row, curator: mapCurator(row) } as Collection
}

export async function getCollectionById(id: number): Promise<Collection | null> {
  const row = await get(`${BASE_SELECT} WHERE c.id = ?`, [id])
  if (!row) return null
  return { ...row, curator: mapCurator(row) } as Collection
}

export async function collectionSites(collectionId: number, userId?: number | null): Promise<Site[]> {
  const viewer = userId
    ? `, EXISTS(SELECT 1 FROM votes v WHERE v.site_id = s.id AND v.user_id = ${Number(userId)}) AS viewer_voted,
        EXISTS(SELECT 1 FROM saves sv WHERE sv.site_id = s.id AND sv.user_id = ${Number(userId)}) AS viewer_saved`
    : ''
  const rows = await all(
    `SELECT s.*, ci.note AS collection_note ${viewer}
     FROM collection_items ci JOIN sites s ON s.id = ci.site_id
     WHERE ci.collection_id = ? AND s.status = 'approved'
     ORDER BY ci.position ASC, ci.created_at ASC`,
    [collectionId],
  )
  const sites = await hydrate(rows)
  return sites.map((site, i) => ({ ...site, collectionNote: rows[i].collection_note as string }))
}

export async function collectionsContaining(siteId: number, limit = 6): Promise<Collection[]> {
  const rows = await all(
    `${BASE_SELECT}
     WHERE c.is_public = 1 AND EXISTS (SELECT 1 FROM collection_items ci WHERE ci.collection_id = c.id AND ci.site_id = ?)
     ORDER BY c.is_editorial DESC, count DESC LIMIT ?`,
    [siteId, limit],
  )
  return rows.map((r) => ({ ...r, curator: mapCurator(r) })) as Collection[]
}

/** Preview thumbnails for a single collection card. */
export async function collectionPreview(collectionId: number, limit = 4): Promise<Site[]> {
  const rows = await all(
    `SELECT s.* FROM collection_items ci JOIN sites s ON s.id = ci.site_id
     WHERE ci.collection_id = ? AND s.status = 'approved'
     ORDER BY ci.position ASC LIMIT ?`,
    [collectionId, limit],
  )
  return hydrate(rows)
}

/**
 * Previews for many collections at once.
 *
 * A grid of collection cards used to call `collectionPreview` per card, so a
 * page with ten collections fired thirty queries and opened a burst of
 * connections. One windowed query plus one hydrate does the same work.
 */
export async function collectionPreviews(
  collectionIds: number[],
  limit = 4,
): Promise<Map<number, Site[]>> {
  const out = new Map<number, Site[]>()
  if (!collectionIds.length) return out

  const placeholders = collectionIds.map(() => '?').join(',')
  const rows = await all<any>(
    `SELECT * FROM (
       SELECT s.*, ci.collection_id AS __collection_id,
              row_number() OVER (PARTITION BY ci.collection_id ORDER BY ci.position ASC) AS __rn
       FROM collection_items ci
       JOIN sites s ON s.id = ci.site_id
       WHERE ci.collection_id IN (${placeholders}) AND s.status = 'approved'
     ) ranked
     WHERE __rn <= ?`,
    [...collectionIds, limit],
  )

  const sites = await hydrate(rows)
  for (const id of collectionIds) out.set(id, [])
  sites.forEach((site, i) => {
    const key = Number(rows[i].__collection_id)
    out.get(key)?.push(site)
  })
  return out
}

export async function uniqueCollectionSlug(title: string, excludeId?: number): Promise<string> {
  const root = slugify(title) || 'collection'
  let candidate = root
  let n = 1
  for (;;) {
    const row = await get<{ id: number }>('SELECT id FROM collections WHERE slug = ?', [candidate])
    if (!row || Number(row.id) === excludeId) return candidate
    n += 1
    candidate = `${root}-${n}`
    if (n > 200) return `${root}-${Date.now().toString(36)}`
  }
}

export async function createCollection(input: {
  title: string
  subtitle?: string
  description?: string
  curatorId?: number | null
  isEditorial?: boolean
  isPublic?: boolean
  hue?: number
  position?: number
  slug?: string
}): Promise<Collection> {
  const slug = input.slug ?? (await uniqueCollectionSlug(input.title))
  const row = await get<{ id: number }>(
    `INSERT INTO collections (slug, title, subtitle, description, hue, curator_id, is_editorial, is_public, position)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
    [
      slug,
      input.title.trim().slice(0, 90),
      (input.subtitle ?? '').slice(0, 140),
      (input.description ?? '').slice(0, 1200),
      input.hue ?? Math.floor(Math.random() * 360),
      input.curatorId ?? null,
      input.isEditorial ? 1 : 0,
      input.isPublic === false ? 0 : 1,
      input.position ?? 0,
    ],
  )
  return (await getCollectionById(Number(row!.id)))!
}

export async function updateCollection(id: number, patch: Record<string, unknown>): Promise<void> {
  const keys = Object.keys(patch)
  if (!keys.length) return
  await run(`UPDATE collections SET ${keys.map((k) => `${k} = ?`).join(', ')}, updated_at = ? WHERE id = ?`, [
    ...keys.map((k) => patch[k] as any),
    nowIso(),
    id,
  ])
}

export async function deleteCollection(id: number): Promise<void> {
  await run('DELETE FROM collections WHERE id = ?', [id])
}

export async function addToCollection(collectionId: number, siteId: number, note = ''): Promise<void> {
  const row = await get<{ p: number }>(
    'SELECT COALESCE(MAX(position), -1) AS p FROM collection_items WHERE collection_id = ?',
    [collectionId],
  )
  await run(
    `INSERT INTO collection_items (collection_id, site_id, note, position) VALUES (?, ?, ?, ?)
     ON CONFLICT(collection_id, site_id) DO UPDATE SET note = excluded.note`,
    [collectionId, siteId, note.slice(0, 280), Number(row?.p ?? -1) + 1],
  )
  await run('UPDATE collections SET updated_at = ? WHERE id = ?', [nowIso(), collectionId])
}

export async function removeFromCollection(collectionId: number, siteId: number): Promise<void> {
  await run('DELETE FROM collection_items WHERE collection_id = ? AND site_id = ?', [collectionId, siteId])
  await run('UPDATE collections SET updated_at = ? WHERE id = ?', [nowIso(), collectionId])
}

export async function collectionsForUser(userId: number): Promise<Collection[]> {
  return listCollections({ curatorId: userId, limit: 100 })
}

export async function isInCollection(collectionId: number, siteId: number): Promise<boolean> {
  return Boolean(
    await get('SELECT 1 AS x FROM collection_items WHERE collection_id = ? AND site_id = ?', [
      collectionId,
      siteId,
    ]),
  )
}
