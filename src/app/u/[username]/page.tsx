import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Layers } from 'lucide-react'
import { get } from '@/lib/db'
import { toPublicUser } from '@/lib/auth'
import { getCurrentUser } from '@/lib/session'
import { collectionPreviews, collectionsForUser } from '@/lib/queries/collections'
import { submissionsByUser } from '@/lib/queries/sites'
import { formatDate, pluralize } from '@/lib/utils'
import { CollectionCard } from '@/components/cards'
import { SiteCard } from '@/components/site/site-card'
import { Badge, EmptyState, SectionHeader } from '@/components/ui/primitives'
import { NewCollectionForm } from './new-collection'

export const dynamic = 'force-dynamic'

async function findUser(username: string) {
  const row = await get('SELECT * FROM users WHERE username = ?', [username.toLowerCase()])
  return row ? toPublicUser(row) : null
}

export async function generateMetadata({ params }: { params: Promise<{ username: string }> }): Promise<Metadata> {
  const { username } = await params
  const profile = await findUser(username)
  if (!profile) return { title: 'Profile not found' }
  return {
    title: `@${profile.username}`,
    description: `Collections and submissions by @${profile.username} on web-amble.`,
  }
}

export default async function ProfilePage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params
  const profile = await findUser(username)
  if (!profile) notFound()

  const viewer = await getCurrentUser()
  const isSelf = viewer?.id === profile.id

  const allCollections = await collectionsForUser(profile.id)
  const collections = isSelf ? allCollections : allCollections.filter((c) => c.is_public)
  const submissions = isSelf || viewer?.role === 'admin' ? await submissionsByUser(profile.id, 24) : []

  const previews = await collectionPreviews(collections.map((c) => c.id), 4)
  const collectionCards = collections.map((collection) => ({
    collection,
    preview: previews.get(collection.id) ?? [],
  }))

  return (
    <div className="shell py-10 sm:py-14">
      <header className="mb-12 flex flex-wrap items-start justify-between gap-6 border-b border-line pb-8">
        <div className="flex items-start gap-4">
          <span className="flex h-16 w-16 items-center justify-center rounded-2xl border border-line bg-surface font-display text-2xl uppercase text-muted">
            {profile.username.slice(0, 2)}
          </span>
          <div>
            <h1 className="font-display text-3xl leading-tight tracking-tight">
              {profile.display_name || profile.username}
            </h1>
            <p className="mt-0.5 font-mono text-sm text-faint">@{profile.username}</p>
            <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted">
              <span>Joined {formatDate(profile.created_at)}</span>
              {profile.role === 'admin' && <Badge tone="accent">editor</Badge>}
            </p>
          </div>
        </div>

        <dl className="flex gap-8">
          <div>
            <dt className="eyebrow">Collections</dt>
            <dd className="mt-1 font-display text-2xl">{collections.length}</dd>
          </div>
          {isSelf && (
            <div>
              <dt className="eyebrow">Submissions</dt>
              <dd className="mt-1 font-display text-2xl">{submissions.length}</dd>
            </div>
          )}
        </dl>
      </header>

      {isSelf && (
        <section className="mb-14">
          <SectionHeader eyebrow="Curate" title="Start a collection" />
          <NewCollectionForm />
        </section>
      )}

      <section className="mb-14">
        <SectionHeader
          eyebrow={isSelf ? 'Yours' : 'Published'}
          title="Collections"
          description={isSelf ? 'Private collections are only visible to you.' : undefined}
        />
        {collections.length === 0 ? (
          <EmptyState
            icon={<Layers className="h-8 w-8" />}
            title={isSelf ? 'No collections yet' : 'Nothing published yet'}
            description={
              isSelf
                ? 'A collection is just a group of sites with a title and a point of view. Make one above.'
                : 'This reader has not published a collection.'
            }
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {collectionCards.map(({ collection, preview }) => (
              <div key={collection.id} className="relative">
                <CollectionCard collection={collection} preview={preview} />
                {!collection.is_public && (
                  <span className="absolute right-3 top-3 z-10 rounded-md border border-white/20 bg-black/55 px-1.5 py-0.5 font-mono text-2xs uppercase text-white/85 backdrop-blur">
                    private
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {isSelf && submissions.length > 0 && (
        <section>
          <SectionHeader
            eyebrow="Your submissions"
            title="What you sent us"
            description="Pending entries are waiting for an editor. Rejected ones show the reason."
          />
          <div className="space-y-1">
            {submissions.map((site) => (
              <div key={site.id} className="relative">
                <SiteCard site={site} variant="row" signedIn />
                <span className="pointer-events-none absolute right-3 top-3 z-10">
                  {site.status === 'approved' ? (
                    <Badge tone="positive">live</Badge>
                  ) : site.status === 'pending' ? (
                    <Badge tone="warning">in review</Badge>
                  ) : (
                    <Badge tone="danger">{site.status}</Badge>
                  )}
                </span>
                {site.reject_reason && (
                  <p className="px-3 pb-2 text-xs text-danger">Reason: {site.reject_reason}</p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {!isSelf && (
        <p className="text-sm text-muted">
          <Link href="/collections" className="text-ink">
            Browse all collections →
          </Link>
        </p>
      )}
    </div>
  )
}
