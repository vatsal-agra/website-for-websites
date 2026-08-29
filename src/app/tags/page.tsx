import type { Metadata } from 'next'
import Link from 'next/link'
import { listTags } from '@/lib/queries/sites'
import { SectionHeader } from '@/components/ui/primitives'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Tags',
  description:
    'Every tag in the web-amble catalogue, with how many sites carry it. Tags cut across the sixteen categories — a site sits on one shelf but can carry several tags.',
  alternates: { canonical: '/tags' },
}

/**
 * The tag index.
 *
 * Categories answer "where does this belong"; tags answer "what else is like
 * this". A site has exactly one category and up to eight tags, so this page is
 * the cross-cutting view of the catalogue — and the only place every tag is
 * visible at once (the categories page shows the busiest sixty).
 *
 * The bar under each tag is its share of the busiest tag, so the shape of the
 * catalogue is legible at a glance without printing a second number.
 */
export default async function TagsPage() {
  const tags = await listTags(500)
  const busiest = tags[0]?.uses ?? 1
  const featured = tags.slice(0, 12)

  const letters = new Map<string, typeof tags>()
  for (const tag of [...tags].sort((a, b) => a.name.localeCompare(b.name))) {
    const letter = /^[a-z]/i.test(tag.name) ? tag.name[0]!.toUpperCase() : '#'
    const bucket = letters.get(letter)
    if (bucket) bucket.push(tag)
    else letters.set(letter, [tag])
  }

  return (
    <div className="shell py-10 sm:py-14">
      <header className="mb-12 max-w-2xl">
        <p className="eyebrow mb-3">Cross-cutting</p>
        <h1 className="font-display text-display-sm">
          {tags.length} tags, {tags.reduce((n, t) => n + t.uses, 0).toLocaleString()} attachments
        </h1>
        <p className="mt-3 text-base leading-relaxed text-muted">
          A site lives on exactly one shelf but can carry up to eight tags, so tags are how you cross between
          categories — the archives of a museum and a hobbyist’s scanned zines both end up under{' '}
          <Link href="/tag/archive">archive</Link>. The vocabulary is fixed, so it stays consistent as the
          catalogue grows.
        </p>
      </header>

      {featured.length > 0 && (
        <section className="mb-14">
          <SectionHeader eyebrow="Most attached" title="The busy end" />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {featured.map((tag) => (
              <Link
                key={tag.id}
                href={`/tag/${tag.slug}`}
                className="group rounded-2xl border border-line bg-surface p-4 no-underline transition-colors hover:border-line-strong"
              >
                <div className="flex items-baseline justify-between gap-3">
                  <span className="font-display text-lg transition-colors group-hover:text-ink">{tag.name}</span>
                  <span className="shrink-0 font-mono text-2xs text-faint">{tag.uses}</span>
                </div>
                <div className="mt-3 h-1 overflow-hidden rounded-full bg-raised">
                  <div
                    className="h-full rounded-full bg-line-strong transition-[width] duration-500"
                    style={{ width: `${Math.round((tag.uses / busiest) * 100)}%` }}
                  />
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section>
        <SectionHeader
          eyebrow="A to Z"
          title="Every tag"
          description="Counts are approved sites only, so they match what you will actually see on the page."
        />
        <div className="space-y-8">
          {[...letters].map(([letter, group]) => (
            <div key={letter} className="grid gap-4 sm:grid-cols-[3rem_1fr]">
              <p className="font-display text-2xl text-faint sm:pt-0.5" aria-hidden="true">
                {letter}
              </p>
              <div className="flex flex-wrap gap-x-5 gap-y-2.5">
                {group.map((tag) => (
                  <Link
                    key={tag.id}
                    href={`/tag/${tag.slug}`}
                    className="text-sm text-muted no-underline transition-colors hover:text-ink"
                  >
                    {tag.name}
                    <span className="ml-1.5 font-mono text-2xs text-faint">{tag.uses}</span>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
