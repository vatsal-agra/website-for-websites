import { all, audit, dayOffset, get, isoOffset, run, nowIso } from './db'
import { enqueue, registerHandler, requeueStalled } from './jobs'
import { drainCandidates, ingestUrl, refreshSite } from './ingest'
import { buildThumbnail, deleteThumb } from './thumbs'
import { pruneSessions } from './auth'
import { recomputeTrending, reindexSite } from './queries/sites'
import { dueSources, getSource, recordSourceRun, runSource } from './sources'

let registered = false

/**
 * Registering handlers is idempotent so the standalone worker, the scheduled
 * function and the admin "run now" button can all call it safely.
 */
export function registerAllHandlers() {
  if (registered) return
  registered = true

  // ------------------------------------------------------------ ingest.url --
  registerHandler('ingest.url', async (payload) => {
    const outcome = await ingestUrl({
      url: String(payload.url ?? ''),
      source: payload.source ?? 'linkgraph',
      sourceRef: payload.sourceRef ?? null,
      submittedBy: payload.submittedBy ?? null,
      forceStatus: payload.forceStatus,
      allowDeep: Boolean(payload.allowDeep),
    })
    if (!outcome.ok) {
      // record why a candidate was dropped so the admin panel can explain itself
      await run(`UPDATE candidates SET status = 'skipped', note = ? WHERE url = ?`, [
        `${outcome.stage}: ${outcome.reason}`.slice(0, 200),
        String(payload.url ?? ''),
      ])
      return { skipped: true, reason: outcome.reason, stage: outcome.stage }
    }
    return { siteId: outcome.siteId, slug: outcome.slug, status: outcome.status, quality: outcome.quality }
  })

  // -------------------------------------------------------- site.thumbnail --
  registerHandler('site.thumbnail', async (payload) => {
    const siteId = Number(payload.siteId)
    const site = await get<any>('SELECT * FROM sites WHERE id = ?', [siteId])
    if (!site) return { skipped: 'site gone' }

    // re-read og:image at generation time so we always use the freshest artwork
    let imageUrl: string | null = payload.imageUrl ?? null
    let faviconUrl: string | null = site.favicon_url
    if (!imageUrl) {
      const { fetchText } = await import('./fetcher')
      const { parseMetadata } = await import('./metadata')
      const res = await fetchText(site.url)
      if (res.ok && res.body) {
        const meta = parseMetadata(res.body, res.finalUrl || site.url)
        imageUrl = meta.imageUrl
        if (meta.faviconUrl && !faviconUrl) {
          await run('UPDATE sites SET favicon_url = ? WHERE id = ?', [meta.faviconUrl, siteId])
          faviconUrl = meta.faviconUrl
        }
      }
    }

    const previous = site.thumb_key as string | null
    const previousIcon = site.favicon_key as string | null

    const result = await buildThumbnail({ slug: site.slug, url: site.url, imageUrl, faviconUrl })

    await run(
      `UPDATE sites SET thumb_key = ?, favicon_key = ?, thumb_source = ?, accent_hex = ?, accent_hue = ?, updated_at = ?
       WHERE id = ?`,
      [result.key, result.faviconKey, result.source, result.accentHex, result.accentHue, nowIso(), siteId],
    )

    if (previous && previous !== result.key) await deleteThumb(previous)
    if (previousIcon && previousIcon !== result.faviconKey) await deleteThumb(previousIcon)

    return { source: result.source, hasCover: Boolean(result.key) }
  })

  // ----------------------------------------------------------- site.recheck --
  registerHandler('site.recheck', async (payload) => {
    const siteId = Number(payload.siteId)
    const outcome = await refreshSite(siteId)
    if (outcome.ok) {
      await enqueue('site.thumbnail', { siteId }, { dedupeKey: `thumb:${siteId}`, priority: 0, rerunFinished: true })
    }
    return outcome
  })

  // ------------------------------------------------------------ source.run --
  registerHandler('source.run', async (payload) => {
    const source = await getSource(Number(payload.sourceId))
    if (!source) return { skipped: 'source removed' }
    const result = await runSource(source)
    await recordSourceRun(Number(source.id), result)
    // immediately promote a few of the freshly found candidates
    const promoted = await drainCandidates(payload.promote ?? 12)
    return { ...result, promoted }
  })

  // ------------------------------------------------------ candidates.drain --
  registerHandler('candidates.drain', async (payload) => {
    const promoted = await drainCandidates(Number(payload.limit ?? 20))
    return { promoted }
  })

  // ------------------------------------------------------------ maintenance --
  registerHandler('maintenance.trending', async () => {
    const changed = await recomputeTrending()
    return { rescored: changed }
  })

  registerHandler('maintenance.cleanup', async () => {
    const day = 86_400_000
    const sessions = await pruneSessions()
    const stalled = await requeueStalled()
    const jobs = (
      await run(`DELETE FROM jobs WHERE status = 'done' AND finished_at < ?`, [isoOffset(-3 * day)])
    ).rowsAffected
    const candidates = (
      await run(`DELETE FROM candidates WHERE status != 'queued' AND created_at < ?`, [isoOffset(-30 * day)])
    ).rowsAffected
    const stats = (await run(`DELETE FROM site_stats WHERE day < ?`, [dayOffset(-120)])).rowsAffected
    const audits = (await run(`DELETE FROM audit_log WHERE created_at < ?`, [isoOffset(-90 * day)])).rowsAffected
    return { sessions, stalled, jobs, candidates, stats, audits }
  })

  registerHandler('maintenance.reindex', async () => {
    const ids = await all<{ id: number }>('SELECT id FROM sites')
    for (const { id } of ids) await reindexSite(Number(id))
    return { reindexed: ids.length }
  })
}

/**
 * Enqueue everything that is due. Called on each worker tick (and by the admin
 * "run now" button) — enqueue() is dedupe-keyed so this is safe to spam.
 */
export async function scheduleDueWork(): Promise<{ sources: number; maintenance: number }> {
  let sources = 0
  for (const source of await dueSources()) {
    const id = await enqueue(
      'source.run',
      { sourceId: Number(source.id) },
      { dedupeKey: `source:${source.id}:${new Date().toISOString().slice(0, 13)}`, priority: 2 },
    )
    if (id) sources++
  }

  let maintenance = 0
  const hourKey = new Date().toISOString().slice(0, 13)
  const dayKey = new Date().toISOString().slice(0, 10)
  if (await enqueue('maintenance.trending', {}, { dedupeKey: `trending:${hourKey}`, priority: 1 })) maintenance++
  if (await enqueue('maintenance.cleanup', {}, { dedupeKey: `cleanup:${dayKey}`, priority: 0 })) maintenance++
  if (await enqueue('candidates.drain', { limit: 15 }, { dedupeKey: `drain:${hourKey}`, priority: 1 })) maintenance++

  if (sources || maintenance) await audit('scheduler.tick', '', `${sources} sources, ${maintenance} maintenance`)
  return { sources, maintenance }
}
