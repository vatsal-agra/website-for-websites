import Link from 'next/link'
import { randomSite } from '@/lib/queries/sites'
import { ButtonLink } from '@/components/ui/primitives'
import { CoverArt } from '@/components/site/cover'

export const dynamic = 'force-dynamic'

export default async function NotFound() {
  let suggestion: Awaited<ReturnType<typeof randomSite>> = null
  try {
    suggestion = await randomSite()
  } catch {
    /* database may be unavailable during a cold start */
  }

  return (
    <div className="shell flex min-h-[calc(100dvh-4rem)] items-center py-16">
      <div className="grid w-full items-center gap-12 lg:grid-cols-2">
        <div>
          <p className="eyebrow mb-4">404</p>
          <h1 className="font-display text-display-sm">This page is not on any shelf</h1>
          <p className="mt-5 max-w-prose text-base leading-relaxed text-muted">
            The address you followed does not exist here. It may have been a site we have since archived, or a
            link that was never quite right.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <ButtonLink href="/" variant="primary" size="lg">
              Back to the front
            </ButtonLink>
            <ButtonLink href="/browse" variant="secondary" size="lg">
              Browse the catalogue
            </ButtonLink>
          </div>
        </div>

        {suggestion && (
          <Link
            href={`/site/${suggestion.slug}`}
            className="group overflow-hidden rounded-2xl border border-line bg-surface no-underline transition-all hover:-translate-y-1 hover:shadow-lift"
          >
            <div className="relative aspect-[16/10]">
              <CoverArt seed={suggestion.url} hue={suggestion.accent_hue} />
            </div>
            <div className="p-5">
              <p className="eyebrow mb-2">While you are here</p>
              <p className="font-display text-xl">{suggestion.title}</p>
              <p className="mt-1 line-clamp-2 text-sm text-muted">{suggestion.tagline}</p>
            </div>
          </Link>
        )}
      </div>
    </div>
  )
}
