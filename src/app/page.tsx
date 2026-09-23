import { Suspense } from 'react'
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
import { collectionPreviews, listCollections } from '@/lib/queries/collections'
import { getStats } from '@/lib/queries/stats'
import { formatNumber } from '@/lib/utils'
import { SiteCard } from '@/components/site/site-card'
import { CategoryTile, CollectionCard, FeatureCard } from '@/components/cards'
import { Shelf } from '@/components/shelf'
import { ButtonLink, SectionHeader } from '@/components/ui/primitives'
import { HeroSearch } from '@/components/hero-search'
import { RelativeTime } from '@/components/relative-time'
import { CountSkeleton, FeatureSkeleton, GridSkeleton, ShelfSkeleton } from '@/components/skeletons'

export const dynamic = 'force-dynamic'

/**
 * The home page is a storefront: a dozen shelves, each its own query.
 *
 * Every section fetches its own data and is wrapped in Suspense, so the hero is
 * interactive immediately and shelves arrive as they resolve rather than the
 * whole page waiting on the slowest one. The skeletons reserve the right amount
 * of space, so nothing jumps around as sections fill in.
 */

interface ShelfProps {
  userId?: number
  signedIn: boolean
}

// ------------------------------------------------------------------- hero --

async function CatalogueCount() {
  const stats = await getStats()
  return (
    <>
      {formatNumber(stats.approved)} sites catalogued
      {stats.addedThisWeek > 0 && <> · {formatNumber(stats.addedThisWeek)} added this week</>}
    </>
  )
}

function Hero() {
  return (
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
          <Suspense fallback={<CountSkeleton width="w-44" />}>
            <CatalogueCount />
          </Suspense>
        </p>

        <h1 className="max-w-4xl font-display text-display">
          There is a whole web out there.
          <br />
          <span className="text-muted">This is the front door.</span>
        </h1>

        <p className="mt-6 max-w-xl text-base leading-relaxed text-muted sm:text-lg">
          web-amble is a storefront for websites — the way an app store is for apps. Browse the shelves, follow a
          collection, or press shuffle and land somewhere you would never have searched for.
        </p>

        <div className="mt-9 max-w-xl">
          <HeroSearch />
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-3 text-sm text-muted">
          <ButtonLink href="/shuffle" variant="primary" size="lg">
            <Shuffle className="h-4 w-4" />
            Shuffle a website
          </ButtonLink>
          <Link href="/browse" className="no-underline transition-colors hover:text-ink">
            Browse everything
          </Link>
          <Link href="/submit" className="no-underline transition-colors hover:text-ink">
            Submit a site
          </Link>
        </div>
      </div>
    </section>
  )
}

// ---------------------------------------------------------------- sections --

async function FeatureSlot({ signedIn }: { signedIn: boolean }) {
  const feature = await siteOfTheDay()
  if (!feature) return null
  return (
    <section className="shell pb-16">
      <FeatureCard site={feature} signedIn={signedIn} />
    </section>
  )
}

async function TrendingShelf({ userId, signedIn }: ShelfProps) {
  const sites = await trendingSites(12, userId)
  if (!sites.length) return null
  return (
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
        {sites.map((site) => (
          <SiteCard key={site.id} site={site} signedIn={signedIn} variant="rail" />
        ))}
      </Shelf>
    </section>
  )
}

async function CategoryGrid() {
  const categories = await listCategories()
  return (
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
  )
}

async function FreshShelf({ userId, signedIn }: ShelfProps) {
  const sites = await newestSites(12, userId)
  if (!sites.length) return null
  return (
    <section className="shell pb-16">
      <SectionHeader
        eyebrow="Just catalogued"
        title="Fresh finds"
        description={
          <>
            The most recent additions. Last one landed{' '}
            <RelativeTime value={sites[0]?.published_at ?? sites[0]?.created_at} />.
          </>
        }
        action={
          <ButtonLink href="/browse?sort=new" variant="ghost" size="sm">
            See all
            <ArrowRight className="h-3.5 w-3.5" />
          </ButtonLink>
        }
      />
      <Shelf>
        {sites.map((site) => (
          <SiteCard key={site.id} site={site} signedIn={signedIn} variant="rail" />
        ))}
      </Shelf>
    </section>
  )
}

