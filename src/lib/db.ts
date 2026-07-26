import fs from 'node:fs'
import { pathToFileURL } from 'node:url'
import { createClient, type Client, type InArgs, type InStatement } from '@libsql/client'
import { env, paths } from './env'
import { SCHEMA_SQL, ALTER_STEPS } from './schema'

/**
 * Portico speaks libSQL — SQLite's dialect, over either a local file or HTTP.
 *
 * Locally that is `file:./data/portico.db` and behaves exactly like SQLite.
 * In production (Netlify, or any serverless host) there is no persistent disk,
 * so the same schema and the same SQL run against a hosted libSQL database via
 * `TURSO_DATABASE_URL`. FTS5, `json_extract`, `julianday` and `power` all
 * behave identically, which is why nothing above this file had to change shape.
 */

declare global {
  // eslint-disable-next-line no-var
  var __porticoClient: Client | undefined
  // eslint-disable-next-line no-var
  var __porticoMigrated: Promise<void> | undefined
}

export const isRemoteDb = Boolean(env.databaseUrl && !env.databaseUrl.startsWith('file:'))

/**
 * A local database path has to become a real file URL. Building it by hand
 * breaks the moment the project lives somewhere with a space or a backslash in
 * the path, which on Windows is essentially always.
 */
export function localFileUrl(): string {
  return pathToFileURL(paths.db).href
}

function createDbClient(): Client {
  if (isRemoteDb) {
    return createClient({ url: env.databaseUrl, authToken: env.databaseAuthToken })
  }
  // local file — make sure the directory exists first
  fs.mkdirSync(env.dataDir, { recursive: true })
  return createClient({ url: env.databaseUrl || localFileUrl() })
}

export function client(): Client {
  if (!globalThis.__porticoClient) globalThis.__porticoClient = createDbClient()
  return globalThis.__porticoClient
}

// ------------------------------------------------------------- primitives --

export async function all<T = Record<string, any>>(sql: string, args: InArgs = []): Promise<T[]> {
  await ready()
  const result = await client().execute({ sql, args })
  return result.rows as unknown as T[]
}

export async function get<T = Record<string, any>>(sql: string, args: InArgs = []): Promise<T | undefined> {
  const rows = await all<T>(sql, args)
  return rows[0]
}

export async function run(
  sql: string,
  args: InArgs = [],
): Promise<{ rowsAffected: number; lastInsertRowid: number }> {
  await ready()
  const result = await client().execute({ sql, args })
  return {
    rowsAffected: result.rowsAffected,
    lastInsertRowid: result.lastInsertRowid === undefined ? 0 : Number(result.lastInsertRowid),
  }
}

/** Run several statements atomically. */
export async function batch(statements: InStatement[]): Promise<void> {
  if (!statements.length) return
  await ready()
  await client().batch(statements, 'write')
}

/** Execute a multi-statement script (DDL). */
export async function exec(sql: string): Promise<void> {
  await client().executeMultiple(sql)
}

/** Count helper — returns 0 rather than throwing when a table is missing. */
export async function count(sql: string, args: InArgs = []): Promise<number> {
  try {
    const row = await get<{ n: number }>(sql, args)
    return Number(row?.n ?? 0)
  } catch {
    return 0
  }
}

// -------------------------------------------------------------- migration --

/**
 * Talks to the client directly rather than going through `all()`. Every public
 * query awaits `ready()`, and `ready()` is awaiting this migration — routing
 * through it here would deadlock the process on the very first query.
 */
async function columnExists(table: string, column: string): Promise<boolean> {
  try {
    const result = await client().execute(`PRAGMA table_info(${table})`)
    return (result.rows as unknown as { name: string }[]).some((r) => r.name === column)
  } catch {
    return true
  }
}

export async function migrate(): Promise<void> {
  const db = client()
  if (!isRemoteDb) {
    // only meaningful for a local file; harmless to skip against a hosted db
    await db.execute('PRAGMA journal_mode = WAL').catch(() => {})
    await db.execute('PRAGMA foreign_keys = ON').catch(() => {})
  }
  await db.executeMultiple(SCHEMA_SQL)
  for (const step of ALTER_STEPS) {
    if (!(await columnExists(step.table, step.column))) {
      try {
        await db.execute(step.ddl)
      } catch {
        /* already present in another shape — ignore */
      }
    }
  }
}

/**
 * Every query waits on this once per process. Serverless invocations get a cold
 * database handle, so the schema check has to be part of the request path
 * rather than something a human remembers to run.
 */
export function ready(): Promise<void> {
  if (!globalThis.__porticoMigrated) {
    globalThis.__porticoMigrated = migrate().catch((err) => {
      globalThis.__porticoMigrated = undefined
      throw err
    })
  }
  return globalThis.__porticoMigrated
}

// --------------------------------------------------------------- utilities --

export function nowIso(): string {
  return new Date().toISOString().replace('T', ' ').slice(0, 19)
}

export function today(): string {
  return new Date().toISOString().slice(0, 10)
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
