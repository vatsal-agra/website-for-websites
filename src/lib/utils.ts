import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Deterministic 32-bit hash — used for hues, gradients and stable shuffles. */
export function hashString(input: string): number {
  let h = 2166136261
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

export function hueFrom(input: string): number {
  return hashString(input) % 360
}

export function hslToHex(h: number, s: number, l: number): string {
  const a = (s / 100) * Math.min(l / 100, 1 - l / 100)
  const f = (n: number) => {
    const k = (n + h / 30) % 12
    const c = l / 100 - a * Math.max(-1, Math.min(k - 3, Math.min(9 - k, 1)))
    return Math.round(255 * c)
      .toString(16)
      .padStart(2, '0')
  }
  return `#${f(0)}${f(8)}${f(4)}`
}

export function slugify(input: string, max = 72): string {
  const base = input
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, max)
    .replace(/-+$/g, '')
  return base || 'site'
}

export function truncate(input: string, max: number): string {
  const s = input.trim()
  if (s.length <= max) return s
  const cut = s.slice(0, max - 1)
  const lastSpace = cut.lastIndexOf(' ')
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`
}

export function pluralize(n: number, one: string, many = `${one}s`) {
  return `${formatNumber(n)} ${n === 1 ? one : many}`
}

export function formatNumber(n: number): string {
  if (!Number.isFinite(n)) return '0'
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M`
  if (Math.abs(n) >= 10_000) return `${(n / 1000).toFixed(0)}k`
  if (Math.abs(n) >= 1000) return `${(n / 1000).toFixed(1)}k`
  return String(Math.round(n))
}

function toDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null
  if (value instanceof Date) return value
  // SQLite stores "YYYY-MM-DD HH:MM:SS" in UTC
  const normalized = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value)
    ? `${value.replace(' ', 'T')}Z`
    : value
  const d = new Date(normalized)
  return Number.isNaN(d.getTime()) ? null : d
}

export function timeAgo(value: string | Date | null | undefined): string {
  const d = toDate(value)
  if (!d) return '—'
  const seconds = Math.max(0, (Date.now() - d.getTime()) / 1000)
  const steps: [number, string][] = [
    [60, 'second'],
    [3600, 'minute'],
    [86400, 'hour'],
    [604800, 'day'],
    [2629800, 'week'],
    [31557600, 'month'],
  ]
  if (seconds < 45) return 'just now'
  let prev = 1
  for (const [limit, unit] of steps) {
    if (seconds < limit) {
      const n = Math.round(seconds / prev)
      return `${n} ${unit}${n === 1 ? '' : 's'} ago`
    }
    prev = limit
  }
  const years = Math.round(seconds / 31557600)
  return `${years} year${years === 1 ? '' : 's'} ago`
}

/**
 * Formatted in UTC on purpose.
 *
 * Without a fixed time zone the server renders this in UTC and the browser in
 * the reader's local zone, so any timestamp near midnight produces a different
 * string on each side and React fails hydration for the whole page. Catalogue
 * dates are a record of when we listed something, not a local event, so UTC is
 * also the more truthful answer.
 */
export function formatDate(value: string | Date | null | undefined): string {
  const d = toDate(value)
  if (!d) return '—'
  return d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

export function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n))
}

/** Seeded shuffle so "random" stays stable within a page render. */
export function seededShuffle<T>(items: T[], seed: number): T[] {
  const out = [...items]
  let s = seed || 1
  for (let i = out.length - 1; i > 0; i--) {
    s = (s * 1664525 + 1013904223) >>> 0
    const j = s % (i + 1)
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

export function uniqueBy<T, K>(items: T[], key: (item: T) => K): T[] {
  const seen = new Set<K>()
  const out: T[] = []
  for (const item of items) {
    const k = key(item)
    if (seen.has(k)) continue
    seen.add(k)
    out.push(item)
  }
  return out
}

export function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}

/** Escape a value for use inside an XML/RSS document. */
export function escapeXml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

/**
 * The language of a listing, when it is worth saying.
 *
 * The catalogue is mostly English and a badge on every card would be noise, but
 * a reader scanning a grid should know that “Pédagothèque de l'ENPC” is in
 * French before they click it. So: a label for everything else, nothing for
 * English, and nothing when the page did not say.
 */
const LANGUAGE_NAMES = new Intl.DisplayNames(['en'], { type: 'language' })

export function foreignLanguage(lang: string | null | undefined): { code: string; name: string } | null {
  const code = (lang ?? '').trim().toLowerCase().split('-')[0]
  if (!code || code.length < 2 || code === 'en') return null
  try {
    const name = LANGUAGE_NAMES.of(code)
    // Intl echoes the input back when it does not recognise a code
    if (!name || name.toLowerCase() === code) return null
    return { code: code.toUpperCase(), name }
  } catch {
    return null
  }
}
