import type { Metadata } from 'next'
import { Layers } from 'lucide-react'
import { getCurrentUser } from '@/lib/session'
import { collectionPreviews, listCollections } from '@/lib/queries/collections'
import { CollectionCard } from '@/components/cards'
import { ButtonLink, EmptyState, SectionHeader } from '@/components/ui/primitives'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Collections',
  description:
    'Shelves assembled around an idea rather than a category — curated by the web-amble editors and by readers.',
}

export default async function CollectionsPage() {
  const user = await getCurrentUser()
  const all = await listCollections({ limit: 100 })
  const editorial = all.filter((c) => c.is_editorial)
  const community = all.filter((c) => !c.is_editorial)

  // one query for every card's preview, rather than one per card
  const previews = await collectionPreviews(all.map((c) => c.id), 4)
  const withPreview = (list: typeof all) =>
    list.map((collection) => ({ collection, preview: previews.get(collection.id) ?? [] }))

  const editorialCards = withPreview(editorial)
  const communityCards = withPreview(community)

  return (
    <div className="shell py-10 sm:py-14">
      <header className="mb-12 max-w-2xl">
        <p className="eyebrow mb-3">Curated by hand</p>
        <h1 className="font-display text-display-sm">Collections</h1>
        <p className="mt-3 text-base leading-relaxed text-muted">
          Categories answer “what is this?”. Collections answer “what is this <em>for</em>?” — a group of sites
          bound together by a mood, a use, or an argument.
        </p>
        {user && (
          <div className="mt-6">
            <ButtonLink href={`/u/${user.username}`} variant="secondary">
              <Layers className="h-4 w-4" />
              Make your own
            </ButtonLink>
          </div>
        )}
      </header>

      {editorial.length > 0 && (
        <section className="mb-16">
          <SectionHeader eyebrow="web-amble editorial" title="From the editors" />
          <div className="stack-fade grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {editorialCards.map(({ collection, preview }) => (
              <CollectionCard key={collection.id} collection={collection} preview={preview} />
            ))}
          </div>
        </section>
      )}

      <section>
        <SectionHeader
          eyebrow="From readers"
          title="Community collections"
          description="Anyone with an account can build and publish one."
        />
        {community.length === 0 ? (
          <EmptyState
            icon={<Layers className="h-8 w-8" />}
            title="No community collections yet"
            description="Be the first. Create an account, save a few sites, and group them into something worth sharing."
            action={
              <ButtonLink href={user ? `/u/${user.username}` : '/signup'} variant="primary">
                {user ? 'Create a collection' : 'Create an account'}
              </ButtonLink>
            }
          />
        ) : (
          <div className="stack-fade grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {communityCards.map(({ collection, preview }) => (
              <CollectionCard key={collection.id} collection={collection} preview={preview} />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
