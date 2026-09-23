'use server'

import { audit, get } from '@/lib/db'
import { clientKey, getCurrentUser } from '@/lib/session'
import { LIMITS, rateLimit } from '@/lib/ratelimit'
import { ingestUrl } from '@/lib/ingest'
import { describeUrlProblem } from '@/lib/submit-url'
import { normalizeUrl } from '@/lib/url'
import { getSiteByDomainKey, invalidateCategoryCache } from '@/lib/queries/sites'
import { invalidateStats } from '@/lib/queries/stats'

export interface SubmitState {
  status: 'idle' | 'ok' | 'duplicate' | 'error'
  message?: string
  slug?: string
  title?: string
  reviewed?: boolean
}

export async function submitSiteAction(_prev: SubmitState, formData: FormData): Promise<SubmitState> {
  const ip = await clientKey()
  const user = await getCurrentUser()

  const limit = await rateLimit('submit', user ? `u${user.id}` : ip, LIMITS.submit.limit, LIMITS.submit.window)
  if (!limit.ok) {
    return { status: 'error', message: `That is enough submissions for now. ${retryIn(limit.retryAfterSeconds)}` }
  }

  // honeypot: real people never fill this in
  if (String(formData.get('website') ?? '')) {
    return { status: 'ok', message: 'Thanks, we will take a look.' }
  }

  const raw = String(formData.get('url') ?? '').trim()
  const problem = describeUrlProblem(raw)
  if (problem) return { status: 'error', message: problem }

  const normalized = normalizeUrl(raw)
  if (!normalized) {
    return { status: 'error', message: 'That does not look like a web address. Try something like example.com.' }
  }

  const existing = await getSiteByDomainKey(normalized.key)
  if (existing) {
    return {
      status: 'duplicate',
      message: `${existing.title} is already catalogued.`,
      slug: existing.slug,
      title: existing.title,
    }
  }

  const note = String(formData.get('note') ?? '').trim().slice(0, 400)

  const outcome = await ingestUrl({
    url: normalized.href,
    source: 'submission',
    submittedBy: user?.id ?? null,
    allowDeep: true,
    note,
  })

  if (!outcome.ok) {
    if (outcome.stage === 'duplicate' && outcome.siteId) {
      const site = await get<{ slug: string; title: string }>('SELECT slug, title FROM sites WHERE id = ?', [
        outcome.siteId,
      ])
      return {
        status: 'duplicate',
        message: `${site?.title ?? 'That site'} is already catalogued.`,
        slug: site?.slug,
        title: site?.title,
      }
    }
    return { status: 'error', message: friendlyReason(outcome.stage, outcome.reason) }
  }

  audit('site.submitted', outcome.slug, note || '(no note)', user ? `@${user.username}` : `ip:${ip}`)

  // the catalogue just grew: drop the memoised counters so the footer, the
  // shelf counts and the moderator's pending badge all reflect it immediately
  invalidateStats()
  invalidateCategoryCache()

  return {
    status: 'ok',
    slug: outcome.slug,
    title: outcome.title,
    reviewed: outcome.status !== 'approved',
    message:
      outcome.status === 'approved'
        ? 'It is live in the catalogue already.'
        : 'It is in the review queue. An editor will look at it shortly.',
  }
}

/** How long until the next submission is allowed, in words. */
function retryIn(seconds: number): string {
  if (seconds <= 60) return 'Try again in under a minute.'
  const minutes = Math.ceil(seconds / 60)
  if (minutes < 60) return `Try again in about ${minutes} minutes.`
  const hours = Math.ceil(minutes / 60)
  return `Try again in about ${hours} ${hours === 1 ? 'hour' : 'hours'}.`
}

function friendlyReason(stage: string, reason: string): string {
  switch (stage) {
    case 'normalize':
      return 'That does not look like a web address. Try something like example.com.'
    case 'fetch':
      return `We could not load that page (${reason}). Check the address for a typo, or try again once the site is back up.`
    case 'robots':
      return 'That site’s robots.txt asks crawlers not to read it, so we cannot catalogue it.'
    case 'content-type':
      return 'That address returned a file rather than a web page. Link to the page it sits on instead.'
    case 'filter':
      return `We do not list this kind of link: ${reason}. A site’s own homepage is usually the right thing to submit.`
    case 'safety-url':
    case 'safety-content':
      return `That site did not pass our content checks (${reason}).`
    default:
      return reason || 'Something went wrong while reading that page. Try again in a few minutes.'
  }
}
