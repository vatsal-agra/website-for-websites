import { env } from './env'
import type { Site } from './types'
import { escapeXml } from './utils'

/**
 * RSS for any shelf in the catalogue.
 *
 * A directory that keeps finding things is only useful if you can be told when
 * it does, without coming back to look. So every surface that is a list of
 * sites — the whole catalogue, a category, a tag, a collection — publishes the
 * same feed shape from here rather than four near-identical route handlers.
 *
 * Timestamps in the database are text, `YYYY-MM-DD HH:MM:SS` in UTC. RSS wants
 * RFC 822, so `rfc822()` is the single place that conversion happens.
 */

export interface FeedOptions {
  /** channel title, already human-readable — the site name is appended */
  title: string
  description: string
  /** absolute path of the feed itself, e.g. `/category/tools/feed.xml` */
  path: string
  sites: Site[]
}

function rfc822(value: string | null | undefined): string {
  if (!value) return new Date().toUTCString()
  const iso = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value) ? `${value.replace(' ', 'T')}Z` : value
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? new Date().toUTCString() : date.toUTCString()
}

function item(site: Site): string {
  const link = `${env.siteUrl}/site/${site.slug}`
  const description = [
    site.tagline || site.description,
    `\n\nCategory: ${site.category?.name ?? 'Uncategorised'}`,
    site.tags.length ? `\nTags: ${site.tags.map((t) => t.name).join(', ')}` : '',
    `\nVisit: ${site.url}`,
  ].join('')

  return `    <item>
      <title>${escapeXml(site.title)}</title>
      <link>${escapeXml(link)}</link>
      <guid isPermaLink="true">${escapeXml(link)}</guid>
      <pubDate>${rfc822(site.published_at ?? site.created_at)}</pubDate>
      <category>${escapeXml(site.category?.name ?? 'Uncategorised')}</category>
      <description>${escapeXml(description)}</description>
    </item>`
}

export function feedResponse({ title, description, path, sites }: FeedOptions): Response {
  const updated = sites[0]?.published_at ?? sites[0]?.created_at ?? null

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(`${env.siteName} — ${title}`)}</title>
    <link>${escapeXml(env.siteUrl)}</link>
    <atom:link href="${escapeXml(env.siteUrl + path)}" rel="self" type="application/rss+xml" />
    <description>${escapeXml(description)}</description>
    <language>en</language>
    <lastBuildDate>${rfc822(updated)}</lastBuildDate>
    <generator>web-amble</generator>
${sites.map(item).join('\n')}
  </channel>
</rss>`

  return new Response(xml, {
    headers: {
      'content-type': 'application/rss+xml; charset=utf-8',
      'cache-control': 'public, max-age=1800, stale-while-revalidate=3600',
    },
  })
}

/** Convenience for a page's `alternates.types`, so readers auto-discover it. */
export function feedAlternate(path: string) {
  return { 'application/rss+xml': `${env.siteUrl}${path}` }
}
