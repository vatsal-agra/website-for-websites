import { NextResponse } from 'next/server'
import { z } from 'zod'
import { audit, run } from '@/lib/db'
import { clientKey, getCurrentUser } from '@/lib/session'
import { LIMITS, rateLimit } from '@/lib/ratelimit'
import { getSiteBySlug } from '@/lib/queries/sites'

export const dynamic = 'force-dynamic'

const schema = z.object({
  reason: z.enum(['broken', 'wrong-info', 'spam', 'adult', 'duplicate', 'owner-request']),
  detail: z.string().max(500).optional().default(''),
})

export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const ip = await clientKey()
  const limit = await rateLimit('report', ip, LIMITS.report.limit, LIMITS.report.window)
  if (!limit.ok) {
    return NextResponse.json(
      { error: 'Too many reports from here. Try again later.' },
      { status: 429, headers: { 'retry-after': String(limit.retryAfterSeconds) } },
    )
  }

  const { slug } = await params
  const site = await getSiteBySlug(slug)
  if (!site) return NextResponse.json({ error: 'That site is not listed.' }, { status: 404 })

  const body = await request.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Please choose a reason.' }, { status: 400 })
  }

  const user = await getCurrentUser()
  await run('INSERT INTO reports (site_id, reason, detail, reporter) VALUES (?, ?, ?, ?)', [
    site.id,
    parsed.data.reason,
    parsed.data.detail ?? '',
    user ? `@${user.username}` : 'anonymous',
  ])

  await audit('report.filed', site.slug, parsed.data.reason, user ? `@${user.username}` : 'anonymous')

  return NextResponse.json({ ok: true })
}
