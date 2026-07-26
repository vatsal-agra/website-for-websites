'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { audit, get, run } from '@/lib/db'
import { invalidateBlocklist } from '@/lib/safety'
import { requireAdmin } from '@/lib/session'
import { enqueue, retryJob, clearFinishedJobs } from '@/lib/jobs'
import { registerAllHandlers, scheduleDueWork } from '@/lib/handlers'
import { drain } from '@/lib/jobs'
import { createSource, deleteSource, setSourceEnabled } from '@/lib/sources'
import { drainCandidates } from '@/lib/ingest'
import {
  deleteSite,
  markFeatured,
  setSiteTags,
  setStatus,
  updateSite,
  uniqueSlug,
} from '@/lib/queries/sites'
import { createCollection } from '@/lib/queries/collections'
import { hueFrom } from '@/lib/utils'

export interface AdminState {
  error?: string
  ok?: string
}

function refreshAll() {
  revalidatePath('/admin')
  revalidatePath('/admin/queue')
  revalidatePath('/admin/sites')
  revalidatePath('/browse')
  revalidatePath('/')
}

// ------------------------------------------------------------- moderation --

export async function approveSiteAction(formData: FormData) {
  const admin = await requireAdmin()
  const id = Number(formData.get('id'))
  await setStatus(id, 'approved')
  await enqueue('site.thumbnail', { siteId: id }, { dedupeKey: `thumb:${id}`, priority: 3, rerunFinished: true })
  audit('site.approved', String(id), '', `@${admin.username}`)
  refreshAll()
}

export async function rejectSiteAction(formData: FormData) {
  const admin = await requireAdmin()
  const id = Number(formData.get('id'))
  const reason = String(formData.get('reason') ?? 'does not meet the listing guidelines').slice(0, 200)
  await setStatus(id, 'rejected', reason)
  audit('site.rejected', String(id), reason, `@${admin.username}`)
  refreshAll()
}

export async function archiveSiteAction(formData: FormData) {
  const admin = await requireAdmin()
  const id = Number(formData.get('id'))
  await setStatus(id, 'archived', String(formData.get('reason') ?? ''))
  audit('site.archived', String(id), '', `@${admin.username}`)
  refreshAll()
}

export async function deleteSiteAction(formData: FormData) {
  const admin = await requireAdmin()
  const id = Number(formData.get('id'))
  const site = (await get('SELECT slug, domain FROM sites WHERE id = ?', [id])) as
    | { slug: string; domain: string }
    | undefined

  if (formData.get('blocklist') === 'on' && site) {
    await run('INSERT OR IGNORE INTO blocklist (pattern, reason) VALUES (?, ?)', [
      site.domain,
      `removed by @${admin.username}`,
    ])
    invalidateBlocklist()
  }

  await deleteSite(id)
  audit('site.deleted', site?.slug ?? String(id), '', `@${admin.username}`)
  refreshAll()
  redirect('/admin/sites')
}

export async function featureSiteAction(formData: FormData) {
  const admin = await requireAdmin()
  const id = Number(formData.get('id'))
  await markFeatured(id)
  audit('site.featured', String(id), '', `@${admin.username}`)
  refreshAll()
}

export async function recheckSiteAction(formData: FormData) {
  await requireAdmin()
  const id = Number(formData.get('id'))
  await enqueue('site.recheck', { siteId: id }, { dedupeKey: `recheck:${id}`, priority: 5, rerunFinished: true })
  registerAllHandlers()
  await drain(2)
  refreshAll()
}

export async function regenerateThumbAction(formData: FormData) {
  await requireAdmin()
  const id = Number(formData.get('id'))
  await enqueue('site.thumbnail', { siteId: id }, { dedupeKey: `thumb:${id}`, priority: 5, rerunFinished: true })
  registerAllHandlers()
  await drain(2)
  refreshAll()
}

// --------------------------------------------------------------- editing --

export async function editSiteAction(_prev: AdminState, formData: FormData): Promise<AdminState> {
  try {
    const admin = await requireAdmin()
    const id = Number(formData.get('id'))
    const title = String(formData.get('title') ?? '').trim()
    if (title.length < 2) return { error: 'The title needs at least two characters.' }

    const categorySlug = String(formData.get('category') ?? '')
    const category = (await get('SELECT id FROM categories WHERE slug = ?', [categorySlug])) as
      | { id: number }
      | undefined

    const attributes: Record<string, boolean> = {}
    for (const key of formData.getAll('attrs')) attributes[String(key)] = true

    const patch: Record<string, unknown> = {
      title: title.slice(0, 90),
      tagline: String(formData.get('tagline') ?? '').slice(0, 160),
      description: String(formData.get('description') ?? '').slice(0, 800),
      editor_note: String(formData.get('editorNote') ?? '').slice(0, 600),
      category_id: category?.id ?? null,
      // an editor has now chosen the shelf, so re-crawls must not move it
      category_locked: 1,
      attributes: JSON.stringify(attributes),
    }

    const newSlug = String(formData.get('slug') ?? '').trim()
    if (newSlug) patch.slug = await uniqueSlug(newSlug, id)

    await updateSite(id, patch)

    const tags = String(formData.get('tags') ?? '')
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)
      .slice(0, 8)
    await setSiteTags(id, tags)

    audit('site.edited', String(id), title, `@${admin.username}`)
    refreshAll()
    return { ok: 'Saved.' }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Could not save.' }
  }
}

