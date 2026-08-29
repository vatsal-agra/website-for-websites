import { banner, colours, log } from './_boot'
import { get, migrate, nowIso, run, setSetting } from '../src/lib/db'
import { env } from '../src/lib/env'
import { CATEGORY_SEEDS } from '../src/lib/taxonomy'
import { DEFAULT_BLOCKLIST } from '../src/lib/safety'
import { DEFAULT_SOURCES } from '../src/lib/sources'
import { SEED_COLLECTIONS, SEED_SITES } from '../src/lib/seed'
import { createUser, findUserByUsername } from '../src/lib/auth'
import { normalizeUrl } from '../src/lib/url'
import { slugify } from '../src/lib/utils'
import { fallbackAccent } from '../src/lib/thumbs'
import { enqueue } from '../src/lib/jobs'
import { all } from '../src/lib/db'
import { recomputeTrending, reindexAll } from '../src/lib/queries/sites'
import { addToCollection, createCollection } from '../src/lib/queries/collections'
import type { SiteAttributes } from '../src/lib/types'

banner('web-amble — seed')

await migrate()

// ------------------------------------------------------------- categories --
for (const [index, cat] of CATEGORY_SEEDS.entries()) {
  await run(
    `INSERT INTO categories (slug, name, tagline, description, hue, glyph, position)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(slug) DO UPDATE SET
       name = excluded.name, tagline = excluded.tagline, description = excluded.description,
       hue = excluded.hue, glyph = excluded.glyph, position = excluded.position`,
    [cat.slug, cat.name, cat.tagline, cat.description, cat.hue, cat.glyph, index],
  )
}
log(`${colours.green}✓${colours.reset} ${CATEGORY_SEEDS.length} categories`)

// -------------------------------------------------------------- blocklist --
for (const entry of DEFAULT_BLOCKLIST) {
  await run('INSERT INTO blocklist (pattern, reason) VALUES (?, ?) ON CONFLICT (pattern) DO NOTHING', [entry.pattern, entry.reason])
}
log(`${colours.green}✓${colours.reset} ${DEFAULT_BLOCKLIST.length} blocklist rules`)

// ---------------------------------------------------------------- sources --
const existingSources = new Set((await all<{ name: string }>('SELECT name FROM sources')).map((s) => s.name))
let sourcesAdded = 0
for (const source of DEFAULT_SOURCES) {
  if (existingSources.has(source.name)) continue
  await run('INSERT INTO sources (kind, name, url, interval_min, config) VALUES (?, ?, ?, ?, ?)', [
    source.kind,
    source.name,
    source.url,
    source.interval_min,
    JSON.stringify(source.config),
  ])
  sourcesAdded++
}
log(`${colours.green}✓${colours.reset} ${sourcesAdded} discovery source(s) added (${DEFAULT_SOURCES.length} total)`)

// ------------------------------------------------------------------ admin --
let admin = await findUserByUsername(env.adminUsername)
if (!admin) {
  const created = await createUser({
    username: env.adminUsername,
    password: env.adminPassword,
    email: env.adminEmail,
    displayName: 'web-amble Editors',
    role: 'admin',
  })
  admin = await findUserByUsername(created.username)
  log(`${colours.green}✓${colours.reset} admin user ${colours.bold}${env.adminUsername}${colours.reset} created`)
} else {
  await run(`UPDATE users SET role = 'admin' WHERE id = ?`, [admin.id])
  log(`${colours.dim}· admin user ${env.adminUsername} already exists${colours.reset}`)
}

// ------------------------------------------------------------------ sites --
const categoryIds = new Map(
  (await all<{ id: number; slug: string }>('SELECT id, slug FROM categories')).map((c) => [c.slug, Number(c.id)]),
)

// Pre-create every tag the founding catalogue uses, and resolve every existing
// site, in two queries rather than a dozen per entry. Against a network
// database that is the difference between a twenty-minute first run and a
// two-minute one.
const seedTagNames = [
  ...new Set(SEED_SITES.flatMap((s) => s.tags.map((t) => t.trim().toLowerCase())).filter(Boolean)),
]
for (const name of seedTagNames) {
  await run('INSERT INTO tags (slug, name) VALUES (?, ?) ON CONFLICT (slug) DO NOTHING', [
    slugify(name, 32),
    name.slice(0, 32),
  ])
}
const tagIds = new Map(
  (await all<{ id: number; slug: string }>('SELECT id, slug FROM tags')).map((t) => [t.slug, Number(t.id)]),
)

const existingByKey = new Map(
  (await all<{ id: number; domain_key: string }>(`SELECT id, domain_key FROM sites`)).map((r) => [
    r.domain_key,
    Number(r.id),
  ]),
)
const usedSlugs = new Set(
  (await all<{ slug: string }>('SELECT slug FROM sites')).map((r) => r.slug),
)

/** Slugs are resolved in memory; the database still holds the UNIQUE constraint. */
function claimSlug(title: string): string {
  const root = slugify(title) || 'site'
  let candidate = root
  let n = 1
  while (usedSlugs.has(candidate)) candidate = `${root}-${++n}`
  usedSlugs.add(candidate)
  return candidate
}

