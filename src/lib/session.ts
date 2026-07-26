import 'server-only'
import { cookies, headers } from 'next/headers'
import { SESSION_COOKIE, SESSION_DAYS, createSession, destroySession, resolveSession } from './auth'
import type { PublicUser } from './types'

export async function getCurrentUser(): Promise<PublicUser | null> {
  const store = await cookies()
  const token = store.get(SESSION_COOKIE)?.value
  if (!token) return null
  try {
    return await resolveSession(token)
  } catch {
    // a cold or unreachable database must not hard-fail every page render
    return null
  }
}

export async function requireUser(): Promise<PublicUser> {
  const user = await getCurrentUser()
  if (!user) throw new Error('UNAUTHENTICATED')
  return user
}

export async function requireAdmin(): Promise<PublicUser> {
  const user = await getCurrentUser()
  if (!user || user.role !== 'admin') throw new Error('FORBIDDEN')
  return user
}

export async function startSession(userId: number) {
  const { token, expiresAt } = await createSession(userId)
  const store = await cookies()
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    expires: expiresAt,
    maxAge: SESSION_DAYS * 86400,
  })
}

export async function endSession() {
  const store = await cookies()
  const token = store.get(SESSION_COOKIE)?.value
  await destroySession(token)
  store.delete(SESSION_COOKIE)
}

/** Coarse client identity for rate limiting. Never stored beyond the limiter. */
export async function clientKey(): Promise<string> {
  const h = await headers()
  const forwarded = h.get('x-forwarded-for')?.split(',')[0]?.trim()
  const ip = forwarded || h.get('x-real-ip') || 'local'
  return ip.slice(0, 64)
}
