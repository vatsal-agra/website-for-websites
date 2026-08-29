import Link from 'next/link'
import { Rss } from 'lucide-react'
import type { Category } from '@/lib/types'
import type { WebAmbleStats } from '@/lib/queries/stats'
import { formatNumber } from '@/lib/utils'
import { ThemeToggle } from './theme-toggle'
import { Wordmark } from './wordmark'

const COLUMNS: { title: string; links: { href: string; label: string }[] }[] = [
  {
    title: 'Browse',
    links: [
      { href: '/browse', label: 'Everything' },
      { href: '/browse?sort=new', label: 'Newest arrivals' },
      { href: '/browse?sort=top', label: 'Most upvoted' },
      { href: '/categories', label: 'All categories' },
      { href: '/tags', label: 'All tags' },
      { href: '/collections', label: 'Collections' },
      { href: '/shuffle', label: 'Shuffle' },
    ],
  },
  {
    title: 'Take part',
    links: [
      { href: '/submit', label: 'Submit a site' },
      { href: '/guidelines', label: 'What gets listed' },
      { href: '/login', label: 'Sign in' },
      { href: '/signup', label: 'Create an account' },
    ],
  },
  {
    title: 'About',
    links: [
      { href: '/about', label: 'What web-amble is' },
      { href: '/about#how-it-works', label: 'How discovery works' },
      { href: '/about#bot', label: 'About AmbleBot' },
      { href: '/feed.xml', label: 'RSS feed' },
    ],
  },
]

export function Footer({ categories, stats }: { categories: Category[]; stats: WebAmbleStats }) {
  const year = new Date().getFullYear()

  return (
    <footer className="mt-24 border-t border-line bg-surface">
      <div className="shell py-14">
        <div className="grid gap-10 lg:grid-cols-[1.4fr_2fr]">
          <div>
            <Wordmark />
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-muted">
              A storefront for the whole web. Everything here is a website someone made — indexed by hand,
              found by machine, and arranged so you can stumble into something good.
            </p>
            <dl className="mt-6 flex flex-wrap gap-x-8 gap-y-3">
              <div>
                <dt className="eyebrow">Sites</dt>
                <dd className="mt-1 font-display text-xl">{formatNumber(stats.approved)}</dd>
              </div>
              <div>
                <dt className="eyebrow">This week</dt>
                <dd className="mt-1 font-display text-xl">+{formatNumber(stats.addedThisWeek)}</dd>
              </div>
              <div>
                <dt className="eyebrow">Categories</dt>
                <dd className="mt-1 font-display text-xl">{stats.categories}</dd>
              </div>
              <div>
                <dt className="eyebrow">Collections</dt>
                <dd className="mt-1 font-display text-xl">{stats.collections}</dd>
              </div>
            </dl>
          </div>

          <div className="grid grid-cols-2 gap-8 sm:grid-cols-3">
            {COLUMNS.map((column) => (
              <div key={column.title}>
                <h3 className="eyebrow mb-3">{column.title}</h3>
                <ul className="space-y-2">
                  {column.links.map((link) => (
                    <li key={link.href + link.label}>
                      <Link
                        href={link.href}
                        className="text-sm text-muted no-underline transition-colors hover:text-ink"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        {categories.length > 0 && (
          <div className="mt-12 border-t border-line pt-8">
            <h3 className="eyebrow mb-4">Every shelf</h3>
            <div className="flex flex-wrap gap-x-5 gap-y-2">
              {categories.map((category) => (
                <Link
                  key={category.id}
                  href={`/category/${category.slug}`}
                  className="text-sm text-muted no-underline transition-colors hover:text-ink"
                >
                  {category.name}
                  <span className="ml-1.5 font-mono text-2xs text-faint">{category.count ?? 0}</span>
                </Link>
              ))}
            </div>
          </div>
        )}

        <div className="mt-12 flex flex-col-reverse items-start justify-between gap-6 border-t border-line pt-8 sm:flex-row sm:items-center">
          <p className="text-xs text-faint">
            © {year} web-amble. Sites are the property of their makers — we only point at them.
          </p>
          <div className="flex items-center gap-3">
            <Link
              href="/feed.xml"
              className="flex h-8 w-8 items-center justify-center rounded-full border border-line text-faint no-underline transition-colors hover:text-ink"
              aria-label="RSS feed"
            >
              <Rss className="h-3.5 w-3.5" />
            </Link>
            <ThemeToggle />
          </div>
        </div>
      </div>
    </footer>
  )
}
