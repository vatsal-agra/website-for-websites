import { banner, colours, log } from './_boot'
import { fetchText } from '../src/lib/fetcher'
import { parseMetadata } from '../src/lib/metadata'
import { classify, scoreQuality } from '../src/lib/classify'

/**
 * Fetch a URL and print exactly what the ingester would make of it.
 *
 * The quality score decides both what gets listed without a human looking and
 * how things rank on the shelves, so it needs to be inspectable against real
 * pages rather than only against fixtures. Give it a handful of URLs and the
 * ordering it produces should match the ordering you would defend.
 *
 *   npx tsx scripts/score.ts https://oeis.org https://vercel.com
 */

const urls = process.argv.slice(2).filter((a) => a.startsWith('http'))

if (!urls.length) {
  console.error('usage: npx tsx scripts/score.ts <url> [url...]')
  process.exit(1)
}

banner('web-amble — score a page')

const rows: {
  url: string
  score: number
  category: string
  words: number
  funnel: number
  internal: number
  outbound: number
  interactive: number
  reasons: string[]
}[] = []

for (const url of urls) {
  const res = await fetchText(url, { polite: true })
  if (!res.ok || !res.body) {
    log(`${colours.red}✗${colours.reset} ${url} — ${res.error ?? `http ${res.status}`}`)
    continue
  }

  const meta = parseMetadata(res.body, res.finalUrl || url)
  const { score, reasons } = scoreQuality(meta, {
    status: res.status,
    elapsedMs: res.elapsedMs,
    https: (res.finalUrl || url).startsWith('https:'),
  })

  rows.push({
    url,
    score,
    category: classify(meta).categorySlug,
    words: meta.signals.wordCount,
    funnel: meta.signals.funnelPhrases,
    internal: meta.internalLinkCount,
    outbound: meta.outboundLinks.length,
    interactive: meta.signals.interactiveCount,
    reasons,
  })
}

rows.sort((a, b) => b.score - a.score)

console.log()
for (const row of rows) {
  const tone = row.score >= 0.72 ? colours.green : row.score >= 0.55 ? colours.yellow : colours.red
  log(
    `${tone}${row.score.toFixed(3)}${colours.reset}  ${row.category.padEnd(12)} ${row.url}  ` +
      `${colours.dim}${row.words}w · ${row.internal} internal · ${row.outbound} outbound · ` +
      `${row.interactive} interactive · ${row.funnel} funnel${colours.reset}`,
  )
  log(`${colours.dim}        ${row.reasons.join('  ')}${colours.reset}`)
}
console.log()
log(`${colours.dim}anything at or above ${colours.reset}0.72${colours.dim} is listed without review${colours.reset}`)
console.log()
process.exit(0)
