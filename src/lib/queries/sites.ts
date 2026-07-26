import { all, get, run, nowIso, today } from '../db'
import type { BrowseFilters, Category, Site, SiteAttributes, SiteRow, SortKey, Tag } from '../types'
import { slugify } from '../utils'

// ------------------------------------------------------------------ mapping --

function parseAttributes(raw: string): SiteAttributes {
  try {
    const parsed = JSON.parse(raw || '{}')
    return typeof parsed === 'object' && parsed ? parsed : {}
  } catch {
    return {}
  }
}

export function mapSite(row: any, extras: { category?: Category | null; tags?: Tag[] } = {}): Site {
  const { attributes, ...rest } = row as SiteRow & Record<string, unknown>
  return {
    ...(rest as unknown as Omit<SiteRow, 'attributes'>),
    attributes: parseAttributes(attributes),
    category: extras.category ?? null,
    tags: extras.tags ?? [],
    viewerVoted: Boolean((row as any).viewer_voted),
    viewerSaved: Boolean((row as any).viewer_saved),
  }
}

/** Attach categories + tags to a batch of rows in two queries. */
export async function hydrate(rows: any[]): Promise<Site[]> {
  if (!rows.length) return []
  const ids = rows.map((r) => Number(r.id))
  const placeholders = ids.map(() => '?').join(',')

  const [categoryRows, tagRows] = await Promise.all([
    all<Category>('SELECT * FROM categories'),
    all<Tag & { site_id: number }>(
      `SELECT st.site_id, t.id, t.slug, t.name, t.uses
       FROM site_tags st JOIN tags t ON t.id = st.tag_id
       WHERE st.site_id IN (${placeholders})
       ORDER BY t.uses DESC`,
      ids,
    ),
  ])

  const categories = new Map(categoryRows.map((c) => [Number(c.id), c]))
  const tagsBySite = new Map<number, Tag[]>()
  for (const { site_id, ...tag } of tagRows) {
    const list = tagsBySite.get(Number(site_id)) ?? []
    list.push(tag as Tag)
    tagsBySite.set(Number(site_id), list)
  }

  return rows.map((row) =>
    mapSite(row, {
      category: row.category_id ? categories.get(Number(row.category_id)) ?? null : null,
      tags: tagsBySite.get(Number(row.id)) ?? [],
    }),
  )
}

// ------------------------------------------------------------------- lookup --

const VIEWER_JOIN = (userId?: number | null) =>
  userId
    ? `, EXISTS(SELECT 1 FROM votes v WHERE v.site_id = s.id AND v.user_id = ${Number(userId)}) AS viewer_voted,
        EXISTS(SELECT 1 FROM saves sv WHERE sv.site_id = s.id AND sv.user_id = ${Number(userId)}) AS viewer_saved`
    : ''

export async function getSiteBySlug(slug: string, userId?: number | null): Promise<Site | null> {
  const row = await get(`SELECT s.* ${VIEWER_JOIN(userId)} FROM sites s WHERE s.slug = ?`, [slug])
  if (!row) return null
  return (await hydrate([row]))[0]
}

export async function getSiteById(id: number, userId?: number | null): Promise<Site | null> {
  const row = await get(`SELECT s.* ${VIEWER_JOIN(userId)} FROM sites s WHERE s.id = ?`, [id])
  if (!row) return null
  return (await hydrate([row]))[0]
}

export async function getSiteByDomainKey(domainKey: string): Promise<SiteRow | undefined> {
  return get<SiteRow>('SELECT * FROM sites WHERE domain_key = ?', [domainKey])
}

// -------------------------------------------------------------------- lists --

function orderClause(sort: SortKey, seed: number): string {
  switch (sort) {
    case 'new':
      return 'ORDER BY COALESCE(s.published_at, s.created_at) DESC, s.id DESC'
    case 'top':
      return 'ORDER BY s.votes DESC, s.trending DESC, s.id DESC'
    case 'alpha':
      return 'ORDER BY s.title COLLATE NOCASE ASC'
    case 'random':
      return `ORDER BY ((s.id * ${Math.max(1, Math.floor(seed))}) % 104729) ASC`
    case 'trending':
    default:
      return 'ORDER BY s.trending DESC, s.votes DESC, s.id DESC'
  }
}

export interface ListResult {
  sites: Site[]
  total: number
  page: number
  perPage: number
  pages: number
}

