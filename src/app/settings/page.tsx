import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/session'
import { formatDate } from '@/lib/utils'
import { Badge } from '@/components/ui/primitives'
import { DeleteAccountForm, PasswordForm, ProfileForm } from './forms'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Settings',
  robots: { index: false, follow: false },
}

export default async function SettingsPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login?next=/settings')

  return (
    <div className="shell max-w-2xl py-10 sm:py-14">
      <header className="mb-10">
        <p className="eyebrow mb-3">Your account</p>
        <h1 className="font-display text-display-sm">Settings</h1>
        <p className="mt-3 flex flex-wrap items-center gap-2 text-sm text-muted">
          <span className="font-mono">@{user.username}</span>
          <span aria-hidden="true">·</span>
          <span>joined {formatDate(user.created_at)}</span>
          {user.role === 'admin' && <Badge tone="accent">editor</Badge>}
        </p>
        <p className="mt-3 text-sm text-muted">
          Your public page is{' '}
          <Link href={`/u/${user.username}`}>
            /u/{user.username}
          </Link>
          .
        </p>
      </header>

      <div className="space-y-10">
        <Section
          title="Profile"
          description="The only two things about you that anybody else sees. Usernames are permanent — everything on the site points at yours."
        >
          <ProfileForm user={user} />
        </Section>

        <Section title="Password" description="Changing it signs out every other device.">
          <PasswordForm />
        </Section>

        <Section title="Delete account" tone="danger">
          <DeleteAccountForm user={user} />
        </Section>
      </div>
    </div>
  )
}

function Section({
  title,
  description,
  tone,
  children,
}: {
  title: string
  description?: string
  tone?: 'danger'
  children: React.ReactNode
}) {
  return (
    <section
      className={`rounded-2xl border bg-surface p-6 ${
        tone === 'danger' ? 'border-danger/25' : 'border-line'
      }`}
    >
      <h2 className={`font-display text-xl ${tone === 'danger' ? 'text-danger' : ''}`}>{title}</h2>
      {description && <p className="mb-6 mt-1.5 text-sm leading-relaxed text-muted">{description}</p>}
      {!description && <div className="mb-6" />}
      {children}
    </section>
  )
}
