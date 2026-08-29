import { banner, colours, log } from './_boot'
import { all, get, ready } from '../src/lib/db'
import { env } from '../src/lib/env'

/**
 * Hit every kind of route against a running server and report what breaks.
 *
 * Slugs are read from the database rather than hard-coded, so this exercises
 * real records and keeps working as the catalogue changes. It exists because a
 * hand-written route list quietly omitted /site/<slug> — the most visited page
 * in the product — and a 500 there survived a "full" sweep.
 *
 *   npm run smoke                    # against http://localhost:3000
 *   npm run smoke -- https://…       # against a deployed site
 */

const base = (process.argv.find((a) => a.startsWith('http')) ?? env.siteUrl).replace(/\/+$/, '')
const timeoutMs = 120_000

interface Result {
  path: string
  status: number
  ms: number
  ok: boolean
  note?: string
}

async function hit(path: string, expect: number[] = [200]): Promise<Result> {
  const started = Date.now()
  try {
    const res = await fetch(`${base}${path}`, {
      redirect: 'manual',
      signal: AbortSignal.timeout(timeoutMs),
      headers: { 'user-agent': 'web-amble-smoke/1.0' },
    })
    return {
      path,
      status: res.status,
      ms: Date.now() - started,
      ok: expect.includes(res.status),
    }
  } catch (err) {
    return {
      path,
      status: 0,
      ms: Date.now() - started,
      ok: false,
      note: err instanceof Error ? err.message.slice(0, 60) : 'failed',
    }
  }
}

banner(`web-amble — smoke test against ${base}`)
await ready()

// ---------------------------------------------- pick real records to visit --
const site = await get<{ slug: string }>(`SELECT slug FROM sites WHERE status = 'approved' ORDER BY random() LIMIT 1`)
const category = await get<{ slug: string }>('SELECT slug FROM categories ORDER BY random() LIMIT 1')
const tag = await get<{ slug: string }>(
  'SELECT t.slug FROM tags t JOIN site_tags st ON st.tag_id = t.id GROUP BY t.slug ORDER BY COUNT(*) DESC LIMIT 1',
)
const collection = await get<{ slug: string }>('SELECT slug FROM collections WHERE is_public = 1 LIMIT 1')
const user = await get<{ username: string }>('SELECT username FROM users LIMIT 1')

const routes: [string, number[]?][] = [
  ['/'],
  ['/browse'],
  ['/browse?sort=new'],
  ['/browse?sort=top&attr=free'],
  ['/browse?sort=random'],
  ['/browse?sort=alpha'],
  ['/categories'],
  ['/collections'],
  ['/search?q=maps'],
  ['/search?q=zzzznothingmatchesthis'],
  ['/shuffle'],
  ['/submit'],
  ['/about'],
  ['/guidelines'],
  ['/login', [200, 307]],
  ['/signup', [200, 307]],
  ['/saved', [200, 307]],
  ['/feed.xml'],
  ['/sitemap.xml'],
  ['/robots.txt'],
  ['/opengraph-image'],
  ['/api/sites?perPage=3'],
  ['/api/search?q=type'],
  ['/this-page-does-not-exist', [404]],
  // admin is session-gated; unauthenticated should be redirected, never 500
  ['/admin', [200, 302, 307, 404]],
]

if (site) {
  routes.push([`/site/${site.slug}`])
  routes.push([`/site/${site.slug}/opengraph-image`])
  routes.push([`/go/${site.slug}`, [302, 307]])
}
if (category) routes.push([`/category/${category.slug}`])
if (tag) routes.push([`/tag/${tag.slug}`])
if (collection) {
  routes.push([`/collections/${collection.slug}`])
  routes.push([`/collections/${collection.slug}/opengraph-image`])
}
if (user) routes.push([`/u/${user.username}`])

// ------------------------------------------------------------------- run ---
const results: Result[] = []
for (const [path, expect] of routes) {
  const result = await hit(path, expect)
  results.push(result)
  const mark = result.ok ? `${colours.green}pass${colours.reset}` : `${colours.red}FAIL${colours.reset}`
  const timing = result.ms > 5000 ? `${colours.yellow}${result.ms}ms${colours.reset}` : `${colours.dim}${result.ms}ms${colours.reset}`
  console.log(
    `  ${mark}  ${String(result.status).padEnd(3)}  ${path.padEnd(46).slice(0, 46)}  ${timing}${
      result.note ? ` ${colours.dim}${result.note}${colours.reset}` : ''
    }`,
  )
}

const failed = results.filter((r) => !r.ok)
const slow = results.filter((r) => r.ok && r.ms > 5000)

console.log()
log(`${results.length} routes · ${results.length - failed.length} passed · ${failed.length} failed`)
if (slow.length) {
  log(`${colours.yellow}${slow.length} slower than 5s${colours.reset}: ${slow.map((s) => s.path).join(', ')}`)
}

if (failed.length) {
  console.log()
  for (const f of failed) log(`${colours.red}✗${colours.reset} ${f.path} → ${f.status || f.note}`)
  console.log()
  process.exit(1)
}

console.log()
log(`${colours.green}everything responded${colours.reset}`)
console.log()
process.exit(0)
