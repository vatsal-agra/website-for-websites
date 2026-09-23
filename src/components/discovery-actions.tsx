import type { ReactNode } from 'react'
import { ButtonLink } from '@/components/ui/primitives'

export function DiscoveryActions({ children }: { children?: ReactNode }) {
  return (
    <div className="flex flex-wrap justify-center gap-2">
      <ButtonLink href="/shuffle" variant="primary">
        Try Shuffle
      </ButtonLink>
      <ButtonLink href="/submit" variant="secondary">
        Submit a site
      </ButtonLink>
      {children}
    </div>
  )
}
