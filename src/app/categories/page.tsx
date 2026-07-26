import type { Metadata } from 'next'
import { listCategories, listTags } from '@/lib/queries/sites'
import { CategoryTile } from '@/components/cards'
import { ChipLink } from '@/components/ui/primitives'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Categories',
  description:
    'Sixteen shelves covering everything on the open web — tools, design, learning, games, archives and the gloriously unnecessary.',
}

export default async function CategoriesPage() {
  const categories = await listCategories()
  const tags = await listTags(60)

  return (
    <div className="shell py-10 sm:py-14">
      <header className="mb-10 max-w-2xl">
        <p className="eyebrow mb-3">Sixteen shelves</p>
        <h1 className="font-display text-display-sm">Everything gets filed somewhere</h1>
        <p className="mt-3 text-base leading-relaxed text-muted">
          Every site is placed on exactly one shelf by an automatic classifier, then corrected by hand when it
          gets it wrong. Tags do the finer-grained work underneath.
        </p>
      </header>

      <div className="stack-fade grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {categories.map((category) => (
          <CategoryTile key={category.id} category={category} />
        ))}
      </div>

      {tags.length > 0 && (
        <section className="mt-16">
          <h2 className="eyebrow mb-4">Browse by tag</h2>
          <div className="flex flex-wrap gap-2">
            {tags.map((tag) => (
              <ChipLink key={tag.id} href={`/tag/${tag.slug}`}>
                {tag.name}
                <span className="opacity-50">{tag.uses}</span>
              </ChipLink>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
