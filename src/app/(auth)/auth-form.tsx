'use client'

import * as React from 'react'
import { useActionState } from 'react'
import { AlertCircle, Loader2 } from 'lucide-react'
import type { AuthFormState } from '@/lib/actions/auth'
import { Button } from '@/components/ui/primitives'
import { WebAmbleGlyph } from '@/components/wordmark'
import { cn } from '@/lib/utils'

export function AuthForm({
  mode,
  action,
  title,
  subtitle,
  footer,
  next,
}: {
  mode: 'login' | 'signup'
  action: (prev: AuthFormState, formData: FormData) => Promise<AuthFormState>
  title: string
  subtitle: string
  footer: React.ReactNode
  next?: string
}) {
  const [state, formAction, pending] = useActionState(action, {})

  return (
    <div className="shell flex min-h-[calc(100dvh-4rem)] items-center justify-center py-16">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <WebAmbleGlyph className="mx-auto mb-5 h-7 w-7 text-accent" />
          <h1 className="font-display text-3xl tracking-tight">{title}</h1>
          <p className="mt-2 text-sm leading-relaxed text-muted">{subtitle}</p>
        </div>

        <form action={formAction} className="space-y-4">
          {next && <input type="hidden" name="next" value={next} />}

          <Field
            label="Username"
            name="username"
            autoComplete={mode === 'login' ? 'username' : 'off'}
            autoFocus
            required
            invalid={state.field === 'username'}
            hint={mode === 'signup' ? '3–24 characters, lowercase' : undefined}
          />

          {mode === 'signup' && (
            <Field
              label="Email"
              name="email"
              type="email"
              autoComplete="email"
              invalid={state.field === 'email'}
              hint="Optional — only used to recover your account"
            />
          )}

          <Field
            label="Password"
            name="password"
            type="password"
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            required
            invalid={state.field === 'password'}
            hint={mode === 'signup' ? 'At least 8 characters' : undefined}
          />

          {state.error && (
            <p className="flex items-start gap-2 rounded-xl border border-danger/25 bg-danger/5 px-3 py-2.5 text-sm text-danger">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              {state.error}
            </p>
          )}

          <Button type="submit" variant="primary" size="lg" className="w-full" disabled={pending}>
            {pending && <Loader2 className="h-4 w-4 animate-spin" />}
            {mode === 'login' ? 'Sign in' : 'Create account'}
          </Button>
        </form>

        <div className="mt-6 text-center">{footer}</div>

        <p className="mt-10 text-center text-xs leading-relaxed text-faint">
          web-amble stores a username, a hashed password and the sites you save. Nothing else, and nothing is
          shared with anybody.
        </p>
      </div>
    </div>
  )
}

function Field({
  label,
  name,
  hint,
  invalid,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string; name: string; hint?: string; invalid?: boolean }) {
  const id = `field-${name}`
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium">
        {label}
      </label>
      <input
        id={id}
        name={name}
        className={cn(
          'h-11 w-full rounded-xl border bg-surface px-3.5 text-sm outline-none transition-colors',
          'placeholder:text-faint focus:border-ink/40',
          invalid ? 'border-danger/50' : 'border-line',
        )}
        {...props}
      />
      {hint && <p className="mt-1.5 text-xs text-faint">{hint}</p>}
    </div>
  )
}
