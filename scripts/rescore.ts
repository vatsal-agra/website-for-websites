import { banner, colours, log } from './_boot'
import { all, ready } from '../src/lib/db'
import { enqueue, jobCounts } from '../src/lib/jobs'

/**
 * Queue a re-crawl of every site that has never been checked, so its quality
 * score comes from evidence on the page rather than the seeder's placeholder.
 * The worker processes the queue at crawl-polite speed.
 *
 *   npx tsx scripts/rescore.ts [--all]
 */

const everything = process.argv.includes('--all')

banner('Portico — rescore')
await ready()

const rows = await all<{ id: number; slug: string }>(
  everything
    ? `SELECT id, slug FROM sites WHERE status = 'approved' ORDER BY quality DESC`
    : `SELECT id, slug FROM sites WHERE status = 'approved' AND checked_at IS NULL ORDER BY id`,
)

let queued = 0
for (const row of rows) {
  const id = await enqueue(
    'site.recheck',
    { siteId: Number(row.id) },
    { dedupeKey: `recheck:${row.id}`, priority: 0, rerunFinished: true },
  )
  if (id) queued++
}

const counts = await jobCounts()
log(`${colours.green}✓${colours.reset} queued ${queued} re-crawl(s) of ${rows.length} candidate(s)`)
log(`${colours.dim}queue now: ${counts.queued} waiting — run \`npm run worker\` to process it${colours.reset}`)
