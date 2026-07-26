import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { env } from '@/lib/env'
import { getCurrentUser } from '@/lib/session'
import { collectionSites, getCollection, listCollections, collectionPreview } from '@/lib/queries/collections'
import { formatDate, pluralize } from '@/lib/utils'
import { SiteCard } from '@/components/site/site-card'
import { CollectionCard } from '@/components/cards'
import { EmptyState, SectionHeader } from '@/components/ui/primitives'
import { CollectionEditor } from './editor'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const collection = await getCollection(slug)
  if (!collection) return { title: 'Collection not found' }
  return {
    title: collection.title,
    description: collection.subtitle || collection.description,
    alternates: { canonical: `/collections/${collection.slug}` },
    openGraph: {
      title: `${collection.title} · Portico`,
      description: collection.subtitle || collection.description,
      url: `${env.siteUrl}/collections/${collection.slug}`,
    },
  }
}

export default async function CollectionPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const user = await getCurrentUser()
  const collection = await getCollection(slug)
  if (!collection) notFound()

  const isOwner = Boolean(user && (collection.curator_id === user.id || user.role === 'admin'))
  if (!collection.is_public && !isOwner) notFound()

  const sites = await collectionSites(collection.id, user?.id)
  const others = (await listCollections({ limit: 7 })).filter((c) => c.id !== collection.id).slice(0, 3)
  const otherCards = await Promise.all(
    others.map(async (other) => ({ other, preview: await collectionPreview(other.id, 4) })),
  )

  return (
    <div>
      <header className="relative overflow-hidden border-b border-line">
        <div
          className="pointer-events-none absolute -left-20 -top-40 h-[28rem] w-[28rem] rounded-full opacity-20 blur-3xl"
          style={{ background: `hsl(${collection.hue} 80% 55%)` }}
          aria-hidden="true"
        />
        <div className="shell relative py-12 sm:py-16">
          <p className="eyebrow mb-4">
            <Link href="/collections" className="no-underline transition-colors hover:text-ink">
              Collections
            </Link>
            {' · '}
            {collection.is_editorial ? 'Portico editorial' : `curated by @${collection.curator?.username ?? 'someone'}`}
            {!collection.is_public && ' · private'}
          </p>
          <h1 className="max-w-3xl font-display text-display-sm">{collection.title}</h1>
          {collection.subtitle && <p className="mt-2 font-display text-xl text-muted">{collection.subtitle}</p>}
          {collection.description && (
            <p className="mt-5 max-w-prose text-base leading-relaxed text-muted">{collection.description}</p>
          )}
          <p className="mt-6 font-mono text-2xs uppercase tracking-[0.12em] text-faint">
            {pluralize(sites.length, 'site')} · updated {formatDate(collection.updated_at)}
          </p>
        </div>
      </header>

      <div className="shell py-10">
        {isOwner && <CollectionEditor collection={collection} sites={sites} />}

        {sites.length === 0 ? (
          <EmptyState
            title="This collection is empty"
            description={
              isOwner
                ? 'Add sites to it from any site page, or paste a URL above.'
                : 'The curator has not added anything yet.'
            }
          />
        ) : (
          <div className="stack-fade grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {sites.map((site) => (
              <SiteCard
                key={site.id}
                site={site}
                signedIn={Boolean(user)}
                note={site.collectionNote || undefined}
              />
            ))}
          </div>
        )}
      </div>

      {others.length > 0 && (
        <section className="shell pb-8 pt-8">
          <SectionHeader eyebrow="Keep going" title="Other collections" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {otherCards.map(({ other, preview }) => (
              <CollectionCard key={other.id} collection={other} preview={preview} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
