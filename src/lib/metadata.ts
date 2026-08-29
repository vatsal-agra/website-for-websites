import * as cheerio from 'cheerio'
import { normalizeUrl, resolveUrl, isIndexableUrl, type NormalizedUrl } from './url'
import { truncate } from './utils'

export interface PageSignals {
  hasAdScripts: boolean
  hasAnalytics: boolean
  hasPaywallHint: boolean
  hasLoginWall: boolean
  isParked: boolean
  scriptCount: number
  wordCount: number
  headingCount: number
  interactiveCount: number
  hasViewport: boolean
  hasManifest: boolean
  hasOpenGraph: boolean
  hasStructuredData: boolean
  /**
   * How many distinct sales-funnel phrases appear on the page.
   *
   * This is the difference between a website and an advert for a company. A
   * page selling something says "book a demo", "start your free trial",
   * "trusted by 10,000 teams" and "contact sales"; a page that *is* something
   * says none of them. Counting distinct phrases rather than occurrences keeps
   * one prominent "Sign up" button from looking like a funnel.
   */
  funnelPhrases: number
}

export interface PageMetadata {
  url: string
  title: string
  siteName: string
  description: string
  imageUrl: string | null
  faviconUrl: string | null
  lang: string
  keywords: string[]
  feeds: string[]
  outboundLinks: string[]
  internalLinkCount: number
  canonical: string | null
  themeColor: string | null
  textSample: string
  signals: PageSignals
}

const AD_PATTERNS = [
  'googlesyndication', 'doubleclick.net', 'adservice.google', 'adnxs.com', 'taboola',
  'outbrain', 'media.net', 'criteo', 'pubmatic', 'rubiconproject', 'amazon-adsystem',
  'ezoic', 'mediavine', 'adsbygoogle',
]
const ANALYTICS_PATTERNS = [
  'google-analytics', 'googletagmanager', 'plausible.io', 'fathom', 'matomo',
  'segment.com', 'mixpanel', 'hotjar', 'clarity.ms', 'umami',
]
/**
 * Sales-funnel vocabulary.
 *
 * Kept narrow on purpose. Every phrase here is one that a page which exists to
 * convert a visitor uses and a page which exists to be read does not — no
 * single generic word like "pricing" or "sign up", which plenty of good sites
 * use once in a nav bar.
 */
const FUNNEL_PATTERNS = [
  'book a demo', 'request a demo', 'schedule a demo', 'get a demo', 'watch the demo',
  'start your free trial', 'start free trial', 'try it free', 'free trial',
  'contact sales', 'talk to sales', 'talk to an expert', 'get a quote', 'request a quote',
  'trusted by', 'loved by teams', 'join thousands of', 'used by thousands',
  'no credit card required', 'cancel anytime', 'get started for free',
  'enterprise-grade', 'best-in-class', 'industry-leading', 'all-in-one platform',
  'unlock the power', 'supercharge your', 'take your business',
  'roi', 'case studies', 'our customers', 'customer success stories',
]

const PAYWALL_PATTERNS = [
  'subscribe to continue', 'subscribers only', 'this article is for', 'paywall',
  'become a member to read', 'you have reached your limit', 'free articles remaining',
]
const LOGIN_WALL_PATTERNS = [
  'sign in to continue', 'log in to continue', 'please sign in to view',
  'you must be logged in',
]
const PARKED_PATTERNS = [
  'domain is for sale', 'buy this domain', 'this domain may be for sale',
  'parked domain', 'godaddy.com/domainsearch', 'the domain name you requested',
  'related searches', 'sedoparking', 'hugedomains',
]

function firstNonEmpty(...values: (string | null | undefined)[]): string {
  for (const v of values) {
    const trimmed = (v ?? '').replace(/\s+/g, ' ').trim()
    if (trimmed) return trimmed
  }
  return ''
}

const SEPARATORS = ['|', '·', '—', '–', '::', '»', '•', '-']

/**
 * Does this read like a sentence of prose rather than the name of a site?
 * Deliberately conservative — "Is it Christmas?" is a site name, not prose.
 */
function looksLikeProse(value: string): boolean {
  const trimmed = value.trim()
  const words = trimmed.split(/\s+/).filter(Boolean)
  if (words.length <= 5) return false
  if (words.length > 9) return true
  if (/[.!?]$/.test(trimmed)) return true
  if (/\.\s/.test(trimmed)) return true
  // six to nine words carrying several function words reads as a tagline
  const functionWords = (trimmed.match(/\b(the|a|an|and|or|for|with|your|you|we|our|to|of|in|on|what|how)\b/gi) ?? [])
    .length
  return words.length >= 7 && functionWords >= 3
}

/**
 * SHOUTY TITLES read badly in a grid, but acronyms are names — NASA and YNAB
 * must survive, "LOW←TECH MAGAZINE" should not.
 */
