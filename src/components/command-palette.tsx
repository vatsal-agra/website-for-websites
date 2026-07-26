'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowRight,
  Compass,
  CornerDownLeft,
  Layers,
  Loader2,
  Search,
  Shuffle,
  SquarePlus,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface Hit {
  slug: string
  title: string
  tagline: string
  domain: string
  category: string | null
  hue: number
}

interface QuickAction {
  label: string
  href: string
  hint: string
  icon: typeof Compass
}

const QUICK_ACTIONS: QuickAction[] = [
  { label: 'Browse everything', href: '/browse', hint: 'The full catalogue', icon: Compass },
  { label: 'Take me somewhere', href: '/shuffle', hint: 'A site at random', icon: Shuffle },
  { label: 'Collections', href: '/collections', hint: 'Curated shelves', icon: Layers },
  { label: 'Submit a site', href: '/submit', hint: 'Add to the catalogue', icon: SquarePlus },
]

export function CommandPalette() {
  const router = useRouter()
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState('')
  const [hits, setHits] = React.useState<Hit[]>([])
  const [loading, setLoading] = React.useState(false)
  const [cursor, setCursor] = React.useState(0)
  const inputRef = React.useRef<HTMLInputElement>(null)

  // ⌘K / Ctrl-K anywhere, and "/" when not typing in a field
  React.useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      const typing =
        target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)

      if ((event.key === 'k' || event.key === 'K') && (event.metaKey || event.ctrlKey)) {
        event.preventDefault()
        setOpen((v) => !v)
      } else if (event.key === '/' && !typing && !open) {
        event.preventDefault()
        setOpen(true)
      } else if (event.key === 'Escape' && open) {
        setOpen(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  React.useEffect(() => {
    if (open) {
      setCursor(0)
      const id = requestAnimationFrame(() => inputRef.current?.focus())
      document.body.style.overflow = 'hidden'
      return () => {
        cancelAnimationFrame(id)
        document.body.style.overflow = ''
      }
    }
  }, [open])

  // debounced search
  React.useEffect(() => {
    if (!open) return
    const term = query.trim()
    if (term.length < 2) {
      setHits([])
      setLoading(false)
      return
    }
    setLoading(true)
    const controller = new AbortController()
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(term)}&limit=8`, {
          signal: controller.signal,
        })
        const data = await res.json()
        setHits(data.results ?? [])
        setCursor(0)
      } catch {
        /* aborted */
      } finally {
        setLoading(false)
      }
    }, 160)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [query, open])

  const showingActions = query.trim().length < 2
  const items: { href: string; key: string }[] = showingActions
    ? QUICK_ACTIONS.map((a) => ({ href: a.href, key: a.href }))
    : [
        ...hits.map((h) => ({ href: `/site/${h.slug}`, key: h.slug })),
        { href: `/search?q=${encodeURIComponent(query.trim())}`, key: '__all' },
      ]

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setCursor((c) => (c + 1) % Math.max(1, items.length))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setCursor((c) => (c - 1 + items.length) % Math.max(1, items.length))
    } else if (event.key === 'Enter') {
      event.preventDefault()
      const target = items[cursor]
      if (target) {
        setOpen(false)
        router.push(target.href)
      }
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="group flex h-9 items-center gap-2 rounded-full border border-line bg-surface pl-3 pr-2 text-sm text-faint transition-colors hover:border-line-strong hover:text-muted md:w-56 lg:w-72"
        aria-label="Search Portico"
      >
        <Search className="h-3.5 w-3.5 shrink-0" />
        <span className="hidden min-w-0 flex-1 truncate whitespace-nowrap text-left md:inline">
          Search the catalogue…
        </span>
        <kbd className="hidden shrink-0 rounded border border-line px-1.5 py-0.5 font-mono text-2xs text-faint md:inline">
          ⌘K
        </kbd>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[60] flex items-start justify-center bg-black/45 px-4 pt-[10vh] backdrop-blur-sm"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-2xl animate-scale-in overflow-hidden rounded-2xl border border-line-strong bg-surface shadow-lift"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Search"
          >
            <div className="flex items-center gap-3 border-b border-line px-4">
              {loading ? (
                <Loader2 className="h-4 w-4 shrink-0 animate-spin text-faint" />
              ) : (
                <Search className="h-4 w-4 shrink-0 text-faint" />
              )}
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder="Search 40,000 corners of the web…"
                className="h-14 flex-1 bg-transparent text-base outline-none placeholder:text-faint"
                autoComplete="off"
                spellCheck={false}
              />
              <kbd className="hidden rounded border border-line px-1.5 py-0.5 font-mono text-2xs text-faint sm:inline">
                esc
              </kbd>
            </div>

            <div className="max-h-[52vh] overflow-y-auto p-2">
              {showingActions ? (
                <>
                  <p className="px-3 py-2 font-mono text-2xs uppercase tracking-[0.14em] text-faint">Go to</p>
                  {QUICK_ACTIONS.map((action, i) => {
                    const Icon = action.icon
                    return (
                      <Link
                        key={action.href}
                        href={action.href}
                        onClick={() => setOpen(false)}
                        onMouseEnter={() => setCursor(i)}
                        className={cn(
                          'flex items-center gap-3 rounded-xl px-3 py-2.5 no-underline transition-colors',
                          cursor === i ? 'bg-raised' : 'hover:bg-raised/60',
                        )}
                      >
                        <Icon className="h-4 w-4 shrink-0 text-muted" />
                        <span className="flex-1 text-sm">{action.label}</span>
                        <span className="font-mono text-2xs text-faint">{action.hint}</span>
                      </Link>
                    )
                  })}
                </>
              ) : hits.length === 0 && !loading ? (
                <div className="px-3 py-10 text-center">
                  <p className="text-sm text-muted">Nothing matched “{query.trim()}”.</p>
                  <Link
                    href={`/submit?url=${encodeURIComponent(query.trim())}`}
                    onClick={() => setOpen(false)}
                    className="mt-3 inline-block text-sm text-accent no-underline hover:underline"
                  >
                    Know a site we are missing? Submit it →
                  </Link>
                </div>
              ) : (
                <>
                  {hits.map((hit, i) => (
                    <Link
                      key={hit.slug}
                      href={`/site/${hit.slug}`}
                      onClick={() => setOpen(false)}
                      onMouseEnter={() => setCursor(i)}
                      className={cn(
                        'flex items-center gap-3 rounded-xl px-3 py-2.5 no-underline transition-colors',
                        cursor === i ? 'bg-raised' : 'hover:bg-raised/60',
                      )}
                    >
                      <span
                        className="h-8 w-8 shrink-0 rounded-lg"
                        style={{
                          background: `linear-gradient(135deg, hsl(${hit.hue} 70% 58%), hsl(${(hit.hue + 50) % 360} 62% 42%))`,
                        }}
                        aria-hidden="true"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm">{hit.title}</span>
                        <span className="block truncate text-xs text-faint">{hit.tagline || hit.domain}</span>
                      </span>
                      {hit.category && (
                        <span className="hidden shrink-0 font-mono text-2xs uppercase tracking-wider text-faint sm:inline">
                          {hit.category}
                        </span>
                      )}
                    </Link>
                  ))}

                  <Link
                    href={`/search?q=${encodeURIComponent(query.trim())}`}
                    onClick={() => setOpen(false)}
                    onMouseEnter={() => setCursor(hits.length)}
                    className={cn(
                      'mt-1 flex items-center gap-3 rounded-xl border-t border-line px-3 py-3 no-underline transition-colors',
                      cursor === hits.length ? 'bg-raised' : 'hover:bg-raised/60',
                    )}
                  >
                    <ArrowRight className="h-4 w-4 shrink-0 text-muted" />
                    <span className="flex-1 text-sm">
                      See all results for <span className="font-medium">{query.trim()}</span>
                    </span>
                    <CornerDownLeft className="h-3.5 w-3.5 text-faint" />
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
