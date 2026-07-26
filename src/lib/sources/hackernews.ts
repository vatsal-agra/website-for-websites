import { fetchText, pool } from '../fetcher'
import { enqueueCandidates } from '../ingest'

const API = 'https://hacker-news.firebaseio.com/v0'

interface HnItem {
  id: number
  type?: string
  title?: string
  url?: string
  score?: number
  descendants?: number
  dead?: boolean
  deleted?: boolean
}

async function json<T>(url: string): Promise<T | null> {
  const res = await fetchText(url, { polite: false, accept: 'application/json' })
  if (!res.ok) return null
  try {
    return JSON.parse(res.body) as T
  } catch {
    return null
  }
}

/**
 * Harvest outbound links from Hacker News. Stories that cleared a score
 * threshold are strong signals that a site is worth a look.
 */
export async function runHackerNews(config: {
  lists?: string[]
  take?: number
  minScore?: number
}): Promise<{ found: number; scanned: number; detail: string }> {
  const lists = config.lists?.length ? config.lists : ['topstories', 'beststories', 'showstories']
  const take = config.take ?? 60
  const minScore = config.minScore ?? 25

  const ids = new Set<number>()
  for (const list of lists) {
    const arr = await json<number[]>(`${API}/${list}.json`)
    if (!arr) continue
    for (const id of arr.slice(0, take)) ids.add(id)
  }
  if (!ids.size) return { found: 0, scanned: 0, detail: 'Hacker News API returned nothing' }

  const items = await pool([...ids], 8, (id) => json<HnItem>(`${API}/item/${id}.json`))
  const usable = items.filter(
    (item): item is HnItem =>
      Boolean(item && item.url && !item.dead && !item.deleted && (item.score ?? 0) >= minScore),
  )

  let found = 0
  for (const item of usable) {
    found += await enqueueCandidates([item.url!], {
      foundFrom: 'news.ycombinator.com',
      source: 'hackernews',
      sourceRef: `https://news.ycombinator.com/item?id=${item.id}`,
      // normalise HN score into a 0..1.6 weight so good stories jump the queue
      weight: Math.min(1.6, 0.6 + (item.score ?? 0) / 400),
    })
  }

  return {
    found,
    scanned: usable.length,
    detail: `scanned ${usable.length} stories (score ≥ ${minScore}), queued ${found} new domains`,
  }
}
