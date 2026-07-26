'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Activity,
  Flag,
  Gauge,
  Globe2,
  Inbox,
  Layers,
  Radar,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const ITEMS = [
  { href: '/admin', label: 'Overview', icon: Gauge, exact: true },
  { href: '/admin/queue', label: 'Review queue', icon: Inbox, badge: 'pending' as const },
  { href: '/admin/sites', label: 'All sites', icon: Globe2 },
  { href: '/admin/collections', label: 'Collections', icon: Layers },
  { href: '/admin/sources', label: 'Discovery', icon: Radar },
  { href: '/admin/jobs', label: 'Jobs', icon: Activity, badge: 'failed' as const },
  { href: '/admin/reports', label: 'Reports', icon: Flag, badge: 'reports' as const },
]

export function AdminNav({
  pending,
  reports,
  failed,
}: {
  pending: number
  reports: number
  failed: number
}) {
  const pathname = usePathname()
  const counts = { pending, reports, failed }

  return (
    <nav className="no-scrollbar -mx-1 flex gap-1 overflow-x-auto px-1 lg:sticky lg:top-24 lg:mx-0 lg:h-fit lg:flex-col lg:overflow-visible lg:px-0">
      {ITEMS.map((item) => {
        const active = item.exact ? pathname === item.href : pathname.startsWith(item.href)
        const Icon = item.icon
        const count = item.badge ? counts[item.badge] : 0
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'flex shrink-0 items-center gap-2.5 rounded-xl px-3 py-2 text-sm no-underline transition-colors',
              active ? 'bg-raised text-ink' : 'text-muted hover:bg-raised/60 hover:text-ink',
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            <span className="flex-1 whitespace-nowrap">{item.label}</span>
            {count > 0 && (
              <span
                className={cn(
                  'rounded-full px-1.5 py-0.5 font-mono text-2xs',
                  item.badge === 'failed' ? 'bg-danger/15 text-danger' : 'bg-accent/15 text-accent',
                )}
              >
                {count}
              </span>
            )}
          </Link>
        )
      })}
    </nav>
  )
}
