'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { ArrowUp, Bookmark, Check, Copy, Flag, Loader2, Share2 } from 'lucide-react'
import { cn, formatNumber } from '@/lib/utils'
import { Button, buttonClass } from '@/components/ui/primitives'

async function post(url: string, body?: unknown) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error ?? 'Something went wrong')
  return data
}

// ------------------------------------------------------------------- vote --

export function VoteButton({
  slug,
  votes,
  voted,
  signedIn,
  size = 'md',
  className,
}: {
  slug: string
  votes: number
  voted?: boolean
  signedIn: boolean
  size?: 'sm' | 'md'
  className?: string
}) {
  const router = useRouter()
  const [state, setState] = React.useState({ votes, voted: Boolean(voted) })
  const [pending, startTransition] = React.useTransition()
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    setState({ votes, voted: Boolean(voted) })
  }, [votes, voted, slug])

  const onClick = () => {
    if (!signedIn) {
      router.push(`/login?next=${encodeURIComponent(`/site/${slug}`)}`)
      return
    }
    // optimistic
    const next = { votes: state.votes + (state.voted ? -1 : 1), voted: !state.voted }
    setState(next)
    setError(null)
    startTransition(async () => {
      try {
        const data = await post(`/api/sites/${slug}/vote`)
        setState({ votes: data.votes, voted: data.voted })
      } catch (err) {
        setState({ votes, voted: Boolean(voted) })
        setError(err instanceof Error ? err.message : 'Failed')
      }
    })
  }

  return (
    <button
      onClick={onClick}
      disabled={pending}
      title={state.voted ? 'Remove your upvote' : 'Upvote this site'}
      aria-pressed={state.voted}
      className={cn(
        'group inline-flex flex-col items-center justify-center rounded-xl border transition-all duration-200 active:scale-95',
        size === 'sm' ? 'h-11 w-10 gap-0' : 'h-14 w-12 gap-0.5',
        state.voted
          ? 'border-accent/40 bg-accent/10 text-accent'
          : 'border-line bg-surface text-muted hover:border-line-strong hover:text-ink',
        error && 'border-danger/40',
        className,
      )}
    >
      <ArrowUp
        className={cn(
          'transition-transform duration-200 group-hover:-translate-y-0.5',
          size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4',
          state.voted && 'translate-y-0',
        )}
        strokeWidth={2.25}
      />
      <span className={cn('font-mono tabular-nums', size === 'sm' ? 'text-2xs' : 'text-xs')}>
        {formatNumber(state.votes)}
      </span>
    </button>
  )
}

// ------------------------------------------------------------------- save --

export function SaveButton({
  slug,
  saved,
  signedIn,
  variant = 'icon',
  className,
}: {
  slug: string
  saved?: boolean
  signedIn: boolean
  variant?: 'icon' | 'full'
  className?: string
}) {
  const router = useRouter()
  const [isSaved, setSaved] = React.useState(Boolean(saved))
  const [pending, startTransition] = React.useTransition()

  React.useEffect(() => setSaved(Boolean(saved)), [saved, slug])

  const onClick = (event: React.MouseEvent) => {
    event.preventDefault()
    event.stopPropagation()
    if (!signedIn) {
      router.push(`/login?next=${encodeURIComponent(`/site/${slug}`)}`)
      return
    }
    setSaved((v) => !v)
    startTransition(async () => {
      try {
        const data = await post(`/api/sites/${slug}/save`)
        setSaved(data.saved)
        router.refresh()
      } catch {
        setSaved(Boolean(saved))
      }
    })
  }

  if (variant === 'full') {
    return (
      <Button variant={isSaved ? 'primary' : 'secondary'} onClick={onClick} disabled={pending} className={className}>
        <Bookmark className={cn('h-4 w-4', isSaved && 'fill-current')} />
        {isSaved ? 'Saved' : 'Save'}
      </Button>
    )
  }

  return (
    <button
      onClick={onClick}
      disabled={pending}
      title={isSaved ? 'Remove from saved' : 'Save for later'}
      aria-pressed={isSaved}
      className={cn(
        'inline-flex h-8 w-8 items-center justify-center rounded-lg border backdrop-blur transition-all active:scale-90',
        isSaved
          ? 'border-white/25 bg-black/55 text-white'
          : 'border-white/15 bg-black/35 text-white/75 hover:bg-black/60 hover:text-white',
        className,
      )}
    >
      <Bookmark className={cn('h-3.5 w-3.5', isSaved && 'fill-current')} />
    </button>
  )
}

// ------------------------------------------------------------------ share --

export function ShareButton({ url, title }: { url: string; title: string }) {
  const [copied, setCopied] = React.useState(false)

  const onClick = async () => {
    const shareData = { title, url }
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share(shareData)
        return
      } catch {
        /* user dismissed — fall through to copy */
      }
    }
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      /* clipboard blocked */
    }
  }

  return (
    <Button variant="secondary" onClick={onClick}>
      {copied ? <Check className="h-4 w-4 text-positive" /> : <Share2 className="h-4 w-4" />}
      {copied ? 'Link copied' : 'Share'}
    </Button>
  )
}

