'use client'

import * as React from 'react'
import { useActionState } from 'react'
import Link from 'next/link'
import { AlertCircle, ArrowRight, Check, Info, Loader2 } from 'lucide-react'
import { submitSiteAction, type SubmitState } from '@/lib/actions/submit'
import { Button, ButtonLink } from '@/components/ui/primitives'

const initial: SubmitState = { status: 'idle' }

export function SubmitForm({ initialUrl, signedIn }: { initialUrl: string; signedIn: boolean }) {
  const [state, action, pending] = useActionState(submitSiteAction, initial)
  const [url, setUrl] = React.useState(initialUrl)

  if (state.status === 'ok') {
    return (
      <div className="animate-scale-in rounded-2xl border border-positive/25 bg-positive/5 p-6">
        <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-positive/15 text-positive">
          <Check className="h-5 w-5" />
        </div>
        <h2 className="font-display text-2xl">{state.title ? `${state.title} is in.` : 'Submitted.'}</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">{state.message}</p>
        <div className="mt-6 flex flex-wrap gap-2">
          {state.slug && !state.reviewed && (
            <ButtonLink href={`/site/${state.slug}`} variant="primary">
              See the listing
              <ArrowRight className="h-4 w-4" />
            </ButtonLink>
          )}
          <ButtonLink href="/submit" variant="secondary">
            Submit another
          </ButtonLink>
        </div>
      </div>
    )
  }

  return (
    <form action={action} className="space-y-4">
      {/* honeypot */}
      <input
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="pointer-events-none absolute h-0 w-0 opacity-0"
      />

      <div>
        <label htmlFor="url" className="mb-1.5 block text-sm font-medium">
          Website address
        </label>
        <input
          id="url"
          name="url"
          type="text"
          inputMode="url"
          required
          autoFocus
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="example.com"
          className="h-12 w-full rounded-xl border border-line bg-surface px-4 text-base outline-none transition-colors placeholder:text-faint focus:border-ink/40"
        />
      </div>

      <div>
        <label htmlFor="note" className="mb-1.5 block text-sm font-medium">
          Why should it be listed? <span className="font-normal text-faint">Optional</span>
        </label>
        <textarea
          id="note"
          name="note"
          rows={3}
          maxLength={400}
          placeholder="One or two sentences. This goes to the editor reviewing it, and may end up as the editor’s note."
          className="w-full resize-none rounded-xl border border-line bg-surface px-4 py-3 text-sm outline-none transition-colors placeholder:text-faint focus:border-ink/40"
        />
      </div>

      {state.status === 'error' && (
        <p className="flex items-start gap-2 rounded-xl border border-danger/25 bg-danger/5 px-3.5 py-3 text-sm leading-relaxed text-danger">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          {state.message}
        </p>
      )}

      {state.status === 'duplicate' && (
        <div className="flex items-start gap-2 rounded-xl border border-line bg-raised px-3.5 py-3 text-sm leading-relaxed text-muted">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            {state.message}{' '}
            {state.slug && (
              <Link href={`/site/${state.slug}`} className="text-ink">
                Go to its page →
              </Link>
            )}
          </span>
        </div>
      )}

      <Button type="submit" variant="primary" size="lg" className="w-full" disabled={pending}>
        {pending && <Loader2 className="h-4 w-4 animate-spin" />}
        {pending ? 'Reading the page…' : 'Submit for review'}
      </Button>

      {!signedIn && (
        <p className="text-xs leading-relaxed text-faint">
          You can submit without an account.{' '}
          <Link href="/signup" className="text-muted">
            Signing up
          </Link>{' '}
          lets you track what happened to your submissions.
        </p>
      )}
    </form>
  )
}
