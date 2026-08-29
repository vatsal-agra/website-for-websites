import type { Metadata } from 'next'
import Link from 'next/link'
import { getCurrentUser } from '@/lib/session'
import { getStats } from '@/lib/queries/stats'
import { formatNumber } from '@/lib/utils'
import { SubmitForm } from './submit-form'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Submit a site',
  description:
    'Know a website that deserves to be found? Add it to web-amble. We read the page, work out what it is, and put it on the right shelf.',
}

const STEPS = [
  {
    title: 'You paste a link',
    body: 'Anything with a homepage. Your own project, a favourite blog, a tool you cannot live without.',
  },
  {
    title: 'We read the page',
    body: 'AmbleBot fetches it once, respecting robots.txt, and pulls out the title, description, language and cover image.',
  },
  {
    title: 'It gets classified',
    body: 'A classifier puts it on one of sixteen shelves and applies tags from a fixed vocabulary. Quality is scored from the page itself.',
  },
  {
    title: 'A human checks it',
    body: 'Submissions always go through review before they appear. Usually within a day.',
  },
]

export default async function SubmitPage({
  searchParams,
}: {
  searchParams: Promise<{ url?: string }>
}) {
  const { url } = await searchParams
  const user = await getCurrentUser()
  const stats = await getStats()

  return (
    <div className="shell py-10 sm:py-16">
      <div className="grid gap-14 lg:grid-cols-[1.1fr_1fr] lg:gap-20">
        <div>
          <p className="eyebrow mb-3">Add to the catalogue</p>
          <h1 className="font-display text-display-sm">Know a site we are missing?</h1>
          <p className="mt-4 max-w-prose text-base leading-relaxed text-muted">
            web-amble finds most of its sites on its own, but the best entries come from people who already love
            them. There is no fee, no listing tier and no way to buy a better position.
          </p>

          <div className="mt-8">
            <SubmitForm initialUrl={url ?? ''} signedIn={Boolean(user)} />
          </div>

          <p className="mt-6 text-xs leading-relaxed text-faint">
            By submitting you confirm the site is publicly accessible and does not breach our{' '}
            <Link href="/guidelines" className="text-muted">
              listing guidelines
            </Link>
            . We only store the URL and what the page publicly publishes about itself.
          </p>
        </div>

        <div className="lg:pt-16">
          <div className="rounded-2xl border border-line bg-surface p-6">
            <h2 className="eyebrow mb-5">What happens next</h2>
            <ol className="space-y-5">
              {STEPS.map((step, i) => (
                <li key={step.title} className="flex gap-4">
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-line font-mono text-2xs text-muted">
                    {i + 1}
                  </span>
                  <div>
                    <p className="text-sm font-medium">{step.title}</p>
                    <p className="mt-1 text-sm leading-relaxed text-muted">{step.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-3">
            <Metric label="Catalogued" value={formatNumber(stats.approved)} />
            <Metric label="In review" value={formatNumber(stats.pending)} />
            <Metric label="This week" value={`+${formatNumber(stats.addedThisWeek)}`} />
          </div>

          <div className="mt-4 rounded-2xl border border-line bg-surface p-6">
            <h2 className="eyebrow mb-3">We will probably decline</h2>
            <ul className="space-y-2 text-sm leading-relaxed text-muted">
              <li>· Social media profiles, app store pages and link-in-bio pages</li>
              <li>· Sites behind a login or a hard paywall on the front page</li>
              <li>· Affiliate farms, AI-generated filler and SEO doorway pages</li>
              <li>· Adult content, gambling, piracy and anything illegal</li>
            </ul>
            <Link
              href="/guidelines"
              className="mt-4 inline-block text-sm text-muted no-underline transition-colors hover:text-ink"
            >
              Read the full guidelines →
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-line bg-surface px-3 py-3 text-center">
      <p className="font-display text-xl leading-none">{value}</p>
      <p className="mt-1.5 font-mono text-2xs uppercase tracking-[0.1em] text-faint">{label}</p>
    </div>
  )
}
