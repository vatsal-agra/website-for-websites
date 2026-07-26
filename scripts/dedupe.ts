import { banner, colours, log } from './_boot'
import { all, nowIso, ready, run } from '../src/lib/db'
import { rootDomain } from '../src/lib/url'
import { recomputeTrending } from '../src/lib/queries/sites'

/**
 * Collapse organisations that ended up with several entries.
 *
 * Automatic discovery used to harvest subdomains of sites already catalogued,
 * so NASA arrived four times. Within each registrable domain this keeps the
 * strongest entry and sends the rest back to the review queue — not the bin,
 * because some subdomains genuinely deserve their own listing.
 *
 * Curated founding entries and editor-locked shelves always win and are never
 * demoted.
 *
 *   npx tsx scripts/dedupe.ts [--dry]
 */

const dry = process.argv.includes('--dry')

banner(`Portico — dedupe${dry ? ' (dry run)' : ''}`)
await ready()

interface Row {
  id: number
  title: string
  domain: string
  source: string
  quality: number
  status: string
  category_locked: number
}

const sites = await all<Row>(
  `SELECT id, title, domain, source, quality, status, category_locked
   FROM sites WHERE status IN ('approved','pending')`,
)

const byRoot = new Map<string, Row[]>()
for (const site of sites) {
  const root = rootDomain(site.domain)
  const group = byRoot.get(root) ?? []
  group.push(site)
  byRoot.set(root, group)
}

let groups = 0
let demoted = 0

for (const [root, group] of byRoot) {
  if (group.length < 2) continue
  groups++

  // rank: curated first, then apex domain, then quality
  const ranked = [...group].sort((a, b) => {
    const seed = Number(b.source === 'seed') - Number(a.source === 'seed')
    if (seed) return seed
    const locked = Number(b.category_locked) - Number(a.category_locked)
    if (locked) return locked
    const apex = Number(b.domain === root) - Number(a.domain === root)
    if (apex) return apex
    return Number(b.quality) - Number(a.quality)
  })

  const keeper = ranked[0]
  log(`${colours.bold}${root}${colours.reset} ${colours.dim}— keeping ${keeper.title}${colours.reset}`)

  for (const site of ranked.slice(1)) {
    if (site.source === 'seed' || Number(site.category_locked)) {
      log(`  ${colours.dim}· keeping curated ${site.title} (${site.domain})${colours.reset}`)
      continue
    }
    if (site.status === 'pending') continue
    log(`  ${colours.yellow}→ review${colours.reset} ${site.title} ${colours.dim}(${site.domain})${colours.reset}`)
    if (!dry) {
      await run(`UPDATE sites SET status = 'pending', editor_note = ?, updated_at = ? WHERE id = ?`, [
        `Same organisation as “${keeper.title}” (${keeper.domain}). Keep only if it is a genuinely distinct destination.`,
        nowIso(),
        Number(site.id),
      ])
    }
    demoted++
  }
}

if (!dry) await recomputeTrending()

console.log()
log(
  `${colours.green}✓${colours.reset} ${groups} organisation(s) with more than one entry · ` +
    `${demoted} sent to review${dry ? ' (dry run — nothing written)' : ''}`,
)
console.log()
