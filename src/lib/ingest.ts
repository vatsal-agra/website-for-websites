import { all, audit, get, run, nowIso } from './db'
import { env } from './env'
import { fetchText, robotsAllows } from './fetcher'
import { makeTagline, parseMetadata } from './metadata'
import { classify, deriveAttributes, scoreQuality } from './classify'
import { screenContent, screenUrl } from './safety'
import { isIndexableUrl, isServiceSubdomain, normalizeUrl } from './url'
import { fallbackAccent } from './thumbs'
import { enqueue } from './jobs'
import { getSiteByDomainKey, reindexSite, setSiteTags, uniqueSlug, updateTrendingFor } from './queries/sites'
import { truncate } from './utils'

export interface IngestInput {
  url: string
  source?: string
  sourceRef?: string | null
  submittedBy?: number | null
  /** override the computed status, used by admin tools and the seeder */
  forceStatus?: 'approved' | 'pending'
  note?: string
  /** allow deep sub-pages (submissions may point at a specific page) */
  allowDeep?: boolean
  skipThumbnail?: boolean
  skipExpand?: boolean
}

export type IngestOutcome =
  | { ok: true; siteId: number; slug: string; status: string; quality: number; created: boolean; title: string }
  | { ok: false; reason: string; stage: string; siteId?: number }

async function categoryIdFor(slug: string): Promise<number | null> {
  const row = await get<{ id: number }>('SELECT id FROM categories WHERE slug = ?', [slug])
  return row ? Number(row.id) : null
}

/** Is any site from this organisation already in the catalogue? */
export async function rootAlreadyListed(root: string, excludeId?: number): Promise<boolean> {
  const row = await get(
    `SELECT 1 AS x FROM sites
     WHERE (domain = ? OR domain LIKE '%.' || ?)
       AND status IN ('approved','pending')
       AND id != ?
     LIMIT 1`,
    [root, root, excludeId ?? -1],
  )
  return Boolean(row)
}

/** Push discovered outbound links into the candidate pool. */
export async function enqueueCandidates(
  links: string[],
  opts: { foundFrom: string; source: string; sourceRef?: string | null; weight?: number },
): Promise<number> {
  let added = 0
  for (const link of links) {
    const n = normalizeUrl(link)
    if (!n) continue
    if (!isIndexableUrl(n).ok) continue
    if (!n.isHomepage) continue // the link graph only harvests homepages
    if (n.domain === opts.foundFrom) continue
    if (isServiceSubdomain(n.host)) continue // shop./help./careers./status. …
    if (await get('SELECT 1 AS x FROM sites WHERE domain_key = ?', [n.domain])) continue
    // A directory should list NASA once, not oig.nasa.gov and ciencia.nasa.gov
    // beside it. Automatic discovery stops at one entry per organisation; a
    // person can still submit a genuinely distinct subdomain by hand.
    if (await rootAlreadyListed(n.root)) continue

    const res = await run(
      `INSERT INTO candidates (url, url_key, source, source_ref, found_from, weight)
       VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT (url_key) DO NOTHING`,
      [n.href, n.key, opts.source, opts.sourceRef ?? null, opts.foundFrom, opts.weight ?? 1],
    )
    if (res.rowsAffected) added++
  }
  return added
}

/** Take the best queued candidates and turn them into ingest jobs. */
export async function drainCandidates(limit = 20): Promise<number> {
  const rows = await all<{ id: number; url: string; source: string; source_ref: string | null }>(
    `SELECT * FROM candidates WHERE status = 'queued' ORDER BY weight DESC, id ASC LIMIT ?`,
    [limit],
  )
  let queued = 0
  for (const row of rows) {
    const id = await enqueue(
      'ingest.url',
      { url: row.url, source: row.source, sourceRef: row.source_ref },
      { dedupeKey: `ingest:${row.url}`, priority: 1 },
    )
    await run(`UPDATE candidates SET status = 'done' WHERE id = ?`, [Number(row.id)])
    if (id) queued++
  }
  return queued
}

/**
 * The heart of web-amble: turn a bare URL into a catalogued site.
 */
