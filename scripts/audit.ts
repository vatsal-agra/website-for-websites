import * as cheerio from 'cheerio'
import { banner, colours, log } from './_boot'
import { get, ready } from '../src/lib/db'
import { env } from '../src/lib/env'

/**
 * Accessibility and markup audit over the rendered HTML of every route type.
 *
 * Not a substitute for a real audit tool, and it does not try to be. It checks
 * the handful of things that are cheap to check on a static document, that
 * break screen readers outright when they are wrong, and that regress silently
 * because nothing else looks at them:
 *
 *   - images without alt text
 *   - links and buttons with nothing to announce
 *   - form controls with no label
 *   - a missing or duplicated <h1>, or a heading level that skips
 *   - duplicate ids, which break every aria-* reference on the page
 *   - a missing lang attribute
 *
 * Contrast and focus order need a browser and a person; those are not here.
 *
 * One caveat on heading order: streamed content arrives at the end of the HTML
 * and is moved into place by React, so source order is not final DOM order. A
 * skip is still a skip, but the element it is reported against may not be the
 * one you would expect.
 *
 *   npm run audit                  # against http://localhost:3000
 *   npm run audit -- https://…     # against a deployed site
 */

const base = (process.argv.find((a) => a.startsWith('http')) ?? env.siteUrl).replace(/\/+$/, '')

interface Finding {
  rule: string
  detail: string
}

function auditHtml(html: string): Finding[] {
  const $ = cheerio.load(html)
  const findings: Finding[] = []
  const add = (rule: string, detail: string) => findings.push({ rule, detail })

  if (!$('html').attr('lang')) add('lang', '<html> has no lang attribute')

  // --- images -------------------------------------------------------------
  $('img').each((_, el) => {
    const $el = $(el)
    if ($el.attr('alt') === undefined && !$el.attr('aria-hidden')) {
      add('img-alt', `<img src="${($el.attr('src') ?? '').slice(0, 60)}"> has no alt`)
    }
  })

  // --- headings -----------------------------------------------------------
  const h1s = $('h1')
  if (h1s.length === 0) add('h1', 'no <h1> on the page')
  else if (h1s.length > 1) add('h1', `${h1s.length} <h1> elements: ${h1s.map((_, el) => $(el).text().trim().slice(0, 24)).get().join(' | ')}`)

  let previous = 0
  $('h1,h2,h3,h4,h5,h6').each((_, el) => {
    const level = Number(el.tagName[1])
    if (previous && level > previous + 1) {
      add('heading-order', `h${previous} → h${level} at “${$(el).text().trim().slice(0, 40)}”`)
    }
    previous = level
  })

  // --- anything clickable has to announce itself --------------------------
  const named = (el: any) => {
    const $el = $(el)
    return Boolean(
      $el.text().trim() ||
        $el.attr('aria-label') ||
        $el.attr('title') ||
        $el.find('img[alt]').filter((_, img) => Boolean($(img).attr('alt')?.trim())).length ||
        $el.attr('aria-labelledby'),
    )
  }

  $('a[href]').each((_, el) => {
    if (!named(el)) add('link-name', `<a href="${($(el).attr('href') ?? '').slice(0, 50)}"> has nothing to announce`)
  })

  $('button').each((_, el) => {
    if (!named(el)) add('button-name', `<button> at ${$.html(el).slice(0, 60)} has nothing to announce`)
  })

  // --- form controls ------------------------------------------------------
  $('input,select,textarea').each((_, el) => {
    const $el = $(el)
    const type = ($el.attr('type') ?? '').toLowerCase()
    if (type === 'hidden' || type === 'submit' || type === 'button') return
    // a honeypot is aria-hidden and out of the tab order on purpose; nothing
    // announces it, which is the point
    if ($el.attr('aria-hidden') === 'true' || $el.parents('[aria-hidden="true"]').length) return
    const id = $el.attr('id')
    const labelled =
      $el.attr('aria-label') ||
      $el.attr('aria-labelledby') ||
      $el.attr('title') ||
      (id && $(`label[for="${id}"]`).length > 0) ||
      $el.parents('label').length > 0
    if (!labelled) add('control-label', `<${el.tagName}${type ? ` type="${type}"` : ''} name="${$el.attr('name') ?? ''}"> has no label`)
  })

  // --- duplicate ids break every aria reference on the page ---------------
  const seen = new Map<string, number>()
  $('[id]').each((_, el) => {
    const id = $(el).attr('id')!
    seen.set(id, (seen.get(id) ?? 0) + 1)
  })
  for (const [id, n] of seen) {
    // React's own streaming markers are emitted more than once by design
    if (n > 1 && !id.startsWith('B:') && !id.startsWith('S:') && !id.startsWith('P:')) {
      add('duplicate-id', `id="${id}" appears ${n} times`)
    }
  }

  return findings
}

