import { Suspense } from 'react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Layers } from 'lucide-react'
import { get } from '@/lib/db'
import { toPublicUser } from '@/lib/auth'
import { getCurrentUser } from '@/lib/session'
import { collectionPreviews, collectionsForUser } from '@/lib/queries/collections'
import { submissionsByUser } from '@/lib/queries/sites'
import { formatDate } from '@/lib/utils'
import { CollectionCard } from '@/components/cards'
import { SiteCard } from '@/components/site/site-card'
import { Badge, EmptyState, SectionHeader } from '@/components/ui/primitives'
import { CountSkeleton, GridSkeleton } from '@/components/skeletons'
import { NewCollectionForm } from './new-collection'

export const dynamic = 'force-dynamic'

type Collections = Awaited<ReturnType<typeof collectionsForUser>>
type Submissions = Awaited<ReturnType<typeof submissionsByUser>>

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

/**
 * A profile is four independent lookups. Fetched in sequence they were five
 * round trips deep and this was the slowest page on the site; started together
 * and streamed, the identity block is on screen while the shelves are still
 * arriving. The counters in the header share the same promises as the sections
 * they count, so nothing is queried twice.
 */
export default async function ProfilePage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params
  const [profile, viewer] = await Promise.all([findUser(username), getCurrentUser()])
  if (!profile) notFound()

  const isSelf = viewer?.id === profile.id
  const canSeeSubmissions = isSelf || viewer?.role === 'admin'

  const collections = collectionsForUser(profile.id).then((all) =>
    isSelf ? all : all.filter((c) => c.is_public),
  )
  collections.catch(() => {})

  const submissions = canSeeSubmissions ? submissionsByUser(profile.id, 24) : null
  submissions?.catch(() => {})

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
            <dd className="mt-1 font-display text-2xl">
              <Suspense fallback={<CountSkeleton width="w-8" />}>
                <Count of={collections} />
              </Suspense>
            </dd>
          </div>
          {submissions && (
            <div>
              <dt className="eyebrow">Submissions</dt>
              <dd className="mt-1 font-display text-2xl">
                <Suspense fallback={<CountSkeleton width="w-8" />}>
                  <Count of={submissions} />
                </Suspense>
              </dd>
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
        <Suspense fallback={<GridSkeleton count={3} />}>
          <CollectionShelf of={collections} isSelf={isSelf} />
        </Suspense>
      </section>

      {isSelf && submissions && (
        <Suspense fallback={null}>
          <SubmissionShelf of={submissions} />
        </Suspense>
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

async function Count({ of }: { of: Promise<unknown[]> }) {
  return <>{(await of).length}</>
}

async function CollectionShelf({ of, isSelf }: { of: Promise<Collections>; isSelf: boolean }) {
  const collections = await of
  if (collections.length === 0) {
    return (
      <EmptyState
        icon={<Layers className="h-8 w-8" />}
        title={isSelf ? 'No collections yet' : 'Nothing published yet'}
        description={
          isSelf
            ? 'A collection is just a group of sites with a title and a point of view. Make one above.'
            : 'This reader has not published a collection.'
        }
      />
    )
  }

  const previews = await collectionPreviews(
    collections.map((c) => c.id),
    4,
  )

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {collections.map((collection) => (
        <div key={collection.id} className="relative">
          <CollectionCard collection={collection} preview={previews.get(collection.id) ?? []} />
          {!collection.is_public && (
            <span className="absolute right-3 top-3 z-10 rounded-md border border-white/20 bg-black/55 px-1.5 py-0.5 font-mono text-2xs uppercase text-white/85 backdrop-blur">
              private
            </span>
          )}
        </div>
      ))}
    </div>
  )
}

async function SubmissionShelf({ of }: { of: Promise<Submissions> }) {
  const submissions = await of
  if (submissions.length === 0) return null

  return (
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
            {site.reject_reason && <p className="px-3 pb-2 text-xs text-danger">Reason: {site.reject_reason}</p>}
          </div>
        ))}
      </div>
    </section>
  )
}
