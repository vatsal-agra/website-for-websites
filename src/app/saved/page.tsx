import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { Bookmark } from 'lucide-react'
import { getCurrentUser } from '@/lib/session'
import { savedSites } from '@/lib/queries/sites'
import { SiteGrid } from '@/components/site/site-card'
import { ButtonLink, EmptyState } from '@/components/ui/primitives'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Saved sites',
  robots: { index: false, follow: false },
}

export default async function SavedPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login?next=/saved')

  const sites = await savedSites(user.id)

  return (
    <div className="shell py-10 sm:py-14">
      <header className="mb-8">
        <p className="eyebrow mb-3">Your shelf</p>
        <h1 className="font-display text-display-sm">Saved sites</h1>
        <p className="mt-3 max-w-prose text-base leading-relaxed text-muted">
          {sites.length === 0
            ? 'Nothing saved yet.'
            : `${sites.length} ${sites.length === 1 ? 'site' : 'sites'}, newest first. Only you can see this page.`}
        </p>
      </header>

      {sites.length === 0 ? (
        <EmptyState
          icon={<Bookmark className="h-8 w-8" />}
          title="Your shelf is empty"
          description="Hit the bookmark on any card and it lands here. It is the fastest way to build a reading list you will actually come back to."
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <ButtonLink href="/browse" variant="primary">
                Browse the catalogue
              </ButtonLink>
              <ButtonLink href="/shuffle" variant="secondary">
                Shuffle
              </ButtonLink>
            </div>
          }
        />
      ) : (
        <SiteGrid sites={sites} signedIn />
      )}
    </div>
  )
}
