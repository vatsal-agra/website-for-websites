import { all } from './db'
import type { PageMetadata } from './metadata'
import type { NormalizedUrl } from './url'

/**
 * web-amble indexes the whole open web, so the safety net is deliberately narrow:
 * it blocks adult content, malware/piracy, gambling and obvious scam patterns,
 * and otherwise gets out of the way.
 */

const ADULT_TERMS = [
  'porn', 'pornography', 'xxx', 'hentai', 'nsfw gallery', 'camgirl', 'escort service',
  'adult videos', 'sex cam', 'onlyfans leaks', 'nude photos',
]

const ILLEGAL_TERMS = [
  'crack keygen', 'serial key generator', 'nulled script', 'warez', 'torrent download movies',
  'free movie streaming', 'pirated', 'ddos for hire', 'stresser booter', 'stolen credit card',
  'carding forum', 'dumps with pin', 'buy followers cheap', 'essay writing service',
]

const SCAM_TERMS = [
  'double your bitcoin', 'guaranteed profit', 'get rich quick', 'crypto giveaway',
  'binary options signals', 'forex robot guaranteed', 'miracle cure', 'work from home $',
]

const GAMBLING_TERMS = [
  'online casino', 'slots bonus', 'betting odds', 'sportsbook bonus', 'poker real money',
  // the business-to-business end of it, which reads like ordinary SaaS copy and
  // scored 0.91 on the quality heuristic before this was here
  'igaming', 'casino software', 'betting platform', 'gambling operators',
]

/**
 * Pages that are machinery, not websites.
 *
 * The crawler fetches one URL and reads what comes back, and sometimes what
 * comes back is a login screen, a status dashboard, an invite link or a
 * Cloudflare interstitial. Every one of those looks like a perfectly good page
 * to the quality heuristic — real title, https, fast response — and none of
 * them is a website anybody wants to be shown.
 *
 * Matched against the title only, and with whole phrases, because "status" and
 * "sign in" appear in the body of plenty of real sites.
 */
const NOT_A_WEBSITE_TITLES = [
  'central authentication service',
  'sign in to', 'log in to', 'login to', 'please sign in', 'please log in',
  'you are being redirected', 'you have been logged out',
  'system status', 'service status', 'status page', 'all systems operational',
  'access denied', 'attention required', 'just a moment', 'one moment please',
  'are you a robot', 'verify you are human', 'checking your browser',
  'enable javascript', 'javascript is required', 'this page requires javascript',
  'domain for sale', 'buy this domain', 'website coming soon',
  'index of /', 'directory listing for',
  "you're invited to talk on matrix", 'you are invited to talk on matrix',
]

const BAD_HOST_FRAGMENTS = [
  'porn', 'xxx', 'sexy', 'escort', 'casino', 'betting', 'warez', 'crack', 'torrent',
  'pirate', 'nulled', 'hack-', 'freemovies', 'streamhd',
]

const SUSPICIOUS_TLDS = new Set(['zip', 'mov', 'tk', 'ml', 'ga', 'cf', 'gq', 'top', 'work', 'click', 'link', 'rest'])

export interface SafetyVerdict {
  allowed: boolean
  /** 'block' rejects outright, 'review' forces manual moderation */
  action: 'allow' | 'review' | 'block'
  reason: string
  labels: string[]
}

/**
 * Match a flagged term against page text.
 *
 * Single words are anchored to a word start, so `xxx` cannot fire on a run of
 * placeholder x's and `porn` cannot fire inside an unrelated word — while
 * still catching `pornography`. Multi-word phrases are distinctive enough to
 * match as plain substrings.
 */
const termPatterns = new Map<string, RegExp>()

function matches(text: string, term: string): boolean {
  if (term.includes(' ')) return text.includes(term)
  let re = termPatterns.get(term)
  if (!re) {
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    re = new RegExp(`\\b${escaped}`, 'i')
    termPatterns.set(term, re)
  }
  return re.test(text)
}

function hits(text: string, terms: string[]): string[] {
  return terms.filter((t) => matches(text, t))
}