function fixCaps(value: string): string {
  const tokens = value.split(/\s+/).filter(Boolean)
  // a single short token is an acronym or a wordmark; leave it alone
  if (tokens.length === 1 && value.replace(/[^A-Za-z]/g, '').length <= 8) return value

  const letters = value.replace(/[^A-Za-z]/g, '')
  if (letters.length < 6) return value
  const upper = letters.replace(/[^A-Z]/g, '').length
  if (upper / letters.length < 0.85) return value

  return tokens
    .map((token) => {
      // keep short all-caps tokens: "BBC News", "NASA Eyes"
      if (token.replace(/[^A-Za-z]/g, '').length <= 4) return token
      return token
        .toLowerCase()
        .replace(/(^|[\-–—/([])([a-z])/g, (_m, pre, ch) => pre + ch.toUpperCase())
    })
    .join(' ')
}

/** Titles that name a page rather than a site: "Home", "Welcome", "Index". */
const GENERIC_TITLES = new Set([
  'home', 'homepage', 'home page', 'welcome', 'index', 'main', 'main page',
  'start', 'start page', 'untitled', 'untitled document', 'new page', 'website',
  'my site', 'my website', 'landing', 'landing page', 'default',
])

function isGeneric(value: string): boolean {
  return GENERIC_TITLES.has(value.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim())
}

/** Turn a raw <title> into something that reads well as a name on a card. */
export function cleanTitle(raw: string, host: string, siteName = '', heading = ''): string {
  let title = raw.replace(/\s+/g, ' ').trim()
  const brandish = host.replace(/^www\./, '').split('.')[0].toLowerCase()
  const normalise = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')
  const fromDomain = () =>
    brandish.replace(/[-_]+/g, ' ').replace(/(^|\s)\w/g, (c) => c.toUpperCase())

  // "Home", "Welcome" and friends name a page, not a site — use the brand.
  if (isGeneric(title)) {
    const h = heading.replace(/\s+/g, ' ').trim()
    if (siteName && !isGeneric(siteName) && !looksLikeProse(siteName)) return fixCaps(siteName.trim())
    if (h && h.length <= 48 && !isGeneric(h) && !looksLikeProse(h)) return fixCaps(h)
    return fromDomain()
  }

  // 1. Drop a trailing " | Brand" when the tail merely repeats the domain.
  for (const sep of SEPARATORS) {
    const idx = title.lastIndexOf(` ${sep} `)
    if (idx > 12) {
      const tail = title.slice(idx + sep.length + 2).trim()
      if (tail.length <= 32 && (normalise(tail) === normalise(brandish) || normalise(tail).includes(normalise(brandish)))) {
        title = title.slice(0, idx).trim()
        break
      }
    }
  }

  // 2. If what is left is prose, the site is using its tagline as its title.
  //    Prefer the leading segment before a separator, then og:site_name.
  if (looksLikeProse(title)) {
    let best = ''
    for (const sep of SEPARATORS) {
      const idx = title.indexOf(` ${sep} `)
      if (idx > 1) {
        const head = title.slice(0, idx).trim()
        if (!looksLikeProse(head) && head.length >= 2) {
          best = head
          break
        }
      }
    }
    if (!best && siteName && !looksLikeProse(siteName)) best = siteName.trim()
    if (!best) {
      const h = heading.replace(/\s+/g, ' ').trim()
      if (h && h.length <= 48 && !isGeneric(h) && !looksLikeProse(h)) best = h
    }
    if (!best) best = fromDomain()
    title = best
  }

  // 3. Trim leftover separator debris and normalise shouting.
  title = title.replace(/^[\s|·—–\-•»:]+|[\s|·—–\-•»:]+$/g, '').trim()
  return fixCaps(title)
}

export function parseMetadata(html: string, baseUrl: string): PageMetadata {
  const $ = cheerio.load(html)
  const parsedBase = normalizeUrl(baseUrl)
  const host = parsedBase?.host ?? ''

  const meta = (selector: string) => $(selector).attr('content') ?? ''

  // `<title>` is also an SVG element, and an icon-heavy page with no document
  // title has plenty of them. Taking the first one in document order listed a
  // site as "Slash forward icon". Only a title outside an <svg> is the page's.
  const documentTitle = $('title')
    .filter((_, el) => $(el).parents('svg').length === 0)
    .first()
    .text()

  const rawTitle = firstNonEmpty(
    meta('meta[property="og:title"]'),
    meta('meta[name="twitter:title"]'),
    documentTitle,
    $('h1').first().text(),
    parsedBase?.domain,
  )
  const siteName = firstNonEmpty(meta('meta[property="og:site_name"]'), meta('meta[name="application-name"]'))
  const heading = $('h1').first().text()
  const title = truncate(cleanTitle(rawTitle, host, siteName, heading) || parsedBase?.domain || 'Untitled', 90)

  const description = truncate(
    firstNonEmpty(
      meta('meta[name="description"]'),
      meta('meta[property="og:description"]'),
      meta('meta[name="twitter:description"]'),
      $('main p').first().text(),
      $('p').first().text(),
    ),
    400,
  )

  const imageCandidate = firstNonEmpty(
    meta('meta[property="og:image:secure_url"]'),
    meta('meta[property="og:image"]'),
    meta('meta[name="twitter:image"]'),
    meta('meta[name="twitter:image:src"]'),
    meta('meta[itemprop="image"]'),
  )
  const imageUrl = imageCandidate ? resolveUrl(baseUrl, imageCandidate) : null

  const iconHref = firstNonEmpty(
    $('link[rel="apple-touch-icon"]').attr('href'),
    $('link[rel="icon"][sizes="192x192"]').attr('href'),
    $('link[rel="icon"]').attr('href'),
    $('link[rel="shortcut icon"]').attr('href'),
  )
  const faviconUrl = iconHref ? resolveUrl(baseUrl, iconHref) : parsedBase ? `${new URL(baseUrl).origin}/favicon.ico` : null

  const lang = (firstNonEmpty($('html').attr('lang'), meta('meta[property="og:locale"]')) || 'en')
    .slice(0, 5)
    .toLowerCase()
    .replace('_', '-')

  const keywords = firstNonEmpty(meta('meta[name="keywords"]'), meta('meta[property="article:tag"]'))
    .split(/[,;]/)
    .map((k) => k.trim().toLowerCase())
    .filter((k) => k.length > 1 && k.length < 32)
    .slice(0, 20)

  const feeds: string[] = []
  $('link[rel="alternate"]').each((_, el) => {
    const type = ($(el).attr('type') ?? '').toLowerCase()
    const href = $(el).attr('href')
    if (href && (type.includes('rss') || type.includes('atom') || type.includes('feed'))) {
      const abs = resolveUrl(baseUrl, href)
      if (abs) feeds.push(abs)
    }
  })

  const canonicalHref = $('link[rel="canonical"]').attr('href')
  const canonical = canonicalHref ? resolveUrl(baseUrl, canonicalHref) : null

  // -------------------------------------------------------------- link graph
  const outbound = new Map<string, NormalizedUrl>()
  let internalLinkCount = 0
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href')
    if (!href || href.startsWith('#')) return
    const abs = resolveUrl(baseUrl, href)
    if (!abs) return
    const n = normalizeUrl(abs)
    if (!n) return
    if (n.domain === parsedBase?.domain) {
      internalLinkCount++
      return
    }
    if (!isIndexableUrl(n).ok) return
    if (!outbound.has(n.domain)) outbound.set(n.domain, n)
  })

  // ----------------------------------------------------------------- signals
  const htmlLower = html.toLowerCase()
  const bodyText = $('body').text().replace(/\s+/g, ' ').trim()
  const textLower = bodyText.toLowerCase().slice(0, 20_000)

  const signals: PageSignals = {
    hasAdScripts: AD_PATTERNS.some((p) => htmlLower.includes(p)),
    hasAnalytics: ANALYTICS_PATTERNS.some((p) => htmlLower.includes(p)),
    hasPaywallHint: PAYWALL_PATTERNS.some((p) => textLower.includes(p)),
    hasLoginWall: LOGIN_WALL_PATTERNS.some((p) => textLower.includes(p)),
    isParked:
      PARKED_PATTERNS.some((p) => textLower.includes(p) || htmlLower.includes(p)) ||
      (bodyText.length < 220 && $('a').length < 6),
    scriptCount: $('script').length,
    wordCount: bodyText ? bodyText.split(/\s+/).length : 0,
    headingCount: $('h1,h2,h3').length,
    interactiveCount: $('canvas,svg,input,button,select,textarea,video,audio,iframe').length,
    hasViewport: $('meta[name="viewport"]').length > 0,
    hasManifest: $('link[rel="manifest"]').length > 0,
    hasOpenGraph: $('meta[property^="og:"]').length > 0,
    hasStructuredData: $('script[type="application/ld+json"]').length > 0,
    funnelPhrases: FUNNEL_PATTERNS.filter((p) => textLower.includes(p)).length,
  }

  return {
    url: baseUrl,
    title,
    siteName,
    description,
    imageUrl,
    faviconUrl,
    lang,
    keywords,
    feeds: [...new Set(feeds)].slice(0, 3),
    outboundLinks: [...outbound.values()].map((n) => n.href).slice(0, 60),
    internalLinkCount,
    canonical,
    themeColor: meta('meta[name="theme-color"]') || null,
    textSample: bodyText.slice(0, 4000),
    signals,
  }
}

/** Condense a description into a punchy one-line tagline. */
export function makeTagline(meta: PageMetadata): string {
  const source = meta.description || meta.textSample
  if (!source) return ''
  const firstSentence = source.split(/(?<=[.!?])\s+/)[0] ?? source
  const candidate = firstSentence.length >= 24 && firstSentence.length <= 120 ? firstSentence : source
  return truncate(candidate.replace(/\s+/g, ' ').trim(), 118)
}
