import { NextResponse } from 'next/server'
import { getSiteBySlug, recordClick } from '@/lib/queries/sites'

export const dynamic = 'force-dynamic'

/**
 * Outbound click tracker. Every "Visit site" link goes through here so we can
 * count clicks (which feed the trending score) before handing the visitor over.
 * No referrer is leaked to the destination.
 */
export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const site = await getSiteBySlug(slug)

  if (!site || site.status !== 'approved') {
    return NextResponse.redirect(new URL('/browse', request.url), 302)
  }

  try {
    await recordClick(site.id)
  } catch {
    /* never block the redirect on analytics */
  }

  return NextResponse.redirect(site.url, {
    status: 302,
    headers: {
      'referrer-policy': 'no-referrer',
      'cache-control': 'no-store',
    },
  })
}
