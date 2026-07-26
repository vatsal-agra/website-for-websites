import { all, get, run, nowIso } from '../db'
import { enqueue } from '../jobs'
import { drainCandidates } from '../ingest'
import type { SourceRow } from '../types'
import { runHackerNews } from './hackernews'
import { runRss } from './rss'

export interface SourceResult {
  found: number
  scanned: number
  detail: string
}

/**
 * The link-graph source does not fetch anything itself — it schedules refreshes
 * of sites we already trust, and those refreshes harvest new outbound links.
 */
async function runLinkGraph(config: { batch?: number }): Promise<SourceResult> {
  const batch = config.batch ?? 8
  const rows = await all<{ id: number; slug: string }>(
    `SELECT id, slug FROM sites
     WHERE status = 'approved' AND quality >= 0.55
       AND (checked_at IS NULL OR checked_at < datetime('now', '-7 days'))
     ORDER BY COALESCE(checked_at, '1970-01-01') ASC, trending DESC
     LIMIT ?`,
    [batch],
  )

  for (const row of rows) {
    await enqueue('site.recheck', { siteId: Number(row.id) }, { dedupeKey: `recheck:${row.id}`, priority: 0 })
  }

  const drained = await drainCandidates(20)
  return {
    found: drained,
    scanned: rows.length,
    detail: `queued ${rows.length} re-checks, promoted ${drained} candidates to ingest`,
  }
}

export async function runSource(source: SourceRow): Promise<SourceResult> {
  let config: Record<string, any> = {}
  try {
    config = JSON.parse(source.config || '{}')
  } catch {
    config = {}
  }

  switch (source.kind) {
    case 'hackernews':
      return runHackerNews(config)
    case 'rss':
      return runRss({ url: source.url, ...config })
    case 'linkgraph':
      return runLinkGraph(config)
    default:
      return { found: 0, scanned: 0, detail: `unknown source kind "${source.kind}"` }
  }
}

export async function listSources(): Promise<SourceRow[]> {
  return all<SourceRow>('SELECT * FROM sources ORDER BY kind, name')
}

export async function getSource(id: number): Promise<SourceRow | undefined> {
  return get<SourceRow>('SELECT * FROM sources WHERE id = ?', [id])
}

export async function dueSources(): Promise<SourceRow[]> {
  return all<SourceRow>(
    `SELECT * FROM sources
     WHERE enabled = 1
       AND (last_run_at IS NULL OR datetime(last_run_at, '+' || interval_min || ' minutes') <= datetime('now'))`,
  )
}

export async function recordSourceRun(id: number, result: SourceResult): Promise<void> {
  await run(`UPDATE sources SET last_run_at = ?, last_result = ?, found_total = found_total + ? WHERE id = ?`, [
    nowIso(),
    result.detail.slice(0, 400),
    result.found,
    id,
  ])
}

export async function setSourceEnabled(id: number, enabled: boolean): Promise<void> {
  await run('UPDATE sources SET enabled = ? WHERE id = ?', [enabled ? 1 : 0, id])
}

export async function createSource(input: {
  kind: SourceRow['kind']
  name: string
  url?: string
  intervalMin?: number
  config?: Record<string, unknown>
}): Promise<void> {
  await run(`INSERT INTO sources (kind, name, url, interval_min, config) VALUES (?, ?, ?, ?, ?)`, [
    input.kind,
    input.name.slice(0, 80),
    input.url ?? '',
    input.intervalMin ?? 180,
    JSON.stringify(input.config ?? {}),
  ])
}

export async function deleteSource(id: number): Promise<void> {
  await run('DELETE FROM sources WHERE id = ?', [id])
}

export const DEFAULT_SOURCES: {
  kind: SourceRow['kind']
  name: string
  url: string
  interval_min: number
  config: Record<string, unknown>
}[] = [
  {
    kind: 'hackernews',
    name: 'Hacker News — front page & best',
    url: 'https://news.ycombinator.com',
    interval_min: 120,
    config: { lists: ['topstories', 'beststories', 'showstories'], take: 60, minScore: 25 },
  },
  {
    kind: 'rss',
    name: 'Lobsters',
    url: 'https://lobste.rs/rss',
    interval_min: 240,
    config: { weight: 1.15 },
  },
  {
    kind: 'rss',
    name: 'Hacker News front page (RSS)',
    url: 'https://news.ycombinator.com/rss',
    interval_min: 240,
    config: { weight: 1.0 },
  },
  {
    kind: 'rss',
    name: 'Kottke.org',
    url: 'https://feeds.kottke.org/main',
    interval_min: 720,
    config: { deep: true, weight: 1.3 },
  },
  {
    kind: 'rss',
    name: 'Waxy.org — links',
    url: 'https://waxy.org/category/links/feed/',
    interval_min: 720,
    config: { deep: true, weight: 1.3 },
  },
  {
    kind: 'rss',
    name: 'Sidebar — design links',
    url: 'https://sidebar.io/feed.xml',
    interval_min: 720,
    config: { weight: 1.2 },
  },
  {
    kind: 'linkgraph',
    name: 'Link graph expansion',
    url: '',
    interval_min: 60,
    config: { batch: 8 },
  },
]
