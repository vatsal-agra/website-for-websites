import { Play, RotateCcw, Trash2 } from 'lucide-react'
import { jobCounts, recentJobs } from '@/lib/jobs'
import { getStats } from '@/lib/queries/stats'
import { formatNumber, timeAgo } from '@/lib/utils'
import { Badge } from '@/components/ui/primitives'
import { clearJobsAction, retryJobAction, runWorkerTickAction } from '@/lib/actions/admin'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Jobs' }

const TONE = {
  done: 'positive',
  failed: 'danger',
  running: 'accent',
  queued: 'neutral',
} as const

export default async function JobsPage() {
  const [counts, jobs, stats] = await Promise.all([jobCounts(), recentJobs(50), getStats()])

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl">Job queue</h2>
          <p className="mt-1 text-sm text-muted">
            {counts.queued} queued · {counts.running} running · {counts.done} done · {counts.failed} failed ·{' '}
            {formatNumber(stats.candidatesQueued)} candidates waiting
          </p>
        </div>
        <div className="flex gap-2">
          <form action={runWorkerTickAction}>
            <button className="inline-flex h-9 items-center gap-2 rounded-xl bg-ink px-4 text-sm font-medium text-canvas">
              <Play className="h-3.5 w-3.5" />
              Run a tick
            </button>
          </form>
          <form action={clearJobsAction}>
            <button className="inline-flex h-9 items-center gap-2 rounded-xl border border-line px-3 text-sm text-muted transition-colors hover:text-ink">
              <Trash2 className="h-3.5 w-3.5" />
              Clear finished
            </button>
          </form>
        </div>
      </header>

      <p className="rounded-xl border border-line bg-raised px-4 py-3 text-xs leading-relaxed text-muted">
        The dedicated worker (<code className="font-mono">npm run worker</code>) processes this queue continuously
        and is the recommended way to run web-amble. “Run a tick” here does the same work inline so you can operate
        the site without a second process.
      </p>

      <div className="overflow-hidden rounded-2xl border border-line">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-line bg-surface">
              <th className="px-3 py-2.5 text-left font-mono text-2xs uppercase tracking-wider text-faint">Type</th>
              <th className="px-3 py-2.5 text-left font-mono text-2xs uppercase tracking-wider text-faint">Status</th>
              <th className="hidden px-3 py-2.5 text-left font-mono text-2xs uppercase tracking-wider text-faint md:table-cell">
                Result
              </th>
              <th className="px-3 py-2.5 text-right font-mono text-2xs uppercase tracking-wider text-faint">When</th>
              <th className="px-3 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {jobs.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-sm text-muted">
                  No jobs yet.
                </td>
              </tr>
            )}
            {jobs.map((job) => (
              <tr key={job.id} className="border-b border-line last:border-0 hover:bg-surface">
                <td className="px-3 py-2.5">
                  <span className="font-mono text-xs">{job.type}</span>
                  {job.attempts > 1 && <span className="ml-1.5 text-2xs text-faint">×{job.attempts}</span>}
                </td>
                <td className="px-3 py-2.5">
                  <Badge tone={TONE[job.status]}>{job.status}</Badge>
                </td>
                <td className="hidden max-w-md px-3 py-2.5 md:table-cell">
                  <p className="truncate font-mono text-2xs text-faint">
                    {job.error ? <span className="text-danger">{job.error}</span> : job.result ?? '—'}
                  </p>
                </td>
                <td className="px-3 py-2.5 text-right font-mono text-2xs text-faint">
                  {timeAgo(job.finished_at ?? job.started_at ?? job.created_at)}
                </td>
                <td className="px-3 py-2.5 text-right">
                  {job.status === 'failed' && (
                    <form action={retryJobAction}>
                      <input type="hidden" name="id" value={job.id} />
                      <button className="inline-flex items-center gap-1 text-2xs text-muted transition-colors hover:text-ink">
                        <RotateCcw className="h-3 w-3" />
                        retry
                      </button>
                    </form>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
