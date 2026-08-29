'use client'

import * as React from 'react'
import { Monitor, Moon, Sun } from 'lucide-react'
import { cn } from '@/lib/utils'

type Theme = 'light' | 'dark' | 'system'

const STORAGE_KEY = 'webamble-theme'

function apply(theme: Theme) {
  const root = document.documentElement
  if (theme === 'system') root.removeAttribute('data-theme')
  else root.setAttribute('data-theme', theme)
}

export function ThemeToggle({ className }: { className?: string }) {
  const [theme, setTheme] = React.useState<Theme>('system')
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    const stored = (localStorage.getItem(STORAGE_KEY) as Theme | null) ?? 'system'
    setTheme(stored)
    setMounted(true)
  }, [])

  const choose = (next: Theme) => {
    setTheme(next)
    localStorage.setItem(STORAGE_KEY, next)
    apply(next)
  }

  const options: { value: Theme; icon: typeof Sun; label: string }[] = [
    { value: 'light', icon: Sun, label: 'Light' },
    { value: 'system', icon: Monitor, label: 'System' },
    { value: 'dark', icon: Moon, label: 'Dark' },
  ]

  return (
    <div
      className={cn('inline-flex items-center gap-0.5 rounded-full border border-line bg-surface p-0.5', className)}
      role="radiogroup"
      aria-label="Colour theme"
    >
      {options.map((option) => {
        const Icon = option.icon
        const active = mounted && theme === option.value
        return (
          <button
            key={option.value}
            role="radio"
            aria-checked={active}
            aria-label={option.label}
            title={`${option.label} theme`}
            onClick={() => choose(option.value)}
            className={cn(
              'flex h-7 w-7 items-center justify-center rounded-full transition-colors',
              active ? 'bg-ink text-canvas' : 'text-faint hover:text-ink',
            )}
          >
            <Icon className="h-3.5 w-3.5" />
          </button>
        )
      })}
    </div>
  )
}

/** Inlined before paint so the first frame is already the right colour. */
export function ThemeScript() {
  const code = `(function(){try{var t=localStorage.getItem('${STORAGE_KEY}');if(t&&t!=='system'){document.documentElement.setAttribute('data-theme',t);}}catch(e){}})();`
  return <script dangerouslySetInnerHTML={{ __html: code }} />
}
