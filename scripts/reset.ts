import fs from 'node:fs'
import { banner, colours, log } from './_boot'
import { all, exec } from '../src/lib/db'
import { env, paths } from '../src/lib/env'

/**
 * Drop every table and clear locally generated cover art.
 *
 * Destructive and irreversible, so it refuses to run without `--yes`.
 *   npx tsx scripts/reset.ts --yes
 */

if (!process.argv.includes('--yes')) {
  banner('web-amble — reset')
  const safeUrl = env.databaseUrl.replace(/:\/\/([^:]+):[^@]+@/, '://$1:***@')
  log(`${colours.red}This drops every table in${colours.reset} ${colours.bold}${safeUrl}${colours.reset}`)
  log(`Re-run with ${colours.cyan}--yes${colours.reset} if that is what you want.`)
  process.exit(1)
}

banner('web-amble — reset')

const tables = await all<{ name: string }>(
  `SELECT table_name AS name FROM information_schema.tables WHERE table_schema = 'public'`,
)

if (tables.length) {
  await exec(`DROP TABLE IF EXISTS ${tables.map((t) => `public."${t.name}"`).join(', ')} CASCADE`)
  log(`dropped ${tables.length} table(s)`)
} else {
  log('no tables to drop')
}

if (fs.existsSync(paths.thumbs)) {
  const files = fs.readdirSync(paths.thumbs)
  for (const f of files) fs.rmSync(`${paths.thumbs}/${f}`, { force: true })
  log(`cleared ${files.length} generated thumbnail(s)`)
}

log(`${colours.green}done${colours.reset} — run ${colours.cyan}npm run setup${colours.reset} to rebuild`)
process.exit(0)
