/** URL normalisation, host handling and link hygiene for the crawler. */

const TRACKING_PARAMS = [
  /^utm_/i,
  /^fbclid$/i,
  /^gclid$/i,
  /^mc_(cid|eid)$/i,
  /^ref$/i,
  /^ref_src$/i,
  /^source$/i,
  /^igshid$/i,
  /^si$/i,
  /^spm$/i,
  /^_ga$/i,
]

/**
 * Hosts matched *exactly*. Subdomains are still fair game, because plenty of
 * them are real destinations in their own right — fonts.google.com and
 * scholar.google.com deserve a listing even though google.com does not.
 */
export const PLATFORM_HOSTS = new Set([
  'twitter.com',
  'x.com',
  'facebook.com',
  'instagram.com',
  'threads.net',
  'tiktok.com',
  'linkedin.com',
  'pinterest.com',
  'reddit.com',
  'old.reddit.com',
  'news.ycombinator.com',
  'lobste.rs',
  'youtube.com',
  'youtu.be',
  'vimeo.com',
  'amazon.com',
  'ebay.com',
  'apple.com',
  'play.google.com',
  'apps.apple.com',
  'google.com',
  'goo.gl',
  'bit.ly',
  't.co',
  'tinyurl.com',
  'medium.com',
  'web.archive.org',
  'gist.github.com',
  'paypal.com',
  'patreon.com',
  'discord.com',
  'discord.gg',
  'slack.com',
  'telegram.me',
  't.me',
  'whatsapp.com',
  'mastodon.social',
  'bsky.app',
  'stackoverflow.com',
  'quora.com',
  'imgur.com',
  'flickr.com',
  'dropbox.com',
  'drive.google.com',
  'docs.google.com',
  'notion.so',
  'airtable.com',
  'zoom.us',
  'eventbrite.com',
  'meetup.com',
  'kickstarter.com',
  'gofundme.com',
  'buymeacoffee.com',
  'ko-fi.com',
  'npmjs.com',
  'pypi.org',
  'crates.io',
  'hub.docker.com',
  'producthunt.com',
  'indiehackers.com',
])

/**
 * Hosts matched on the registrable domain, so every subdomain is excluded too.
 * These are user-content farms and wiki families where each subdomain is a page
 * of somebody else's platform rather than a site of its own.
 */
export const PLATFORM_ROOTS = new Set([
  'wikipedia.org',
  'wikimedia.org',
  'wiktionary.org',
  'wikidata.org',
  'wikiquote.org',
  'wikisource.org',
  'wikivoyage.org',
  'fandom.com',
  'blogspot.com',
  'wordpress.com',
  'tumblr.com',
  'weebly.com',
  'wixsite.com',
  'squarespace.com',
  'myshopify.com',
  'substack.com',
  'gitbook.io',
  'zendesk.com',
  'atlassian.net',
  'sharepoint.com',
  'salesforce.com',
])

/**
 * Subdomains that are a facility of some other site rather than a destination:
 * merch shops, help centres, careers pages, status boards. Automatic discovery
 * skips these outright. A person can still submit one by hand — docs.python.org
 * is a genuinely great website — it just goes through review first.
 */
const SERVICE_SUBDOMAINS = new Set([
  'shop', 'store', 'merch', 'help', 'support', 'faq', 'careers', 'jobs', 'hiring',
  'status', 'uptime', 'forum', 'forums', 'community', 'discuss', 'answers',
  'account', 'accounts', 'login', 'signin', 'auth', 'sso', 'my', 'portal',
  'admin', 'dashboard', 'billing', 'pay', 'checkout', 'legal', 'privacy', 'terms',
  'api', 'cdn', 'static', 'assets', 'img', 'images', 'media', 'files', 'download',
  'downloads', 'mail', 'email', 'webmail', 'calendar', 'meet', 'events', 'connect',
  'awards', 'press', 'newsroom', 'investors', 'partners', 'affiliates', 'track',
])

export function isServiceSubdomain(host: string): boolean {
  const labels = host.split('.')
  if (labels.length < 3) return false
  return SERVICE_SUBDOMAINS.has(labels[0].toLowerCase())
}

/** Extensions we never treat as a website. */
const BAD_EXTENSIONS =
  /\.(pdf|zip|rar|7z|tar|gz|dmg|exe|msi|apk|mp3|mp4|mov|avi|mkv|wav|flac|png|jpe?g|gif|webp|svg|ico|css|js|json|xml|rss|atom|txt|csv|xlsx?|docx?|pptx?)$/i

export interface NormalizedUrl {
  href: string
  host: string
  /** host with a leading `www.` removed */
  domain: string
  /** apex-ish registrable domain, best effort */
  root: string
  path: string
  isHomepage: boolean
  /** stable dedupe key */
  key: string
}

