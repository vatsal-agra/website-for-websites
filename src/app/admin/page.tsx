import Link from 'next/link'
import { Play } from 'lucide-react'
import { all } from '@/lib/db'
import { activitySeries, categoryBreakdown, getStats } from '@/lib/queries/stats'
import { jobCounts } from '@/lib/jobs'
import { listSources } from '@/lib/sources'
import { formatNumber, timeAgo } from '@/lib/utils'
import { Badge } from '@/components/ui/primitives'
import { runWorkerTickAction } from '@/lib/actions/admin'

export const dynamic = 'force-dynamic'

export default async function AdminOverview() {
  const stats = await getStats()
  const jobs = await jobCounts()
  const series = await activitySeries(30)
  const categories = await categoryBreakdown()
  const sources = await listSources()

  const recent = await all<{
    actor: string
    action: string
    target: string
    detail: string
    created_at: string
  }>('SELECT actor, action, target, detail, created_at FROM audit_log ORDER BY id DESC LIMIT 14')

  const maxAdded = Math.max(1, ...series.map((s) => s.added))
  const maxCat = Math.max(1, ...categories.map((c) => c.count))

  return (
    <div className="space-y-10">
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile label="Listed" value={formatNumber(stats.approved)} tone="neutral" href="/admin/sites" />
        <Tile
          label="Awaiting review"
          value={formatNumber(stats.pending)}
          tone={stats.pending > 0 ? 'accent' : 'neutral'}
          href="/admin/queue"
        />
        <Tile
          label="Open reports"
          value={formatNumber(stats.openReports)}
          tone={stats.openReports > 0 ? 'warning' : 'neutral'}
          href="/admin/reports"
        />
        <Tile
          label="Failed jobs"
          value={formatNumber(jobs.failed)}
          tone={jobs.failed > 0 ? 'danger' : 'neutral'}
          href="/admin/jobs"
        />
      </section>

      <section className="rounded-2xl border border-line bg-surface p-5">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-xl">Pipeline</h2>
            <p className="mt-0.5 text-sm text-muted">
              {formatNumber(stats.candidatesQueued)} candidate URLs waiting · {jobs.queued} jobs queued ·{' '}
              {jobs.running} running
            </p>
          </div>
          <form action={runWorkerTickAction}>
            <button
              type="submit"
              className="inline-flex h-9 items-center gap-2 rounded-xl bg-ink px-4 text-sm font-medium text-canvas transition-opacity hover:opacity-90"
            >
              <Play className="h-3.5 w-3.5" />
              Run a worker tick
            </button>
          </form>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          {sources.slice(0, 6).map((source) => (
            <div key={source.id} className="rounded-xl border border-line bg-canvas p-3">
              <div className="flex items-start justify-between gap-2">
                <p className="truncate text-sm font-medium">{source.name}</p>
                <Badge tone={source.enabled ? 'positive' : 'neutral'}>{source.enabled ? 'on' : 'off'}</Badge>
              </div>
              <p className="mt-1 font-mono text-2xs text-faint">
                {source.last_run_at ? `ran ${timeAgo(source.last_run_at)}` : 'never run'} ·{' '}
                {formatNumber(source.found_total)} found
              </p>
              {source.last_result && (
                <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-muted">{source.last_result}</p>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-line bg-surface p-5">
          <h2 className="eyebrow mb-4">Sites added, last 30 days</h2>
          <div className="flex h-32 items-end gap-[3px]">
            {series.map((point) => (
              <div key={point.day} className="group relative flex-1" title={`${point.day}: ${point.added} added`}>
                <div
                  className="w-full rounded-sm bg-accent/70 transition-colors group-hover:bg-accent"
                  style={{ height: `${Math.max(2, (point.added / maxAdded) * 128)}px` }}
                />
              </div>
            ))}
          </div>
          <div className="mt-2 flex justify-between font-mono text-2xs text-faint">
            <span>{series[0]?.day}</span>
            <span>{series[series.length - 1]?.day}</span>
          </div>
        </div>

        <div className="rounded-2xl border border-line bg-surface p-5">
          <h2 className="eyebrow mb-4">Catalogue by shelf</h2>
          <ul className="space-y-2">
            {categories.slice(0, 8).map((category) => (
              <li key={category.slug} className="flex items-center gap-3">
                <span className="w-36 shrink-0 truncate text-sm text-muted">{category.name}</span>
                <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-line">
                  <span
                    className="block h-full rounded-full"
                    style={{
                      width: `${(category.count / maxCat) * 100}%`,
                      background: `hsl(${category.hue} 60% 55%)`,
                    }}
                  />
                </span>
                <span className="w-8 shrink-0 text-right font-mono text-2xs text-faint">{category.count}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="rounded-2xl border border-line bg-surface p-5">
        <h2 className="eyebrow mb-4">Recent activity</h2>
        {recent.length === 0 ? (
          <p className="text-sm text-muted">Nothing logged yet.</p>
        ) : (
          <ul className="divide-y divide-line">
            {recent.map((entry, i) => (
              <li key={i} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 py-2.5 text-sm">
                <span className="font-mono text-2xs uppercase tracking-wider text-faint">{entry.actor}</span>
                <span className="text-ink-soft">{entry.action}</span>
                {entry.target && <span className="font-mono text-xs text-muted">{entry.target}</span>}
                {entry.detail && <span className="text-xs text-faint">{entry.detail}</span>}
                <span className="ml-auto font-mono text-2xs text-faint">{timeAgo(entry.created_at)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

function Tile({
  label,
  value,
  tone,
  href,
}: {
  label: string
  value: string
  tone: 'neutral' | 'accent' | 'warning' | 'danger'
  href: string
}) {
  const tones = {
    neutral: 'border-line',
    accent: 'border-accent/40 bg-accent/[0.04]',
    warning: 'border-warning/40 bg-warning/[0.04]',
    danger: 'border-danger/40 bg-danger/[0.04]',
  }
  return (
    <Link
      href={href}
      className={`rounded-2xl border bg-surface p-4 no-underline transition-colors hover:border-line-strong ${tones[tone]}`}
    >
      <p className="eyebrow">{label}</p>
      <p className="mt-2 font-display text-3xl leading-none">{value}</p>
    </Link>
  )
}
