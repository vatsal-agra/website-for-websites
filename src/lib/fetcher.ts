import { env } from './env'

export interface FetchTextResult {
  ok: boolean
  status: number
  finalUrl: string
  contentType: string
  body: string
  bytes: number
  elapsedMs: number
  error?: string
  truncated?: boolean
}

export interface FetchBinaryResult {
  ok: boolean
  status: number
  finalUrl: string
  contentType: string
  buffer: Buffer | null
  error?: string
}

const lastHitByHost = new Map<string, number>()

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** Space requests to the same host out by CRAWLER_HOST_DELAY_MS. */
async function politeWait(host: string) {
  const delay = env.crawlerHostDelayMs
  if (delay <= 0) return
  const last = lastHitByHost.get(host) ?? 0
  const wait = last + delay - Date.now()
  if (wait > 0) await sleep(wait)
  lastHitByHost.set(host, Date.now())
}

function headers(extra?: Record<string, string>): Record<string, string> {
  return {
    'user-agent': env.crawlerUserAgent,
    accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'accept-language': 'en,*;q=0.5',
    ...extra,
  }
}

/** Fetch a text/HTML resource with a byte cap, timeout and per-host politeness. */
export async function fetchText(url: string, opts: { polite?: boolean; accept?: string } = {}): Promise<FetchTextResult> {
  const started = Date.now()
  let host = ''
  try {
    host = new URL(url).hostname
  } catch {
    return { ok: false, status: 0, finalUrl: url, contentType: '', body: '', bytes: 0, elapsedMs: 0, error: 'invalid url' }
  }
  if (opts.polite !== false) await politeWait(host)

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), env.crawlerTimeoutMs)

  try {
    const res = await fetch(url, {
      headers: headers(opts.accept ? { accept: opts.accept } : undefined),
      redirect: 'follow',
      signal: controller.signal,
    })
    const contentType = res.headers.get('content-type') ?? ''

    const reader = res.body?.getReader()
    let received = 0
    const chunks: Uint8Array[] = []
    let truncated = false
    if (reader) {
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        if (value) {
          chunks.push(value)
          received += value.byteLength
          if (received > env.crawlerMaxHtmlBytes) {
            truncated = true
            await reader.cancel().catch(() => {})
            break
          }
        }
      }
    }
    const buffer = Buffer.concat(chunks.map((c) => Buffer.from(c)))
    const charset = /charset=([\w-]+)/i.exec(contentType)?.[1]?.toLowerCase()
    const encoding: BufferEncoding = charset && /^(utf-?8|ascii|latin1|iso-8859-1)$/.test(charset)
      ? (charset.startsWith('utf') ? 'utf8' : 'latin1')
      : 'utf8'

    return {
      ok: res.ok,
      status: res.status,
      finalUrl: res.url || url,
      contentType,
      body: buffer.toString(encoding),
      bytes: received,
      elapsedMs: Date.now() - started,
      truncated,
    }
  } catch (err) {
    const message = err instanceof Error ? (err.name === 'AbortError' ? 'timeout' : err.message) : 'fetch failed'
    return {
      ok: false,
      status: 0,
      finalUrl: url,
      contentType: '',
      body: '',
      bytes: 0,
      elapsedMs: Date.now() - started,
      error: message,
    }
  } finally {
    clearTimeout(timer)
  }
}

/** Fetch binary data (images) with a hard size cap. */
export async function fetchBinary(url: string, maxBytes = 6_000_000): Promise<FetchBinaryResult> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), env.crawlerTimeoutMs)
  try {
    const res = await fetch(url, {
      headers: headers({ accept: 'image/avif,image/webp,image/png,image/jpeg,image/*;q=0.8,*/*;q=0.5' }),
      redirect: 'follow',
      signal: controller.signal,
    })
    if (!res.ok) {
      return { ok: false, status: res.status, finalUrl: res.url || url, contentType: '', buffer: null, error: `status ${res.status}` }
    }
    const contentType = res.headers.get('content-type') ?? ''
    const declared = Number(res.headers.get('content-length') ?? '0')
    if (declared && declared > maxBytes) {
      return { ok: false, status: res.status, finalUrl: res.url, contentType, buffer: null, error: 'too large' }
    }
    const arrayBuffer = await res.arrayBuffer()
    if (arrayBuffer.byteLength > maxBytes) {
      return { ok: false, status: res.status, finalUrl: res.url, contentType, buffer: null, error: 'too large' }
    }
    return { ok: true, status: res.status, finalUrl: res.url || url, contentType, buffer: Buffer.from(arrayBuffer) }
  } catch (err) {
    const message = err instanceof Error ? (err.name === 'AbortError' ? 'timeout' : err.message) : 'fetch failed'
    return { ok: false, status: 0, finalUrl: url, contentType: '', buffer: null, error: message }
  } finally {
    clearTimeout(timer)
  }
}