export async function ingestUrl(input: IngestInput): Promise<IngestOutcome> {
  const normalized = normalizeUrl(input.url)
  if (!normalized) return { ok: false, reason: 'That does not look like a web address.', stage: 'normalize' }

  const indexable = isIndexableUrl(normalized)
  if (!indexable.ok && !(input.allowDeep && indexable.reason === 'deep sub-page')) {
    return { ok: false, reason: indexable.reason ?? 'not indexable', stage: 'filter' }
  }

  const urlScreen = await screenUrl(normalized)
  if (!urlScreen.allowed) return { ok: false, reason: urlScreen.reason, stage: 'safety-url' }

  const existing = await getSiteByDomainKey(normalized.key)
  if (existing) {
    return { ok: false, reason: 'already in the catalogue', stage: 'duplicate', siteId: Number(existing.id) }
  }

  if (!(await robotsAllows(normalized.href))) {
    return { ok: false, reason: 'robots.txt asks us not to crawl this page', stage: 'robots' }
  }

  const res = await fetchText(normalized.href)
  if (!res.ok || !res.body) {
    return {
      ok: false,
      reason: res.error ? `could not fetch (${res.error})` : `site returned ${res.status}`,
      stage: 'fetch',
    }
  }
  if (!/text\/html|application\/xhtml/i.test(res.contentType)) {
    return { ok: false, reason: 'not an HTML page', stage: 'content-type' }
  }

  // follow redirects to the real destination and re-check duplicates
  const finalNormalized = normalizeUrl(res.finalUrl) ?? normalized
  if (finalNormalized.key !== normalized.key) {
    const redirected = await getSiteByDomainKey(finalNormalized.key)
    if (redirected) {
      return { ok: false, reason: 'redirects to a site we already list', stage: 'duplicate', siteId: Number(redirected.id) }
    }
    const redirectScreen = await screenUrl(finalNormalized)
    if (!redirectScreen.allowed) return { ok: false, reason: redirectScreen.reason, stage: 'safety-url' }
  }

  const meta = parseMetadata(res.body, finalNormalized.href)

  const contentScreen = screenContent(meta)
  if (!contentScreen.allowed) return { ok: false, reason: contentScreen.reason, stage: 'safety-content' }

  const classification = classify(meta)
  const attributes = deriveAttributes(meta)
  const quality = scoreQuality(meta, {
    status: res.status,
    elapsedMs: res.elapsedMs,
    https: finalNormalized.href.startsWith('https://'),
  })

  // Another site from the same organisation is already listed. That is not
  // automatically wrong — eyes.nasa.gov earns its own entry — but it is a
  // judgement call, so it goes to a human rather than straight onto the shelf.
  const siblingListed = await rootAlreadyListed(finalNormalized.root)

  const needsReview = urlScreen.action === 'review' || contentScreen.action === 'review' || siblingListed
  const autoApprove =
    env.autoApproveQuality > 0 &&
    quality.score >= env.autoApproveQuality &&
    !needsReview &&
    input.source !== 'submission'

  const status = input.forceStatus ?? (autoApprove ? 'approved' : 'pending')

  const title = meta.title || finalNormalized.domain
  const slug = await uniqueSlug(title.length > 3 ? title : finalNormalized.domain)
  const accent = fallbackAccent(finalNormalized.href)
  const tagline = makeTagline(meta)

  const row = await get<{ id: number }>(
    `INSERT INTO sites (
      slug, url, domain, domain_key, title, tagline, description, category_id,
      favicon_url, accent_hue, accent_hex, lang, status, source, source_ref, submitted_by,
      attributes, quality, http_status, published_at, checked_at, editor_note
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    RETURNING id`,
    [
      slug,
      finalNormalized.href,
      finalNormalized.domain,
      finalNormalized.key,
      truncate(title, 90),
      tagline,
      meta.description,
      await categoryIdFor(classification.categorySlug),
      meta.faviconUrl,
      accent.hue,
      accent.hex,
      meta.lang,
      status,
      input.source ?? 'submission',
      input.sourceRef ?? null,
      input.submittedBy ?? null,
      JSON.stringify(attributes),
      quality.score,
      res.status,
      status === 'approved' ? nowIso() : null,
      nowIso(),
      siblingListed && !input.note
        ? `Another site on ${finalNormalized.root} is already listed — check this is a distinct destination.`
        : input.note ?? '',
    ],
  )
  const siteId = Number(row!.id)

  await setSiteTags(siteId, classification.tags)
  await updateTrendingFor(siteId)

  if (!input.skipThumbnail) {
    await enqueue(
      'site.thumbnail',
      { siteId },
      { dedupeKey: `thumb:${siteId}`, priority: status === 'approved' ? 3 : 1 },
    )
  }
  if (!input.skipExpand && status === 'approved') {
    await enqueueCandidates(meta.outboundLinks, {
      foundFrom: finalNormalized.domain,
      source: 'linkgraph',
      sourceRef: finalNormalized.href,
      weight: quality.score,
    })
  }

  await audit('site.ingested', slug, `${input.source ?? 'submission'} · q=${quality.score} · ${status}`)

  return { ok: true, siteId, slug, status, quality: quality.score, created: true, title: truncate(title, 90) }
}

