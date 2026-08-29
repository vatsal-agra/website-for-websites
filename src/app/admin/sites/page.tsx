import Link from 'next/link'
import { all } from '@/lib/db'
import { listSites, listCategories } from '@/lib/queries/sites'
import { displayUrl } from '@/lib/url'
import { formatNumber, timeAgo } from '@/lib/utils'
import { Badge, EmptyState } from '@/components/ui/primitives'
import { SiteMark } from '@/components/site/favicon'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'All sites' }

const STATUSES = ['approved', 'pending', 'rejected', 'archived'] as const

export default async function AdminSitesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string; category?: string; page?: string }>
}) {
  const params = await searchParams
  const status = (STATUSES as readonly string[]).includes(params.status ?? '') ? params.status! : 'approved'
  const page = Math.max(1, Number(params.page ?? 1) || 1)

  const result = await listSites({
    status,
    q: params.q,
    category: params.category,
    sort: 'new',
    page,
    perPage: 30,
  })

  const categories = await listCategories()
  const counts = Object.fromEntries(
    (await all<{ status: string; n: number }>('SELECT status, COUNT(*)::int AS n FROM sites GROUP BY status')).map((r) => [
      r.status,
      Number(r.n),
    ]),
  )

  const buildHref = (patch: Record<string, string | undefined>) => {
    const next = new URLSearchParams()
    const merged = { status, q: params.q, category: params.category, ...patch }
    for (const [key, value] of Object.entries(merged)) if (value) next.set(key, value)
    return `/admin/sites?${next.toString()}`
  }

  return (
    <div>
      <header className="mb-6">
        <h2 className="font-display text-2xl">All sites</h2>
        <p className="mt-1 text-sm text-muted">{formatNumber(result.total)} entries with this filter.</p>
      </header>

      <form className="mb-4 flex flex-wrap gap-2" action="/admin/sites">
        <input type="hidden" name="status" value={status} />
        <input
          name="q"
          defaultValue={params.q ?? ''}
          placeholder="Search titles, domains, descriptions…"
          className="h-9 min-w-52 flex-1 rounded-lg border border-line bg-surface px-3 text-sm outline-none placeholder:text-faint focus:border-line-strong"
        />
        <select
          name="category"
          defaultValue={params.category ?? ''}
          className="h-9 rounded-lg border border-line bg-surface px-2 text-sm text-muted outline-none"
        >
          <option value="">Every shelf</option>
          {categories.map((c) => (
            <option key={c.id} value={c.slug}>
              {c.name}
            </option>
          ))}
        </select>
        <button type="submit" className="h-9 rounded-lg bg-ink px-4 text-sm font-medium text-canvas">
          Filter
        </button>
      </form>

      <div className="mb-5 flex flex-wrap gap-1.5">
        {STATUSES.map((s) => (
          <Link
            key={s}
            href={buildHref({ status: s, page: undefined })}
            className={`rounded-full px-3 py-1.5 font-mono text-2xs uppercase tracking-wider no-underline transition-colors ${
              s === status ? 'bg-ink text-canvas' : 'bg-raised text-muted hover:text-ink'
            }`}
          >
            {s}
            <span className="ml-1.5 opacity-60">{counts[s] ?? 0}</span>
          </Link>
        ))}
      </div>

      {result.sites.length === 0 ? (
        <EmptyState title="No sites match" description="Try a different status or clear the search." />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-line">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-line bg-surface">
                <th className="px-3 py-2.5 text-left font-mono text-2xs uppercase tracking-wider text-faint">Site</th>
                <th className="hidden px-3 py-2.5 text-left font-mono text-2xs uppercase tracking-wider text-faint md:table-cell">
                  Shelf
                </th>
                <th className="px-3 py-2.5 text-right font-mono text-2xs uppercase tracking-wider text-faint">Q</th>
                <th className="hidden px-3 py-2.5 text-right font-mono text-2xs uppercase tracking-wider text-faint sm:table-cell">
                  Votes
                </th>
                <th className="hidden px-3 py-2.5 text-right font-mono text-2xs uppercase tracking-wider text-faint lg:table-cell">
                  Added
                </th>
                <th className="px-3 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {result.sites.map((site) => (
                <tr key={site.id} className="border-b border-line last:border-0 hover:bg-surface">
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2.5">
                      <SiteMark site={site} size={26} />
                      <div className="min-w-0">
                        <p className="truncate font-medium">{site.title}</p>
                        <p className="truncate font-mono text-2xs text-faint">{displayUrl(site.url, 40)}</p>
                      </div>
                    </div>
                  </td>
                  <td className="hidden px-3 py-2.5 text-muted md:table-cell">
                    {site.category?.name ?? <span className="text-faint">—</span>}
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <Badge tone={site.quality >= 0.7 ? 'positive' : site.quality >= 0.5 ? 'warning' : 'danger'}>
                      {site.quality.toFixed(2)}
                    </Badge>
                  </td>
                  <td className="hidden px-3 py-2.5 text-right font-mono text-xs text-muted sm:table-cell">
                    {site.votes}
                  </td>
                  <td className="hidden px-3 py-2.5 text-right font-mono text-2xs text-faint lg:table-cell">
                    {timeAgo(site.published_at ?? site.created_at)}
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <Link
                      href={`/admin/sites/${site.id}`}
                      className="text-xs text-muted no-underline transition-colors hover:text-ink"
                    >
                      Edit
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {result.pages > 1 && (
        <nav className="mt-6 flex flex-wrap justify-center gap-1.5">
          {Array.from({ length: Math.min(result.pages, 30) }, (_, i) => i + 1).map((n) => (
            <Link
              key={n}
              href={buildHref({ page: String(n) })}
              className={`flex h-8 min-w-8 items-center justify-center rounded-lg px-2 font-mono text-2xs no-underline ${
                n === result.page ? 'bg-ink text-canvas' : 'text-muted hover:bg-raised'
              }`}
            >
              {n}
            </Link>
          ))}
        </nav>
      )}
    </div>
  )
}