banner(`web-amble — accessibility audit against ${base}`)
await ready()

const site = await get<{ slug: string }>(`SELECT slug FROM sites WHERE status = 'approved' ORDER BY random() LIMIT 1`)
const category = await get<{ slug: string }>('SELECT slug FROM categories ORDER BY random() LIMIT 1')
const tag = await get<{ slug: string }>(
  'SELECT t.slug FROM tags t JOIN site_tags st ON st.tag_id = t.id GROUP BY t.slug ORDER BY COUNT(*) DESC LIMIT 1',
)
const collection = await get<{ slug: string }>('SELECT slug FROM collections WHERE is_public = 1 LIMIT 1')
const user = await get<{ username: string }>('SELECT username FROM users LIMIT 1')

const paths = [
  '/',
  '/browse',
  '/search?q=maps',
  '/search',
  '/categories',
  '/tags',
  '/collections',
  '/shuffle',
  '/submit',
  '/about',
  '/guidelines',
  '/login',
  '/signup',
  '/goodbye',
  '/this-page-does-not-exist',
  site && `/site/${site.slug}`,
  category && `/category/${category.slug}`,
  tag && `/tag/${tag.slug}`,
  collection && `/collections/${collection.slug}`,
  user && `/u/${user.username}`,
].filter((p): p is string => Boolean(p))

let total = 0
const byRule = new Map<string, number>()

for (const path of paths) {
  let findings: Finding[]
  try {
    const res = await fetch(`${base}${path}`, {
      signal: AbortSignal.timeout(45_000),
      headers: { 'user-agent': 'web-amble-audit/1.0' },
    })
    findings = auditHtml(await res.text())
  } catch (err) {
    log(`  ${colours.red}error${colours.reset} ${path} — ${err instanceof Error ? err.message : 'failed'}`)
    continue
  }

  total += findings.length
  for (const f of findings) byRule.set(f.rule, (byRule.get(f.rule) ?? 0) + 1)

  const mark = findings.length ? `${colours.yellow}${String(findings.length).padStart(2)}${colours.reset}` : `${colours.green} 0${colours.reset}`
  console.log(`  ${mark}  ${path}`)
  for (const f of findings.slice(0, 6)) {
    console.log(`        ${colours.dim}${f.rule}: ${f.detail}${colours.reset}`)
  }
  if (findings.length > 6) console.log(`        ${colours.dim}… and ${findings.length - 6} more${colours.reset}`)
}

console.log()
if (total === 0) {
  log(`${colours.green}no issues across ${paths.length} pages${colours.reset}`)
} else {
  log(`${colours.yellow}${total} issue(s) across ${paths.length} pages${colours.reset}`)
  for (const [rule, n] of [...byRule].sort((a, b) => b[1] - a[1])) log(`  ${colours.dim}${String(n).padStart(3)} × ${rule}${colours.reset}`)
}
console.log()
process.exit(total === 0 ? 0 : 1)
