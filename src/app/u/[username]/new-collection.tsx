'use client'

import { useActionState } from 'react'
import { Loader2, Plus } from 'lucide-react'
import { createCollectionAction } from '@/lib/actions/collections'
import { Button } from '@/components/ui/primitives'

export function NewCollectionForm() {
  const [state, action, pending] = useActionState(createCollectionAction, {})

  return (
    <form action={action} className="rounded-2xl border border-line bg-surface p-5">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1.5 block text-xs text-muted">Name</span>
          <input
            name="title"
            required
            minLength={3}
            maxLength={90}
            placeholder="Sites I open every Monday"
            className="h-10 w-full rounded-xl border border-line bg-canvas px-3 text-sm outline-none placeholder:text-faint focus:border-line-strong"
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs text-muted">Subtitle</span>
          <input
            name="subtitle"
            maxLength={140}
            placeholder="A short line explaining the idea"
            className="h-10 w-full rounded-xl border border-line bg-canvas px-3 text-sm outline-none placeholder:text-faint focus:border-line-strong"
          />
        </label>
      </div>

      <label className="mt-3 block">
        <span className="mb-1.5 block text-xs text-muted">Description</span>
        <textarea
          name="description"
          rows={2}
          maxLength={1200}
          placeholder="Optional. What ties these sites together?"
          className="w-full resize-none rounded-xl border border-line bg-canvas px-3 py-2 text-sm outline-none placeholder:text-faint focus:border-line-strong"
        />
      </label>

      <div className="mt-4 flex flex-wrap items-center gap-4">
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          Create collection
        </Button>
        <label className="flex items-center gap-2 text-sm text-muted">
          <input type="checkbox" name="isPublic" defaultChecked className="accent-current" />
          Publish it publicly
        </label>
        {state.error && <p className="text-sm text-danger">{state.error}</p>}
      </div>
    </form>
  )
}
