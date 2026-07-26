import { NextResponse } from 'next/server'
import { searchSites } from '@/lib/queries/sites'
import { clamp } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const q = (searchParams.get('q') ?? '').trim().slice(0, 120)
  const limit = clamp(Number(searchParams.get('limit') ?? 8), 1, 30)

  if (q.length < 2) return NextResponse.json({ results: [], query: q })

  const results = (await searchSites(q, limit)).map((site) => ({
    slug: site.slug,
    title: site.title,
    tagline: site.tagline,
    domain: site.domain,
    category: site.category?.name ?? null,
    hue: site.accent_hue,
  }))

  return NextResponse.json({ results, query: q })
}
