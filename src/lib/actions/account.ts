'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { audit, get, run } from '@/lib/db'
import { hashPassword, validatePassword, verifyPassword } from '@/lib/auth'
import { clientKey, endSession, getCurrentUser } from '@/lib/session'
import { LIMITS, rateLimit } from '@/lib/ratelimit'
import { invalidateStats } from '@/lib/queries/stats'

export interface AccountState {
  error?: string
  ok?: string
  field?: 'displayName' | 'bio' | 'current' | 'password' | 'confirm'
}

/**
 * An account you can create and never change is not really an account. These
 * three actions are the whole of it: what your profile says, what your password
 * is, and the ability to stop having one.
 */

export async function updateProfileAction(_prev: AccountState, formData: FormData): Promise<AccountState> {
  const user = await getCurrentUser()
  if (!user) return { error: 'You are not signed in.' }

  const displayName = String(formData.get('displayName') ?? '').trim().slice(0, 60)
  const bio = String(formData.get('bio') ?? '').trim().slice(0, 280)

  // A display name that is only whitespace or punctuation renders as an empty
  // heading on the profile page; falling back to the username is kinder.
  if (displayName && !/\p{L}|\p{N}/u.test(displayName)) {
    return { error: 'A display name needs at least one letter or number.', field: 'displayName' }
  }

  await run('UPDATE users SET display_name = ?, bio = ? WHERE id = ?', [displayName, bio, user.id])
  audit('account.profile', `@${user.username}`)
  revalidatePath(`/u/${user.username}`)
  revalidatePath('/settings')
  return { ok: 'Profile updated.' }
}

export async function changePasswordAction(_prev: AccountState, formData: FormData): Promise<AccountState> {
  const user = await getCurrentUser()
  if (!user) return { error: 'You are not signed in.' }

  // Rate limited on the same budget as signing in: this endpoint also tells you
  // whether a password is correct.
  const limit = await rateLimit('password', await clientKey(), LIMITS.login.limit, LIMITS.login.window)
  if (!limit.ok) return { error: 'Too many attempts from this address. Try again in a few minutes.' }

  const current = String(formData.get('current') ?? '')
  const next = String(formData.get('password') ?? '')
  const confirm = String(formData.get('confirm') ?? '')

  const row = await get<{ password_hash: string }>('SELECT password_hash FROM users WHERE id = ?', [user.id])
  if (!row || !verifyPassword(current, row.password_hash)) {
    return { error: 'That is not your current password.', field: 'current' }
  }

  const invalid = validatePassword(next)
  if (invalid) return { error: invalid, field: 'password' }
  if (next !== confirm) return { error: 'The two new passwords do not match.', field: 'confirm' }
  if (next === current) return { error: 'That is already your password.', field: 'password' }

  await run('UPDATE users SET password_hash = ? WHERE id = ?', [hashPassword(next), user.id])

  // Every other session belonged to whoever knew the old password. This one
  // stays, so changing a password does not sign you out of the tab you are in.
  const { cookies } = await import('next/headers')
  const { SESSION_COOKIE } = await import('@/lib/auth')
  const token = (await cookies()).get(SESSION_COOKIE)?.value ?? ''
  await run('DELETE FROM sessions WHERE user_id = ? AND token <> ?', [user.id, token])

  audit('account.password', `@${user.username}`)
  return { ok: 'Password changed. Any other devices have been signed out.' }
}

export async function deleteAccountAction(_prev: AccountState, formData: FormData): Promise<AccountState> {
  const user = await getCurrentUser()
  if (!user) return { error: 'You are not signed in.' }

  const confirm = String(formData.get('confirm') ?? '').trim().toLowerCase()
  if (confirm !== user.username) {
    return { error: `Type ${user.username} exactly to confirm.`, field: 'confirm' }
  }

  const password = String(formData.get('password') ?? '')
  const row = await get<{ password_hash: string }>('SELECT password_hash FROM users WHERE id = ?', [user.id])
  if (!row || !verifyPassword(password, row.password_hash)) {
    return { error: 'That password is not right.', field: 'current' }
  }

  if (user.role === 'admin') {
    const others = await get<{ n: number }>(`SELECT COUNT(*)::int AS n FROM users WHERE role = 'admin' AND id <> ?`, [
      user.id,
    ])
    if (!others || others.n === 0) {
      return { error: 'You are the only editor. Promote somebody else first, or the catalogue loses its moderator.' }
    }
  }

  // Sessions, votes, saves and collections all cascade. `sites.submitted_by`
  // is set to null instead, because a submission that was accepted belongs to
  // the catalogue now — the entry stays, the attribution goes.
  //
  // The vote counter on each site is denormalised, so it has to be walked back
  // by hand. Leaving it would make the catalogue claim votes that no longer
  // exist, which is exactly the kind of number this site does not invent.
  await run(
    `UPDATE sites SET votes = GREATEST(votes - 1, 0)
     WHERE id IN (SELECT site_id FROM votes WHERE user_id = ?)`,
    [user.id],
  )
  await run('DELETE FROM users WHERE id = ?', [user.id])

  audit('account.deleted', `@${user.username}`)
  invalidateStats()
  await endSession()
  redirect('/goodbye')
}
