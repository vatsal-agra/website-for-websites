import { all, get, run, nowIso } from './db'
import type { JobRow } from './types'

export type JobHandler = (payload: any, job: JobRow) => Promise<unknown>

const handlers = new Map<string, JobHandler>()

export function registerHandler(type: string, handler: JobHandler) {
  handlers.set(type, handler)
}

export function hasHandler(type: string) {
  return handlers.has(type)
}

export interface EnqueueOptions {
  dedupeKey?: string
  priority?: number
  runAt?: Date
  maxAttempts?: number
  /**
   * When a finished job already holds this dedupe key, replace it instead of
   * skipping. Used for work that is legitimately repeatable (regenerating a
   * thumbnail); left off for time-bucketed scheduled work.
   */
  rerunFinished?: boolean
}

/** Returns the new job id, or null when the work was already scheduled. */
export async function enqueue(
  type: string,
  payload: Record<string, unknown> = {},
  opts: EnqueueOptions = {},
): Promise<number | null> {
  const runAt = (opts.runAt ?? new Date()).toISOString().replace('T', ' ').slice(0, 19)

  if (opts.dedupeKey) {
    const existing = await get<{ id: number; status: string }>(
      'SELECT id, status FROM jobs WHERE dedupe_key = ?',
      [opts.dedupeKey],
    )
    if (existing) {
      if (existing.status === 'queued' || existing.status === 'running') return null
      if (!opts.rerunFinished) return null
      await run('DELETE FROM jobs WHERE id = ?', [Number(existing.id)])
    }
  }

  try {
    const row = await get<{ id: number }>(
      `INSERT INTO jobs (type, payload, dedupe_key, priority, run_at, max_attempts)
       VALUES (?, ?, ?, ?, ?, ?) RETURNING id`,
      [
        type,
        JSON.stringify(payload),
        opts.dedupeKey ?? null,
        opts.priority ?? 0,
        runAt,
        opts.maxAttempts ?? 3,
      ],
    )
    return row ? Number(row.id) : null
  } catch {
    return null
  }
}

export async function claimNext(): Promise<JobRow | null> {
  const job = await get<JobRow>(
    `SELECT * FROM jobs
     WHERE status = 'queued' AND run_at <= ?
     ORDER BY priority DESC, run_at ASC, id ASC LIMIT 1`,
    [nowIso()],
  )
  if (!job) return null

  // Claim it. The `status = 'queued'` guard makes this safe when several
  // workers (or serverless invocations) race for the same job.
  const claim = await run(
    `UPDATE jobs SET status = 'running', started_at = ?, attempts = attempts + 1
     WHERE id = ? AND status = 'queued'`,
    [nowIso(), Number(job.id)],
  )
  if (!claim.rowsAffected) return null

  return { ...job, id: Number(job.id), status: 'running', attempts: Number(job.attempts) + 1 }
}

export async function completeJob(id: number, result: unknown): Promise<void> {
  await run(`UPDATE jobs SET status = 'done', finished_at = ?, result = ?, error = NULL WHERE id = ?`, [
    nowIso(),
    JSON.stringify(result ?? null).slice(0, 4000),
    id,
  ])
}

export async function failJob(job: JobRow, error: unknown): Promise<void> {
  const message = (error instanceof Error ? error.message : String(error)).slice(0, 1000)
  if (Number(job.attempts) >= Number(job.max_attempts)) {
    await run(`UPDATE jobs SET status = 'failed', finished_at = ?, error = ? WHERE id = ?`, [
      nowIso(),
      message,
      Number(job.id),
    ])
    return
  }
  const backoffMinutes = Math.min(60, 2 ** Number(job.attempts))
  const runAt = new Date(Date.now() + backoffMinutes * 60_000).toISOString().replace('T', ' ').slice(0, 19)
  await run(`UPDATE jobs SET status = 'queued', run_at = ?, error = ? WHERE id = ?`, [
    runAt,
    message,
    Number(job.id),
  ])
}

/** Run a single job if one is due. Returns a short description or null. */
export async function runOnce(): Promise<{ id: number; type: string; ok: boolean; detail: string } | null> {
  const job = await claimNext()
  if (!job) return null
  const handler = handlers.get(job.type)
  if (!handler) {
    await failJob({ ...job, attempts: job.max_attempts }, `no handler registered for "${job.type}"`)
    return { id: job.id, type: job.type, ok: false, detail: 'no handler' }
  }
  try {
    const payload = JSON.parse(job.payload || '{}')
    const result = await handler(payload, job)
    await completeJob(job.id, result)
    return { id: job.id, type: job.type, ok: true, detail: JSON.stringify(result ?? '').slice(0, 200) }
  } catch (err) {
    await failJob(job, err)
    return { id: job.id, type: job.type, ok: false, detail: err instanceof Error ? err.message : String(err) }
  }
}

/** Drain up to `max` due jobs, stopping early if we run out of time. */
export async function drain(max = 10, budgetMs = 0): Promise<{ ran: number; results: string[] }> {
  const started = Date.now()
  const results: string[] = []
  for (let i = 0; i < max; i++) {
    if (budgetMs && Date.now() - started > budgetMs) break
    const outcome = await runOnce()
    if (!outcome) break
    results.push(`${outcome.ok ? '✓' : '✗'} ${outcome.type}${outcome.ok ? '' : ` — ${outcome.detail}`}`)
  }
  return { ran: results.length, results }
}

export async function jobCounts(): Promise<Record<string, number>> {
  const rows = await all<{ status: string; n: number }>('SELECT status, COUNT(*)::int AS n FROM jobs GROUP BY status')
  const out: Record<string, number> = { queued: 0, running: 0, done: 0, failed: 0 }
  for (const r of rows) out[r.status] = Number(r.n)
  return out
}

export async function recentJobs(limit = 40): Promise<JobRow[]> {
  return all<JobRow>(
    'SELECT * FROM jobs ORDER BY COALESCE(finished_at, started_at, created_at) DESC, id DESC LIMIT ?',
    [limit],
  )
}

export async function retryJob(id: number): Promise<void> {
  await run(`UPDATE jobs SET status = 'queued', attempts = 0, run_at = ?, error = NULL WHERE id = ?`, [
    nowIso(),
    id,
  ])
}

export async function clearFinishedJobs(): Promise<number> {
  const res = await run(`DELETE FROM jobs WHERE status IN ('done','failed')`)
  return res.rowsAffected
}

/** Housekeeping: unstick jobs left "running" by a crashed worker. */
export async function requeueStalled(olderThanMinutes = 20): Promise<number> {
  const cutoff = new Date(Date.now() - olderThanMinutes * 60_000).toISOString().replace('T', ' ').slice(0, 19)
  const res = await run(`UPDATE jobs SET status = 'queued' WHERE status = 'running' AND started_at < ?`, [cutoff])
  return res.rowsAffected
}
