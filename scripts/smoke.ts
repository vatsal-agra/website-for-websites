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
  /** time to the first byte — the response headers */
  ms: number
  /** time to the last byte, which on a streamed page is when it is actually done */
  totalMs: number
  bytes: number
  ok: boolean
  note?: string
}

/**
 * Every page on this site streams, so a status code proves almost nothing: the
 * shell is emitted before a single query has resolved, and a Suspense boundary
 * that throws afterwards still arrives inside a 200. The body has to be read to
 * the end, and then checked.
 *
 * Draining it also matters for the server. Letting the body get collected
 * unread cancels the stream mid-render, and on Node 22.14 that trips a
 * web-streams bug (`controller[kState].transformAlgorithm is not a function`)
 * which wedges the dev server for every request after it.
 */
async function hit(path: string, expect: number[] = [200]): Promise<Result> {
  const started = Date.now()
  try {
    const res = await fetch(`${base}${path}`, {
      redirect: 'manual',
      signal: AbortSignal.timeout(timeoutMs),
      headers: { 'user-agent': 'web-amble-smoke/1.0' },
    })
    const ms = Date.now() - started
    const body = await res.text()
    const result: Result = {
      path,
      status: res.status,
      ms,
      totalMs: Date.now() - started,
      bytes: body.length,
      ok: expect.includes(res.status),
    }

    // only a 200 is claiming to be a page; a redirect's body is Next's own stub
    if (result.ok && res.status === 200 && res.headers.get('content-type')?.includes('text/html')) {
      const problem = inspectHtml(body)
      if (problem) {
        result.ok = false
        result.note = problem
      }
    }
    return result
  } catch (err) {
    return {
      path,
      status: 0,
      ms: Date.now() - started,
      totalMs: Date.now() - started,
      bytes: 0,
      ok: false,
      note: err instanceof Error ? err.message.slice(0, 60) : 'failed',
    }
  }
}

/**
 * What a 200 can still be hiding.
 *
 * Every Suspense fallback is emitted with `aria-busy="true"`, and React closes
 * each boundary with a `$RC(` call once its content is ready. If the document
 * ends with more of the first than the second, a section failed or never
 * resolved — the page looks fine to a status check and is broken to a reader.
 */
function inspectHtml(body: string): string | undefined {
  const count = (needle: string) => body.split(needle).length - 1

  const fallbacks = count('aria-busy="true"')
  const resolved = count('$RC(')
  if (fallbacks > resolved) {
    return `${fallbacks - resolved} of ${fallbacks} suspense boundaries never resolved`
  }

  if (body.includes('__next_error__')) return 'rendered the error page'
  if (!body.includes('</html>')) return 'document was truncated'
  return undefined
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
  ['/tags'],
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
  ['/settings', [200, 307]],
  ['/goodbye'],
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
if (category) {
  routes.push([`/category/${category.slug}`])
  routes.push([`/category/${category.slug}/feed.xml`])
}
if (tag) {
  routes.push([`/tag/${tag.slug}`])
  routes.push([`/tag/${tag.slug}/feed.xml`])
}
if (collection) {
  routes.push([`/collections/${collection.slug}`])
  routes.push([`/collections/${collection.slug}/opengraph-image`])
  routes.push([`/collections/${collection.slug}/feed.xml`])
}
if (user) routes.push([`/u/${user.username}`])

// ------------------------------------------------------------------- run ---
const results: Result[] = []
for (const [path, expect] of routes) {
  const result = await hit(path, expect)
  results.push(result)
  const mark = result.ok ? `${colours.green}pass${colours.reset}` : `${colours.red}FAIL${colours.reset}`
  const label = `${result.ms}ms → ${result.totalMs}ms`
  const timing =
    result.totalMs > 5000 ? `${colours.yellow}${label}${colours.reset}` : `${colours.dim}${label}${colours.reset}`
  console.log(
    `  ${mark}  ${String(result.status).padEnd(3)}  ${path.padEnd(42).slice(0, 42)}  ${timing}${
      result.note ? ` ${colours.dim}${result.note}${colours.reset}` : ''
    }`,
  )
}

const failed = results.filter((r) => !r.ok)
const slow = results.filter((r) => r.ok && r.totalMs > 5000)

console.log()
const bytes = results.reduce((n, r) => n + r.bytes, 0)
log(
  `${results.length} routes · ${results.length - failed.length} passed · ${failed.length} failed · ` +
    `${(bytes / 1024).toFixed(0)}KB read`,
)
if (slow.length) {
  log(
    `${colours.yellow}${slow.length} took longer than 5s to finish${colours.reset}: ` +
      slow.map((s) => `${s.path} (${s.totalMs}ms)`).join(', '),
  )
}

if (failed.length) {
  console.log()
  for (const f of failed) log(`${colours.red}✗${colours.reset} ${f.path} → ${f.note || f.status}`)
  console.log()
  process.exit(1)
}

console.log()
log(`${colours.green}every route rendered to completion${colours.reset}`)
console.log()
process.exit(0)
