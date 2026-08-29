'use client'

import * as React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Bookmark, LayoutGrid, LogOut, Menu, Plus, Shuffle, User as UserIcon, X } from 'lucide-react'
import type { PublicUser } from '@/lib/types'
import { cn } from '@/lib/utils'
import { CommandPalette } from './command-palette'
import { ThemeToggle } from './theme-toggle'
import { Wordmark } from './wordmark'

const NAV = [
  { href: '/', label: 'Discover', exact: true },
  { href: '/browse', label: 'Browse' },
  { href: '/collections', label: 'Collections' },
  { href: '/categories', label: 'Categories' },
]

export function Header({ user, pendingCount = 0 }: { user: PublicUser | null; pendingCount?: number }) {
  const pathname = usePathname()
  const [menuOpen, setMenuOpen] = React.useState(false)
  const [accountOpen, setAccountOpen] = React.useState(false)
  const [scrolled, setScrolled] = React.useState(false)
  const accountRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    setMenuOpen(false)
    setAccountOpen(false)
  }, [pathname])

  React.useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  React.useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (accountRef.current && !accountRef.current.contains(event.target as Node)) setAccountOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  const isActive = (item: (typeof NAV)[number]) =>
    item.exact ? pathname === item.href : pathname.startsWith(item.href)

  return (
    <header
      className={cn(
        'sticky top-0 z-50 border-b transition-all duration-300',
        scrolled ? 'border-line bg-canvas/85 backdrop-blur-xl' : 'border-transparent bg-canvas',
      )}
    >
      <div className="shell flex h-16 items-center gap-3">
        <Link href="/" className="shrink-0 no-underline" aria-label="web-amble — home">
          <Wordmark />
        </Link>

        <nav className="ml-4 hidden items-center gap-1 lg:flex" aria-label="Primary">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'rounded-full px-3 py-1.5 text-sm no-underline transition-colors',
                isActive(item) ? 'bg-raised text-ink' : 'text-muted hover:text-ink',
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex-1" />

        <div className="hidden md:block">
          <CommandPalette />
        </div>

        <Link
          href="/shuffle"
          title="Take me somewhere unexpected"
          className="hidden h-9 w-9 items-center justify-center rounded-full border border-line text-muted no-underline transition-colors hover:border-line-strong hover:text-ink sm:flex"
        >
          <Shuffle className="h-4 w-4" />
        </Link>

        <Link
          href="/submit"
          className="hidden h-9 items-center gap-1.5 rounded-full bg-ink px-4 text-sm font-medium text-canvas no-underline transition-opacity hover:opacity-90 sm:inline-flex"
        >
          <Plus className="h-3.5 w-3.5" />
          Submit
        </Link>

        {/* account */}
        <div className="relative hidden sm:block" ref={accountRef}>
          {user ? (
            <>
              <button
                onClick={() => setAccountOpen((v) => !v)}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-line bg-surface font-mono text-xs uppercase text-muted transition-colors hover:border-line-strong hover:text-ink"
                aria-haspopup="menu"
                aria-expanded={accountOpen}
                aria-label="Account menu"
              >
                {user.username.slice(0, 2)}
              </button>
              {accountOpen && (
                <div
                  role="menu"
                  className="absolute right-0 top-11 w-56 animate-scale-in overflow-hidden rounded-xl border border-line bg-surface p-1 shadow-lift"
                >
                  <div className="px-3 py-2.5">
                    <p className="truncate text-sm font-medium">{user.display_name || user.username}</p>
                    <p className="truncate font-mono text-2xs text-faint">@{user.username}</p>
                  </div>
                  <div className="my-1 border-t border-line" />
                  <MenuLink href={`/u/${user.username}`} icon={UserIcon}>
                    Your profile
                  </MenuLink>
                  <MenuLink href="/saved" icon={Bookmark}>
                    Saved sites
                  </MenuLink>
                  {user.role === 'admin' && (
                    <MenuLink href="/admin" icon={LayoutGrid} badge={pendingCount || undefined}>
                      Admin
                    </MenuLink>
                  )}
                  <div className="my-1 border-t border-line" />
                  <form action="/api/auth/logout" method="post">
                    <button
                      type="submit"
                      className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm text-muted transition-colors hover:bg-raised hover:text-ink"
                    >
                      <LogOut className="h-3.5 w-3.5" />
                      Sign out
                    </button>
                  </form>
                </div>
              )}
            </>
          ) : (
            <Link
              href="/login"
              className="flex h-9 items-center rounded-full border border-line px-4 text-sm text-muted no-underline transition-colors hover:border-line-strong hover:text-ink"
            >
              Sign in
            </Link>
          )}
        </div>

        <button
          onClick={() => setMenuOpen((v) => !v)}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-line text-muted lg:hidden"
          aria-label="Menu"
          aria-expanded={menuOpen}
        >
          {menuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        </button>
      </div>

      {menuOpen && (
        <div className="animate-fade-in border-t border-line bg-canvas lg:hidden">
          <div className="shell space-y-1 py-4">
            <div className="pb-3 md:hidden">
              <CommandPalette />
            </div>
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'block rounded-lg px-3 py-2.5 text-sm no-underline transition-colors',
                  isActive(item) ? 'bg-raised text-ink' : 'text-muted hover:bg-raised hover:text-ink',
                )}
              >
                {item.label}
              </Link>
            ))}
            <Link href="/shuffle" className="block rounded-lg px-3 py-2.5 text-sm text-muted no-underline hover:bg-raised">
              Shuffle
            </Link>
            <Link href="/submit" className="block rounded-lg px-3 py-2.5 text-sm text-muted no-underline hover:bg-raised">
              Submit a site
            </Link>
            <div className="border-t border-line pt-3">
              {user ? (
                <>
                  <Link href={`/u/${user.username}`} className="block rounded-lg px-3 py-2.5 text-sm no-underline hover:bg-raised">
                    @{user.username}
                  </Link>
                  <Link href="/saved" className="block rounded-lg px-3 py-2.5 text-sm text-muted no-underline hover:bg-raised">
                    Saved sites
                  </Link>
                  {user.role === 'admin' && (
                    <Link href="/admin" className="block rounded-lg px-3 py-2.5 text-sm text-muted no-underline hover:bg-raised">
                      Admin
                    </Link>
                  )}
                  <form action="/api/auth/logout" method="post">
                    <button type="submit" className="w-full rounded-lg px-3 py-2.5 text-left text-sm text-muted hover:bg-raised">
                      Sign out
                    </button>
                  </form>
                </>
              ) : (
                <Link href="/login" className="block rounded-lg px-3 py-2.5 text-sm no-underline hover:bg-raised">
                  Sign in
                </Link>
              )}
            </div>
            <div className="pt-3">
              <ThemeToggle />
            </div>
          </div>
        </div>
      )}
    </header>
  )
}

function MenuLink({
  href,
  icon: Icon,
  children,
  badge,
}: {
  href: string
  icon: typeof UserIcon
  children: React.ReactNode
  badge?: number
}) {
  return (
    <Link
      href={href}
      role="menuitem"
      className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-muted no-underline transition-colors hover:bg-raised hover:text-ink"
    >
      <Icon className="h-3.5 w-3.5" />
      <span className="flex-1">{children}</span>
      {badge ? (
        <span className="rounded-full bg-accent/15 px-1.5 py-0.5 font-mono text-2xs text-accent">{badge}</span>
      ) : null}
    </Link>
  )
}
