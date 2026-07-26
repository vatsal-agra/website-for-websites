import Link from 'next/link'
import { ArrowRight, ArrowUpRight, Shuffle, Sparkles } from 'lucide-react'
import { getCurrentUser } from '@/lib/session'
import {
  bestOfCategory,
  hiddenGems,
  listCategories,
  newestSites,
  siteOfTheDay,
  trendingSites,
} from '@/lib/queries/sites'
import { collectionPreview, listCollections } from '@/lib/queries/collections'
import { getStats } from '@/lib/queries/stats'
import { formatNumber, timeAgo } from '@/lib/utils'
import { SiteCard } from '@/components/site/site-card'
import { CategoryTile, CollectionCard, FeatureCard } from '@/components/cards'
import { Shelf } from '@/components/shelf'
import { ButtonLink, SectionHeader } from '@/components/ui/primitives'
import { HeroSearch } from '@/components/hero-search'

export const dynamic = 'force-dynamic'

export default async function HomePage() {
  const user = await getCurrentUser()
  const signedIn = Boolean(user)

  const [stats, feature, trending, fresh, gems, categories, collections] = await Promise.all([
    await getStats(),
    await siteOfTheDay(),
    await trendingSites(12, user?.id),
    await newestSites(12, user?.id),
    await hiddenGems(12, user?.id),
    await listCategories(),
    await listCollections({ editorialOnly: true, limit: 6 }),
  ])

  const collectionsWithPreview = await Promise.all(
    collections.map(async (collection) => ({
      collection,
      preview: await collectionPreview(collection.id, 4),
    })),
  )

  // two category shelves, rotated daily so the home page is never quite the same
  const daySeed = Number(new Date().toISOString().slice(8, 10))
  const shelfCategories = categories
    .filter((c) => (c.count ?? 0) >= 4)
    .sort((a, b) => a.slug.localeCompare(b.slug))
  const pickA = shelfCategories[daySeed % Math.max(1, shelfCategories.length)]
  const pickB = shelfCategories[(daySeed + 5) % Math.max(1, shelfCategories.length)]
  const shelfA = pickA ? { category: pickA, sites: await bestOfCategory(pickA.slug, 12, user?.id) } : null
  const shelfB =
    pickB && pickB.slug !== pickA?.slug
      ? { category: pickB, sites: await bestOfCategory(pickB.slug, 12, user?.id) }
      : null

  return (
    <>
      {/* ------------------------------------------------------------- hero -- */}
      <section className="relative overflow-hidden">
        <div
          className="pointer-events-none absolute -top-40 left-1/2 h-[36rem] w-[70rem] -translate-x-1/2 animate-drift opacity-[0.18] blur-3xl"
          style={{
            background:
              'radial-gradient(40% 50% at 30% 40%, hsl(262 80% 60%), transparent 70%), radial-gradient(35% 45% at 70% 50%, hsl(190 80% 55%), transparent 70%), radial-gradient(30% 40% at 50% 70%, hsl(330 75% 60%), transparent 70%)',
          }}
          aria-hidden="true"
        />

        <div className="shell relative pb-14 pt-16 sm:pt-24">
          <p className="eyebrow mb-6 flex items-center gap-2">
            <Sparkles className="h-3 w-3" />
            {formatNumber(stats.approved)} sites catalogued · {formatNumber(stats.addedThisWeek)} added this week
          </p>

          <h1 className="max-w-4xl font-display text-display">
            There is a whole web out there.
            <br />
            <span className="text-muted">This is the front door.</span>
          </h1>

          <p className="mt-6 max-w-xl text-base leading-relaxed text-muted sm:text-lg">
            Portico is a storefront for websites — the way an app store is for apps. Browse the shelves, follow a
            collection, or press shuffle and land somewhere you would never have searched for.
          </p>

          <div className="mt-9 max-w-xl">
            <HeroSearch />
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted">
            <Link href="/browse" className="no-underline transition-colors hover:text-ink">
              Browse everything →
            </Link>
            <Link href="/shuffle" className="inline-flex items-center gap-1.5 no-underline transition-colors hover:text-ink">
              <Shuffle className="h-3.5 w-3.5" />
              Surprise me
            </Link>
            <Link href="/submit" className="no-underline transition-colors hover:text-ink">
              Submit a site
            </Link>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------- feature -- */}
      {feature && (
        <section className="shell pb-16">
          <FeatureCard site={feature} signedIn={signedIn} />
        </section>
      )}

      {/* --------------------------------------------------------- trending -- */}
      {trending.length > 0 && (
        <section className="shell pb-16">
          <SectionHeader
            eyebrow="Moving right now"
            title="Trending this week"
            description="Votes and visits first, then quality, with a gentle nudge for anything we found recently."
            action={
              <ButtonLink href="/browse?sort=trending" variant="ghost" size="sm">
                See all
                <ArrowRight className="h-3.5 w-3.5" />
              </ButtonLink>
            }
          />
          <Shelf>
            {trending.map((site) => (
              <SiteCard key={site.id} site={site} signedIn={signedIn} variant="rail" />
            ))}
          </Shelf>
        </section>
      )}

      {/* ------------------------------------------------------- categories -- */}
      <section className="shell pb-16">
        <SectionHeader
          eyebrow="Sixteen shelves"
          title="Browse by category"
          description="Everything gets filed somewhere. Even the things that defy filing."
          action={
            <ButtonLink href="/categories" variant="ghost" size="sm">
              All categories
              <ArrowRight className="h-3.5 w-3.5" />
            </ButtonLink>
          }
        />
        <div className="stack-fade grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {categories.slice(0, 8).map((category) => (
            <CategoryTile key={category.id} category={category} />
          ))}
        </div>
      </section>

      {/* ------------------------------------------------------------ fresh -- */}
      {fresh.length > 0 && (
        <section className="shell pb-16">
          <SectionHeader
            eyebrow="Just catalogued"
            title="Fresh finds"
            description={`The most recent additions. Last one landed ${timeAgo(fresh[0]?.published_at ?? fresh[0]?.created_at)}.`}
            action={
              <ButtonLink href="/browse?sort=new" variant="ghost" size="sm">
                See all
                <ArrowRight className="h-3.5 w-3.5" />
              </ButtonLink>
            }
          />
          <Shelf>
            {fresh.map((site) => (
              <SiteCard key={site.id} site={site} signedIn={signedIn} variant="rail" />
            ))}
          </Shelf>
        </section>
      )}

      {/* ------------------------------------------------------ collections -- */}
      {collectionsWithPreview.length > 0 && (
        <section className="shell pb-16">
          <SectionHeader
            eyebrow="Curated by hand"
            title="Collections"
            description="Shelves assembled around an idea rather than a category."
            action={
              <ButtonLink href="/collections" variant="ghost" size="sm">
                All collections
                <ArrowRight className="h-3.5 w-3.5" />
              </ButtonLink>
            }
          />
          <div className="stack-fade grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {collectionsWithPreview.map(({ collection, preview }) => (
              <CollectionCard key={collection.id} collection={collection} preview={preview} />
            ))}
          </div>
        </section>
      )}

      {/* -------------------------------------------------- category shelves -- */}
      {shelfA && shelfA.sites.length > 0 && (
        <section className="shell pb-16">
          <SectionHeader
            eyebrow={shelfA.category.tagline}
            title={shelfA.category.name}
            action={
              <ButtonLink href={`/category/${shelfA.category.slug}`} variant="ghost" size="sm">
                See all {shelfA.category.count}
                <ArrowRight className="h-3.5 w-3.5" />
              </ButtonLink>
            }
          />
          <Shelf>
            {shelfA.sites.map((site) => (
              <SiteCard key={site.id} site={site} signedIn={signedIn} variant="rail" />
            ))}
          </Shelf>
        </section>
      )}

      {/* ------------------------------------------------------- hidden gems -- */}
      {gems.length > 0 && (
        <section className="shell pb-16">
          <SectionHeader
            eyebrow="Under-appreciated"
            title="Hidden gems"
            description="High quality, barely any votes. Somebody should look at these."
          />
          <Shelf>
            {gems.map((site) => (
              <SiteCard key={site.id} site={site} signedIn={signedIn} variant="rail" />
            ))}
          </Shelf>
        </section>
      )}

      {shelfB && shelfB.sites.length > 0 && (
        <section className="shell pb-16">
          <SectionHeader
            eyebrow={shelfB.category.tagline}
            title={shelfB.category.name}
            action={
              <ButtonLink href={`/category/${shelfB.category.slug}`} variant="ghost" size="sm">
                See all {shelfB.category.count}
                <ArrowRight className="h-3.5 w-3.5" />
              </ButtonLink>
            }
          />
          <Shelf>
            {shelfB.sites.map((site) => (
              <SiteCard key={site.id} site={site} signedIn={signedIn} variant="rail" />
            ))}
          </Shelf>
        </section>
      )}

      {/* ---------------------------------------------------------- shuffle -- */}
      <section className="shell pb-20">
        <div className="grain relative overflow-hidden rounded-3xl border border-line bg-surface px-6 py-14 text-center sm:px-12">
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.15]"
            style={{
              background:
                'radial-gradient(50% 60% at 20% 30%, hsl(262 80% 60%), transparent 60%), radial-gradient(45% 55% at 80% 60%, hsl(32 85% 58%), transparent 60%)',
            }}
            aria-hidden="true"
          />
          <div className="relative mx-auto max-w-lg">
            <h2 className="font-display text-display-sm">Not looking for anything in particular?</h2>
            <p className="mt-4 text-base leading-relaxed text-muted">
              That is the best way to use this place. Press the button and we will drop you somewhere in the
              catalogue at random.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <ButtonLink href="/shuffle" variant="primary" size="lg">
                <Shuffle className="h-4 w-4" />
                Take me somewhere
              </ButtonLink>
              <ButtonLink href="/submit" variant="secondary" size="lg">
                Submit a site
                <ArrowUpRight className="h-4 w-4" />
              </ButtonLink>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
