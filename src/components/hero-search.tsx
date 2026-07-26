'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Search } from 'lucide-react'

const SUGGESTIONS = [
  'interactive explainers',
  'free typefaces',
  'browser games',
  'public domain archives',
  'ambient sound',
  'maps of everything',
  'single-serving sites',
  'writing worth reading',
]

export function HeroSearch() {
  const router = useRouter()
  const [value, setValue] = React.useState('')
  const [placeholderIndex, setPlaceholderIndex] = React.useState(0)

  React.useEffect(() => {
    const id = setInterval(() => setPlaceholderIndex((i) => (i + 1) % SUGGESTIONS.length), 3200)
    return () => clearInterval(id)
  }, [])

  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    const term = value.trim()
    router.push(term ? `/search?q=${encodeURIComponent(term)}` : '/browse')
  }

  return (
    <div>
      <form onSubmit={submit} className="relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={`Try “${SUGGESTIONS[placeholderIndex]}”`}
          aria-label="Search the catalogue"
          className="h-14 w-full rounded-2xl border border-line bg-surface pl-11 pr-28 text-base outline-none transition-colors placeholder:text-faint focus:border-line-strong"
        />
        <button
          type="submit"
          className="absolute right-2 top-1/2 h-10 -translate-y-1/2 rounded-xl bg-ink px-4 text-sm font-medium text-canvas transition-opacity hover:opacity-90"
        >
          Search
        </button>
      </form>
    </div>
  )
}
