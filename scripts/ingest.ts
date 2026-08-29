import { banner, colours, log } from './_boot'
import { all, get, run, ready } from '../src/lib/db'
import { ingestUrl } from '../src/lib/ingest'
import { registerAllHandlers } from '../src/lib/handlers'
import { drain } from '../src/lib/jobs'

/**
 * Ingest one or more URLs directly from the command line.
 *   npm run ingest -- https://example.dev https://another.site --approve
 */

const args = process.argv.slice(2)
const approve = args.includes('--approve')
const urls = args.filter((a) => !a.startsWith('--'))

banner('web-amble — ingest')

if (!urls.length) {
  console.log(`  usage: ${colours.cyan}npm run ingest -- <url> [<url>…] [--approve]${colours.reset}\n`)
  process.exit(1)
}

await ready()
registerAllHandlers()

const main = async () => {
  for (const url of urls) {
    const outcome = await ingestUrl({
      url,
      source: 'manual',
      forceStatus: approve ? 'approved' : undefined,
      allowDeep: true,
    })
    if (outcome.ok) {
      log(
        `${colours.green}✓${colours.reset} ${colours.bold}${outcome.title}${colours.reset} ` +
          `${colours.dim}/site/${outcome.slug} · ${outcome.status} · quality ${outcome.quality}${colours.reset}`,
      )
    } else {
      log(`${colours.yellow}✗${colours.reset} ${url} ${colours.dim}— ${outcome.stage}: ${outcome.reason}${colours.reset}`)
    }
  }

  log(`${colours.dim}running queued jobs (cover art)…${colours.reset}`)
  const { ran, results } = await drain(urls.length * 2 + 2)
  for (const line of results) log(colours.dim + line + colours.reset)
  log(`${colours.green}done${colours.reset} — ${ran} job(s) processed`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
