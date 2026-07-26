import * as React from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'

// ------------------------------------------------------------------ button --

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'quiet' | 'danger'
type ButtonSize = 'sm' | 'md' | 'lg'

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    'bg-ink text-canvas hover:bg-ink/90 border border-transparent shadow-sm',
  secondary:
    'bg-surface text-ink border border-line-strong hover:border-ink/40 hover:bg-raised',
  ghost: 'bg-transparent text-ink-soft border border-transparent hover:bg-raised hover:text-ink',
  quiet: 'bg-raised text-ink-soft border border-line hover:text-ink hover:border-line-strong',
  danger: 'bg-transparent text-danger border border-danger/30 hover:bg-danger/10',
}

const SIZES: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-xs gap-1.5 rounded-lg',
  md: 'h-10 px-4 text-sm gap-2 rounded-xl',
  lg: 'h-12 px-6 text-[0.95rem] gap-2.5 rounded-xl',
}

const BUTTON_BASE =
  'inline-flex items-center justify-center font-medium no-underline transition-all duration-200 ease-out ' +
  'disabled:pointer-events-none disabled:opacity-45 active:scale-[0.98] whitespace-nowrap'

export function buttonClass(variant: ButtonVariant = 'secondary', size: ButtonSize = 'md', extra?: string) {
  return cn(BUTTON_BASE, VARIANTS[variant], SIZES[size], extra)
}

export const Button = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: ButtonSize }
>(function Button({ className, variant = 'secondary', size = 'md', ...props }, ref) {
  return <button ref={ref} className={buttonClass(variant, size, className)} {...props} />
})

export function ButtonLink({
  className,
  variant = 'secondary',
  size = 'md',
  href,
  external,
  ...props
}: React.AnchorHTMLAttributes<HTMLAnchorElement> & {
  variant?: ButtonVariant
  size?: ButtonSize
  href: string
  external?: boolean
}) {
  if (external) {
    return <a href={href} className={buttonClass(variant, size, className)} {...props} />
  }
  return <Link href={href} className={buttonClass(variant, size, className)} {...props} />
}

// -------------------------------------------------------------------- chip --

export function Chip({
  children,
  className,
  active,
  hue,
  as = 'span',
  ...props
}: {
  children: React.ReactNode
  className?: string
  active?: boolean
  hue?: number
  as?: 'span' | 'div'
} & React.HTMLAttributes<HTMLElement>) {
  const Comp = as as any
  return (
    <Comp
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-2xs uppercase tracking-[0.1em] transition-colors',
        active
          ? 'border-ink/25 bg-ink text-canvas'
          : 'border-line bg-surface text-muted hover:border-line-strong hover:text-ink',
        className,
      )}
      style={hue !== undefined && !active ? { color: `hsl(${hue} 55% 52%)`, borderColor: `hsl(${hue} 45% 52% / 0.3)` } : undefined}
      {...props}
    >
      {children}
    </Comp>
  )
}

export function ChipLink({
  href,
  children,
  active,
  hue,
  className,
}: {
  href: string
  children: React.ReactNode
  active?: boolean
  hue?: number
  className?: string
}) {
  return (
    <Link href={href} className="no-underline">
      <Chip active={active} hue={hue} className={className}>
        {children}
      </Chip>
    </Link>
  )
}

// ----------------------------------------------------------------- section --

export function SectionHeader({
  eyebrow,
  title,
  description,
  action,
  className,
}: {
  eyebrow?: string
  title: React.ReactNode
  description?: React.ReactNode
  action?: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('mb-6 flex items-end justify-between gap-6', className)}>
      <div className="min-w-0">
        {eyebrow && <p className="eyebrow mb-2">{eyebrow}</p>}
        <h2 className="font-display text-2xl leading-tight tracking-tight sm:text-3xl">{title}</h2>
        {description && <p className="mt-2 max-w-prose text-sm leading-relaxed text-muted">{description}</p>}
      </div>
      {action && <div className="shrink-0 pb-1">{action}</div>}
    </div>
  )
}

// ------------------------------------------------------------------- misc --

export function Divider({ className }: { className?: string }) {
  return <hr className={cn('border-t border-line', className)} />
}

export function EmptyState({
  title,
  description,
  action,
  icon,
}: {
  title: string
  description?: string
  action?: React.ReactNode
  icon?: React.ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-line px-6 py-16 text-center">
      {icon && <div className="mb-4 text-faint">{icon}</div>}
      <p className="font-display text-xl">{title}</p>
      {description && <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted">{description}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  )
}

export function Badge({
  children,
  tone = 'neutral',
  className,
}: {
  children: React.ReactNode
  tone?: 'neutral' | 'positive' | 'warning' | 'danger' | 'accent'
  className?: string
}) {
  const tones = {
    neutral: 'bg-raised text-muted border-line',
    positive: 'bg-positive/10 text-positive border-positive/25',
    warning: 'bg-warning/10 text-warning border-warning/25',
    danger: 'bg-danger/10 text-danger border-danger/25',
    accent: 'bg-accent/10 text-accent border-accent/25',
  }
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 font-mono text-2xs uppercase tracking-wider',
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}

export function Stat({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <div>
      <p className="eyebrow">{label}</p>
      <p className="mt-1 font-display text-2xl leading-none">{value}</p>
      {hint && <p className="mt-1 text-xs text-faint">{hint}</p>}
    </div>
  )
}

export function Prose({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'max-w-prose space-y-4 text-[0.95rem] leading-[1.75] text-ink-soft',
        '[&_h2]:mt-10 [&_h2]:font-display [&_h2]:text-2xl [&_h2]:text-ink',
        '[&_h3]:mt-8 [&_h3]:font-medium [&_h3]:text-ink',
        '[&_a]:text-ink [&_a]:decoration-line-strong hover:[&_a]:decoration-ink',
        '[&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-5',
        '[&_ol]:list-decimal [&_ol]:space-y-2 [&_ol]:pl-5',
        '[&_code]:rounded [&_code]:bg-raised [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[0.85em]',
        '[&_strong]:font-medium [&_strong]:text-ink',
        className,
      )}
    >
      {children}
    </div>
  )
}