/**
 * Re-fetch an existing site: refresh its metadata, re-score it, re-file it
 * against the current lexicon, and retire it if it has been dead three times.
 */
export async function refreshSite(siteId: number): Promise<{ ok: boolean; detail: string }> {
  const site = await get<any>('SELECT * FROM sites WHERE id = ?', [siteId])
  if (!site) return { ok: false, detail: 'site not found' }

  const res = await fetchText(site.url)
  if (!res.ok || !res.body) {
    const strikes = Number(site.dead_strikes ?? 0) + 1
    const nextStatus = strikes >= 3 && site.status === 'approved' ? 'archived' : site.status
    await run(
      `UPDATE sites SET dead_strikes = ?, http_status = ?, checked_at = ?, status = ?, updated_at = ? WHERE id = ?`,
      [strikes, res.status || 0, nowIso(), nextStatus, nowIso(), siteId],
    )
    if (nextStatus === 'archived') await audit('site.archived', site.slug, `dead after ${strikes} checks`)
    return { ok: false, detail: `unreachable (${res.error ?? res.status}), strike ${strikes}` }
  }

  const meta = parseMetadata(res.body, res.finalUrl || site.url)
  const contentScreen = screenContent(meta)
  if (!contentScreen.allowed) {
    await run(
      `UPDATE sites SET status = 'rejected', reject_reason = ?, checked_at = ?, updated_at = ? WHERE id = ?`,
      [`recheck: ${contentScreen.reason}`, nowIso(), nowIso(), siteId],
    )
    await audit('site.rejected', site.slug, `recheck: ${contentScreen.reason}`)
    return { ok: false, detail: `now failing content screen: ${contentScreen.reason}` }
  }

  const quality = scoreQuality(meta, {
    status: res.status,
    elapsedMs: res.elapsedMs,
    https: (res.finalUrl || site.url).startsWith('https://'),
  })
  const attributes = deriveAttributes(meta)

  await run(
    `UPDATE sites SET
       description = CASE WHEN length(?) > length(description) THEN ? ELSE description END,
       tagline = CASE WHEN tagline = '' THEN ? ELSE tagline END,
       favicon_url = COALESCE(?, favicon_url),
       attributes = ?, quality = ?, http_status = ?, dead_strikes = 0,
       checked_at = ?, updated_at = ?
     WHERE id = ?`,
    [
      meta.description,
      meta.description,
      makeTagline(meta),
      meta.faviconUrl,
      JSON.stringify(attributes),
      quality.score,
      res.status,
      nowIso(),
      nowIso(),
      siteId,
    ],
  )

  // Re-file against the current lexicon while we have the full page text. This
  // is how classifier improvements reach sites indexed long ago — but never
  // over a shelf a human chose, or over the curated founding set.
  if (!site.category_locked && site.source !== 'seed') {
    const classification = classify(meta)
    const category = await get<{ id: number }>('SELECT id FROM categories WHERE slug = ?', [
      classification.categorySlug,
    ])
    if (category && Number(category.id) !== Number(site.category_id)) {
      await run('UPDATE sites SET category_id = ? WHERE id = ?', [Number(category.id), siteId])
    }
    if (classification.tags.length) await setSiteTags(siteId, classification.tags)
  }

  if (site.status === 'approved') {
    await enqueueCandidates(meta.outboundLinks, {
      foundFrom: site.domain,
      source: 'linkgraph',
      sourceRef: site.url,
      weight: quality.score,
    })
  }

  await reindexSite(siteId)
  await updateTrendingFor(siteId)
  return { ok: true, detail: `refreshed, quality ${quality.score}` }
}
