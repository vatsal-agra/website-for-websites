'use server'

import { audit, get } from '@/lib/db'
import { clientKey, getCurrentUser } from '@/lib/session'
import { LIMITS, rateLimit } from '@/lib/ratelimit'
import { ingestUrl } from '@/lib/ingest'
import { normalizeUrl } from '@/lib/url'
import { getSiteByDomainKey } from '@/lib/queries/sites'

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
    return {
      status: 'error',
      message: `That is enough submissions for now — try again in about ${Math.ceil(limit.retryAfterSeconds / 60)} minutes.`,
    }
  }

  // honeypot: real people never fill this in
  if (String(formData.get('website') ?? '')) {
    return { status: 'ok', message: 'Thanks — we will take a look.' }
  }

  const raw = String(formData.get('url') ?? '').trim()
  if (!raw) return { status: 'error', message: 'Paste the address of the site you want to add.' }

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

  return {
    status: 'ok',
    slug: outcome.slug,
    title: outcome.title,
    reviewed: outcome.status !== 'approved',
    message:
      outcome.status === 'approved'
        ? 'It is live in the catalogue already.'
        : 'It is in the review queue — an editor will look at it shortly.',
  }
}

function friendlyReason(stage: string, reason: string): string {
  switch (stage) {
    case 'fetch':
      return `We could not load that page (${reason}). Check the address, or try again once the site is back up.`
    case 'robots':
      return 'That site’s robots.txt asks crawlers not to read it, so we cannot catalogue it.'
    case 'content-type':
      return 'That address returned a file rather than a web page.'
    case 'filter':
      return `We do not list this kind of link — ${reason}.`
    case 'safety-url':
    case 'safety-content':
      return `That site did not pass our content checks (${reason}).`
    default:
      return reason || 'Something went wrong while reading that page.'
  }
}
