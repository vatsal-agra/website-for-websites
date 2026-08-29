import type { Metadata } from 'next'
import Link from 'next/link'
import { getStats, sourceBreakdown } from '@/lib/queries/stats'
import { env } from '@/lib/env'
import { formatNumber } from '@/lib/utils'
import { Prose, SectionHeader, Stat } from '@/components/ui/primitives'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'About',
  description:
    'What web-amble is, how sites get found, how they are ranked, and how to keep your site out of the catalogue.',
}

export default async function AboutPage() {
  const [stats, sources] = await Promise.all([getStats(), sourceBreakdown()])

  return (
    <div className="shell py-10 sm:py-16">
      <header className="mb-14 max-w-3xl">
        <p className="eyebrow mb-3">About</p>
        <h1 className="font-display text-display-sm">A storefront for the whole web</h1>
        <p className="mt-5 text-lg leading-relaxed text-muted">
          App stores gave software a place to be browsed. Websites never got one. Search engines are excellent
          when you already know what you want, and useless when you do not. web-amble exists for the second case.
        </p>
      </header>

      <div className="mb-16 grid gap-6 rounded-2xl border border-line bg-surface p-6 sm:grid-cols-4">
        <Stat label="Sites listed" value={formatNumber(stats.approved)} />
        <Stat label="Added this week" value={`+${formatNumber(stats.addedThisWeek)}`} />
        <Stat label="Categories" value={stats.categories} hint="Every site sits on exactly one" />
        <Stat label="Collections" value={stats.collections} hint="Editorial and community" />
      </div>

      <div className="grid gap-14 lg:grid-cols-[1.3fr_1fr] lg:gap-20">
        <Prose>
          <h2 id="how-it-works">How sites get here</h2>
          <p>
            Two ways. People submit them, and the catalogue finds them by itself. Both routes end at the same
            pipeline.
          </p>
          <ol>
            <li>
              <strong>Discovery.</strong> A background worker polls a set of sources — Hacker News, Lobsters and a
              handful of long-running link blogs — and harvests the destinations they point at. Separately, it
              re-reads sites already in the catalogue and follows their outbound links. Good sites link to good
              sites; that turns out to be most of the signal you need.
            </li>
            <li>
              <strong>Fetching.</strong> Each candidate is fetched exactly once, politely: one request per host at
              a time, a delay between them, and <code>robots.txt</code> respected. If a site says no, that is the
              end of it.
            </li>
            <li>
              <strong>Reading.</strong> We parse the title, description, language, cover image, feeds and outbound
              links from the HTML the site already publishes about itself. We do not execute the page, store its
              content, or copy anything beyond a thumbnail.
            </li>
            <li>
              <strong>Classifying.</strong> A weighted keyword classifier assigns one of sixteen categories and up
              to six tags from a fixed vocabulary. The fixed vocabulary is the important part — it is what stops
              the tag list from degenerating into meta-keyword soup.
            </li>
            <li>
              <strong>Scoring.</strong> A quality score is computed from things visible on the page. Mostly:
              is there anything here to read or use, does it link out to the rest of the web, is it drowning in
              ad networks, is it a parked domain — and does it read like a sales funnel, which counts against it.
              Polished social metadata counts for almost nothing, on purpose. A company with a marketing team has
              perfect metadata and that says nothing about whether the site is worth your time; some of the best
              things on the web are a plain page with seventy links on it.
            </li>
            <li>
              <strong>Deciding.</strong> Above a threshold, a discovered site is listed automatically. Everything
              else, and every human submission, waits for a person to look at it. The score is a filter, not a
              judge — it cannot tell an excellent company website from an excellent independent one, so anything
              ambiguous goes to the queue rather than straight onto a shelf.
            </li>
          </ol>

          <h2>How things are ordered</h2>
          <p>
            Trending is engagement first — votes, clicks and views — with the quality score acting as a floor so
            good sites stay visible before anyone has voted on them, and a gentle decay by age. It is deliberately
            simple and deliberately public:
          </p>
          <pre className="overflow-x-auto rounded-xl border border-line bg-raised p-4 font-mono text-xs">
{`(votes·5 + clicks·1.5 + views·0.2 + quality·3) / (days_listed + 3)^0.3`}
          </pre>
          <p>
            There is no paid placement, no sponsored slot, and no way to buy a better position. If that ever
            changes it will be written here first.
          </p>
          <p>
            <strong>Every number on this site is a real one.</strong> Vote, click and view counts start at zero and
            only move when somebody actually does something, and the founding catalogue carries the date it was
            genuinely catalogued. Nothing is back-dated or padded to make the place look busier than it is — which
            is why a brand-new install honestly looks brand new.
          </p>
          <p>
            Sites are re-checked on a rolling schedule. Three consecutive failures and an entry is archived rather
            than left rotting in the grid.
          </p>

          <h2>What gets refused</h2>
          <p>
            web-amble is a directory of the open web, so the filter is narrow on purpose: no adult content, no
            gambling, no piracy or malware, no scams. Beyond that we decline things that are not really websites —
            social profiles, app store pages, link-in-bio pages — and things nobody can actually read, like sites
            hidden entirely behind a login. The full list is in the{' '}
            <Link href="/guidelines">listing guidelines</Link>.
          </p>

          <h2 id="bot">About AmbleBot</h2>
          <p>
            The crawler identifies itself as <code>{env.crawlerUserAgent.split(' ')[0]}</code>. It requests a
            single page per site, obeys <code>robots.txt</code> including wildcards, and never follows forms or
            logs in anywhere. To keep your site out entirely, add this to your <code>robots.txt</code>:
          </p>
          <pre className="overflow-x-auto rounded-xl border border-line bg-raised p-4 font-mono text-xs">
{`User-agent: AmbleBot
Disallow: /`}
          </pre>
          <p>
            If your site is already listed and you want it gone, use the “Report a problem” link on its page and
            pick “I own this site”. That goes straight to the moderation queue.
          </p>

          <h2>Your data</h2>
          <p>
            An account stores a username, a hashed password, an optional email, and the sites you have saved,
            voted for or collected. There is no analytics script on this site, no third-party embeds, and no
            tracking cookies — the only cookie is your session. Outbound links pass through a counter that
            increments a number and strips the referrer before handing you over.
          </p>
        </Prose>

        <aside className="space-y-8">
          <div className="rounded-2xl border border-line bg-surface p-6">
            <SectionHeader eyebrow="Provenance" title="Where the catalogue came from" className="mb-4" />
            <ul className="space-y-3">
              {sources.map((source) => (
                <li key={source.source} className="flex items-center justify-between gap-4 text-sm">
                  <span className="capitalize text-muted">{source.source.replace(/[-_]/g, ' ')}</span>
                  <span className="font-mono text-xs text-faint">{formatNumber(source.count)}</span>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-xs leading-relaxed text-faint">
              “Seed” entries are the founding set, catalogued by hand when web-amble was built.
            </p>
          </div>

          <div className="rounded-2xl border border-line bg-surface p-6">
            <h2 className="eyebrow mb-3">Machine readable</h2>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/feed.xml" className="text-muted no-underline hover:text-ink">
                  /feed.xml — newest listings
                </Link>
              </li>
              <li>
                <Link href="/api/sites" className="text-muted no-underline hover:text-ink">
                  /api/sites — public JSON API
                </Link>
              </li>
              <li>
                <Link href="/sitemap.xml" className="text-muted no-underline hover:text-ink">
                  /sitemap.xml
                </Link>
              </li>
            </ul>
          </div>

          <div className="rounded-2xl border border-line bg-surface p-6">
            <h2 className="eyebrow mb-3">Colophon</h2>
            <p className="text-sm leading-relaxed text-muted">
              Set in Instrument Serif and Inter, with JetBrains Mono for the small print. Cover artwork is
              generated from each site’s own address when it does not publish an image of its own — no two are
              alike, and the same site always produces the same picture.
            </p>
          </div>
        </aside>
      </div>
    </div>
  )
}
