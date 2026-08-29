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
        <div className="space-y-3">
          <p className="text-sm text-muted">
            No account yet?{' '}
            <Link href={`/signup${next ? `?next=${encodeURIComponent(next)}` : ''}`} className="text-ink">
              Create one
            </Link>
            .
          </p>
          <p className="text-xs leading-relaxed text-faint">
            Forgotten your password? web-amble sends no email — there is no address on file to send a reset link
            to — so an editor has to issue you a new one. Say so on{' '}
            <Link href="/about" className="text-muted">
              the about page
            </Link>{' '}
            and somebody will sort it out.
          </p>
        </div>
      }
    />
  )
}
