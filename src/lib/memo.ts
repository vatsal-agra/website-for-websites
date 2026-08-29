/**
 * Short-lived, single-flight memo.
 *
 * Some values are effectively static within a page render — the taxonomy, the
 * footer's counters — but half a dozen independent sections ask for them. Over
 * a network database, those repeated identical queries are the single largest
 * source of wasted round trips.
 *
 * Single-flight matters as much as the TTL: concurrent callers share one
 * in-flight promise instead of racing to populate the same entry.
 *
 * This is process-local and deliberately short. Numbers served from here are
 * real, just up to `ttlMs` old — never invented to look busier.
 */
export function memo<T>(ttlMs: number, load: () => Promise<T>) {
  let cached: { at: number; value: T } | null = null
  let inFlight: Promise<T> | null = null

  const read = async (): Promise<T> => {
    if (cached && Date.now() - cached.at < ttlMs) return cached.value
    if (inFlight) return inFlight
    inFlight = (async () => {
      try {
        const value = await load()
        cached = { at: Date.now(), value }
        return value
      } finally {
        inFlight = null
      }
    })()
    return inFlight
  }

  read.invalidate = () => {
    cached = null
  }
  return read
}
