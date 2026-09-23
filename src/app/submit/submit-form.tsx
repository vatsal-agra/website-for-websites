'use client'

import * as React from 'react'
import { useActionState } from 'react'
import Link from 'next/link'
import { AlertCircle, ArrowRight, Check, Info, Loader2 } from 'lucide-react'
import { submitSiteAction, type SubmitState } from '@/lib/actions/submit'
import { describeUrlProblem } from '@/lib/submit-url'
import { Button, ButtonLink } from '@/components/ui/primitives'

const initial: SubmitState = { status: 'idle' }

export function SubmitForm({ initialUrl, signedIn }: { initialUrl: string; signedIn: boolean }) {
  const [state, action, pending] = useActionState(submitSiteAction, initial)
  const [url, setUrl] = React.useState(initialUrl)
  const [localError, setLocalError] = React.useState<string | null>(null)
  const inputRef = React.useRef<HTMLInputElement>(null)

  const error = localError ?? (state.status === 'error' ? state.message : null)

  // Send focus back to the field the message is about, so keyboard and screen
  // reader users land on the thing they have to change.
  React.useEffect(() => {
    if (error) inputRef.current?.focus()
  }, [error])

  // The same check the action runs. Catching an obvious typo here answers the
  // submitter straight away instead of costing a round trip and one of their
  // rate limit slots. Without JavaScript the form still posts and the action
  // returns the identical message.
  function guard(event: React.FormEvent<HTMLFormElement>) {
    const problem = describeUrlProblem(url)
    if (problem) {
      event.preventDefault()
      setLocalError(problem)
    }
  }

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
    <form action={action} onSubmit={guard} className="space-y-4">
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
          ref={inputRef}
          id="url"
          name="url"
          type="text"
          inputMode="url"
          required
          autoFocus
          value={url}
          onChange={(e) => {
            setUrl(e.target.value)
            setLocalError(null)
          }}
          placeholder="https://example.com"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? 'url-error url-hint' : 'url-hint'}
          className={`h-12 w-full rounded-xl border bg-surface px-4 text-base outline-none transition-colors placeholder:text-faint ${
            error ? 'border-danger/50 focus:border-danger' : 'border-line focus:border-ink/40'
          }`}
        />
        <p id="url-hint" className="mt-1.5 text-xs leading-relaxed text-faint">
          The homepage works best. Typing https:// is optional.
        </p>
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

      {error && (
        <p
          id="url-error"
          role="alert"
          className="flex items-start gap-2 rounded-xl border border-danger/25 bg-danger/5 px-3.5 py-3 text-sm leading-relaxed text-danger"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </p>
      )}

      {state.status === 'duplicate' && (
        <div
          role="status"
          className="flex items-start gap-2 rounded-xl border border-line bg-raised px-3.5 py-3 text-sm leading-relaxed text-muted"
        >
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