export async function listSites(
  filters: BrowseFilters & { status?: string; seed?: number; userId?: number | null } = {},
): Promise<ListResult> {
  const page = Math.max(1, filters.page ?? 1)
  const perPage = Math.min(60, Math.max(1, filters.perPage ?? 24))
  const sort: SortKey = filters.sort ?? 'trending'
  const seed = filters.seed ?? 7919

  const where: string[] = []
  const params: any[] = []

  where.push('s.status = ?')
  params.push(filters.status ?? 'approved')

  if (filters.category) {
    where.push('s.category_id = (SELECT id FROM categories WHERE slug = ?)')
    params.push(filters.category)
  }
  if (filters.tag) {
    where.push('EXISTS (SELECT 1 FROM site_tags st JOIN tags t ON t.id = st.tag_id WHERE st.site_id = s.id AND t.slug = ?)')
    params.push(filters.tag)
  }
  for (const attr of filters.attrs ?? []) {
    if (!/^[a-zA-Z]+$/.test(attr)) continue
    where.push(`json_extract(s.attributes, '$.${attr}') = 1`)
  }
  if (filters.q) {
    const ids = await searchIds(filters.q, 400)
    if (!ids.length) return { sites: [], total: 0, page, perPage, pages: 0 }
    where.push(`s.id IN (${ids.map(() => '?').join(',')})`)
    params.push(...ids)
  }

  const whereSql = `WHERE ${where.join(' AND ')}`
  const totalRow = await get<{ n: number }>(`SELECT COUNT(*) AS n FROM sites s ${whereSql}`, params)
  const total = Number(totalRow?.n ?? 0)

  const rows = await all(
    `SELECT s.* ${VIEWER_JOIN(filters.userId)}
     FROM sites s ${whereSql}
     ${orderClause(sort, seed)}
     LIMIT ? OFFSET ?`,
    [...params, perPage, (page - 1) * perPage],
  )

  return {
    sites: await hydrate(rows),
    total,
    page,
    perPage,
    pages: Math.max(1, Math.ceil(total / perPage)),
  }
}

// ------------------------------------------------------------------- search --

