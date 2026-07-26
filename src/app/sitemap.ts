import type { MetadataRoute } from 'next'
import { all } from '@/lib/db'
import { env } from '@/lib/env'

export const dynamic = 'force-dynamic'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = env.siteUrl

  const staticPages: MetadataRoute.Sitemap = [
    { url: `${base}/`, changeFrequency: 'daily', priority: 1 },
    { url: `${base}/browse`, changeFrequency: 'daily', priority: 0.9 },
    { url: `${base}/categories`, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${base}/collections`, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${base}/submit`, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${base}/about`, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${base}/guidelines`, changeFrequency: 'monthly', priority: 0.4 },
  ]

  const [sites, categories, tags, collections] = await Promise.all([
    all<{ slug: string; updated_at: string }>(
      `SELECT slug, updated_at FROM sites WHERE status = 'approved' ORDER BY trending DESC LIMIT 40000`,
    ),
    all<{ slug: string }>('SELECT slug FROM categories'),
    all<{ slug: string }>('SELECT slug FROM tags WHERE uses > 0 ORDER BY uses DESC LIMIT 400'),
    all<{ slug: string; updated_at: string }>('SELECT slug, updated_at FROM collections WHERE is_public = 1'),
  ])

  return [
    ...staticPages,
    ...categories.map((c) => ({
      url: `${base}/category/${c.slug}`,
      changeFrequency: 'daily' as const,
      priority: 0.7,
    })),
    ...collections.map((c) => ({
      url: `${base}/collections/${c.slug}`,
      lastModified: new Date(c.updated_at.replace(' ', 'T') + 'Z'),
      changeFrequency: 'weekly' as const,
      priority: 0.6,
    })),
    ...tags.map((t) => ({
      url: `${base}/tag/${t.slug}`,
      changeFrequency: 'weekly' as const,
      priority: 0.4,
    })),
    ...sites.map((s) => ({
      url: `${base}/site/${s.slug}`,
      lastModified: new Date(s.updated_at.replace(' ', 'T') + 'Z'),
      changeFrequency: 'weekly' as const,
      priority: 0.6,
    })),
  ]
}
