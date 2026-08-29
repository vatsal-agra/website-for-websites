'use client'

import * as React from 'react'
import Link from 'next/link'
import { RefreshCw } from 'lucide-react'
import { Button, ButtonLink } from '@/components/ui/primitives'

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  React.useEffect(() => {
    console.error('web-amble page error:', error)
  }, [error])

  return (
    <div className="shell flex min-h-[calc(100dvh-4rem)] items-center py-16">
      <div className="max-w-xl">
        <p className="eyebrow mb-4">Something broke</p>
        <h1 className="font-display text-display-sm">That did not work</h1>
        <p className="mt-5 text-base leading-relaxed text-muted">
          An error stopped this page from rendering. Trying again often fixes it — if it does not, the catalogue
          itself is still fine and everything else should work normally.
        </p>
        {error.digest && (
          <p className="mt-3 font-mono text-xs text-faint">Reference: {error.digest}</p>
        )}
        <div className="mt-8 flex flex-wrap gap-3">
          <Button variant="primary" size="lg" onClick={reset}>
            <RefreshCw className="h-4 w-4" />
            Try again
          </Button>
          <ButtonLink href="/" variant="secondary" size="lg">
            Back to the front
          </ButtonLink>
        </div>
        <p className="mt-8 text-sm text-muted">
          Persistently broken?{' '}
          <Link href="/about" className="text-ink">
            Read how web-amble works
          </Link>{' '}
          — it may explain what went wrong.
        </p>
      </div>
    </div>
  )
}