/**
 * The blocklist changes rarely and is read on every candidate, so it is cached
 * per process — important on serverless, where a database round trip per URL
 * would dominate the crawl.
 */
let blocklistCache: { rows: { pattern: string; reason: string }[]; at: number } | null = null
const BLOCKLIST_TTL_MS = 60_000

export async function loadBlocklist(): Promise<{ pattern: string; reason: string }[]> {
  if (blocklistCache && Date.now() - blocklistCache.at < BLOCKLIST_TTL_MS) return blocklistCache.rows
  try {
    const rows = await all<{ pattern: string; reason: string }>('SELECT pattern, reason FROM blocklist')
    blocklistCache = { rows, at: Date.now() }
    return rows
  } catch {
    return blocklistCache?.rows ?? []
  }
}

export function invalidateBlocklist() {
  blocklistCache = null
}

export async function isBlocklisted(url: NormalizedUrl): Promise<string | null> {
  for (const row of await loadBlocklist()) {
    const p = row.pattern.toLowerCase().trim()
    if (!p) continue
    if (url.domain === p || url.domain.endsWith(`.${p}`) || url.host === p) {
      return row.reason || 'blocklisted'
    }
  }
  return null
}

export async function screenUrl(url: NormalizedUrl): Promise<SafetyVerdict> {
  const blocked = await isBlocklisted(url)
  if (blocked) return { allowed: false, action: 'block', reason: blocked, labels: ['blocklist'] }

  const host = url.domain
  const fragment = BAD_HOST_FRAGMENTS.find((f) => host.includes(f))
  if (fragment) {
    return { allowed: false, action: 'block', reason: `hostname contains "${fragment}"`, labels: ['adult-or-illegal'] }
  }

  const tld = host.split('.').pop() ?? ''
  if (SUSPICIOUS_TLDS.has(tld)) {
    return { allowed: true, action: 'review', reason: `.${tld} domains are manually reviewed`, labels: ['tld'] }
  }

  return { allowed: true, action: 'allow', reason: '', labels: [] }
}

export function screenContent(meta: PageMetadata): SafetyVerdict {
  const text = `${meta.title} ${meta.description} ${meta.textSample}`.toLowerCase()

  const title = meta.title.toLowerCase()
  const machinery = NOT_A_WEBSITE_TITLES.find((phrase) => title.includes(phrase))
  if (machinery) {
    return { allowed: false, action: 'block', reason: `not a website (“${machinery}”)`, labels: ['not-a-site'] }
  }

  const adult = hits(text, ADULT_TERMS)
  if (adult.length >= 2 || (adult.length === 1 && `${meta.title} ${meta.description}`.toLowerCase().includes(adult[0]))) {
    return { allowed: false, action: 'block', reason: 'adult content', labels: ['adult'] }
  }

  const illegal = hits(text, ILLEGAL_TERMS)
  if (illegal.length) {
    return { allowed: false, action: 'block', reason: `piracy / illegal services (${illegal[0]})`, labels: ['illegal'] }
  }

  const scam = hits(text, SCAM_TERMS)
  if (scam.length) {
    return { allowed: false, action: 'block', reason: `scam pattern (${scam[0]})`, labels: ['scam'] }
  }

  const gambling = hits(text, GAMBLING_TERMS)
  if (gambling.length >= 2) {
    return { allowed: false, action: 'block', reason: 'gambling', labels: ['gambling'] }
  }
  if (gambling.length === 1 || adult.length === 1) {
    return { allowed: true, action: 'review', reason: 'borderline content, needs a human', labels: ['borderline'] }
  }

  if (meta.signals.isParked) {
    return { allowed: false, action: 'block', reason: 'parked or empty domain', labels: ['parked'] }
  }

  return { allowed: true, action: 'allow', reason: '', labels: [] }
}

export const DEFAULT_BLOCKLIST: { pattern: string; reason: string }[] = [
  { pattern: 'example.com', reason: 'reserved documentation domain' },
  { pattern: 'example.org', reason: 'reserved documentation domain' },
  { pattern: 'localhost', reason: 'not a public website' },
  { pattern: 'lorem-ipsum.co', reason: 'placeholder' },
]