const MULTI_PART_TLDS = new Set([
  'co.uk', 'org.uk', 'ac.uk', 'gov.uk', 'co.jp', 'or.jp', 'ne.jp', 'com.au', 'net.au',
  'org.au', 'co.nz', 'com.br', 'com.mx', 'co.in', 'co.za', 'com.tr', 'com.sg', 'com.hk',
  'co.kr', 'com.cn', 'com.tw', 'co.il', 'com.ar', 'com.co',
])

export function rootDomain(host: string): string {
  const parts = host.split('.').filter(Boolean)
  if (parts.length <= 2) return host
  const lastTwo = parts.slice(-2).join('.')
  if (MULTI_PART_TLDS.has(lastTwo)) return parts.slice(-3).join('.')
  return lastTwo
}

export function normalizeUrl(input: string): NormalizedUrl | null {
  if (!input) return null
  let raw = input.trim()
  if (!raw) return null
  if (raw.startsWith('//')) raw = `https:${raw}`
  if (!/^https?:\/\//i.test(raw)) {
    if (/^[a-z][a-z0-9+.-]*:/i.test(raw)) return null // mailto:, javascript:, tel: ...
    raw = `https://${raw}`
  }

  let u: URL
  try {
    u = new URL(raw)
  } catch {
    return null
  }

  if (u.protocol !== 'http:' && u.protocol !== 'https:') return null

  let host = u.hostname.toLowerCase().replace(/\.$/, '')
  if (!host.includes('.')) return null
  if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) return null
  if (host === 'localhost' || host.endsWith('.local') || host.endsWith('.localhost')) return null

  // strip tracking parameters, keep meaningful ones, sort for stability
  const params = new URLSearchParams(u.search)
  for (const key of [...params.keys()]) {
    if (TRACKING_PARAMS.some((re) => re.test(key))) params.delete(key)
  }
  const sorted = new URLSearchParams([...params.entries()].sort(([a], [b]) => a.localeCompare(b)))
  const search = sorted.toString()

  let path = u.pathname.replace(/\/{2,}/g, '/')
  if (path.length > 1) path = path.replace(/\/+$/, '')
  if (path === '') path = '/'

  const domain = host.replace(/^www\./, '')
  const isHomepage = (path === '/' || path === '') && !search

  const href = `${u.protocol}//${host}${path === '/' ? '/' : path}${search ? `?${search}` : ''}`
  const key = isHomepage ? domain : `${domain}${path}${search ? `?${search}` : ''}`

  return { href, host, domain, root: rootDomain(domain), path, isHomepage, key }
}

/** Is this URL plausibly a *website* worth listing (vs a file, a tweet, a login page)? */
export function isIndexableUrl(u: NormalizedUrl): { ok: boolean; reason?: string } {
  if (BAD_EXTENSIONS.test(u.path)) return { ok: false, reason: 'file download, not a page' }
  if (PLATFORM_HOSTS.has(u.domain)) {
    return { ok: false, reason: 'platform profile rather than a website' }
  }
  if (PLATFORM_ROOTS.has(u.root)) {
    return { ok: false, reason: 'hosted on a content platform rather than its own site' }
  }
  if (/^(login|signin|sign-in|register|signup|account|cart|checkout|admin|wp-admin)(\/|$)/i.test(u.path.slice(1))) {
    return { ok: false, reason: 'account or checkout page' }
  }
  if (u.path.split('/').filter(Boolean).length > 3) {
    return { ok: false, reason: 'deep sub-page' }
  }
  if (u.domain.length > 80) return { ok: false, reason: 'implausible hostname' }
  return { ok: true }
}

export function resolveUrl(base: string, href: string): string | null {
  try {
    return new URL(href, base).toString()
  } catch {
    return null
  }
}

export function faviconFor(url: string, size = 64): string {
  const n = normalizeUrl(url)
  if (!n) return ''
  return `https://icons.duckduckgo.com/ip3/${n.domain}.ico`.concat(size ? '' : '')
}

/**
 * Paths that are really just a homepage the server redirected us to. Showing
 * them adds noise, so the display label collapses back to the bare domain.
 */
const HOMEPAGE_PATHS =
  /^\/(index\.(html?|php|asp x?)|home|main|start|wiki\/main[_-]?page|[a-z]{2}(-[a-z]{2})?)\/?$/i

/** Human-facing short label for a URL, e.g. "maps.stamen.com/toner". */
export function displayUrl(url: string, maxLength = 40): string {
  const n = normalizeUrl(url)
  if (!n) return url
  const isHomepageish = n.path === '/' || HOMEPAGE_PATHS.test(n.path)
  const label = isHomepageish ? n.domain : `${n.domain}${n.path}`
  return label.length > maxLength ? `${label.slice(0, maxLength - 1)}…` : label
}
