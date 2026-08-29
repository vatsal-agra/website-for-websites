import { all, dayOffset, get, isoOffset } from '../db'
import { memo } from '../memo'

export interface WebAmbleStats {
  approved: number
  pending: number
  rejected: number
  categories: number
  tags: number
  collections: number
  users: number
  candidatesQueued: number
  jobsQueued: number
  jobsFailed: number
  openReports: number
  addedThisWeek: number
  clicksTotal: number
  votesTotal: number
}

export const EMPTY_STATS: WebAmbleStats = {
  approved: 0, pending: 0, rejected: 0, categories: 0, tags: 0, collections: 0, users: 0,
  candidatesQueued: 0, jobsQueued: 0, jobsFailed: 0, openReports: 0, addedThisWeek: 0,
  clicksTotal: 0, votesTotal: 0,
}

/**
 * Every counter in one round trip, memoised for half a minute.
 *
 * This used to be fourteen parallel queries. Against a local database that was
 * free; against a network database it meant fourteen round trips on the layout
 * of *every* page. One query with scalar subselects costs the same on the
 * server and a fraction of the wall clock.
 *
 * It still sits on the layout, so it is on the critical path of every single
 * page — and the numbers it counts move by a handful an hour at most. Thirty
 * seconds of staleness buys back a full round trip on nearly every request.
 * Anything that changes a counter calls `invalidateStats()`, so a moderator
 * who approves a site sees the new number immediately rather than in half a
 * minute.
 */
const statsMemo = memo(30_000, async (): Promise<WebAmbleStats> => {
  try {
    const row = await get<Record<string, number>>(
      `SELECT
         (SELECT COUNT(*)::int FROM sites WHERE status = 'approved')            AS approved,
         (SELECT COUNT(*)::int FROM sites WHERE status = 'pending')             AS pending,
         (SELECT COUNT(*)::int FROM sites WHERE status = 'rejected')            AS rejected,
         (SELECT COUNT(*)::int FROM categories)                                 AS categories,
         (SELECT COUNT(*)::int FROM tags)                                       AS tags,
         (SELECT COUNT(*)::int FROM collections WHERE is_public = 1)            AS collections,
         (SELECT COUNT(*)::int FROM users)                                      AS users,
         (SELECT COUNT(*)::int FROM candidates WHERE status = 'queued')         AS candidates_queued,
         (SELECT COUNT(*)::int FROM jobs WHERE status IN ('queued','running'))  AS jobs_queued,
         (SELECT COUNT(*)::int FROM jobs WHERE status = 'failed')               AS jobs_failed,
         (SELECT COUNT(*)::int FROM reports WHERE status = 'open')              AS open_reports,
         (SELECT COUNT(*)::int FROM sites
            WHERE status = 'approved' AND COALESCE(published_at, created_at) >= ?) AS added_this_week,
         (SELECT COALESCE(SUM(clicks),0)::int FROM sites)                       AS clicks_total,
         (SELECT COALESCE(SUM(votes),0)::int FROM sites)                        AS votes_total`,
      [isoOffset(-7 * 86_400_000)],
    )
    if (!row) return EMPTY_STATS
    return {
      approved: Number(row.approved),
      pending: Number(row.pending),
      rejected: Number(row.rejected),
      categories: Number(row.categories),
      tags: Number(row.tags),
      collections: Number(row.collections),
      users: Number(row.users),
      candidatesQueued: Number(row.candidates_queued),
      jobsQueued: Number(row.jobs_queued),
      jobsFailed: Number(row.jobs_failed),
      openReports: Number(row.open_reports),
      addedThisWeek: Number(row.added_this_week),
      clicksTotal: Number(row.clicks_total),
      votesTotal: Number(row.votes_total),
    }
  } catch {
    // a stats panel must never take the whole page down
    return EMPTY_STATS
  }
})

export async function getStats(): Promise<WebAmbleStats> {
  return statsMemo()
}

export function invalidateStats() {
  statsMemo.invalidate()
}

export interface DailyPoint {
  day: string
  added: number
  views: number
  clicks: number
}

export async function activitySeries(days = 30): Promise<DailyPoint[]> {
  const [added, traffic] = await Promise.all([
    all<{ day: string; n: number }>(
      // timestamps are text 'YYYY-MM-DD HH:MM:SS', so the day is the first 10 chars
      `SELECT left(COALESCE(published_at, created_at), 10) AS day, COUNT(*)::int AS n
       FROM sites WHERE status = 'approved' AND left(COALESCE(published_at, created_at), 10) >= ?
       GROUP BY 1`,
      [dayOffset(-days)],
    ),
    all<{ day: string; views: number; clicks: number }>(
      `SELECT day, SUM(views)::int AS views, SUM(clicks)::int AS clicks FROM site_stats
       WHERE day >= ? GROUP BY day`,
      [dayOffset(-days)],
    ),
  ])

  const addedMap = new Map(added.map((r) => [r.day, Number(r.n)]))
  const trafficMap = new Map(traffic.map((r) => [r.day, r]))

  const out: DailyPoint[] = []
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400_000).toISOString().slice(0, 10)
    out.push({
      day: d,
      added: addedMap.get(d) ?? 0,
      views: Number(trafficMap.get(d)?.views ?? 0),
      clicks: Number(trafficMap.get(d)?.clicks ?? 0),
    })
  }
  return out
}

export async function categoryBreakdown(): Promise<{ slug: string; name: string; hue: number; count: number }[]> {
  return all(
    `SELECT c.slug, c.name, c.hue,
      (SELECT COUNT(*)::int FROM sites s WHERE s.category_id = c.id AND s.status = 'approved') AS count
     FROM categories c ORDER BY count DESC`,
  )
}

export async function sourceBreakdown(): Promise<{ source: string; count: number }[]> {
  return all(
    `SELECT source, COUNT(*)::int AS count FROM sites WHERE status = 'approved' GROUP BY source ORDER BY count DESC`,
  )
}
