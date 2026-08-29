import { banner, colours, log } from '../scripts/_boot'
import { env } from '../src/lib/env'
import { ready } from '../src/lib/db'
import { drain, jobCounts, requeueStalled } from '../src/lib/jobs'
import { registerAllHandlers, scheduleDueWork } from '../src/lib/handlers'

/**
 * web-amble's background worker.
 *
 * It keeps the catalogue alive: polling discovery sources, ingesting candidate
 * URLs, generating cover art, re-checking known sites and re-scoring trending.
 * Run it alongside `npm run dev` with `npm run worker`.
 *
 * On Netlify there is no long-running process, so the same work is driven by a
 * scheduled function calling /api/worker instead — see netlify/functions.
 */

let running = true
let tickCount = 0

async function tick() {
  tickCount++
  const scheduled = await scheduleDueWork()
  if (scheduled.sources || scheduled.maintenance) {
    log(
      `${colours.cyan}scheduler${colours.reset} queued ${scheduled.sources} source run(s), ${scheduled.maintenance} maintenance job(s)`,
    )
  }

  const { ran, results } = await drain(6)
  for (const line of results) {
    const ok = line.startsWith('✓')
    log(`${ok ? colours.green : colours.yellow}${line}${colours.reset}`)
  }

  if (tickCount % 30 === 0) {
    const unstuck = await requeueStalled()
    if (unstuck) log(`${colours.yellow}re-queued ${unstuck} stalled job(s)${colours.reset}`)
    const counts = await jobCounts()
    log(
      `${colours.dim}queue: ${counts.queued} queued · ${counts.running} running · ${counts.done} done · ${counts.failed} failed${colours.reset}`,
    )
  }

  return ran
}

async function main() {
  banner('web-amble worker')
  await ready()
  registerAllHandlers()

  if (!env.workerEnabled) {
    log(`${colours.yellow}WORKER_ENABLED=0 — exiting.${colours.reset}`)
    return
  }

  const counts = await jobCounts()
  const host = env.databaseUrl.replace(/^.*@/, '').replace(/\/.*$/, '')
  log(
    `database ${colours.dim}${host}${colours.reset} · ` +
      `tick ${env.workerTickMs}ms · ${counts.queued} job(s) waiting`,
  )
  log(`${colours.dim}Ctrl-C to stop.${colours.reset}`)

  while (running) {
    try {
      const ran = await tick()
      // back off when idle so we are not spinning the disk for nothing
      await new Promise((r) => setTimeout(r, ran > 0 ? env.workerTickMs : env.workerTickMs * 3))
    } catch (err) {
      log(`${colours.red}tick failed: ${err instanceof Error ? err.message : String(err)}${colours.reset}`)
      await new Promise((r) => setTimeout(r, 5000))
    }
  }
}

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    if (!running) process.exit(0)
    running = false
    log(`${colours.yellow}stopping…${colours.reset}`)
    setTimeout(() => process.exit(0), 500)
  })
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
