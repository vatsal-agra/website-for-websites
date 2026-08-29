import Link from 'next/link'
import { listCollections } from '@/lib/queries/collections'
import { formatDate, pluralize } from '@/lib/utils'
import { Badge } from '@/components/ui/primitives'
import { NewEditorialCollection } from './form'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Collections' }

export default async function AdminCollectionsPage() {
  const all = await listCollections({ limit: 200 })
  const editorial = all.filter((c) => c.is_editorial)
  const community = all.filter((c) => !c.is_editorial)

  return (
    <div className="space-y-10">
      <section>
        <header className="mb-4">
          <h2 className="font-display text-2xl">Collections</h2>
          <p className="mt-1 text-sm text-muted">
            Editorial collections appear first everywhere. Edit their contents from the collection page itself —
            you have curator rights on all of them.
          </p>
        </header>
        <NewEditorialCollection />
      </section>

      <section>
        <h3 className="eyebrow mb-3">Editorial ({editorial.length})</h3>
        <Table collections={editorial} />
      </section>

      <section>
        <h3 className="eyebrow mb-3">Community ({community.length})</h3>
        {community.length === 0 ? (
          <p className="rounded-xl border border-dashed border-line px-4 py-6 text-center text-sm text-muted">
            No reader collections yet.
          </p>
        ) : (
          <Table collections={community} />
        )}
      </section>
    </div>
  )
}

function Table({ collections }: { collections: Awaited<ReturnType<typeof listCollections>> }) {
  if (collections.length === 0) return null
  return (
    <div className="overflow-x-auto rounded-2xl border border-line">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-line bg-surface">
            <th className="px-3 py-2.5 text-left font-mono text-2xs uppercase tracking-wider text-faint">Title</th>
            <th className="hidden px-3 py-2.5 text-left font-mono text-2xs uppercase tracking-wider text-faint sm:table-cell">
              Curator
            </th>
            <th className="px-3 py-2.5 text-right font-mono text-2xs uppercase tracking-wider text-faint">Sites</th>
            <th className="hidden px-3 py-2.5 text-right font-mono text-2xs uppercase tracking-wider text-faint md:table-cell">
              Updated
            </th>
          </tr>
        </thead>
        <tbody>
          {collections.map((collection) => (
            <tr key={collection.id} className="border-b border-line last:border-0 hover:bg-surface">
              <td className="px-3 py-2.5">
                <Link href={`/collections/${collection.slug}`} className="no-underline hover:underline">
                  {collection.title}
                </Link>
                {!collection.is_public && (
                  <Badge className="ml-2" tone="neutral">
                    private
                  </Badge>
                )}
                <p className="truncate text-2xs text-faint">{collection.subtitle}</p>
              </td>
              <td className="hidden px-3 py-2.5 font-mono text-2xs text-muted sm:table-cell">
                {collection.curator ? `@${collection.curator.username}` : '—'}
              </td>
              <td className="px-3 py-2.5 text-right font-mono text-xs text-muted">{collection.count ?? 0}</td>
              <td className="hidden px-3 py-2.5 text-right font-mono text-2xs text-faint md:table-cell">
                {formatDate(collection.updated_at)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="border-t border-line bg-surface px-3 py-2 font-mono text-2xs text-faint">
        {pluralize(collections.length, 'collection')}
      </p>
    </div>
  )
}
