'use client'

import { useActionState } from 'react'
import { Loader2 } from 'lucide-react'
import type { Category, Site } from '@/lib/types'
import { ATTRIBUTE_DEFS } from '@/lib/taxonomy'
import { editSiteAction } from '@/lib/actions/admin'
import { Button } from '@/components/ui/primitives'
import { cn } from '@/lib/utils'

export function SiteEditForm({ site, categories }: { site: Site; categories: Category[] }) {
  const [state, action, pending] = useActionState(editSiteAction, {})

  return (
    <form action={action} className="space-y-4 rounded-2xl border border-line bg-surface p-5">
      <input type="hidden" name="id" value={site.id} />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Title" name="title" defaultValue={site.title} required maxLength={90} />
        <Field label="Slug" name="slug" defaultValue={site.slug} maxLength={72} hint="Changing this breaks old links" />
      </div>

      <Field label="Tagline" name="tagline" defaultValue={site.tagline} maxLength={160} hint="One line, shown on cards" />

      <label className="block">
        <span className="mb-1.5 block text-xs text-muted">Description</span>
        <textarea
          name="description"
          defaultValue={site.description}
          rows={3}
          maxLength={800}
          className="w-full resize-none rounded-xl border border-line bg-canvas px-3 py-2 text-sm outline-none focus:border-line-strong"
        />
      </label>

      <label className="block">
        <span className="mb-1.5 block text-xs text-muted">
          Editor’s note <span className="text-faint">— shown on the site page and in the feature slot</span>
        </span>
        <textarea
          name="editorNote"
          defaultValue={site.editor_note}
          rows={2}
          maxLength={600}
          className="w-full resize-none rounded-xl border border-line bg-canvas px-3 py-2 text-sm outline-none focus:border-line-strong"
        />
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1.5 block text-xs text-muted">Shelf</span>
          <select
            name="category"
            defaultValue={site.category?.slug ?? ''}
            className="h-10 w-full rounded-xl border border-line bg-canvas px-3 text-sm outline-none focus:border-line-strong"
          >
            <option value="">Unfiled</option>
            {categories.map((category) => (
              <option key={category.id} value={category.slug}>
                {category.name}
              </option>
            ))}
          </select>
        </label>

        <Field
          label="Tags"
          name="tags"
          defaultValue={site.tags.map((t) => t.name).join(', ')}
          hint="Comma separated, up to eight"
        />
      </div>

      <fieldset>
        <legend className="mb-2 text-xs text-muted">Attributes</legend>
        <div className="flex flex-wrap gap-1.5">
          {ATTRIBUTE_DEFS.map((attr) => (
            <label
              key={attr.key}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-line px-2.5 py-1.5 text-xs text-muted transition-colors hover:border-line-strong has-[:checked]:border-accent/40 has-[:checked]:bg-accent/10 has-[:checked]:text-accent"
            >
              <input
                type="checkbox"
                name="attrs"
                value={attr.key}
                defaultChecked={Boolean(site.attributes[attr.key])}
                className="accent-current"
              />
              {attr.label}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="flex items-center gap-3 border-t border-line pt-4">
        <Button type="submit" variant="primary" disabled={pending}>
          {pending && <Loader2 className="h-4 w-4 animate-spin" />}
          Save changes
        </Button>
        {(state.error || state.ok) && (
          <p className={cn('text-sm', state.error ? 'text-danger' : 'text-positive')}>{state.error ?? state.ok}</p>
        )}
      </div>
    </form>
  )
}

function Field({
  label,
  hint,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs text-muted">{label}</span>
      <input
        className="h-10 w-full rounded-xl border border-line bg-canvas px-3 text-sm outline-none focus:border-line-strong"
        {...props}
      />
      {hint && <span className="mt-1 block text-2xs text-faint">{hint}</span>}
    </label>
  )
}