// ------------------------------------------------------------------ robots --

interface RobotsRules {
  disallow: string[]
  allow: string[]
  fetchedAt: number
}

const robotsCache = new Map<string, RobotsRules>()
const ROBOTS_TTL_MS = 30 * 60 * 1000

function parseRobots(txt: string, agent: string): RobotsRules {
  const lines = txt.split(/\r?\n/)
  const groups: { agents: string[]; allow: string[]; disallow: string[] }[] = []
  let current: { agents: string[]; allow: string[]; disallow: string[] } | null = null
  let lastWasAgent = false

  for (const rawLine of lines) {
    const line = rawLine.split('#')[0].trim()
    if (!line) continue
    const idx = line.indexOf(':')
    if (idx === -1) continue
    const field = line.slice(0, idx).trim().toLowerCase()
    const value = line.slice(idx + 1).trim()

    if (field === 'user-agent') {
      if (!current || !lastWasAgent) {
        current = { agents: [], allow: [], disallow: [] }
        groups.push(current)
      }
      current.agents.push(value.toLowerCase())
      lastWasAgent = true
    } else if (current && (field === 'allow' || field === 'disallow')) {
      lastWasAgent = false
      if (field === 'allow') current.allow.push(value)
      else current.disallow.push(value)
    } else {
      lastWasAgent = false
    }
  }

  const token = agent.toLowerCase()
  const specific = groups.find((g) => g.agents.some((a) => a !== '*' && token.includes(a)))
  const wildcard = groups.find((g) => g.agents.includes('*'))
  const chosen = specific ?? wildcard
  return { allow: chosen?.allow ?? [], disallow: chosen?.disallow ?? [], fetchedAt: Date.now() }
}

function matchesRule(path: string, rule: string): boolean {
  if (rule === '') return false
  // robots wildcards: * (any run) and $ (end anchor)
  const escaped = rule.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')
  const anchored = escaped.endsWith('\\$') ? `^${escaped.slice(0, -2)}$` : `^${escaped}`
  try {
    return new RegExp(anchored).test(path)
  } catch {
    return path.startsWith(rule)
  }
}

/** Best-effort robots.txt check. Fails open — an unreachable robots.txt allows. */
export async function robotsAllows(url: string): Promise<boolean> {
  if (!env.crawlerRespectRobots) return true
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return false
  }
  const origin = parsed.origin
  const cached = robotsCache.get(origin)
  let rules = cached && Date.now() - cached.fetchedAt < ROBOTS_TTL_MS ? cached : null

  if (!rules) {
    const res = await fetchText(`${origin}/robots.txt`, { accept: 'text/plain,*/*;q=0.5' })
    rules = res.ok && /text\/plain|text\//i.test(res.contentType || 'text/plain')
      ? parseRobots(res.body.slice(0, 200_000), env.crawlerUserAgent)
      : { allow: [], disallow: [], fetchedAt: Date.now() }
    robotsCache.set(origin, rules)
  }

  const path = parsed.pathname + parsed.search
  const bestAllow = rules.allow.filter((r) => matchesRule(path, r)).sort((a, b) => b.length - a.length)[0]
  const bestDisallow = rules.disallow.filter((r) => matchesRule(path, r)).sort((a, b) => b.length - a.length)[0]
  if (!bestDisallow) return true
  if (bestAllow && bestAllow.length >= bestDisallow.length) return true
  return false
}

/** Run async work with a bounded concurrency pool. */
export async function pool<T, R>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let cursor = 0
  const size = Math.max(1, Math.min(limit, items.length))
  await Promise.all(
    Array.from({ length: size }, async () => {
      for (;;) {
        const index = cursor++
        if (index >= items.length) return
        results[index] = await worker(items[index], index)
      }
    }),
  )
  return results
}
