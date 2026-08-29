import { all } from '@/lib/db'
import { listSources } from '@/lib/sources'
import { formatNumber } from '@/lib/utils'
import { Badge } from '@/components/ui/primitives'
import { deleteSourceAction, runSourceAction, toggleSourceAction, removeBlocklistAction } from '@/lib/actions/admin'
import { NewSourceForm, BlocklistForm } from './forms'
import { RelativeTime } from '@/components/relative-time'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Discovery' }

export default async function SourcesPage() {
  const [sources, candidates, recentSkips, blocklist] = await Promise.all([
    listSources(),
    all<{ status: string; n: number }>(`SELECT status, COUNT(*)::int AS n FROM candidates GROUP BY status`),
    all<{ url: string; note: string }>(
      `SELECT url, note FROM candidates WHERE status = 'skipped' AND note != '' ORDER BY id DESC LIMIT 8`,
    ),
    all<{ id: number; pattern: string; reason: string; created_at: string }>(
      'SELECT id, pattern, reason, created_at FROM blocklist ORDER BY created_at DESC',
    ),
  ])

  return (
    <div className="space-y-10">
      <section>
        <header className="mb-4">
          <h2 className="font-display text-2xl">Discovery sources</h2>
          <p className="mt-1 text-sm text-muted">
            Where new candidates come from. The worker polls each one on its own interval; “Run now” does it
            immediately and processes a few jobs synchronously.
          </p>
        </header>

        <div className="space-y-2">
          {sources.map((source) => (
            <div key={source.id} className="rounded-2xl border border-line bg-surface p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-medium">{source.name}</h3>
                    <Badge tone={source.enabled ? 'positive' : 'neutral'}>{source.enabled ? 'enabled' : 'paused'}</Badge>
                    <Badge>{source.kind}</Badge>
                  </div>
                  {source.url && <p className="mt-1 truncate font-mono text-2xs text-faint">{source.url}</p>}
                  <p className="mt-1.5 font-mono text-2xs text-faint">
                    every {source.interval_min} min ·{' '}
                    {source.last_run_at ? <>last run <RelativeTime value={source.last_run_at} /></> : 'never run'} ·{' '}
                    {formatNumber(source.found_total)} domains found
                  </p>
                  {source.last_result && (
                    <p className="mt-2 text-xs leading-relaxed text-muted">{source.last_result}</p>
                  )}
                </div>

                <div className="flex shrink-0 gap-1.5">
                  <form action={runSourceAction}>
                    <input type="hidden" name="id" value={source.id} />
                    <button className="rounded-lg bg-ink px-3 py-1.5 text-xs font-medium text-canvas">Run now</button>
                  </form>
                  <form action={toggleSourceAction}>
                    <input type="hidden" name="id" value={source.id} />
                    <input type="hidden" name="enabled" value={source.enabled ? '0' : '1'} />
                    <button className="rounded-lg border border-line px-3 py-1.5 text-xs text-muted transition-colors hover:text-ink">
                      {source.enabled ? 'Pause' : 'Enable'}
                    </button>
                  </form>
                  <form action={deleteSourceAction}>
                    <input type="hidden" name="id" value={source.id} />
                    <button className="rounded-lg border border-danger/30 px-3 py-1.5 text-xs text-danger transition-colors hover:bg-danger/10">
                      Remove
                    </button>
                  </form>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4">
          <NewSourceForm />
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-line bg-surface p-5">
          <h2 className="eyebrow mb-4">Candidate pool</h2>
          <ul className="space-y-2">
            {candidates.length === 0 && <li className="text-sm text-muted">Nothing discovered yet.</li>}
            {candidates.map((row) => (
              <li key={row.status} className="flex items-center justify-between text-sm">
                <span className="capitalize text-muted">{row.status}</span>
                <span className="font-mono text-xs text-faint">{formatNumber(row.n)}</span>
              </li>
            ))}
          </ul>

          {recentSkips.length > 0 && (
            <>
              <h3 className="eyebrow mb-2 mt-6">Recently skipped, and why</h3>
              <ul className="space-y-2">
                {recentSkips.map((skip, i) => (
                  <li key={i} className="text-xs">
                    <p className="truncate font-mono text-faint">{skip.url}</p>
                    <p className="text-muted">{skip.note}</p>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>

        <div className="rounded-2xl border border-line bg-surface p-5">
          <h2 className="eyebrow mb-4">Blocklist</h2>
          <BlocklistForm />
          <ul className="mt-4 space-y-1.5">
            {blocklist.length === 0 && <li className="text-sm text-muted">Nothing blocked.</li>}
            {blocklist.map((entry) => (
              <li key={entry.id} className="flex items-center justify-between gap-3 text-sm">
                <span className="min-w-0">
                  <span className="block truncate font-mono text-xs">{entry.pattern}</span>
                  {entry.reason && <span className="block text-2xs text-faint">{entry.reason}</span>}
                </span>
                <form action={removeBlocklistAction}>
                  <input type="hidden" name="id" value={entry.id} />
                  <button className="shrink-0 text-2xs text-faint transition-colors hover:text-danger">remove</button>
                </form>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  )
}
