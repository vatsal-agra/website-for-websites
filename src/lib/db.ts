import postgres from 'postgres'
import { env } from './env'
import { SCHEMA_SQL, ALTER_STEPS } from './schema'

/**
 * web-amble speaks Postgres.
 *
 * Timestamps are stored as `YYYY-MM-DD HH:MM:SS` text rather than `timestamptz`.
 * That looks odd for Postgres, but it is deliberate: every comparison, sort and
 * rollup in the product works on that exact string shape, and keeping it means
 * the application layer has one representation of time instead of two.
 * `nowIso()` is the single place that produces it.
 */

declare global {
  // eslint-disable-next-line no-var
  var __webAmbleSql: postgres.Sql | undefined
  // eslint-disable-next-line no-var
  var __webAmbleMigrated: Promise<void> | undefined
}

export function sql(): postgres.Sql {
  if (!globalThis.__webAmbleSql) {
    if (!env.databaseUrl) {
      throw new Error(
        'DATABASE_URL is not set. Copy .env.example to .env.local and point it at your Postgres database.',
      )
    }
    globalThis.__webAmbleSql = postgres(env.databaseUrl, {
      // Supabase's transaction pooler does not support prepared statements
      prepare: false,
      max: env.dbPoolSize + 1,
      idle_timeout: 20,
      connect_timeout: 15,
      onnotice: () => {},
    })
  }
  return globalThis.__webAmbleSql
}

/**
 * The query layer is written with `?` placeholders. Rewriting them to Postgres
 * `$n` here keeps every call site dialect-agnostic. Quoted literals are skipped
 * so a `?` inside a string is never mistaken for a parameter.
 */
export function toPositional(query: string): string {
  let out = ''
  let index = 0
  let inSingle = false
  let inDouble = false

  for (let i = 0; i < query.length; i++) {
    const ch = query[i]
    if (ch === "'" && !inDouble) {
      inSingle = !inSingle
      out += ch
      continue
    }
    if (ch === '"' && !inSingle) {
      inDouble = !inDouble
      out += ch
      continue
    }
    if (ch === '?' && !inSingle && !inDouble) {
      out += `$${++index}`
      continue
    }
    out += ch
  }
  return out
}

// ------------------------------------------------------------- primitives --

/**
 * Turn the one migration mistake people actually hit into a useful message
 * instead of a raw `relation "sites" does not exist`.
 */
function explain(err: unknown): never {
  const code = (err as any)?.code
  const message = String((err as any)?.message ?? '')

  if (code === '42P01') {
    throw new Error(
      'The database has no schema yet. Run `npm run db:migrate` (or `npm run setup` to migrate and seed).',
    )
  }

  // Supabase pauses free-tier projects when they go idle. The pooler then
  // reports a missing tenant, which reads like a credentials problem and is
  // not — it cost hours to diagnose once already.
  if (/tenant\/user .* not found/i.test(message) || code === 'ENOTFOUND') {
    throw new Error(
      'Cannot reach the database. If this is a free-tier Supabase project it has probably ' +
        'auto-paused after being idle — resume it from the dashboard. Otherwise check DATABASE_URL. ' +
        `(driver said: ${message.slice(0, 120)})`,
    )
  }

  throw err
}

/**
 * Concurrency gate.
 *
 * A page like the home shelf fans out ~20 queries at once. Handing all of them
 * to the driver simultaneously overwhelms its connection assignment and some
 * queries are never dispatched at all — the request then hangs forever with no
 * error. Queueing here instead keeps in-flight work at exactly the pool size,
 * which is both predictable and measurably faster than thrashing.
 *
 * Safe because no query is ever issued while another is awaited on the same
 * logical path — every call site either awaits sequentially or fans out via
 * Promise.all, never nests.
 */
const waiting: (() => void)[] = []
let active = 0
let querySeq = 0

function acquire(): Promise<void> {
  if (active < env.dbPoolSize) {
    active++
    return Promise.resolve()
  }
  return new Promise<void>((resolve) => waiting.push(resolve))
}

function release() {
  const next = waiting.shift()
  if (next) next()
  else active--
}

/**
 * Errors that mean "the connection went away", not "the query was wrong".
 *
 * A transaction pooler recycles connections underneath the driver, so a
 * statement occasionally lands on one that is being closed. Postgres never saw
 * it. Left alone this surfaces as a 500 on a page that would have rendered
 * perfectly a second later — which is exactly what happened to
 * `/browse?sort=top&attr=free` once, for no reason anybody could have found in
 * the query.
 */
const TRANSIENT = new Set([
  'ECONNRESET', 'EPIPE', 'ETIMEDOUT', 'ECONNREFUSED',
  'CONNECTION_CLOSED', 'CONNECTION_ENDED', 'CONNECTION_DESTROYED',
  '08000', '08003', '08006', '57P01', '57P02', '57P03',
])

export function isTransient(err: unknown): boolean {
  const code = (err as any)?.code
  return typeof code === 'string' && TRANSIENT.has(code)
}

/**
 * Only a statement that changes nothing may be retried. An INSERT interrupted
 * by a reset connection may or may not have committed, and running it twice is
 * a worse outcome than an error page.
 */
export function isReadOnly(query: string): boolean {
  return /^\s*(?:--[^\n]*\n|\s)*(?:select|with)\b/i.test(query)
}

