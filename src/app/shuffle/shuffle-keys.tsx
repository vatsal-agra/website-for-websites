'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'

/** Space = next site, Enter = open it. Keeps the shuffle loop one-handed. */
export function ShuffleKeys({ nextHref, visitHref }: { nextHref: string; visitHref: string }) {
  const router = useRouter()

  React.useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return
      if (event.metaKey || event.ctrlKey || event.altKey) return

      if (event.code === 'Space') {
        event.preventDefault()
        router.push(nextHref)
      } else if (event.code === 'Enter') {
        event.preventDefault()
        window.open(visitHref, '_blank', 'noopener,noreferrer')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [nextHref, visitHref, router])

  return null
}
