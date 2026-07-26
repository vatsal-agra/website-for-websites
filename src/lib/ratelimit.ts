import { get, run } from './db'

export interface RateLimitResult {
  ok: boolean
  remaining: number
  retryAfterSeconds: number
}

/**
 * Fixed-window limiter backed by the database, so it survives a restart and is
 * shared across serverless invocations — an in-memory counter would reset on
 * every cold start and enforce nothing.
 */
export async function rateLimit(
  bucket: string,
  subject: string,
  limit: number,
  windowSeconds: number,
): Promise<RateLimitResult> {
  const now = Date.now()
  const windowStart = Math.floor(now / (windowSeconds * 1000)) * windowSeconds * 1000
  const windowAt = new Date(windowStart).toISOString().replace('T', ' ').slice(0, 19)

  const row = await get<{ count: number }>(
    `INSERT INTO rate_limits (bucket, subject, window_at, count)
     VALUES (?, ?, ?, 1)
     ON CONFLICT(bucket, subject, window_at) DO UPDATE SET count = count + 1
     RETURNING count`,
    [bucket, subject, windowAt],
  )
  const used = Number(row?.count ?? 1)

  const retryAfterSeconds = Math.max(1, Math.ceil((windowStart + windowSeconds * 1000 - now) / 1000))

  // opportunistic cleanup
  if (Math.random() < 0.02) {
    const cutoff = new Date(now - Math.max(windowSeconds, 3600) * 4000).toISOString().replace('T', ' ').slice(0, 19)
    await run('DELETE FROM rate_limits WHERE window_at < ?', [cutoff]).catch(() => {})
  }

  return {
    ok: used <= limit,
    remaining: Math.max(0, limit - used),
    retryAfterSeconds,
  }
}

export const LIMITS = {
  submit: { limit: 8, window: 3600 },
  signup: { limit: 5, window: 3600 },
  login: { limit: 12, window: 900 },
  vote: { limit: 120, window: 3600 },
  report: { limit: 10, window: 3600 },
  collection: { limit: 30, window: 3600 },
} as const
