import { banner, colours, log } from './_boot'
import { all, get, ready } from '../src/lib/db'
import { getStats } from '../src/lib/queries/stats'
import { searchSites, trendingSites } from '../src/lib/queries/sites'

/** Quick health readout of the catalogue: `npm run inspect` */

banner('web-amble — inspect')
await ready()

const stats = await getStats()
log(
  `${colours.bold}${stats.approved}${colours.reset} approved · ${stats.pending} pending · ` +
    `${stats.rejected} rejected · ${stats.collections} collections · ${stats.candidatesQueued} candidates queued`,
)
log(`jobs: ${stats.jobsQueued} queued, ${stats.jobsFailed} failed · reports: ${stats.openReports} open`)

const thumbs = await all<{ thumb_source: string; n: number }>(
  `SELECT thumb_source, COUNT(*)::int n FROM sites WHERE status = 'approved' GROUP BY thumb_source`,
)
log(`cover art: ${thumbs.map((t) => `${t.n} ${t.thumb_source}`).join(', ')}`)

const checked = await get<{ n: number }>(
  `SELECT COUNT(*)::int n FROM sites WHERE status = 'approved' AND checked_at IS NOT NULL`,
)
log(`${Number(checked?.n ?? 0)}/${stats.approved} have an evidence-based quality score`)

const byCategory = await all<{ name: string; n: number }>(
  `SELECT c.name, COUNT(s.id) n FROM categories c
   LEFT JOIN sites s ON s.category_id = c.id AND s.status = 'approved'
   GROUP BY c.id ORDER BY n DESC`,
)

console.log()
for (const row of byCategory) {
  const bar = '▊'.repeat(Math.max(0, Math.round(Number(row.n) / 2)))
  console.log(`  ${row.name.padEnd(22)} ${String(row.n).padStart(3)} ${colours.dim}${bar}${colours.reset}`)
}

console.log()
log(`${colours.bold}top of the catalogue right now${colours.reset}`)
for (const site of await trendingSites(5)) {
  console.log(
    `  ${colours.dim}${site.trending.toFixed(2)}${colours.reset}  ${site.title.padEnd(34).slice(0, 34)} ` +
      `${colours.dim}q${site.quality.toFixed(2)} · ${site.votes} votes · ${site.category?.name ?? '—'}${colours.reset}`,
  )
}

console.log()
const results = await searchSites('interactive maths', 4)
log(`search "interactive maths" → ${results.map((r) => r.title).join(', ') || 'no hits'}`)

const failing = await all<{ type: string; error: string }>(
  `SELECT type, error FROM jobs WHERE status = 'failed' LIMIT 5`,
)
if (failing.length) {
  console.log()
  for (const f of failing) log(`${colours.red}failed${colours.reset} ${f.type}: ${f.error}`)
}
console.log()
