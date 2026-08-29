'use client'

import * as React from 'react'
import { useActionState } from 'react'
import { AlertCircle, Check, KeyRound, Loader2, ShieldMinus, ShieldPlus, Trash2 } from 'lucide-react'
import { deleteUserAction, issuePasswordAction, setRoleAction, type PeopleState } from '@/lib/actions/people'

const initial: PeopleState = {}

export interface Person {
  id: number
  username: string
  display_name: string
  role: string
  created_at: string
  collections: number
  submissions: number
  votes: number
}

/**
 * One row, three actions, one shared result line.
 *
 * Each row owns its own action state so a message lands next to the person it
 * is about — a single page-level state would show "@someone is now an editor"
 * next to whoever happened to be at the top.
 */
export function PersonActions({ person, isSelf }: { person: Person; isSelf: boolean }) {
  const [roleState, roleAction, rolePending] = useActionState(setRoleAction, initial)
  const [passwordState, passwordAction, passwordPending] = useActionState(issuePasswordAction, initial)
  const [deleteState, deleteAction, deletePending] = useActionState(deleteUserAction, initial)
  const [confirming, setConfirming] = React.useState(false)

  const state = deleteState.error || deleteState.ok ? deleteState : passwordState.error || passwordState.ok ? passwordState : roleState
  const pending = rolePending || passwordPending || deletePending

  return (
    <div className="mt-3 border-t border-line pt-3">
      <div className="flex flex-wrap items-center gap-1.5">
        <form action={roleAction}>
          <input type="hidden" name="id" value={person.id} />
          <input type="hidden" name="role" value={person.role === 'admin' ? 'user' : 'admin'} />
          <button
            disabled={pending}
            className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-xs text-muted transition-colors hover:text-ink disabled:opacity-50"
          >
            {person.role === 'admin' ? (
              <>
                <ShieldMinus className="h-3.5 w-3.5" />
                Make a reader
              </>
            ) : (
              <>
                <ShieldPlus className="h-3.5 w-3.5" />
                Make an editor
              </>
            )}
          </button>
        </form>

        <form action={passwordAction}>
          <input type="hidden" name="id" value={person.id} />
          <button
            disabled={pending}
            className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-xs text-muted transition-colors hover:text-ink disabled:opacity-50"
          >
            <KeyRound className="h-3.5 w-3.5" />
            Issue a password
          </button>
        </form>

        {!isSelf &&
          (confirming ? (
            <form action={deleteAction} className="flex items-center gap-1.5">
              <input type="hidden" name="id" value={person.id} />
              <button
                disabled={pending}
                className="inline-flex items-center gap-1.5 rounded-lg border border-danger/40 bg-danger/10 px-3 py-1.5 text-xs text-danger disabled:opacity-50"
              >
                {deletePending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                Delete @{person.username} for good
              </button>
              <button
                type="button"
                onClick={() => setConfirming(false)}
                className="rounded-lg px-2 py-1.5 text-xs text-faint transition-colors hover:text-ink"
              >
                cancel
              </button>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => setConfirming(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-danger/30 px-3 py-1.5 text-xs text-danger transition-colors hover:bg-danger/10"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete
            </button>
          ))}
      </div>

      {state.error && (
        <p className="mt-2.5 flex items-start gap-1.5 text-xs text-danger">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {state.error}
        </p>
      )}
      {state.ok && (
        <p className="mt-2.5 flex items-start gap-1.5 text-xs text-positive">
          <Check className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {state.ok}
        </p>
      )}
      {state.password && (
        <p className="mt-2 select-all rounded-lg border border-line bg-raised px-3 py-2 font-mono text-sm">
          {state.password}
        </p>
      )}
    </div>
  )
}
