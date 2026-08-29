import { banner, colours, log } from './_boot'
import { all, get, ready } from '../src/lib/db'
import { enqueue, jobCounts } from '../src/lib/jobs'

/**
 * Re-file crawled sites against the current classifier lexicon.
 *
 * Classification needs the full page text, and only a fraction of that is kept
 * in the database, so re-filing means re-crawling: this queues `site.recheck`
 * jobs and the worker re-classifies each page as it refetches it.
 *
 * Never touches the curated founding set, and never overrides a shelf an editor
 * has chosen by hand (`category_locked`).
 *
 *   npx tsx scripts/reclassify.ts [--limit 100]
 */

const limitIndex = process.argv.indexOf('--limit')
const limit = limitIndex >= 0 ? Number(process.argv[limitIndex + 1]) || 0 : 0

banner('web-amble — reclassify')
await ready()

const sites = await all<{ id: number; title: string }>(
  `SELECT id, title FROM sites
   WHERE source != 'seed' AND category_locked = 0 AND status IN ('approved','pending')
   ORDER BY quality DESC ${limit ? 'LIMIT ?' : ''}`,
  limit ? [limit] : [],
)

let queued = 0
for (const site of sites) {
  const id = await enqueue(
    'site.recheck',
    { siteId: Number(site.id) },
    { dedupeKey: `recheck:${site.id}`, priority: 0, rerunFinished: true },
  )
  if (id) queued++
}

const locked = Number(
  (await get<{ n: number }>(`SELECT COUNT(*)::int n FROM sites WHERE category_locked = 1`))?.n ?? 0,
)
const seeded = Number((await get<{ n: number }>(`SELECT COUNT(*)::int n FROM sites WHERE source = 'seed'`))?.n ?? 0)
const counts = await jobCounts()

log(`${colours.green}✓${colours.reset} queued ${queued} re-crawl(s)`)
log(`${colours.dim}left alone: ${seeded} curated founding entries, ${locked} editor-locked shelves${colours.reset}`)
log(`${colours.dim}queue now: ${counts.queued} waiting — run \`npm run worker\` to process it${colours.reset}`)