async function CollectionsGrid() {
  const collections = await listCollections({ editorialOnly: true, limit: 6 })
  if (!collections.length) return null
  const previews = await collectionPreviews(
    collections.map((c) => c.id),
    4,
  )
  return (
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
        {collections.map((collection) => (
          <CollectionCard
            key={collection.id}
            collection={collection}
            preview={previews.get(collection.id) ?? []}
          />
        ))}
      </div>
    </section>
  )
}

/**
 * Two category shelves, rotated by day-of-month so the home page is never quite
 * the same twice — the storefront equivalent of moving the display around.
 */
async function RotatingCategoryShelf({ offset, userId, signedIn }: ShelfProps & { offset: number }) {
  const categories = await listCategories()
  const eligible = categories.filter((c) => (c.count ?? 0) >= 4).sort((a, b) => a.slug.localeCompare(b.slug))
  if (!eligible.length) return null

  const daySeed = Number(new Date().toISOString().slice(8, 10))
  const category = eligible[(daySeed + offset) % eligible.length]
  if (!category) return null

  const sites = await bestOfCategory(category.slug, 12, userId)
  if (!sites.length) return null

  return (
    <section className="shell pb-16">
      <SectionHeader
        eyebrow={category.tagline}
        title={category.name}
        action={
          <ButtonLink href={`/category/${category.slug}`} variant="ghost" size="sm">
            See all {category.count}
            <ArrowRight className="h-3.5 w-3.5" />
          </ButtonLink>
        }
      />
      <Shelf>
        {sites.map((site) => (
          <SiteCard key={site.id} site={site} signedIn={signedIn} variant="rail" />
        ))}
      </Shelf>
    </section>
  )
}

async function GemsShelf({ userId, signedIn }: ShelfProps) {
  const sites = await hiddenGems(12, userId)
  if (!sites.length) return null
  return (
    <section className="shell pb-16">
      <SectionHeader
        eyebrow="Under-appreciated"
        title="Hidden gems"
        description="High quality, barely any votes. Somebody should look at these."
      />
      <Shelf>
        {sites.map((site) => (
          <SiteCard key={site.id} site={site} signedIn={signedIn} variant="rail" />
        ))}
      </Shelf>
    </section>
  )
}

function ShuffleBand() {
  return (
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
  )
}

// ------------------------------------------------------------------- page --

export default async function HomePage() {
  // one cheap query for the whole page; every shelf below streams on its own
  const user = await getCurrentUser()
  const shelf = { userId: user?.id, signedIn: Boolean(user) }

  return (
    <>
      <Hero />

      <Suspense fallback={<FeatureSkeleton />}>
        <FeatureSlot signedIn={shelf.signedIn} />
      </Suspense>

      <Suspense fallback={<ShelfSkeleton eyebrow="Moving right now" title="Trending this week" />}>
        <TrendingShelf {...shelf} />
      </Suspense>

      <Suspense
        fallback={
          <section className="shell pb-16">
            <GridSkeleton count={8} columns="grid-cols-2 sm:grid-cols-3 lg:grid-cols-4" />
          </section>
        }
      >
        <CategoryGrid />
      </Suspense>

      <Suspense fallback={<ShelfSkeleton eyebrow="Just catalogued" title="Fresh finds" />}>
        <FreshShelf {...shelf} />
      </Suspense>

      <Suspense
        fallback={
          <section className="shell pb-16">
            <GridSkeleton count={6} />
          </section>
        }
      >
        <CollectionsGrid />
      </Suspense>

      <Suspense fallback={<ShelfSkeleton />}>
        <RotatingCategoryShelf offset={0} {...shelf} />
      </Suspense>

      <Suspense fallback={<ShelfSkeleton eyebrow="Under-appreciated" title="Hidden gems" />}>
        <GemsShelf {...shelf} />
      </Suspense>

      <Suspense fallback={<ShelfSkeleton />}>
        <RotatingCategoryShelf offset={5} {...shelf} />
      </Suspense>

      <ShuffleBand />
    </>
  )
}
