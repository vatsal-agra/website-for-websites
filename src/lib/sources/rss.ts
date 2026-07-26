import * as cheerio from 'cheerio'
import { fetchText } from '../fetcher'
import { enqueueCandidates } from '../ingest'
import { normalizeUrl } from '../url'

export interface FeedEntry {
  title: string
  link: string
  summary: string
}

export function parseFeed(xml: string): FeedEntry[] {
  const $ = cheerio.load(xml, { xmlMode: true })
  const entries: FeedEntry[] = []

  $('item').each((_, el) => {
    const node = $(el)
    const link = node.find('link').first().text().trim() || node.find('guid').first().text().trim()
    if (!link) return
    entries.push({
      title: node.find('title').first().text().trim(),
      link,
      summary: node.find('description').first().text().trim().slice(0, 600),
    })
  })

  $('entry').each((_, el) => {
    const node = $(el)
    const linkEl = node.find('link[rel="alternate"]').first().attr('href') ?? node.find('link').first().attr('href')
    const link = (linkEl ?? node.find('link').first().text()).trim()
    if (!link) return
    entries.push({
      title: node.find('title').first().text().trim(),
      link,
      summary: (node.find('summary').first().text() || node.find('content').first().text()).trim().slice(0, 600),
    })
  })

  return entries
}

/**
 * Link blogs are the best discovery source on the web — they are humans doing
 * curation for free. We harvest the destinations they point at, not the blog.
 */
export async function runRss(config: {
  url: string
  /** follow links found inside each entry's body as well as the entry link */
  deep?: boolean
  weight?: number
}): Promise<{ found: number; scanned: number; detail: string }> {
  if (!config.url) return { found: 0, scanned: 0, detail: 'no feed url configured' }

  const res = await fetchText(config.url, { accept: 'application/rss+xml, application/atom+xml, application/xml;q=0.9, */*;q=0.8' })
  if (!res.ok || !res.body) {
    return { found: 0, scanned: 0, detail: `feed unreachable (${res.error ?? res.status})` }
  }

  const entries = parseFeed(res.body)
  if (!entries.length) return { found: 0, scanned: 0, detail: 'feed parsed but contained no entries' }

  const feedHost = normalizeUrl(config.url)?.domain ?? ''
  const links: string[] = []

  for (const entry of entries.slice(0, 80)) {
    links.push(entry.link)
    if (config.deep && entry.summary) {
      const $ = cheerio.load(entry.summary)
      $('a[href]').each((_, el) => {
        const href = $(el).attr('href')
        if (href) links.push(href)
      })
    }
  }

  const found = await enqueueCandidates(links, {
    foundFrom: feedHost,
    source: 'rss',
    sourceRef: config.url,
    weight: config.weight ?? 1.1,
  })

  return { found, scanned: entries.length, detail: `read ${entries.length} entries, queued ${found} new domains` }
}
