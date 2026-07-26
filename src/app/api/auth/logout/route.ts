import { NextResponse } from 'next/server'
import { endSession } from '@/lib/session'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  await endSession()
  return NextResponse.redirect(new URL('/', request.url), 303)
}

export async function GET(request: Request) {
  await endSession()
  return NextResponse.redirect(new URL('/', request.url), 303)
}
