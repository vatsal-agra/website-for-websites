import { banner, colours, log } from './_boot'
import { all, audit, get, ready } from '../src/lib/db'
import { setStatus, invalidateCategoryCache } from '../src/lib/queries/sites'
import { enqueue } from '../src/lib/jobs'
import { addBlocklistEntry } from '../src/lib/safety'

/**
 * Work the review queue from a file of decisions.
 *
 * Moderation is a judgement call and the admin console is where it belongs —
 * but a queue that has built up while nobody was watching is faster to clear in
 * one pass, and a file of decisions can be read and argued with in a way that
 * fifty clicks cannot.
 *
 * Each line is `id verdict reason`. Anything not listed is left alone.
 *
 *   npx tsx scripts/triage.ts decisions.txt [--dry]
 *
 * Verdicts:
 *   approve            list it
 *   reject <reason>    decline it; the reason shows on the submitter's profile
 *   block <reason>     decline it and blocklist the domain, so the crawler
 *                      does not find it again
 */

const dry = process.argv.includes('--dry')
const file = process.argv.slice(2).find((a) => !a.startsWith('--'))

if (!file) {
  console.error('usage: npx tsx scripts/triage.ts <decisions-file> [--dry]')
  process.exit(1)
}

const { readFileSync } = await import('node:fs')

interface Decision {
  id: number
  verdict: 'approve' | 'reject' | 'block'
  reason: string
}

const decisions: Decision[] = []
for (const raw of readFileSync(file, 'utf8').split('\n')) {
  const line = raw.trim()
  if (!line || line.startsWith('#')) continue
  const [idPart, verdictPart, ...rest] = line.split(/\s+/)
  const id = Number(idPart)
  const verdict = verdictPart as Decision['verdict']
  if (!Number.isFinite(id) || !['approve', 'reject', 'block'].includes(verdict)) {
    console.error(`skipping unparseable line: ${line}`)
    continue
  }
  decisions.push({ id, verdict, reason: rest.join(' ') })
}

banner(`web-amble — triage ${decisions.length} decision(s)${dry ? ' (dry run)' : ''}`)
await ready()

let approved = 0
let rejected = 0
let blocked = 0

for (const decision of decisions) {
  const site = await get<{ id: number; slug: string; domain: string; title: string; status: string }>(
    'SELECT id, slug, domain, title, status FROM sites WHERE id = ?',
    [decision.id],
  )
  if (!site) {
    log(`${colours.yellow}?${colours.reset} ${decision.id} — no such entry`)
    continue
  }
  // Usually the queue, but a decision can also retire something already live —
  // entries auto-approved under an older, more credulous scorer have to be
  // removable by the same route, with the same reason recorded.
  const target = decision.verdict === 'approve' ? 'approved' : 'rejected'
  if (site.status === target) {
    log(`${colours.dim}·${colours.reset} ${site.domain} is already ${site.status}, leaving it`)
    continue
  }
  if (site.status !== 'pending') {
    log(`${colours.yellow}!${colours.reset} ${site.domain} is ${site.status}, not queued — ${decision.verdict}ing anyway`)
  }

  const mark =
    decision.verdict === 'approve'
      ? `${colours.green}✓ list  ${colours.reset}`
      : `${colours.red}✗ ${decision.verdict === 'block' ? 'block' : 'decline'}${colours.reset}`
  log(`${mark} ${site.domain.padEnd(30)} ${colours.dim}${decision.reason}${colours.reset}`)
  if (dry) continue

  if (decision.verdict === 'approve') {
    await setStatus(site.id, 'approved')
    // cover art is only fetched once an entry is live, so it has to be asked for here
    await enqueue('site.thumbnail', { siteId: site.id }, { dedupeKey: `thumb:${site.id}`, priority: 3, rerunFinished: true })
    audit('site.approved', site.slug, 'triage', '@admin')
    approved++
  } else {
    await setStatus(site.id, 'rejected', decision.reason || 'does not meet the listing guidelines')
    audit('site.rejected', site.slug, decision.reason, '@admin')
    rejected++
    if (decision.verdict === 'block') {
      await addBlocklistEntry(site.domain, decision.reason || 'declined at review')
      blocked++
    }
  }
}

if (!dry) invalidateCategoryCache()

console.log()
log(`${colours.green}${approved} listed${colours.reset} · ${rejected} declined · ${blocked} domain(s) blocklisted`)
const left = await all<{ n: number }>(`SELECT COUNT(*)::int AS n FROM sites WHERE status = 'pending'`)
log(`${colours.dim}${left[0]?.n ?? 0} still waiting in the queue${colours.reset}`)
console.log()
process.exit(0)
