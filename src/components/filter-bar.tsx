import Link from 'next/link'
import { Check } from 'lucide-react'
import type { Category, SortKey, Tag } from '@/lib/types'
import { ATTRIBUTE_DEFS } from '@/lib/taxonomy'
import { cn } from '@/lib/utils'

export interface BrowseQuery {
  q?: string
  category?: string
  tag?: string
  sort?: SortKey
  attrs: string[]
  page: number
}

export const SORTS: { key: SortKey; label: string; hint: string }[] = [
  { key: 'trending', label: 'Trending', hint: 'Votes and clicks, weighted by recency' },
  { key: 'new', label: 'Newest', hint: 'Most recently catalogued' },
  { key: 'top', label: 'Top rated', hint: 'Most upvoted of all time' },
  { key: 'random', label: 'Random', hint: 'Shuffled' },
  { key: 'alpha', label: 'A–Z', hint: 'Alphabetical' },
]

/** Build a querystring from the current filters plus an override. */
export function buildHref(base: string, query: BrowseQuery, patch: Partial<BrowseQuery>): string {
  const next = { ...query, ...patch }
  const params = new URLSearchParams()
  if (next.q) params.set('q', next.q)
  if (next.category) params.set('category', next.category)
  if (next.tag) params.set('tag', next.tag)
  if (next.sort && next.sort !== 'trending') params.set('sort', next.sort)
  for (const attr of next.attrs) params.append('attr', attr)
  if (next.page && next.page > 1) params.set('page', String(next.page))
  const qs = params.toString()
  return qs ? `${base}?${qs}` : base
}

function toggleAttr(attrs: string[], key: string): string[] {
  return attrs.includes(key) ? attrs.filter((a) => a !== key) : [...attrs, key]
}

