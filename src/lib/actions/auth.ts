'use server'

import { redirect } from 'next/navigation'
import { audit } from '@/lib/db'
import {
  authenticate,
  createUser,
  findUserByUsername,
  validatePassword,
  validateUsername,
} from '@/lib/auth'
import { clientKey, endSession, startSession } from '@/lib/session'
import { LIMITS, rateLimit } from '@/lib/ratelimit'

export interface AuthFormState {
  error?: string
  field?: 'username' | 'password' | 'email'
}

function safeNext(raw: FormDataEntryValue | null): string {
  const value = typeof raw === 'string' ? raw : ''
  // only allow same-origin paths
  if (!value.startsWith('/') || value.startsWith('//')) return '/'
  return value
}

export async function loginAction(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const ip = await clientKey()
  const limit = await rateLimit('login', ip, LIMITS.login.limit, LIMITS.login.window)
  if (!limit.ok) {
    return { error: 'Too many attempts from this address. Try again in a few minutes.' }
  }

  const username = String(formData.get('username') ?? '').trim()
  const password = String(formData.get('password') ?? '')
  if (!username || !password) return { error: 'Enter your username and password.' }

  const user = await authenticate(username, password)
  if (!user) return { error: 'That username and password do not match.', field: 'password' }

  await startSession(user.id)
  audit('auth.login', `@${user.username}`)
  redirect(safeNext(formData.get('next')))
}

export async function signupAction(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const ip = await clientKey()
  const limit = await rateLimit('signup', ip, LIMITS.signup.limit, LIMITS.signup.window)
  if (!limit.ok) {
    return { error: 'Too many accounts created from this address today.' }
  }

  const username = String(formData.get('username') ?? '').trim().toLowerCase()
  const password = String(formData.get('password') ?? '')
  const email = String(formData.get('email') ?? '').trim()

  const usernameError = validateUsername(username)
  if (usernameError) return { error: usernameError, field: 'username' }

  const passwordError = validatePassword(password)
  if (passwordError) return { error: passwordError, field: 'password' }

  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return { error: 'That email address does not look right.', field: 'email' }
  }

  if (await findUserByUsername(username)) {
    return { error: 'That username is taken.', field: 'username' }
  }

  try {
    const user = await createUser({ username, password, email: email || null })
    await startSession(user.id)
    audit('auth.signup', `@${user.username}`)
  } catch {
    return { error: 'Could not create that account. Try a different username or email.' }
  }

  redirect(safeNext(formData.get('next')))
}

export async function logoutAction() {
  await endSession()
  redirect('/')
}
