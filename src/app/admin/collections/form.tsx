'use client'

import { useActionState } from 'react'
import { Loader2, Plus } from 'lucide-react'
import { createEditorialCollectionAction } from '@/lib/actions/admin'
import { Button } from '@/components/ui/primitives'
import { cn } from '@/lib/utils'

export function NewEditorialCollection() {
  const [state, action, pending] = useActionState(createEditorialCollectionAction, {})

  return (
    <form action={action} className="rounded-2xl border border-dashed border-line bg-surface/60 p-4">
      <h3 className="eyebrow mb-3">New editorial collection</h3>
      <div className="grid gap-2 sm:grid-cols-2">
        <input
          name="title"
          required
          minLength={3}
          placeholder="Title"
          className="h-9 rounded-lg border border-line bg-canvas px-3 text-sm outline-none placeholder:text-faint"
        />
        <input
          name="subtitle"
          placeholder="Subtitle"
          className="h-9 rounded-lg border border-line bg-canvas px-3 text-sm outline-none placeholder:text-faint"
        />
      </div>
      <textarea
        name="description"
        rows={2}
        placeholder="Description"
        className="mt-2 w-full resize-none rounded-lg border border-line bg-canvas px-3 py-2 text-sm outline-none placeholder:text-faint"
      />
      <div className="mt-3 flex items-center gap-3">
        <Button type="submit" variant="primary" size="sm" disabled={pending}>
          {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
          Create
        </Button>
        {(state.error || state.ok) && (
          <p className={cn('text-sm', state.error ? 'text-danger' : 'text-positive')}>{state.error ?? state.ok}</p>
        )}
      </div>
    </form>
  )
}