export function FilterBar({
  base,
  query,
  categories,
  tags,
  total,
}: {
  base: string
  query: BrowseQuery
  categories: Category[]
  tags?: Tag[]
  total: number
}) {
  const activeCount = query.attrs.length + (query.category ? 1 : 0) + (query.tag ? 1 : 0)

  return (
    <div className="space-y-4">
      {/* sort */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="no-scrollbar -mx-1 flex gap-1 overflow-x-auto px-1">
          {SORTS.map((sort) => {
            const active = (query.sort ?? 'trending') === sort.key
            return (
              <Link
                key={sort.key}
                href={buildHref(base, query, { sort: sort.key, page: 1 })}
                title={sort.hint}
                scroll={false}
                className={cn(
                  'shrink-0 rounded-full px-3.5 py-1.5 text-sm no-underline transition-colors',
                  active ? 'bg-ink text-canvas' : 'text-muted hover:bg-raised hover:text-ink',
                )}
              >
                {sort.label}
              </Link>
            )
          })}
        </div>

        <p className="shrink-0 font-mono text-2xs uppercase tracking-[0.12em] text-faint">
          {total.toLocaleString()} {total === 1 ? 'site' : 'sites'}
          {activeCount > 0 && (
            <>
              {' · '}
              <Link href={buildHref(base, query, { attrs: [], category: undefined, tag: undefined, page: 1 })} className="text-muted">
                clear filters
              </Link>
            </>
          )}
        </p>
      </div>

      {/* categories */}
      <div className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
        <Link
          href={buildHref(base, query, { category: undefined, page: 1 })}
          scroll={false}
          className={cn(
            'shrink-0 rounded-full border px-3 py-1.5 font-mono text-2xs uppercase tracking-[0.1em] no-underline transition-colors',
            !query.category
              ? 'border-ink/25 bg-ink text-canvas'
              : 'border-line text-muted hover:border-line-strong hover:text-ink',
          )}
        >
          All
        </Link>
        {categories.map((category) => {
          const active = query.category === category.slug
          return (
            <Link
              key={category.id}
              href={buildHref(base, query, { category: active ? undefined : category.slug, page: 1 })}
              scroll={false}
              className={cn(
                'shrink-0 rounded-full border px-3 py-1.5 font-mono text-2xs uppercase tracking-[0.1em] no-underline transition-colors',
                active
                  ? 'border-ink/25 bg-ink text-canvas'
                  : 'border-line text-muted hover:border-line-strong hover:text-ink',
              )}
            >
              {category.name}
              <span className="ml-1.5 opacity-50">{category.count ?? 0}</span>
            </Link>
          )
        })}
      </div>

      {/* attributes */}
      <div className="flex flex-wrap gap-1.5">
        {ATTRIBUTE_DEFS.map((attr) => {
          const active = query.attrs.includes(attr.key)
          return (
            <Link
              key={attr.key}
              href={buildHref(base, query, { attrs: toggleAttr(query.attrs, attr.key), page: 1 })}
              title={attr.hint}
              scroll={false}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs no-underline transition-colors',
                active
                  ? 'border-accent/40 bg-accent/10 text-accent'
                  : 'border-line text-muted hover:border-line-strong hover:text-ink',
              )}
            >
              {active && <Check className="h-3 w-3" />}
              {attr.label}
            </Link>
          )
        })}
      </div>

      {tags && tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 border-t border-line pt-4">
          {tags.map((tag) => {
            const active = query.tag === tag.slug
            return (
              <Link
                key={tag.id}
                href={buildHref(base, query, { tag: active ? undefined : tag.slug, page: 1 })}
                scroll={false}
                className={cn(
                  'rounded-md px-2 py-1 font-mono text-2xs no-underline transition-colors',
                  active ? 'bg-ink text-canvas' : 'bg-raised text-faint hover:text-ink',
                )}
              >
                #{tag.name}
                <span className="ml-1 opacity-50">{tag.uses}</span>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}

export function Pagination({
  base,
  query,
  page,
  pages,
}: {
  base: string
  query: BrowseQuery
  page: number
  pages: number
}) {
  if (pages <= 1) return null

  const windowSize = 2
  const numbers: (number | '…')[] = []
  for (let i = 1; i <= pages; i++) {
    if (i === 1 || i === pages || Math.abs(i - page) <= windowSize) numbers.push(i)
    else if (numbers[numbers.length - 1] !== '…') numbers.push('…')
  }

  return (
    <nav className="mt-12 flex items-center justify-center gap-1.5" aria-label="Pagination">
      <PageLink href={buildHref(base, query, { page: page - 1 })} disabled={page <= 1}>
        Previous
      </PageLink>
      <div className="mx-2 hidden items-center gap-1 sm:flex">
        {numbers.map((n, i) =>
          n === '…' ? (
            <span key={`gap-${i}`} className="px-1.5 text-sm text-faint">
              …
            </span>
          ) : (
            <Link
              key={n}
              href={buildHref(base, query, { page: n })}
              className={cn(
                'flex h-9 min-w-9 items-center justify-center rounded-lg px-2 font-mono text-xs no-underline transition-colors',
                n === page ? 'bg-ink text-canvas' : 'text-muted hover:bg-raised hover:text-ink',
              )}
              aria-current={n === page ? 'page' : undefined}
            >
              {n}
            </Link>
          ),
        )}
      </div>
      <span className="mx-2 font-mono text-xs text-faint sm:hidden">
        {page} / {pages}
      </span>
      <PageLink href={buildHref(base, query, { page: page + 1 })} disabled={page >= pages}>
        Next
      </PageLink>
    </nav>
  )
}

function PageLink({ href, disabled, children }: { href: string; disabled: boolean; children: React.ReactNode }) {
  if (disabled) {
    return (
      <span className="cursor-not-allowed rounded-lg border border-line px-3 py-2 text-sm text-faint opacity-45">
        {children}
      </span>
    )
  }
  return (
    <Link
      href={href}
      className="rounded-lg border border-line px-3 py-2 text-sm text-muted no-underline transition-colors hover:border-line-strong hover:text-ink"
    >
      {children}
    </Link>
  )
}

/** Normalise raw searchParams into a BrowseQuery. */
export function parseQuery(params: Record<string, string | string[] | undefined>): BrowseQuery {
  const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value)
  const many = (value: string | string[] | undefined) =>
    Array.isArray(value) ? value : value ? [value] : []

  const sortRaw = one(params.sort)
  const sort = SORTS.some((s) => s.key === sortRaw) ? (sortRaw as SortKey) : 'trending'
  const validAttrs = new Set(ATTRIBUTE_DEFS.map((a) => a.key as string))

  return {
    q: one(params.q)?.slice(0, 120) || undefined,
    category: one(params.category)?.slice(0, 40) || undefined,
    tag: one(params.tag)?.slice(0, 40) || undefined,
    sort,
    attrs: many(params.attr).filter((a) => validAttrs.has(a)),
    page: Math.max(1, Number(one(params.page) ?? 1) || 1),
  }
}
