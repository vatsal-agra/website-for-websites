import fs from 'node:fs'
import { banner, colours, log } from './_boot'
import { env, paths } from '../src/lib/env'

banner('Portico — reset')

for (const file of [paths.db, `${paths.db}-wal`, `${paths.db}-shm`]) {
  if (fs.existsSync(file)) {
    fs.rmSync(file, { force: true })
    log(`removed ${colours.dim}${file}${colours.reset}`)
  }
}

if (fs.existsSync(paths.thumbs)) {
  const files = fs.readdirSync(paths.thumbs)
  for (const f of files) fs.rmSync(`${paths.thumbs}/${f}`, { force: true })
  log(`cleared ${files.length} generated thumbnail(s)`)
}

log(`${colours.green}done${colours.reset} — run ${colours.cyan}npm run setup${colours.reset} to rebuild (${env.dataDir})`)
