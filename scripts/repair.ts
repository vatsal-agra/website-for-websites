import { banner, colours, log } from './_boot'
import { all, get, getSetting, nowIso, ready, run } from '../src/lib/db'
import { cleanTitle } from '../src/lib/metadata'
import { isIndexableUrl, normalizeUrl } from '../src/lib/url'
import { recomputeTrending, reindexSite, uniqueSlug } from '../src/lib/queries/sites'
import { SEED_SITES } from '../src/lib/seed'
import { truncate } from '../src/lib/utils'

/**
 * Housekeeping pass over the whole catalogue:
 *   · correct data invented by earlier builds (back-dates, fabricated votes)
 *   · restore hand-written titles and taglines on seeded entries
 *   · re-tidy crawled titles with the current cleaning rules
 *   · optionally retire entries whose host is no longer eligible
 *   · rebuild the search index and re-score trending
 *
 * Seeded entries were catalogued by hand, so their copy is authoritative and is
 * never rewritten by the automatic tidier — only restored to what a human wrote.
 *
 *   npx tsx scripts/repair.ts [--prune]
 */

const prune = process.argv.includes('--prune')

banner('Portico — repair')
await ready()

// --------------------------------------------- honest founding timestamps --
// An early build of the seeder spread the founding catalogue across a fake
// ninety-day history so the shelves looked lived-in. They were all catalogued
// in one go, so that is the date they should carry — otherwise "Newest" and
// "Trending" describe a past that never happened.
const seededAt = (await getSetting('seeded_at')) || nowIso()
const backdated = await run(
  `UPDATE sites SET published_at = ?, created_at = ?
   WHERE source = 'seed' AND (created_at < ? OR published_at < ?)`,
  [seededAt, seededAt, seededAt, seededAt],
)
if (backdated.rowsAffected) {
  log(`${colours.yellow}corrected${colours.reset} ${backdated.rowsAffected} back-dated founding entries → ${seededAt}`)
}

// ------------------------------------------------------- honest counters --
// Likewise, an early seeder invented vote counts. Portico only ever shows real
// numbers, so any counter that cannot be traced to a real interaction is reset.
const realVotes = await run(
  `UPDATE sites SET votes = (SELECT COUNT(*) FROM votes v WHERE v.site_id = sites.id)
   WHERE votes != (SELECT COUNT(*) FROM votes v WHERE v.site_id = sites.id)`,
)
if (realVotes.rowsAffected) {
  log(`${colours.yellow}corrected${colours.reset} ${realVotes.rowsAffected} fabricated vote count(s)`)
}

// ------------------------------------------------- restore curated copy ----
let restored = 0
for (const seed of SEED_SITES) {
  const normalized = normalizeUrl(seed.url)
  if (!normalized) continue
  const current = await get<{ id: number; title: string; tagline: string }>(
    'SELECT id, title, tagline FROM sites WHERE domain_key = ?',
    [normalized.key],
  )
  if (!current) continue
  if (current.title === seed.title && current.tagline === seed.tagline) continue
  await run('UPDATE sites SET title = ?, tagline = ?, slug = ?, updated_at = ? WHERE domain_key = ?', [
    seed.title,
    seed.tagline,
    await uniqueSlug(seed.title, Number(current.id)),
    nowIso(),
    normalized.key,
  ])
  log(`${colours.magenta}restored${colours.reset} ${colours.dim}${current.title}${colours.reset} → ${seed.title}`)
  restored++
}

// ------------------------------------------------------ tidy crawled copy --
const sites = await all<{ id: number; url: string; domain: string; title: string }>(
  `SELECT id, url, domain, title FROM sites WHERE source != 'seed' ORDER BY id`,
)

let retitled = 0
let archived = 0

for (const site of sites) {
  const normalized = normalizeUrl(site.url)

  if (prune && normalized) {
    const verdict = isIndexableUrl(normalized)
    if (!verdict.ok) {
      await run(`UPDATE sites SET status = 'archived', reject_reason = ?, updated_at = ? WHERE id = ?`, [
        `repair: ${verdict.reason}`,
        nowIso(),
        Number(site.id),
      ])
      log(`${colours.yellow}archived${colours.reset} ${site.title} ${colours.dim}— ${verdict.reason}${colours.reset}`)
      archived++
      continue
    }
  }

  const tidied = truncate(cleanTitle(site.title, normalized?.host ?? site.domain), 90)
  if (tidied && tidied !== site.title) {
    await run('UPDATE sites SET title = ?, slug = ?, updated_at = ? WHERE id = ?', [
      tidied,
      await uniqueSlug(tidied, Number(site.id)),
      nowIso(),
      Number(site.id),
    ])
    log(`${colours.cyan}retitled${colours.reset} ${colours.dim}${site.title}${colours.reset} → ${tidied}`)
    retitled++
  }
}

// ------------------------------------------------------------- reindex ----
const everySite = await all<{ id: number }>('SELECT id FROM sites')
for (const site of everySite) await reindexSite(Number(site.id))
const rescored = await recomputeTrending()

console.log()
log(
  `${colours.green}✓${colours.reset} ${restored} restored, ${retitled} retitled, ${archived} archived, ` +
    `${everySite.length} reindexed, ${rescored} rescored`,
)
if (!prune) log(`${colours.dim}run with --prune to also archive entries that no longer pass the URL filter${colours.reset}`)
console.log()
