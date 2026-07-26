import { NextResponse } from 'next/server'
import { env } from '@/lib/env'
import { ready } from '@/lib/db'
import { drain, jobCounts, requeueStalled } from '@/lib/jobs'
import { registerAllHandlers, scheduleDueWork } from '@/lib/handlers'
import { drainCandidates } from '@/lib/ingest'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * One worker tick, over HTTP.
 *
 * Serverless hosts have no long-running process, so the background work that
 * `npm run worker` does in a loop is driven here instead: Netlify's scheduled
 * function calls this every few minutes. It is deliberately time-boxed so it
 * always returns inside the function timeout, leaving the rest of the queue for
 * the next tick.
 *
 * Protected by WORKER_TOKEN — without one set, only local requests are served.
 */
async function tick(request: Request) {
  const url = new URL(request.url)
  const provided = request.headers.get('x-worker-token') ?? url.searchParams.get('token') ?? ''

  if (env.workerToken) {
    if (provided !== env.workerToken) {
      return NextResponse.json({ error: 'unauthorised' }, { status: 401 })
    }
  } else if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { error: 'WORKER_TOKEN is not configured, so the scheduled worker is disabled.' },
      { status: 503 },
    )
  }

  if (!env.workerEnabled) {
    return NextResponse.json({ skipped: 'WORKER_ENABLED=0' })
  }

  const started = Date.now()
  await ready()
  registerAllHandlers()

  const scheduled = await scheduleDueWork()
  const promoted = await drainCandidates(10)
  await requeueStalled()

  // leave headroom inside the 60s function budget
  const max = Math.max(1, Math.min(25, Number(url.searchParams.get('max') ?? 8)))
  const { ran, results } = await drain(max, 45_000)

  const counts = await jobCounts()

  return NextResponse.json({
    ok: true,
    elapsedMs: Date.now() - started,
    scheduled,
    promoted,
    ran,
    results,
    queue: counts,
  })
}

export async function GET(request: Request) {
  return tick(request)
}

export async function POST(request: Request) {
  return tick(request)
}
