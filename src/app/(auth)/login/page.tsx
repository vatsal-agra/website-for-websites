import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/session'
import { loginAction } from '@/lib/actions/auth'
import { AuthForm } from '../auth-form'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Sign in',
  description: 'Sign in to save sites, upvote and build your own collections.',
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>
}) {
  const user = await getCurrentUser()
  const { next } = await searchParams
  if (user) redirect(next && next.startsWith('/') ? next : '/')

  return (
    <AuthForm
      mode="login"
      action={loginAction}
      next={next}
      title="Welcome back"
      subtitle="Sign in to save sites, upvote what you like and build collections."
      footer={
        <p className="text-sm text-muted">
          No account yet?{' '}
          <Link href={`/signup${next ? `?next=${encodeURIComponent(next)}` : ''}`} className="text-ink">
            Create one
          </Link>
          .
        </p>
      }
    />
  )
}
