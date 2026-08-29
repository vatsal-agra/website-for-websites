import Link from 'next/link'
import { Flag } from 'lucide-react'
import { all } from '@/lib/db'
import { timeAgo } from '@/lib/utils'
import { Badge, EmptyState } from '@/components/ui/primitives'
import { resolveReportAction } from '@/lib/actions/admin'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Reports' }

const REASON_LABELS: Record<string, string> = {
  broken: 'Broken link',
  'wrong-info': 'Wrong information',
  spam: 'Spam or SEO filler',
  adult: 'Adult or unsafe',
  duplicate: 'Duplicate entry',
  'owner-request': 'Owner asked for removal',
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>
}) {
  const { status = 'open' } = await searchParams
  const [reports, countRows] = await Promise.all([
    all<any>(
      `SELECT r.*, s.slug, s.title, s.domain, s.status AS site_status
       FROM reports r JOIN sites s ON s.id = r.site_id
       WHERE r.status = ? ORDER BY r.created_at DESC LIMIT 100`,
      [status],
    ),
    all<{ status: string; n: number }>('SELECT status, COUNT(*)::int AS n FROM reports GROUP BY status'),
  ])

  const counts = Object.fromEntries(countRows.map((r) => [r.status, Number(r.n)]))

  return (
    <div>
      <header className="mb-6">
        <h2 className="font-display text-2xl">Reports</h2>
        <p className="mt-1 text-sm text-muted">
          Reader-submitted problems. Owner-removal requests should be actioned promptly and the domain blocklisted
          from the site’s edit page.
        </p>
      </header>

      <div className="mb-5 flex gap-1.5">
        {['open', 'resolved', 'dismissed'].map((s) => (
          <Link
            key={s}
            href={`/admin/reports?status=${s}`}
            className={`rounded-full px-3 py-1.5 font-mono text-2xs uppercase tracking-wider no-underline transition-colors ${
              s === status ? 'bg-ink text-canvas' : 'bg-raised text-muted hover:text-ink'
            }`}
          >
            {s}
            <span className="ml-1.5 opacity-60">{counts[s] ?? 0}</span>
          </Link>
        ))}
      </div>

      {reports.length === 0 ? (
        <EmptyState
          icon={<Flag className="h-8 w-8" />}
          title={status === 'open' ? 'No open reports' : `Nothing ${status}`}
          description={status === 'open' ? 'Readers have not flagged anything that needs attention.' : undefined}
        />
      ) : (
        <div className="space-y-3">
          {reports.map((report) => (
            <article key={report.id} className="rounded-2xl border border-line bg-surface p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={report.reason === 'owner-request' ? 'danger' : 'warning'}>
                      {REASON_LABELS[report.reason] ?? report.reason}
                    </Badge>
                    <Link href={`/site/${report.slug}`} className="font-medium no-underline hover:underline">
                      {report.title}
                    </Link>
                    <span className="font-mono text-2xs text-faint">{report.domain}</span>
                  </div>
                  {report.detail && (
                    <p className="mt-2 max-w-prose text-sm leading-relaxed text-muted">“{report.detail}”</p>
                  )}
                  <p className="mt-2 font-mono text-2xs text-faint">
                    {report.reporter} · {timeAgo(report.created_at)} · site is {report.site_status}
                  </p>
                </div>

                <div className="flex shrink-0 flex-wrap gap-1.5">
                  <Link
                    href={`/admin/sites/${report.site_id}`}
                    className="rounded-lg border border-line px-3 py-1.5 text-xs text-muted no-underline transition-colors hover:text-ink"
                  >
                    Open entry
                  </Link>
                  {status === 'open' && (
                    <>
                      <form action={resolveReportAction}>
                        <input type="hidden" name="id" value={report.id} />
                        <input type="hidden" name="status" value="resolved" />
                        <button className="rounded-lg bg-ink px-3 py-1.5 text-xs font-medium text-canvas">
                          Resolved
                        </button>
                      </form>
                      <form action={resolveReportAction}>
                        <input type="hidden" name="id" value={report.id} />
                        <input type="hidden" name="status" value="dismissed" />
                        <button className="rounded-lg border border-line px-3 py-1.5 text-xs text-muted transition-colors hover:text-ink">
                          Dismiss
                        </button>
                      </form>
                    </>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
