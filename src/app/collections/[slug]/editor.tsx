'use client'

import * as React from 'react'
import { useActionState } from 'react'
import { Loader2, Plus, Settings2, Trash2, X } from 'lucide-react'
import type { Collection, Site } from '@/lib/types'
import {
  addSiteToCollectionAction,
  deleteCollectionAction,
  removeSiteFromCollectionAction,
  updateCollectionAction,
} from '@/lib/actions/collections'
import { Button } from '@/components/ui/primitives'
import { cn } from '@/lib/utils'

export function CollectionEditor({ collection, sites }: { collection: Collection; sites: Site[] }) {
  const [tab, setTab] = React.useState<'add' | 'settings' | null>(null)

  return (
    <div className="mb-10 rounded-2xl border border-dashed border-line bg-surface/60 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">
          You curate this collection.{' '}
          <span className="text-faint">Only you see these controls.</span>
        </p>
        <div className="flex gap-2">
          <Button size="sm" variant={tab === 'add' ? 'primary' : 'secondary'} onClick={() => setTab(tab === 'add' ? null : 'add')}>
            <Plus className="h-3.5 w-3.5" />
            Add a site
          </Button>
          <Button
            size="sm"
            variant={tab === 'settings' ? 'primary' : 'secondary'}
            onClick={() => setTab(tab === 'settings' ? null : 'settings')}
          >
            <Settings2 className="h-3.5 w-3.5" />
            Settings
          </Button>
        </div>
      </div>

      {tab === 'add' && <AddSiteForm collection={collection} />}
      {tab === 'settings' && <SettingsForm collection={collection} />}

      {sites.length > 0 && (
        <div className="mt-5 border-t border-line pt-4">
          <p className="eyebrow mb-3">Remove sites</p>
          <div className="flex flex-wrap gap-1.5">
            {sites.map((site) => (
              <form key={site.id} action={removeSiteFromCollectionAction}>
                <input type="hidden" name="id" value={collection.id} />
                <input type="hidden" name="siteId" value={site.id} />
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 rounded-full border border-line bg-canvas px-2.5 py-1 text-xs text-muted transition-colors hover:border-danger/40 hover:text-danger"
                >
                  {site.title}
                  <X className="h-3 w-3" />
                </button>
              </form>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function AddSiteForm({ collection }: { collection: Collection }) {
  const [state, action, pending] = useActionState(addSiteToCollectionAction, {})
  const formRef = React.useRef<HTMLFormElement>(null)

  React.useEffect(() => {
    if (state.ok) formRef.current?.reset()
  }, [state.ok])

  return (
    <form ref={formRef} action={action} className="mt-4 space-y-3 border-t border-line pt-4">
      <input type="hidden" name="id" value={collection.id} />
      <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
        <input
          name="site"
          required
          placeholder="Site link or slug, e.g. /site/squoosh"
          className="h-10 rounded-xl border border-line bg-canvas px-3 text-sm outline-none placeholder:text-faint focus:border-line-strong"
        />
        <input
          name="note"
          placeholder="Why it belongs here (optional)"
          maxLength={280}
          className="h-10 rounded-xl border border-line bg-canvas px-3 text-sm outline-none placeholder:text-faint focus:border-line-strong"
        />
        <Button type="submit" variant="primary" disabled={pending}>
          {pending && <Loader2 className="h-4 w-4 animate-spin" />}
          Add
        </Button>
      </div>
      <Feedback state={state} />
    </form>
  )
}

function SettingsForm({ collection }: { collection: Collection }) {
  const [state, action, pending] = useActionState(updateCollectionAction, {})

  return (
    <div className="mt-4 space-y-4 border-t border-line pt-4">
      <form action={action} className="space-y-3">
        <input type="hidden" name="id" value={collection.id} />
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-xs text-muted">Name</span>
            <input
              name="title"
              defaultValue={collection.title}
              required
              maxLength={90}
              className="h-10 w-full rounded-xl border border-line bg-canvas px-3 text-sm outline-none focus:border-line-strong"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs text-muted">Subtitle</span>
            <input
              name="subtitle"
              defaultValue={collection.subtitle}
              maxLength={140}
              className="h-10 w-full rounded-xl border border-line bg-canvas px-3 text-sm outline-none focus:border-line-strong"
            />
          </label>
        </div>
        <label className="block">
          <span className="mb-1.5 block text-xs text-muted">Description</span>
          <textarea
            name="description"
            defaultValue={collection.description}
            rows={3}
            maxLength={1200}
            className="w-full resize-none rounded-xl border border-line bg-canvas px-3 py-2 text-sm outline-none focus:border-line-strong"
          />
        </label>
        <label className="flex items-center gap-2 text-sm text-muted">
          <input type="checkbox" name="isPublic" defaultChecked={Boolean(collection.is_public)} className="accent-current" />
          Visible to everyone
        </label>
        <div className="flex items-center gap-3">
          <Button type="submit" variant="primary" disabled={pending}>
            {pending && <Loader2 className="h-4 w-4 animate-spin" />}
            Save changes
          </Button>
          <Feedback state={state} />
        </div>
      </form>

      {!collection.is_editorial && (
        <form action={deleteCollectionAction} className="border-t border-line pt-4">
          <input type="hidden" name="id" value={collection.id} />
          <Button type="submit" variant="danger" size="sm">
            <Trash2 className="h-3.5 w-3.5" />
            Delete this collection
          </Button>
        </form>
      )}
    </div>
  )
}

function Feedback({ state }: { state: { error?: string; ok?: string } }) {
  if (!state.error && !state.ok) return null
  return (
    <p className={cn('text-sm', state.error ? 'text-danger' : 'text-positive')}>{state.error ?? state.ok}</p>
  )
}
