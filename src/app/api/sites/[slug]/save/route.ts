import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/session'
import { getSiteBySlug, toggleSave } from '@/lib/queries/sites'

export const dynamic = 'force-dynamic'

export async function POST(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: 'Sign in to save sites.' }, { status: 401 })
  }

  const { slug } = await params
  const site = await getSiteBySlug(slug)
  if (!site || site.status !== 'approved') {
    return NextResponse.json({ error: 'That site is not listed.' }, { status: 404 })
  }

  return NextResponse.json(await toggleSave(user.id, site.id))
}
