import { banner, colours, log } from './_boot'
import { all, migrate } from '../src/lib/db'
import { env } from '../src/lib/env'

banner('web-amble — migrate')

await migrate()

const tables = (
  await all<{ name: string }>(
    `SELECT table_name AS name FROM information_schema.tables
     WHERE table_schema = 'public' ORDER BY table_name`,
  )
).map((t) => t.name)

// never print the password
const safeUrl = env.databaseUrl.replace(/:\/\/([^:]+):[^@]+@/, '://$1:***@')
log(`connection ${colours.dim}${safeUrl}${colours.reset}`)
log(`${colours.green}schema ready${colours.reset} — ${tables.length} tables`)
console.log(`\n  ${colours.dim}${tables.join('  ')}${colours.reset}\n`)
