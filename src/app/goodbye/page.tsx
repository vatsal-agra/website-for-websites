import type { Metadata } from 'next'
import { Check } from 'lucide-react'
import { ButtonLink } from '@/components/ui/primitives'

export const metadata: Metadata = {
  title: 'Account deleted',
  robots: { index: false, follow: false },
}

/**
 * Where account deletion lands.
 *
 * Redirecting to the home page would have worked and told the reader nothing.
 * Deleting an account is the one action on this site with no undo, so it gets a
 * page that says plainly what went and what did not.
 */
export default function GoodbyePage() {
  return (
    <div className="shell flex min-h-[60vh] max-w-lg flex-col justify-center py-16">
      <div className="mb-6 flex h-11 w-11 items-center justify-center rounded-full bg-positive/15 text-positive">
        <Check className="h-5 w-5" />
      </div>

      <h1 className="font-display text-display-sm">Your account is gone.</h1>

      <p className="mt-4 text-base leading-relaxed text-muted">
        Your profile, collections, votes and saved sites have been deleted. Sites you submitted that were accepted
        are still in the catalogue — they belong to it now — but nothing connects them to you.
      </p>

      <p className="mt-4 text-base leading-relaxed text-muted">
        You do not need an account to use web-amble. Browsing, searching and shuffling all work signed out.
      </p>

      <div className="mt-9 flex flex-wrap gap-3">
        <ButtonLink href="/browse" variant="primary" size="lg">
          Keep browsing
        </ButtonLink>
        <ButtonLink href="/signup" variant="secondary" size="lg">
          Start again
        </ButtonLink>
      </div>
    </div>
  )
}
