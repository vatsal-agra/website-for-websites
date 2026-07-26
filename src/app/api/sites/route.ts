import { NextResponse } from 'next/server'
import { env } from '@/lib/env'
import { listSites } from '@/lib/queries/sites'
import { ATTRIBUTE_DEFS } from '@/lib/taxonomy'
import { clamp } from '@/lib/utils'
import type { SortKey } from '@/lib/types'

export const dynamic = 'force-dynamic'

const SORTS: SortKey[] = ['trending', 'new', 'top', 'random', 'alpha']

/**
 * Public read-only JSON API.
 *   /api/sites?category=tools&sort=new&page=1&perPage=24
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)

  const sortParam = searchParams.get('sort') as SortKey | null
  const validAttrs = new Set(ATTRIBUTE_DEFS.map((a) => a.key as string))

  const result = await listSites({
    q: searchParams.get('q')?.slice(0, 120) || undefined,
    category: searchParams.get('category')?.slice(0, 40) || undefined,
    tag: searchParams.get('tag')?.slice(0, 40) || undefined,
    sort: sortParam && SORTS.includes(sortParam) ? sortParam : 'trending',
    attrs: searchParams.getAll('attr').filter((a) => validAttrs.has(a)),
    page: clamp(Number(searchParams.get('page') ?? 1) || 1, 1, 5000),
    perPage: clamp(Number(searchParams.get('perPage') ?? 24) || 24, 1, 60),
  })

  return NextResponse.json(
    {
      meta: {
        total: result.total,
        page: result.page,
        perPage: result.perPage,
        pages: result.pages,
        documentation: `${env.siteUrl}/about`,
        licence: 'Metadata is published under CC BY 4.0. Sites belong to their makers.',
      },
      sites: result.sites.map((site) => ({
        slug: site.slug,
        title: site.title,
        tagline: site.tagline,
        description: site.description,
        url: site.url,
        domain: site.domain,
        category: site.category ? { slug: site.category.slug, name: site.category.name } : null,
        tags: site.tags.map((t) => t.slug),
        attributes: site.attributes,
        language: site.lang,
        votes: site.votes,
        quality: site.quality,
        addedAt: site.published_at ?? site.created_at,
        cover: site.thumb_key ? `${env.siteUrl}/api/thumb/${site.thumb_key}` : null,
        permalink: `${env.siteUrl}/site/${site.slug}`,
      })),
    },
    {
      headers: {
        'cache-control': 'public, max-age=300, stale-while-revalidate=600',
        'access-control-allow-origin': '*',
      },
    },
  )
}