const siteIdByUrl = new Map<string, number>()
let added = 0
let skipped = 0

// The founding catalogue really was catalogued right now, so that is the date
// it carries. Back-dating it would make "Newest" and "Trending" tell a story
// that never happened.
const seededAt = nowIso()

for (const seed of SEED_SITES) {
  const normalized = normalizeUrl(seed.url)
  if (!normalized) {
    log(`${colours.red}✗${colours.reset} bad seed url: ${seed.url}`)
    continue
  }
  const known = existingByKey.get(normalized.key)
  if (known) {
    siteIdByUrl.set(seed.url, known)
    skipped++
    continue
  }

  const attributes: SiteAttributes = {}
  for (const key of seed.attrs ?? []) attributes[key] = true

  const accent = fallbackAccent(normalized.href)

  const row = await get<{ id: number }>(
    `INSERT INTO sites (
       slug, url, domain, domain_key, title, tagline, description, category_id,
       accent_hue, accent_hex, lang, status, source, source_ref, attributes, quality,
       published_at, created_at, updated_at, editor_note
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'approved', 'seed', NULL, ?, ?, ?, ?, ?, ?)
     RETURNING id`,
    [
      claimSlug(seed.title),
      normalized.href,
      normalized.domain,
      normalized.key,
      seed.title,
      seed.tagline,
      seed.tagline,
      categoryIds.get(seed.category) ?? null,
      accent.hue,
      accent.hex,
      'en',
      JSON.stringify(attributes),
      seed.quality ?? 0.82,
      seededAt,
      seededAt,
      seededAt,
      seed.note ?? '',
    ],
  )

  const siteId = Number(row!.id)

  // one statement for all of this entry's tags
  const ids = [...new Set(seed.tags.map((t) => tagIds.get(slugify(t, 32))).filter(Boolean))] as number[]
  if (ids.length) {
    await run(
      `INSERT INTO site_tags (site_id, tag_id) VALUES ${ids.map(() => '(?, ?)').join(', ')}
       ON CONFLICT DO NOTHING`,
      ids.flatMap((tagId) => [siteId, tagId]),
    )
  }

  siteIdByUrl.set(seed.url, siteId)
  added++
}

log(`${colours.green}✓${colours.reset} ${added} sites catalogued${skipped ? `, ${skipped} already present` : ''}`)

// Counters start at zero and stay honest — every vote, click and view on this
// site is a real one. Ranking on a fresh install therefore falls back to
// editorial quality and recency, which is what the trending formula already
// does when engagement is flat.
await run(
  `UPDATE tags SET uses = (SELECT COUNT(*)::int FROM site_tags st WHERE st.tag_id = tags.id)`,
)
const reindexed = await reindexAll()
log(`${colours.green}✓${colours.reset} rebuilt ${reindexed} search vectors`)
await recomputeTrending()

// ------------------------------------------------------------ collections --
let collectionsAdded = 0
for (const [index, seed] of SEED_COLLECTIONS.entries()) {
  const exists = await get<{ id: number }>('SELECT id FROM collections WHERE slug = ?', [seed.slug])
  const collectionId = exists
    ? Number(exists.id)
    : (
        await createCollection({
          slug: seed.slug,
          title: seed.title,
          subtitle: seed.subtitle,
          description: seed.description,
          hue: seed.hue,
          curatorId: admin?.id ?? null,
          isEditorial: true,
          isPublic: true,
          position: index,
        })
      ).id
  if (!exists) collectionsAdded++
  for (const url of seed.sites) {
    const siteId = siteIdByUrl.get(url)
    if (siteId) await addToCollection(collectionId, siteId)
  }
}
log(`${colours.green}✓${colours.reset} ${collectionsAdded} editorial collection(s) added (${SEED_COLLECTIONS.length} total)`)

// ------------------------------------------------------- thumbnail backlog --
const needThumbs = await all<{ id: number }>(
  `SELECT id FROM sites WHERE thumb_key IS NULL AND status = 'approved' ORDER BY quality DESC`,
)
for (const site of needThumbs) {
  await enqueue('site.thumbnail', { siteId: Number(site.id) }, { dedupeKey: `thumb:${site.id}`, priority: 2 })
}
log(`${colours.green}✓${colours.reset} queued ${needThumbs.length} cover-art job(s)`)

await setSetting('seeded_at', nowIso())

console.log(`
${colours.bold}web-amble is seeded.${colours.reset}

  ${colours.dim}1.${colours.reset} ${colours.cyan}npm run dev${colours.reset}     ${colours.dim}— start the site on http://localhost:3000${colours.reset}
  ${colours.dim}2.${colours.reset} ${colours.cyan}npm run worker${colours.reset}  ${colours.dim}— fetch cover art and start discovering new sites${colours.reset}

  ${colours.dim}admin login:${colours.reset} ${env.adminUsername} / ${env.adminPassword}   ${colours.dim}→ /admin${colours.reset}
`)