// ---------------------------------------------------------------- sources --

export async function runSourceAction(formData: FormData) {
  await requireAdmin()
  const id = Number(formData.get('id'))
  await enqueue('source.run', { sourceId: id }, { dedupeKey: `source:manual:${id}:${Date.now()}`, priority: 6 })
  registerAllHandlers()
  await drain(3)
  revalidatePath('/admin/sources')
  revalidatePath('/admin')
}

export async function toggleSourceAction(formData: FormData) {
  await requireAdmin()
  await setSourceEnabled(Number(formData.get('id')), formData.get('enabled') === '1')
  revalidatePath('/admin/sources')
}

export async function deleteSourceAction(formData: FormData) {
  await requireAdmin()
  await deleteSource(Number(formData.get('id')))
  revalidatePath('/admin/sources')
}

export async function createSourceAction(_prev: AdminState, formData: FormData): Promise<AdminState> {
  try {
    await requireAdmin()
    const kind = String(formData.get('kind') ?? 'rss') as 'rss' | 'hackernews' | 'linkgraph'
    const name = String(formData.get('name') ?? '').trim()
    const url = String(formData.get('url') ?? '').trim()
    if (name.length < 2) return { error: 'Give the source a name.' }
    if (kind === 'rss' && !url) return { error: 'An RSS source needs a feed URL.' }

    await createSource({
      kind,
      name,
      url,
      intervalMin: Math.max(15, Number(formData.get('interval') ?? 240) || 240),
      config: kind === 'rss' ? { deep: formData.get('deep') === 'on', weight: 1.1 } : {},
    })
    revalidatePath('/admin/sources')
    return { ok: `Added ${name}.` }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Could not add that source.' }
  }
}

// ------------------------------------------------------------------- jobs --

export async function runWorkerTickAction() {
  await requireAdmin()
  registerAllHandlers()
  await scheduleDueWork()
  const promoted = await drainCandidates(10)
  const { ran } = await drain(10)
  audit('admin.tick', '', `${ran} jobs, ${promoted} candidates promoted`)
  revalidatePath('/admin/jobs')
  revalidatePath('/admin')
}

export async function retryJobAction(formData: FormData) {
  await requireAdmin()
  await retryJob(Number(formData.get('id')))
  revalidatePath('/admin/jobs')
}

export async function clearJobsAction() {
  await requireAdmin()
  await clearFinishedJobs()
  revalidatePath('/admin/jobs')
}

// ---------------------------------------------------------------- reports --

export async function resolveReportAction(formData: FormData) {
  const admin = await requireAdmin()
  const id = Number(formData.get('id'))
  const status = String(formData.get('status') ?? 'resolved')
  await run('UPDATE reports SET status = ? WHERE id = ?', [status, id])
  audit('report.' + status, String(id), '', `@${admin.username}`)
  revalidatePath('/admin/reports')
  revalidatePath('/admin')
}

// ------------------------------------------------------------ collections --

export async function createEditorialCollectionAction(
  _prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  try {
    const admin = await requireAdmin()
    const title = String(formData.get('title') ?? '').trim()
    if (title.length < 3) return { error: 'Give the collection a name.' }
    const collection = await createCollection({
      title,
      subtitle: String(formData.get('subtitle') ?? '').trim(),
      description: String(formData.get('description') ?? '').trim(),
      curatorId: admin.id,
      isEditorial: true,
      isPublic: true,
      hue: hueFrom(title),
    })
    revalidatePath('/admin/collections')
    revalidatePath('/collections')
    return { ok: `Created “${collection.title}”.` }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Could not create that.' }
  }
}

// ------------------------------------------------------------- blocklist --

export async function addBlocklistAction(_prev: AdminState, formData: FormData): Promise<AdminState> {
  try {
    const admin = await requireAdmin()
    const pattern = String(formData.get('pattern') ?? '')
      .trim()
      .toLowerCase()
      .replace(/^https?:\/\//, '')
      .replace(/\/.*$/, '')
    if (!pattern.includes('.')) return { error: 'Enter a hostname, e.g. spam.example.' }

    await run('INSERT OR IGNORE INTO blocklist (pattern, reason) VALUES (?, ?)', [
      pattern,
      String(formData.get('reason') ?? '').slice(0, 200),
    ])
    invalidateBlocklist()
    audit('blocklist.added', pattern, '', `@${admin.username}`)
    revalidatePath('/admin/sources')
    return { ok: `Blocked ${pattern}.` }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Could not add that.' }
  }
}

export async function removeBlocklistAction(formData: FormData) {
  await requireAdmin()
  await run('DELETE FROM blocklist WHERE id = ?', [Number(formData.get('id'))])
  revalidatePath('/admin/sources')
}
