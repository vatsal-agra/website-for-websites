import { NextResponse } from 'next/server'
import { getCurrentUser, clientKey } from '@/lib/session'
import { LIMITS, rateLimit } from '@/lib/ratelimit'
import { getSiteBySlug, toggleVote } from '@/lib/queries/sites'

export const dynamic = 'force-dynamic'

export async function POST(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: 'Sign in to vote.' }, { status: 401 })
  }

  const limit = await rateLimit('vote', String(user.id), LIMITS.vote.limit, LIMITS.vote.window)
  if (!limit.ok) {
    return NextResponse.json(
      { error: 'That is a lot of voting. Try again shortly.' },
      { status: 429, headers: { 'retry-after': String(limit.retryAfterSeconds) } },
    )
  }

  const { slug } = await params
  const site = await getSiteBySlug(slug)
  if (!site || site.status !== 'approved') {
    return NextResponse.json({ error: 'That site is not listed.' }, { status: 404 })
  }

  await clientKey() // touch headers so the response is not cached
  const result = await toggleVote(user.id, site.id)
  return NextResponse.json(result)
}
