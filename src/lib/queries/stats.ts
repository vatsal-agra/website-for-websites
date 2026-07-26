import { all, count } from '../db'

export interface PorticoStats {
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

export async function getStats(): Promise<PorticoStats> {
  const [
    approved,
    pending,
    rejected,
    categories,
    tags,
    collections,
    users,
    candidatesQueued,
    jobsQueued,
    jobsFailed,
    openReports,
    addedThisWeek,
    clicksTotal,
    votesTotal,
  ] = await Promise.all([
    count(`SELECT COUNT(*) AS n FROM sites WHERE status = 'approved'`),
    count(`SELECT COUNT(*) AS n FROM sites WHERE status = 'pending'`),
    count(`SELECT COUNT(*) AS n FROM sites WHERE status = 'rejected'`),
    count(`SELECT COUNT(*) AS n FROM categories`),
    count(`SELECT COUNT(*) AS n FROM tags`),
    count(`SELECT COUNT(*) AS n FROM collections WHERE is_public = 1`),
    count(`SELECT COUNT(*) AS n FROM users`),
    count(`SELECT COUNT(*) AS n FROM candidates WHERE status = 'queued'`),
    count(`SELECT COUNT(*) AS n FROM jobs WHERE status IN ('queued','running')`),
    count(`SELECT COUNT(*) AS n FROM jobs WHERE status = 'failed'`),
    count(`SELECT COUNT(*) AS n FROM reports WHERE status = 'open'`),
    count(
      `SELECT COUNT(*) AS n FROM sites WHERE status = 'approved' AND COALESCE(published_at, created_at) >= datetime('now','-7 days')`,
    ),
    count(`SELECT COALESCE(SUM(clicks),0) AS n FROM sites`),
    count(`SELECT COALESCE(SUM(votes),0) AS n FROM sites`),
  ])

  return {
    approved,
    pending,
    rejected,
    categories,
    tags,
    collections,
    users,
    candidatesQueued,
    jobsQueued,
    jobsFailed,
    openReports,
    addedThisWeek,
    clicksTotal,
    votesTotal,
  }
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
      `SELECT date(COALESCE(published_at, created_at)) AS day, COUNT(*) AS n
       FROM sites WHERE status = 'approved' AND COALESCE(published_at, created_at) >= date('now', ?)
       GROUP BY day`,
      [`-${days} days`],
    ),
    all<{ day: string; views: number; clicks: number }>(
      `SELECT day, SUM(views) AS views, SUM(clicks) AS clicks FROM site_stats
       WHERE day >= date('now', ?) GROUP BY day`,
      [`-${days} days`],
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
      (SELECT COUNT(*) FROM sites s WHERE s.category_id = c.id AND s.status = 'approved') AS count
     FROM categories c ORDER BY count DESC`,
  )
}

export async function sourceBreakdown(): Promise<{ source: string; count: number }[]> {
  return all(
    `SELECT source, COUNT(*) AS count FROM sites WHERE status = 'approved' GROUP BY source ORDER BY count DESC`,
  )
}
