import { banner, colours, log } from './_boot'
import { all, isRemoteDb, migrate } from '../src/lib/db'
import { env, paths } from '../src/lib/env'

banner('Portico — migrate')

await migrate()

const tables = (
  await all<{ name: string }>(
    `SELECT name FROM sqlite_master WHERE type IN ('table','virtual table') AND name NOT LIKE 'sqlite_%' ORDER BY name`,
  )
).map((t) => t.name)

log(`connection ${colours.dim}${isRemoteDb ? env.databaseUrl : `file:${paths.db}`}${colours.reset}`)
log(`${colours.green}schema ready${colours.reset} — ${tables.length} tables`)
console.log(`\n  ${colours.dim}${tables.join('  ')}${colours.reset}\n`)
