'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Check, Layers, Loader2, Plus } from 'lucide-react'
import { Button } from '@/components/ui/primitives'
import { cn } from '@/lib/utils'

interface Row {
  id: number
  slug: string
  title: string
  count: number
  contains: boolean
  isPublic: boolean
}

export function AddToCollection({ slug, signedIn }: { slug: string; signedIn: boolean }) {
  const router = useRouter()
  const [open, setOpen] = React.useState(false)
  const [rows, setRows] = React.useState<Row[] | null>(null)
  const [busy, setBusy] = React.useState<number | 'new' | null>(null)
  const [newTitle, setNewTitle] = React.useState('')
  const [error, setError] = React.useState<string | null>(null)
  const panelRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    if (!open) return
    let cancelled = false
    fetch(`/api/collections?site=${encodeURIComponent(slug)}`)
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) setRows(data.collections ?? [])
      })
      .catch(() => !cancelled && setError('Could not load your collections.'))
    return () => {
      cancelled = true
    }
  }, [open, slug])

  React.useEffect(() => {
    if (!open) return
    const onClick = (event: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) setOpen(false)
    }
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const toggle = async (row: Row) => {
    setBusy(row.id)
    setError(null)
    try {
      const res = await fetch('/api/collections', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'toggle', collectionId: row.id, site: slug }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setRows((prev) =>
        prev
          ? prev.map((r) =>
              r.id === row.id ? { ...r, contains: data.contains, count: r.count + (data.contains ? 1 : -1) } : r,
            )
          : prev,
      )
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That did not work.')
    } finally {
      setBusy(null)
    }
  }

  const create = async (event: React.FormEvent) => {
    event.preventDefault()
    const title = newTitle.trim()
    if (title.length < 3) return
    setBusy('new')
    setError(null)
    try {
      const res = await fetch('/api/collections', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'create', title, site: slug }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setRows((prev) => [data.collection, ...(prev ?? [])])
      setNewTitle('')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create that.')
    } finally {
      setBusy(null)
    }
  }

  if (!signedIn) {
    return (
      <Button
        variant="secondary"
        onClick={() => router.push(`/login?next=${encodeURIComponent(`/site/${slug}`)}`)}
      >
        <Layers className="h-4 w-4" />
        Collect
      </Button>
    )
  }

  return (
    <div className="relative" ref={panelRef}>
      <Button variant={open ? 'primary' : 'secondary'} onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <Layers className="h-4 w-4" />
        Collect
      </Button>

      {open && (
        <div className="absolute left-0 top-12 z-40 w-72 animate-scale-in overflow-hidden rounded-xl border border-line bg-surface shadow-lift">
          <p className="border-b border-line px-3 py-2.5 font-mono text-2xs uppercase tracking-[0.14em] text-faint">
            Add to a collection
          </p>

          <div className="max-h-56 overflow-y-auto p-1">
            {rows === null ? (
              <p className="flex items-center gap-2 px-3 py-4 text-sm text-muted">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Loading…
              </p>
            ) : rows.length === 0 ? (
              <p className="px-3 py-4 text-sm leading-relaxed text-muted">
                You have no collections yet. Make one below.
              </p>
            ) : (
              rows.map((row) => (
                <button
                  key={row.id}
                  onClick={() => toggle(row)}
                  disabled={busy === row.id}
                  className={cn(
                    'flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition-colors',
                    row.contains ? 'text-ink' : 'text-muted hover:bg-raised hover:text-ink',
                  )}
                >
                  <span
                    className={cn(
                      'flex h-4 w-4 shrink-0 items-center justify-center rounded border',
                      row.contains ? 'border-accent bg-accent text-accent-ink' : 'border-line-strong',
                    )}
                  >
                    {busy === row.id ? (
                      <Loader2 className="h-2.5 w-2.5 animate-spin" />
                    ) : row.contains ? (
                      <Check className="h-3 w-3" />
                    ) : null}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{row.title}</span>
                  <span className="shrink-0 font-mono text-2xs text-faint">{row.count}</span>
                </button>
              ))
            )}
          </div>

          <form onSubmit={create} className="flex gap-1.5 border-t border-line p-2">
            <input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="New collection…"
              maxLength={90}
              className="h-8 min-w-0 flex-1 rounded-lg border border-line bg-canvas px-2.5 text-sm outline-none placeholder:text-faint focus:border-line-strong"
            />
            <button
              type="submit"
              disabled={busy === 'new' || newTitle.trim().length < 3}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-ink text-canvas disabled:opacity-40"
              aria-label="Create collection"
            >
              {busy === 'new' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
            </button>
          </form>

          {error && <p className="border-t border-line px-3 py-2 text-xs text-danger">{error}</p>}
        </div>
      )}
    </div>
  )
}
