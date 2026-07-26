import { banner, colours, log } from './_boot'
import { all, get, run, ready } from '../src/lib/db'
import { registerAllHandlers, scheduleDueWork } from '../src/lib/handlers'
import { drain, jobCounts } from '../src/lib/jobs'
import { listSources, recordSourceRun, runSource } from '../src/lib/sources'
import { drainCandidates } from '../src/lib/ingest'

/**
 * Run every enabled discovery source once, then process the resulting queue.
 *   npm run discover -- --jobs 40
 */

const args = process.argv.slice(2)
const jobsIndex = args.indexOf('--jobs')
const maxJobs = jobsIndex >= 0 ? Number(args[jobsIndex + 1]) || 30 : 30

banner('Portico — discover')

await ready()
registerAllHandlers()

const main = async () => {
  const sources = (await listSources()).filter((s) => s.enabled)
  log(`running ${sources.length} enabled source(s)`)

  for (const source of sources) {
    try {
      const result = await runSource(source)
      await recordSourceRun(source.id, result)
      log(`${colours.green}✓${colours.reset} ${colours.bold}${source.name}${colours.reset} ${colours.dim}— ${result.detail}${colours.reset}`)
    } catch (err) {
      log(`${colours.red}✗${colours.reset} ${source.name} — ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  const promoted = await drainCandidates(maxJobs)
  log(`promoted ${promoted} candidate(s) into the ingest queue`)

  await scheduleDueWork()

  log(`${colours.dim}processing up to ${maxJobs} job(s)…${colours.reset}`)
  const { ran, results } = await drain(maxJobs)
  for (const line of results) log(colours.dim + line + colours.reset)

  const counts = await jobCounts()
  log(
    `${colours.green}done${colours.reset} — ${ran} job(s) run · ` +
      `${counts.queued} still queued · ${counts.failed} failed`,
  )
  log(`${colours.dim}run \`npm run worker\` to keep discovering continuously.${colours.reset}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
