'use client'

import * as React from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * A storefront shelf: horizontally scrolling, snap-aligned, with arrows that
 * only appear when there is somewhere to go.
 */
export function Shelf({ children, className }: { children: React.ReactNode; className?: string }) {
  const ref = React.useRef<HTMLDivElement>(null)
  const [edges, setEdges] = React.useState({ start: true, end: false })

  const measure = React.useCallback(() => {
    const el = ref.current
    if (!el) return
    const start = el.scrollLeft <= 4
    const end = el.scrollLeft + el.clientWidth >= el.scrollWidth - 4
    setEdges((prev) => (prev.start === start && prev.end === end ? prev : { start, end }))
  }, [])

  React.useEffect(() => {
    measure()
    const el = ref.current
    if (!el) return
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [measure])

  const scrollBy = (direction: 1 | -1) => {
    const el = ref.current
    if (!el) return
    el.scrollBy({ left: direction * Math.max(280, el.clientWidth * 0.8), behavior: 'smooth' })
  }

  return (
    <div className={cn('group/shelf relative', className)}>
      <div ref={ref} onScroll={measure} className="rail -mx-5 scroll-px-5 px-5 sm:-mx-8 sm:scroll-px-8 sm:px-8">
        {children}
      </div>

      <ShelfArrow side="left" hidden={edges.start} onClick={() => scrollBy(-1)} />
      <ShelfArrow side="right" hidden={edges.end} onClick={() => scrollBy(1)} />
    </div>
  )
}

function ShelfArrow({
  side,
  hidden,
  onClick,
}: {
  side: 'left' | 'right'
  hidden: boolean
  onClick: () => void
}) {
  const Icon = side === 'left' ? ChevronLeft : ChevronRight
  return (
    <button
      onClick={onClick}
      aria-label={side === 'left' ? 'Scroll left' : 'Scroll right'}
      tabIndex={hidden ? -1 : 0}
      className={cn(
        'absolute top-1/2 z-20 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full',
        'border border-line-strong bg-surface/90 text-ink shadow-card backdrop-blur',
        'transition-all duration-200 hover:scale-105 hover:bg-surface md:flex',
        side === 'left' ? '-left-3' : '-right-3',
        hidden
          ? 'pointer-events-none opacity-0'
          : 'opacity-0 group-hover/shelf:opacity-100 focus-visible:opacity-100',
      )}
    >
      <Icon className="h-4 w-4" />
    </button>
  )
}
