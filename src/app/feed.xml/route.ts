import { env } from '@/lib/env'
import { newestSites } from '@/lib/queries/sites'
import { escapeXml } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export async function GET() {
  const sites = await newestSites(50)
  const updated = sites[0]?.published_at ?? sites[0]?.created_at ?? new Date().toISOString()

  const items = sites
    .map((site) => {
      const link = `${env.siteUrl}/site/${site.slug}`
      const published = new Date((site.published_at ?? site.created_at).replace(' ', 'T') + 'Z').toUTCString()
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
      <pubDate>${published}</pubDate>
      <category>${escapeXml(site.category?.name ?? 'Uncategorised')}</category>
      <description>${escapeXml(description)}</description>
    </item>`
    })
    .join('\n')

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(env.siteName)} — newest listings</title>
    <link>${escapeXml(env.siteUrl)}</link>
    <atom:link href="${escapeXml(env.siteUrl)}/feed.xml" rel="self" type="application/rss+xml" />
    <description>Websites recently added to the ${escapeXml(env.siteName)} catalogue.</description>
    <language>en</language>
    <lastBuildDate>${new Date(updated.replace(' ', 'T') + 'Z').toUTCString()}</lastBuildDate>
    <generator>web-amble</generator>
${items}
  </channel>
</rss>`

  return new Response(xml, {
    headers: {
      'content-type': 'application/rss+xml; charset=utf-8',
      'cache-control': 'public, max-age=1800, stale-while-revalidate=3600',
    },
  })
}