function escapeFts(query: string): string {
  const terms = query
    .toLowerCase()
    .replace(/["^*(){}[\]:]/g, ' ')
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0 && t.length < 40)
    .slice(0, 8)
  if (!terms.length) return ''
  // prefix-match the final term so search feels live as you type
  return terms.map((t, i) => (i === terms.length - 1 ? `"${t}"*` : `"${t}"`)).join(' AND ')
}

export async function searchIds(query: string, limit = 50): Promise<number[]> {
  const match = escapeFts(query)
  if (!match) return []
  try {
    const rows = await all<{ id: number }>(
      `SELECT rowid AS id, bm25(sites_fts, 8.0, 4.0, 1.0, 6.0, 3.0) AS rank
       FROM sites_fts WHERE sites_fts MATCH ?
       ORDER BY rank LIMIT ?`,
      [match, limit],
    )
    return rows.map((r) => Number(r.id))
  } catch {
    return []
  }
}

export async function searchSites(query: string, limit = 20, userId?: number | null): Promise<Site[]> {
  const ids = await searchIds(query, limit * 3)
  if (!ids.length) return []
  const placeholders = ids.map(() => '?').join(',')
  const rows = await all(
    `SELECT s.* ${VIEWER_JOIN(userId)} FROM sites s
     WHERE s.id IN (${placeholders}) AND s.status = 'approved'`,
    ids,
  )
  const order = new Map(ids.map((id, i) => [id, i]))
  rows.sort((a: any, b: any) => (order.get(Number(a.id)) ?? 0) - (order.get(Number(b.id)) ?? 0))
  return hydrate(rows.slice(0, limit))
}

export async function reindexSite(siteId: number): Promise<void> {
  const row = await get<{ title: string; tagline: string; description: string; domain: string }>(
    'SELECT title, tagline, description, domain FROM sites WHERE id = ?',
    [siteId],
  )
  await run('DELETE FROM sites_fts WHERE rowid = ?', [siteId])
  if (!row) return
  const tagRows = await all<{ name: string }>(
    'SELECT t.name FROM site_tags st JOIN tags t ON t.id = st.tag_id WHERE st.site_id = ?',
    [siteId],
  )
  await run(
    'INSERT INTO sites_fts (rowid, title, tagline, description, domain, tags) VALUES (?, ?, ?, ?, ?, ?)',
    [siteId, row.title, row.tagline, row.description, row.domain.replace(/\./g, ' '), tagRows.map((t) => t.name).join(' ')],
  )
}

export async function reindexAll(): Promise<number> {
  await run('DELETE FROM sites_fts')
  const ids = await all<{ id: number }>('SELECT id FROM sites')
  for (const { id } of ids) await reindexSite(Number(id))
  return ids.length
}

// ---------------------------------------------------------------- discovery --

export async function relatedSites(site: Site, limit = 8): Promise<Site[]> {
  const tagIds = site.tags.map((t) => Number(t.id))
  const rows = await all(
    `SELECT s.*,
      (SELECT COUNT(*) FROM site_tags st WHERE st.site_id = s.id AND st.tag_id IN (${
        tagIds.length ? tagIds.map(() => '?').join(',') : 'SELECT NULL'
      })) AS shared
     FROM sites s
     WHERE s.status = 'approved' AND s.id != ?
     ORDER BY (CASE WHEN s.category_id = ? THEN 2 ELSE 0 END) + shared * 3 DESC, s.trending DESC
     LIMIT ?`,
    [...tagIds, site.id, site.category_id ?? -1, limit],
  )
  return hydrate(rows)
}

export async function randomSite(excludeId?: number): Promise<Site | null> {
  const row = await get(
    `SELECT s.* FROM sites s
     WHERE s.status = 'approved' AND s.id != ?
     ORDER BY RANDOM() LIMIT 1`,
    [excludeId ?? -1],
  )
  return row ? (await hydrate([row]))[0] : null
}

/** Deterministic per-day pick, promoted manually when an editor sets featured_on. */
export async function siteOfTheDay(): Promise<Site | null> {
  const day = today()
  const manual = await get(`SELECT * FROM sites WHERE featured_on = ? AND status = 'approved'`, [day])
  if (manual) return (await hydrate([manual]))[0]

  const pool = await all(
    `SELECT * FROM sites
     WHERE status = 'approved' AND quality >= 0.5
       AND (featured_on IS NULL OR featured_on < date('now', '-45 days'))
     ORDER BY quality DESC, trending DESC
     LIMIT 60`,
  )
  if (!pool.length) {
    const any = await get(`SELECT * FROM sites WHERE status = 'approved' ORDER BY trending DESC LIMIT 1`)
    return any ? (await hydrate([any]))[0] : null
  }
  let seed = 0
  for (const ch of day) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0
  return (await hydrate([pool[seed % pool.length]]))[0]
}

export async function markFeatured(siteId: number, day = today()): Promise<void> {
  await run('UPDATE sites SET featured_on = ?, is_featured = 1 WHERE id = ?', [day, siteId])
}

// ------------------------------------------------------------------- shelves --

export async function trendingSites(limit = 12, userId?: number | null): Promise<Site[]> {
  const rows = await all(
    `SELECT s.* ${VIEWER_JOIN(userId)} FROM sites s
     WHERE s.status = 'approved' ORDER BY s.trending DESC, s.votes DESC LIMIT ?`,
    [limit],
  )
  return hydrate(rows)
}

export async function newestSites(limit = 12, userId?: number | null): Promise<Site[]> {
  const rows = await all(
    `SELECT s.* ${VIEWER_JOIN(userId)} FROM sites s
     WHERE s.status = 'approved'
     ORDER BY COALESCE(s.published_at, s.created_at) DESC, s.id DESC LIMIT ?`,
    [limit],
  )
  return hydrate(rows)
}

export async function topSites(limit = 12, userId?: number | null): Promise<Site[]> {
  const rows = await all(
    `SELECT s.* ${VIEWER_JOIN(userId)} FROM sites s
     WHERE s.status = 'approved' ORDER BY s.votes DESC, s.quality DESC LIMIT ?`,
    [limit],
  )
  return hydrate(rows)
}

export async function bestOfCategory(categorySlug: string, limit = 12, userId?: number | null): Promise<Site[]> {
  const rows = await all(
    `SELECT s.* ${VIEWER_JOIN(userId)} FROM sites s
     JOIN categories c ON c.id = s.category_id
     WHERE s.status = 'approved' AND c.slug = ?
     ORDER BY s.trending DESC, s.quality DESC LIMIT ?`,
    [categorySlug, limit],
  )
  return hydrate(rows)
}

export async function hiddenGems(limit = 12, userId?: number | null): Promise<Site[]> {
  const rows = await all(
    `SELECT s.* ${VIEWER_JOIN(userId)} FROM sites s
     WHERE s.status = 'approved' AND s.quality >= 0.6 AND s.votes <= 3
     ORDER BY s.quality DESC, RANDOM() LIMIT ?`,
    [limit],
  )
  return hydrate(rows)
}

// ------------------------------------------------------------------ taxonomy --

export async function listCategories(withCounts = true): Promise<Category[]> {
  if (!withCounts) return all<Category>('SELECT * FROM categories ORDER BY position, name')
  return all<Category>(
    `SELECT c.*, (SELECT COUNT(*) FROM sites s WHERE s.category_id = c.id AND s.status = 'approved') AS count
     FROM categories c ORDER BY c.position, c.name`,
  )
}

export async function getCategory(slug: string): Promise<Category | null> {
  const row = await get<Category>(
    `SELECT c.*, (SELECT COUNT(*) FROM sites s WHERE s.category_id = c.id AND s.status = 'approved') AS count
     FROM categories c WHERE c.slug = ?`,
    [slug],
  )
  return row ?? null
}

export async function listTags(limit = 60): Promise<Tag[]> {
  return all<Tag>(
    `SELECT t.*, (SELECT COUNT(*) FROM site_tags st JOIN sites s ON s.id = st.site_id
                  WHERE st.tag_id = t.id AND s.status = 'approved') AS uses
     FROM tags t ORDER BY uses DESC, t.name LIMIT ?`,
    [limit],
  )
}

export async function getTag(slug: string): Promise<Tag | null> {
  return (await get<Tag>('SELECT * FROM tags WHERE slug = ?', [slug])) ?? null
}

export async function tagsForCategory(categorySlug: string, limit = 18): Promise<Tag[]> {
  return all<Tag>(
    `SELECT t.id, t.slug, t.name, COUNT(*) AS uses
     FROM site_tags st
     JOIN tags t ON t.id = st.tag_id
     JOIN sites s ON s.id = st.site_id
     JOIN categories c ON c.id = s.category_id
     WHERE c.slug = ? AND s.status = 'approved'
     GROUP BY t.id ORDER BY uses DESC LIMIT ?`,
    [categorySlug, limit],
  )
}

export async function ensureTag(name: string): Promise<number> {
  const slug = slugify(name, 32)
  const existing = await get<{ id: number }>('SELECT id FROM tags WHERE slug = ?', [slug])
  if (existing) return Number(existing.id)
  const label = name.trim().toLowerCase().replace(/\s+/g, ' ').slice(0, 32) || slug
  const row = await get<{ id: number }>('INSERT INTO tags (slug, name) VALUES (?, ?) RETURNING id', [slug, label])
  return Number(row!.id)
}

export async function setSiteTags(siteId: number, tagNames: string[]): Promise<void> {
  await run('DELETE FROM site_tags WHERE site_id = ?', [siteId])
  const names = [...new Set(tagNames.map((t) => t.trim().toLowerCase()).filter(Boolean))].slice(0, 8)
  for (const name of names) {
    await run('INSERT OR IGNORE INTO site_tags (site_id, tag_id) VALUES (?, ?)', [siteId, await ensureTag(name)])
  }
  await run(
    `UPDATE tags SET uses = (SELECT COUNT(*) FROM site_tags st WHERE st.tag_id = tags.id)
     WHERE id IN (SELECT tag_id FROM site_tags WHERE site_id = ?)`,
    [siteId],
  )
  await reindexSite(siteId)
}

// -------------------------------------------------------------- interactions --

export async function recordView(siteId: number): Promise<void> {
  await run('UPDATE sites SET views = views + 1 WHERE id = ?', [siteId])
  await run(
    `INSERT INTO site_stats (site_id, day, views) VALUES (?, ?, 1)
     ON CONFLICT(site_id, day) DO UPDATE SET views = views + 1`,
    [siteId, today()],
  )
}

export async function recordClick(siteId: number): Promise<void> {
  await run('UPDATE sites SET clicks = clicks + 1 WHERE id = ?', [siteId])
  await run(
    `INSERT INTO site_stats (site_id, day, clicks) VALUES (?, ?, 1)
     ON CONFLICT(site_id, day) DO UPDATE SET clicks = clicks + 1`,
    [siteId, today()],
  )
}

export async function toggleVote(userId: number, siteId: number): Promise<{ voted: boolean; votes: number }> {
  const existing = await get('SELECT 1 AS x FROM votes WHERE user_id = ? AND site_id = ?', [userId, siteId])
  if (existing) {
    await run('DELETE FROM votes WHERE user_id = ? AND site_id = ?', [userId, siteId])
  } else {
    await run('INSERT INTO votes (user_id, site_id) VALUES (?, ?)', [userId, siteId])
    await run(
      `INSERT INTO site_stats (site_id, day, votes) VALUES (?, ?, 1)
       ON CONFLICT(site_id, day) DO UPDATE SET votes = votes + 1`,
      [siteId, today()],
    )
  }
  const row = await get<{ n: number }>('SELECT COUNT(*) AS n FROM votes WHERE site_id = ?', [siteId])
  const votes = Number(row?.n ?? 0)
  await run('UPDATE sites SET votes = ? WHERE id = ?', [votes, siteId])
  await updateTrendingFor(siteId)
  return { voted: !existing, votes }
}

export async function toggleSave(userId: number, siteId: number): Promise<{ saved: boolean }> {
  const existing = await get('SELECT 1 AS x FROM saves WHERE user_id = ? AND site_id = ?', [userId, siteId])
  if (existing) {
    await run('DELETE FROM saves WHERE user_id = ? AND site_id = ?', [userId, siteId])
    return { saved: false }
  }
  await run('INSERT INTO saves (user_id, site_id) VALUES (?, ?)', [userId, siteId])
  return { saved: true }
}

export async function savedSites(userId: number, limit = 200): Promise<Site[]> {
  const rows = await all(
    `SELECT s.*, 1 AS viewer_saved,
      EXISTS(SELECT 1 FROM votes v WHERE v.site_id = s.id AND v.user_id = ?) AS viewer_voted
     FROM saves sv JOIN sites s ON s.id = sv.site_id
     WHERE sv.user_id = ? AND s.status = 'approved'
     ORDER BY sv.created_at DESC LIMIT ?`,
    [userId, userId, limit],
  )
  return hydrate(rows)
}

export async function submissionsByUser(userId: number, limit = 100): Promise<Site[]> {
  const rows = await all('SELECT * FROM sites WHERE submitted_by = ? ORDER BY created_at DESC LIMIT ?', [
    userId,
    limit,
  ])
  return hydrate(rows)
}

// ---------------------------------------------------------------- ranking ----

/**
 * Trending is engagement-first with a quality floor and only gentle time decay.
 *
 * The gentle decay matters: with a young catalogue almost nothing has been voted
 * on yet, and a steep decay would make "Trending" a duplicate of "Newest" —
 * burying hand-curated entries under whatever the crawler found ten minutes ago.
 * A quality term keeps good sites visible until real engagement arrives, and any
 * genuine voting immediately dominates the numerator.
 */
export const TRENDING_SQL = `
  (votes * 5.0 + clicks * 1.5 + views * 0.2 + quality * 3.0)
  / POWER((julianday('now') - julianday(COALESCE(published_at, created_at))) + 3.0, 0.3)
`

export async function recomputeTrending(): Promise<number> {
  const res = await run(`UPDATE sites SET trending = ${TRENDING_SQL} WHERE status = 'approved'`)
  return res.rowsAffected
}

export async function updateTrendingFor(siteId: number): Promise<void> {
  await run(`UPDATE sites SET trending = ${TRENDING_SQL} WHERE id = ?`, [siteId])
}

// ------------------------------------------------------------------- writes --

export async function uniqueSlug(base: string, excludeId?: number): Promise<string> {
  const root = slugify(base) || 'site'
  let candidate = root
  let n = 1
  for (;;) {
    const row = await get<{ id: number }>('SELECT id FROM sites WHERE slug = ?', [candidate])
    if (!row || Number(row.id) === excludeId) return candidate
    n += 1
    candidate = `${root}-${n}`
    if (n > 500) return `${root}-${Date.now().toString(36)}`
  }
}

export async function updateSite(id: number, patch: Record<string, unknown>): Promise<void> {
  const keys = Object.keys(patch)
  if (!keys.length) return
  const assignments = keys.map((k) => `${k} = ?`).join(', ')
  await run(`UPDATE sites SET ${assignments}, updated_at = ? WHERE id = ?`, [
    ...keys.map((k) => patch[k] as any),
    nowIso(),
    id,
  ])
  await reindexSite(id)
}

export async function setStatus(id: number, status: string, reason = ''): Promise<void> {
  const current = await get<{ published_at: string | null }>('SELECT published_at FROM sites WHERE id = ?', [id])
  const publishedAt = status === 'approved' ? current?.published_at ?? nowIso() : null
  await run(
    `UPDATE sites SET status = ?, reject_reason = ?, published_at = COALESCE(?, published_at), updated_at = ?
     WHERE id = ?`,
    [status, reason, publishedAt, nowIso(), id],
  )
  if (status === 'approved') await updateTrendingFor(id)
  await reindexSite(id)
}

export async function deleteSite(id: number): Promise<void> {
  await run('DELETE FROM sites WHERE id = ?', [id])
  await run('DELETE FROM sites_fts WHERE rowid = ?', [id])
}
