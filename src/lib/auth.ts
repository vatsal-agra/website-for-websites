import crypto from 'node:crypto'
import { get, run, nowIso } from './db'
import type { PublicUser, UserRole } from './types'

const SCRYPT_N = 16384
const SCRYPT_KEYLEN = 64
export const SESSION_COOKIE = 'portico_session'
export const SESSION_DAYS = 30

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex')
  const derived = crypto.scryptSync(password, salt, SCRYPT_KEYLEN, { N: SCRYPT_N }).toString('hex')
  return `scrypt$${SCRYPT_N}$${salt}$${derived}`
}

export function verifyPassword(password: string, stored: string): boolean {
  try {
    const [scheme, nRaw, salt, hash] = stored.split('$')
    if (scheme !== 'scrypt' || !salt || !hash) return false
    const N = Number(nRaw) || SCRYPT_N
    const derived = crypto.scryptSync(password, salt, hash.length / 2, { N })
    const expected = Buffer.from(hash, 'hex')
    return derived.length === expected.length && crypto.timingSafeEqual(derived, expected)
  } catch {
    return false
  }
}

export function toPublicUser(row: any): PublicUser {
  return {
    id: Number(row.id),
    username: row.username,
    display_name: row.display_name || row.username,
    bio: row.bio ?? '',
    role: (row.role as UserRole) ?? 'user',
    created_at: row.created_at,
  }
}

export const USERNAME_RE = /^[a-z0-9](?:[a-z0-9_-]{1,22}[a-z0-9])$/

const RESERVED_USERNAMES = new Set([
  'admin', 'root', 'system', 'portico', 'api', 'about', 'submit', 'login', 'logout',
  'signup', 'browse', 'search', 'site', 'sites', 'category', 'tag', 'collections',
  'shuffle', 'saved', 'settings', 'u', 'go', 'feed', 'sitemap', 'robots', 'guidelines',
])

export function validateUsername(username: string): string | null {
  const u = username.trim().toLowerCase()
  if (!USERNAME_RE.test(u)) {
    return 'Usernames are 3–24 characters: lowercase letters, numbers, dashes and underscores.'
  }
  if (RESERVED_USERNAMES.has(u)) return 'That username is reserved.'
  return null
}

export function validatePassword(password: string): string | null {
  if (password.length < 8) return 'Passwords need at least 8 characters.'
  if (password.length > 200) return 'That password is too long.'
  return null
}

// ---------------------------------------------------------------- accounts --

export async function createUser(input: {
  username: string
  password: string
  email?: string | null
  displayName?: string
  role?: UserRole
}): Promise<PublicUser> {
  const username = input.username.trim().toLowerCase()
  const row = await get(
    `INSERT INTO users (username, email, password_hash, display_name, role)
     VALUES (?, ?, ?, ?, ?)
     RETURNING *`,
    [
      username,
      input.email?.trim().toLowerCase() || null,
      hashPassword(input.password),
      (input.displayName || input.username).trim().slice(0, 60),
      input.role ?? 'user',
    ],
  )
  return toPublicUser(row)
}

export async function findUserByUsername(username: string) {
  return get<PublicUser & { password_hash: string }>('SELECT * FROM users WHERE username = ?', [
    username.trim().toLowerCase(),
  ])
}

export async function findUserById(id: number) {
  return get<PublicUser & { password_hash: string }>('SELECT * FROM users WHERE id = ?', [id])
}

export async function authenticate(username: string, password: string): Promise<PublicUser | null> {
  const user = await findUserByUsername(username)
  if (!user) {
    // constant-ish time: still run a hash so timing does not leak existence
    verifyPassword(password, `scrypt$${SCRYPT_N}$${'0'.repeat(32)}$${'0'.repeat(128)}`)
    return null
  }
  if (!verifyPassword(password, user.password_hash)) return null
  return toPublicUser(user)
}

// ---------------------------------------------------------------- sessions --

export async function createSession(userId: number): Promise<{ token: string; expiresAt: Date }> {
  const token = crypto.randomBytes(32).toString('base64url')
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86400_000)
  await run('INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)', [
    token,
    userId,
    expiresAt.toISOString().replace('T', ' ').slice(0, 19),
  ])
  return { token, expiresAt }
}

export async function resolveSession(token: string | undefined | null): Promise<PublicUser | null> {
  if (!token) return null
  const row = await get(
    `SELECT u.* FROM sessions s
     JOIN users u ON u.id = s.user_id
     WHERE s.token = ? AND s.expires_at > ?`,
    [token, nowIso()],
  )
  return row ? toPublicUser(row) : null
}

export async function destroySession(token: string | undefined | null): Promise<void> {
  if (!token) return
  await run('DELETE FROM sessions WHERE token = ?', [token])
}

export async function pruneSessions(): Promise<number> {
  const res = await run('DELETE FROM sessions WHERE expires_at <= ?', [nowIso()])
  return res.rowsAffected
}
