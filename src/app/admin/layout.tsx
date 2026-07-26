import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/session'
import { getStats } from '@/lib/queries/stats'
import { AdminNav } from './nav'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: { default: 'Admin', template: '%s · Portico admin' },
  robots: { index: false, follow: false },
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser()
  if (!user) redirect('/login?next=/admin')
  if (user.role !== 'admin') {
    return (
      <div className="shell py-24 text-center">
        <h1 className="font-display text-display-sm">Not for you</h1>
        <p className="mt-4 text-muted">
          This part of Portico is for editors.{' '}
          <Link href="/" className="text-ink">
            Go back to the catalogue
          </Link>
          .
        </p>
      </div>
    )
  }

  const stats = await getStats()

  return (
    <div className="shell py-8">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4 border-b border-line pb-6">
        <div>
          <p className="eyebrow mb-2">Editor console</p>
          <h1 className="font-display text-3xl tracking-tight">Portico admin</h1>
        </div>
        <p className="font-mono text-2xs uppercase tracking-[0.12em] text-faint">
          signed in as @{user.username}
        </p>
      </header>

      <div className="grid gap-8 lg:grid-cols-[13rem_1fr] lg:gap-10">
        <AdminNav pending={stats.pending} reports={stats.openReports} failed={stats.jobsFailed} />
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  )
}
