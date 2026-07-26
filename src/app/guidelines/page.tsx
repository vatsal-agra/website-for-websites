import type { Metadata } from 'next'
import Link from 'next/link'
import { Check, X } from 'lucide-react'
import { ButtonLink, Prose } from '@/components/ui/primitives'

export const metadata: Metadata = {
  title: 'Listing guidelines',
  description: 'What gets listed on Portico, what does not, and how to appeal a decision.',
}

const YES = [
  'Sites that do one thing well, however small',
  'Personal blogs, digital gardens and hand-built pages',
  'Free tools, playgrounds and interactive explainers',
  'Archives, libraries and museum collections',
  'Independent journalism, criticism and long essays',
  'Browser games, toys and single-serving jokes',
  'Documentation worth reading for its own sake',
  'Products, if the front page actually explains what they do',
]

const NO = [
  'Social media profiles, app store and link-in-bio pages',
  'Sites entirely behind a login, paywall or age gate',
  'Affiliate farms, coupon sites and comparison spam',
  'Bulk AI-generated content and SEO doorway pages',
  'Adult content, gambling, piracy, malware and scams',
  'Anything illegal in its country of origin',
  'Deep sub-pages — we list sites, not articles',
  'Parked domains and pages with nothing on them',
]

export default function GuidelinesPage() {
  return (
    <div className="shell py-10 sm:py-16">
      <header className="mb-12 max-w-3xl">
        <p className="eyebrow mb-3">Guidelines</p>
        <h1 className="font-display text-display-sm">What gets listed</h1>
        <p className="mt-5 text-lg leading-relaxed text-muted">
          Portico aims to be broad. The test is not “is this important?” — it is “would somebody be glad they
          found this?” A one-page site about a single obscure hobby passes that test. A twelve-page affiliate
          funnel does not.
        </p>
      </header>

      <div className="mb-16 grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-positive/20 bg-positive/[0.03] p-6">
          <h2 className="mb-4 flex items-center gap-2 font-display text-xl">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-positive/15 text-positive">
              <Check className="h-3.5 w-3.5" />
            </span>
            Welcome here
          </h2>
          <ul className="space-y-2.5">
            {YES.map((item) => (
              <li key={item} className="flex gap-2.5 text-sm leading-relaxed text-ink-soft">
                <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-positive" />
                {item}
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-2xl border border-danger/20 bg-danger/[0.03] p-6">
          <h2 className="mb-4 flex items-center gap-2 font-display text-xl">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-danger/15 text-danger">
              <X className="h-3.5 w-3.5" />
            </span>
            Not here
          </h2>
          <ul className="space-y-2.5">
            {NO.map((item) => (
              <li key={item} className="flex gap-2.5 text-sm leading-relaxed text-ink-soft">
                <X className="mt-0.5 h-3.5 w-3.5 shrink-0 text-danger" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <Prose>
        <h2>Submitting your own site</h2>
        <p>
          Encouraged. Self-submission carries no penalty and no advantage — every entry lands in the same review
          queue, and ranking is decided afterwards by what readers do with it. Submitting the same site repeatedly
          will get it declined.
        </p>

        <h2>How review works</h2>
        <p>
          An editor sees the URL you sent, the metadata we read from the page, the computed quality score and any
          note you attached. They approve, correct the category, or decline with a reason. If you were signed in
          when you submitted, the outcome and the reason appear on your profile.
        </p>

        <h2>Corrections</h2>
        <p>
          Wrong title, stale description, wrong shelf, dead link — use “Report a problem” on the site’s page. It
          is the fastest route into the queue, and it is the same form the editors watch all day.
        </p>

        <h2>Removal</h2>
        <p>
          If you own a site and want it delisted, report it and choose “I own this site”. We remove it and add the
          domain to a permanent blocklist so the crawler does not pick it up again. No justification needed. You
          can also block <code>PorticoBot</code> in <code>robots.txt</code>, which prevents it being found in the
          first place — see <Link href="/about#bot">about the bot</Link>.
        </p>

        <h2>Appeals</h2>
        <p>
          Decline decisions are reversible. Resubmit with a note explaining what changed, and it will be looked at
          again. The classifier is wrong sometimes; so are the editors.
        </p>
      </Prose>

      <div className="mt-12 flex flex-wrap gap-3">
        <ButtonLink href="/submit" variant="primary" size="lg">
          Submit a site
        </ButtonLink>
        <ButtonLink href="/about" variant="secondary" size="lg">
          How discovery works
        </ButtonLink>
      </div>
    </div>
  )
}
