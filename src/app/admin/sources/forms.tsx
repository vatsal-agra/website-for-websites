'use client'

import { useActionState } from 'react'
import { Loader2, Plus } from 'lucide-react'
import { addBlocklistAction, createSourceAction } from '@/lib/actions/admin'
import { Button } from '@/components/ui/primitives'
import { cn } from '@/lib/utils'

export function NewSourceForm() {
  const [state, action, pending] = useActionState(createSourceAction, {})

  return (
    <form action={action} className="rounded-2xl border border-dashed border-line bg-surface/60 p-4">
      <h3 className="eyebrow mb-3">Add a source</h3>
      <div className="grid gap-2 sm:grid-cols-[8rem_1fr_1fr_6rem_auto]">
        <select
          name="kind"
          defaultValue="rss"
          className="h-9 rounded-lg border border-line bg-canvas px-2 text-sm outline-none"
        >
          <option value="rss">RSS / Atom</option>
          <option value="hackernews">Hacker News</option>
          <option value="linkgraph">Link graph</option>
        </select>
        <input
          name="name"
          required
          placeholder="Name, e.g. Waxy links"
          className="h-9 rounded-lg border border-line bg-canvas px-3 text-sm outline-none placeholder:text-faint"
        />
        <input
          name="url"
          placeholder="Feed URL"
          className="h-9 rounded-lg border border-line bg-canvas px-3 text-sm outline-none placeholder:text-faint"
        />
        <input
          name="interval"
          type="number"
          min={15}
          defaultValue={240}
          title="Minutes between runs"
          className="h-9 rounded-lg border border-line bg-canvas px-2 text-sm outline-none"
        />
        <Button type="submit" variant="primary" size="sm" disabled={pending}>
          {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
          Add
        </Button>
      </div>
      <label className="mt-2 flex items-center gap-2 text-xs text-muted">
        <input type="checkbox" name="deep" className="accent-current" />
        Also harvest links found inside each entry’s body (best for link blogs)
      </label>
      {(state.error || state.ok) && (
        <p className={cn('mt-2 text-sm', state.error ? 'text-danger' : 'text-positive')}>
          {state.error ?? state.ok}
        </p>
      )}
    </form>
  )
}

export function BlocklistForm() {
  const [state, action, pending] = useActionState(addBlocklistAction, {})

  return (
    <form action={action} className="space-y-2">
      <div className="flex gap-2">
        <input
          name="pattern"
          required
          placeholder="hostname to block"
          className="h-9 flex-1 rounded-lg border border-line bg-canvas px-3 text-sm outline-none placeholder:text-faint"
        />
        <Button type="submit" variant="secondary" size="sm" disabled={pending}>
          {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          Block
        </Button>
      </div>
      <input
        name="reason"
        placeholder="Reason (optional)"
        className="h-9 w-full rounded-lg border border-line bg-canvas px-3 text-sm outline-none placeholder:text-faint"
      />
      {(state.error || state.ok) && (
        <p className={cn('text-sm', state.error ? 'text-danger' : 'text-positive')}>{state.error ?? state.ok}</p>
      )}
    </form>
  )
}
