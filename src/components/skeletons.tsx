import { cn } from '@/lib/utils'

/**
 * Loading placeholders for streamed sections.
 *
 * These deliberately match the real components' dimensions, so a shelf arriving
 * does not shove the rest of the page around. That matters more than the
 * shimmer: layout shift is what makes a streaming page feel broken.
 */

function Shimmer({ className }: { className?: string }) {
  return (
    <div className={cn('relative overflow-hidden rounded-lg bg-raised', className)}>
      <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-line-strong/25 to-transparent" />
    </div>
  )
}

export function CardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('overflow-hidden rounded-2xl border border-line bg-surface', className)}>
      <Shimmer className="aspect-[16/10] rounded-none" />
      <div className="space-y-3 p-4">
        <div className="flex items-center gap-3">
          <Shimmer className="h-8 w-8 shrink-0 rounded-lg" />
          <div className="flex-1 space-y-1.5">
            <Shimmer className="h-3.5 w-1/2" />
            <Shimmer className="h-2.5 w-1/3" />
          </div>
        </div>
        <Shimmer className="h-3 w-full" />
        <Shimmer className="h-3 w-4/5" />
      </div>
    </div>
  )
}

/** A horizontal rail of card placeholders, matching <Shelf>. */
export function ShelfSkeleton({ title, eyebrow }: { title?: string; eyebrow?: string }) {
  return (
    <section className="shell pb-16" aria-busy="true">
      <div className="mb-6">
        {eyebrow ? <p className="eyebrow mb-2">{eyebrow}</p> : <Shimmer className="mb-2 h-3 w-24" />}
        {title ? (
          <h2 className="font-display text-2xl leading-tight tracking-tight sm:text-3xl">{title}</h2>
        ) : (
          <Shimmer className="h-8 w-64" />
        )}
      </div>
      <div className="flex gap-4 overflow-hidden">
        {Array.from({ length: 5 }).map((_, i) => (
          <CardSkeleton key={i} className="w-[19rem] shrink-0 sm:w-[21rem]" />
        ))}
      </div>
    </section>
  )
}

export function FeatureSkeleton() {
  return (
    <section className="shell pb-16" aria-busy="true">
      <div className="overflow-hidden rounded-3xl border border-line bg-surface">
        <div className="grid lg:grid-cols-[1.15fr_1fr]">
          <Shimmer className="aspect-[16/10] rounded-none lg:aspect-auto lg:min-h-[26rem]" />
          <div className="space-y-4 p-6 sm:p-9">
            <Shimmer className="h-3 w-28" />
            <Shimmer className="h-10 w-3/4" />
            <Shimmer className="h-3 w-40" />
            <Shimmer className="h-3 w-full" />
            <Shimmer className="h-3 w-5/6" />
            <div className="flex gap-3 pt-3">
              <Shimmer className="h-12 w-32 rounded-xl" />
              <Shimmer className="h-12 w-28 rounded-xl" />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

export function GridSkeleton({
  count = 6,
  columns = 'sm:grid-cols-2 lg:grid-cols-3',
}: {
  count?: number
  columns?: string
}) {
  return (
    <div className={cn('grid gap-4', columns)} aria-busy="true">
      {Array.from({ length: count }).map((_, i) => (
        <CardSkeleton key={i} />
      ))}
    </div>
  )
}

/** Inline placeholder for a number that is still being counted. */
export function CountSkeleton({ width = 'w-10' }: { width?: string }) {
  return <Shimmer className={cn('inline-block h-3 align-middle', width)} />
}
