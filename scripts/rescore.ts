import { banner, colours, log } from './_boot'
import { get, ready, run } from '../src/lib/db'
import { jobCounts } from '../src/lib/jobs'

/**
 * Queue a re-crawl of every site so its quality score comes from evidence on
 * the page under the current scorer, rather than whatever the seeder or an
 * older version of `scoreQuality` left behind. The worker processes the queue
 * at crawl-polite speed.
 *
 *   npx tsx scripts/rescore.ts          # only sites never checked
 *   npx tsx scripts/rescore.ts --all    # everything
 *
 * This is one statement rather than a loop. Enqueuing through `enqueue()` costs
 * three round trips per job, and against a network database five hundred sites
 * took the better part of ten minutes to schedule — longer than it takes the
 * worker to get through a good chunk of them.
 */

const everything = process.argv.includes('--all')

banner('web-amble — rescore')
await ready()

// Pending entries are included: a re-check re-runs the content screen, so
// anything that is a login page or an interstitial retires itself instead of
// waiting for a moderator to work out what they are looking at.
const scope = `status IN ('approved', 'pending')`
const filter = everything ? '' : 'AND checked_at IS NULL'

// Anything already waiting keeps its place; a finished job for the same site is
// replaced, which is what makes a second `--all` run do something.
await run(
  `DELETE FROM jobs
   WHERE type = 'site.recheck' AND status NOT IN ('queued', 'running')
     AND dedupe_key IN (SELECT 'recheck:' || id FROM sites WHERE ${scope} ${filter})`,
)

const result = await run(
  `INSERT INTO jobs (type, payload, dedupe_key, priority, run_at, max_attempts)
   SELECT 'site.recheck',
          json_build_object('siteId', id)::text,
          'recheck:' || id,
          0,
          to_char(now() at time zone 'utc', 'YYYY-MM-DD HH24:MI:SS'),
          3
   FROM sites
   WHERE ${scope} ${filter}
   ON CONFLICT (dedupe_key) DO NOTHING`,
)

const candidates = await get<{ n: number }>(
  `SELECT COUNT(*)::int AS n FROM sites WHERE ${scope} ${filter}`,
)
const counts = await jobCounts()

log(`${colours.green}✓${colours.reset} queued ${result.rowsAffected} re-crawl(s) of ${candidates?.n ?? 0} candidate(s)`)
log(`${colours.dim}queue now: ${counts.queued} waiting — run \`npm run worker\` to process it${colours.reset}`)