/** One attempt: hold a slot for exactly as long as the statement runs. */
async function attempt(query: string, text: string, args: any[]): Promise<any> {
  await acquire()

  if (!env.dbTrace) {
    try {
      return await sql().unsafe(text, args)
    } finally {
      release()
    }
  }

  const id = ++querySeq
  const label = query.replace(/\s+/g, ' ').trim().slice(0, 80)
  const started = Date.now()
  console.log(`[db ${id}] -> (${active} active, ${waiting.length} queued) ${label}`)
  try {
    const rows = await sql().unsafe(text, args)
    console.log(`[db ${id}] <- ${Date.now() - started}ms ${(rows as any[]).length} rows`)
    return rows
  } catch (err) {
    console.log(`[db ${id}] !! ${Date.now() - started}ms ${(err as Error).message.slice(0, 80)}`)
    throw err
  } finally {
    release()
  }
}

async function execute(query: string, args: any[]): Promise<any> {
  const text = toPositional(query)
  try {
    return await attempt(query, text, args)
  } catch (err) {
    if (!isTransient(err) || !isReadOnly(query)) throw err
    if (env.dbTrace) console.log('[db] .. the connection went away; retrying once')
    await new Promise((r) => setTimeout(r, 120))
    return attempt(query, text, args)
  }
}

export async function all<T = Record<string, any>>(query: string, args: any[] = []): Promise<T[]> {
  try {
    const rows = await execute(query, args)
    return rows as unknown as T[]
  } catch (err) {
    explain(err)
  }
}

export async function get<T = Record<string, any>>(query: string, args: any[] = []): Promise<T | undefined> {
  const rows = await all<T>(query, args)
  return rows[0]
}

export async function run(
  query: string,
  args: any[] = [],
): Promise<{ rowsAffected: number; rows: any[] }> {
  try {
    const result = await execute(query, args)
    return { rowsAffected: result.count ?? 0, rows: result as unknown as any[] }
  } catch (err) {
    explain(err)
  }
}

/** Execute a multi-statement script (DDL). */
export async function exec(query: string): Promise<void> {
  await sql().unsafe(query).simple()
}

/** Count helper — returns 0 rather than throwing when a table is missing. */
export async function count(query: string, args: any[] = []): Promise<number> {
  try {
    const row = await get<{ n: number | string }>(query, args)
    return Number(row?.n ?? 0)
  } catch {
    return 0
  }
}

// -------------------------------------------------------------- migration --

async function columnExists(table: string, column: string): Promise<boolean> {
  try {
    const rows = await sql().unsafe(
      `select 1 from information_schema.columns where table_schema = 'public' and table_name = $1 and column_name = $2`,
      [table, column],
    )
    return rows.length > 0
  } catch {
    return true
  }
}

export async function migrate(): Promise<void> {
  await exec(SCHEMA_SQL)
  for (const step of ALTER_STEPS) {
    if (!(await columnExists(step.table, step.column))) {
      try {
        await sql().unsafe(step.ddl)
      } catch {
        /* already present in another shape — ignore */
      }
    }
  }
}

/**
 * Ensure the schema exists, at most once per process.
 *
 * Deliberately NOT called from the query path. Migration runs ~40 DDL
 * statements and takes ACCESS EXCLUSIVE locks; putting that on every request
 * made each page wait seconds and made concurrent requests fight each other for
 * locks until they hit the statement timeout. Schema changes belong at deploy
 * time — `npm run db:migrate` — and at worker startup, not in a page render.
 */
export function ready(): Promise<void> {
  if (!globalThis.__webAmbleMigrated) {
    globalThis.__webAmbleMigrated = migrate().catch((err) => {
      globalThis.__webAmbleMigrated = undefined
      throw err
    })
  }
  return globalThis.__webAmbleMigrated
}

export async function close(): Promise<void> {
  if (globalThis.__webAmbleSql) {
    await globalThis.__webAmbleSql.end({ timeout: 5 })
    globalThis.__webAmbleSql = undefined
    globalThis.__webAmbleMigrated = undefined
  }
}

// --------------------------------------------------------------- utilities --

/** The single source of the timestamp format used throughout the schema. */
export function nowIso(): string {
  return new Date().toISOString().replace('T', ' ').slice(0, 19)
}

export function today(): string {
  return new Date().toISOString().slice(0, 10)
}

/** `YYYY-MM-DD HH:MM:SS` for a moment offset from now, for date-window queries. */
export function isoOffset(ms: number): string {
  return new Date(Date.now() + ms).toISOString().replace('T', ' ').slice(0, 19)
}

export function dayOffset(days: number): string {
  return new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10)
}

export async function getSetting(key: string, fallback = ''): Promise<string> {
  const row = await get<{ value: string }>('SELECT value FROM settings WHERE key = ?', [key])
  return row?.value ?? fallback
}

export async function setSetting(key: string, value: string): Promise<void> {
  await run(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    [key, value],
  )
}

export async function audit(action: string, target = '', detail = '', actor = 'system'): Promise<void> {
  try {
    await run('INSERT INTO audit_log (actor, action, target, detail) VALUES (?, ?, ?, ?)', [
      actor,
      action,
      target,
      detail,
    ])
  } catch {
    /* auditing must never break a request */
  }
}