export function CopyField({ value, label }: { value: string; label?: string }) {
  const [copied, setCopied] = React.useState(false)
  return (
    <button
      onClick={async () => {
        await navigator.clipboard.writeText(value)
        setCopied(true)
        setTimeout(() => setCopied(false), 1600)
      }}
      className="group flex w-full items-center justify-between gap-3 rounded-xl border border-line bg-raised px-3 py-2 text-left font-mono text-xs text-muted transition-colors hover:border-line-strong hover:text-ink"
    >
      <span className="truncate">{label ?? value}</span>
      {copied ? <Check className="h-3.5 w-3.5 shrink-0 text-positive" /> : <Copy className="h-3.5 w-3.5 shrink-0" />}
    </button>
  )
}

// ----------------------------------------------------------------- report --

const REPORT_REASONS = [
  { value: 'broken', label: 'The link is broken or the site is gone' },
  { value: 'wrong-info', label: 'Wrong title, description or category' },
  { value: 'spam', label: 'Spam, scam or SEO filler' },
  { value: 'adult', label: 'Adult or unsafe content' },
  { value: 'duplicate', label: 'Already listed under another entry' },
  { value: 'owner-request', label: 'I own this site and want it removed' },
]

export function ReportButton({ slug }: { slug: string }) {
  const [open, setOpen] = React.useState(false)
  const [reason, setReason] = React.useState(REPORT_REASONS[0].value)
  const [detail, setDetail] = React.useState('')
  const [status, setStatus] = React.useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [message, setMessage] = React.useState('')

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setStatus('sending')
    try {
      await post(`/api/sites/${slug}/report`, { reason, detail })
      setStatus('sent')
    } catch (err) {
      setStatus('error')
      setMessage(err instanceof Error ? err.message : 'Could not send that report')
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 text-xs text-faint transition-colors hover:text-danger"
      >
        <Flag className="h-3 w-3" />
        Report a problem
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 backdrop-blur-sm sm:items-center"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-md animate-scale-in rounded-2xl border border-line bg-surface p-6 shadow-lift"
            onClick={(e) => e.stopPropagation()}
          >
            {status === 'sent' ? (
              <div className="text-center">
                <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-positive/10 text-positive">
                  <Check className="h-5 w-5" />
                </div>
                <p className="font-display text-xl">Thank you</p>
                <p className="mt-2 text-sm text-muted">
                  An editor will look at this. Reports about broken links are usually actioned within a day.
                </p>
                <Button className="mt-5 w-full" variant="secondary" onClick={() => setOpen(false)}>
                  Close
                </Button>
              </div>
            ) : (
              <form onSubmit={submit}>
                <h2 className="font-display text-xl">Report a problem</h2>
                <p className="mt-1 text-sm text-muted">
                  web-amble is maintained by hand. Telling us what is wrong genuinely helps.
                </p>

                <fieldset className="mt-5 space-y-2">
                  {REPORT_REASONS.map((option) => (
                    <label
                      key={option.value}
                      className={cn(
                        'flex cursor-pointer items-start gap-3 rounded-xl border px-3 py-2.5 text-sm transition-colors',
                        reason === option.value
                          ? 'border-ink/30 bg-raised text-ink'
                          : 'border-line text-muted hover:border-line-strong',
                      )}
                    >
                      <input
                        type="radio"
                        name="reason"
                        value={option.value}
                        checked={reason === option.value}
                        onChange={() => setReason(option.value)}
                        className="mt-0.5 accent-current"
                      />
                      {option.label}
                    </label>
                  ))}
                </fieldset>

                <textarea
                  value={detail}
                  onChange={(e) => setDetail(e.target.value.slice(0, 500))}
                  placeholder="Anything else we should know? (optional)"
                  rows={3}
                  className="mt-4 w-full resize-none rounded-xl border border-line bg-canvas px-3 py-2 text-sm outline-none placeholder:text-faint focus:border-line-strong"
                />

                {status === 'error' && <p className="mt-3 text-sm text-danger">{message}</p>}

                <div className="mt-5 flex gap-2">
                  <Button type="button" variant="ghost" className="flex-1" onClick={() => setOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" variant="primary" className="flex-1" disabled={status === 'sending'}>
                    {status === 'sending' && <Loader2 className="h-4 w-4 animate-spin" />}
                    Send report
                  </Button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  )
}

// ------------------------------------------------------------ visit + log --

export function VisitLink({
  slug,
  url,
  children,
  className,
  variant = 'primary',
}: {
  slug: string
  url: string
  children: React.ReactNode
  className?: string
  variant?: 'primary' | 'secondary'
}) {
  return (
    <a
      href={`/go/${slug}`}
      target="_blank"
      rel="noopener noreferrer"
      data-external={url}
      className={buttonClass(variant, 'lg', className)}
    >
      {children}
    </a>
  )
}
