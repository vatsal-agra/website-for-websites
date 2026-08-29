'use client'

import * as React from 'react'
import { useActionState } from 'react'
import { AlertCircle, Check, Loader2, Trash2 } from 'lucide-react'
import type { PublicUser } from '@/lib/types'
import {
  changePasswordAction,
  deleteAccountAction,
  updateProfileAction,
  type AccountState,
} from '@/lib/actions/account'
import { Button } from '@/components/ui/primitives'

const initial: AccountState = {}

const inputClass =
  'h-12 w-full rounded-xl border border-line bg-surface px-4 text-base outline-none transition-colors placeholder:text-faint focus:border-ink/40'

function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium">{label}</span>
      {children}
      {hint && <span className="mt-1.5 block text-xs leading-relaxed text-faint">{hint}</span>}
    </label>
  )
}

function Feedback({ state }: { state: AccountState }) {
  if (state.error) {
    return (
      <p className="flex items-start gap-2 text-sm text-danger">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
        {state.error}
      </p>
    )
  }
  if (state.ok) {
    return (
      <p className="flex items-start gap-2 text-sm text-positive">
        <Check className="mt-0.5 h-4 w-4 shrink-0" />
        {state.ok}
      </p>
    )
  }
  return null
}

function Submit({ pending, children }: { pending: boolean; children: React.ReactNode }) {
  return (
    <Button type="submit" variant="primary" disabled={pending}>
      {pending && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </Button>
  )
}

export function ProfileForm({ user }: { user: PublicUser }) {
  const [state, action, pending] = useActionState(updateProfileAction, initial)

  return (
    <form action={action} className="space-y-4">
      <Field
        label="Display name"
        hint={`Shown instead of your username. Leave it empty and you are just @${user.username}.`}
      >
        <input
          name="displayName"
          defaultValue={user.display_name}
          maxLength={60}
          placeholder={user.username}
          className={inputClass}
        />
      </Field>

      <Field label="Bio" hint="A sentence or two on your profile page. 280 characters.">
        <textarea
          name="bio"
          defaultValue={user.bio}
          rows={3}
          maxLength={280}
          placeholder="Collector of maps and defunct search engines."
          className="w-full resize-none rounded-xl border border-line bg-surface px-4 py-3 text-sm outline-none transition-colors placeholder:text-faint focus:border-ink/40"
        />
      </Field>

      <Feedback state={state} />
      <Submit pending={pending}>Save profile</Submit>
    </form>
  )
}

export function PasswordForm() {
  const [state, action, pending] = useActionState(changePasswordAction, initial)
  const formRef = React.useRef<HTMLFormElement>(null)

  // Clearing the fields on success matters here: they are the old password and
  // the new one sitting in a form that a browser will happily offer to save.
  React.useEffect(() => {
    if (state.ok) formRef.current?.reset()
  }, [state.ok])

  return (
    <form ref={formRef} action={action} className="space-y-4">
      <Field label="Current password">
        <input name="current" type="password" autoComplete="current-password" required className={inputClass} />
      </Field>
      <Field label="New password" hint="At least eight characters.">
        <input name="password" type="password" autoComplete="new-password" required className={inputClass} />
      </Field>
      <Field label="New password again">
        <input name="confirm" type="password" autoComplete="new-password" required className={inputClass} />
      </Field>

      <Feedback state={state} />
      <Submit pending={pending}>Change password</Submit>
    </form>
  )
}

export function DeleteAccountForm({ user }: { user: PublicUser }) {
  const [state, action, pending] = useActionState(deleteAccountAction, initial)
  const [open, setOpen] = React.useState(false)

  if (!open) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="text-sm leading-relaxed text-muted">
          Deletes your account, your collections, your votes and your saved sites. Entries you submitted that were
          accepted stay in the catalogue, without your name on them.
        </p>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="shrink-0 rounded-xl border border-danger/30 px-4 py-2.5 text-sm text-danger transition-colors hover:bg-danger/10"
        >
          Delete my account
        </button>
      </div>
    )
  }

  return (
    <form action={action} className="space-y-4">
      <p className="text-sm leading-relaxed text-muted">
        This cannot be undone. Your collections, votes and saved sites go with it.
      </p>

      <Field label={`Type ${user.username} to confirm`}>
        <input name="confirm" autoComplete="off" required className={inputClass} placeholder={user.username} />
      </Field>
      <Field label="Your password">
        <input name="password" type="password" autoComplete="current-password" required className={inputClass} />
      </Field>

      <Feedback state={state} />

      <div className="flex flex-wrap gap-2">
        <Button type="submit" variant="danger" disabled={pending}>
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
          Delete permanently
        </Button>
        <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
          Keep my account
        </Button>
      </div>
    </form>
  )
}
