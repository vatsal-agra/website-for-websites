import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/session'
import { signupAction } from '@/lib/actions/auth'
import { AuthForm } from '../auth-form'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Create an account',
  description: 'Create a web-amble account to save sites, upvote and curate your own collections.',
}

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>
}) {
  const user = await getCurrentUser()
  const { next } = await searchParams
  if (user) redirect(next && next.startsWith('/') ? next : '/')

  return (
    <AuthForm
      mode="signup"
      action={signupAction}
      next={next}
      title="Join web-amble"
      subtitle="Save what you find, upvote what deserves it, and publish collections of your own."
      footer={
        <p className="text-sm text-muted">
          Already have an account?{' '}
          <Link href={`/login${next ? `?next=${encodeURIComponent(next)}` : ''}`} className="text-ink">
            Sign in
          </Link>
          .
        </p>
      }
    />
  )
}
