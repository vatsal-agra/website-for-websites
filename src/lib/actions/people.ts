'use server'

import crypto from 'node:crypto'
import { revalidatePath } from 'next/cache'
import { audit, get, run } from '@/lib/db'
import { hashPassword } from '@/lib/auth'
import { requireAdmin } from '@/lib/session'
import { invalidateStats } from '@/lib/queries/stats'

export interface PeopleState {
  error?: string
  ok?: string
  /** shown once, never stored in readable form */
  password?: string
  userId?: number
}

/**
 * Editor tools for the people who have accounts.
 *
 * web-amble sends no email — no provider, no API key, nothing to configure —
 * so there is no automated password reset, and somebody locked out has no way
 * back on their own. That is a real consequence of the design, and the answer
 * is a human with a key: an editor issues a new password here and passes it on
 * however they already talk to the person.
 */

async function otherAdminsExist(excludeId: number): Promise<boolean> {
  const row = await get<{ n: number }>(`SELECT COUNT(*)::int AS n FROM users WHERE role = 'admin' AND id <> ?`, [
    excludeId,
  ])
  return Boolean(row && row.n > 0)
}

function refresh() {
  revalidatePath('/admin/people')
  revalidatePath('/admin')
}

export async function setRoleAction(_prev: PeopleState, formData: FormData): Promise<PeopleState> {
  const admin = await requireAdmin()
  const id = Number(formData.get('id'))
  const role = String(formData.get('role') ?? '') === 'admin' ? 'admin' : 'user'

  if (id === admin.id && role !== 'admin' && !(await otherAdminsExist(admin.id))) {
    return { error: 'You are the only editor. Promote somebody else before stepping down.' }
  }

  const target = await get<{ username: string }>('SELECT username FROM users WHERE id = ?', [id])
  if (!target) return { error: 'No such account.' }

  await run('UPDATE users SET role = ? WHERE id = ?', [role, id])
  audit('user.role', `@${target.username}`, role, `@${admin.username}`)
  refresh()
  return { ok: `@${target.username} is now ${role === 'admin' ? 'an editor' : 'a reader'}.` }
}

export async function issuePasswordAction(_prev: PeopleState, formData: FormData): Promise<PeopleState> {
  const admin = await requireAdmin()
  const id = Number(formData.get('id'))

  const target = await get<{ username: string }>('SELECT username FROM users WHERE id = ?', [id])
  if (!target) return { error: 'No such account.' }

  // Three short words are easier to read down a phone line than a hex string,
  // and the entropy is fine for something that exists only until it is changed.
  const password = Array.from({ length: 3 }, () => crypto.randomBytes(4).toString('base64url')).join('-')

  await run('UPDATE users SET password_hash = ? WHERE id = ?', [hashPassword(password), id])
  // whoever knew the old one no longer gets to stay signed in
  await run('DELETE FROM sessions WHERE user_id = ?', [id])

  audit('user.password-issued', `@${target.username}`, '', `@${admin.username}`)
  refresh()
  return {
    ok: `New password for @${target.username}. It is shown once — copy it now.`,
    password,
    userId: id,
  }
}

export async function deleteUserAction(_prev: PeopleState, formData: FormData): Promise<PeopleState> {
  const admin = await requireAdmin()
  const id = Number(formData.get('id'))

  const target = await get<{ username: string; role: string }>('SELECT username, role FROM users WHERE id = ?', [id])
  if (!target) return { error: 'No such account.' }
  if (target.role === 'admin' && !(await otherAdminsExist(id))) {
    return { error: 'That is the only editor. Promote somebody else first.' }
  }

  // Same bookkeeping as deleting your own account: the denormalised vote
  // counter has to be walked back, or the catalogue claims votes that are gone.
  await run(
    `UPDATE sites SET votes = GREATEST(votes - 1, 0)
     WHERE id IN (SELECT site_id FROM votes WHERE user_id = ?)`,
    [id],
  )
  await run('DELETE FROM users WHERE id = ?', [id])

  audit('user.deleted', `@${target.username}`, '', `@${admin.username}`)
  invalidateStats()
  refresh()
  return { ok: `@${target.username} has been deleted.` }
}
